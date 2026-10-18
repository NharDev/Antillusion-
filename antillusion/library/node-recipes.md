# Node.js recipes: files, HTTP server, SQLite, CLI
tags: node express server api sqlite file cli script backend crud rest خادم سيرفر واجهه برمجيه قاعده بيانات سكربت ملفات

Zero-dependency HTTP + JSON API (Node 22+, ESM):
```js
import { createServer } from "node:http";
import { DatabaseSync } from "node:sqlite";          // built in; or `better-sqlite3`
const db = new DatabaseSync("data.db");
db.exec("PRAGMA journal_mode=WAL; CREATE TABLE IF NOT EXISTS todos (id INTEGER PRIMARY KEY, title TEXT NOT NULL, done INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)");
const json = (res, status, body) => { res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" }); res.end(JSON.stringify(body)); };
const readBody = async (req) => { let s = ""; for await (const c of req) { s += c; if (s.length > 1e6) throw Object.assign(new Error("too large"), { status: 413 }); } return s ? JSON.parse(s) : {}; };
createServer(async (req, res) => {
  try {
    const url = new URL(req.url, "http://x"), id = Number(url.pathname.split("/")[3]);
    if (url.pathname === "/api/todos" && req.method === "GET") return json(res, 200, { items: db.prepare("SELECT * FROM todos ORDER BY id DESC LIMIT ? OFFSET ?").all(Math.min(+url.searchParams.get("limit") || 20, 100), +url.searchParams.get("offset") || 0) });
    if (url.pathname === "/api/todos" && req.method === "POST") { const { title } = await readBody(req); if (typeof title !== "string" || !title.trim()) return json(res, 400, { error: { code: "validation", message: "title is required" } }); const r = db.prepare("INSERT INTO todos (title) VALUES (?)").run(title.trim()); return json(res, 201, db.prepare("SELECT * FROM todos WHERE id = ?").get(r.lastInsertRowid)); }
    if (id && req.method === "PATCH") { const b = await readBody(req); const r = db.prepare("UPDATE todos SET title = COALESCE(?, title), done = COALESCE(?, done) WHERE id = ?").run(b.title ?? null, b.done == null ? null : +!!b.done, id); return r.changes ? json(res, 200, db.prepare("SELECT * FROM todos WHERE id = ?").get(id)) : json(res, 404, { error: { code: "not_found" } }); }
    if (id && req.method === "DELETE") { db.prepare("DELETE FROM todos WHERE id = ?").run(id); res.writeHead(204); return res.end(); }
    json(res, 404, { error: { code: "not_found" } });
  } catch (e) { json(res, e.status || (e instanceof SyntaxError ? 400 : 500), { error: { code: "error", message: e.status ? e.message : "Internal error" } }); if (!e.status) console.error(e); }
}).listen(process.env.PORT || 3000, () => console.log("http://localhost:" + (process.env.PORT || 3000)));
```
Start it with start_server (`node server.js`, port 3000) and test with web_fetch or `curl -s -X POST localhost:3000/api/todos -H "Content-Type: application/json" -d '{"title":"x"}'`.

Express equivalent: `app.use(express.json())`, `app.get/post/patch/delete`, static front-end with `app.use(express.static("public"))`, one error middleware last. Validate bodies with zod (`schema.safeParse(req.body)`).

Files: `import { readFile, writeFile, mkdir, readdir, rm, cp } from "node:fs/promises"`; paths with `node:path` (`path.join(import.meta.dirname, "x")`); streams for big files (`pipeline(createReadStream(a), createGzip(), createWriteStream(b))`); JSON config: read → modify → write with 2-space indent.

CLI script: `#!/usr/bin/env node`, `import { parseArgs } from "node:util"`; exit code non-zero on failure; progress to stderr, results to stdout.

Processes: `execFile("git", ["status", "--short"])` (args array, no shell injection); `spawn` for streaming output. Env: `node --env-file=.env app.js`. Watch mode: `node --watch app.js`. Tests: `node --test`.

Serving a front-end and API together in dev: Vite `server.proxy = { "/api": "http://localhost:3000" }`.
