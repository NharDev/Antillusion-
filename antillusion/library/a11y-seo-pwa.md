# Accessibility, SEO and PWA checklist
tags: accessibility a11y seo meta open graph pwa manifest service worker performance lighthouse سيو محركات بحث وصول تطبيق ويب تثبيت

Accessibility
- Semantic elements: `<button>` for actions, `<a href>` for navigation, one `<h1>`, ordered headings, `<nav>`, `<main>`, `<label for>` on every input, `alt` on images (empty `alt=""` when decorative).
- Keyboard: everything reachable with Tab in a sensible order, visible `:focus-visible`, Esc closes overlays, focus moves into a dialog and returns on close (`<dialog>` does this).
- Contrast ≥ 4.5:1 for text; do not convey meaning by colour alone; targets ≥ 44 px; respect `prefers-reduced-motion`.
- ARIA only when HTML cannot express it: `aria-label` for icon buttons, `aria-expanded` on toggles, `aria-live="polite"` for status messages, `role="alert"` for errors.
- Language and direction on `<html>` (`lang="ar" dir="rtl"`), forms announce errors next to the field with `aria-describedby`.

SEO
```html
<title>Page title — Brand</title>
<meta name="description" content="One or two sentences, ~150 characters.">
<link rel="canonical" href="https://example.com/page">
<meta property="og:title" content="…"><meta property="og:description" content="…"><meta property="og:image" content="https://example.com/og.png"><meta property="og:type" content="website">
<meta name="twitter:card" content="summary_large_image">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
```
Real text in HTML (server-rendered or static for content sites), descriptive link text, clean URLs, `sitemap.xml` + `robots.txt`, structured data (`<script type="application/ld+json">` for Organization/Product/Article/FAQ), fast load (compressed images with dimensions, lazy-loading below the fold, minimal blocking JS).

PWA (installable, works offline)
```json
{ "name": "App", "short_name": "App", "start_url": "/", "display": "standalone", "background_color": "#ffffff", "theme_color": "#111111",
  "icons": [{ "src": "/icon-192.png", "sizes": "192x192", "type": "image/png" }, { "src": "/icon-512.png", "sizes": "512x512", "type": "image/png", "purpose": "any maskable" }] }
```
`<link rel="manifest" href="/manifest.webmanifest">` + register a service worker:
```js
// sw.js — cache-first for the app shell, network-first for everything else
const CACHE = "app-v1", SHELL = ["/", "/index.html", "/style.css", "/app.js"];
self.addEventListener("install", (e) => e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting())));
self.addEventListener("activate", (e) => e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim())));
self.addEventListener("fetch", (e) => { if (e.request.method !== "GET") return; e.respondWith(caches.match(e.request).then((hit) => hit || fetch(e.request).then((r) => { const copy = r.clone(); caches.open(CACHE).then((c) => c.put(e.request, copy)); return r; }).catch(() => caches.match("/index.html")))); });
```
`if ("serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js")`. Needs https (localhost is fine). Bump the cache name on each release. With Vite use `vite-plugin-pwa` instead of hand-writing.
