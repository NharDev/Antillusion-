# CSS recipes that are right the first time
tags: css layout flex grid center responsive navbar card modal button form dark animation tailwind تصميم تنسيق واجهه ازرار قائمه بطاقه نموذج متجاوب وضع ليلي

Reset: `*,*::before,*::after{box-sizing:border-box} body{margin:0} img,svg,video{max-width:100%;display:block} button,input,select,textarea{font:inherit;color:inherit}`.

- Centre anything: `display:grid; place-items:center`. Full-height page with sticky footer: `body{min-height:100dvh; display:grid; grid-template-rows:auto 1fr auto}`.
- Responsive cards with no media query: `display:grid; gap:1rem; grid-template-columns:repeat(auto-fit, minmax(16rem, 1fr))`.
- Sidebar layout: `display:grid; grid-template-columns:16rem 1fr` → at `max-width:48rem` switch to one column and turn the sidebar into an off-canvas drawer (`position:fixed; translate:-100% 0; transition:translate .2s` + `.open{translate:0}`; mirror for RTL with `inset-inline-start`).
- Holy-grail app shell: `height:100dvh; display:grid; grid-template-rows:auto 1fr; overflow:hidden` with the scroll on the inner pane (`min-height:0; overflow:auto` — the `min-height:0` is what makes nested flex/grid children scroll).
- Truncate: one line `overflow:hidden; white-space:nowrap; text-overflow:ellipsis` (needs `min-width:0` inside flex); N lines `display:-webkit-box; -webkit-line-clamp:3; -webkit-box-orient:vertical; overflow:hidden`.
- Fluid type and spacing: `font-size:clamp(1rem, .9rem + .6vw, 1.25rem)`; container padding `padding-inline:clamp(1rem, 5vw, 4rem)`; readable width `max-width:65ch`.
- Buttons: `display:inline-flex; align-items:center; gap:.5rem; padding:.65em 1.2em; border-radius:.6rem; border:1px solid transparent; cursor:pointer; transition:background .15s, transform .1s` + `:hover`, `:active{transform:translateY(1px)}`, `:focus-visible{outline:3px solid color-mix(in srgb, var(--accent) 50%, transparent); outline-offset:2px}`, `:disabled{opacity:.5; cursor:not-allowed}`.
- Inputs: label above, `padding:.7em .9em; border:1px solid var(--line); border-radius:.6rem; width:100%`; error state via `[aria-invalid="true"]`; `accent-color` for checkboxes.
- Modal: native `<dialog>` + `dialog.showModal()`; style `dialog::backdrop{background:rgb(0 0 0/.5)}`; close on backdrop click by comparing `e.target === dialog`.
- Sticky header with blur: `position:sticky; top:0; backdrop-filter:blur(10px); background:color-mix(in srgb, var(--bg) 85%, transparent)`.
- Dark mode: tokens on `:root`, override in `@media (prefers-color-scheme: dark)` and/or `[data-theme="dark"]`; toggle by setting `document.documentElement.dataset.theme` and saving to localStorage; `color-scheme: light dark` fixes native controls.
- Soft elevation: `box-shadow:0 1px 2px rgb(0 0 0/.06), 0 8px 24px rgb(0 0 0/.08)`. Skeleton loading: gradient background animated with `background-position`.
- Entrance animation: `@keyframes rise{from{opacity:0; translate:0 12px}}` + `animation:rise .5s both; animation-delay:calc(var(--i) * 60ms)`; wrap in `@media (prefers-reduced-motion: no-preference)`.
- RTL-safe: `margin-inline`, `padding-inline`, `inset-inline-start`, `border-start-start-radius`, `text-align:start`; flip directional icons with `[dir="rtl"] .icon{scale:-1 1}`; numbers/code in `<bdi>` or `dir="ltr"`.
- Scroll: `scroll-behavior:smooth`, `scroll-margin-top` on anchored sections under a sticky header, `overscroll-behavior:contain` in modals, `scrollbar-gutter:stable` to stop layout shift.
- Aspect and media: `aspect-ratio:16/9; object-fit:cover`. Full-bleed hero image with text: grid stack (`grid-area:1/1` on both children).

Tailwind v4: `@import "tailwindcss";` in CSS, tokens via `@theme { --color-brand: #…; }`, classes `flex items-center gap-4 p-6 rounded-xl bg-white dark:bg-zinc-900 md:grid-cols-3`, RTL with logical utilities (`ms-4`, `pe-2`, `text-start`). Extract repeated class lists into components, not `@apply` soup.
