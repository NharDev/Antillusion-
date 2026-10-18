# JavaScript snippets worth copying
tags: javascript js fetch async promise array object date debounce storage dom events module دوال جافاسكربت جلب بيانات تخزين احداث

```js
// fetch with timeout, status check and JSON
async function api(url, { method = "GET", body, timeout = 10000, headers } = {}) {
  const r = await fetch(url, { method, headers: { "Content-Type": "application/json", ...headers }, body: body && JSON.stringify(body), signal: AbortSignal.timeout(timeout) });
  if (!r.ok) throw Object.assign(new Error((await r.text()).slice(0, 200) || r.statusText), { status: r.status });
  return r.status === 204 ? null : r.json();
}
const debounce = (fn, ms = 250) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };
const throttle = (fn, ms = 100) => { let last = 0; return (...a) => { const now = Date.now(); if (now - last >= ms) { last = now; fn(...a); } }; };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const groupBy = (xs, f) => xs.reduce((m, x) => ((m[f(x)] ||= []).push(x), m), {});
const uniqBy = (xs, f) => [...new Map(xs.map((x) => [f(x), x])).values()];
const sortBy = (xs, f, dir = 1) => [...xs].sort((a, b) => (f(a) > f(b) ? dir : f(a) < f(b) ? -dir : 0));
const escapeHtml = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const uid = () => crypto.randomUUID();
// localStorage with a default and safe parsing
const store = { get: (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } }, set: (k, v) => localStorage.setItem(k, JSON.stringify(v)) };
// bounded concurrency
async function mapLimit(items, n, fn) { const out = []; let i = 0; await Promise.all(Array.from({ length: n }, async () => { while (i < items.length) { const j = i++; out[j] = await fn(items[j], j); } })); return out; }
// retry with exponential backoff
async function retry(fn, tries = 3, base = 400) { for (let i = 0; ; i++) { try { return await fn(); } catch (e) { if (i >= tries - 1) throw e; await sleep(base * 2 ** i + Math.random() * 100); } } }
```
DOM: `const $ = (s, r = document) => r.querySelector(s)`; build with `document.createElement` + `textContent` (never innerHTML with user data); delegate events on a container with `e.target.closest("[data-action]")`; `el.toggleAttribute("hidden", cond)`; `new FormData(form)` → `Object.fromEntries(fd)`; `structuredClone(obj)` for deep copies.

Dates and numbers: `new Intl.DateTimeFormat("ar", { dateStyle: "medium" }).format(d)`, `new Intl.RelativeTimeFormat("ar").format(-3, "day")`, `new Intl.NumberFormat("ar-SA", { style: "currency", currency: "SAR" }).format(n)`; keep dates as ISO strings in UTC, compare with `getTime()`.

Modules: ESM everywhere (`import x from "./x.js"` with the extension in browsers and Node); top-level `await` is fine in modules; `import.meta.env` (Vite) / `process.env` (Node) for config.

Async rules: `await` in `try/catch`; run independent work with `Promise.all`; never `forEach(async …)` (use `for…of` or `Promise.all(map)`); cancel stale requests with `AbortController`.
