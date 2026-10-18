# Project scaffolds — non-interactive commands, run commands and default ports
tags: scaffold create new project init template start port vite next react vue svelte astro expo fastapi django express tauri electron مشروع جديد انشاء بدء قالب

Always pass flags so nothing prompts. After scaffolding: install, then start_server with the dev command and the port below.

| Stack | Create | Dev command | Port |
|---|---|---|---|
| Plain site | write index.html, style.css, app.js | serve_static | auto |
| Vite + React TS | `npm create vite@latest app -- --template react-ts` | `npm run dev` | 5173 |
| Vite + Vue / Svelte / Solid / vanilla | same with `--template vue-ts` / `svelte-ts` / `solid-ts` / `vanilla-ts` | `npm run dev` | 5173 |
| Next.js | `npx create-next-app@latest app --ts --tailwind --eslint --app --src-dir --import-alias "@/*" --use-npm --yes` | `npm run dev` | 3000 |
| Astro | `npm create astro@latest app -- --template minimal --install --no-git --yes` | `npm run dev` | 4321 |
| SvelteKit | `npx sv create app --template minimal --types ts --no-add-ons --install npm` | `npm run dev` | 5173 |
| Nuxt | `npx nuxi@latest init app --packageManager npm --gitInit false` | `npm run dev` | 3000 |
| Express / Hono / Fastify | `npm init -y` + `npm i hono @hono/node-server` (or express / fastify) | `node --watch server.js` | 3000 |
| Expo (React Native) | `npx create-expo-app@latest app --template blank-typescript` | `npx expo start --web` | 8081 |
| Electron | `npm init -y && npm i -D electron`; main.js + preload.js + index.html | `npx electron .` | (window) |
| Tauri | `npm create tauri-app@latest app -- --template react-ts --manager npm --yes` | `npm run tauri dev` | 1420 |
| FastAPI | `python -m venv .venv` + `pip install "fastapi[standard]"` | `fastapi dev main.py` or `uvicorn main:app --reload` | 8000 |
| Django | `pip install django && django-admin startproject core .` | `python manage.py runserver` | 8000 |
| Flask | `pip install flask` | `flask --app app run --debug` | 5000 |
| Streamlit | `pip install streamlit` | `streamlit run app.py --server.headless true` | 8501 |
| Rust (axum) | `cargo new app && cargo add axum tokio -F tokio/full` | `cargo run` | 3000 |
| Go | `go mod init app` | `go run .` | 8080 |
| .NET API | `dotnet new webapi -n App` | `dotnet run` (use `--urls http://localhost:5000`) | 5000 |
| Laravel | `composer create-project laravel/laravel app` | `php artisan serve` | 8000 |
| Flutter web | `flutter create app` | `flutter run -d web-server --web-port 8080` | 8080 |

Windows venv activation is `.venv\Scripts\activate`; simpler and shell-independent: call the interpreter directly — `.venv/Scripts/python -m pip install …`, `.venv/Scripts/python -m uvicorn …` (Linux/macOS: `.venv/bin/python`).
Tailwind v4 with Vite: `npm i tailwindcss @tailwindcss/vite`, add the plugin in vite.config, and `@import "tailwindcss";` in the CSS — no config file needed.
Pick a free port when the default is taken: most dev servers accept `--port N` (Vite: `npm run dev -- --port 5180`).
