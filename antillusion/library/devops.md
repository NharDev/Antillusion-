# Shipping: environment, Docker, CI/CD, hosting
tags: deploy docker ci cd github actions hosting vercel cloudflare nginx env production build release container نشر رفع استضافه دوكر

Config: twelve-factor — everything environment-specific in env vars, validated at boot; `.env` for local only (git-ignored), `.env.example` committed; one build artefact promoted through stages.

Dockerfile (Node, multi-stage):
```dockerfile
FROM node:22-slim AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build
FROM node:22-slim
WORKDIR /app
ENV NODE_ENV=production
COPY package*.json ./
RUN npm ci --omit=dev
COPY --from=build /app/dist ./dist
USER node
EXPOSE 3000
CMD ["node", "dist/server.js"]
```
Python: `python:3.13-slim`, copy requirements first, `pip install --no-cache-dir -r requirements.txt`, run with `uvicorn app.main:app --host 0.0.0.0 --port 8000`. Add `.dockerignore` (node_modules, .git, .env). Servers must bind `0.0.0.0` and read `PORT` inside containers. Compose for local stacks (app + postgres + redis) with named volumes and healthchecks.

GitHub Actions CI (`.github/workflows/ci.yml`): on push/PR → checkout → setup-node (with `cache: npm`) → `npm ci` → lint → type-check → test → build. Secrets via repository secrets, never in the file. Add a deploy job gated on `main`.

Where to host: static/Jamstack → Cloudflare Pages, Vercel, Netlify, GitHub Pages. Full-stack JS → Vercel (Next), Cloudflare Workers, Fly.io, Railway, Render. Containers → Fly.io, Cloud Run, ECS, a VPS with Caddy (automatic HTTPS) as reverse proxy. Databases → Neon/Supabase (Postgres), Turso (SQLite), managed Redis. ML demos → Hugging Face Spaces.

Production checklist: HTTPS, health endpoint, structured logs, error tracking (Sentry), backups that have been restored once, migrations run before the new version takes traffic, graceful shutdown, resource limits, rate limiting, cache headers for static assets (hashed filenames + `immutable`), compression, a rollback path.
