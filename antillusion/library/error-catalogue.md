# Error catalogue: message → cause → fix
tags: error bug fix exception failed cannot undefined module cors port syntax crash خطا اخطاء مشكله لا يعمل اصلاح تعطل

JavaScript / browser
- `Uncaught SyntaxError: Cannot use import statement outside a module` → add `type="module"` to the script tag (Node: `"type":"module"` in package.json or `.mjs`).
- `Failed to resolve module specifier "three"` → bare import in the browser without an importmap/bundler; add an importmap or use a full URL.
- `Access to script at 'file://…' has been blocked by CORS` → ES modules do not load from file://; serve the folder (serve_static).
- `X is not defined` / `Cannot read properties of undefined (reading 'y')` → typo, wrong load order, DOM queried before it exists (move the script to the end / use `defer`), async data used before it arrived; guard with optional chaining only when absence is legitimate.
- `X is not a function` → default vs named import mismatch, shadowed name, or API changed in a new major version (check pkg_info).
- `Identifier 'x' has already been declared` → duplicate top-level `const/let` (two scripts share the global scope) — wrap in a module or rename.
- `Maximum call stack size exceeded` → unbounded recursion or a setter/effect that triggers itself.
- `blocked by CORS policy` on fetch → the server must send `Access-Control-Allow-Origin`; in dev proxy through the dev server; it cannot be fixed from the page.
- `Unexpected token '<', "<!DOCTYPE"… is not valid JSON` → the URL returned an HTML error page (404/500 or SPA fallback); log `res.status` and fix the path.
- `Mixed Content` → https page requesting http; use https or a relative URL.
- Canvas/WebGL blank with no error → size is 0 (set width/height after layout), drawing before assets loaded, or camera/light issue in 3D.

Node / npm
- `Cannot find module 'x'` / `ERR_MODULE_NOT_FOUND` → not installed (`npm i x`), wrong cwd, or missing `.js` extension in an ESM relative import.
- `require is not defined in ES module scope` → use `import`, or rename to `.cjs`.
- `EADDRINUSE :::3000` → a server is already on that port: stop_server it or pick another port.
- `EACCES` / `EPERM` → file locked by a running process (Windows) or no permission; stop the process using it.
- `npm ERR! ERESOLVE` → peer dependency conflict; install the version the peer expects (read the message) — `--legacy-peer-deps` only as a last resort.
- `'vite' is not recognized` / `command not found` → dependencies not installed in this folder (`npm install`) or wrong directory.
- Command hangs → it is waiting for input: add the non-interactive flags, or it is a server: use start_server.

React / Vite / TypeScript
- `Too many re-renders` → state set during render; move into an event handler or effect.
- `Each child in a list should have a unique "key"` → add a stable `key` (id).
- `Hydration failed` (Next) → server and client rendered different HTML (dates, random, window checks); render those parts in an effect or mark the component client-only.
- `Property 'x' does not exist on type` → the type really lacks it: fix the type/shape, do not cast to `any`.
- White page after build but fine in dev → wrong `base` path or absolute asset URLs; check the console and network tab.

Python
- `ModuleNotFoundError` → installed into a different interpreter: use `.venv/Scripts/python -m pip install x` and run with the same interpreter.
- `IndentationError` / `TabError` → mixed tabs and spaces; use 4 spaces.
- `UnicodeDecodeError` / garbled Arabic → pass `encoding="utf-8"` (or `utf-8-sig` for Excel CSVs); on Windows consoles set `PYTHONIOENCODING=utf-8`.
- `TypeError: 'NoneType' object is not subscriptable` → a function returned None (missing `return`, failed lookup).
- `sqlite3.OperationalError: database is locked` → another connection holds a write; commit/close promptly, enable WAL.
- `address already in use` → same as EADDRINUSE.

Git
- `fatal: not a git repository` → wrong folder or `git init` needed. `Updates were rejected` → `git pull --rebase` first. `CONFLICT` → resolve the markers, `git add`, continue. `Author identity unknown` → ask the user for name/email (or use `-c user.name=… -c user.email=…` for that one command).

When the message is unfamiliar: search it verbatim (sources_search source=stackoverflow or github) before guessing.
