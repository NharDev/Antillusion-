# Web front-end without a build step (HTML, CSS, JS)
tags: html css javascript vanilla static site landing page dom accessibility responsive rtl arabic seo موقع صفحه ويب واجهه متصفح تصميم html

Structure: `index.html` (semantic: header/nav/main/section/footer, one h1), `style.css`, `app.js` loaded with `<script type="module">`. Third-party libraries via ESM CDN: `https://cdn.jsdelivr.net/npm/<pkg>@<version>/+esm` or `https://esm.sh/<pkg>@<version>` — pin the version (check pkg_info).

Head essentials: `<meta charset="utf-8">`, `<meta name="viewport" content="width=device-width, initial-scale=1">`, title, description, `<html lang dir>`; Arabic pages use `lang="ar" dir="rtl"`.

CSS that holds up:
- Design tokens on `:root` as custom properties (colours, spacing scale 4/8/12/16/24/32/48/64, radii, shadows, fonts); dark theme via `@media (prefers-color-scheme: dark)` or a `[data-theme]` attribute.
- `*,*::before,*::after{box-sizing:border-box}`; fluid type with `clamp(1rem, 0.9rem + 0.5vw, 1.25rem)`; `max-width: 65ch` for prose.
- Layout: grid for page structure (`grid-template-columns: repeat(auto-fit, minmax(16rem, 1fr))`), flex for rows; `gap`, never margins between siblings. Container queries for components.
- Logical properties (`margin-inline`, `padding-block`, `inset-inline-start`, `text-align: start`) so LTR and RTL both work without overrides.
- `:focus-visible` outlines, `prefers-reduced-motion` guard around animation, hit targets ≥ 44px, contrast ≥ 4.5:1.
- Images: `width`/`height` attributes or `aspect-ratio`, `loading="lazy"`, `object-fit: cover`.

JS that holds up:
- Keep state in one object; render functions derive DOM from state; event delegation on containers (`el.addEventListener('click', e => { const b = e.target.closest('[data-action]'); … })`).
- Never `innerHTML` with user data — use `textContent` or escape. `fetch` with `try/catch`, check `res.ok`, show loading / empty / error states.
- Persist with `localStorage` (small) or IndexedDB (large); debounce input handlers; `AbortController` to cancel stale requests.
- Forms: real `<form>`, `<label for>`, native validation attributes, `submit` handler with `preventDefault`.

Verify: serve_static, then preview_read — check console errors and query the DOM for the elements you expect; test narrow width by evaluating `innerWidth` assumptions or reading computed layout.
