/* End-to-end check of the agent core against the real API, without Electron:
   node test/core.test.js ["prompt"] [model]      (reads OPENROUTER_API_KEY from ../.env)
   Runs in a throw-away workspace with permission "auto" and prints every event. */
"use strict";

const fs = require("fs");
const os = require("os");
const path = require("path");
const { createStore } = require("../core/store");
const { createAgent } = require("../core/agent");
const tools = require("../core/tools");

const key = ((fs.readFileSync(path.join(__dirname, "..", ".env"), "utf8").match(/^OPENROUTER_API_KEY=(\S+)/m) || [])[1]) || process.env.OPENROUTER_API_KEY;
const work = fs.mkdtempSync(path.join(os.tmpdir(), "antillusion-work-"));
const store = createStore(fs.mkdtempSync(path.join(os.tmpdir(), "antillusion-data-")));
const prompt = process.argv[2] || "Create index.html with a small counter app (a button that increments a number, styled nicely), serve it, and verify it in the preview. Then tell me in one line what you did.";
const model = process.argv[3] || "anthropic/claude-haiku-5.5";

(async () => {
  const list = (await (await fetch("https://openrouter.ai/api/v1/models")).json()).data;
  store.setModels(list);
  const previews = [];
  const agent = createAgent({
    store, getKey: () => key,
    ui: {
      openPreview: (p) => { previews.push(p.url); console.log("  [preview opened]", p.url); },
      previewRead: async () => { if (!previews.length) return null; const url = previews[previews.length - 1]; const html = await (await fetch(url)).text(); return { title: (html.match(/<title>(.*?)<\/title>/i) || [, ""])[1], url, text: html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").slice(0, 500), errors: [] }; },
    },
    emit: (e) => {
      if (e.t === "delta") process.stdout.write(e.text || "");
      else if (e.t === "item" && e.item.kind === "tool" && e.item.status !== "running") console.log(`\n  [tool ${e.item.name} → ${e.item.status}] ${JSON.stringify(e.item.args).slice(0, 110)}\n     ${String(e.item.output).split("\n")[0].slice(0, 140)}`);
      else if (e.t === "item" && e.item.kind === "notice") console.log(`\n  [notice:${e.item.level}] ${e.item.text}`);
      else if (e.t === "status" && !e.running) finish();
    },
  });
  const s = store.createSession({ cwd: work, model, perm: "auto" });
  console.log("workspace:", work, "\nmodel:", model, "\n");
  agent.send(s.id, { text: prompt });

  function finish() {
    const u = s.usage;
    console.log(`\n\n--- done: ${u.requests} requests, ${u.prompt} in (${u.cached} cached) / ${u.completion} out, $${u.cost.toFixed(5)}, context ${s.ctx.used}/${s.ctx.max}`);
    console.log("files:", fs.readdirSync(work).join(", ") || "(none)");
    tools.stopAllServers(); store.flush();
    setTimeout(() => process.exit(0), 300);
  }
})().catch((e) => { console.error(e); process.exit(1); });
