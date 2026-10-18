/* Antillusion — the agent's tools: files, search, shell, local servers, preview, library and live sources.
   Electron-free on purpose so the whole core can be exercised from plain Node (see test/core.test.js). */
"use strict";

const fs = require("fs");
const fsp = fs.promises;
const path = require("path");
const net = require("net");
const http = require("http");
const { spawn } = require("child_process");
const library = require("./library");
const sources = require("./sources");

const WIN = process.platform === "win32";
const SKIP_DIRS = new Set(["node_modules", ".git", ".next", ".nuxt", ".venv", "venv", "__pycache__", "target", ".cache", ".turbo", "coverage", "dist", ".gradle", ".idea"]);
const MAX_OUT = 30000;

/* ---------- definitions ---------- */

const P = (properties, required = []) => ({ type: "object", properties, required, additionalProperties: false });
const S = (description) => ({ type: "string", description });
const N = (description) => ({ type: "integer", description });
const B = (description) => ({ type: "boolean", description });

const DEFS = [
  { name: "read_file", kind: "read", description: "Read a text file. Returns numbered lines. Use offset/limit for large files. Always read a file before editing it.",
    parameters: P({ path: S("File path, relative to the workspace or absolute"), offset: N("1-based first line (default 1)"), limit: N("Max lines (default 800)") }, ["path"]) },
  { name: "write_file", kind: "write", description: "Create a file or overwrite it. Keep each call under ~150 lines: long outputs time out. For a longer file send the first part with more=true, then the following parts with append=true (and more=true on every part except the last). Parent folders are created. For small changes to an existing file use edit_file.",
    parameters: P({ path: S("File path"), content: S("File content (this part)"), append: B("Append to the existing file instead of replacing it"), more: B("More parts will follow — skips the syntax check until the last part") }, ["path", "content"]) },
  { name: "edit_file", kind: "write", description: "Replace an exact string in a file. old_string must match the file exactly (including whitespace) and be unique unless replace_all is true. Include enough surrounding lines to make it unique.",
    parameters: P({ path: S("File path"), old_string: S("Exact text to replace"), new_string: S("Replacement text"), replace_all: B("Replace every occurrence") }, ["path", "old_string", "new_string"]) },
  { name: "multi_edit", kind: "write", description: "Apply SEVERAL exact-string edits to ONE file in a single call (faster than repeated edit_file). Edits run in order against the evolving text; if any old_string is missing or ambiguous NOTHING is written and the failing edit is reported. Use it whenever you change 2+ places in the same file.",
    parameters: P({ path: S("File path"), edits: { type: "array", minItems: 1, maxItems: 30, description: "Edits applied in order", items: P({ old_string: S("Exact text to replace"), new_string: S("Replacement text"), replace_all: B("Replace every occurrence") }, ["old_string", "new_string"]) } }, ["path", "edits"]) },
  { name: "read_many", kind: "read", description: "Read up to 12 files (or line ranges) in ONE call — use it instead of several read_file calls when you need to look at multiple files.",
    parameters: P({ files: { type: "array", minItems: 1, maxItems: 12, items: P({ path: S("File path"), offset: N("1-based first line"), limit: N("Max lines") }, ["path"]) } }, ["files"]) },
  { name: "list_dir", kind: "read", description: "List a directory (folders first, with file sizes). depth 2-3 gives a tree overview of a project.",
    parameters: P({ path: S("Directory, default workspace root"), depth: N("Tree depth 1-4 (default 1)") }) },
  { name: "glob", kind: "read", description: "Find files by glob pattern, e.g. **/*.ts, src/**/*.{js,jsx}, *.md. Heavy folders (node_modules, .git, dist…) are skipped.",
    parameters: P({ pattern: S("Glob pattern"), path: S("Directory to search, default workspace root") }, ["pattern"]) },
  { name: "grep", kind: "read", description: "Search file contents with a JavaScript regular expression. Returns path:line: text.",
    parameters: P({ pattern: S("Regex"), path: S("File or directory, default workspace root"), glob: S("Only files matching this glob, e.g. *.py"), ignore_case: B("Case-insensitive"), context: N("Lines of context around each match (0-5)") }, ["pattern"]) },
  { name: "run_command", kind: "exec", description: "Run a shell command in the workspace and wait for it to finish (install, build, test, git…). NOT for long-running servers — use start_server for those. Output is truncated to the head and tail when long.",
    parameters: P({ command: S("The command line"), cwd: S("Working directory, default workspace root"), timeout_sec: N("Timeout in seconds (default 120, max 900)") }, ["command"]) },
  { name: "start_server", kind: "exec", description: "Start a long-running process in the background (dev server, API, watcher) and wait until it is listening. Returns its id, URL and first log lines. A preview tab opens inside the app automatically when a URL is found.",
    parameters: P({ command: S("Command, e.g. npm run dev"), name: S("Short label"), port: N("Port the server will listen on, when known"), cwd: S("Working directory") }, ["command"]) },
  { name: "serve_static", kind: "exec", description: "Serve a folder of static files (HTML/CSS/JS) on localhost with the built-in server and open it in the in-app preview. Use this for plain sites that need no build step.",
    parameters: P({ dir: S("Folder to serve, default workspace root"), port: N("Port, default: a free one"), open: S("Path to open, default /") }) },
  { name: "stop_server", kind: "exec", description: "Stop a background server by id.", parameters: P({ id: S("Server id") }, ["id"]) },
  { name: "server_logs", kind: "read", description: "Read recent output of a background server. Without id, lists all running servers.",
    parameters: P({ id: S("Server id"), lines: N("Trailing lines, default 60") }) },
  { name: "open_preview", kind: "read", description: "Open a URL or a local HTML file in a preview tab in the side panel of the app, next to the chat.",
    parameters: P({ target: S("http(s) URL or path to an .html file"), title: S("Tab title") }, ["target"]) },
  { name: "preview_read", kind: "read", description: "Inspect the active preview tab to verify your work: returns its title, URL, visible text, and console errors. Optional js runs in the page and its JSON result is returned (use it to click, query the DOM, or measure).",
    parameters: P({ js: S("JavaScript expression to evaluate in the page"), wait_ms: N("Wait before reading (default 600)") }) },
  { name: "library_search", kind: "read", description: "Search Antillusion's built-in engineering library: playbooks (how to build/structure/test/deploy each kind of project) and a catalogue of proven packages per ecosystem. Consult it before choosing a stack or library.",
    parameters: P({ query: S("Keywords, e.g. 'react charts', 'fastapi auth', 'electron ipc'") }, ["query"]) },
  { name: "library_read", kind: "read", description: "Read one playbook from the library in full by id (ids come from library_search or the index in the system prompt).",
    parameters: P({ id: S("Playbook id") }, ["id"]) },
  { name: "sources_search", kind: "read", description: "Search live external sources. source: web | npm | pypi | crates | nuget | packagist | pub | docker | github | stackoverflow | mdn | wikipedia | all.",
    parameters: P({ query: S("Search query"), source: S("Which source (default all)") }, ["query"]) },
  { name: "pkg_info", kind: "read", description: "Latest version, description, dependencies, links and README excerpt of a package, straight from its registry. Use it before pinning a version or using an unfamiliar API. ecosystem: npm | pypi | crates.",
    parameters: P({ name: S("Package name"), ecosystem: S("npm (default), pypi or crates") }, ["name"]) },
  { name: "web_fetch", kind: "read", description: "Fetch a URL and return its readable text (HTML is converted). Use for documentation pages, READMEs, API references, or to call your own local server.",
    parameters: P({ url: S("http(s) URL"), max_chars: N("Default 20000") }, ["url"]) },
  { name: "use_template", kind: "write", description: "Copy a ready-made, tested starter project into the workspace in one step (seconds instead of minutes), then customise it with edit_file. Use it only when the request is the same kind of project as the template; never bend an unrelated template into something else. Template names are listed in the system prompt.",
    parameters: P({ name: S("Template name"), dest: S("Target folder, default workspace root"), overwrite: B("Replace files that already exist") }, ["name"]) },
  { name: "ask_expert", kind: "read", expert: true, description: "Ask a far stronger senior model for help. Use it when you are unsure how to design something, when a bug survives two fix attempts, or before a large/complex build. Give the full question with the relevant code or error. Returns precise guidance — follow it.",
    parameters: P({ question: S("What you need, with the relevant code, error text and what you already tried") }, ["question"]) },
  { name: "todo_write", kind: "read", description: "Publish/replace the task list shown to the user. Use for any job with 3+ steps and keep it current: exactly one item in_progress, mark items done as you finish them.",
    parameters: P({ todos: { type: "array", items: P({ text: S("Task"), status: { type: "string", enum: ["pending", "in_progress", "done"] } }, ["text", "status"]) } }, ["todos"]) },
  { name: "delete_file", kind: "write", description: "Delete a file or directory inside the workspace. If recursive=true, deletes folder and its contents.",
    parameters: P({ path: S("File or folder path"), recursive: B("Delete folder recursively") }, ["path"]) },
  { name: "move_file", kind: "write", description: "Move or rename a file or directory inside the workspace.",
    parameters: P({ source: S("Source path"), destination: S("Destination path"), overwrite: B("Overwrite if destination exists") }, ["source", "destination"]) },
  { name: "copy_file", kind: "write", description: "Copy a file or directory inside the workspace.",
    parameters: P({ source: S("Source path"), destination: S("Destination path"), overwrite: B("Overwrite if destination exists") }, ["source", "destination"]) },
  { name: "project_read_source", kind: "read", description: "Read any source file from the Antillusion project itself (main.js, preload.js, core/agent.js, core/tools.js, ui/app.js, ui/index.html, etc.).",
    parameters: P({ path: S("Relative path inside Antillusion project, e.g. 'core/tools.js' or 'main.js'"), offset: N("1-based first line"), limit: N("Max lines") }, ["path"]) },
  { name: "project_list_files", kind: "read", description: "List all source files and structure of the Antillusion project.",
    parameters: P({ subpath: S("Subdirectory inside Antillusion (default root)"), depth: N("Depth 1-4 (default 2)") }) },
  { name: "project_modify_source", kind: "write", description: "Safely modify or write a file in the active editable copy of the Antillusion project. If no active fork exists yet, an editable copy (antillusion_dev) is automatically created with the original safely backed up (antillusion_backup).",
    parameters: P({ path: S("Relative file path inside the project, e.g. 'core/agent.js'"), content: S("Complete file content to write"), append: B("Append instead of overwriting") }, ["path", "content"]) },
  { name: "project_edit_source", kind: "write", description: "Safely replace an exact string in a file of the active editable copy of Antillusion. If no active fork exists yet, an editable copy is initialized automatically.",
    parameters: P({ path: S("Relative file path inside the project, e.g. 'core/tools.js'"), old_string: S("Exact text to replace"), new_string: S("Replacement text"), replace_all: B("Replace every occurrence") }, ["path", "old_string", "new_string"]) },
  { name: "project_fork_status", kind: "read", description: "Get the status of the Antillusion project copies (original, backup, and active dev copy).",
    parameters: P({}) },
];

const BY_NAME = new Map(DEFS.map((d) => [d.name, d]));
const toolDefs = (readOnly, expert) => DEFS.filter((d) => (!readOnly || d.kind === "read") && (!d.expert || expert))
  .map((d) => ({ type: "function", function: { name: d.name, description: d.description, parameters: d.parameters } }));
const kindOf = (name) => (BY_NAME.get(name) || {}).kind;

const DANGER = [
  /\brm\s+(-[a-z]*r[a-z]*f|-[a-z]*f[a-z]*r)[a-z]*\s+(\/|~|\$HOME|[a-z]:[\\/]?)(\s|$|\*)/i, /\bRemove-Item\b.*-Recurse.*\s([a-z]:\\?|~|\$HOME|\$env:USERPROFILE)(\s|$|\\\*)/i,
  /\b(format|diskpart|mkfs\S*|fdisk)\b/i, /\b(rd|rmdir)\s+\/s\b/i, /\bdel\s+.*\/s\b/i, /\bshutdown\b|\bRestart-Computer\b|\bStop-Computer\b/i,
  /\breg(\.exe)?\s+(delete|add)\b/i, /\bgit\s+push\b.*(--force|\s-f\b)/i, /\bgit\s+reset\s+--hard\b/i, /\bgit\s+clean\s+-[a-z]*f/i,
  /(curl|wget|iwr|irm|Invoke-WebRequest|Invoke-RestMethod)\b[^|]*\|\s*(sh|bash|zsh|iex|Invoke-Expression|powershell|pwsh)\b/i,
  /\bInvoke-Expression\b|\biex\s/i, /:\(\)\s*\{.*\};\s*:/, /\bnpm\s+publish\b|\bdd\s+if=/i, /\bSet-ExecutionPolicy\b|\bnetsh\b|\bsc(\.exe)?\s+(delete|stop)\b/i,
];
// normalise the usual evasions before matching: split flags (rm -r -f), long flags, quotes, line continuations, extra spaces
const normCmd = (cmd) => {
  let c = String(cmd || "").replace(/\\\r?\n/g, " ").replace(/["'`]/g, "").replace(/--recursive\b/gi, "-r").replace(/--force\b/gi, "-f").replace(/\s+/g, " ");
  for (let prev; prev !== c;) { prev = c; c = c.replace(/(\s-[a-z]+)\s+-([a-z]+)/gi, "$1$2"); }
  return c.replace(/(^|[\s;&|(])\/?(?:usr\/)?(?:s?bin\/)?(rm|dd|mkfs\S*)\b/g, "$1$2");   // /bin/rm → rm
};
const isDangerous = (cmd) => { const raw = String(cmd || ""), norm = normCmd(raw); return DANGER.some((re) => re.test(raw) || re.test(norm)); };

/* ---------- helpers ---------- */

const resolveIn = (cwd, p) => path.resolve(cwd, String(p || "."));
const isInside = (root, p) => { const r = path.relative(root, p); return r === "" || (!r.startsWith("..") && !path.isAbsolute(r)); };
// a path inside Antillusion's own source tree; refuses anything that climbs out of it and the secrets file
const inProject = (root, p) => {
  const fp = path.resolve(root, String(p || "."));
  if (!isInside(root, fp)) throw new Error(`path leaves the Antillusion project: ${p}`);
  if (/^\.env(\.|$)/i.test(path.basename(fp))) throw new Error(".env holds the API key and is not readable or writable by the agent");
  return fp;
};
const rel = (cwd, p) => { const r = path.relative(cwd, p); return (r && !r.startsWith("..") ? r : p).replace(/\\/g, "/"); };
const stripAnsi = (s) => s.replace(/\x1b\[[0-9;?]*[ -\/]*[@-~]|\x1b\][^\x07]*(\x07|\x1b\\)|\r(?!\n)/g, "");
const clip = (s, max = MAX_OUT) => (s.length <= max ? s : s.slice(0, max * 0.6 | 0) + `\n\n… [${s.length - max} characters omitted] …\n\n` + s.slice(-(max * 0.4 | 0)));
const looksBinary = (buf) => { const n = Math.min(buf.length, 4096); for (let i = 0; i < n; i++) if (buf[i] === 0) return true; return false; };
const human = (n) => (n < 1024 ? n + " B" : n < 1048576 ? (n / 1024).toFixed(1) + " KB" : (n / 1048576).toFixed(1) + " MB");

function globRe(glob) {
  let g = String(glob).replace(/\\/g, "/").replace(/^\.\//, ""), re = "";
  if (!g.includes("/")) g = "**/" + g;
  for (let i = 0; i < g.length; i++) {
    const c = g[i];
    if (c === "*") {
      if (g[i + 1] === "*") { if (g[i + 2] === "/") { re += "(?:.*/)?"; i += 2; } else { re += ".*"; i++; } }
      else re += "[^/]*";
    } else if (c === "?") re += "[^/]";
    else if (c === "{") { const e = g.indexOf("}", i); if (e > i) { re += "(?:" + g.slice(i + 1, e).split(",").map((x) => x.replace(/[.+^$()|[\]\\]/g, "\\$&").replace(/\*/g, "[^/]*")).join("|") + ")"; i = e; } else re += "\\{"; }
    else re += /[.+^$()|[\]\\]/.test(c) ? "\\" + c : c;
  }
  return new RegExp("^" + re + "$", WIN ? "i" : "");
}

/** Depth-first walk that skips heavy folders; cb(absPath, relPath, dirent) may return false to stop. */
async function walk(root, cb, { maxFiles = 30000, maxDepth = 24 } = {}) {
  let seen = 0;
  const go = async (dir, depth) => {
    let ents;
    try { ents = await fsp.readdir(dir, { withFileTypes: true }); } catch { return true; }
    ents.sort((a, b) => a.name.localeCompare(b.name));
    for (const e of ents) {
      const abs = path.join(dir, e.name);
      if (e.isDirectory()) { if (SKIP_DIRS.has(e.name) || depth >= maxDepth) continue; if ((await go(abs, depth + 1)) === false) return false; }
      else if (e.isFile()) { if (++seen > maxFiles) return false; if (cb(abs, path.relative(root, abs).replace(/\\/g, "/"), e) === false) return false; }
    }
    return true;
  };
  await go(root, 0);
}

/* ---------- shell ---------- */

function shellSpec(pref) {
  if (!WIN) return { name: "bash", file: fs.existsSync("/bin/bash") ? "/bin/bash" : "/bin/sh", args: (c) => ["-c", c] };
  const bashes = [process.env.ANTILLUSION_BASH, "C:\\Program Files\\Git\\bin\\bash.exe", "C:\\Program Files (x86)\\Git\\bin\\bash.exe", path.join(process.env.LOCALAPPDATA || "", "Programs\\Git\\bin\\bash.exe")].filter(Boolean);
  const bash = bashes.find((b) => fs.existsSync(b));
  const want = pref && pref !== "auto" ? pref : bash ? "bash" : "powershell";
  if (want === "bash" && bash) return { name: "bash (Git Bash on Windows)", file: bash, args: (c) => ["-c", c] };
  if (want === "cmd") return { name: "cmd.exe", file: process.env.ComSpec || "cmd.exe", args: (c) => ["/d", "/s", "/c", `"${c}"`], verbatim: true };
  return { name: "Windows PowerShell 5.1 (no && or ||; use ';' and if ($?) {…})", file: "powershell.exe", args: (c) => ["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-Command", c] };
}

function killTree(proc) {
  if (!proc || proc.exitCode !== null) return;
  try {
    if (WIN) spawn("taskkill", ["/pid", String(proc.pid), "/T", "/F"], { windowsHide: true });
    else { try { process.kill(-proc.pid, "SIGKILL"); } catch { proc.kill("SIGKILL"); } }
  } catch {}
}

function spawnShell(command, cwd, pref) {
  const sh = shellSpec(pref);
  return spawn(sh.file, sh.args(command), {
    cwd, windowsHide: true, detached: !WIN, windowsVerbatimArguments: !!sh.verbatim, stdio: ["ignore", "pipe", "pipe"],
    env: { ...process.env, NO_COLOR: "1", FORCE_COLOR: "0", TERM: "dumb", npm_config_yes: "true", npm_config_fund: "false", npm_config_audit: "false", PYTHONUNBUFFERED: "1", PYTHONIOENCODING: "utf-8", ELECTRON_RUN_AS_NODE: undefined },
  });
}

function runProc(command, { cwd, timeoutMs, signal, shell, onData }) {
  return new Promise((resolve) => {
    let out = "", done = false, timedOut = false, proc;
    const finish = (code, err) => { if (done) return; done = true; clearTimeout(timer); signal && signal.removeEventListener("abort", onAbort); resolve({ code, out: stripAnsi(out), timedOut, err, aborted: !!(signal && signal.aborted) }); };
    const onAbort = () => { killTree(proc); setTimeout(() => finish(null), 400); };
    try { proc = spawnShell(command, cwd, shell); } catch (e) { return resolve({ code: null, out: "", err: e.message }); }
    const timer = setTimeout(() => { timedOut = true; killTree(proc); setTimeout(() => finish(null), 400); }, timeoutMs);
    const add = (d) => { const t = d.toString("utf8"); if (out.length < 4e6) out += t; onData && onData(t); };
    proc.stdout.on("data", add); proc.stderr.on("data", add);
    proc.on("error", (e) => finish(null, e.message));
    proc.on("close", (code) => finish(code));
    if (signal) { if (signal.aborted) onAbort(); else signal.addEventListener("abort", onAbort); }
  });
}

/* ---------- background servers ---------- */

const servers = new Map();
let serverSeq = 0, serversChanged = () => {};
const onServersChanged = (fn) => { serversChanged = fn; };
const serverList = () => [...servers.values()].map((s) => ({ id: s.id, name: s.name, command: s.command, cwd: s.cwd, url: s.url, port: s.port, status: s.status, sid: s.sid, started: s.started }));
const serverLogs = (id, lines = 200) => { const s = servers.get(id); return s ? s.logs.slice(-lines).join("\n") : ""; };

function pushLog(s, text) {
  for (const line of stripAnsi(text).split(/\n/)) { if (line.trim() === "" && !s.logs.length) continue; s.logs.push(line.replace(/\s+$/, "")); }
  if (s.logs.length > 1500) s.logs.splice(0, s.logs.length - 1500);
}

function portOpen(port) {
  const tryHost = (host) => new Promise((res) => {
    const so = net.connect({ port, host });
    const end = (v) => { so.destroy(); res(v); };
    so.setTimeout(700, () => end(false)); so.once("connect", () => end(true)); so.once("error", () => end(false));
  });
  return Promise.all([tryHost("127.0.0.1"), tryHost("::1")]).then((r) => r[0] || r[1]);
}

function stopServer(id) {
  const s = servers.get(id);
  if (!s) return false;
  if (s.proc) killTree(s.proc);
  if (s.http) { try { s.http.closeAllConnections && s.http.closeAllConnections(); s.http.close(); } catch {} }
  s.status = "stopped"; servers.delete(id); serversChanged();
  return true;
}
const stopAllServers = () => { for (const id of [...servers.keys()]) stopServer(id); };

async function startServer(a, ctx) {
  const cwd = resolveIn(ctx.cwd, a.cwd);
  const id = "srv" + ++serverSeq;
  const s = { id, name: a.name || a.command.split(/\s+/).slice(0, 3).join(" "), command: a.command, cwd, logs: [], url: null, port: a.port || null, status: "starting", sid: ctx.sid, started: Date.now() };
  if (a.port && (await portOpen(a.port))) return `Port ${a.port} is already in use (another server is running there). Stop it with stop_server, pick another port, or just open_preview http://localhost:${a.port}.`;
  s.proc = spawnShell(a.command, cwd, ctx.shell);
  servers.set(id, s); serversChanged();
  let exited = null;
  const urlRe = /https?:\/\/(?:localhost|127\.0\.0\.1|0\.0\.0\.0|\[::1?\])(?::(\d+))?[^\s'"<>)\]]*/i;
  const add = (d) => {
    const t = d.toString("utf8"); pushLog(s, t);
    if (!s.url) { const m = stripAnsi(t).match(urlRe); if (m) { s.url = m[0].replace("0.0.0.0", "localhost").replace(/\[::1?\]/, "localhost").replace(/[.,;]+$/, ""); if (m[1]) s.port = +m[1]; } }
  };
  s.proc.stdout.on("data", add); s.proc.stderr.on("data", add);
  s.proc.on("error", (e) => { exited = e.message; });
  s.proc.on("close", (code) => { exited = "exit code " + code; s.status = "exited"; pushLog(s, `[process exited: code ${code}]`); servers.delete(id); serversChanged(); });
  const until = Date.now() + 45000;
  while (Date.now() < until && exited === null && !(ctx.signal && ctx.signal.aborted)) {
    if (s.port && (await portOpen(s.port))) { s.status = "running"; break; }
    await new Promise((r) => setTimeout(r, 350));
  }
  if (exited !== null) return `The process ended immediately (${exited}). Output:\n${clip(s.logs.join("\n"), 6000) || "(none)"}`;
  if (s.status !== "running") { s.status = "running"; serversChanged(); return `Started as ${id}, but no listening port was detected after 45 s (it may still be starting, or it is not a network server). Output so far:\n${clip(s.logs.join("\n"), 5000) || "(none)"}\nCheck again with server_logs.`; }
  if (!s.url) s.url = `http://localhost:${s.port}`;
  serversChanged();
  if (ctx.settings.autoPreview !== false) ctx.ui.openPreview({ url: s.url, title: s.name, sid: ctx.sid });
  return `Server ${id} is running at ${s.url}${ctx.settings.autoPreview !== false ? " and is open in the preview panel" : ""}.\nFirst output:\n${clip(s.logs.slice(0, 40).join("\n"), 3000)}\nVerify it with preview_read.`;
}

const MIME = { html: "text/html; charset=utf-8", htm: "text/html; charset=utf-8", js: "text/javascript; charset=utf-8", mjs: "text/javascript; charset=utf-8", css: "text/css; charset=utf-8", json: "application/json; charset=utf-8", svg: "image/svg+xml", png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", gif: "image/gif", webp: "image/webp", avif: "image/avif", ico: "image/x-icon", woff: "font/woff", woff2: "font/woff2", ttf: "font/ttf", mp3: "audio/mpeg", wav: "audio/wav", ogg: "audio/ogg", mp4: "video/mp4", webm: "video/webm", wasm: "application/wasm", txt: "text/plain; charset=utf-8", md: "text/plain; charset=utf-8", xml: "application/xml", pdf: "application/pdf", glb: "model/gltf-binary", gltf: "model/gltf+json", map: "application/json" };

async function serveStatic(a, ctx) {
  const root = resolveIn(ctx.cwd, a.dir);
  if (!fs.existsSync(root) || !fs.statSync(root).isDirectory()) return `Not a directory: ${root}`;
  const id = "srv" + ++serverSeq;
  const s = { id, name: "static · " + (path.basename(root) || root), command: "(built-in static server)", cwd: root, logs: [], url: null, port: null, status: "starting", sid: ctx.sid, started: Date.now() };
  const srv = http.createServer((req, res) => {
    let u; try { u = decodeURIComponent(req.url.split("?")[0]); } catch { u = "/"; }
    let fp = path.join(root, u);
    if (!isInside(root, fp)) { res.writeHead(403); return res.end("forbidden"); }
    fs.stat(fp, (e, st) => {
      if (!e && st.isDirectory()) fp = path.join(fp, "index.html");
      fs.readFile(fp, (err, data) => {
        if (err) {
          const spa = path.join(root, "index.html");   // single-page-app fallback for extension-less routes
          if (!path.extname(u) && fs.existsSync(spa)) data = fs.readFileSync(spa), fp = spa;
          else { pushLog(s, `404 ${u}`); res.writeHead(404, { "Content-Type": "text/plain" }); return res.end("404 not found: " + u); }
        }
        pushLog(s, `200 ${u}`);
        res.writeHead(200, { "Content-Type": MIME[path.extname(fp).slice(1).toLowerCase()] || "application/octet-stream", "Cache-Control": "no-store" });
        res.end(data);
      });
    });
  });
  try { await new Promise((ok, bad) => { srv.once("error", bad); srv.listen(a.port || 0, "127.0.0.1", ok); }); }
  catch (e) { return `Could not listen on port ${a.port}: ${e.message}`; }
  s.http = srv; s.port = srv.address().port; s.url = `http://localhost:${s.port}`; s.status = "running";
  servers.set(id, s); serversChanged();
  const open = s.url + (a.open ? "/" + String(a.open).replace(/^\/+/, "") : "/");
  ctx.ui.openPreview({ url: open, title: path.basename(root) || "preview", sid: ctx.sid });
  return `Static server ${id} is serving ${root} at ${s.url} and ${open} is open in the preview panel. Files are read from disk on every request, so edits show after a reload.`;
}

/* ---------- automatic checks: catch the mistake in the same step instead of three steps later ---------- */

const vm = require("vm");
const os = require("os");
function nodeCheck(file) {
  return new Promise((res) => {
    require("child_process").execFile(process.execPath, ["--check", file], { env: { ...process.env, ELECTRON_RUN_AS_NODE: "1" }, timeout: 8000, windowsHide: true },
      (e, so, se) => {
        if (!e) return res("");
        const errLines = String(se || e.message).split(/\r?\n/).filter((l) => l.trim() && !/^\s+at |^Node\.js v/.test(l)).slice(0, 6).join("\n");
        // Fallback: If electron binary doesn't support --check directly without Node flag, check via vm.Script
        if (/bad option|unknown option|not recognized/i.test(errLines) || !errLines) {
          try {
            const code = fs.readFileSync(file, "utf8");
            new vm.Script(code, { filename: path.basename(file) });
            return res("");
          } catch (vmErr) {
            return res(vmErr.message);
          }
        }
        res(errLines);
      });
  });
}
async function checkModuleSource(code, label) {
  const tmp = path.join(os.tmpdir(), "anti-check-" + Date.now() + "-" + Math.random().toString(36).slice(2) + ".mjs");
  try {
    await fsp.writeFile(tmp, code);
    const r = await nodeCheck(tmp);
    return r ? r.split(tmp).join(label) : "";
  } catch (err) {
    if (typeof vm.SourceTextModule !== "function") return "";
    try { new vm.SourceTextModule(code, { identifier: label }); return ""; } catch (mErr) { return mErr.message; }
  } finally { fsp.rm(tmp, { force: true }).catch(() => {}); }
}
/** Returns "" when the file parses, otherwise a short message that is appended to the tool result. */
async function syntaxCheck(fp, content) {
  const ext = path.extname(fp).toLowerCase();
  try {
    if (ext === ".json") { try { JSON.parse(content); return ""; } catch (e) { return e.message; } }
    if (ext === ".js" || ext === ".mjs" || ext === ".cjs") return (await nodeCheck(fp)).split(fp).join(path.basename(fp));
    if (ext === ".html" || ext === ".htm") {
      const errs = [], re = /<script\b([^>]*)>([\s\S]*?)<\/script>/gi; let m;
      while ((m = re.exec(content))) {
        const attrs = m[1], code = m[2]; if (!code.trim() || /\bsrc\s*=/.test(attrs) || /type\s*=\s*["']?(importmap|application\/(ld\+)?json|text\/template)/i.test(attrs)) continue;
        const line = content.slice(0, m.index).split(NLCHAR).length, label = `${path.basename(fp)} <script> at line ${line}`;
        if (/type\s*=\s*["']?module/i.test(attrs)) { const r = await checkModuleSource(code, label); if (r) errs.push(r); }
        else { try { new vm.Script(code, { filename: label }); } catch (e) { errs.push(`${label}: ${e.message}${e.stack && /:(\d+)/.test(e.stack.split(NLCHAR)[0]) ? " (script line " + e.stack.split(NLCHAR)[0].match(/:(\d+)/)[1] + ")" : ""}`); } }
      }
      const ids = [...content.matchAll(/\bid\s*=\s*["']([^"']+)["']/g)].map((x) => x[1]), dup = ids.filter((x, i) => ids.indexOf(x) !== i);
      if (dup.length) errs.push("duplicate id attributes: " + [...new Set(dup)].join(", "));
      return errs.join(NLCHAR);
    }
    if (ext === ".py") return await new Promise((res) => require("child_process").execFile("python", ["-c", "import ast,sys; ast.parse(open(sys.argv[1],encoding='utf-8').read(), sys.argv[1])", fp], { timeout: 8000, windowsHide: true },
      (e, so, se) => res(e && e.code !== "ENOENT" && !/not recognized|not found/i.test(String(se)) ? String(se).trim().split(/\r?\n/).slice(-4).join(NLCHAR) : "")));
    if (ext === ".css") { const open = (content.match(/{/g) || []).length, close = (content.match(/}/g) || []).length; return open === close ? "" : `unbalanced braces: ${open} "{" vs ${close} "}"`; }
  } catch {}
  return "";
}
const NLCHAR = String.fromCharCode(10);
const withCheck = async (msg, fp, content) => { const err = await syntaxCheck(fp, content); return err ? `${msg}\n\n⚠ SYNTAX CHECK FAILED — fix this now before doing anything else:\n${err}` : msg + " Syntax check passed."; };

function fmtPreview(r, js) {
  if (!r) return "No preview tab is open. Open one with open_preview, serve_static or start_server.";
  if (r.error) return `Preview error: ${r.error}`;
  let out = `title: ${r.title}\nurl: ${r.url}\n`;
  if (r.loadError) out += `LOAD FAILED: ${r.loadError}\n`;
  out += r.errors && r.errors.length ? `console errors (${r.errors.length}):\n${r.errors.slice(-15).map((e) => "  ✗ " + e).join(NLCHAR)}\n` : "console errors: none\n";
  if (js) out += `js result: ${clip(typeof r.result === "string" ? r.result : JSON.stringify(r.result, null, 1) ?? "undefined", 8000)}\n`;
  return out + `--- visible text ---\n${clip(r.text || "(page has no text)", js ? 6000 : 1500)}`;
}
/** Right after a page is opened, read it once so the model sees load/console errors without spending another turn. */
async function autoDiag(ctx) {
  try { await new Promise((r) => setTimeout(r, 1300)); return "\n\n--- automatic page check ---\n" + fmtPreview(await ctx.ui.previewRead({}), false) + "\n(If there are console errors fix them now. Call preview_read only to test interactions with js.)"; }
  catch { return ""; }
}

/* ---------- tool implementations ---------- */

const impl = {
  async read_file(a, ctx) {
    const fp = resolveIn(ctx.cwd, a.path);
    const st = await fsp.stat(fp).catch(() => null);
    if (!st) return `File not found: ${a.path}`;
    if (st.isDirectory()) return `${a.path} is a directory — use list_dir.`;
    if (st.size > 8e6) return `File is too large to read (${human(st.size)}). Use grep to find the part you need.`;
    const buf = await fsp.readFile(fp);
    if (looksBinary(buf)) return `${a.path} is a binary file (${human(st.size)}); it cannot be read as text.`;
    const lines = buf.toString("utf8").replace(/^\uFEFF/, "").split(/\r?\n/);
    const from = Math.max(1, a.offset || 1), limit = Math.min(Math.max(1, a.limit || 800), 3000);
    const slice = lines.slice(from - 1, from - 1 + limit);
    let out = slice.map((l, i) => String(from + i).padStart(5) + "\t" + (l.length > 1500 ? l.slice(0, 1500) + " …[line truncated]" : l)).join("\n");
    if (out.length > 90000) out = out.slice(0, 90000) + "\n…[truncated — read a smaller range]";
    const last = from - 1 + slice.length;
    return (out || "(empty file)") + (last < lines.length ? `\n\n[lines ${from}-${last} of ${lines.length}; continue with offset=${last + 1}]` : "");
  },

  async write_file(a, ctx) {
    const fp = resolveIn(ctx.cwd, a.path);
    const before = await fsp.readFile(fp, "utf8").catch(() => null);
    await fsp.mkdir(path.dirname(fp), { recursive: true });
    const whole = a.append && before !== null ? before + (before.endsWith(NLCHAR) || !before ? "" : NLCHAR) + a.content : a.content;
    await fsp.writeFile(fp, whole, "utf8");
    ctx.changed({ path: fp, before, after: whole, kind: before === null ? "create" : "write" });
    if (a.more) return `Wrote part of ${rel(ctx.cwd, fp)} (${whole.split(NLCHAR).length} lines so far). Continue immediately with write_file append=true for the next part.`;
    if (a.append) return withCheck(`Appended to ${rel(ctx.cwd, fp)} (${whole.split(NLCHAR).length} lines total).`, fp, whole);
    const n = a.content.split("\n").length;
    return withCheck(before === null ? `Created ${rel(ctx.cwd, fp)} (${n} lines).` : `Overwrote ${rel(ctx.cwd, fp)} (${n} lines, was ${before.split("\n").length}).`, fp, a.content);
  },

  async edit_file(a, ctx) {
    const fp = resolveIn(ctx.cwd, a.path);
    const raw = await fsp.readFile(fp, "utf8").catch(() => null);
    if (raw === null) return `File not found: ${a.path}. Use write_file to create it.`;
    if (a.old_string === a.new_string) return "old_string and new_string are identical — nothing to change.";
    const crlf = raw.includes("\r\n");
    const text = crlf ? raw.replace(/\r\n/g, "\n") : raw;
    const oldS = String(a.old_string).replace(/\r\n/g, "\n"), newS = String(a.new_string).replace(/\r\n/g, "\n");
    if (oldS === "") return "old_string is empty. To create or replace a whole file use write_file.";
    const count = text.split(oldS).length - 1;
    if (count === 0) {
      const fl = text.split(NLCHAR), ol = oldS.split(NLCHAR).map((l) => l.trim()); while (ol.length && !ol[ol.length - 1]) ol.pop(); while (ol.length && !ol[0]) ol.shift();
      const starts = [];
      if (ol.length) for (let i = 0; i + ol.length <= fl.length; i++) { let ok = true; for (let j = 0; j < ol.length; j++) if (fl[i + j].trim() !== ol[j]) { ok = false; break; } if (ok) starts.push(i); }
      if (starts.length === 1) {
        const i = starts[0], indent = (fl[i].match(/^\s*/) || [""])[0], nl = newS.replace(/^\n+|\s+$/g, "").split(NLCHAR), base = (nl.find((l) => l.trim()) || "").match(/^\s*/)[0];
        const fitted = nl.map((l) => (l.trim() ? indent + (l.startsWith(base) ? l.slice(base.length) : l.trimStart()) : ""));
        const next2 = [...fl.slice(0, i), ...fitted, ...fl.slice(i + ol.length)].join(NLCHAR);
        await fsp.writeFile(fp, crlf ? next2.replace(/\n/g, "\r\n") : next2, "utf8");
        ctx.changed({ path: fp, before: raw, after: next2, kind: "edit", oldS: fl.slice(i, i + ol.length).join(NLCHAR), newS: fitted.join(NLCHAR) });
        return withCheck(`Edited ${rel(ctx.cwd, fp)} at lines ${i + 1}-${i + ol.length} (matched ignoring indentation).`, fp, next2);
      }
      if (starts.length > 1) return `old_string matches ${starts.length} places in ${a.path} (lines ${starts.slice(0, 5).map((x) => x + 1).join(", ")}). Add one or two neighbouring lines to make it unique.`;
      const first = oldS.trim().split("\n")[0].trim();
      const hint = first ? text.split("\n").findIndex((l) => l.includes(first)) : -1;
      return `old_string was not found in ${a.path}. It must match exactly, including indentation.` + (hint >= 0 ? ` A similar line is at line ${hint + 1} — read_file around it and retry.` : " Read the file again and retry.");
    }
    if (count > 1 && !a.replace_all) return `old_string occurs ${count} times in ${a.path}. Add more surrounding lines to make it unique, or set replace_all.`;
    const next = a.replace_all ? text.split(oldS).join(newS) : text.replace(oldS, () => newS);
    await fsp.writeFile(fp, crlf ? next.replace(/\n/g, "\r\n") : next, "utf8");
    ctx.changed({ path: fp, before: raw, after: next, kind: "edit", oldS, newS });
    return withCheck(`Edited ${rel(ctx.cwd, fp)} (${a.replace_all ? count : 1} replacement${count > 1 && a.replace_all ? "s" : ""}).`, fp, next);
  },

  async multi_edit(a, ctx) {
    const fp = resolveIn(ctx.cwd, a.path);
    const raw = await fsp.readFile(fp, "utf8").catch(() => null);
    if (raw === null) return `File not found: ${a.path}. Use write_file to create it.`;
    if (!Array.isArray(a.edits) || !a.edits.length) return "edits must be a non-empty array of {old_string, new_string}.";
    const crlf = raw.includes("\r\n");
    let text = crlf ? raw.replace(/\r\n/g, "\n") : raw;
    for (let i = 0; i < a.edits.length; i++) {
      const e = a.edits[i] || {}, oldS = String(e.old_string == null ? "" : e.old_string).replace(/\r\n/g, "\n"), newS = String(e.new_string == null ? "" : e.new_string).replace(/\r\n/g, "\n");
      const tag = `Edit ${i + 1}/${a.edits.length} failed — nothing was written.`;
      if (!oldS) return `${tag} old_string is empty.`;
      if (oldS === newS) return `${tag} old_string and new_string are identical.`;
      const count = text.split(oldS).length - 1;
      if (count === 0) {
        const first = oldS.trim().split("\n")[0].trim(), hint = first ? text.split("\n").findIndex((l) => l.includes(first)) : -1;
        return `${tag} old_string was not found (it must match exactly, including indentation; earlier edits in this call are already applied to the text it is matched against).` + (hint >= 0 ? ` A similar line is at line ${hint + 1} of the current text.` : "");
      }
      if (count > 1 && !e.replace_all) return `${tag} old_string occurs ${count} times — add surrounding lines to make it unique, or set replace_all.`;
      text = e.replace_all ? text.split(oldS).join(newS) : text.replace(oldS, () => newS);
    }
    await fsp.writeFile(fp, crlf ? text.replace(/\n/g, "\r\n") : text, "utf8");
    ctx.changed({ path: fp, before: raw, after: text, kind: "edit", oldS: a.edits.map((e) => e.old_string).join("\n…\n"), newS: a.edits.map((e) => e.new_string).join("\n…\n") });
    return withCheck(`Applied ${a.edits.length} edits to ${rel(ctx.cwd, fp)}.`, fp, text);
  },

  async read_many(a, ctx) {
    const list = (Array.isArray(a.files) ? a.files : []).slice(0, 12);
    if (!list.length) return "files must be a non-empty array of {path, offset?, limit?}.";
    const out = [];
    for (const f of list) out.push(`===== ${f.path} =====\n` + (await impl.read_file(f, ctx)));
    return out.join("\n\n");
  },

  async list_dir(a, ctx) {
    const root = resolveIn(ctx.cwd, a.path), depth = Math.min(Math.max(a.depth || 1, 1), 4);
    if (!fs.existsSync(root)) return `Directory not found: ${a.path || "."}`;
    const out = []; let count = 0;
    const go = async (dir, d, pad) => {
      let ents; try { ents = await fsp.readdir(dir, { withFileTypes: true }); } catch (e) { return out.push(pad + `[unreadable: ${e.code}]`); }
      ents.sort((x, y) => (y.isDirectory() - x.isDirectory()) || x.name.localeCompare(y.name));
      for (const e of ents) {
        if (++count > 600) { if (count === 601) out.push("… [more entries not shown]"); return; }
        if (e.isDirectory()) {
          const skip = SKIP_DIRS.has(e.name);
          out.push(`${pad}${e.name}/${skip ? "  (skipped)" : ""}`);
          if (!skip && d < depth) await go(path.join(dir, e.name), d + 1, pad + "  ");
        } else { let sz = ""; try { sz = human(fs.statSync(path.join(dir, e.name)).size); } catch {} out.push(`${pad}${e.name}  ${sz}`); }
      }
    };
    await go(root, 1, "");
    return `${root}\n` + (out.join("\n") || "(empty)");
  },

  async glob(a, ctx) {
    const root = resolveIn(ctx.cwd, a.path), re = globRe(a.pattern), hits = [];
    await walk(root, (abs, r) => { if (re.test(r)) hits.push(abs); return hits.length < 400; });
    if (!hits.length) return `No files match ${a.pattern}`;
    const withTime = hits.map((h) => { let t = 0; try { t = fs.statSync(h).mtimeMs; } catch {} return [h, t]; }).sort((x, y) => y[1] - x[1]);
    return withTime.map(([h]) => rel(ctx.cwd, h)).join("\n") + (hits.length >= 400 ? "\n… [limit reached — narrow the pattern]" : "");
  },

  async grep(a, ctx) {
    let re; try { re = new RegExp(a.pattern, a.ignore_case ? "i" : ""); } catch (e) { return `Invalid regex: ${e.message}`; }
    const root = resolveIn(ctx.cwd, a.path), gre = a.glob ? globRe(a.glob) : null, cx = Math.min(Math.max(a.context || 0, 0), 5);
    const st = await fsp.stat(root).catch(() => null);
    if (!st) return `Path not found: ${a.path}`;
    const files = [];
    if (st.isFile()) files.push(root);
    else await walk(root, (abs, r, e) => { if (!gre || gre.test(r)) files.push(abs); return files.length < 12000; });
    const out = []; let matches = 0, filesHit = 0;
    for (const f of files) {
      if (matches >= 250 || (ctx.signal && ctx.signal.aborted)) break;
      let buf; try { if (fs.statSync(f).size > 1500000) continue; buf = await fsp.readFile(f); } catch { continue; }
      if (looksBinary(buf)) continue;
      const lines = buf.toString("utf8").split(/\r?\n/); let hit = false;
      for (let i = 0; i < lines.length && matches < 250; i++) {
        if (!re.test(lines[i])) continue;
        matches++; hit = true;
        const name = rel(ctx.cwd, f);
        if (cx) { for (let j = Math.max(0, i - cx); j <= Math.min(lines.length - 1, i + cx); j++) out.push(`${name}${j === i ? ":" : "-"}${j + 1}${j === i ? ":" : "-"} ${lines[j].slice(0, 260)}`); out.push("--"); }
        else out.push(`${name}:${i + 1}: ${lines[i].trim().slice(0, 260)}`);
      }
      if (hit) filesHit++;
    }
    if (!matches) return `No matches for /${a.pattern}/ in ${files.length} files.`;
    return clip(out.join("\n")) + `\n\n[${matches}${matches >= 250 ? "+" : ""} matches in ${filesHit} files]`;
  },

  async run_command(a, ctx) {
    const cwd = resolveIn(ctx.cwd, a.cwd);
    if (!fs.existsSync(cwd)) return `Working directory not found: ${cwd}`;
    const timeoutMs = Math.min(Math.max(a.timeout_sec || 120, 1), 900) * 1000;
    const r = await runProc(a.command, { cwd, timeoutMs, signal: ctx.signal, shell: ctx.shell, onData: ctx.progress });
    const out = clip(r.out.trim());
    if (r.err) return `Could not start the command: ${r.err}`;
    if (r.aborted) return `Interrupted by the user.\n${out}`;
    if (r.timedOut) return `Timed out after ${timeoutMs / 1000}s and was killed. If this is a server or watcher, use start_server instead.\n${out}`;
    return (out || "(no output)") + `\n\n[exit code ${r.code}]`;
  },

  start_server: async (a, ctx) => { const out = await startServer(a, ctx); return /is open in the preview panel/.test(out) ? out + (await autoDiag(ctx)) : out; },
  serve_static: async (a, ctx) => { const out = await serveStatic(a, ctx); return /^Static server/.test(out) ? out + (await autoDiag(ctx)) : out; },
  async stop_server(a) { return stopServer(a.id) ? `Stopped ${a.id}.` : `No server with id ${a.id}. Running: ${serverList().map((s) => s.id).join(", ") || "none"}`; },
  async server_logs(a) {
    if (!a.id) { const l = serverList(); return l.length ? l.map((s) => `${s.id}  ${s.status}  ${s.url || "-"}  ${s.name}  (${s.command})`).join("\n") : "No background servers are running."; }
    if (!servers.has(a.id)) return `No server with id ${a.id} (it may have exited).`;
    return serverLogs(a.id, Math.min(a.lines || 60, 400)) || "(no output yet)";
  },

  async open_preview(a, ctx) {
    let url = String(a.target || "").trim();
    if (!/^https?:\/\//i.test(url)) {
      if (/^(localhost|127\.0\.0\.1)(:\d+)?(\/|$)/.test(url)) url = "http://" + url;
      else { const fp = resolveIn(ctx.cwd, url); if (!fs.existsSync(fp)) return `File not found: ${url}`; url = require("url").pathToFileURL(fp).href; }
    }
    ctx.ui.openPreview({ url, title: a.title, sid: ctx.sid });
    return `Opened ${url} in the preview panel.` + (await autoDiag(ctx));
  },

  async preview_read(a, ctx) {
    await new Promise((r) => setTimeout(r, Math.min(Math.max(a.wait_ms ?? 600, 0), 8000)));
    return fmtPreview(await ctx.ui.previewRead({ js: a.js }), a.js);
  },

  async ask_expert(a, ctx) { return ctx.askExpert ? ctx.askExpert(a.question) : "The expert is not enabled (Settings → Expert)."; },

  async library_search(a, ctx) { return library.search(a.query, ctx.libraryDirs); },
  async library_read(a, ctx) { return library.read(a.id, ctx.libraryDirs); },
  async sources_search(a) { return clip(await sources.search(a.source || "all", a.query), 16000); },
  async pkg_info(a) { return clip(await sources.pkgInfo(a.ecosystem || "npm", a.name), 12000); },
  async web_fetch(a) { return sources.fetchPage(a.url, Math.min(a.max_chars || 20000, 60000)); },

  async use_template(a, ctx) {
    const t = library.templates().find((x) => x.name === String(a.name).toLowerCase());
    if (!t) return `Unknown template "${a.name}". Available: ${library.templates().map((x) => x.name).join(", ")}`;
    const src = path.join(library.TEMPLATES, t.name), dest = resolveIn(ctx.cwd, a.dest), files = [];
    await walk(src, (abs, r) => { files.push(r); });
    const clash = files.filter((f) => fs.existsSync(path.join(dest, f)));
    if (clash.length && !a.overwrite) return `Could not copy: these files already exist in ${rel(ctx.cwd, dest) || "."}: ${clash.join(", ")}. Choose another dest folder or pass overwrite=true.`;
    for (const f of files) { await fsp.mkdir(path.dirname(path.join(dest, f)), { recursive: true }); await fsp.copyFile(path.join(src, f), path.join(dest, f)); }
    return `Copied template "${t.name}" (${t.title}) → ${files.map((f) => rel(ctx.cwd, path.join(dest, f))).join(", ")}.\nRun: ${t.run}\n${t.notes}\nNow read the file(s) you need to change and customise with edit_file — do not rewrite them from scratch.`;
  },

  async todo_write(a, ctx) {
    const todos = (Array.isArray(a.todos) ? a.todos : []).slice(0, 40).map((t) => ({ text: String(t.text || "").slice(0, 300), status: ["pending", "in_progress", "done"].includes(t.status) ? t.status : "pending" }));
    ctx.setTodos(todos);
    return `Task list updated (${todos.filter((t) => t.status === "done").length}/${todos.length} done).`;
  },

  async delete_file(a, ctx) {
    const fp = resolveIn(ctx.cwd, a.path);
    if (!isInside(ctx.cwd, fp)) return `Refused: ${a.path} is outside the workspace.`;
    if (path.relative(ctx.cwd, fp) === "") return "Refused: that is the workspace folder itself.";
    if (!fs.existsSync(fp)) return `File or directory not found: ${a.path}`;
    const before = await fsp.readFile(fp, "utf8").catch(() => null);
    const st = await fsp.stat(fp);
    if (st.isDirectory()) {
      if (!a.recursive) return `${a.path} is a directory. Set recursive=true to delete it and its contents.`;
      await fsp.rm(fp, { recursive: true, force: true });
      ctx.changed({ path: fp, before: null, after: null, kind: "delete" });
      return `Deleted directory ${rel(ctx.cwd, fp)} recursively.`;
    }
    await fsp.unlink(fp);
    ctx.changed({ path: fp, before, after: null, kind: "delete" });
    return `Deleted file ${rel(ctx.cwd, fp)}.`;
  },

  async move_file(a, ctx) {
    const src = resolveIn(ctx.cwd, a.source);
    const dest = resolveIn(ctx.cwd, a.destination);
    if (!isInside(ctx.cwd, src) || !isInside(ctx.cwd, dest)) return "Refused: source and destination must both be inside the workspace.";
    if (!fs.existsSync(src)) return `Source not found: ${a.source}`;
    if (fs.existsSync(dest) && !a.overwrite) return `Destination already exists: ${a.destination}. Set overwrite=true to replace it.`;
    await fsp.mkdir(path.dirname(dest), { recursive: true });
    await fsp.rename(src, dest);
    return `Moved ${rel(ctx.cwd, src)} → ${rel(ctx.cwd, dest)}.`;
  },

  async copy_file(a, ctx) {
    const src = resolveIn(ctx.cwd, a.source);
    const dest = resolveIn(ctx.cwd, a.destination);
    if (!isInside(ctx.cwd, src) || !isInside(ctx.cwd, dest)) return "Refused: source and destination must both be inside the workspace.";
    if (!fs.existsSync(src)) return `Source not found: ${a.source}`;
    if (fs.existsSync(dest) && !a.overwrite) return `Destination already exists: ${a.destination}. Set overwrite=true to replace it.`;
    await fsp.mkdir(path.dirname(dest), { recursive: true });
    const st = await fsp.stat(src);
    if (st.isDirectory()) {
      await fsp.cp(src, dest, { recursive: true, force: true });
      return `Copied directory ${rel(ctx.cwd, src)} → ${rel(ctx.cwd, dest)}.`;
    }
    await fsp.copyFile(src, dest);
    return `Copied file ${rel(ctx.cwd, src)} → ${rel(ctx.cwd, dest)}.`;
  },

  /* ---------- Antillusion Project Self-Inspection & Safe Modification Tools ---------- */

  async project_fork_status(a, ctx) {
    const antRoot = path.resolve(__dirname, "..");
    const parentDir = path.dirname(antRoot);
    const backupDir = path.join(parentDir, "antillusion_backup");
    const devDir = path.join(parentDir, "antillusion_dev");
    return JSON.stringify({
      antillusion_original: { path: antRoot, exists: fs.existsSync(antRoot) },
      antillusion_backup: { path: backupDir, exists: fs.existsSync(backupDir) },
      antillusion_dev: { path: devDir, exists: fs.existsSync(devDir), activeFork: fs.existsSync(devDir) },
      note: "Backup (antillusion_backup) holds the working untouched copy. Dev (antillusion_dev) is where new modifications are applied."
    }, null, 2);
  },

  async project_list_files(a, ctx) {
    const antRoot = path.resolve(__dirname, "..");
    const parentDir = path.dirname(antRoot);
    const devDir = path.join(parentDir, "antillusion_dev");
    const targetRoot = fs.existsSync(devDir) ? devDir : antRoot;
    let sub; try { sub = inProject(targetRoot, a.subpath); } catch (e) { return e.message; }
    const depth = Math.min(Math.max(a.depth || 2, 1), 4);
    if (!fs.existsSync(sub)) return `Directory not found in project: ${a.subpath || "."}`;
    const out = [];
    const go = async (dir, d, pad) => {
      let ents; try { ents = await fsp.readdir(dir, { withFileTypes: true }); } catch { return; }
      ents.sort((x, y) => (y.isDirectory() - x.isDirectory()) || x.name.localeCompare(y.name));
      for (const e of ents) {
        if (SKIP_DIRS.has(e.name)) continue;
        if (e.isDirectory()) {
          out.push(`${pad}${e.name}/`);
          if (d < depth) await go(path.join(dir, e.name), d + 1, pad + "  ");
        } else {
          let sz = ""; try { sz = human(fs.statSync(path.join(dir, e.name)).size); } catch {}
          out.push(`${pad}${e.name}  ${sz}`);
        }
      }
    };
    await go(sub, 1, "");
    return `Project source [${targetRoot === devDir ? "ACTIVE DEV FORK" : "ORIGINAL"}]:\n` + (out.join("\n") || "(empty)");
  },

  async project_read_source(a, ctx) {
    const antRoot = path.resolve(__dirname, "..");
    const parentDir = path.dirname(antRoot);
    const devDir = path.join(parentDir, "antillusion_dev");
    // Read from dev fork if present, else original
    let targetRoot = fs.existsSync(devDir) ? devDir : antRoot;
    let fp; try { fp = inProject(targetRoot, a.path); } catch (e) { return e.message; }
    if (!fs.existsSync(fp) && targetRoot === devDir) {
      // fallback to original if not yet created in dev
      fp = inProject(antRoot, a.path);
    }
    const st = await fsp.stat(fp).catch(() => null);
    if (!st) return `Antillusion file not found: ${a.path}`;
    if (st.isDirectory()) return `${a.path} is a directory — use project_list_files.`;
    const buf = await fsp.readFile(fp);
    const lines = buf.toString("utf8").replace(/^\uFEFF/, "").split(/\r?\n/);
    const from = Math.max(1, a.offset || 1), limit = Math.min(Math.max(1, a.limit || 800), 3000);
    const slice = lines.slice(from - 1, from - 1 + limit);
    let out = slice.map((l, i) => String(from + i).padStart(5) + "\t" + l).join("\n");
    const last = from - 1 + slice.length;
    return `[Antillusion source file: ${a.path} (${lines.length} lines total)]\n` + out + (last < lines.length ? `\n\n[lines ${from}-${last} of ${lines.length}; continue with offset=${last + 1}]` : "");
  },

  async project_modify_source(a, ctx) {
    try { inProject(path.resolve(__dirname, ".."), a.path); } catch (e) { return e.message; }
    const antRoot = path.resolve(__dirname, "..");
    const parentDir = path.dirname(antRoot);
    const backupDir = path.join(parentDir, "antillusion_backup");
    const devDir = path.join(parentDir, "antillusion_dev");
    
    // Ensure backup copy exists
    if (!fs.existsSync(backupDir)) {
      await fsp.cp(antRoot, backupDir, { recursive: true });
    }
    // Ensure active dev fork exists
    if (!fs.existsSync(devDir)) {
      await fsp.cp(antRoot, devDir, { recursive: true });
    }
    
    let targetFile; try { targetFile = inProject(devDir, a.path); } catch (e) { return e.message; }
    await fsp.mkdir(path.dirname(targetFile), { recursive: true });
    const before = await fsp.readFile(targetFile, "utf8").catch(() => null);
    const content = a.append && before !== null ? before + (before.endsWith(NLCHAR) ? "" : NLCHAR) + a.content : a.content;
    await fsp.writeFile(targetFile, content, "utf8");
    return withCheck(`[Antillusion Dev Fork] Wrote ${a.path} in ${devDir} (${content.split(NLCHAR).length} lines). Original safely preserved in antillusion_backup.`, targetFile, content);
  },

  async project_edit_source(a, ctx) {
    try { inProject(path.resolve(__dirname, ".."), a.path); } catch (e) { return e.message; }
    const antRoot = path.resolve(__dirname, "..");
    const parentDir = path.dirname(antRoot);
    const backupDir = path.join(parentDir, "antillusion_backup");
    const devDir = path.join(parentDir, "antillusion_dev");
    
    // Ensure backup and dev exist
    if (!fs.existsSync(backupDir)) {
      await fsp.cp(antRoot, backupDir, { recursive: true });
    }
    if (!fs.existsSync(devDir)) {
      await fsp.cp(antRoot, devDir, { recursive: true });
    }
    
    let targetFile; try { targetFile = inProject(devDir, a.path); } catch (e) { return e.message; }
    let raw = await fsp.readFile(targetFile, "utf8").catch(() => null);
    if (raw === null) {
      // copy from original if not yet in dev
      const origFile = inProject(antRoot, a.path);
      raw = await fsp.readFile(origFile, "utf8").catch(() => null);
      if (raw === null) return `File not found in Antillusion: ${a.path}`;
    }
    
    const crlf = raw.includes("\r\n");
    const text = crlf ? raw.replace(/\r\n/g, "\n") : raw;
    const oldS = String(a.old_string).replace(/\r\n/g, "\n");
    const newS = String(a.new_string).replace(/\r\n/g, "\n");
    if (!text.includes(oldS)) {
      return `old_string was not found in ${a.path} inside antillusion_dev. Make sure to read the file first using project_read_source.`;
    }
    const count = text.split(oldS).length - 1;
    if (count > 1 && !a.replace_all) {
      return `old_string occurs ${count} times in ${a.path}. Set replace_all=true or include more context lines.`;
    }
    const next = a.replace_all ? text.split(oldS).join(newS) : text.replace(oldS, () => newS);
    await fsp.writeFile(targetFile, crlf ? next.replace(/\n/g, "\r\n") : next, "utf8");
    return withCheck(`[Antillusion Dev Fork] Edited ${a.path} (${a.replace_all ? count : 1} replacement${count > 1 ? "s" : ""}). Backup preserved.`, targetFile, next);
  },
};

async function runTool(name, args, ctx) {
  const fn = impl[name];
  if (!fn) return `Unknown tool: ${name}. Available: ${DEFS.map((d) => d.name).join(", ")}`;
  const def = BY_NAME.get(name);
  for (const req of def.parameters.required || []) if (args[req] === undefined || args[req] === null) return `Missing required parameter "${req}" for ${name}.`;
  try { return clip(String(await fn(args, ctx))); }
  catch (e) { return `Tool error (${name}): ${e.message}`; }
}

module.exports = { DEFS, toolDefs, kindOf, runTool, isDangerous, normCmd, shellSpec, runProc, resolveIn, isInside, walk, globRe,
  serverList, serverLogs, stopServer, stopAllServers, onServersChanged };
