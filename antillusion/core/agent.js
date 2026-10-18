/* Antillusion — the agent loop: streams a model turn from OpenRouter, runs the tools it asks for (behind the
   permission gate), feeds results back, tracks usage and the context window, and compacts when it fills up. */
"use strict";

const fs = require("fs");
const path = require("path");
const os = require("os");
const tools = require("./tools");
const library = require("./library");
const skills = require("./skills");
const scoutLib = require("./scout");
const verifyLib = require("./verify");
const { createRouter, AUTO } = require("./router");
const { AsyncLocalStorage } = require("async_hooks");

const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
const NLCH = String.fromCharCode(10);
const sleep = (ms, signal) => new Promise((res, rej) => { const t = setTimeout(res, ms); signal && signal.addEventListener("abort", () => { clearTimeout(t); rej(abortErr()); }, { once: true }); });
const abortErr = () => Object.assign(new Error("aborted"), { name: "AbortError" });
const estTokens = (msgs) => Math.ceil(JSON.stringify(msgs).length / 3.6);

const MODE_TEXT = {
  agent: "MODE: CODE (agent). You have full tools. Do the work end to end: explore, implement, run, verify.",
  plan: "MODE: PLAN. You are read-only: explore the workspace and the library/sources, then deliver a plan the user can approve. Format (concise, concrete, no filler): 1) Goal in one sentence + assumptions you made; 2) Scope: Must / Should / Later; 3) Architecture & key decisions (stack with a reason each, data model, main files to create/change); 4) Milestones — each leaves a runnable product, lists the files touched and an acceptance check you will run; 5) Risks/unknowns with mitigations; 6) At most 3 open questions that change the build. Publish the milestones with todo_write (that is the checklist the user sees and the one you execute next). Do NOT modify files or run commands — those tools are disabled. End with: \"جاهز للتنفيذ — اضغط «نفّذ الخطة» أو عدّل أي نقطة.\"",
  ask: "MODE: ASK. You are read-only: answer questions about the code and about programming, reading whatever you need. Do not propose to make changes unless asked; modifying tools are disabled.",
};

const SIZE_ERR = /\[413\]|\b413\b|too large|context.{0,20}(length|window)|maximum context|prompt is too long|input is too long|reduce (the length|your message)|tokens per minute|\bTPM\b|exceeds.{0,40}(limit|context)/i;
/** Short system prompt for small models / tight provider limits (~1.3k chars instead of ~12k). */
function litePrompt(s, settings) {
  return `You are Antillusion, a software-engineering agent working directly in the user's project folder with real tools (read/write/edit files, run commands, serve and preview pages). Reply in the user's language.
Workspace: ${s.cwd} · OS: ${process.platform === "win32" ? "Windows" : process.platform} · Shell: ${tools.shellSpec(settings.shell).name || ""}
${MODE_TEXT[s.mode] || MODE_TEXT.agent}
Rules: act immediately with tool calls, no long preambles. Keep each write_file under ~120 lines; split big work into several files. Use use_template when a <starter_template> hint is present. Playbooks are available with library_read(id) when needed. Commands must be non-interactive. Verify once at the end (serve_static/open_preview then preview_read). Final answer: 2–5 lines.`;
}
/** Wire copy of a message with injected references collapsed to pointers (the library still has them). */
function shrinkMsg(m) {
  if (m.role !== "user") return m;
  const sh = (t) => String(t).replace(/<library_reference id="([^"]+)">[\s\S]*?<\/library_reference>/g, (x, id) => `[reference "${id}" — read it with library_read if needed]`).replace(/(<skill [^>]*>)([\s\S]*?)(<\/skill>)/g, (x, a, b, c) => a + b.slice(0, 1400) + (b.length > 1400 ? "\n…" : "") + c);
  if (typeof m.content === "string") return { ...m, content: sh(m.content) };
  if (Array.isArray(m.content)) return { ...m, content: m.content.map((p) => (p.type === "text" ? { ...p, text: sh(p.text) } : p)) };
  return m;
}

const CODE_TEXT = `# Antillusion Code
You are Antillusion Code — a senior engineering agent specialised in building and fixing real software. Quality bar: it runs, it is complete, it is clean.
- Engineering loop: understand the codebase (the repository map below; read before you edit) → short plan (todo_write when 4+ steps) → implement in small increments → run → fix.
- Match the project's conventions. No placeholders, no "TODO: implement", no fake data unless asked.
- Large builds with 3+ separable parts (engine / UI / levels / audio / data…): call delegate with 2–4 tasks that each own different files, plus shared context with the exact interfaces between files. Workers run in parallel; you then integrate, check that names and imports match, and finish the glue.
- When you stop calling tools, Antillusion verifies your work automatically: syntax of every changed file, missing referenced files, the page actually run in a browser (console errors, blank screen, frozen game loop) and the project's tests. If it reports problems, fix them all.
- Prefer a starter template when one fits the request — they are tested.`;

const SELF_DEV = `# Self-Development and Introspection Capabilities (Antillusion)
- You have full awareness and tools to inspect and safely modify your own codebase (the Antillusion project itself).
- project_fork_status: check original, backup (antillusion_backup), and active dev fork (antillusion_dev).
- project_list_files & project_read_source: inspect any part of Antillusion's code (main.js, preload.js, core/agent.js, core/tools.js, ui/app.js, library, etc.).
- project_modify_source & project_edit_source: write and edit files in the active development fork (antillusion_dev). The working version is safely preserved in antillusion_backup. You can freely enhance, customize, or debug Antillusion without breaking the running instance.

`;

function systemPrompt(s, settings, libraryDirs) {
  const sh = tools.shellSpec(settings.shell);
  let project = "";
  for (const n of ["AGENTS.md", "ANTILLUSION.md", "CLAUDE.md"]) {
    try { const t = fs.readFileSync(path.join(s.cwd, n), "utf8"); if (t.trim()) { project = `\n\n# Project instructions (${n})\n${t.slice(0, 8000)}`; break; } } catch {}
  }
  return `You are Antillusion, an expert software-engineering agent running inside a desktop app on the user's own machine. You work directly in their project folder with real tools: you read and write files, run commands, start local servers, and show the result in a live preview panel beside the chat.

# Environment
- OS: ${process.platform === "win32" ? "Windows" : process.platform} ${os.release()} (${os.arch()})
- Workspace (all relative paths resolve here): ${s.cwd}${s.worktree ? `\n- This session works in an isolated git worktree on branch ${s.worktree.branch} (main checkout: ${s.worktree.repo}). Commit here freely; the user merges when happy.` : ""}
- Shell used by run_command / start_server: ${sh.name}
- Date: ${new Date().toISOString().slice(0, 10)}
- ${MODE_TEXT[s.mode] || MODE_TEXT.agent}

${s.selfDev ? SELF_DEV : ""}${s.kind === "code" && !s.worker ? CODE_TEXT + "\n\n" + (s._repoMap || "") + "\n\n" : ""}# Speed (the user is watching and waiting)
- Act immediately. No preamble, no restating the request, no long plan in prose. One short sentence, then tool calls.
- Batch: issue all independent tool calls (several reads, searches, lookups) together in ONE turn — they run in parallel. To look at several files use read_many (one call); to change several places in one file use multi_edit (one call, atomic) instead of repeated edit_file.
- New/empty workspace: do not explore it. Use use_template ONLY when the user message carries a <starter_template> hint, or the request is plainly the same kind of thing as a template below (a store → store, a Minecraft-like game → voxel-game). Then make targeted edit_file changes — never rewrite a template. For anything else (a calculator, Tetris, a quiz, a converter…) do NOT use a template: write the files directly.
- Output size: long tool calls time out. Keep every write_file under ~150 lines. Split a build into separate files (index.html, style.css, app.js — one call each); if a single file must be longer, write it in parts (more=true, then append=true). Never put a whole large app in one call.
- Scope: build exactly what was asked. After use_template the request is ALREADY satisfied unless the user named specific changes: serve it, verify once, then stop and offer 3–4 concrete next upgrades as a short list for the user to choose from. Never add unrequested features (extra systems, modes, UI) on your own — every extra step costs the user time and quota.
- Use todo_write only for jobs with 4+ distinct steps. Verify once at the end (one preview_read), not after every edit.
- References matching the request are attached to the user's message automatically — use them directly instead of searching again.
- Final answer: 2–5 lines. Do not paste back code you already wrote to files.

# Starter templates (use_template)
${library.templates().map((t) => `- ${t.name}: ${String(t.title).split(/[(:,—]/)[0].trim().slice(0, 90)}`).join("\n") || "(none)"}

# Craft (follow exactly — these prevent the most common failures)
- Every write_file/edit_file is syntax-checked automatically. If the result says SYNTAX CHECK FAILED, your very next action is fixing that exact error.
- Pages are checked automatically when opened: the tool result already contains console errors and visible text. Fix errors immediately; do not call preview_read again unless you need to test an interaction.
- edit_file: copy old_string from the latest read_file output WITHOUT the line-number prefix; use a small unique anchor (2–6 lines). Never edit a file you have not read in this conversation. After 2 failed edits on the same spot, re-read that range, or rewrite the whole file with write_file if it is under ~300 lines.
- Write code in dependency order: constants and state → helper functions → main logic → event wiring → start. Every identifier you use must be defined in the files you wrote; every id/class the JS queries must exist in the HTML with the exact same spelling.
- Browser JS: put <script> at the end of <body> (or use type="module"/defer); never reference an element before it exists; one top-level declaration per name across all classic scripts; ES modules only work when served over http (serve_static), never from file://.
- Do not invent APIs. If you are not certain a function/option exists in the library version in use, check pkg_info or the attached reference first.
- Never repeat the same failing call. If something failed twice, change the approach.
- Keep going until the task is truly done and verified; do not stop to ask permission for obvious next steps.${settings.expert ? "\n- A senior expert is available through ask_expert: use it for design decisions on anything non-trivial and whenever a bug survives two attempts — it is much faster than guessing." : ""}

# How you work
1. Understand first. Before changing an existing project, look at it: list_dir (depth 2), read the manifest (package.json / pyproject.toml / Cargo.toml …) and the files you will touch. Match the project's existing stack, style and conventions. Never guess at a file's contents — read it.
2. For jobs with 3+ steps call todo_write up front and keep it current.
3. Use what exists. Check library_search for the right playbook and proven packages before choosing a stack; use pkg_info to confirm the current version and API of a package instead of trusting memory; use sources_search / web_fetch for docs and for errors you do not recognise.
4. Implement completely. Write real, working, complete code — no placeholders, no "TODO: implement", no omitted sections, no fake data standing in for a feature that was asked for. Prefer edit_file for changes to existing files; write_file for new files. Keep files focused and reasonably sized; write very long files in several steps (create, then extend with edit_file).
5. Run it and verify. After building: install dependencies, run the build/tests/linters that exist, and fix what fails. For anything with a UI: use serve_static (plain HTML/CSS/JS) or start_server (dev servers, APIs) so it opens in the preview panel, then call preview_read to confirm it rendered and has no console errors — and fix any that appear. Do not say something works unless you ran it.
6. Report briefly: what you built or changed, how to run it, and anything that is not finished or could not be verified. Reference files as path:line.

# Rules
- Commands must be non-interactive (pass flags like --yes / -y / --template; never wait on a prompt). Long-running processes go through start_server, never run_command.
- Stay inside the workspace unless the user asks otherwise. Never delete or overwrite the user's work that you did not create without being asked; never run destructive git commands (reset --hard, clean -f, push --force) or commit/push unless asked.
- Never put secrets in code; use environment variables and a .env.example. Never weaken security (disabled TLS checks, wildcard CORS with credentials, SQL built by string concatenation) to make something pass.
- If a tool call is denied by the user, do not retry it in another form — adapt or ask what they prefer.
- When requirements are genuinely ambiguous in a way that changes the build, ask one short question; otherwise pick the sensible default, say so, and continue.
- Design quality matters for anything visual: deliberate typography, spacing, colour and responsive layout; accessible markup; real content rather than lorem ipsum. Support right-to-left when the content is Arabic.
- Reply in the language the user writes in (Arabic → Arabic), keeping code, commands and identifiers in English. Be concise; use Markdown; put code in fenced blocks with a language tag.

# Built-in library
Playbooks available through library_read (ids): ${library.ids(libraryDirs)}${settings.instructions ? `\n\n# User's standing instructions\n${String(settings.instructions).slice(0, 4000)}` : ""}${project}`;
}

function apiError(status, body) {
  let msg = String(body || "").slice(0, 500), meta = "";
  try { const j = JSON.parse(body); msg = (j.error && (j.error.message || j.error.code)) || msg; meta = j.error && j.error.metadata && j.error.metadata.raw ? " — " + String(j.error.metadata.raw).slice(0, 300) : ""; } catch {}
  const hints = { 401: "مفتاح API غير صالح أو منتهي — غيّره من الإعدادات.", 402: "الرصيد غير كافٍ لهذا النموذج — اشحن الرصيد، أو اختر نموذجاً مجانياً (:free)، أو صغّر «أقصى طول للرد» من الإعدادات.", 403: "هذا النموذج غير متاح لمفتاحك أو منطقتك.", 404: "النموذج غير موجود أو لا يدعم الأدوات — اختر نموذجاً آخر.", 429: "تم تجاوز حد الطلبات — انتظر قليلاً أو بدّل النموذج." };
  return Object.assign(new Error(`${hints[status] || "خطأ من مزوّد النموذج."} (HTTP ${status}: ${msg}${meta})`), { status });
}

/** Routers such as OmniRoute return one long error listing every provider they tried ("x: model — [402]: …; y: auth — [401]: …").
    Turn it into a short Arabic summary + the raw text for a collapsible "details" block. */
function summarizeProviderError(msg) {
  const raw = String(msg || ""), codes = [...raw.matchAll(/\[(\d{3})\]/g)].map((m) => +m[1]);
  if (codes.length < 2 && !/bad_gateway|Stream ended|SSE event/i.test(raw)) return null;
  const cat = (c) => (c === 402 ? "رصيد غير كافٍ" : c === 401 || c === 403 ? "مفتاح أو صلاحية مفقودة" : c === 429 ? "حدّ طلبات أو حساب معلّق" : c === 400 || c === 404 ? "نموذج غير معروف" : "عطل عند المزوّد");
  const counts = new Map(); for (const c of codes) counts.set(cat(c), (counts.get(cat(c)) || 0) + 1);
  if (!codes.length) counts.set("انقطع البث من المزوّد", 1);
  const more = +((raw.match(/\(\+(\d+) more\)/) || [])[1] || 0);
  const list = [...counts].map(([k, n]) => `${k}${n > 1 ? " ×" + n : ""}`).join("، ");
  return { text: `فشل كل المزوّدين المتاحين لهذا النموذج (${list}${more ? `، و${more} غيرها` : ""}). فعّل مزوّداً أو اشحن رصيده من لوحة OmniRoute، أو اختر نموذجاً آخر.`, detail: raw };
}

function mergeReasoning(list, parts) {
  for (const p of parts) {
    const cur = list.find((x) => (p.index !== undefined ? x.index === p.index : x === list[list.length - 1]) && x.type === p.type);
    if (!cur) { list.push({ ...p }); continue; }
    for (const k of ["text", "summary", "data"]) if (typeof p[k] === "string") cur[k] = (cur[k] || "") + p[k];
    for (const k of ["signature", "id", "format"]) if (p[k]) cur[k] = p[k];
  }
}

/**
 * @param store   { getSession, saveSession, settings(), modelInfo(id), addUsage(rec) }
 * @param emit    (event) => void          — pushed to the UI
 * @param getKey  () => string
 * @param ui      { openPreview({url,title,sid}), previewRead({js}) => Promise }
 */
function createAgent({ store, emit: rootEmit, getKey, ui }) {
  // team workers run inside their own async context: their events feed the team card instead of the main chat
  const als = new AsyncLocalStorage();
  const emit = (ev) => { const c = als.getStore(); if (c) c.emit(ev); else rootEmit(ev); };
  const router = createRouter({ dir: store.dir });
  const running = new Map();   // sid -> { ac }
  const waiting = new Map();   // reqId -> { sid, resolve }

  const upsert = (s, item) => { const i = s.log.findIndex((x) => x.id === item.id); if (i < 0) s.log.push(item); else s.log[i] = item; emit({ t: "item", sid: s.id, item }); return item; };
  const notice = (s, text, level = "info", extra) => upsert(s, { id: uid(), kind: "notice", text, level, at: Date.now(), ...(extra || {}) });
  const pushUsage = (s) => { if (!s.worker) emit({ t: "usage", sid: s.id, usage: s.usage, ctx: s.ctx }); };
  const libDirs = (s) => [store.userLibraryDir && store.userLibraryDir(), path.join(s.cwd, ".antillusion", "library")];

  async function request(body, signal) {
    const st = store.settings(), key = getKey();
    const base = (st.baseUrl || "https://openrouter.ai/api/v1").replace(/\/+$/, ""), isOR = /openrouter\.ai/.test(base);
    if (!key && isOR) throw new Error("لا يوجد مفتاح API — أضِفه من الإعدادات.");
    // plain OpenAI-compatible servers do not know OpenRouter's extras; usage comes through stream_options instead
    const wire = (b) => { if (isOR) return b; const { usage, provider, models, reasoning, ...rest } = b; return rest.stream ? { ...rest, stream_options: { include_usage: true } } : rest; };
    for (let attempt = 0; ; attempt++) {
      if (attempt) emit && emit({ t: "activity", text: "المزوّد مشغول — إعادة المحاولة…", sid: body.__sid });
      let r;
      try {
        r = await fetch(base + "/chat/completions", {
          method: "POST", signal, body: JSON.stringify(wire(body), (k, v) => (k === "__sid" ? undefined : v)),
          headers: { ...(key ? { Authorization: "Bearer " + key } : {}), "Content-Type": "application/json", "HTTP-Referer": "https://antillusion.app", "X-Title": "Antillusion" },
        });
      } catch (e) { if (e.name === "AbortError") throw e; if (attempt >= (isOR ? 3 : 1)) throw isOR ? e : Object.assign(new Error(`تعذّر الاتصال بالسيرفر ${base} — تأكد أنه يعمل وأن العنوان صحيح.`), { conn: true }); await sleep(1200 * 2 ** attempt, signal); continue; }
      if (r.ok) return r;
      const text = await r.text();
      // a router (OmniRoute) that already tried every provider says so with per-provider codes: retrying the same model only wastes seconds
      const exhausted = !isOR && (/\[\d{3}\]/.test(text) || /bad_gateway/i.test(text));
      if (!exhausted && [408, 429, 500, 502, 503, 504, 529].includes(r.status) && attempt < (isOR ? 3 : 1)) { await sleep(900 * 2 ** attempt, signal); continue; }
      throw apiError(r.status, text);
    }
  }

  function account(s, usage, model) {
    if (!usage) return;
    const prompt = usage.prompt_tokens || 0, completion = usage.completion_tokens || 0, cached = (usage.prompt_tokens_details && usage.prompt_tokens_details.cached_tokens) || 0;
    let cost = typeof usage.cost === "number" ? usage.cost : null;
    if (cost === null) { const m = store.modelInfo(model); cost = m && m.pricing ? prompt * (+m.pricing.prompt || 0) + completion * (+m.pricing.completion || 0) : 0; }
    s.usage.prompt += prompt; s.usage.completion += completion; s.usage.cached += cached; s.usage.cost += cost; s.usage.requests += 1;
    store.addUsage({ t: Date.now(), sid: s.id, title: s.title, model, prompt, completion, cached, cost });
    return { prompt, completion };
  }

  /** One streamed model call. Returns { message, toolCalls, finish }. */
  // own servers: the session model first, then favourites, then the router's general-purpose combos, then anything listed
  const PREFERRED = ["auto/best-coding", "auto/best-coding-fast", "auto/best-fast", "auto/pro-coding", "auto/best-reasoning", "auto/best-chat", "openrouter/auto"];
  // models that just failed (dead providers, timeouts, empty replies) are skipped for a while — across sessions, since the cause is upstream
  const bad = new Map();   // model -> until (ms)
  const BAD_MS = 10 * 60e3;
  // how long a failure keeps a model out of rotation depends on why it failed: a rate limit clears in a minute, an empty wallet does not
  function classify(e) {
    const m = String((e && e.message) || ""), st = e && e.status;
    if (e && e.timeout) return { label: "انتهت مهلة الاستجابة", kind: "timeout", ms: 3 * 60e3 };
    if (e && e.empty) return { label: "ردّ فارغ", kind: "empty", ms: 3 * 60e3 };
    const codes = [...m.matchAll(/\[(\d{3})\]/g)].map((x) => +x[1]);
    const cool = st === 429 || /cooling down|rate.?limit|too many requests/i.test(m);
    if (codes.length) {
      const hard = codes.filter((c) => [401, 402, 403].includes(c)).length;
      if (hard === codes.length) return { label: codes.includes(402) ? "رصيد غير كافٍ" : "مفتاح أو صلاحية", kind: "billing", ms: BAD_MS };
      if (codes.every((c) => c === 429)) return { label: "حدّ الطلبات", kind: "cooldown", ms: 60e3 };
      return { label: "كل مزوّديه فشلوا", kind: "mixed", ms: 4 * 60e3 };
    }
    if (cool) return { label: "حدّ الطلبات / تبريد", kind: "cooldown", ms: 60e3 };
    if (st === 402) return { label: "رصيد غير كافٍ", kind: "billing", ms: BAD_MS };
    if (st === 401 || st === 403) return { label: "مفتاح أو صلاحية", kind: "billing", ms: BAD_MS };
    if (st === 404) return { label: "نموذج غير موجود", kind: "missing", ms: BAD_MS };
    if (/Stream ended|SSE event/i.test(m)) return { label: "انقطع البث", kind: "stream", ms: 2 * 60e3 };
    return { label: st ? "خطأ " + st : "خطأ من المزوّد", kind: "server", ms: 2 * 60e3 };
  }
  // live health per model (success/failure, last reason, latency) — shown in the model picker and the health board
  const health = new Map();
  const noteHealth = (model, ok, info = {}) => { const h = health.get(model) || { ok: 0, fail: 0 }; if (ok) { h.ok++; h.ms = info.ms; h.lastOk = Date.now(); } else { h.fail++; h.last = info.label; h.kind = info.kind; h.lastFail = Date.now(); } health.set(model, h); emit({ t: "health", model, health: { ...h, until: bad.get(model) || 0 } }); };
  const isBad = (id) => { const t = bad.get(id); if (t && t < Date.now()) bad.delete(id); return !!(t && t >= Date.now()); };
  const scoutedSet = () => { const st = store.settings(); return new Set(st.scout && Date.now() - st.scout.at < 6 * 3600e3 ? st.scout.ok.map((x) => x.id) : []); };
  const allModels = () => ((store.models && store.models().list) || []).filter((m) => m.id !== AUTO);
  const ranked = (role = "code", exclude = []) => router.rank(allModels(), role, { exclude, isBad, scouted: scoutedSet() });
  function fallbackOrder(s, tried = []) {
    const st = store.settings(), have = new Set(((store.models && store.models().list) || []).map((m) => m.id)), out = [];
    const sc = st.scout && Date.now() - st.scout.at < 6 * 3600e3 ? st.scout.ok.map((x) => x.id) : [];
    const learned = router.rank([...have], "code", { exclude: tried, isBad, scouted: new Set(sc), limit: 10 });
    for (const id of [s.model, ...(st.favorites || []), ...sc, ...learned, ...PREFERRED, ...have]) if (id && id !== AUTO && (id === s.model || have.has(id)) && !out.includes(id) && !tried.includes(id) && !isBad(id)) out.push(id);
    return out.slice(0, 8);
  }

  async function complete(s, signal) {
    if (s.model === AUTO && !s._cur) s._cur = fallbackOrder(s)[0] || null;
    const st = store.settings(), info = store.modelInfo(s._cur || s.model) || {};
    const readOnly = s.mode !== "agent";
    const anthropic = /^anthropic\//.test(s.model);
    const lite = !!s._lite;   // a provider said the request is too big: short prompt, compact tools, references left in the library
    const sys = (lite ? litePrompt(s, st) : systemPrompt(s, st, libDirs(s))) + (s._chunkHint ? "\n\n# IMPORTANT\nYour previous attempt was cut off because the output was too long. Write at most ~100 lines per tool call from now on: split into several files, or use write_file with more=true / append=true." : "");
    const msgs = [{ role: "system", content: anthropic ? [{ type: "text", text: sys, cache_control: { type: "ephemeral" } }] : sys }, ...(lite ? s.messages.map(shrinkMsg) : s.messages)];
    if (anthropic) {   // rolling cache breakpoint on the newest message keeps long agent runs cheap
      const last = msgs[msgs.length - 1];
      if (last.role === "user" || last.role === "tool") {
        const parts = typeof last.content === "string" ? [{ type: "text", text: last.content || " " }] : last.content.map((p) => ({ ...p }));
        const tp = [...parts].reverse().find((p) => p.type === "text");
        if (tp) { tp.cache_control = { type: "ephemeral" }; msgs[msgs.length - 1] = { ...last, content: parts }; }
      }
    }
    const body = { model: s._cur || s.model, messages: msgs, tools: tools.toolDefs(readOnly, !!st.expert, { selfDev: !!s.selfDev, compact: !!s._lite, team: s.kind === "code" && !s.worker }), stream: true, usage: { include: true }, max_tokens: Math.min(st.maxTokens || 32000, (info.top_provider && info.top_provider.max_completion_tokens) || 1e9) };
    // "no thinking" must be sent explicitly: many models reason by default, which is where most of the waiting went
    if ((info.supported_parameters || []).includes("reasoning")) body.reasoning = s.effort && s.effort !== "off" ? { effort: s.effort } : { enabled: false };
    if (/openrouter\.ai/.test(st.baseUrl || "openrouter.ai")) {
      body.provider = { sort: "throughput" };   // fastest host for the model
      const isFree = (m) => m && m.pricing && +m.pricing.prompt === 0;
      if (isFree(info)) {   // rate-limited upstream? fall through to the next available model instead of waiting
        const alts = (st.favorites || []).filter((id) => id !== s.model && isFree(store.modelInfo(id)) && (!msgs.some((m) => Array.isArray(m.content) && m.content.some((p) => p.type === "image_url")) || (store.modelInfo(id).architecture.input_modalities || []).includes("image")));
        if (alts.length) { const order = [s.model, ...alts.slice(0, 2)]; for (let i = 0; i < (s._alt || 0) % order.length; i++) order.push(order.shift()); body.models = order; body.model = order[0]; }
      }
    }
    else if (s._cur) body.model = s._cur;   // own server (OmniRoute…): the model the run fell back to
    // reply budget: a moderate start (free tiers count it against their limits), grown automatically when a reply is cut at
    // the limit (thinking models can spend thousands of tokens before the first word); never above the user's setting
    const userMax = st.maxTokens || 32000;
    if (info.local) body.max_tokens = Math.min(body.max_tokens, st.localMaxTokens || 8192, Math.max(1024, Math.floor((info.context_length || 32768) / 4)));
    if (lite) body.max_tokens = Math.min(body.max_tokens, 2048);
    if (s._boost) body.max_tokens = Math.min(Math.max(body.max_tokens, s._boost), userMax, (info.top_provider && info.top_provider.max_completion_tokens) || 1e9);
    // "no thinking" for OpenAI-compatible servers too (OmniRoute forwards it; a provider that rejects it gets it removed below)
    if (!/openrouter\.ai/.test(st.baseUrl || "openrouter.ai") && (!s.effort || s.effort === "off")) body.reasoning_effort = "low";
    else if (!/openrouter\.ai/.test(st.baseUrl || "openrouter.ai") && s.effort) body.reasoning_effort = s.effort === "max" ? "high" : s.effort;
    emit({ t: "activity", sid: s.id, text: `ينتظر ${body.model}…` });
    // watchdog: a provider that never answers, or stalls mid-stream, is cut off so the run can move to another model.
    // The per-attempt controller also lets the user switch models mid-request (switchModel → "switch").
    const att = new AbortController(); let why = null, dog = null;
    const cut = (reason) => { if (!why) { why = reason; att.abort(); } };
    const onOuter = () => cut("user"); if (signal.aborted) cut("user"); else signal.addEventListener("abort", onOuter, { once: true });
    const firstMs = (st.firstByteTimeout || 90) * 1000, idleMs = (st.idleTimeout || 60) * 1000;
    const arm = (ms) => { clearTimeout(dog); dog = setTimeout(() => cut("timeout"), ms); };
    const slot = s.worker ? null : running.get(s.id); if (slot) slot.cut = cut;
    const fail = (e) => {
      if (why === "user" || signal.aborted) return abortErr();
      if (why === "switch") return Object.assign(new Error("switched"), { switched: true });
      if (why === "timeout") return Object.assign(new Error(`انتهت مهلة ${body.model} — لا ردّ منذ ${Math.round((started ? idleMs : firstMs) / 1000)} ثانية`), { status: 504, timeout: true });
      return e;
    };
    let started = false;
    arm(firstMs);
    let r;
    try {
      try { r = await request(body, att.signal); }
      catch (e) {   // a model that rejects one of the optional knobs still gets its turn
        if (![400, 404, 422].includes(e.status) || att.signal.aborted) throw e;
        delete body.reasoning; delete body.provider; delete body.models; delete body.reasoning_effort;
        r = await request(body, att.signal);
      }
    } catch (e) { clearTimeout(dog); signal.removeEventListener("abort", onOuter); if (slot) slot.cut = null; throw fail(e); }
    const item = { id: uid(), kind: "assistant", text: "", reasoning: "", model: body.model, at: Date.now(), streaming: true };
    let shown = false, usage = null, finish = null, buf = "", lastAct = 0, raw = "";
    const calls = [], rdetails = [], dec = new TextDecoder();
    const show = () => { if (!shown) { shown = true; upsert(s, item); } };
    const handle = (j) => {
      if (j.error) throw apiError(j.error.code || 500, JSON.stringify(j));
      if (j.usage) usage = j.usage;
      const ch = j.choices && j.choices[0]; if (!ch) return;
      if (ch.error) throw apiError(ch.error.code || 500, JSON.stringify({ error: ch.error }));
      if (ch.finish_reason) finish = ch.finish_reason;
      const d = ch.delta || {};
      if (d.reasoning) { show(); item.reasoning += d.reasoning; emit({ t: "delta", sid: s.id, id: item.id, reasoning: d.reasoning }); }
      if (Array.isArray(d.reasoning_details)) mergeReasoning(rdetails, d.reasoning_details);
      if (d.content) {   // some models leak their <think> blocks into the answer; keep them out of what the user reads
        raw += d.content;
        if (raw.includes("think>") || raw.includes("<think")) { const clean = raw.replace(/<think>[\s\S]*?(<\/think>|$)/g, "").replace(/<\/?think>/g, "").replace(/^\s+/, ""); if (clean !== item.text) { item.text = clean; if (clean) show(); emit({ t: "delta", sid: s.id, id: item.id, set: clean }); } }
        else { show(); item.text += d.content; emit({ t: "delta", sid: s.id, id: item.id, text: d.content }); }
      }
      for (const tc of d.tool_calls || []) {
        const i = tc.index ?? calls.length - 1;
        const c = calls[i] || (calls[i] = { id: "", name: "", args: "" });
        if (tc.id) c.id = tc.id;
        if (tc.function) { if (tc.function.name) c.name += tc.function.name; if (tc.function.arguments) c.args += tc.function.arguments; }
        const now = Date.now();
        if (now - lastAct > 300) { lastAct = now; const p = c.args.match(/"(?:path|command|query|url|pattern|name)"\s*:\s*"((?:[^"\\]|\\.){1,80})/); emit({ t: "activity", sid: s.id, tool: c.name, hint: p ? p[1] : "", chars: c.args.length }); }
      }
      if (j.model && j.model !== body.model) item.model = j.model;
    };
    try {
      for await (const chunk of r.body) {
        if (why) break;
        started = true; arm(idleMs);
        buf += dec.decode(chunk, { stream: true });
        let nl;
        while ((nl = buf.indexOf("\n")) >= 0) {
          const line = buf.slice(0, nl).trim(); buf = buf.slice(nl + 1);
          if (!line.startsWith("data:")) continue;
          const data = line.slice(5).trim(); if (!data || data === "[DONE]") continue;
          let j; try { j = JSON.parse(data); } catch { continue; }
          handle(j);
        }
      }
      if (why) throw new Error(why);
    } catch (e) {
      item.streaming = false; if (shown) upsert(s, item);
      if (item.text.trim()) s.messages.push({ role: "assistant", content: item.text });   // keep what was said before the cut
      throw fail(e);
    } finally { clearTimeout(dog); signal.removeEventListener("abort", onOuter); if (slot) slot.cut = null; }
    item.streaming = false;
    const toolCalls = calls.filter((c) => c && c.name).map((c) => ({ id: c.id || "call_" + uid(), name: c.name, args: c.args }));
    // a 200 with nothing in it (router lost the upstream, or a broken provider) is a failure, not "the model is done"
    if (!item.text.trim() && !toolCalls.length && finish !== "length") { if (shown) { item.streaming = false; upsert(s, item); } throw Object.assign(new Error(`ردّ فارغ من ${body.model}`), { status: 502, empty: true }); }
    const counted = account(s, usage, body.model);
    if (counted) { s.ctx = { used: counted.prompt + counted.completion, max: info.context_length || s.ctx.max || 200000 }; item.tokens = counted.completion; }
    if (shown || !toolCalls.length) upsert(s, item);
    pushUsage(s);
    const message = { role: "assistant", content: item.text || (toolCalls.length ? null : "") };
    if (toolCalls.length) message.tool_calls = toolCalls.map((c) => ({ id: c.id, type: "function", function: { name: c.name, arguments: c.args || "{}" } }));
    if (rdetails.length) message.reasoning_details = rdetails;
    return { message, toolCalls, finish, item };
  }

  /* ---------- the expert: a much stronger model consulted sparingly ---------- */

  const tail = (s, n) => s.messages.slice(-n).map((m) => {
    const text = typeof m.content === "string" ? m.content : Array.isArray(m.content) ? m.content.map((p) => p.text || "").join(NLCH) : "";
    const calls = (m.tool_calls || []).map((c) => `[${c.function.name} ${String(c.function.arguments).slice(0, 700)}]`).join(NLCH);
    return `${m.role.toUpperCase()}: ${text.slice(0, 2500)}${calls ? NLCH + calls : ""}`;
  }).join(NLCH + NLCH);

  async function askExpert(s, question, signal, kind = "advice") {
    const st = store.settings(); let model = st.expertModel || "anthropic/claude-opus-5.5";
    if (!/openrouter\.ai/.test(st.baseUrl || "openrouter.ai")) {   // own server: the configured expert may not exist there (e.g. no Anthropic credentials in OmniRoute)
      const have = new Set(((store.models && store.models().list) || []).map((m) => m.id));
      // never consult a model that just failed (it would cost the user ~20 s of a router trying dead providers)
      if (!have.has(model) || isBad(model)) { model = ["auto/best-reasoning", "auto/pro-reasoning", "auto/pro-coding", "auto/best-coding"].find((id) => have.has(id) && id !== s.model && !isBad(id)) || ""; }
      if (!model) { s._noExpert = true; throw new Error("لا يوجد نموذج خبير متاح على هذا السيرفر — اختر واحداً من الإعدادات ← النماذج والخبير"); }
    }
    emit({ t: "activity", sid: s.id, text: kind === "blueprint" ? "الخبير يضع الخطة…" : "استشارة الخبير…" });
    let listing = ""; try { listing = fs.readdirSync(s.cwd).filter((n) => !/^(node_modules|\.git)$/.test(n)).slice(0, 60).join(", "); } catch {}
    const sys = kind === "blueprint"
      ? "You are a principal engineer briefing a fast but junior coding agent that will do the typing. Produce a compact, decisive build blueprint it can follow literally: stack choice, exact file list, data model/state shape, the functions each file needs (names + one-line purpose), full code for any genuinely tricky algorithm, the exact run/verify steps, and the 3 pitfalls most likely to break it. No alternatives, no explanations of basics, no fluff. Under 700 words plus code."
      : "You are a principal engineer helping a junior coding agent that is stuck. Diagnose the real cause from the evidence and give the exact fix: which file, what to replace with what (show code). Be decisive and brief. If the approach itself is wrong, say what to do instead.";
    if (s._lite) { s._noExpert = true; throw new Error("تم تخطّي الخبير: المزوّد الحالي لا يتحمّل طلبات كبيرة"); }
    const r = await request({ model, max_tokens: 3000, usage: { include: true }, messages: [{ role: "system", content: sys },
      { role: "user", content: `Workspace: ${s.cwd}${NLCH}Files at the root: ${listing || "(empty)"}${NLCH}Agent tools: read/write/edit files, run commands, serve_static/start_server with an in-app preview, use_template (${library.templates().map((t) => t.name).join(", ")}).${NLCH}${NLCH}${question}` }] }, AbortSignal.any([signal, AbortSignal.timeout(90000)]));
    const j = await r.json();
    const text = j.choices && j.choices[0] && j.choices[0].message && j.choices[0].message.content;
    const cost = j.usage && typeof j.usage.cost === "number" ? j.usage.cost : 0;
    account(s, j.usage, model); pushUsage(s);
    if (!text) throw new Error((j.error && j.error.message) || "empty answer");
    notice(s, `${kind === "blueprint" ? "وضع الخبير خطة البناء" : "تدخّل الخبير"} (${model.split("/").pop()} · $${cost.toFixed(4)})`, "ok");
    return text;
  }

  /* ---------- permissions ---------- */

  const cmdKey = (cmd) => String(cmd).trim().split(/\s+/).slice(0, 2).join(" ").toLowerCase();

  function approvalNeeded(s, name, a) {
    if (name === "delegate") return null;
    const kind = tools.kindOf(name);
    if (kind === "read") return null;
    if (kind === "write") {
      if (name.startsWith("project_")) {
        if (s.perm === "ask" && !s.allow.tools.includes(name)) return { reason: "تعديل نسخة التطوير الخاصة بمشروع Antillusion" };
        return null;
      }
      const ends = [a.path, a.source, a.destination].filter((x) => x != null);
      if (!ends.length) ends.push(".");
      if (ends.some((p) => !tools.isInside(s.cwd, tools.resolveIn(s.cwd, p)))) return { reason: "الملف خارج مجلد المشروع", danger: true };
      if (s.perm === "ask" && !s.allow.tools.includes(name)) return { reason: name === "delete_file" ? "حذف ملف/مجلد" : "تعديل ملف" };
      return null;
    }
    const cmd = a.command || "";
    if (name === "run_command" || name === "start_server") {
      if (tools.isDangerous(cmd)) return { reason: "أمر قد يكون خطِراً أو لا يمكن التراجع عنه", danger: true };
      if (a.cwd && !tools.isInside(s.cwd, tools.resolveIn(s.cwd, a.cwd))) return { reason: "تنفيذ خارج مجلد المشروع", danger: true };
      if (s.perm === "auto" || s.allow.cmds.includes(cmdKey(cmd))) return null;
      return { reason: name === "start_server" ? "تشغيل خادم محلي" : "تنفيذ أمر" };
    }
    if (name === "serve_static" && a.dir && !tools.isInside(s.cwd, tools.resolveIn(s.cwd, a.dir))) return { reason: "استعراض مجلد خارج المشروع", danger: true };
    if (s.perm === "auto" || s.allow.tools.includes(name) || name === "stop_server") return null;
    return { reason: "تشغيل خادم محلي" };
  }

  function askUser(s, item, need) {
    return new Promise((resolve) => {
      const reqId = uid();
      waiting.set(reqId, { sid: s.id, resolve });
      item.status = "pending"; item.perm = { reqId, reason: need.reason, danger: !!need.danger, key: item.name === "run_command" || item.name === "start_server" ? cmdKey(item.args.command) : null };
      upsert(s, item);
      emit({ t: "attention", sid: s.id });
    });
  }

  function replyPermission(reqId, decision, note) {
    const w = waiting.get(reqId); if (!w) return false;
    waiting.delete(reqId); w.resolve({ decision, note }); return true;
  }

  /* ---------- tools ---------- */

  async function execTool(s, tc, signal) {
    let args; const item = { id: uid(), kind: "tool", name: tc.name, args: {}, status: "running", output: "", at: Date.now() };
    try { args = tc.args ? JSON.parse(tc.args) : {}; if (!args || typeof args !== "object" || Array.isArray(args)) throw new Error("not an object"); }
    catch (e) {
      item.status = "error"; item.output = "وسائط غير صالحة من النموذج"; upsert(s, item);
      return `Invalid JSON arguments for ${tc.name} (${e.message}). If the content was long it was probably cut off — write the file in smaller pieces (create it with write_file, then extend with edit_file).`;
    }
    item.args = args;
    if (!tools.kindOf(tc.name)) { item.status = "error"; upsert(s, item); return `Unknown tool ${tc.name}.`; }
    if (s.mode !== "agent" && tools.kindOf(tc.name) !== "read") { item.status = "denied"; item.output = "غير متاح في هذا الوضع"; upsert(s, item); return `${tc.name} is disabled in ${s.mode} mode. Describe what you would do instead; the user can switch to Code mode.`; }

    const need = approvalNeeded(s, tc.name, args);
    if (need) {
      const ans = await askUser(s, item, need);
      delete item.perm;
      if (ans.decision === "deny") {
        item.status = "denied"; item.output = ans.note || ""; upsert(s, item);
        return `The user denied this ${tc.name} call.${ans.note ? ` Their note: "${ans.note}".` : ""} Do not retry it in another form; adapt your approach or ask what they would prefer.`;
      }
      if (ans.decision === "always") { const k = (tc.name === "run_command" || tc.name === "start_server") ? cmdKey(args.command) : null; if (k) s.allow.cmds.push(k); else s.allow.tools.push(tc.name); }
    }
    item.status = "running"; upsert(s, item);

    let lastTick = 0, live = "";
    const ctx = {
      sid: s.id, cwd: s.cwd, signal, settings: store.settings(), shell: store.settings().shell, ui, libraryDirs: libDirs(s),
      progress: (t) => { live = (live + t).slice(-2500); const now = Date.now(); if (now - lastTick > 250) { lastTick = now; emit({ t: "progress", sid: s.id, id: item.id, tail: live }); } },
      changed: (c) => {
        const big = (x) => x !== null && x !== undefined && x.length > 400000;
        if (!big(c.before)) (s.checkpoints || (s.checkpoints = {}))[item.id] = { path: c.path, before: c.before };
        const count = (x) => (x ? x.split("\n").length : 0);
        item.diff = c.kind === "edit" ? { kind: "edit", path: c.path, del: c.oldS.slice(0, 6000), add: c.newS.slice(0, 6000), plus: count(c.newS), minus: count(c.oldS) }
          : { kind: c.kind, path: c.path, add: c.after.slice(0, 6000), plus: count(c.after), minus: count(c.before), more: c.after.length > 6000 };
        item.canRevert = !big(c.before);
      },
      setTodos: (todos) => { s.todos = todos; emit({ t: "todos", sid: s.id, todos }); },
      askExpert: store.settings().expert ? (q) => askExpert(s, `Recent conversation:${NLCH}${tail(s, 8)}${NLCH}${NLCH}The agent asks: ${q}`, signal).catch((e) => `The expert could not be reached: ${e.message}`) : null,
    };
    // identical call repeated? stop the loop instead of paying for it again
    const sig = tc.name + ":" + tc.args, rep = (s._seen || (s._seen = new Map()));
    rep.set(sig, (rep.get(sig) || 0) + 1);
    if (rep.get(sig) >= 3 && tools.kindOf(tc.name) !== "read") { item.status = "error"; item.output = "نداء مكرَّر — أُوقف"; upsert(s, item); return "You have made this exact call 3 times. It will not behave differently. Stop repeating it: re-read the relevant file, change the approach, or finish and tell the user what is blocking you."; }
    let out = tc.name === "delegate" ? await runTeam(s, args, signal) : await tools.runTool(tc.name, args, ctx);
    const failed = /SYNTAX CHECK FAILED|^(Tool error|old_string|Could not|Timed out|The process ended|Preview error)|console errors \(\d+\)|LOAD FAILED|\[exit code (?!0\])\S+\]\s*$/.test(out);
    s._fails = failed ? (s._fails || 0) + 1 : 0;
    if (s._fails >= 3 && store.settings().expert && !s._noExpert && !signal.aborted) {   // three failures in a row: bring in the senior
      s._fails = 0;
      try { out += `${NLCH}${NLCH}<expert_advice>${NLCH}${await askExpert(s, `The agent has failed 3 steps in a row. Recent conversation:${NLCH}${tail(s, 10)}${NLCH}${NLCH}Latest tool result (${tc.name}):${NLCH}${out.slice(0, 4000)}`, signal)}${NLCH}</expert_advice>${NLCH}Follow the expert's advice exactly.`; } catch {}
    }
    item.status = /SYNTAX CHECK FAILED/.test(out) || /^(Tool error|File not found|old_string|Could not|Invalid|Missing required|Timed out|Port \d+ is already|The process ended|Preview error|Not a directory|Unknown)/.test(out) || /\[exit code (?!0\])\S+\]\s*$/.test(out) ? "error" : "ok";
    item.output = out.length > 12000 ? out.slice(0, 8000) + "\n…\n" + out.slice(-3500) : out;
    upsert(s, item);
    return out;
  }

  /* ---------- context window ---------- */

  async function compact(s, signal, manual) {
    const keepFrom = (() => {   // keep the most recent exchange verbatim; the cut must land on an assistant turn or a user turn
      for (let i = s.messages.length - 5; i > 1; i--) if (s.messages[i].role === "assistant" || s.messages[i].role === "user") return i;
      return manual ? s.messages.length : -1;
    })();
    if (keepFrom < 2) { if (manual) notice(s, "السياق قصير — لا حاجة للضغط الآن."); return false; }
    const old = s.messages.slice(0, keepFrom);
    const render = old.map((m) => {
      const text = typeof m.content === "string" ? m.content : Array.isArray(m.content) ? m.content.map((p) => p.text || `[${p.type}]`).join("\n") : "";
      if (m.role === "tool") return `[tool result] ${text.slice(0, 1500)}`;
      const calls = (m.tool_calls || []).map((c) => `[called ${c.function.name} ${String(c.function.arguments).slice(0, 500)}]`).join("\n");
      return `${m.role.toUpperCase()}: ${text.slice(0, 6000)}${calls ? "\n" + calls : ""}`;
    }).join("\n\n").slice(-350000);
    const working = notice(s, "جارٍ ضغط السياق…");
    const before = s.ctx.used || estTokens(s.messages);
    const r = await request({
      model: s.model, max_tokens: 6000, usage: { include: true },
      messages: [{ role: "system", content: "You compress a coding-agent conversation so the work can continue seamlessly in a fresh context window. Output only the summary." },
        { role: "user", content: `Summarise the conversation below for your own future use. Be specific and complete; this replaces the original. Use these sections:\n1. User's goal and explicit requirements/preferences (quote key phrases)\n2. What has been done — every file created or modified with its path and purpose, and important code decisions\n3. Commands run and their relevant outcomes; servers started (id, URL)\n4. Errors hit and how they were fixed\n5. Current state and exactly what was being worked on last\n6. Remaining steps\n\n<conversation>\n${render}\n</conversation>` }],
    }, signal);
    const j = await r.json();
    const summary = j.choices && j.choices[0] && j.choices[0].message && j.choices[0].message.content;
    if (!summary) throw new Error("فشل ضغط السياق: لم يُرجِع النموذج ملخصاً.");
    account(s, j.usage, s.model);
    s.messages = [{ role: "user", content: `[Context was compacted. Summary of the conversation so far:]\n\n${summary}` },
      ...(s.messages[keepFrom] && s.messages[keepFrom].role === "user" ? [{ role: "assistant", content: "Understood — continuing from that state." }] : []), ...s.messages.slice(keepFrom)];
    s.ctx.used = estTokens(s.messages) + 4000; s.compactions = (s.compactions || 0) + 1;
    working.text = `تم ضغط السياق: ${Math.round(before / 1000)}k ← ${Math.round(s.ctx.used / 1000)}k رمز`; working.level = "ok"; upsert(s, working);
    pushUsage(s); store.saveSession(s);
    return true;
  }

  async function maybeCompact(s, signal) {
    const st = store.settings(), max = (store.modelInfo(s.model) || {}).context_length || s.ctx.max || 200000;
    s.ctx.max = max;
    const used = Math.max(s.ctx.used || 0, estTokens(s.messages));
    if (used > max * ((st.compactAt || 80) / 100) - (st.maxTokens || 16000)) await compact(s, signal, false);
  }

  /* ---------- Antillusion Code: repository map, verification, the team ---------- */

  /** A compact map of the workspace: tree (depth 3), package scripts/deps, README head. Cached per run. */
  function repoMap(cwd) {
    const lines = [], SKIP = /^(node_modules|\.git|dist|build|out|\.next|\.cache|coverage|__pycache__|venv|\.venv|target|\.antillusion)$/;
    let count = 0;
    const walk = (d, depth, pre) => {
      if (depth > 3 || count > 140) return;
      let ents; try { ents = fs.readdirSync(d, { withFileTypes: true }).filter((e) => !e.name.startsWith(".") || e.name === ".env.example").sort((a, b) => (b.isDirectory() - a.isDirectory()) || a.name.localeCompare(b.name)); } catch { return; }
      for (const e of ents) {
        if (++count > 140) { lines.push(pre + "…"); return; }
        if (e.isDirectory()) { if (SKIP.test(e.name)) { lines.push(`${pre}${e.name}/ (skipped)`); continue; } lines.push(`${pre}${e.name}/`); walk(path.join(d, e.name), depth + 1, pre + "  "); }
        else { let sz = 0; try { sz = fs.statSync(path.join(d, e.name)).size; } catch {} lines.push(`${pre}${e.name}${sz > 2048 ? ` (${Math.round(sz / 1024)}k)` : ""}`); }
      }
    };
    walk(cwd, 1, "");
    let extra = "";
    try { const pkg = JSON.parse(fs.readFileSync(path.join(cwd, "package.json"), "utf8")); extra += `\npackage.json: ${pkg.name || ""} · scripts: ${Object.keys(pkg.scripts || {}).join(", ") || "-"} · deps: ${Object.keys({ ...pkg.dependencies, ...pkg.devDependencies }).slice(0, 30).join(", ") || "-"}`; } catch {}
    try { const rd = fs.readFileSync(path.join(cwd, "README.md"), "utf8").split(/\r?\n/).filter(Boolean).slice(0, 8).join(" / "); if (rd) extra += `\nREADME: ${rd.slice(0, 500)}`; } catch {}
    return `# Repository map (${cwd})\n${lines.length ? lines.join("\n") : "(empty folder — a new project)"}${extra}`.slice(0, 5000);
  }

  function runTests(cmd, cwd) {
    return new Promise((resolve) => require("child_process").exec(cmd, { cwd, timeout: 180000, maxBuffer: 4 << 20, windowsHide: true, env: { ...process.env, CI: "1", FORCE_COLOR: "0" } },
      (e, so, se) => resolve({ code: e ? (typeof e.code === "number" ? e.code : 1) : 0, out: String(so) + String(se) })));
  }

  /** Runs when the model says it is done. Problems found → they go back to the model and the run continues (max 3 rounds). */
  async function verifyGate(s, signal, since) {
    const st = store.settings(), code = s.kind === "code";
    if (st.verify === false || s.mode !== "agent" || s.worker || (s._verifyRounds || 0) >= 3) return false;
    const card = { id: uid(), kind: "verify", status: "running", checks: [], round: (s._verifyRounds || 0) + 1, at: Date.now() };
    if (code) upsert(s, card);
    emit({ t: "activity", sid: s.id, text: "يختبر العمل قبل التسليم…" });
    let r;
    try { r = await verifyLib.verifyWorkspace({ cwd: s.cwd, since, syntaxCheck: tools.syntaxCheck, verifyPage: code && ui && ui.verifyPage, runTests: code ? runTests : null, level: code ? "full" : "static", signal }); }
    catch (e) { if (signal.aborted) throw abortErr(); r = { checks: [], problems: [], files: [] }; }
    if (!r.files.length) { if (code) { card.status = "skip"; upsert(s, card); } return false; }
    card.checks = r.checks; card.files = r.files.length; card.status = r.problems.length ? "fail" : "ok"; card.problems = r.problems.map((p) => p.split("\n")[0].slice(0, 220));
    if (code || r.problems.length) upsert(s, card);
    if (!r.problems.length) return false;
    s._verifyRounds = (s._verifyRounds || 0) + 1;
    s.messages.push({ role: "user", content: `[Automatic verification — round ${s._verifyRounds} of 3] Antillusion checked the files you changed and found problems. Fix every one now (read the files involved first), then finish with a short summary.\n\n${r.problems.join("\n\n")}` });
    return true;
  }

  /** delegate tool: 2–4 workers build separate files in parallel, each on the best available model; returns their reports. */
  async function runTeam(s, args, signal) {
    const tasks = Array.isArray(args.tasks) ? args.tasks.filter((t) => t && t.instructions).slice(0, 4) : [];
    if (tasks.length < 2) return "delegate needs 2–4 tasks, each with title, instructions and the files it owns. For a single task just do it yourself.";
    let models = ranked("code").slice(0, 6); if (!models.length) models = [s._cur || s.model];
    const team = { id: uid(), kind: "team", workers: tasks.map((t) => ({ title: String(t.title || "مهمة"), files: (t.files || []).map(String), status: "queued", model: "", steps: 0, last: "" })), at: Date.now() };
    upsert(s, team);
    let lastPush = 0;
    const push = (force) => { const now = Date.now(); if (force || now - lastPush > 350) { lastPush = now; upsert(s, { ...team, workers: team.workers.map((w) => ({ ...w })) }); } };
    const results = new Array(tasks.length); let next = 0;
    const lane = async () => { while (next < tasks.length && !signal.aborted) { const i = next++; results[i] = await runWorker(s, tasks[i], String(args.context || ""), i, models, team.workers[i], push, signal); } };
    await Promise.all(Array.from({ length: Math.min(3, tasks.length) }, lane));
    if (signal.aborted) throw abortErr();
    team.done = true; push(true);
    return results.map((r, i) => `### Worker ${i + 1}: ${tasks[i].title} — ${r.ok ? "done" : "FAILED"} (model ${team.workers[i].model})\nOwned files: ${(tasks[i].files || []).join(", ")}\n${r.summary}`).join("\n\n")
      + "\n\nNext: read the key files, make sure the parts fit (imports, exported names, element ids, events), fix mismatches, finish anything a worker left undone, then stop — verification runs automatically.";
  }

  async function runWorker(parent, task, context, i, models, w, push, signal) {
    const child = { id: parent.id, kind: "worker", worker: true, title: parent.title, cwd: parent.cwd, baseCwd: parent.baseCwd, mode: "agent", perm: parent.perm, allow: parent.allow, effort: parent.effort,
      model: models[i % models.length], messages: [], log: [], todos: [], checkpoints: parent.checkpoints || (parent.checkpoints = {}), usage: parent.usage, ctx: { used: 0, max: 0 }, _seen: new Map(), _fails: 0, _noExpert: true };
    const files = (task.files || []).map((f) => "- " + f).join("\n") || "- (decide the file names yourself and list them in your summary)";
    child.messages.push({ role: "user", content: `You are worker ${i + 1} of a team building one project in ${parent.cwd}. A lead engineer planned the work and will integrate everyone's files.\n\n# Shared context\n${context || "(none)"}\n\n# Your task: ${task.title}\n${task.instructions}\n\n# Files you own — create/edit ONLY these\n${files}\n\nWork fast and completely: write your files (each write under ~150 lines; split big files into several writes), no placeholders. Do not start servers or previews — the lead verifies the whole project. Then reply with a 3–6 line summary: what you built, the exact names/interfaces other files rely on, and anything left undone.` });
    w.status = "running"; w.model = child.model; push(true);
    const forwarded = new Set();
    const ctx = { emit: (ev) => {
      if (ev.t !== "item") return;
      const it = ev.item;
      if (it.kind === "tool") {
        if (it.perm || forwarded.has(it.id)) { forwarded.add(it.id); rootEmit(ev); }   // approvals still reach the user
        w.last = `${it.name} ${(it.args && (it.args.path || it.args.command || it.args.pattern || "")) || ""}`.slice(0, 90); if (it.status === "error") w.errors = (w.errors || 0) + 1; push();
      } else if (it.kind === "assistant" && it.text) { w.say = it.text.slice(-140); push(); }
    } };
    return als.run(ctx, async () => {
      let summary = "", tries = 0;
      for (let step = 0; step < 30 && !signal.aborted; step++) {
        let res; const t0 = Date.now();
        try { res = await complete(child, signal); router.record(child.model, { ok: true, ms: Date.now() - t0, cut: res.finish === "length" }); }
        catch (e) {
          if (signal.aborted || e.name === "AbortError") throw abortErr();
          const why = classify(e); router.record(child.model, { ok: false, kind: why.kind }); bad.set(child.model, Date.now() + why.ms);
          if (!child._lite && (e.status === 413 || SIZE_ERR.test(String(e.message)))) { child._lite = true; step--; continue; }
          if (++tries > 3) { w.status = "error"; w.last = why.label; push(true); return { ok: false, summary: "Worker could not reach a working model: " + why.label + ". Do this task yourself." }; }
          child.model = ranked("code", [child.model])[0] || models[(i + tries) % models.length]; w.model = child.model; push(true); step--; continue;
        }
        if (res.finish === "length" && !res.toolCalls.length && !String(res.message.content || "").trim()) { child._boost = Math.min(store.settings().maxTokens || 32000, (child._boost || 8192) * 2); step--; continue; }
        child.messages.push(res.message);
        if (!res.toolCalls.length) { summary = String(res.message.content || "").trim(); break; }
        w.steps++; push();
        for (const tc of res.toolCalls) {
          if (signal.aborted) break;
          const out = await execTool(child, tc, signal).catch((e) => "Tool error: " + e.message);
          child.messages.push({ role: "tool", tool_call_id: tc.id, content: out });
        }
      }
      w.status = signal.aborted ? "stopped" : "done"; push(true);
      return { ok: true, summary: summary || "(finished without a summary)" };
    });
  }

  /* ---------- the loop ---------- */

  async function run(s) {
    const ac = new AbortController();
    running.set(s.id, { ac, cut: null });
    emit({ t: "status", sid: s.id, running: true });
    const st = store.settings();
    s._alt = 0; s._cur = null; let scouted = false; s._lengthRetries = 0; s._contRetries = 0; s._verifyRounds = 0;
    const runStart = Date.now();
    if (s.kind === "code") s._repoMap = repoMap(s.cwd);
    const ownSrv = !/openrouter\.ai/.test(st.baseUrl || "openrouter.ai");
    if (ownSrv && isBad(s.model)) {   // it failed a moment ago: start on a working one instead of waiting for it to fail again
      const next = fallbackOrder(s)[0];
      if (next && next !== s.model) { s._cur = next; notice(s, `${s.model} تعطّل قبل قليل — يستخدم ${next} مؤقتاً (يعود إليه تلقائياً بعد دقائق، أو اختره يدوياً).`, "warn"); }
    }
    try {
      for (let step = 0; step < (st.maxSteps || 80); step++) {
        await maybeCompact(s, ac.signal);
        if (s._blueprint && st.expert && !s._noExpert && s.mode === "agent") {
          const ask = s._blueprint; s._blueprint = null;
          try {
            const plan = await askExpert(s, `The user asked:${NLCH}${ask}`, ac.signal, "blueprint");
            const last = s.messages[s.messages.length - 1];
            if (last && last.role === "user") { const add = `${NLCH}${NLCH}<expert_blueprint>${NLCH}${plan}${NLCH}</expert_blueprint>${NLCH}Build this now, following the blueprint. Do not re-plan.`; if (typeof last.content === "string") last.content += add; else last.content[0].text += add; }
          } catch (e) { if (ac.signal.aborted) throw e; s._noExpert = true; notice(s, `تخطّيتُ خطة الخبير (${classify(e).label}) — أكمل بالنموذج المتاح.`, "info", { detail: String(e.message).slice(0, 2000) }); }
        }
        let res;
        const own = !/openrouter\.ai/.test(st.baseUrl || "openrouter.ai");
        const tried = [], trail = [];
        let route = null, waits = 0;
        // one notice per step that grows as models are tried (instead of a wall of warnings), then settles into a one-line summary
        const showRoute = (level, text, extra = {}) => { route = upsert(s, { id: route ? route.id : uid(), kind: "notice", route: trail.map(({ raw, ...x }) => x), level, text, at: Date.now(), ...extra }); };
        for (let attempt = 0, switches = 0; ; attempt++) {
          const t0 = Date.now(), using = own ? s._cur || s.model : s.model;
          try {
            res = await complete(s, ac.signal); if (!own) s._alt = 0;
            noteHealth(using, true, { ms: Date.now() - t0 });
            router.record(using, { ok: true, ms: Date.now() - t0, cut: res.finish === "length", toolsOk: !res.toolCalls.some((tc) => { try { JSON.parse(tc.args || "{}"); return false; } catch { return true; } }) });
            if (route) showRoute("info", `أُكمل بـ ${using} بعد تعذّر ${trail.map((x) => x.model).join("، ")}`, { detail: route.detail, settled: true });
            break;
          }
          catch (e) {   // upstream failed: try again on the next model (OpenRouter free models, or the next model the own server offers)
            if (ac.signal.aborted || e.name === "AbortError") throw e;
            if (e.switched) {   // the user picked another model mid-request: retry right away on it
              s._cur = null; tried.length = 0; attempt = -1;
              if (++switches > 20) throw new Error("تم إلغاء الطلب بعد تبديلات كثيرة.");
              notice(s, `تم التبديل إلى ${s.model} — يعيد المحاولة الآن…`, "info"); continue;
            }
            // "request too large" (small context / per-minute token limits on free tiers): same model again, compact request
            if (!s._lite && (e.status === 413 || SIZE_ERR.test(String(e.message)) || /Stream ended before producing/i.test(String(e.message)))) {
              s._lite = true; attempt--;
              const who = own ? s._cur || s.model : s.model;
              showRoute("warn", `الطلب أكبر من حدّ المزوّد لـ ${who} — أعيد المحاولة فوراً بنسخة مختصرة…`, { detail: String(e.message).slice(0, 2000) });
              continue;
            }
            const st2 = e.status;
            // the server itself is unreachable: every model would fail the same way, so don't blame (and blacklist) them
            const switchable = e.conn ? false : own ? (!st2 || st2 >= 500 || [401, 402, 403, 404, 408, 429].includes(st2) || /\[\d{3}\]/.test(e.message)) : (!st2 || st2 >= 500 || st2 === 408 || st2 === 429);
            const from = own ? s._cur || s.model : s.model, why = classify(e);
            if (switchable) { trail.push({ model: from, reason: why.label, kind: why.kind, raw: String(e.message).slice(0, 4000) }); noteHealth(from, false, why); router.record(from, { ok: false, kind: why.kind }); }
            if (own && switchable) { tried.push(from); bad.set(from, Date.now() + why.ms); }
            const next = own ? fallbackOrder(s, tried)[0] : null;
            const limit = own ? 5 : 2;
            if (!switchable || attempt >= limit - 1 || (own && !next)) {
              // every model is only rate-limited / cooling down: wait it out once or twice instead of giving up
              if (own && switchable && trail.length && trail.every((x) => x.kind === "cooldown") && waits < 2) {
                const secs = store.settings().cooldownWait || Math.min(90, +((String(e.message).match(/retry.{0,12}?(\d+)\s*s/i) || [])[1] || 0) || 25 * (waits + 1));
                waits++;
                for (const x of tried) bad.delete(x);
                tried.length = 0; s._cur = null; attempt = -1;
                showRoute("warn", `كل النماذج في فترة تبريد عند المزوّد — أعيد المحاولة تلقائياً بعد ${secs} ثانية…`, { detail: String(e.message).slice(0, 2000) });
                for (let i = secs; i > 0; i--) { emit({ t: "activity", sid: s.id, text: `فترة تبريد — إعادة المحاولة بعد ${i} ث` }); await sleep(1000, ac.signal); }
                continue;
              }
              // the router's own combos are exhausted: find models that answer right now and carry on with them
              if (own && switchable && !scouted && store.models) {
                scouted = true;
                const all = (store.models().list || []).filter((m) => !tried.includes(m.id) && !isBad(m.id));
                if (scoutLib.candidates(all, { max: 1 }).length) {
                  const st3 = store.settings(), base = (st3.baseUrl || "").replace(/\/+$/, "");
                  showRoute("warn", "المسارات المعتادة متعطّلة — أبحث عن نماذج تعمل الآن لدى مزوّديك…", { detail: route && route.detail });
                  const res = await scoutLib.scout({ baseUrl: base, key: getKey(), models: all, max: st3.scoutMax || 30, timeoutMs: (st3.scoutTimeout || 25) * 1000, signal: ac.signal,
                    onProgress: (p) => { showRoute("warn", `أبحث عن نماذج تعمل الآن لدى مزوّديك… ${p.done}/${p.total}${p.ok ? ` · وجدت ${p.ok}` : ""}`, { detail: route && route.detail }); emit({ t: "activity", sid: s.id, text: `فحص النماذج ${p.done}/${p.total}` }); } });
                  if (ac.signal.aborted) throw abortErr();
                  for (const b of res.bad) bad.set(b.id, Date.now() + 5 * 60e3);
                  store.setSettings({ scout: { at: res.at, ok: res.ok.map((x) => ({ id: x.id, ms: x.ms })), bad: res.bad.slice(0, 60).map((x) => ({ id: x.id, reason: x.reason, code: x.code })) } });
                  emit({ t: "scout", result: store.settings().scout });
                  if (res.ok.length) {
                    s._cur = res.ok[0].id; attempt = -1;
                    showRoute("warn", `وجدت ${res.ok.length} نموذجاً يعمل — أكمل بـ ${s._cur} (${(res.ok[0].ms / 1000).toFixed(1)} ث)…`, { detail: route && route.detail });
                    continue;
                  }
                }
              }
              const sum = summarizeProviderError(e.message);
              const diag = mergeDiag(trail.map((x) => x.raw).concat(String(e.message)));
              const tail = trail.length > 1 ? { detail: (sum ? sum.detail : String(e.message)) + "\n\nجُرّب: " + trail.map((x) => `${x.model} (${x.reason})`).join("، ") } : sum ? { detail: sum.detail } : {};
              if (route) route.level = "warn";
              const scoutNote = scouted ? " فحصتُ بقية النماذج المتاحة أيضاً ولم يستجب أيّ منها." : "";
              if (sum) throw Object.assign(new Error(sum.text + scoutNote), { ...tail, providerError: true, route: trail.slice().map(({ raw, ...x }) => x), diag });
              if (own && switchable) throw Object.assign(new Error(`${why.label}: ${String(e.message).slice(0, 160)} — لم يعد هناك نموذج بديل يعمل.${scoutNote} جرّب نموذجاً آخر أو تحقق من OmniRoute.`), { ...tail, providerError: true, route: trail.slice().map(({ raw, ...x }) => x), diag });
              throw e;
            }
            if (own) s._cur = next; else { s._alt = (s._alt || 0) + 1; s._chunkHint = true; }
            const sum = summarizeProviderError(e.message);
            if (own) showRoute("warn", `تعذّر ${from} (${why.label}) — أكمل بـ ${next}…`, { detail: sum ? sum.detail : String(e.message).slice(0, 2000) });
            else notice(s, "انقطع ردّ المزوّد — إعادة المحاولة بنموذج بديل وعلى دفعات أصغر…", "warn");
          }
        }
        // cut at the length limit: never stop there. Nothing usable (all thinking) or a half-written tool call → redo the step
        // with a bigger budget (and smaller writes); partial text → ask the model to continue where it stopped.
        if (res.finish === "length") {
          const txt = String(res.message.content || "").trim();
          const broken = res.toolCalls.filter((tc) => { try { JSON.parse(tc.args || "{}"); return false; } catch { return true; } });
          const cap = st.maxTokens || 32000, cur = s._boost || 8192;
          if ((!txt && !res.toolCalls.length) || broken.length) {
            if ((s._lengthRetries = (s._lengthRetries || 0) + 1) <= 3) {
              s._boost = Math.min(cap, Math.max(cur * 2, 16000));
              if (broken.length) s._chunkHint = true;
              notice(s, broken.length ? `انقطع ملف أثناء كتابته — أعيد هذه الخطوة على دفعات أصغر وبمساحة ${Math.round(s._boost / 1000)}k رمز…` : `استهلك النموذج مساحة الرد في التفكير قبل أن يجيب — أعيد المحاولة بمساحة ${Math.round(s._boost / 1000)}k رمز…`, "info");
              step--; continue;
            }
          } else if (!res.toolCalls.length && (s._contRetries = (s._contRetries || 0) + 1) <= 4) {
            s.messages.push(res.message, { role: "user", content: "[Your reply was cut off by the length limit. Continue exactly where you stopped — do not repeat anything already written.]" });
            step--; continue;
          }
          if (s._lengthRetries > 3 || s._contRetries > 4) notice(s, "انقطع ردّ النموذج عند حدّ الطول عدة مرات — ارفع «أقصى طول للرد» من الإعدادات أو اختر نموذجاً أقوى.", "warn");
          if (!txt && !res.toolCalls.length) break;
        }
        s._lengthRetries = 0; s._contRetries = 0;
        s.messages.push(res.message);
        if (!res.toolCalls.length) { if (await verifyGate(s, ac.signal, runStart)) continue; break; }
        emit({ t: "activity", sid: s.id, text: "ينفّذ الأدوات…" });
        const one = async (tc) => { if (ac.signal.aborted) return "Interrupted by the user before this tool ran."; try { return await execTool(s, tc, ac.signal); } catch (e) { return `Tool error: ${e.message}`; } };
        // Speed optimization: all read-only calls run concurrently in parallel, while write/exec tools run sequentially
        const hasMixedOrWrites = res.toolCalls.some((tc) => tools.kindOf(tc.name) !== "read");
        let outs = [];
        if (!hasMixedOrWrites && res.toolCalls.length > 1) {
          outs = await Promise.all(res.toolCalls.map(one));
          for (let i = 0; i < res.toolCalls.length; i++) s.messages.push({ role: "tool", tool_call_id: res.toolCalls[i].id, content: outs[i] });
        } else {
          for (let i = 0; i < res.toolCalls.length; i++) {
            const out = await one(res.toolCalls[i]);
            s.messages.push({ role: "tool", tool_call_id: res.toolCalls[i].id, content: out });
          }
        }
        store.saveSession(s);
        if (ac.signal.aborted) throw abortErr();
        if (st.sessionBudget > 0 && s.usage.cost >= st.sessionBudget) { notice(s, `توقّف الوكيل: بلغت الجلسة حدّ الإنفاق ($${st.sessionBudget}). ارفع الحد من الإعدادات ثم اكتب «أكمل».`, "warn"); break; }
        if (step === (st.maxSteps || 80) - 1) notice(s, "بلغ الوكيل الحدّ الأقصى للخطوات في دورة واحدة — اكتب «أكمل» للمتابعة.", "warn");
      }
    } catch (e) {
      if (e.name === "AbortError" || ac.signal.aborted) notice(s, "تم الإيقاف.");
      else notice(s, e.message || String(e), "error", e.providerError ? { detail: e.detail, actions: ["router", "model", "health"], route: e.route, diag: e.diag } : undefined);
      if (e.diag && e.diag.length) { lastDiag = { at: Date.now(), providers: e.diag }; emit({ t: "diag", diag: lastDiag }); }
    } finally {
      emit({ t: "activity", sid: s.id, text: "" });
      for (const [id, w] of waiting) if (w.sid === s.id) { waiting.delete(id); w.resolve({ decision: "deny" }); }
      for (const it of s.log) { if (it.streaming) { it.streaming = false; emit({ t: "item", sid: s.id, item: it }); } if (it.kind === "tool" && (it.status === "running" || it.status === "pending")) { it.status = "error"; delete it.perm; emit({ t: "item", sid: s.id, item: it }); } }
      running.delete(s.id); s.updated = Date.now(); store.saveSession(s);
      emit({ t: "status", sid: s.id, running: false });
    }
  }

  function send(sid, { text: rawText, attachments = [] }) {
    let text = rawText;
    const s = store.getSession(sid);
    if (!s) throw new Error("جلسة غير موجودة");
    if (running.has(sid)) throw new Error("الوكيل يعمل الآن — أوقفه أولاً أو انتظر.");
    const info = store.modelInfo(s.model) || {};
    const vision = ((info.architecture && info.architecture.input_modalities) || []).includes("image");
    let body = String(text || "");
    const parts = [];
    for (const a of attachments) {
      if (a.kind === "image") { if (vision) parts.push({ type: "image_url", image_url: { url: a.dataUrl } }); else notice(s, `النموذج الحالي لا يقرأ الصور — تم تجاهل ${a.name}.`, "warn"); }
      else if (a.kind === "text") body += `\n\n<attached_file name="${a.name}"${a.path ? ` path="${a.path}"` : ""}>\n${a.text}\n</attached_file>`;
      else if (a.kind === "ref") body += `\n\n[Attached file on disk: ${a.path} — read it with read_file if needed]`;
    }
    // skills: "/video …" forces one; otherwise a strong keyword match switches one on (once per session)
    const skillDirs = [store.dir && path.join(store.dir, "skills"), path.join(s.cwd, ".antillusion", "skills")];
    let skill = null, forced = false;
    const slash = text ? skills.parseSlash(String(text).trim(), skillDirs) : null;
    if (slash) { skill = slash.skill; forced = true; body = slash.rest || `(Use the "${skill.title}" skill. Ask me ONE short question about what to create, then proceed.)`; text = body; }
    else if (s.mode !== "ask" && text && String(text).length > 8) { const m = skills.match(String(text), skillDirs); if (m && !(s.skillsSent || []).includes(m.name)) skill = m; }
    if (skill) {
      const sent = s.skillsSent || (s.skillsSent = []), seenRefs = s.refsSent || (s.refsSent = []);
      if (forced || !sent.includes(skill.name)) {
        if (!sent.includes(skill.name)) sent.push(skill.name);
        body += `\n\n<skill name="${skill.name}" title="${skill.title}">\n${skill.body}\n</skill>`;
        let budget = 6000;
        for (const id of skill.refs) { if (seenRefs.includes(id) || budget < 1500) continue; const t = library.read(id, libDirs(s)); if (/^No playbook/.test(t)) continue; seenRefs.push(id); body += `\n\n<library_reference id="${id}">\n${t.slice(0, budget)}\n</library_reference>`; budget -= t.length; }
        if (skill.template && !seenRefs.includes("tpl:" + skill.template) && library.templates().some((t) => t.name === skill.template)) { seenRefs.push("tpl:" + skill.template); body += `\n\n<starter_template name="${skill.template}">This skill has a tested starter: call use_template("${skill.template}") first, then customise it with edit_file/multi_edit.</starter_template>`; }
        notice(s, `⚡ تم تفعيل قدرة: ${skill.title}${forced ? "" : " (تلقائياً)"}`, "ok");
      }
    }
    if (s.mode !== "ask" && text && String(text).length < 4000) {   // hand over the matching playbooks/template now: saves the model a search round-trip
      const ref = library.autoRefs(text, libDirs(s), skill ? 0 : s.messages.length ? 3000 : 4500), seen = s.refsSent || (s.refsSent = []);
      const fresh = ref.cards.filter((c) => !seen.includes(c.id));
      if (ref.template && !seen.includes("tpl:" + ref.template.name)) { seen.push("tpl:" + ref.template.name); body += `\n\n<starter_template name="${ref.template.name}">A tested starter matches this request: ${ref.template.title}. Call use_template("${ref.template.name}") first, then customise it with edit_file.</starter_template>`; }
      for (const c of fresh) { seen.push(c.id); body += `\n\n<library_reference id="${c.id}">\n${c.text}\n</library_reference>`; }
    }
    s._seen = new Map(); s._fails = 0;
    if (/antillusion|انتي ?[اإ]?يلوجن|انتي ?ايلوشن|كودك|نفسك|طور نفسك|طوّر نفسك|self[- ]?(improve|modify)/i.test(String(rawText || ""))) s.selfDev = true;
    s._blueprint = s.kind !== "code" && text && String(text).length > 8 && !/<starter_template/.test(body) && /(اعمل|ابن|انشئ|أنشئ|صمم|بدي|اريد|أريد|طور|برمج|سوي|build|create|make|implement|develop|write|add|design)/i.test(text) ? String(text) : null;
    s.messages.push({ role: "user", content: parts.length ? [{ type: "text", text: body || "(see attached)" }, ...parts] : body });
    upsert(s, { id: uid(), kind: "user", text: String(rawText || ""), attachments: attachments.map((a) => ({ name: a.name, kind: a.kind, thumb: a.kind === "image" ? a.dataUrl : undefined })), at: Date.now() });
    if (!s.titled && text) { s.title = String(text).replace(/[*_#>`|]+/g, "").replace(/^\s*[-•]?\s*(الهدف|Goal)\s*[:：/]?\s*/i, "").replace(/\s+/g, " ").trim().slice(0, 48) || "محادثة جديدة"; s.titled = true; emit({ t: "session", sid, meta: store.meta(s) }); }
    store.saveSession(s);
    run(s);   // deliberately not awaited: progress flows through emit()
    return true;
  }

  /** Turns a vague idea into a precise build brief (one non-streaming model call). Returns the text; the UI puts it back in the composer for the user to edit. */
  async function expandPrompt(sid, text) {
    const s = sid && store.getSession(sid), st = store.settings(), model = (s && s.model) || st.model;
    const raw = String(text || "").trim(); if (!raw) throw new Error("اكتب فكرتك أولاً");
    const dirs = [store.dir && path.join(store.dir, "skills"), s && path.join(s.cwd, ".antillusion", "skills")];
    const sl = skills.parseSlash(raw, dirs), skill = sl ? sl.skill : skills.match(raw, dirs, 6), idea = sl ? sl.rest || raw : raw;
    const sys = `You turn a rough idea into a precise, buildable brief for an AI coding agent. Reply in the SAME language as the idea (Arabic → Arabic). Output ONLY the brief, no preamble, at most ~230 words, as a short list with bold labels written ONLY in the idea's language — Arabic: الهدف · المستخدمون · الميزات الأساسية (3–7, must-have first) · التصميم والأسلوب · التقنية المقترحة (with a reason) · حالات خاصة · معايير القبول (checkable) · خارج النطاق; English: Goal · Users · Core features · Design & style · Suggested tech · Edge cases · Acceptance criteria · Out of scope. Keep every number, duration, name and constraint from the idea EXACTLY as written (never change 15 seconds into 5). Keep every constraint the user stated, make sensible defaults for the rest and mark them "(افتراضي)". Never invent brand names or facts. No code.${skill && skill.brief ? ` This request fits the "${skill.title}" skill — also cover: ${skill.brief}.` : ""}`;
    const r = await request({ model, max_tokens: 1200, usage: { include: true }, messages: [{ role: "system", content: sys }, { role: "user", content: idea }] }, AbortSignal.timeout(90000));
    const j = await r.json(), out = j.choices && j.choices[0] && j.choices[0].message && j.choices[0].message.content;
    if (s) { account(s, j.usage, model); pushUsage(s); }
    if (!out) throw new Error((j.error && j.error.message) || "لم يصل ردّ من النموذج");
    return (sl ? `/${skill.command} ` : "") + out.trim();
  }

  /** The user picked another model: it is trusted again, and a request stuck on the old one is cut so the run retries on the new one. */
  function switchModel(sid, model) {
    bad.delete(model); { const ss = store.getSession(sid); if (ss) ss._lite = false; } const h = health.get(model); if (h) emit({ t: "health", model, health: { ...h, until: 0 } });
    const s = store.getSession(sid); if (s) s._cur = null;
    const r = running.get(sid); if (r && r.cut) { r.cut("switch"); return true; }
    return false;
  }

  function stop(sid) {
    const r = running.get(sid); if (!r) return false;
    r.ac.abort();
    for (const [id, w] of waiting) if (w.sid === sid) { waiting.delete(id); w.resolve({ decision: "deny", note: "stopped" }); }
    return true;
  }

  async function compactNow(sid) {
    const s = store.getSession(sid);
    if (running.has(sid)) throw new Error("انتظر حتى ينتهي الوكيل.");
    const ac = new AbortController(); running.set(sid, { ac }); emit({ t: "status", sid, running: true });
    try { await compact(s, ac.signal, true); } catch (e) { notice(s, e.message, "error"); }
    finally { running.delete(sid); emit({ t: "status", sid, running: false }); }
  }

  /** Time machine: every file edit of the session in order, newest last (only edits that still have a checkpoint can be rewound). */
  function timeline(sid) {
    const s = store.getSession(sid); if (!s) return [];
    return s.log.filter((it) => it.kind === "tool" && (s.checkpoints || {})[it.id]).map((it) => {
      const cp = s.checkpoints[it.id];
      return { id: it.id, path: cp.path, created: cp.before === null, at: it.at || 0, tool: it.name, diff: it.diff ? { add: it.diff.add || 0, del: it.diff.del || 0 } : null };
    });
  }
  /** Rewinds the workspace to just before `itemId`: undoes that edit and every later one, newest first. */
  async function rewind(sid, itemId) {
    if (running.has(sid)) throw new Error("أوقف الوكيل أولاً.");
    const list = timeline(sid), i = list.findIndex((x) => x.id === itemId); if (i < 0) throw new Error("نقطة غير موجودة.");
    const undo = list.slice(i).reverse(); let n = 0;
    for (const x of undo) { try { await revert(sid, x.id); n++; } catch {} }
    const s = store.getSession(sid);
    notice(s, `⏪ أُعيد المشروع إلى ما قبل تعديل ${path.basename(list[i].path)} — تراجعتُ عن ${n} تعديل.`, "ok");
    store.saveSession(s); return n;
  }

  async function revert(sid, itemId) {
    const s = store.getSession(sid), cp = s && s.checkpoints && s.checkpoints[itemId];
    if (!cp) throw new Error("لا توجد نسخة سابقة لهذا التعديل.");
    if (cp.before === null) await fs.promises.rm(cp.path, { force: true }); else await fs.promises.writeFile(cp.path, cp.before, "utf8");
    const item = s.log.find((x) => x.id === itemId);
    if (item) { item.reverted = true; item.canRevert = false; emit({ t: "item", sid, item }); }
    delete s.checkpoints[itemId];
    s.messages.push({ role: "user", content: `[The user reverted your change to ${cp.path}; the file is back to its previous state${cp.before === null ? " (deleted, it did not exist before)" : ""}. Do not redo it unless asked.]` }, { role: "assistant", content: "Noted." });
    store.saveSession(s);
    return true;
  }

  let lastDiag = null;
  // one entry per provider across all attempts of a step
  function mergeDiag(raws) { const m = new Map(); for (const r of raws) for (const p of scoutLib.diagnose(r).providers) { const e = m.get(p.provider); if (e) { for (const x of p.models) if (!e.models.includes(x)) e.models.push(x); } else m.set(p.provider, p); } return [...m.values()]; }
  const healthReport = () => { const out = {}; for (const [m, h] of health) out[m] = { ...h, until: isBad(m) ? bad.get(m) : 0 }; return out; };
  const resetHealth = () => { bad.clear(); health.clear(); emit({ t: "health", reset: true }); };
  async function runScout(onProgress) {
    const st = store.settings(), res = await scoutLib.scout({ baseUrl: (st.baseUrl || "").replace(/\/+$/, ""), key: getKey(), models: (store.models().list || []), max: st.scoutMax || 40, enough: 12, timeoutMs: (st.scoutTimeout || 25) * 1000, onProgress });
    for (const b of res.bad) bad.set(b.id, Date.now() + 5 * 60e3); for (const o of res.ok) bad.delete(o.id);
    store.setSettings({ scout: { at: res.at, ok: res.ok.map((x) => ({ id: x.id, ms: x.ms })), bad: res.bad.slice(0, 80).map((x) => ({ id: x.id, reason: x.reason, code: x.code })) } });
    return store.settings().scout;
  }
  return { router, send, stop, switchModel, healthReport, resetHealth, runScout, lastDiag: () => lastDiag, timeline, rewind, expandPrompt, compactNow, replyPermission, revert, isRunning: (sid) => running.has(sid), anyRunning: () => running.size > 0, systemPrompt };
}

module.exports = { createAgent, uid };
