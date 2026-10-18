/* Live check of the installed-copy update path against the real GitHub dev-build release (run by CI after it publishes):
   an app that claims to be an older dev build must see an update, and the announced installer must download intact. */
"use strict";
const assert = require("assert");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { createUpdater } = require("../core/updater");

(async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "live-"));
  fs.writeFileSync(path.join(dir, "package.json"), '{"version":"1.0.0"}');
  fs.writeFileSync(path.join(dir, "build-info.json"), JSON.stringify({ channel: "dev", commit: "0".repeat(40) }));
  const u = createUpdater({ appDir: dir, git: async () => ({ ok: false, out: "", err: "" }), npm: async () => ({ ok: true }) });
  const st = await u.check();
  console.log("check:", { mode: st.mode, channel: st.channel, available: st.available, latest: st.latest, url: st.url, size: st.size });
  assert.strictEqual(st.mode, "release"); assert.strictEqual(st.available, true, "an old dev build must see the update"); assert.ok(st.url && st.size > 50000);
  const r = await u.downloadInstaller(st.url, path.join(dir, "Setup.exe"), st.size);
  assert.strictEqual(r.size, st.size);
  console.log("PASS live updater (installer", r.size, "bytes)");
})().catch((e) => { console.error(e); process.exit(1); });
