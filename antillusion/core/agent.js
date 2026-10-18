/* Antillusion — the agent loop: streams a model turn from OpenRouter, runs the tools it asks for (behind the
   permission gate), feeds results back, tracks usage and the context window, and compacts when it fills up. */
"use strict";

const fs = require("fs");
const path = require("path");
const os = require("os");
const tools = require("./tools");
const library = require("./library");

const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
const NLCH = String.fromCharCode(10);
const sleep = (ms, signal) => new Promise((res, rej) => { const t = setTimeout(res, ms); signal && signal.addEventListener("abort", () => { clearTimeout(t); rej(abortErr()); }, { once: true }); });
const abortErr = () => Object.assign(new Error("aborted"), { name: "AbortError" });
const estTokens = (msgs) => Math.ceil(JSON.stringify(msgs).length / 3.6);

const MODE_TEXT = {
  agent: "MODE: CODE (agent). You have full tools. Do the work end to end: explore, implement, run, verify.",
  plan: "MODE: PLAN. You are read-only: explore the workspace and the library/sources, then answer with a concrete implementation plan (files to create/change, key decisions, commands, verification steps, risks). Do NOT attempt to modify files or run commands — those tools are disabled. End by asking the user to approve the plan; they can then press \"Execute plan\".",
  ask: "MODE: ASK. You are read-only: answer questions about the code and about programming, reading whatever you need. Do not propose to make changes unless asked; modifying tools are disabled.",
};

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

# Self-Development and Introspection Capabilities (Antillusion)
- You have full awareness and tools to inspect and safely modify your own codebase (the Antillusion project itself).
- project_fork_status: check original, backup (antillusion_backup), and active dev fork (antillusion_dev).
- project_list_files & project_read_source: inspect any part of Antillusion's code (main.js, preload.js, core/agent.js, core/tools.js, ui/app.js, library, etc.).
- project_modify_source & project_edit_source: write and edit files in the active development fork (antillusion_dev). The working version is safely preserved in antillusion_backup. You can freely enhance, customize, or debug Antillusion without breaking the running instance.

# Speed (the user is watching and waiting)
- Act immediately. No preamble, no restating the request, no long plan in prose. One short sentence, then tool calls.
- Batch: issue all independent tool calls (several reads, searches, lookups) together in ONE turn — they run in parallel.
- New/empty workspace: do not explore it. Use use_template ONLY when the user message carries a <starter_template> hint, or the request is plainly the same kind of thing as a template below (a store → store, a Minecraft-like game → voxel-game). Then make targeted edit_file changes — never rewrite a template. For anything else (a calculator, Tetris, a quiz, a converter…) do NOT use a template: write the files directly.
- Output size: long tool calls time out. Keep every write_file under ~150 lines. Split a build into separate files (index.html, style.css, app.js — one call each); if a single file must be longer, write it in parts (more=true, then append=true). Never put a whole large app in one call.
- Scope: build exactly what was asked. After use_template the request is ALREADY satisfied unless the user named specific changes: serve it, verify once, then stop and offer 3–4 concrete next upgrades as a short list for the user to choose from. Never add unrequested features (extra systems, modes, UI) on your own — every extra step costs the user time and quota.
- Use todo_write only for jobs with 4+ distinct steps. Verify once at the end (one preview_read), not after every edit.
- References matching the request are attached to the user's message automatically — use them directly instead of searching again.
- Final answer: 2–5 lines. Do not paste back code you already wrote to files.

# Starter templates (use_template)
${library.templates().map((t) => `- ${t.name}: ${t.title}`).join("\n") || "(none)"}

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
Playbooks available through library_read: ${library.index(libraryDirs)}${settings.instructions ? `\n\n# User's standing instructions\n${String(settings.instructions).slice(0, 4000)}` : ""}${project}`;
}

function apiError(status, body) {
  let msg = String(body || "").slice(0, 500), meta = "";
  try { const j = JSON.parse(body); msg = (j.error && (j.error.message || j.error.code)) || msg; meta = j.error && j.error.metadata && j.error.metadata.raw ? " — " + String(j.error.metadata.raw).slice(0, 300) : ""; } catch {}
  const hints = { 401: "مفتاح API غير صالح أو منتهي — غيّره من الإعدادات.", 402: "الرصيد غير كافٍ لهذا النموذج — اشحن الرصيد، أو اختر نموذجاً مجانياً (:free)، أو صغّر «أقصى طول للرد» من الإعدادات.", 403: "هذا النموذج غير متاح لمفتاحك أو منطقتك.", 404: "النموذج غير موجود أو لا يدعم الأدوات — اختر نموذجاً آخر.", 429: "تم تجاوز حد الطلبات — انتظر قليلاً أو بدّل النموذج." };
  return Object.assign(new Error(`${hints[status] || "خطأ من مزوّد النموذج."} (HTTP ${status}: ${msg}${meta})`), { status });
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
function createAgent({ store, emit, getKey, ui }) {
  const running = new Map();   // sid -> { ac }
  const waiting = new Map();   // reqId -> { sid, resolve }

  const upsert = (s, item) => { const i = s.log.findIndex((x) => x.id === item.id); if (i < 0) s.log.push(item); else s.log[i] = item; emit({ t: "item", sid: s.id, item }); return item; };
  const notice = (s, text, level = "info") => upsert(s, { id: uid(), kind: "notice", text, level, at: Date.now() });
  const pushUsage = (s) => emit({ t: "usage", sid: s.id, usage: s.usage, ctx: s.ctx });
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
      } catch (e) { if (e.name === "AbortError") throw e; if (attempt >= (isOR ? 3 : 1)) throw isOR ? e : new Error(`تعذّر الاتصال بالسيرفر ${base} — تأكد أنه يعمل وأن العنوان صحيح.`); await sleep(1200 * 2 ** attempt, signal); continue; }
      if (r.ok) return r;
      const text = await r.text();
      if ([408, 429, 500, 502, 503, 504, 529].includes(r.status) && attempt < 3) { await sleep(900 * 2 ** attempt, signal); continue; }
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
  async function complete(s, signal) {
    const st = store.settings(), info = store.modelInfo(s.model) || {};
    const readOnly = s.mode !== "agent";
    const anthropic = /^anthropic\//.test(s.model);
    const sys = systemPrompt(s, st, libDirs(s)) + (s._chunkHint ? "\n\n# IMPORTANT\nYour previous attempt was cut off because the output was too long. Write at most ~100 lines per tool call from now on: split into several files, or use write_file with more=true / append=true." : "");
    const msgs = [{ role: "system", content: anthropic ? [{ type: "text", text: sys, cache_control: { type: "ephemeral" } }] : sys }, ...s.messages];
    if (anthropic) {   // rolling cache breakpoint on the newest message keeps long agent runs cheap
      const last = msgs[msgs.length - 1];
      if (last.role === "user" || last.role === "tool") {
        const parts = typeof last.content === "string" ? [{ type: "text", text: last.content || " " }] : last.content.map((p) => ({ ...p }));
        const tp = [...parts].reverse().find((p) => p.type === "text");
        if (tp) { tp.cache_control = { type: "ephemeral" }; msgs[msgs.length - 1] = { ...last, content: parts }; }
      }
    }
    const body = { model: s.model, messages: msgs, tools: tools.toolDefs(readOnly, !!st.expert), stream: true, usage: { include: true }, max_tokens: Math.min(st.maxTokens || 32000, (info.top_provider && info.top_provider.max_completion_tokens) || 1e9) };
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
    if (info.local) body.max_tokens = Math.min(body.max_tokens, Math.max(1024, Math.floor((info.context_length || 32768) / 4)));   // leave the prompt room inside a small context window
    emit({ t: "activity", sid: s.id, text: "ينتظر النموذج…" });
    let r;
    try { r = await request(body, signal); }
    catch (e) {   // a model that rejects one of the optional knobs still gets its turn
      if (![400, 404, 422].includes(e.status) || signal.aborted) throw e;
      delete body.reasoning; delete body.provider; delete body.models;
      r = await request(body, signal);
    }
    const item = { id: uid(), kind: "assistant", text: "", reasoning: "", model: s.model, at: Date.now(), streaming: true };
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
      if (j.model && j.model !== s.model) item.model = j.model;
    };
    try {
      for await (const chunk of r.body) {
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
    } catch (e) {
      item.streaming = false; if (shown) upsert(s, item);
      if (item.text.trim()) s.messages.push({ role: "assistant", content: item.text });   // keep what was said before the cut
      throw signal.aborted ? abortErr() : e;
    }
    item.streaming = false;
    const toolCalls = calls.filter((c) => c && c.name).map((c) => ({ id: c.id || "call_" + uid(), name: c.name, args: c.args }));
    const counted = account(s, usage, s.model);
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
    const st = store.settings(), model = st.expertModel || "anthropic/claude-opus-5.5";
    emit({ t: "activity", sid: s.id, text: kind === "blueprint" ? "الخبير يضع الخطة…" : "استشارة الخبير…" });
    let listing = ""; try { listing = fs.readdirSync(s.cwd).filter((n) => !/^(node_modules|\.git)$/.test(n)).slice(0, 60).join(", "); } catch {}
    const sys = kind === "blueprint"
      ? "You are a principal engineer briefing a fast but junior coding agent that will do the typing. Produce a compact, decisive build blueprint it can follow literally: stack choice, exact file list, data model/state shape, the functions each file needs (names + one-line purpose), full code for any genuinely tricky algorithm, the exact run/verify steps, and the 3 pitfalls most likely to break it. No alternatives, no explanations of basics, no fluff. Under 700 words plus code."
      : "You are a principal engineer helping a junior coding agent that is stuck. Diagnose the real cause from the evidence and give the exact fix: which file, what to replace with what (show code). Be decisive and brief. If the approach itself is wrong, say what to do instead.";
    const r = await request({ model, max_tokens: 3000, usage: { include: true }, messages: [{ role: "system", content: sys },
      { role: "user", content: `Workspace: ${s.cwd}${NLCH}Files at the root: ${listing || "(empty)"}${NLCH}Agent tools: read/write/edit files, run commands, serve_static/start_server with an in-app preview, use_template (${library.templates().map((t) => t.name).join(", ")}).${NLCH}${NLCH}${question}` }] }, signal);
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
    let out = await tools.runTool(tc.name, args, ctx);
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

  /* ---------- the loop ---------- */

  async function run(s) {
    const ac = new AbortController();
    running.set(s.id, { ac });
    emit({ t: "status", sid: s.id, running: true });
    const st = store.settings();
    try {
      for (let step = 0; step < (st.maxSteps || 80); step++) {
        await maybeCompact(s, ac.signal);
        if (s._blueprint && st.expert && !s._noExpert && s.mode === "agent") {
          const ask = s._blueprint; s._blueprint = null;
          try {
            const plan = await askExpert(s, `The user asked:${NLCH}${ask}`, ac.signal, "blueprint");
            const last = s.messages[s.messages.length - 1];
            if (last && last.role === "user") { const add = `${NLCH}${NLCH}<expert_blueprint>${NLCH}${plan}${NLCH}</expert_blueprint>${NLCH}Build this now, following the blueprint. Do not re-plan.`; if (typeof last.content === "string") last.content += add; else last.content[0].text += add; }
          } catch (e) { if (ac.signal.aborted) throw e; s._noExpert = true; notice(s, "تعذّرت استشارة الخبير: " + e.message + " — أكمل بالنموذج المتاح.", "warn"); }
        }
        let res;
        for (let attempt = 0; ; attempt++) {
          try { res = await complete(s, ac.signal); s._alt = 0; break; }
          catch (e) {   // upstream cut the stream (504, idle timeout, reset): try again on the next model, in smaller pieces
            const transient = !ac.signal.aborted && e.name !== "AbortError" && (!e.status || e.status >= 500 || e.status === 408 || e.status === 429);
            if (!transient || attempt >= 2) throw e;
            s._alt = (s._alt || 0) + 1; s._chunkHint = true;
            notice(s, "انقطع ردّ المزوّد — إعادة المحاولة بنموذج بديل وعلى دفعات أصغر…", "warn");
          }
        }
        s.messages.push(res.message);
        if (res.finish === "length") notice(s, "انقطع ردّ النموذج عند حدّ الطول — يمكنك رفع «أقصى طول للرد» من الإعدادات.", "warn");
        if (!res.toolCalls.length) break;
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
      else notice(s, e.message || String(e), "error");
    } finally {
      emit({ t: "activity", sid: s.id, text: "" });
      for (const [id, w] of waiting) if (w.sid === s.id) { waiting.delete(id); w.resolve({ decision: "deny" }); }
      for (const it of s.log) { if (it.streaming) { it.streaming = false; emit({ t: "item", sid: s.id, item: it }); } if (it.kind === "tool" && (it.status === "running" || it.status === "pending")) { it.status = "error"; delete it.perm; emit({ t: "item", sid: s.id, item: it }); } }
      running.delete(s.id); s.updated = Date.now(); store.saveSession(s);
      emit({ t: "status", sid: s.id, running: false });
    }
  }

  function send(sid, { text, attachments = [] }) {
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
    if (s.mode !== "ask" && text && String(text).length < 4000) {   // hand over the matching playbooks/template now: saves the model a search round-trip
      const ref = library.autoRefs(text, libDirs(s), s.messages.length ? 5000 : 9000), seen = s.refsSent || (s.refsSent = []);
      const fresh = ref.cards.filter((c) => !seen.includes(c.id));
      if (ref.template && !seen.includes("tpl:" + ref.template.name)) { seen.push("tpl:" + ref.template.name); body += `\n\n<starter_template name="${ref.template.name}">A tested starter matches this request: ${ref.template.title}. Call use_template("${ref.template.name}") first, then customise it with edit_file.</starter_template>`; }
      for (const c of fresh) { seen.push(c.id); body += `\n\n<library_reference id="${c.id}">\n${c.text}\n</library_reference>`; }
    }
    s._seen = new Map(); s._fails = 0;
    s._blueprint = text && String(text).length > 8 && !/<starter_template/.test(body) && /(اعمل|ابن|انشئ|أنشئ|صمم|بدي|اريد|أريد|طور|برمج|سوي|build|create|make|implement|develop|write|add|design)/i.test(text) ? String(text) : null;
    s.messages.push({ role: "user", content: parts.length ? [{ type: "text", text: body || "(see attached)" }, ...parts] : body });
    upsert(s, { id: uid(), kind: "user", text: String(text || ""), attachments: attachments.map((a) => ({ name: a.name, kind: a.kind, thumb: a.kind === "image" ? a.dataUrl : undefined })), at: Date.now() });
    if (!s.titled && text) { s.title = String(text).replace(/\s+/g, " ").trim().slice(0, 48); s.titled = true; emit({ t: "session", sid, meta: store.meta(s) }); }
    store.saveSession(s);
    run(s);   // deliberately not awaited: progress flows through emit()
    return true;
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

  return { send, stop, compactNow, replyPermission, revert, isRunning: (sid) => running.has(sid), systemPrompt };
}

module.exports = { createAgent, uid };
