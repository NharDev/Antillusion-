/* Antillusion — update checker/installer backed by the GitHub repository.
   Git checkout  → fetch the branch, list the new commits, fast-forward and reinstall dependencies when package files changed.
   Packaged app  → compare the version with the latest GitHub release and point at its download.
   The app never touches Electron here: the host passes in `git` and `npm` runners so it can be tested. */
"use strict";

const fs = require("fs");
const path = require("path");
const os = require("os");
const crypto = require("crypto");

const REPO = "NharDev/Antillusion-";
const semver = (v) => String(v || "").replace(/^v/i, "").split(/[.-]/).slice(0, 3).map((x) => parseInt(x, 10) || 0);
const newer = (a, b) => { const x = semver(a), y = semver(b); for (let i = 0; i < 3; i++) if ((x[i] || 0) !== (y[i] || 0)) return (x[i] || 0) > (y[i] || 0); return false; };

function createUpdater({ appDir, git, npm, repo = REPO, fetchImpl = globalThis.fetch }) {
  const pkg = () => { try { return JSON.parse(fs.readFileSync(path.join(appDir, "package.json"), "utf8")); } catch { return {}; } };
  let top = null, prefix = "";   // git top-level folder ("" when the app is not inside a checkout) and the app's folder inside it, e.g. "antillusion/"
  const root = async () => {
    if (top === null) {
      const r = await git(appDir, "rev-parse", "--show-toplevel"); top = r.ok ? r.out : "";
      if (top) { const p = await git(appDir, "rev-parse", "--show-prefix"); prefix = p.ok ? p.out.replace(/\\/g, "/") : ""; }   // asked of git itself: comparing paths breaks on 8.3 names and symlinks
    }
    return top;
  };

  // Version = MAJOR.MINOR from package.json (set by hand) + PATCH that grows with every change:
  // git checkout → number of commits; installed copy → the CI build number recorded in build-info.json (a tag vX.Y.Z pins it exactly).
  const withPatch = (v, patch) => { const [a = "1", b = "0"] = String(v || "1.0.0").split("."); return `${a}.${b}.${patch}`; };
  async function info() {
    const pv = pkg().version || "0.0.0", r = await root();
    if (!r) {
      let bi = {}; try { bi = JSON.parse(fs.readFileSync(path.join(appDir, "build-info.json"), "utf8")); } catch {}
      return { mode: "release", version: bi.version || pv, repo };
    }
    const [br, hd, cnt] = await Promise.all([git(r, "rev-parse", "--abbrev-ref", "HEAD"), git(r, "rev-parse", "--short", "HEAD"), git(r, "rev-list", "--count", "HEAD")]);
    const n = parseInt(cnt.out, 10);
    return { mode: "git", version: n > 0 ? withPatch(pv, n) : pv, repo, branch: br.ok ? br.out : "", head: hd.ok ? hd.out : "" };
  }

  async function check(branchPref) {
    const base = await info(), checkedAt = Date.now();
    if (base.mode === "release") {
      let info = {}; try { info = JSON.parse(fs.readFileSync(path.join(appDir, "build-info.json"), "utf8")); } catch {}
      // 1) latest.json attached to the release: a plain file download (CDN), so no GitHub API rate limit (60/h per IP, often hit on shared networks)
      const dev = info.channel === "dev", base2 = `https://github.com/${repo}/releases/${dev ? "download/dev-build" : "latest/download"}`;
      try {
        const r = await fetchImpl(`${base2}/latest.json`, { headers: { "User-Agent": "Antillusion" }, signal: AbortSignal.timeout(10000) });
        if (r.ok) {
          const m = await r.json(), sha = String(m.commit || "").toLowerCase(), mine = String(info.commit || "").toLowerCase();
          const available = dev ? !!(sha && mine && sha !== mine) : newer(m.version, base.version);
          return { ...base, checkedAt, channel: dev ? "dev" : "stable", head: mine.slice(0, 7), latest: m.version ? "v" + m.version : sha.slice(0, 7), latestVersion: m.version || "", available,
            url: `${base2}/${m.setup || "Antillusion-Setup.exe"}`, size: m.size || 0, filesUrl: m.files ? `${base2}/${m.files}` : "", electron: m.electron || "", page: `https://github.com/${repo}/releases/${dev ? "tag/dev-build" : "latest"}`, notes: String(m.notes || "").slice(0, 1500), release: m.release || null };
        }
      } catch (e) { if (e && e.name === "AbortError") throw e; }
      // 2) fallback: the GitHub API (older releases have no latest.json)
      if (info.channel === "dev") {   // dev builds are published under one rolling "dev-build" prerelease whose body names the commit
        const res = await fetchImpl(`https://api.github.com/repos/${repo}/releases/tags/dev-build`, { headers: { Accept: "application/vnd.github+json", "User-Agent": "Antillusion" }, signal: AbortSignal.timeout(10000) });
        if (res.status === 404) return { ...base, checkedAt, channel: "dev", head: String(info.commit || "").slice(0, 7), available: false, note: "لا يوجد بناء تجريبي منشور بعد" };
        if (!res.ok) throw new Error("GitHub API: HTTP " + res.status);
        const j = await res.json(), sha = ((String(j.body || "").match(/commit:\s*([0-9a-f]{40})/i) || [])[1] || "").toLowerCase(), asset = (j.assets || []).find((a) => /setup.*\.exe$/i.test(a.name));
        return { ...base, checkedAt, channel: "dev", head: String(info.commit || "").slice(0, 7), latest: sha.slice(0, 7), available: !!(sha && info.commit && sha !== String(info.commit).toLowerCase() && asset), url: asset ? asset.browser_download_url : null, size: asset ? asset.size : 0, page: j.html_url, notes: String(j.body || "").replace(/commit:\s*[0-9a-f]{40}/i, "").trim().slice(0, 1500) };
      }
      const res = await fetchImpl(`https://api.github.com/repos/${repo}/releases/latest`, { headers: { Accept: "application/vnd.github+json", "User-Agent": "Antillusion" }, signal: AbortSignal.timeout(10000) });
      if (res.status === 404) return { ...base, checkedAt, available: false, note: "لا توجد إصدارات منشورة على GitHub بعد" };
      if (!res.ok) throw new Error("GitHub API: HTTP " + res.status);
      const j = await res.json(), asset = (j.assets || []).find((a) => /setup.*\.exe$/i.test(a.name)) || (j.assets || [])[0];
      return { ...base, checkedAt, latest: j.tag_name, available: newer(j.tag_name, base.version), url: asset ? asset.browser_download_url : j.html_url, size: asset ? asset.size : 0, page: j.html_url, notes: String(j.body || "").slice(0, 1500) };
    }
    const r = await root(), branch = branchPref || base.branch;
    if (!branch || branch === "HEAD") throw new Error("المستودع في حالة detached HEAD — حدّد فرع التحديث من الإعدادات");
    const f = await git(r, "fetch", "origin", branch);
    if (!f.ok) throw new Error("تعذّر الاتصال بـ GitHub: " + (f.err || "git fetch failed").split("\n")[0]);
    const remote = "origin/" + branch;
    const [behind, ahead, log, files, dirty, rhead] = await Promise.all([
      git(r, "rev-list", "--count", `HEAD..${remote}`), git(r, "rev-list", "--count", `${remote}..HEAD`),
      git(r, "log", "-n", "30", "--pretty=format:%h|%s|%an|%cr", `HEAD..${remote}`), git(r, "diff", "--name-only", "HEAD", remote),
      git(r, "status", "--porcelain", "--untracked-files=no"), git(r, "rev-parse", "--short", remote)]);
    const changed = files.ok ? files.out.split("\n").filter(Boolean) : [];
    // the incoming version's release notes (whats-new.json on the remote branch): what the user gets, not just commit subjects
    let release = null; try { const w = await git(r, "show", `${remote}:${prefix}whats-new.json`); if (w.ok) release = JSON.parse(w.out)[0] || null; } catch {}
    const n = parseInt(behind.out, 10) || 0;
    return { ...base, checkedAt, branch, remoteBranch: remote, latest: rhead.ok ? rhead.out : "", behind: n, ahead: parseInt(ahead.out, 10) || 0, available: n > 0,
      release, dirty: dirty.ok && !!dirty.out, files: changed.length, needsInstall: changed.some((x) => x === prefix + "package.json" || x === prefix + "package-lock.json"),
      commits: log.ok ? log.out.split("\n").filter(Boolean).map((l) => { const [sha, subject, author, when] = l.split("|"); return { sha, subject, author, when }; }) : [] };
  }

  async function apply(branchPref) {
    const st = await check(branchPref);
    if (st.mode !== "git") throw new Error("هذا التثبيت لا يُحدَّث تلقائياً — نزّل المثبّت الجديد من صفحة الإصدار");
    if (!st.available) return { ...st, updated: false };
    if (st.dirty) throw new Error("توجد تعديلات محلية غير محفوظة في ملفات المشروع — احفظها (commit) أو تراجع عنها أولاً");
    if (st.ahead > 0) throw new Error("نسختك المحلية تحتوي commits غير موجودة على GitHub (تباعد) — ادمج يدوياً");
    const r = await root(), prev = (await git(r, "rev-parse", "HEAD")).out, m = await git(r, "merge", "--ff-only", st.remoteBranch);
    if (!m.ok) throw new Error("فشل الدمج: " + (m.err || m.out).split("\n")[0]);
    let installed = false;
    if (st.needsInstall) {
      const i = await npm(appDir);
      if (!i.ok) throw new Error("حُدِّث الكود لكن فشل npm install: " + (i.err || "").split("\n")[0]);
      installed = true;
    }
    return { ...(await check(branchPref)), updated: true, installed, applied: st.commits, previous: prev };
  }

  /** Goes back to the commit we were on before an update; only on a clean tree and only to an ancestor of HEAD. */
  async function rollback(sha) {
    const r = await root(); if (!r) throw new Error("التراجع متاح فقط للنسخ المثبّتة عبر git");
    if (!/^[0-9a-f]{7,40}$/i.test(String(sha || ""))) throw new Error("لا توجد نسخة سابقة للتراجع إليها");
    const dirty = await git(r, "status", "--porcelain", "--untracked-files=no");
    if (dirty.ok && dirty.out) throw new Error("توجد تعديلات محلية غير محفوظة — احفظها أو تراجع عنها أولاً");
    if (!(await git(r, "merge-base", "--is-ancestor", sha, "HEAD")).ok) throw new Error("النسخة السابقة ليست ضمن تاريخ المشروع الحالي");
    const pre = prefix;
    const files = await git(r, "diff", "--name-only", sha, "HEAD"), needsInstall = files.ok && files.out.split("\n").some((x) => x === pre + "package.json" || x === pre + "package-lock.json");
    const m = await git(r, "reset", "--hard", sha);
    if (!m.ok) throw new Error("فشل التراجع: " + (m.err || m.out).split("\n")[0]);
    if (needsInstall) { const i = await npm(appDir); if (!i.ok) throw new Error("تم التراجع لكن فشل npm install: " + (i.err || "").split("\n")[0]); }
    return { rolledBack: true, to: sha };
  }

  /** Downloads the new Setup.exe for an installed (non-git) copy and checks it is plausibly complete. */
  async function downloadInstaller(url, dest, expectedSize) {
    if (!/^https:\/\/(github\.com|objects\.githubusercontent\.com)\//.test(String(url))) throw new Error("رابط المثبّت غير موثوق");
    const res = await fetchImpl(url, { headers: { "User-Agent": "Antillusion" }, signal: AbortSignal.timeout(300000) });
    if (!res.ok) throw new Error("فشل تنزيل المثبّت: HTTP " + res.status);
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length < 50000 || buf.slice(0, 2).toString() !== "MZ") throw new Error("ملف المثبّت غير صالح");
    if (expectedSize && buf.length !== expectedSize) throw new Error("حجم المثبّت لا يطابق المتوقع");
    fs.writeFileSync(dest, buf);
    return { file: dest, size: buf.length };
  }

  /** Delta update of an installed copy: compare SHA-256 of every app file with files.json, download only what changed
      (raw files from GitHub at the release commit, generated ones are inline), verify each, then replace and delete stale files.
      Returns { needFull: true } when the Electron runtime itself changed — then the full installer is needed. */
  async function applyDelta({ manifestUrl, electron, onProgress } = {}) {
    const res = await fetchImpl(manifestUrl, { headers: { "User-Agent": "Antillusion" }, signal: AbortSignal.timeout(30000) });
    if (!res.ok) throw new Error("files.json: HTTP " + res.status);
    const m = await res.json();
    if (!m || !m.files || !m.commit) throw new Error("files.json غير صالح");
    if (m.electron && electron && m.electron !== electron) return { needFull: true, reason: "electron " + electron + " → " + m.electron };
    const hash = (buf) => crypto.createHash("sha256").update(buf).digest("hex"), safe = (rel) => !rel.split("/").some((p) => p === ".." || p === "") && !path.isAbsolute(rel);
    const local = new Map();
    (function walk(dir) { for (const e of fs.readdirSync(dir, { withFileTypes: true })) { const abs = path.join(dir, e.name); if (e.isDirectory()) walk(abs); else local.set(path.relative(appDir, abs).replace(/\\/g, "/"), abs); } })(appDir);
    const changed = Object.entries(m.files).filter(([rel, f]) => safe(rel) && (!local.has(rel) || hash(fs.readFileSync(local.get(rel))) !== f.sha));
    const removed = [...local.keys()].filter((rel) => !m.files[rel]);
    if (!changed.length && !removed.length) return { changed: 0, removed: 0, bytes: 0, version: m.version, commit: m.commit };
    const stage = fs.mkdtempSync(path.join(os.tmpdir(), "antillusion-delta-")); let done = 0, bytes = 0;
    const enc = (rel) => rel.split("/").map(encodeURIComponent).join("/");
    const fetchFile = async (rel) => {
      for (const u of [`https://raw.githubusercontent.com/${repo}/${m.commit}/${m.root || "antillusion"}/${enc(rel)}`, `https://cdn.jsdelivr.net/gh/${repo}@${m.commit}/${m.root || "antillusion"}/${enc(rel)}`]) {
        try { const r = await fetchImpl(u, { headers: { "User-Agent": "Antillusion" }, signal: AbortSignal.timeout(60000) }); if (r.ok) return Buffer.from(await r.arrayBuffer()); } catch (e) { if (e && e.name === "AbortError") throw e; }
      }
      throw new Error("تعذّر تنزيل " + rel);
    };
    try {
      const queue = changed.slice();
      const worker = async () => { for (let it = queue.shift(); it; it = queue.shift()) {
        const [rel, f] = it, buf = f.data != null ? Buffer.from(f.data, "base64") : await fetchFile(rel);
        if (hash(buf) !== f.sha) throw new Error("بصمة غير مطابقة: " + rel);
        const to = path.join(stage, rel); fs.mkdirSync(path.dirname(to), { recursive: true }); fs.writeFileSync(to, buf);
        bytes += f.data != null ? 0 : buf.length; done++; if (onProgress) onProgress(done, changed.length);
      } };
      await Promise.all(Array.from({ length: Math.min(6, changed.length) }, worker));   // everything is downloaded and verified before anything is touched
      for (const [rel] of changed) { const to = path.join(appDir, rel); fs.mkdirSync(path.dirname(to), { recursive: true }); fs.copyFileSync(path.join(stage, rel), to); }
      for (const rel of removed) { try { fs.rmSync(local.get(rel), { force: true }); } catch {} }
      (function prune(dir) { for (const e of fs.readdirSync(dir, { withFileTypes: true })) if (e.isDirectory()) { const d = path.join(dir, e.name); prune(d); try { if (!fs.readdirSync(d).length) fs.rmdirSync(d); } catch {} } })(appDir);
    } finally { fs.rmSync(stage, { recursive: true, force: true }); }
    return { changed: changed.length, removed: removed.length, bytes, version: m.version, commit: m.commit };
  }

  return { info, check, apply, rollback, downloadInstaller, applyDelta };
}

module.exports = { createUpdater, newer, REPO };
