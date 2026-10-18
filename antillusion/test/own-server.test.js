/* Checks the "own server" path without a GPU: a mock OpenAI-compatible server (like vLLM / llama.cpp / Ollama)
   streams one tool call and one answer; the agent must work with no API key and send no OpenRouter-only fields.
   node test/own-server.test.js */
"use strict";

const http = require("http"), fs = require("fs"), os = require("os"), path = require("path");
const { createStore } = require("../core/store");
const { createAgent } = require("../core/agent");

let seen = null, n = 0;
const srv = http.createServer((req, res) => {
  if (req.url === "/v1/models") { res.writeHead(200, { "Content-Type": "application/json" }); return res.end(JSON.stringify({ data: [{ id: "my-coder", max_model_len: 65536 }] })); }
  let b = "";
  req.on("data", (d) => (b += d)).on("end", () => {
    const j = JSON.parse(b); seen = { keys: Object.keys(j).sort(), auth: req.headers.authorization || null, max: j.max_tokens }; n++;
    res.writeHead(200, { "Content-Type": "text/event-stream" });
    const w = (o) => res.write("data: " + JSON.stringify(o) + "\n\n");
    if (n === 1) {
      w({ choices: [{ delta: { tool_calls: [{ index: 0, id: "c1", function: { name: "write_file", arguments: '{"path":"a.js",' } }] } }] });
      w({ choices: [{ delta: { tool_calls: [{ index: 0, function: { arguments: '"content":"console.log(1)\\n"}' } }] } }] });
      w({ choices: [{ delta: {}, finish_reason: "tool_calls" }] });
    } else { w({ choices: [{ delta: { content: "done." } }] }); w({ choices: [{ delta: {}, finish_reason: "stop" }] }); }
    w({ choices: [], usage: { prompt_tokens: 100, completion_tokens: 10 } });
    res.end("data: [DONE]\n\n");
  });
}).listen(5197, async () => {
  const store = createStore(fs.mkdtempSync(path.join(os.tmpdir(), "anti-own-"))), work = fs.mkdtempSync(path.join(os.tmpdir(), "anti-ownw-"));
  store.setSettings({ baseUrl: "http://localhost:5197/v1", model: "my-coder" });
  store.setModels([{ id: "my-coder", name: "my-coder", context_length: 65536, pricing: { prompt: "0", completion: "0" }, architecture: { input_modalities: ["text"] }, supported_parameters: ["tools"], top_provider: {}, local: true }]);
  const fail = (m) => { console.error("FAIL:", m); process.exit(1); };
  const timer = setTimeout(() => fail("timed out"), 30000);
  const agent = createAgent({
    store, getKey: () => "", ui: { openPreview() {}, previewRead: async () => null },
    emit: (e) => {
      if (e.t === "item" && e.item.kind === "notice" && e.item.level === "error") fail(e.item.text);
      if (e.t !== "status" || e.running) return;
      clearTimeout(timer);
      const s = store.getSession(store.listSessions()[0].id);
      console.log("request fields:", seen.keys.join(", "), "| auth header:", seen.auth, "| max_tokens:", seen.max);
      if (seen.keys.some((k) => ["provider", "models", "reasoning", "usage"].includes(k))) fail("OpenRouter-only field was sent");
      if (!seen.keys.includes("stream_options")) fail("stream_options missing");
      if (!fs.existsSync(path.join(work, "a.js"))) fail("tool call did not run");
      if (s.usage.prompt !== 200 || s.usage.requests !== 2) fail("usage not counted: " + JSON.stringify(s.usage));
      console.log("PASS — 2 requests, file written, usage", JSON.stringify(s.usage));
      srv.close(); setTimeout(() => process.exit(0), 100);
    },
  });
  const s = store.createSession({ cwd: work, model: "my-coder", perm: "auto" });
  agent.send(s.id, { text: "write a file" });
});
