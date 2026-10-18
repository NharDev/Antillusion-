/* Antillusion — update checker/installer backed by the GitHub repository.
   Git checkout  → fetch the branch, list the new commits, fast-forward and reinstall dependencies when package files changed.
   Packaged app  → compare the version with the latest GitHub release and point at its download.
   The app never touches Electron here: the host passes in `git` and `npm` runners so it can be tested. */
"use strict";

const fs = require("fs");
const path = require("path");

const REPO = "NharDev/Antillusion-";
const semver = (v) => String(v || "").replace(/^v/i, "").split(/[.-]/).slice(0, 3).map((x) => parseInt(x, 10) || 0);
const newer = (a, b) => { const x = semver(a), y = semver(b); for (let i = 0; i < 3; i++) if ((x[i] || 0) !== (y[i] || 0)) return (x[i] || 0) > (y[i] || 0); return false; };

function createUpdater({ appDir, git, npm, repo = REPO, fetchImpl = globalThis.fetch }) {
  const pkg = () => { try { return JSON.parse(fs.readFileSync(path.join(appDir, "package.json"), "utf8")); } catch { return {}; } };
  let top = null;   // git top-level folder, or "" when the app is not inside a checkout
  const root = async () => {
    if (top === null) { const r = await git(appDir, "rev-parse", "--show-toplevel"); top = r.ok ? r.out : ""; }
    return top;
  };

  async function info() {
    const version = pkg().version || "0.0.0", r = await root();
    if (!r) return { mode: "release", version, repo };
    const [br, hd] = await Promise.all([git(r, "rev-parse", "--abbrev-ref", "HEAD"), git(r, "rev-parse", "--short", "HEAD")]);
    return { mode: "git", version, repo, branch: br.ok ? br.out : "", head: hd.ok ? hd.out : "" };
  }

  async function check(branchPref) {
    const base = await info(), checkedAt = Date.now();
    if (base.mode === "release") {
      const res = await fetchImpl(`https://api.github.com/repos/${repo}/releases/latest`, { headers: { Accept: "application/vnd.github+json", "User-Agent": "Antillusion" }, signal: AbortSignal.timeout(10000) });
      if (res.status === 404) return { ...base, checkedAt, available: false, note: "لا توجد إصدارات منشورة على GitHub بعد" };
      if (!res.ok) throw new Error("GitHub API: HTTP " + res.status);
      const j = await res.json(), asset = (j.assets || []).find((a) => /setup.*\.exe$/i.test(a.name)) || (j.assets || [])[0];
      return { ...base, checkedAt, latest: j.tag_name, available: newer(j.tag_name, base.version), url: asset ? asset.browser_download_url : j.html_url, page: j.html_url, notes: String(j.body || "").slice(0, 1500) };
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
    const changed = files.ok ? files.out.split("\n").filter(Boolean) : [], rel = path.relative(r, appDir).replace(/\\/g, "/");
    const n = parseInt(behind.out, 10) || 0;
    return { ...base, checkedAt, branch, remoteBranch: remote, latest: rhead.ok ? rhead.out : "", behind: n, ahead: parseInt(ahead.out, 10) || 0, available: n > 0,
      dirty: dirty.ok && !!dirty.out, files: changed.length, needsInstall: changed.some((x) => x === (rel ? rel + "/" : "") + "package.json" || x === (rel ? rel + "/" : "") + "package-lock.json"),
      commits: log.ok ? log.out.split("\n").filter(Boolean).map((l) => { const [sha, subject, author, when] = l.split("|"); return { sha, subject, author, when }; }) : [] };
  }

  async function apply(branchPref) {
    const st = await check(branchPref);
    if (st.mode !== "git") throw new Error("هذا التثبيت لا يُحدَّث تلقائياً — نزّل المثبّت الجديد من صفحة الإصدار");
    if (!st.available) return { ...st, updated: false };
    if (st.dirty) throw new Error("توجد تعديلات محلية غير محفوظة في ملفات المشروع — احفظها (commit) أو تراجع عنها أولاً");
    if (st.ahead > 0) throw new Error("نسختك المحلية تحتوي commits غير موجودة على GitHub (تباعد) — ادمج يدوياً");
    const r = await root(), m = await git(r, "merge", "--ff-only", st.remoteBranch);
    if (!m.ok) throw new Error("فشل الدمج: " + (m.err || m.out).split("\n")[0]);
    let installed = false;
    if (st.needsInstall) {
      const i = await npm(appDir);
      if (!i.ok) throw new Error("حُدِّث الكود لكن فشل npm install: " + (i.err || "").split("\n")[0]);
      installed = true;
    }
    return { ...(await check(branchPref)), updated: true, installed, applied: st.commits };
  }

  return { info, check, apply };
}

module.exports = { createUpdater, newer, REPO };
