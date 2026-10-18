/* A thinking model spends the whole reply budget on reasoning (finish_reason "length", no answer): the agent must retry
   the step with a bigger budget instead of stopping; a reply cut mid-text must be continued.   node test/length.test.js */
"use strict";
const http = require("http"), fs = require("fs"), os = require("os"), path = require("path"), assert = require("assert");
const { createStore } = require("../core/store");
const { createAgent } = require("../core/agent");
const model = { id: "auto/best-coding", name: "x", context_length: 131072, pricing: { prompt: "0", completion: "0" }, architecture: { input_modalities: ["text"] }, supported_parameters: ["tools"], top_provider: {}, local: true };

function run(port, script) {
  return new Promise((resolve) => {
    const asked = [];
    const srv = http.createServer((req, res) => { let b = ""; req.on("data", (d) => (b += d)).on("end", () => {
      const j = JSON.parse(b); asked.push(j); const step = script[Math.min(asked.length - 1, script.length - 1)];
      res.writeHead(200, { "Content-Type": "text/event-stream" }); const w = (o) => res.write("data: " + JSON.stringify(o) + "\n\n");
      if (step.reasoning) w({ choices: [{ delta: { reasoning: step.reasoning } }] });
      if (step.text) w({ choices: [{ delta: { content: step.text } }] });
      w({ choices: [{ delta: {}, finish_reason: step.finish || "stop" }] }); res.end("data: [DONE]\n\n");
    }); }).listen(port, () => {
      const store = createStore(fs.mkdtempSync(path.join(os.tmpdir(), "anti-len-"))); store.setSettings({ baseUrl: `http://localhost:${port}/v1`, model: model.id, maxTokens: 64000 }); store.setModels([model]);
      const notices = [], timer = setTimeout(() => { console.error("FAIL: timed out"); process.exit(1); }, 15000);
      const agent = createAgent({ store, getKey: () => "", ui: {}, emit: (e) => { if (e.t === "item" && e.item.kind === "notice") notices.push(e.item);
        if (e.t === "status" && !e.running) { clearTimeout(timer); srv.close(); resolve({ asked, notices, s: store.getSession(store.listSessions()[0].id) }); } } });
      const s = store.createSession({ cwd: fs.mkdtempSync(path.join(os.tmpdir(), "anti-lenw-")), model: model.id }); agent.send(s.id, { text: "اعمل لي لعبة شوتر" });
    });
  });
}

(async () => {
  // 1) all thinking, cut at the limit → retried with a bigger budget, then answers
  let r = await run(5221, [{ reasoning: "thinking a lot…", finish: "length" }, { text: "here is the game" }]);
  assert.strictEqual(r.asked.length, 2);
  assert.ok(r.asked[1].max_tokens > r.asked[0].max_tokens, `budget grows: ${r.asked[0].max_tokens} → ${r.asked[1].max_tokens}`);
  assert.ok(r.asked[1].max_tokens <= 64000, "never above the user's setting");
  assert.match(String(r.s.messages[r.s.messages.length - 1].content), /here is the game/);
  assert.ok(!r.notices.some((n) => n.level === "warn" && /حدّ الطول/.test(n.text)), "no dead-end warning");
  assert.strictEqual(r.asked[0].reasoning_effort, "low", "'no thinking' is passed to the server");
  // 2) cut mid-text → continued
  r = await run(5222, [{ text: "part one, ", finish: "length" }, { text: "part two." }]);
  assert.strictEqual(r.asked.length, 2); assert.match(JSON.stringify(r.asked[1].messages.slice(-1)), /Continue exactly where you stopped/);
  console.log(`PASS length (budget ${r.asked[0].max_tokens} grows on a thinking cut-off; cut text is continued)`);
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
