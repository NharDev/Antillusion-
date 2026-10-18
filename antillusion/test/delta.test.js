/* Delta updates: only changed files are fetched, each is verified by SHA-256 before anything is written,
   stale files are removed, and a changed Electron runtime asks for the full installer.   node test/delta.test.js */
"use strict";
const assert = require("assert"), fs = require("fs"), os = require("os"), path = require("path"), crypto = require("crypto");
const { createUpdater } = require("../core/updater");
const sha = (s) => crypto.createHash("sha256").update(s).digest("hex");

(async () => {
  const app = fs.mkdtempSync(path.join(os.tmpdir(), "delta-"));
  const put = (rel, txt) => { fs.mkdirSync(path.dirname(path.join(app, rel)), { recursive: true }); fs.writeFileSync(path.join(app, rel), txt); };
  put("main.js", "old main"); put("ui/same.css", "same"); put("old/stale.txt", "bye"); put("ui/changed.js", "v1");
  const files = { "main.js": { sha: sha("new main"), size: 8 }, "ui/same.css": { sha: sha("same"), size: 4 }, "ui/changed.js": { sha: sha("v2"), size: 2 }, "build-info.json": { sha: sha("{}"), size: 2, data: Buffer.from("{}").toString("base64") }, "lib/new.md": { sha: sha("fresh"), size: 5 } };
  const remote = { "main.js": "new main", "ui/changed.js": "v2", "lib/new.md": "fresh" }, fetched = [];
  const mk = (manifest, overrides = {}) => createUpdater({ appDir: app, repo: "o/r", git: async () => ({ ok: false, out: "" }), npm: async () => ({ ok: true }),
    fetchImpl: async (url) => {
      if (url.endsWith("files.json")) return { ok: true, status: 200, json: async () => manifest };
      const rel = decodeURIComponent(url.split("/antillusion/")[1] || ""); fetched.push(rel);
      const body = rel in overrides ? overrides[rel] : remote[rel]; if (body == null) return { ok: false, status: 404 };
      const b = Buffer.from(body); return { ok: true, status: 200, arrayBuffer: async () => b.buffer.slice(b.byteOffset, b.byteOffset + b.length) };
    } });
  const m = { version: "1.1.9", commit: "c".repeat(40), electron: "44.9.0", root: "antillusion", files };

  // 1) tampered download → nothing written
  await assert.rejects(mk(m, { "ui/changed.js": "evil" }).applyDelta({ manifestUrl: "x/files.json", electron: "44.9.0" }), /بصمة/);
  assert.strictEqual(fs.readFileSync(path.join(app, "main.js"), "utf8"), "old main", "no partial update after a failed check");
  assert.ok(fs.existsSync(path.join(app, "old/stale.txt")));
  // 2) Electron changed → full installer
  assert.deepStrictEqual((await mk({ ...m, electron: "45.0.0" }).applyDelta({ manifestUrl: "x/files.json", electron: "44.9.0" })).needFull, true);
  // 3) normal delta
  fetched.length = 0; const prog = [];
  const r = await mk(m).applyDelta({ manifestUrl: "x/files.json", electron: "44.9.0", onProgress: (i, n) => prog.push(`${i}/${n}`) });
  assert.strictEqual(r.changed, 4); assert.strictEqual(r.removed, 1);
  assert.deepStrictEqual(fetched.sort(), ["lib/new.md", "main.js", "ui/changed.js"], "same.css is not downloaded; build-info.json comes inline");
  assert.strictEqual(fs.readFileSync(path.join(app, "main.js"), "utf8"), "new main"); assert.strictEqual(fs.readFileSync(path.join(app, "lib/new.md"), "utf8"), "fresh");
  assert.ok(!fs.existsSync(path.join(app, "old")), "stale file and its empty folder are removed");
  assert.strictEqual(prog[prog.length - 1], "4/4");
  // 4) already current → nothing to do
  fetched.length = 0; const again = await mk(m).applyDelta({ manifestUrl: "x/files.json", electron: "44.9.0" });
  assert.deepStrictEqual([again.changed, again.removed, fetched.length], [0, 0, 0]);
  console.log("PASS delta updates");
})().catch((e) => { console.error(e); process.exit(1); });
