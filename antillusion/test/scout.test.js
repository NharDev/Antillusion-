/* The user's real situation: every OmniRoute combo fails (empty wallets, expired cookies, rate limits) while a few
   provider models still answer. The agent must find one of those by itself and finish; when nothing works it must say,
   per provider, what is wrong and how to fix it.   node test/scout.test.js */
"use strict";
const http = require("http"), fs = require("fs"), os = require("os"), path = require("path"), assert = require("assert");
const { createStore } = require("../core/store");
const { createAgent } = require("../core/agent");
const { diagnose, candidates } = require("../core/scout");

const RAW = "bad_gateway: cheaperinference/glm-5.1: model — [402]: Insufficient wallet balance for this request. (HTTP 402);\nzenmux-free/stepfun/step-3.5-flash-free: auth — [401]: ZenMux Free: cookies expired or invalid (HTTP 401);\ngroq/openai/gpt-oss-safeguard-20b: model — [413]: Request too large for model on tokens per minute (TPM): Limit 2000, Requested 12020 https://console.groq.com/settings/billing (HTTP 413);\ndevin-cli/deepseek-v4-flash-max: provider — Stream ended before producing a non-ping SSE event (HTTP 502)";
const IDS = ["auto/best-coding", "auto/best-fast", "auto/best-reasoning", "auto/best-chat", "cheaperinference/glm-5.1", "zenmux-free/stepfun/step-3.5-flash-free", "agnes/claude-sonnet-4", "aihorde/llama-3.3-70b", "groq/whisper-large-v3"];
const models = IDS.map((id) => ({ id, name: id, context_length: 65536, pricing: { prompt: "0", completion: "0" }, architecture: { input_modalities: ["text"] }, supported_parameters: ["tools"], top_provider: {}, local: true }));

function run(port, working) {
  return new Promise((resolve) => {
    const asked = [];
    const srv = http.createServer((req, res) => {
      let b = ""; req.on("data", (d) => (b += d)).on("end", () => {
        const j = JSON.parse(b); asked.push([j.model, j.stream ? "stream" : "probe", j.max_tokens]);
        if (!working.includes(j.model)) { res.writeHead(502, { "Content-Type": "application/json" }); return res.end(JSON.stringify({ error: { message: RAW, code: 502 } })); }
        if (!j.stream) { res.writeHead(200, { "Content-Type": "application/json" }); return res.end(JSON.stringify({ choices: [{ message: { role: "assistant", content: "ok" } }] })); }
        res.writeHead(200, { "Content-Type": "text/event-stream" });
        res.write("data: " + JSON.stringify({ choices: [{ delta: { content: "hello from " + j.model } }] }) + "\n\n"); res.end("data: [DONE]\n\n");
      });
    }).listen(port, () => {
      const store = createStore(fs.mkdtempSync(path.join(os.tmpdir(), "anti-sc-"))), work = fs.mkdtempSync(path.join(os.tmpdir(), "anti-scw-"));
      store.setSettings({ baseUrl: `http://localhost:${port}/v1`, model: IDS[0], favorites: [], scoutTimeout: 5 });
      store.setModels(models);
      const notices = [], timer = setTimeout(() => { console.error("FAIL: timed out"); process.exit(1); }, 30000);
      const agent = createAgent({ store, getKey: () => "", ui: { openPreview() {}, previewRead: async () => null },
        emit: (e) => {
          if (e.t === "item" && e.item.kind === "notice") notices.push(e.item);
          if (e.t !== "status" || e.running) return;
          clearTimeout(timer); srv.close(); const s = store.getSession(store.listSessions()[0].id); resolve({ asked, notices, s, store });
        } });
      const s = store.createSession({ cwd: work, model: IDS[0], perm: "auto" });
      agent.send(s.id, { text: "hi" });
    });
  });
}

(async () => {
  // pure helpers
  const d = diagnose("خطأ (HTTP " + RAW + ")");
  assert.deepStrictEqual(d.providers.map((p) => p.provider), ["cheaperinference", "zenmux-free", "groq", "devin-cli"]);
  assert.match(d.providers[1].reason, /الكوكيز/); assert.match(d.providers[2].reason, /حدّ الطبقة المجانية/); assert.match(d.providers[3].reason, /انقطع البث/);
  assert.ok(!candidates(models).some((c) => /^auto\/|whisper/.test(c.id)), "combos and audio models are not probed");

  // 1) combos broken, one provider model works → found by the scout and used
  let r = await run(5211, ["agnes/claude-sonnet-4"]);
  assert.match(String(r.s.messages[r.s.messages.length - 1].content), /hello from agnes\/claude-sonnet-4/, "finished on the scouted model");
  assert.ok(r.notices.some((n) => /وجدت 1 نموذجاً يعمل/.test(n.text)), "says what it found");
  assert.ok(!r.notices.some((n) => n.level === "error"), "no error");
  assert.deepStrictEqual(r.store.settings().scout.ok.map((x) => x.id), ["agnes/claude-sonnet-4"], "remembered for next time");
  assert.ok(r.asked.filter((a) => a[1] === "stream").every((a) => a[2] <= 4096), "reply reservation fits free tiers");

  // 2) nothing works → one error with a per-provider diagnosis
  r = await run(5212, []);
  const err = r.notices.find((n) => n.level === "error");
  assert.ok(err && err.diag && err.diag.length >= 3, "per-provider diagnosis attached");
  assert.match(err.text, /فحصتُ بقية النماذج/);
  console.log("PASS scout (finds a working model; diagnoses " + err.diag.length + " providers when none work)");
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
