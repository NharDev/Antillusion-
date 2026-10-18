# Shell and Windows command reference
tags: shell bash powershell cmd windows terminal command path env process port kill npm اوامر طرفيه ويندوز باورشيل

The system prompt states which shell run_command uses. Write commands for that shell.

| Task | bash (also Git Bash) | PowerShell |
|---|---|---|
| Chain on success | `a && b` | `a; if ($?) { b }` (PowerShell 7 supports `&&`) |
| Env var for one command | `PORT=4000 node s.js` | `$env:PORT=4000; node s.js` |
| List files | `ls -la` | `Get-ChildItem -Force` |
| Read / first lines | `cat f` / `head -n 20 f` | `Get-Content f -TotalCount 20` |
| Find text | `grep -rn "x" src` | `Select-String -Path src\* -Pattern x -Recurse` |
| Make dirs | `mkdir -p a/b` | `New-Item -ItemType Directory -Force a\b` |
| Copy / move / delete | `cp -r a b` / `mv a b` / `rm -r a` | `Copy-Item a b -Recurse` / `Move-Item` / `Remove-Item a -Recurse` |
| Which program | `which node` | `(Get-Command node).Source` |
| Who uses port 3000 | `netstat -ano | grep :3000` | `Get-NetTCPConnection -LocalPort 3000` |
| Kill by PID | `taskkill //PID 1234 //F` (Git Bash) / `kill 1234` | `Stop-Process -Id 1234 -Force` |
| Download | `curl -fsSL url -o file` | `Invoke-WebRequest url -OutFile file` |
| JSON | `jq '.a.b' f.json` | `(Get-Content f.json | ConvertFrom-Json).a.b` |

Prefer the dedicated tools over shell for reading, searching and editing files (read_file, grep, glob, edit_file) — they are faster and their output is structured.

Git Bash on Windows: paths look like `/c/Users/me/project`; Windows programs accept forward slashes; quote paths with spaces; a leading `/flag` argument gets path-mangled — write `//flag` or set `MSYS_NO_PATHCONV=1`. Python is usually `python` (not `python3`) and the venv interpreter is `.venv/Scripts/python`.

npm: `npm ci` for reproducible installs, `npm i pkg@version`, `npm i -D pkg`, `npm run <script> -- --flag` to pass flags through, `npx --yes pkg` to run without prompting, `npm ls pkg` to see what resolved, `npm outdated`. Delete `node_modules` + lockfile only as a last resort.

Non-interactive rule: anything that may prompt needs its yes/flags (`-y`, `--yes`, `--no-input`, `--template`, `CI=1`). A command that sits waiting will hit the timeout.

Long-running processes (dev servers, watchers, `tail -f`) never go through run_command — use start_server and read them with server_logs.
