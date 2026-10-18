/* Antillusion — Electron main process: window, settings/key storage, IPC surface, git worktrees, usage reports.
   The agent itself lives in core/ and knows nothing about Electron. */
"use strict";

const { app, BrowserWindow, ipcMain, dialog, shell, safeStorage, Notification } = require("electron");
const fs = require("fs");
const path = require("path");
const { execFile, spawn } = require("child_process");
const { createStore, DEFAULTS } = require("./core/store");
const { createAgent, uid } = require("./core/agent");
const tools = require("./core/tools");
const library = require("./core/library");
const { createUpdater } = require("./core/updater");

app.setName("Antillusion");
// the installer drops Node and Git under <install>/runtime (Node/Git/OmniRoute finish in the background after Setup closes);
// Explorer-launched apps may not see the updated user PATH, so add those folders ourselves, again whenever they appear
const RUNTIME = path.join(path.dirname(process.execPath), "runtime");
function refreshRuntimePath() {
  for (const d of [path.join(RUNTIME, "node"), path.join(RUNTIME, "git", "cmd")]) {
    if (fs.existsSync(d) && !(process.env.PATH || "").split(path.delimiter).includes(d)) process.env.PATH = d + path.delimiter + (process.env.PATH || "");
  }
}
const runtimeBusy = () => ["node.installing", "git.installing"].some((f) => fs.existsSync(path.join(RUNTIME, f)));
refreshRuntimePath();
if (process.env.ANTILLUSION_DATA) app.setPath("userData", process.env.ANTILLUSION_DATA);
const SELFTEST = !!(process.env.ANTILLUSION_SELFTEST || process.env.ANTILLUSION_SHOT);
if (!SELFTEST && !app.requestSingleInstanceLock()) app.quit();

let win, store, agent;
const previewWaiters = new Map();
const send = (e) => { if (win && !win.isDestroyed()) win.webContents.send("evt", e); onEvent(e); };

/* ---------- API key (encrypted at rest with the OS keychain when available) ---------- */

function getKey() {
  const s = store.settings();
  try { if (s.keyEnc && safeStorage.isEncryptionAvailable()) return safeStorage.decryptString(Buffer.from(s.keyEnc, "base64")); } catch {}
  return s.keyPlain || "";
}
function setKey(key) {
  key = String(key || "").trim();
  if (key && safeStorage.isEncryptionAvailable()) store.setSettings({ keyEnc: safeStorage.encryptString(key).toString("base64"), keyPlain: "" });
  else store.setSettings({ keyEnc: "", keyPlain: key });
}
function seedKey() {   // seed key, base url and default model from .env if needed
  for (const f of [path.join(__dirname, ".env"), path.join(path.dirname(process.execPath), ".env")]) {
    try {
      const txt = fs.readFileSync(f, "utf8");
      const mKey = txt.match(/^(?:OPENROUTER_API_KEY|API_KEY)=(\S+)/m);
      const first = !getKey();   // a fresh profile takes the .env server and model too, not only the key
      if (mKey && first) setKey(mKey[1]);
      const mUrl = txt.match(/^(?:BASE_URL|OPENROUTER_BASE_URL)=(\S+)/m);
      if (mUrl && (first || !store.settings().baseUrl || store.settings().baseUrl.includes("11434"))) store.setSettings({ baseUrl: mUrl[1] });
      const mModel = txt.match(/^DEFAULT_MODEL=(\S+)/m);
      if (mModel && (first || !store.settings().model || store.settings().model === "llama3:latest")) store.setSettings({ model: mModel[1] });
    } catch {}
  }
}
const isOR = () => /openrouter\.ai/.test(baseUrl());
// a self-hosted server (vLLM, llama.cpp, Ollama) needs no key at all
const publicSettings = () => { const { keyEnc, keyPlain, ...rest } = store.settings(); return { ...rest, hasKey: !!getKey() || !isOR(), ownServer: !isOR(), keyUnencrypted: !!keyPlain }; };
const modelsStale = () => { const l = store.models().list; if (!l.length) return true; if (!isOR()) return true; return l.some((m) => m.local) || l.some((m) => +m.pricing.prompt > 0) === (store.settings().freeOnly !== false); };
const baseUrl = () => (store.settings().baseUrl || "http://localhost:20128/v1").replace(/\/+$/, "");

// OmniRoute (the local router on :20128) is not a service: when the base URL points at it and nothing answers,
// start the globally installed CLI ourselves (loopback only, no browser, no tray) and wait until it serves.
let routerStarting = null;
async function ensureLocalRouter() {
  const u = baseUrl();
  if (!/^https?:\/\/(localhost|127\.0\.0\.1):20128\b/.test(u)) return true;
  const up = async () => { try { await fetch(u + "/models", { signal: AbortSignal.timeout(1500) }); return true; } catch { return false; } };
  if (await up()) return true;
  if (!routerStarting) routerStarting = (async () => {
    const cli = path.join(process.env.APPDATA || "", "npm", "node_modules", "omniroute", "bin", "omniroute.mjs");
    // Setup finishes Node.js + OmniRoute in the background (OmniRoute is a few hundred MB); wait for it up to 15 minutes
    const flag = path.join(RUNTIME, "node.installing");
    if (!fs.existsSync(cli) && fs.existsSync(flag)) { send({ t: "router", state: "installing" }); for (let i = 0; i < 450 && !fs.existsSync(cli) && fs.existsSync(flag); i++) await new Promise((r) => setTimeout(r, 2000)); }
    refreshRuntimePath();
    if (!fs.existsSync(cli)) return false;
    const env = { ...process.env, OMNIROUTE_SERVER_HOST: "127.0.0.1" };
    delete env.ELECTRON_RUN_AS_NODE;
    try { const p = spawn(process.env.ANTILLUSION_NODE || (fs.existsSync(path.join(RUNTIME, "node", "node.exe")) ? path.join(RUNTIME, "node", "node.exe") : "node"), [cli, "serve", "--port", "20128", "--no-open", "--no-tray"], { detached: true, stdio: "ignore", windowsHide: true, env }); p.on("error", () => {}); p.unref(); } catch { return false; }
    for (let i = 0; i < 45; i++) { await new Promise((r) => setTimeout(r, 2000)); if (await up()) return true; }
    return false;
  })().finally(() => { routerStarting = null; });
  return routerStarting;
}

async function refreshModels(force) {
  const cur = store.models();
  if (!force && cur.list.length && Date.now() - cur.at < 6 * 3600e3) return cur.list;
  try {
    if (!isOR()) {   // any OpenAI-compatible server: list whatever it serves, every model counts as available
      await ensureLocalRouter();
      const key = getKey();
      const j = await (await fetch(baseUrl() + "/models", { headers: key ? { Authorization: "Bearer " + key } : {}, signal: AbortSignal.timeout(8000) })).json();
      const list = (j.data || j.models || []).map((m) => ({ id: m.id || m.name, name: m.id || m.name, created: m.created || 0, context_length: m.context_length || m.max_model_len || store.settings().localCtx || 32768,
        pricing: { prompt: "0", completion: "0" }, architecture: { input_modalities: ["text"] }, supported_parameters: ["tools"], top_provider: {}, local: true })).filter((m) => m.id);
      store.setModels(list);
      if (list.length && !list.some((m) => m.id === store.settings().model)) store.setSettings({ model: list[0].id });
      return list;
    }
    const j = await (await fetch(baseUrl() + "/models", { signal: AbortSignal.timeout(20000) })).json();
    const freeOnly = store.settings().freeOnly !== false;
    const list = (j.data || []).filter((m) => (m.supported_parameters || []).includes("tools") && !/:batch$/.test(m.id) && m.id !== "openrouter/free" && (!freeOnly || (m.pricing && +m.pricing.prompt === 0 && +m.pricing.completion === 0))).map((m) => ({
      id: m.id, name: String(m.name || m.id).replace(/\s*\(free\)\s*$/i, ""), created: m.created, context_length: m.context_length, pricing: { prompt: m.pricing && m.pricing.prompt, completion: m.pricing && m.pricing.completion },
      architecture: { input_modalities: (m.architecture && m.architecture.input_modalities) || [] }, supported_parameters: m.supported_parameters, top_provider: { max_completion_tokens: m.top_provider && m.top_provider.max_completion_tokens },
    })).sort((a, b) => b.created - a.created);
    if (list.length) {
      store.setModels(list);
      const st = store.settings(), has = (id) => list.some((m) => m.id === id);
      if (!has(st.model)) store.setSettings({ model: (DEFAULTS.favorites.concat(st.favorites || [])).find(has) || list[0].id });
      if (freeOnly && !(st.favorites || []).some(has)) store.setSettings({ favorites: DEFAULTS.favorites });
    }
  } catch {}
  return store.models().list;
}

/* ---------- git ---------- */

const git = (cwd, ...args) => new Promise((res) => execFile("git", args, { cwd, windowsHide: true, maxBuffer: 2e7 }, (e, so, se) => res({ ok: !e, out: String(so || "").trim(), err: String(se || (e && e.message) || "").trim() })));
const ident = ["-c", "user.name=Antillusion", "-c", "user.email=antillusion@localhost"];

async function gitInfo(cwd) {
  const b = await git(cwd, "rev-parse", "--abbrev-ref", "HEAD");
  if (!b.ok) return { repo: false };
  const st = await git(cwd, "status", "--porcelain");
  return { repo: true, branch: b.out, dirty: st.out ? st.out.split("\n").length : 0 };
}

async function worktreeCreate(sid, { name, init }) {
  const s = store.getSession(sid);
  if (agent.isRunning(sid)) return { error: "انتظر حتى ينتهي الوكيل." };
  if (s.worktree) return { error: "هذه الجلسة تعمل داخل worktree بالفعل." };
  let top = await git(s.baseCwd, "rev-parse", "--show-toplevel");
  if (!top.ok) {
    if (!init) return { needInit: true };
    await git(s.baseCwd, "init"); await git(s.baseCwd, "add", "-A");
    const c = await git(s.baseCwd, ...ident, "commit", "--allow-empty", "-m", "Initial commit");
    if (!c.ok) return { error: c.err };
    top = await git(s.baseCwd, "rev-parse", "--show-toplevel");
  } else if (!(await git(s.baseCwd, "rev-parse", "HEAD")).ok) {
    const c = await git(s.baseCwd, ...ident, "commit", "--allow-empty", "-m", "Initial commit"); if (!c.ok) return { error: c.err };
  }
  const repo = path.normalize(top.out);
  const slug = String(name || "").trim().toLowerCase().replace(/[^a-z0-9._-]+/g, "-").replace(/^-+|-+$/g, "") || "task-" + uid().slice(-5);
  const wt = path.join(path.dirname(repo), path.basename(repo) + ".worktrees", slug), branch = "antillusion/" + slug;
  const base = (await git(repo, "rev-parse", "--abbrev-ref", "HEAD")).out;
  const r = await git(repo, "worktree", "add", "-b", branch, wt);
  if (!r.ok) return { error: r.err };
  const sub = path.relative(repo, s.baseCwd);
  s.worktree = { repo, path: wt, branch, base };
  s.cwd = sub && !sub.startsWith("..") ? path.join(wt, sub) : wt;
  if (s.messages.length) s.messages.push({ role: "user", content: `[The workspace is now an isolated git worktree at ${s.cwd} on branch ${branch} (created from ${base}). Work only there from now on.]` }, { role: "assistant", content: "Understood." });
  store.saveSession(s); send({ t: "session", sid, meta: store.meta(s) });
  return { ok: true, path: wt, branch };
}

async function worktreeStatus(sid) {
  const s = store.getSession(sid), w = s.worktree; if (!w) return { error: "لا يوجد worktree." };
  const [st, log, diff] = await Promise.all([git(w.path, "status", "--short"), git(w.path, "log", "--oneline", `${w.base}..HEAD`), git(w.path, "diff", "--stat", w.base)]);
  return { ...w, status: st.out, commits: log.out, diff: diff.out };
}

async function worktreeMerge(sid, message) {
  const s = store.getSession(sid), w = s.worktree; if (!w) return { error: "لا يوجد worktree." };
  if (agent.isRunning(sid)) return { error: "انتظر حتى ينتهي الوكيل." };
  await git(w.path, "add", "-A");
  if ((await git(w.path, "status", "--porcelain")).out) { const c = await git(w.path, ...ident, "commit", "-m", message || `Antillusion: ${s.title}`); if (!c.ok) return { error: c.err || c.out }; }
  if (!(await git(w.path, "log", "--oneline", `${w.base}..HEAD`)).out) return { error: "لا توجد تغييرات للدمج." };
  const cur = (await git(w.repo, "rev-parse", "--abbrev-ref", "HEAD")).out;
  if ((await git(w.repo, "status", "--porcelain", "--untracked-files=no")).out) return { error: `في المجلد الأساسي (${cur}) تغييرات غير محفوظة — احفظها (commit) أولاً ثم أعد الدمج.` };
  const m = await git(w.repo, ...ident, "merge", "--no-ff", w.branch, "-m", `Merge ${w.branch}: ${s.title}`);
  if (!m.ok) { await git(w.repo, "merge", "--abort"); return { error: "تعارض عند الدمج، تم التراجع عنه:\n" + (m.out || m.err) }; }
  return { ok: true, into: cur, out: m.out };
}

async function worktreeRemove(sid, { deleteBranch }) {
  const s = store.getSession(sid), w = s.worktree; if (!w) return { error: "لا يوجد worktree." };
  if (agent.isRunning(sid)) return { error: "انتظر حتى ينتهي الوكيل." };
  for (const sv of tools.serverList()) if (tools.isInside(w.path, sv.cwd)) tools.stopServer(sv.id);
  const r = await git(w.repo, "worktree", "remove", "--force", w.path);
  if (!r.ok && fs.existsSync(w.path)) return { error: r.err };
  await git(w.repo, "worktree", "prune");
  if (deleteBranch) await git(w.repo, "branch", "-D", w.branch);
  s.worktree = null; s.cwd = s.baseCwd;
  if (s.messages.length) s.messages.push({ role: "user", content: `[The worktree was removed. The workspace is back to ${s.cwd}.]` }, { role: "assistant", content: "Understood." });
  store.saveSession(s); send({ t: "session", sid, meta: store.meta(s) });
  return { ok: true };
}

/* ---------- attachments ---------- */

const IMG = { png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", gif: "image/gif", webp: "image/webp" };
function readAttachment(fp) {
  const name = path.basename(fp), ext = path.extname(fp).slice(1).toLowerCase();
  let st; try { st = fs.statSync(fp); } catch { return null; }
  if (st.isDirectory()) return { name, path: fp, kind: "ref", size: 0, dir: true };
  if (IMG[ext] && st.size < 8e6) return { name, path: fp, kind: "image", size: st.size, dataUrl: `data:${IMG[ext]};base64,` + fs.readFileSync(fp).toString("base64") };
  if (st.size < 400000) { const buf = fs.readFileSync(fp); if (!buf.subarray(0, 4096).includes(0)) return { name, path: fp, kind: "text", size: st.size, text: buf.toString("utf8") }; }
  return { name, path: fp, kind: "ref", size: st.size };
}

/* ---------- usage report ---------- */

async function usageReport() {
  const recs = store.usage(), now = Date.now(), day = 86400e3;
  const sum = (list) => list.reduce((a, r) => { a.cost += r.cost || 0; a.prompt += r.prompt || 0; a.completion += r.completion || 0; a.cached += r.cached || 0; a.requests++; return a; }, { cost: 0, prompt: 0, completion: 0, cached: 0, requests: 0 });
  const start = new Date(); start.setHours(0, 0, 0, 0);
  const group = (keyFn, labelFn) => { const m = new Map(); for (const r of recs) { const k = keyFn(r); if (!m.has(k)) m.set(k, { key: k, label: labelFn ? labelFn(r) : k, list: [] }); m.get(k).list.push(r); } return [...m.values()].map((g) => ({ key: g.key, label: g.label, ...sum(g.list) })).sort((a, b) => b.cost - a.cost || b.prompt - a.prompt); };
  const days = [];
  for (let i = 13; i >= 0; i--) { const d0 = start.getTime() - i * day; days.push({ day: new Date(d0).toISOString().slice(5, 10), ...sum(recs.filter((r) => r.t >= d0 && r.t < d0 + day)) }); }
  let key = null;
  if (!isOR()) key = { label: /20128/.test(baseUrl()) ? "OmniRoute (محلي :20128)" : "سيرفرك الخاص", usage: 0, limit: null };
  else try { const j = await (await fetch(baseUrl() + "/key", { headers: { Authorization: "Bearer " + getKey() }, signal: AbortSignal.timeout(8000) })).json(); key = j.data || { error: (j.error && j.error.message) || "unknown" }; } catch (e) { key = { error: e.message }; }
  return { today: sum(recs.filter((r) => r.t >= start.getTime())), week: sum(recs.filter((r) => r.t >= now - 7 * day)), month: sum(recs.filter((r) => r.t >= now - 30 * day)), all: sum(recs), days,
    byModel: group((r) => r.model).slice(0, 12), bySession: group((r) => r.sid, (r) => r.title).slice(0, 12), key };
}

/* ---------- scheduled tasks (run while the app is open) ---------- */

const tasksFile = () => path.join(app.getPath("userData"), "tasks.json");
const loadTasks = () => { try { return JSON.parse(fs.readFileSync(tasksFile(), "utf8")); } catch { return []; } };
const saveTasks = (list) => fs.writeFileSync(tasksFile(), JSON.stringify(list));

function runTask(id) {
  const list = loadTasks(), t = list.find((x) => x.id === id); if (!t) return null;
  const s = store.createSession({ cwd: fs.existsSync(t.cwd) ? t.cwd : undefined, model: t.model || undefined, perm: "auto", mode: "agent" });
  s.title = "⏱ " + t.title; s.titled = true; store.saveSession(s);
  send({ t: "session", sid: s.id, meta: store.meta(s) });
  t.lastRun = Date.now(); saveTasks(list);
  setTimeout(() => { try { agent.send(s.id, { text: t.prompt }); } catch (e) { console.error("task failed:", e.message); } }, 400);
  return s.id;
}
function tickTasks() {
  const now = Date.now();
  for (const t of loadTasks()) {
    if (!t.enabled) continue;
    let due;
    if (t.kind === "interval") due = now - (t.lastRun || t.created || now) >= Math.max(5, t.minutes || 60) * 60000;
    else { const [hh, mm] = String(t.time || "09:00").split(":").map(Number); const at = new Date(); at.setHours(hh, mm, 0, 0); due = now >= at.getTime() && (t.lastRun || t.created || 0) < at.getTime(); }
    if (due) runTask(t.id);
  }
}

/* ---------- training data: successful conversations in the chat format fine-tuning tools expect ---------- */

function exportTraining(file) {
  const toolDefs = tools.toolDefs(false, false), out = [];
  let used = 0;
  for (const meta of store.listSessions()) {
    const s = store.getSession(meta.id); if (!s || s.rating === "bad" || agent.isRunning(s.id)) continue;
    const calls = s.messages.filter((m) => m.tool_calls).length, lastLog = s.log[s.log.length - 1];
    // kept when you marked it good, or when it used tools and ended on a normal answer with no error at the end
    const autoOk = calls > 0 && lastLog && lastLog.kind === "assistant" && !s.log.slice(-4).some((i) => (i.kind === "notice" && i.level === "error") || (i.kind === "tool" && i.status === "error"));
    if (s.rating !== "good" && !autoOk) continue;
    const messages = [{ role: "system", content: agent.systemPrompt({ ...s, cwd: "/workspace", worktree: null }, { ...store.settings(), instructions: "" }, []) }];
    for (const m of s.messages) {
      const content = typeof m.content === "string" ? m.content : Array.isArray(m.content) ? m.content.filter((p) => p.type === "text").map((p) => p.text).join(String.fromCharCode(10)) : "";
      const msg = { role: m.role, content: String(content || "").split(s.cwd).join("/workspace").split(s.baseCwd).join("/workspace") };
      if (m.tool_calls) msg.tool_calls = m.tool_calls.map((c) => ({ id: c.id, type: "function", function: { name: c.function.name, arguments: c.function.arguments } }));
      if (m.tool_call_id) msg.tool_call_id = m.tool_call_id;
      messages.push(msg);
    }
    out.push(JSON.stringify({ messages, tools: toolDefs, meta: { title: s.title, model: s.model, rating: s.rating || "auto" } })); used++;
  }
  fs.writeFileSync(file, out.join(String.fromCharCode(10)) + (out.length ? String.fromCharCode(10) : ""), "utf8");
  return { sessions: used, examples: out.length, path: file };
}

/* ---------- IPC ---------- */

const H = {
  boot: async () => ({ models: await refreshModels(modelsStale()), settings: publicSettings(), sessions: store.listSessions(), servers: tools.serverList(), platform: process.platform, version: app.getVersion(), home: app.getPath("home"), forceSetup: !!process.env.ANTILLUSION_SETUP,
    selftest: process.env.ANTILLUSION_SELFTEST ? { prompt: process.env.ANTILLUSION_SELFTEST, cwd: process.env.ANTILLUSION_SELFTEST_CWD, model: process.env.ANTILLUSION_SELFTEST_MODEL, perm: process.env.ANTILLUSION_SELFTEST_PERM } : null }),
  "settings:set": async (patch) => { const { keyEnc, keyPlain, hasKey, ...safe } = patch || {}; const was = store.settings().freeOnly, wasUrl = store.settings().baseUrl; store.setSettings(safe); if ((safe.freeOnly !== undefined && safe.freeOnly !== was) || (safe.baseUrl !== undefined && safe.baseUrl !== wasUrl)) { if (safe.baseUrl !== wasUrl) store.setModels([]); await refreshModels(true); } return publicSettings(); },
  "key:set": (k) => { setKey(k); return publicSettings(); },
  "models:refresh": () => refreshModels(true),

  "session:create": (init) => { const s = store.createSession(init || {}); return { meta: store.meta(s), log: [] }; },
  "session:get": (id) => { const s = store.getSession(id); if (s && !store.modelInfo(s.model) && store.models().list.length && !agent.isRunning(id)) { s.model = store.settings().model; store.saveSession(s); } return s ? { meta: store.meta(s), log: s.log, running: agent.isRunning(id) } : null; },
  "session:update": (id, patch) => {
    const s = store.getSession(id); if (!s) return null;
    for (const k of ["model", "mode", "perm", "effort", "title", "rating"]) if (patch[k] !== undefined) s[k] = patch[k];
    if (patch.title) s.titled = true;
    if (patch.model) { s.ctx.max = (store.modelInfo(patch.model) || {}).context_length || s.ctx.max; store.setSettings({ model: patch.model }); }
    for (const k of ["mode", "perm", "effort"]) if (patch[k] !== undefined) store.setSettings({ [k]: patch[k] });
    store.saveSession(s); return store.meta(s);
  },
  "session:delete": (id) => { agent.stop(id); store.deleteSession(id); return true; },
  "session:clear": (id) => { const s = store.getSession(id); if (agent.isRunning(id)) return null; s.messages = []; s.log = []; s.todos = []; s.checkpoints = {}; s.ctx.used = 0; s.titled = false; s.title = "محادثة جديدة"; store.saveSession(s); return store.meta(s); },
  "session:pickFolder": async (id) => {
    const s = store.getSession(id);
    const r = await dialog.showOpenDialog(win, { title: "اختر مجلد المشروع لهذه الجلسة", defaultPath: s.baseCwd, properties: ["openDirectory", "createDirectory"] });
    if (r.canceled || !r.filePaths[0]) return null;
    s.cwd = s.baseCwd = r.filePaths[0]; s.worktree = null; store.setSettings({ lastCwd: s.cwd });
    if (s.messages.length) s.messages.push({ role: "user", content: `[The user switched the workspace folder to ${s.cwd}. All relative paths now resolve there.]` }, { role: "assistant", content: "Understood." });
    store.saveSession(s); return store.meta(s);
  },
  "session:setFolder": (id, dir) => { const s = store.getSession(id); if (!s || agent.isRunning(id) || !fs.existsSync(dir)) return null; s.cwd = s.baseCwd = dir; s.worktree = null; store.setSettings({ lastCwd: dir }); store.saveSession(s); return store.meta(s); },
  "tasks:list": () => loadTasks(),
  "tasks:save": (t) => { const list = loadTasks(); if (!t.id) { t.id = uid(); t.created = Date.now(); list.push(t); } else { const i = list.findIndex((x) => x.id === t.id); if (i >= 0) list[i] = { ...list[i], ...t }; } saveTasks(list); return t.id; },
  "tasks:delete": (id) => { saveTasks(loadTasks().filter((t) => t.id !== id)); return true; },
  "tasks:run": (id) => runTask(id),
  "train:export": async (file) => {
    if (file && SELFTEST) return exportTraining(file);
    const r = await dialog.showSaveDialog(win, { title: "تصدير بيانات التدريب", defaultPath: path.join(app.getPath("documents"), "antillusion-train.jsonl"), filters: [{ name: "JSON Lines", extensions: ["jsonl"] }] });
    if (r.canceled || !r.filePath) return null;
    return exportTraining(r.filePath);
  },
  "git:info": (id) => { const s = store.getSession(id); return s ? gitInfo(s.cwd) : { repo: false }; },

  "chat:send": async (id, msg) => { await ensureLocalRouter(); return agent.send(id, msg); },
  "chat:stop": (id) => agent.stop(id),
  "chat:compact": (id) => agent.compactNow(id),
  "chat:revert": (id, itemId) => agent.revert(id, itemId),
  "perm:reply": (reqId, decision, note) => { if (SELFTEST) console.log("[selftest] perm:reply", decision); return agent.replyPermission(reqId, decision, note); },
  "preview:reply": (reqId, data) => { const w = previewWaiters.get(reqId); if (w) { previewWaiters.delete(reqId); w(data); } return true; },

  "attach:pick": async () => { const r = await dialog.showOpenDialog(win, { title: "إرفاق ملفات", properties: ["openFile", "multiSelections"] }); return r.canceled ? [] : r.filePaths.map(readAttachment).filter(Boolean); },
  "attach:read": (paths) => (paths || []).map(readAttachment).filter(Boolean),
  "files:search": async (id, q) => {
    const s = store.getSession(id); if (!s) return [];
    const out = [], needle = String(q || "").toLowerCase();
    await tools.walk(s.cwd, (abs, rel) => { if (!needle || rel.toLowerCase().includes(needle)) out.push(rel); return out.length < 40; }, { maxFiles: 8000 });
    return out.sort((a, b) => a.length - b.length).slice(0, 12);
  },

  "worktree:create": worktreeCreate, "worktree:status": worktreeStatus, "worktree:merge": worktreeMerge, "worktree:remove": worktreeRemove,
  "servers:list": () => tools.serverList(), "servers:stop": (id) => tools.stopServer(id), "servers:logs": (id) => tools.serverLogs(id, 400),
  "usage:get": usageReport,
  "skills:list": (id) => { const s = id && store.getSession(id); return require("./core/skills").list([path.join(store.dir, "skills"), s && path.join(s.cwd, ".antillusion", "skills")]); },
  "skills:openFolder": () => { const d = path.join(store.dir, "skills"); fs.mkdirSync(d, { recursive: true }); return shell.openPath(d); },
  "prompt:expand": (id, text) => agent.expandPrompt(id, text),
  "update:state": () => updateState, "update:check": () => checkUpdate(), "update:install": () => installUpdate(), "update:rollback": rollbackUpdate,
  "update:restart": () => { if (launchInstaller()) { setTimeout(() => app.exit(0), 500); return true; } app.relaunch(); app.exit(0); return true; },
  "app:version": async () => {
    let bi = {}; try { bi = JSON.parse(fs.readFileSync(path.join(__dirname, "build-info.json"), "utf8")); } catch {}
    const i = updater ? await updater.info() : {};
    return { version: bi.version || i.version || "", mode: i.mode, branch: i.branch || "", commit: String(i.head || bi.commit || "").slice(0, 7), run: bi.run || "", channel: bi.channel || (i.mode === "git" ? "git" : "stable"), builtAt: bi.builtAt || "" };
  },
  "omni:quota": async () => { if (!/20128/.test(baseUrl())) return { error: "الخدمة الحالية ليست OmniRoute" }; await ensureLocalRouter(); try { return await require("./core/omniquota").fetchQuota(baseUrl(), getKey()); } catch (e) { return { error: e.message }; } },
  "library:list": (id) => { const s = id && store.getSession(id); return library.list([store.userLibraryDir(), s && path.join(s.cwd, ".antillusion", "library")]); },
  "library:read": (cardId, id) => { const s = id && store.getSession(id); return library.read(cardId, [store.userLibraryDir(), s && path.join(s.cwd, ".antillusion", "library")]); },
  "library:import": async () => {
    const r = await dialog.showOpenDialog(win, { title: "استيراد مراجع إلى مكتبتك", properties: ["openFile", "multiSelections"], filters: [{ name: "Markdown / نص", extensions: ["md", "txt"] }] });
    if (r.canceled) return 0;
    for (const f of r.filePaths) fs.copyFileSync(f, path.join(store.userLibraryDir(), path.basename(f)));
    return r.filePaths.length;
  },
  "library:openFolder": () => shell.openPath(store.userLibraryDir()),
  "open:external": (url) => (/^https?:\/\//i.test(url) ? shell.openExternal(url) : null),
  "open:path": (p) => shell.openPath(p),
  "theme:set": (theme) => { try { win.setTitleBarOverlay(overlay(theme)); win.setBackgroundColor(theme === "light" ? "#ffffff" : "#121316"); } catch {} return true; },
  "setup:pickFolder": async () => { const r = await dialog.showOpenDialog(win, { title: "اختر مجلد مشاريعك", properties: ["openDirectory", "createDirectory"] }); if (r.canceled || !r.filePaths[0]) return null; store.setSettings({ lastCwd: r.filePaths[0] }); return r.filePaths[0]; },
  "setup:shortcut": () => { const appDir = app.getAppPath(); return shell.writeShortcutLink(path.join(app.getPath("desktop"), "Antillusion.lnk"), { target: process.execPath, args: app.isPackaged ? "" : `"${appDir}"`, cwd: appDir, description: "Antillusion — AI coding agent" }); },
};

/* ---------- self-test hooks (used only by the automated checks) ---------- */

let shotTimer = null;
async function capture(tag) {
  if (!process.env.ANTILLUSION_SHOT) return;
  if (process.env.ANTILLUSION_UI_JS) { try { await win.webContents.executeJavaScript(process.env.ANTILLUSION_UI_JS); await new Promise((r) => setTimeout(r, 900)); } catch (e) { console.error("UI_JS failed:", e.message); } }
  const img = await win.webContents.capturePage();
  fs.writeFileSync(process.env.ANTILLUSION_SHOT, img.toPNG());
  console.log("[selftest] screenshot saved", tag);
  app.quit();
}
function onEvent(e) {
  if (!SELFTEST && e.t === "status" && e.running === false && win && !win.isDestroyed() && !win.isFocused() && Notification.isSupported()) {
    try { const s = store.getSession(e.sid), n = new Notification({ title: "Antillusion", body: `انتهى الوكيل من العمل${s ? " — " + s.title : ""}`, silent: false }); n.on("click", () => { win.show(); win.focus(); }); n.show(); } catch {}
  }
  if (!SELFTEST) return;
  if (process.env.ANTILLUSION_SELFTEST && e.t === "status" && e.running === false) { clearTimeout(shotTimer); shotTimer = setTimeout(() => capture("after-run"), 3500); }
  if (e.t === "item" && e.item.kind === "tool" && e.item.status !== "running") console.log(`[selftest] ${e.item.name} → ${e.item.status}: ${String(e.item.output).split("\n")[0].slice(0, 150)}`);
  if (e.t === "item" && e.item.kind === "notice") console.log(`[selftest] notice(${e.item.level}): ${e.item.text}`);
}

/* ---------- updates (GitHub) ---------- */

let updater, updateState = { phase: "idle" };
const npmInstall = (cwd) => new Promise((res) => execFile(process.platform === "win32" ? "npm.cmd" : "npm", ["install", "--no-audit", "--no-fund"], { cwd, windowsHide: true, shell: process.platform === "win32", timeout: 600000, maxBuffer: 2e7 }, (e, so, se) => res({ ok: !e, out: String(so || ""), err: String(se || (e && e.message) || "") })));
const setUpdate = (patch) => { updateState = { ...updateState, ...patch }; send({ t: "update", state: updateState }); return updateState; };
const branchPref = () => store.settings().updateBranch || "";
async function checkUpdate({ auto } = {}) {
  if (SELFTEST) return updateState;
  if (["checking", "installing", "ready"].includes(updateState.phase)) return updateState;   // "ready" = installed, waiting for the restart
  setUpdate({ phase: "checking", error: null });
  try {
    const st = await updater.check(branchPref());
    setUpdate({ ...st, phase: st.available ? "available" : "uptodate", error: null });
    if (auto && st.available && store.settings().autoUpdate !== false && !agent.anyRunning() && (st.mode === "release" ? !!st.url : !st.dirty && !st.ahead)) return installUpdate();
  } catch (e) { setUpdate({ phase: "error", error: e.message }); }
  return updateState;
}
async function installUpdate() {
  if (updateState.phase === "installing") return updateState;
  setUpdate({ phase: "installing", error: null });
  if (updateState.mode === "release") {   // installed copy: fetch the new (tiny) Setup.exe now, run it when the app restarts or quits
    try {
      if (!updateState.url) throw new Error("لا يوجد ملف مثبّت في آخر إصدار");
      const r = await updater.downloadInstaller(updateState.url, path.join(app.getPath("temp"), "Antillusion-Setup-update.exe"), updateState.size);
      return setUpdate({ phase: "ready", installerFile: r.file, applied: updateState.commits || [], error: null });
    } catch (e) { return setUpdate({ phase: "error", error: e.message }); }
  }
  try { const r = await updater.apply(branchPref()); if (r.updated && r.previous) store.setSettings({ prevHead: r.previous }); setUpdate({ ...r, phase: r.updated ? "ready" : "uptodate" }); }
  catch (e) { setUpdate({ phase: "error", error: e.message }); }
  return updateState;
}

let installerStarted = false;
function launchInstaller() {
  const f = updateState.installerFile;
  if (installerStarted || !f || !fs.existsSync(f)) return false;
  installerStarted = true;
  spawn(f, [], { detached: true, stdio: "ignore" }).unref();
  return true;
}

async function rollbackUpdate() {
  if (agent.anyRunning()) throw new Error("الوكيل يعمل الآن — أوقفه أولاً");
  const sha = store.settings().prevHead;
  await updater.rollback(sha);
  store.setSettings({ prevHead: "", autoUpdate: false });   // otherwise the next check would immediately re-apply the update
  setUpdate({ phase: "ready", rolledBack: true, applied: [], error: null });
  return updateState;
}

/* ---------- window ---------- */

const overlay = (theme) => (theme === "light" ? { color: "#f4f4f6", symbolColor: "#4c4f57", height: 40 } : { color: "#0e0f11", symbolColor: "#a9adb6", height: 40 });

/** One-time carry-over of sessions/settings saved under the app's previous name. */
function migrateOldData() {
  if (process.env.ANTILLUSION_DATA) return;
  const now = app.getPath("userData"), old = path.join(app.getPath("appData"), "Bun" + "yan");
  if (!fs.existsSync(old) || fs.existsSync(path.join(now, "settings.json"))) return;
  fs.mkdirSync(now, { recursive: true });
  for (const n of ["settings.json", "usage.json", "models.json", "tasks.json", "sessions", "library"]) { try { fs.cpSync(path.join(old, n), path.join(now, n), { recursive: true }); } catch {} }
}

function createWindow() {
  win = new BrowserWindow({
    ...(SELFTEST ? { x: -5000, y: 60, skipTaskbar: true } : {}), width: 1560, height: 960, minWidth: 940, minHeight: 600, backgroundColor: store.settings().theme === "light" ? "#ffffff" : "#121316", show: false, title: "Antillusion", icon: path.join(__dirname, "ui", "icon.png"),
    titleBarStyle: "hidden", titleBarOverlay: overlay(store.settings().theme),
    webPreferences: { preload: path.join(__dirname, "preload.js"), contextIsolation: true, nodeIntegration: false, webviewTag: true, spellcheck: false },
  });
  win.removeMenu();
  win.loadFile(path.join(__dirname, "ui", "index.html"));
  win.once("ready-to-show", () => { win.show(); win.focus(); });
  setTimeout(() => { if (win && !win.isDestroyed() && !win.isVisible()) { win.show(); win.focus(); } }, 1200);
  win.webContents.on("will-navigate", (e, url) => { if (!url.startsWith("file://")) { e.preventDefault(); H["open:external"](url); } });
  win.webContents.setWindowOpenHandler(({ url }) => { H["open:external"](url); return { action: "deny" }; });
  win.webContents.on("before-input-event", (e, input) => { if (input.type === "keyDown" && input.key === "F12") win.webContents.toggleDevTools(); });
  win.webContents.on("console-message", (e) => { if (SELFTEST && (e.level === "error" || e.level === 3)) console.log("[renderer error]", e.message, e.sourceId ? `${path.basename(e.sourceId)}:${e.lineNumber}` : ""); });
  if (process.env.ANTILLUSION_SHOT && (!process.env.ANTILLUSION_SELFTEST || process.env.ANTILLUSION_SHOT_AFTER)) win.webContents.once("did-finish-load", () => setTimeout(() => capture("timed"), +process.env.ANTILLUSION_SHOT_AFTER || 2500));
}

app.on("web-contents-created", (e, wc) => {
  // preview tabs are plain, unprivileged pages: no preload, no Node, pop-ups become new preview tabs
  wc.on("will-attach-webview", (ev, prefs) => { delete prefs.preload; prefs.nodeIntegration = false; prefs.contextIsolation = true; });
  if (wc.getType() === "webview") wc.setWindowOpenHandler(({ url }) => { if (/^https?:|^file:/i.test(url)) send({ t: "preview", url }); return { action: "deny" }; });
});

app.whenReady().then(() => {
  migrateOldData();
  store = createStore(app.getPath("userData"));
  seedKey();
  ensureLocalRouter();   // warm it up while the window opens
  agent = createAgent({
    store, emit: send, getKey,
    ui: {
      openPreview: (p) => send({ t: "preview", ...p }),
      previewRead: (req) => new Promise((resolve) => {
        const reqId = uid(); const timer = setTimeout(() => { previewWaiters.delete(reqId); resolve({ error: "the preview did not answer in time (is the page still loading?)" }); }, 15000);
        previewWaiters.set(reqId, (d) => { clearTimeout(timer); resolve(d); });
        send({ t: "previewRead", reqId, js: req.js });
      }),
    },
  });
  tools.onServersChanged(() => send({ t: "servers", list: tools.serverList() }));
  for (const [ch, fn] of Object.entries(H)) ipcMain.handle(ch, async (e, ...args) => { try { return await fn(...args); } catch (err) { return { __error: err.message || String(err) }; } });
  updater = createUpdater({ appDir: __dirname, git: (cwd, ...a) => git(cwd, ...a), npm: npmInstall });
  createWindow();
  setInterval(refreshRuntimePath, 5000);   // Node/Git can finish installing while the app is already open
  if (!SELFTEST) { setInterval(tickTasks, 30000); setTimeout(() => checkUpdate({ auto: true }), 8000); setInterval(() => checkUpdate({ auto: true }), 3 * 3600e3); }
});

app.on("second-instance", () => { if (win) { if (win.isMinimized()) win.restore(); win.focus(); } });
app.on("window-all-closed", () => app.quit());
// an update downloaded for an installed copy is applied when the app closes
app.on("will-quit", () => { if (updateState.phase === "ready" && updateState.installerFile && store && store.settings().autoUpdate !== false) launchInstaller(); });
app.on("before-quit", () => { try { tools.stopAllServers(); store && store.flush(); } catch {} });
