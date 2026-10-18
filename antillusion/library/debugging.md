# Debugging method
tags: debug bug error fix crash stack trace exception troubleshooting not working fails تصحيح اخطاء مشكله لا يعمل

1. Reproduce reliably and capture the exact error text, stack trace and the smallest input that triggers it. Read the whole message — the first error is usually the cause; later ones are fallout.
2. Locate: go to the top stack frame in the project's own code; grep for the error string or the symbol; check what changed recently (`git diff`, `git log -5`).
3. Hypothesise one cause; test it with the cheapest experiment (a log line, a REPL call, a unit test, preview_read with a JS probe). Do not change several things at once.
4. Fix the cause, not the symptom (no blanket try/catch, no arbitrary sleep, no `any`/`!` to silence a type error that is telling the truth).
5. Verify with the original reproduction, then run the wider test suite; add a regression test.

Frequent causes by symptom:
- "X is not a function / undefined": wrong import (default vs named, ESM vs CommonJS), wrong `this`, async value used before await, API changed between versions (check pkg_info / the changelog).
- "Cannot find module": not installed, wrong working directory, missing file extension in ESM imports, tsconfig paths not mirrored in the bundler.
- Works locally, fails built/deployed: env vars missing, case-sensitive paths on Linux, dev-only dependency, hard-coded localhost, relative asset paths, Node version.
- Blank page: an exception during first render (read the console), wrong script path (404 in network), `type="module"` missing, element queried before DOM ready.
- CORS error: it is the server's response headers that must change (or proxy through the dev server); it is never fixed in the browser code.
- Port in use (EADDRINUSE): another instance still runs — stop it (stop_server) or choose another port.
- Infinite re-render / request loop: effect deps unstable (new object/array/function each render) or state set during render.
- Flaky async test: missing await, shared state between tests, real timers/network.
- Encoding garbage with Arabic: file or response not UTF-8 (`<meta charset="utf-8">`, `Content-Type: …; charset=utf-8`, `encoding="utf-8"` in Python open()).
- Windows-specific: path separators and quoting, `&&` in PowerShell 5, long paths, CRLF line endings in shell scripts, file locked by a running process.
- Python: wrong interpreter/venv (`python -c "import sys; print(sys.executable)"`), circular import, mutable default argument, blocking call in async code.
- Database: missing migration, transaction not committed, connection pool exhausted, timezone-naive datetimes.

When stuck after two attempts on the same idea: step back, re-read the error, question the assumption you have not checked, and search the exact message with sources_search (stackoverflow / github).
