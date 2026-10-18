/* Live check (CI, after publishing): an installed copy with one edited file, one missing file and one extra file
   must be repaired by a delta update against the real dev-build files.json, downloading only those files.
   node test/delta.live.js <packaged resources/app dir> */
"use strict";
const assert = require("assert"), fs = require("fs"), os = require("os"), path = require("path"), crypto = require("crypto");
const { createUpdater } = require("../core/updater");
const src = process.argv[2], url = "https://github.com/NharDev/Antillusion-/releases/download/dev-build/files.json";
(async () => {
  let m = null;
  for (let i = 0; i < 12; i++) { try { const r = await fetch(url); if (r.ok) { m = await r.json(); if (!process.env.GITHUB_SHA || m.commit === process.env.GITHUB_SHA) break; } } catch {} await new Promise((r) => setTimeout(r, 5000)); }
  assert.ok(m && m.files, "files.json is published"); assert.match(m.electron || "", /^\d+\.\d+\.\d+/, "files.json records the Electron version (decides delta vs full installer)"); if (process.env.GITHUB_SHA) assert.strictEqual(m.commit, process.env.GITHUB_SHA, "files.json is from this build");
  const app = fs.mkdtempSync(path.join(os.tmpdir(), "delta-live-")); fs.cpSync(src, app, { recursive: true });
  fs.appendFileSync(path.join(app, "main.js"), "\n// local damage\n"); fs.rmSync(path.join(app, "ui", "app.css")); fs.writeFileSync(path.join(app, "junk.txt"), "x");
  const u = createUpdater({ appDir: app, git: async () => ({ ok: false, out: "" }), npm: async () => ({ ok: true }) });
  const r = await u.applyDelta({ manifestUrl: url, electron: m.electron });
  console.log("delta:", JSON.stringify(r), "of", Object.keys(m.files).length, "files");
  assert.strictEqual(r.changed, 2); assert.strictEqual(r.removed, 1); assert.ok(r.bytes < 2 * 1048576, "only the two files were downloaded");
  for (const [rel, f] of Object.entries(m.files)) assert.strictEqual(crypto.createHash("sha256").update(fs.readFileSync(path.join(app, rel))).digest("hex"), f.sha, "hash mismatch: " + rel);
  assert.ok(!fs.existsSync(path.join(app, "junk.txt")));
  console.log("PASS live delta update (" + Math.round(r.bytes / 1024) + " KB downloaded)");
})().catch((e) => { console.error(e); process.exit(1); });
