/* OmniRoute glitches: a model that never answers, one that stalls mid-stream, one that returns an empty 200.
   The agent must cut each off, move to a working model, remember the broken one for the next message,
   and let the user switch models mid-request.   node test/router-robust.test.js */
"use strict";
const http = require("http"), fs = require("fs"), os = require("os"), path = require("path"), assert = require("assert");
const { createStore } = require("../core/store");
const { createAgent } = require("../core/agent");

const IDS = ["auto/best-coding", "auto/best-fast", "auto/best-reasoning", "auto/best-chat"];
const models = IDS.map((id) => ({ id, name: id, context_length: 65536, pricing: { prompt: "0", completion: "0" }, architecture: { input_modalities: ["text"] }, supported_parameters: ["tools"], top_provider: {}, local: true }));

// behaviour per model: "hang" (headers never come), "stall" (one chunk then silence), "empty" (200 with no content), "ok"
function server(port, behave, asked) {
  return new Promise((resolve) => {
    const srv = http.createServer((req, res) => {
      let b = ""; req.on("data", (d) => (b += d)).on("end", () => {
        const j = JSON.parse(b), how = behave[j.model] || "ok"; asked.push(j.model);
        const w = (o) => res.write("data: " + JSON.stringify(o) + "\n\n");
        if (how === "hang") return;
        res.writeHead(200, { "Content-Type": "text/event-stream" });
        if (how === "stall") return w({ choices: [{ delta: { content: "" } }] });
        if (how !== "empty") w({ choices: [{ delta: { content: "hello from " + j.model } }] });
        w({ choices: [{ delta: {}, finish_reason: "stop" }] }); res.end("data: [DONE]\n\n");
      });
    }).listen(port, () => resolve(srv));
  });
}

function setup(port) {
  const store = createStore(fs.mkdtempSync(path.join(os.tmpdir(), "anti-rb-"))), work = fs.mkdtempSync(path.join(os.tmpdir(), "anti-rbw-"));
  store.setSettings({ baseUrl: `http://localhost:${port}/v1`, model: IDS[0], favorites: [], firstByteTimeout: 1, idleTimeout: 1 });
  store.setModels(models);
  const notices = [], waiters = [];
  const agent = createAgent({ store, getKey: () => "", ui: { openPreview() {}, previewRead: async () => null },
    emit: (e) => {
      if (e.t === "item" && e.item.kind === "notice") notices.push(e.item);
      if (e.t === "status" && !e.running) waiters.splice(0).forEach((f) => f());
    } });
  const s = store.createSession({ cwd: work, model: IDS[0], perm: "auto" });
  const turn = (text) => new Promise((res) => { waiters.push(res); agent.send(s.id, { text }); });
  const last = () => String(s.messages[s.messages.length - 1].content);
  return { store, agent, s, notices, turn, last };
}

(async () => {
  const kill = setTimeout(() => { console.error("FAIL: timed out"); process.exit(1); }, 30000);
  const asked = [];
  // 1) hang → stall → empty → the fourth model answers
  let srv = await server(5201, { [IDS[0]]: "hang", [IDS[1]]: "stall", [IDS[2]]: "empty" }, asked);
  let t = setup(5201), t0 = Date.now();
  await t.turn("hi");
  assert.deepStrictEqual(asked, IDS, "tries each model once, in order");
  assert.match(t.last(), /hello from auto\/best-chat/, "finishes on the working model");
  assert.ok(Date.now() - t0 < 8000, "timeouts cut quickly (" + (Date.now() - t0) + " ms)");
  assert.ok(t.notices.some((n) => /انتهت مهلة/.test(n.text)), "timeout explained");
  assert.ok(t.notices.some((n) => /ردّ فارغ/.test(n.text)), "empty reply explained");
  assert.ok(!t.notices.some((n) => n.level === "error"), "no error when a fallback works");
  // 2) the next message skips the models that just failed instead of waiting on them again
  asked.length = 0;
  await t.turn("again");
  assert.deepStrictEqual(asked, [IDS[3]], "broken models are remembered");
  assert.ok(t.notices.some((n) => /تعطّل قبل قليل/.test(n.text)), "says it is using a stand-in");
  srv.close();

  // 3) the user switches model while a request hangs: cut at once and retry on the new one
  asked.length = 0;
  srv = await server(5202, { [IDS[0]]: "hang" }, asked);
  t = setup(5202);
  t.store.setSettings({ firstByteTimeout: 60 });
  const done = t.turn("hi");
  await new Promise((r) => setTimeout(r, 300));
  t.s.model = IDS[1]; assert.ok(t.agent.switchModel(t.s.id, IDS[1]), "switch reaches the running request");
  t0 = Date.now(); await done;
  assert.ok(Date.now() - t0 < 2000, "switch is immediate");
  assert.deepStrictEqual(asked, [IDS[0], IDS[1]]);
  assert.match(t.last(), /hello from auto\/best-fast/);
  assert.ok(t.notices.some((n) => /تم التبديل إلى/.test(n.text)));
  srv.close();

  clearTimeout(kill);
  console.log("PASS router robustness (timeouts, empty replies, sticky fallback, live switch)");
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
