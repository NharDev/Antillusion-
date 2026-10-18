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
  let top = null, prefix = "";   // git top-level folder ("" when the app is not inside a checkout) and the app's folder inside it, e.g. "antillusion/"
  const root = async () => {
    if (top === null) {
      const r = await git(appDir, "rev-parse", "--show-toplevel"); top = r.ok ? r.out : "";
      if (top) { const p = await git(appDir, "rev-parse", "--show-prefix"); prefix = p.ok ? p.out.replace(/\\/g, "/") : ""; }   // asked of git itself: comparing paths breaks on 8.3 names and symlinks
    }
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
      let info = {}; try { info = JSON.parse(fs.readFileSync(path.join(appDir, "build-info.json"), "utf8")); } catch {}
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
    const n = parseInt(behind.out, 10) || 0;
    return { ...base, checkedAt, branch, remoteBranch: remote, latest: rhead.ok ? rhead.out : "", behind: n, ahead: parseInt(ahead.out, 10) || 0, available: n > 0,
      dirty: dirty.ok && !!dirty.out, files: changed.length, needsInstall: changed.some((x) => x === prefix + "package.json" || x === prefix + "package-lock.json"),
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

  return { info, check, apply, rollback, downloadInstaller };
}

module.exports = { createUpdater, newer, REPO };
