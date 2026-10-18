/* OmniRoute-style failure: every provider behind the selected combo fails (402/401/429 in one 502 bad_gateway).
   The agent must switch to the next available model by itself, say so, and finish the turn. Also: when every model fails,
   the final error is a short Arabic summary with the raw text as "detail".   node test/router-fallback.test.js */
"use strict";
const http = require("http"), fs = require("fs"), os = require("os"), path = require("path"), assert = require("assert");
const { createStore } = require("../core/store");
const { createAgent } = require("../core/agent");

const RAW = "bad_gateway: cheaperinference/glm-5.1: model — [402]: Insufficient wallet balance; oc/muse-spark-1.2: model — [402]: requires an opencode API key; moonshot/kimi-k2.7-code: rate limit — [429]: account suspended; aion-labs/aion-2.5: model — [400]: Unknown model (+4 more)";
const models = (ids) => ids.map((id) => ({ id, name: id, context_length: 65536, pricing: { prompt: "0", completion: "0" }, architecture: { input_modalities: ["text"] }, supported_parameters: ["tools"], top_provider: {}, local: true }));

function run(port, broken, expectOk) {
  return new Promise((resolve) => {
    const asked = [];
    const srv = http.createServer((req, res) => {
      let b = ""; req.on("data", (d) => (b += d)).on("end", () => {
        const j = JSON.parse(b); asked.push(j.model);
        if (broken.includes(j.model)) { res.writeHead(502, { "Content-Type": "application/json" }); return res.end(JSON.stringify({ error: { message: RAW, code: 502 } })); }
        res.writeHead(200, { "Content-Type": "text/event-stream" }); const w = (o) => res.write("data: " + JSON.stringify(o) + "\n\n");
        w({ choices: [{ delta: { content: "hello from " + j.model } }] }); w({ choices: [{ delta: {}, finish_reason: "stop" }] }); w({ choices: [], usage: { prompt_tokens: 10, completion_tokens: 3 } }); res.end("data: [DONE]\n\n");
      });
    }).listen(port, () => {
      const store = createStore(fs.mkdtempSync(path.join(os.tmpdir(), "anti-fb-"))), work = fs.mkdtempSync(path.join(os.tmpdir(), "anti-fbw-"));
      store.setSettings({ baseUrl: `http://localhost:${port}/v1`, model: "auto/best-coding", favorites: [] });
      store.setModels(models(["auto/best-coding", "auto/best-fast", "auto/best-reasoning"]));
      const notices = []; const timer = setTimeout(() => { console.error("FAIL: timed out"); process.exit(1); }, 20000);
      const agent = createAgent({ store, getKey: () => "", ui: { openPreview() {}, previewRead: async () => null },
        emit: (e) => {
          if (e.t === "item" && e.item.kind === "notice") notices.push(e.item);
          if (e.t !== "status" || e.running) return;
          clearTimeout(timer); srv.close(); const s = store.getSession(store.listSessions()[0].id); resolve({ asked, notices, s });
        } });
      const s = store.createSession({ cwd: work, model: "auto/best-coding", perm: "auto" });
      agent.send(s.id, { text: "hi" });
    });
  });
}

(async () => {
  // 1) first model broken → the agent moves on and finishes
  let r = await run(5198, ["auto/best-coding"]);
  assert.deepStrictEqual(r.asked.slice(0, 2), ["auto/best-coding", "auto/best-fast"], "falls back to the next available model");
  assert.ok(r.notices.some((n) => n.level === "warn" && /auto\/best-fast/.test(n.text) && n.detail), "tells the user, raw error kept as detail");
  assert.ok(!r.notices.some((n) => n.level === "error"), "no error when a fallback works");
  assert.match(String(r.s.messages[r.s.messages.length - 1].content), /hello from auto\/best-fast/);
  // 2) everything broken → one short summary, raw text folded away, action buttons
  r = await run(5199, ["auto/best-coding", "auto/best-fast", "auto/best-reasoning"]);
  const err = r.notices.find((n) => n.level === "error");
  assert.ok(err, "final error shown"); assert.match(err.text, /فشل كل المزوّدين/); assert.match(err.text, /رصيد غير كافٍ ×2/); assert.ok(err.detail.includes("Insufficient wallet"));
  assert.deepStrictEqual(err.actions, ["router", "model", "health"]); assert.ok(r.notices.some((n) => n.route && n.route.length), "attempts are kept as a route trail"); assert.ok(err.text.length < 260, "summary stays short");
  console.log("PASS router fallback (" + r.asked.length + " attempts when all fail)");
  process.exit(0);
})();
