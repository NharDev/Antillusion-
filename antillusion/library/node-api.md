# Node.js back-end and REST API design
tags: node express fastify hono api rest server backend http middleware validation error handling json خادم سيرفر واجهه برمجيه باك اند

Shape: `src/server.ts` (boot), `src/app.ts` (app factory — testable), `src/routes/*.ts`, `src/services/*.ts` (business logic, no HTTP), `src/db/*` (queries), `src/lib/*`, `src/config.ts` (reads and validates env with zod once). Use ESM (`"type":"module"`) and `node --watch` in dev; TypeScript via `tsx watch src/server.ts`.

Every endpoint: validate input (zod) → authorise → call service → map to response. Never trust body/query/params/headers.

REST conventions: nouns and plurals (`GET /api/todos`, `POST /api/todos`, `GET/PATCH/DELETE /api/todos/:id`); status codes 200/201/204, 400 (validation), 401 (not logged in), 403 (not allowed), 404, 409 (conflict), 422, 429, 500. Error body is uniform: `{ "error": { "code": "validation_error", "message": "…", "details": […] } }`. Lists paginate (`?limit=20&cursor=…` → `{ items, nextCursor }`), filter and sort through query params. Idempotency keys for payment-like POSTs. Version under `/api/v1` when public.

Cross-cutting: one error-handling middleware (log, hide internals in production); request id + structured logs (pino); `helmet`-style security headers; CORS allow-list (never `*` with credentials); rate limiting on auth and expensive routes; body size limits; graceful shutdown on SIGTERM (stop accepting, drain, close db); `/healthz`.

Express 5 minimal:
```js
import express from "express";
const app = express();
app.use(express.json({ limit: "1mb" }));
app.get("/api/todos", async (req, res) => res.json({ items: await db.list() }));   // v5 forwards async errors
app.use((err, req, res, next) => { console.error(err); res.status(err.status ?? 500).json({ error: { code: err.code ?? "internal", message: err.expose ? err.message : "Internal error" } }); });
app.listen(process.env.PORT ?? 3000);
```
Hono is the same idea with `c.req.valid()` + `@hono/zod-validator` and runs on Node, Bun, Deno and Workers.

Async hygiene: `await` everything or handle the rejection; `Promise.all` for independent work, `p-limit` for bounded concurrency; timeouts on outbound calls (`AbortSignal.timeout(ms)`); never block the event loop (move CPU work to worker threads / a queue).

Tests: `node:test` or Vitest + supertest against the app factory with an in-memory/temporary SQLite database.
