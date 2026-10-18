/* Writes files.json for delta updates: every file of the packaged app (resources/app) with its SHA-256.
   Files that are byte-identical to the repository at this commit are fetched by clients from GitHub (raw, per file);
   generated files (build-info.json, the versioned package.json) are embedded inline.
   node build/manifest.js <packed resources/app dir> <repo app dir> <out files.json> */
"use strict";
const fs = require("fs"), path = require("path"), crypto = require("crypto");
const [appDir, repoDir, out] = process.argv.slice(2);
if (!appDir || !repoDir || !out) { console.error("usage: node build/manifest.js <resources/app> <repo app dir> <out>"); process.exit(1); }
const sha = (buf) => crypto.createHash("sha256").update(buf).digest("hex");
// only files tracked by git at this commit can be fetched from raw GitHub; everything else (build-info.json, …) goes inline
let tracked = null; try { tracked = new Set(require("child_process").execFileSync("git", ["ls-files"], { cwd: repoDir }).toString().split(/\r?\n/).filter(Boolean)); } catch {}
const files = {};
let inline = 0, total = 0;
(function walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const abs = path.join(dir, e.name);
    if (e.isDirectory()) { walk(abs); continue; }
    const rel = path.relative(appDir, abs).replace(/\\/g, "/"), buf = fs.readFileSync(abs), h = sha(buf);
    let repoBuf = null; try { repoBuf = fs.readFileSync(path.join(repoDir, rel)); } catch {}
    const f = { sha: h, size: buf.length };
    if (!repoBuf || sha(repoBuf) !== h || (tracked && !tracked.has(rel))) { f.data = buf.toString("base64"); inline++; }   // not fetchable from the repo as-is
    files[rel] = f; total += buf.length;
  }
})(appDir);
const bi = (() => { try { return JSON.parse(fs.readFileSync(path.join(appDir, "build-info.json"), "utf8")); } catch { return {}; } })();
const electron = (() => { try { return JSON.parse(fs.readFileSync(path.resolve(repoDir, "node_modules", "electron", "package.json"), "utf8")).version; } catch { return ""; } })();
fs.writeFileSync(out, JSON.stringify({ version: bi.version || "", commit: bi.commit || "", electron, root: "antillusion", files }));
console.log(`files.json: ${Object.keys(files).length} files, ${(total / 1048576).toFixed(1)} MB, ${inline} inline, electron ${electron}`);
