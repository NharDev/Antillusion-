/* Antillusion Code: (1) the router learns from outcomes, (2) "done" is verified — a broken file goes back to the model
   until it is fixed, (3) the lead splits a build across parallel workers with the delegate tool.   node test/code.test.js */
"use strict";
const http = require("http"), fs = require("fs"), os = require("os"), path = require("path"), assert = require("assert");
const { createStore } = require("../core/store");
const { createAgent } = require("../core/agent");
const { createRouter } = require("../core/router");

const M = (id) => ({ id, name: id, context_length: 131072, pricing: { prompt: "0", completion: "0" }, architecture: { input_modalities: ["text"] }, supported_parameters: ["tools"], top_provider: {}, local: true });
const sse = (res, chunks) => { res.writeHead(200, { "Content-Type": "text/event-stream" }); for (const c of chunks) res.write("data: " + JSON.stringify(c) + "\n\n"); res.end("data: [DONE]\n\n"); };
const say = (text) => [{ choices: [{ delta: { content: text } }] }, { choices: [{ delta: {}, finish_reason: "stop" }] }];
const call = (name, args, id = "c" + Math.random().toString(36).slice(2, 7)) => [{ choices: [{ delta: { tool_calls: [{ index: 0, id, function: { name, arguments: JSON.stringify(args) } }] } }] }, { choices: [{ delta: {}, finish_reason: "tool_calls" }] }];

function session(port, handler, opts = {}) {
  return new Promise((resolve) => {
    const seen = [];
    const srv = http.createServer((req, res) => { let b = ""; req.on("data", (d) => (b += d)).on("end", () => { const j = JSON.parse(b); seen.push({ j, at: Date.now() }); handler(j, res, seen); }); }).listen(port, () => {
      const store = createStore(fs.mkdtempSync(path.join(os.tmpdir(), "anti-code-"))), work = fs.mkdtempSync(path.join(os.tmpdir(), "anti-codew-"));
      store.setSettings({ baseUrl: `http://localhost:${port}/v1`, model: "auto/best-coding", perm: "auto" }); store.setModels([M("auto/best-coding"), M("prov/qwen3-coder"), M("prov/deepseek-v3")]);
      const items = new Map(), timer = setTimeout(() => { console.error("FAIL: timed out"); process.exit(1); }, 20000);
      const agent = createAgent({ store, getKey: () => "", ui: {}, emit: (e) => { if (e.t === "item") items.set(e.item.id, e.item); if (e.t === "status" && !e.running) { clearTimeout(timer); srv.close(); resolve({ seen, items: [...items.values()], s: store.getSession(store.listSessions()[0].id), work, agent }); } } });
      const s = store.createSession({ cwd: work, model: "auto/best-coding", perm: "auto", kind: "code", mode: "agent" });
      agent.send(s.id, { text: opts.text || "build it" });
    });
  });
}

(async () => {
  // 1) router: evidence beats names; a model that just failed drops
  const r = createRouter({});
  assert.ok(r.score("x/claude-sonnet-4.5", "code") > r.score("x/llama-3.2-3b", "code"), "names give a prior");
  for (let i = 0; i < 8; i++) { r.record("x/claude-sonnet-4.5", { ok: false, kind: "billing" }); r.record("x/llama-3.2-3b", { ok: true, ms: 3000 }); }
  assert.deepStrictEqual(r.rank(["x/claude-sonnet-4.5", "x/llama-3.2-3b"], "code"), ["x/llama-3.2-3b", "x/claude-sonnet-4.5"], "evidence wins");

  // 2) verification: the model writes broken JS and says done → it gets the error back and fixes it
  let res = await session(5231, (j, res, seen) => {
    const last = JSON.stringify(j.messages.slice(-1));
    if (/Automatic verification/.test(last)) return sse(res, call("write_file", { path: "game.js", content: "export function start() { return 1; }\n" }));
    if (j.messages.some((m) => m.role === "tool")) return sse(res, say(seen.length > 3 ? "Fixed and verified." : "Done."));
    sse(res, call("write_file", { path: "game.js", content: "export function start( { return 1; }\n" }));
  });
  const verify = res.items.filter((i) => i.kind === "verify"); if (verify.length < 2) console.log(JSON.stringify(res.items.map((i) => [i.kind, i.status, i.text && i.text.slice(0, 80), i.output && i.output.slice(0, 120)])), res.seen.length);
  assert.ok(verify.length >= 2, "two verification rounds shown");
  assert.strictEqual(verify[0].status, "fail"); assert.strictEqual(verify[verify.length - 1].status, "ok");
  assert.ok(/Syntax error in game\.js/.test(JSON.stringify(res.s.messages)), "the problem was handed to the model");
  assert.match(fs.readFileSync(path.join(res.work, "game.js"), "utf8"), /start\(\)/, "file fixed");

  // 3) team: the lead delegates two parts; both workers run (in parallel) and write their files; the lead integrates
  res = await session(5232, (j, res) => {
    const first = String(j.messages.find((m) => m.role === "user").content || "");
    const worker = /You are worker (\d)/.exec(first);
    if (worker) {
      if (j.messages.some((m) => m.role === "tool")) return sse(res, say(`Worker ${worker[1]} built its file; exports part${worker[1]}().`));
      return setTimeout(() => sse(res, call("write_file", { path: `part${worker[1]}.js`, content: `export function part${worker[1]}() { return ${worker[1]}; }\n` })), 300);
    }
    assert.ok(j.tools.some((t) => t.function.name === "delegate"), "the lead has the delegate tool");
    if (j.messages.some((m) => m.role === "tool")) return sse(res, say("Integrated both parts."));
    sse(res, call("delegate", { context: "Two ES modules.", tasks: [{ title: "Part one", files: ["part1.js"], instructions: "export part1()" }, { title: "Part two", files: ["part2.js"], instructions: "export part2()" }] }));
  }, { text: "build a two-part project" });
  const team = res.items.find((i) => i.kind === "team");
  assert.ok(team && team.done && team.workers.every((w) => w.status === "done"), "team card finished");
  assert.ok(fs.existsSync(path.join(res.work, "part1.js")) && fs.existsSync(path.join(res.work, "part2.js")), "both workers wrote their files");
  const workerReqs = res.seen.filter((x) => /You are worker/.test(JSON.stringify(x.j.messages[1] || "")) && !x.j.messages.some((m) => m.role === "tool"));
  assert.ok(workerReqs.length === 2 && Math.abs(workerReqs[0].at - workerReqs[1].at) < 250, "workers started in parallel");
  assert.ok(!res.seen.some((x) => /You are worker/.test(JSON.stringify(x.j.messages[1] || "")) && x.j.tools.some((t) => t.function.name === "delegate")), "workers cannot delegate further");
  assert.ok(/Worker 1 built/.test(JSON.stringify(res.s.messages)), "the lead got the workers' reports");
  console.log("PASS code (router learns, verification forces fixes, parallel team)");
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
