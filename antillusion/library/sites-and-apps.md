# Blueprints: what a complete site / app contains
tags: website store ecommerce dashboard admin blog portfolio restaurant booking chat todo crud saas موقع متجر الكتروني لوحه تحكم مدونه معرض اعمال مطعم حجز دردشه تطبيق مهام نظام اداره

Pick the smallest stack that delivers: static pages → HTML/CSS/JS (start with `use_template("landing-page")`); interactive single-user tool → one page + localStorage; multi-page app with data → React/Vite or Next + API + SQLite/Postgres.

Landing / company / restaurant / portfolio: nav, hero with one primary action, proof (logos, numbers, testimonials), features or menu/services, how it works, pricing or gallery, FAQ, contact (form, map, hours, WhatsApp link `https://wa.me/<number>`), footer. Real copy in the user's language, real-looking data, responsive, meta tags + Open Graph.

Online store: product grid (image, name, price, add), filters/search, product page, cart drawer (qty ±, subtotal) persisted in localStorage, checkout form with validation, order confirmation; admin CRUD for products if a back-end exists. Money as integer minor units; format with `Intl.NumberFormat(locale, { style: "currency", currency })`. Payments only through a provider (Stripe Checkout etc.) — never collect card numbers yourself.

Dashboard / admin: sidebar nav, top bar (search, user), KPI cards, charts (Chart.js / ECharts), data table (sort, filter, paginate, empty state), detail drawer or page, create/edit forms with validation, toasts, loading skeletons, role-based visibility, dark mode.

CRUD app (todo, notes, inventory, CRM): list + search + filters, create/edit modal, delete with undo, optimistic UI, persistence layer behind one module (`store.list/create/update/remove`) so localStorage can be swapped for an API. API side: validation, pagination, consistent errors, tests.

Blog / docs: Markdown content (Astro content collections or `marked` + DOMPurify), list with tags, article page with table of contents, RSS/sitemap, syntax highlighting.

Chat / realtime: message list (auto-scroll unless the user scrolled up), composer (Enter sends, Shift+Enter newline), typing indicator, reconnecting WebSocket, timestamps, per-room history from the server.

Booking / forms-heavy: multi-step form with progress, per-step validation, summary before submit, server-side re-validation, confirmation page/email, time zones stored in UTC.

Auth when needed: sign up, sign in, sign out, password reset, protected routes, session cookie (HttpOnly) — use a library (better-auth, Auth.js, django-allauth) rather than writing it by hand.

Definition of done for anything visual: loads with zero console errors, works at 390 px and 1440 px, keyboard reachable, visible focus, empty/loading/error states exist, text is real, and it was opened in the preview and checked with preview_read.
