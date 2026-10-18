// Zero-dependency REST API + static front-end. Needs Node 22.13+ (built-in SQLite). Run: node server.js
// Layout: config · database · helpers · routes · static files · start. Add a resource by copying the "items" block.
import { createServer } from "node:http";
import { DatabaseSync } from "node:sqlite";
import { readFile } from "node:fs/promises";
import path from "node:path";

/* ---------- config ---------- */
const PORT = Number(process.env.PORT) || 3000;
const PUBLIC = path.join(import.meta.dirname, "public");

/* ---------- database ---------- */
const db = new DatabaseSync(process.env.DB_FILE || path.join(import.meta.dirname, "data.db"));
db.exec(`
  PRAGMA journal_mode = WAL;
  PRAGMA foreign_keys = ON;
  CREATE TABLE IF NOT EXISTS items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    price INTEGER NOT NULL DEFAULT 0,          -- smallest currency unit
    done INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
`);

/* ---------- helpers ---------- */
class HttpError extends Error { constructor(status, code, message) { super(message); this.status = status; this.code = code; } }
const send = (res, status, body) => { res.writeHead(status, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" }); res.end(body === undefined ? "" : JSON.stringify(body)); };
async function readJson(req) {
  let raw = "";
  for await (const chunk of req) { raw += chunk; if (raw.length > 1e6) throw new HttpError(413, "too_large", "Body too large"); }
  if (!raw) return {};
  try { return JSON.parse(raw); } catch { throw new HttpError(400, "bad_json", "Body is not valid JSON"); }
}
/** Minimal validation: returns clean values or throws 400 with every problem listed. */
function validateItem(body, partial = false) {
  const out = {}, problems = [];
  if (body.name !== undefined || !partial) { if (typeof body.name !== "string" || !body.name.trim() || body.name.length > 200) problems.push("name: required text, 1–200 characters"); else out.name = body.name.trim(); }
  if (body.price !== undefined) { if (!Number.isInteger(body.price) || body.price < 0) problems.push("price: non-negative integer"); else out.price = body.price; }
  if (body.done !== undefined) { if (typeof body.done !== "boolean") problems.push("done: boolean"); else out.done = body.done ? 1 : 0; }
  if (problems.length) throw new HttpError(400, "validation_error", problems.join("; "));
  return out;
}
const toItem = (r) => r && { ...r, done: !!r.done };

/* ---------- routes ---------- */
const routes = [
  ["GET", /^\/api\/items$/, (req, res, m, url) => {
    const limit = Math.min(Math.max(+url.searchParams.get("limit") || 20, 1), 100), offset = Math.max(+url.searchParams.get("offset") || 0, 0), q = url.searchParams.get("q") || "";
    const items = db.prepare("SELECT * FROM items WHERE name LIKE ? ORDER BY id DESC LIMIT ? OFFSET ?").all(`%${q}%`, limit, offset).map(toItem);
    const { total } = db.prepare("SELECT COUNT(*) AS total FROM items WHERE name LIKE ?").get(`%${q}%`);
    send(res, 200, { items, total, limit, offset });
  }],
  ["POST", /^\/api\/items$/, async (req, res) => {
    const v = validateItem(await readJson(req));
    const r = db.prepare("INSERT INTO items (name, price, done) VALUES (?, ?, ?)").run(v.name, v.price ?? 0, v.done ?? 0);
    send(res, 201, toItem(db.prepare("SELECT * FROM items WHERE id = ?").get(r.lastInsertRowid)));
  }],
  ["GET", /^\/api\/items\/(\d+)$/, (req, res, m) => {
    const item = toItem(db.prepare("SELECT * FROM items WHERE id = ?").get(+m[1]));
    if (!item) throw new HttpError(404, "not_found", "Item not found");
    send(res, 200, item);
  }],
  ["PATCH", /^\/api\/items\/(\d+)$/, async (req, res, m) => {
    const v = validateItem(await readJson(req), true), keys = Object.keys(v);
    if (!keys.length) throw new HttpError(400, "validation_error", "Nothing to update");
    const r = db.prepare(`UPDATE items SET ${keys.map((k) => k + " = ?").join(", ")} WHERE id = ?`).run(...keys.map((k) => v[k]), +m[1]);   // column names come from the validator, never from the client
    if (!r.changes) throw new HttpError(404, "not_found", "Item not found");
    send(res, 200, toItem(db.prepare("SELECT * FROM items WHERE id = ?").get(+m[1])));
  }],
  ["DELETE", /^\/api\/items\/(\d+)$/, (req, res, m) => {
    if (!db.prepare("DELETE FROM items WHERE id = ?").run(+m[1]).changes) throw new HttpError(404, "not_found", "Item not found");
    send(res, 204);
  }],
  ["GET", /^\/healthz$/, (req, res) => send(res, 200, { ok: true })],
];

/* ---------- static files ---------- */
const MIME = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".json": "application/json", ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg", ".ico": "image/x-icon" };
async function serveStatic(res, pathname) {
  const file = path.join(PUBLIC, pathname === "/" ? "index.html" : pathname);
  if (!file.startsWith(PUBLIC)) throw new HttpError(403, "forbidden", "Forbidden");
  try { const data = await readFile(file); res.writeHead(200, { "Content-Type": MIME[path.extname(file)] || "application/octet-stream" }); res.end(data); }
  catch { throw new HttpError(404, "not_found", "Not found"); }
}

/* ---------- start ---------- */
createServer(async (req, res) => {
  try {
    const url = new URL(req.url, "http://localhost");
    for (const [method, pattern, handler] of routes) {
      const m = url.pathname.match(pattern);
      if (m && req.method === method) return await handler(req, res, m, url);
    }
    if (url.pathname.startsWith("/api/")) throw new HttpError(404, "not_found", "No such endpoint");
    if (req.method !== "GET") throw new HttpError(405, "method_not_allowed", "Method not allowed");
    await serveStatic(res, decodeURIComponent(url.pathname));
  } catch (e) {
    if (!(e instanceof HttpError)) console.error(e);
    send(res, e.status || 500, { error: { code: e.code || "internal", message: e instanceof HttpError ? e.message : "Internal error" } });
  }
}).listen(PORT, () => console.log(`Listening on http://localhost:${PORT}`));
