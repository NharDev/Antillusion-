"use strict";
const assert = require("assert");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { execFileSync, execFile } = require("child_process");
const { createUpdater, newer } = require("../core/updater");

assert.ok(newer("v1.2.0", "1.1.9") && !newer("1.0.0", "1.0.0") && newer("2.0.0", "1.9.9"));

const sh = (cwd, ...a) => execFileSync("git", a, { cwd, stdio: "pipe" }).toString();
const git = (cwd, ...a) => new Promise((res) => execFile("git", a, { cwd }, (e, so, se) => res({ ok: !e, out: String(so).trim(), err: String(se || (e && e.message) || "").trim() })));
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "upd-"));
const origin = path.join(tmp, "origin.git"), a = path.join(tmp, "a"), b = path.join(tmp, "b");
const cfg = ["-c", "user.email=t@t", "-c", "user.name=t"];
sh(tmp, "init", "-q", "--bare", "-b", "main", origin);
sh(tmp, "clone", "-q", origin, a);
fs.mkdirSync(path.join(a, "app")); fs.writeFileSync(path.join(a, "app", "package.json"), '{"version":"1.0.0"}');
sh(a, "add", "."); sh(a, ...cfg, "commit", "-qm", "init"); sh(a, "push", "-q", "origin", "HEAD:main");
sh(tmp, "clone", "-q", "-b", "main", origin, b);

(async () => {
  let installs = 0;
  const u = createUpdater({ appDir: path.join(b, "app"), git, npm: async () => { installs++; return { ok: true }; } });
  let st = await u.check();
  assert.strictEqual(st.mode, "git"); assert.strictEqual(st.available, false); assert.strictEqual(st.branch, "main");

  fs.writeFileSync(path.join(a, "app", "package.json"), '{"version":"1.1.0"}'); fs.writeFileSync(path.join(a, "app", "new.txt"), "x");
  sh(a, "add", "."); sh(a, ...cfg, "commit", "-qm", "feat: new thing"); sh(a, "push", "-q", "origin", "HEAD:main");
  st = await u.check();
  assert.strictEqual(st.available, true); assert.strictEqual(st.behind, 1); assert.strictEqual(st.commits[0].subject, "feat: new thing"); assert.strictEqual(st.needsInstall, true);

  fs.appendFileSync(path.join(b, "app", "package.json"), " ");   // local edit blocks the update
  await assert.rejects(u.apply(), /محلية/);
  sh(b, "checkout", "--", ".");

  const r = await u.apply();
  assert.strictEqual(r.updated, true); assert.strictEqual(r.installed, true); assert.strictEqual(installs, 1);
  assert.strictEqual(fs.readFileSync(path.join(b, "app", "new.txt"), "utf8"), "x");
  assert.strictEqual((await u.check()).available, false);

  // outside any checkout → release mode, driven by a stub GitHub API
  const plain = fs.mkdtempSync(path.join(os.tmpdir(), "plain-")); fs.writeFileSync(path.join(plain, "package.json"), '{"version":"1.0.0"}');
  const rel = createUpdater({ appDir: plain, git: async () => ({ ok: false, out: "", err: "" }), npm: async () => ({ ok: true }),
    fetchImpl: async () => ({ ok: true, status: 200, json: async () => ({ tag_name: "v1.2.0", html_url: "https://x/r", body: "notes", assets: [{ name: "Antillusion-Setup.exe", browser_download_url: "https://x/s.exe" }] }) }) });
  const rs = await rel.check();
  assert.strictEqual(rs.mode, "release"); assert.strictEqual(rs.available, true); assert.strictEqual(rs.url, "https://x/s.exe");
  console.log("PASS updater");
})().catch((e) => { console.error(e); process.exit(1); });
