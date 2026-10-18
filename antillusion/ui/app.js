/* Antillusion — renderer: session tabs, chat, composer controls, permission cards, preview panel, modals. */
"use strict";

// replaceChildren() turns null into the text "null"; conditional children are everywhere here, so drop them centrally
const _replaceChildren = Element.prototype.replaceChildren;
Element.prototype.replaceChildren = function (...kids) { return _replaceChildren.apply(this, kids.flat().filter((k) => k != null && k !== false)); };
const $ = (s, r = document) => r.querySelector(s);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function h(tag, props, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props || {})) {
    if (v == null || v === false) continue;
    if (k === "class") el.className = v;
    else if (k === "html") el.innerHTML = v;
    else if (k.startsWith("on")) el.addEventListener(k.slice(2), v);
    else if (k === "data") Object.assign(el.dataset, v);
    else if (k in el && k !== "list") { try { el[k] = v; } catch { el.setAttribute(k, v); } }
    else el.setAttribute(k, v);
  }
  for (const kid of kids.flat(3)) { if (kid == null || kid === false) continue; el.append(kid.nodeType ? kid : document.createTextNode(String(kid))); }
  return el;
}

const ICONS = {
  plus: "M12 5v14M5 12h14", drop: "M12 3.5s6 6.4 6 10.6a6 6 0 01-12 0c0-4.2 6-10.6 6-10.6z", rewind: "M11 7l-6 5 6 5zM19 7l-6 5 6 5z", pulse: "M3 12h4l2-6 4 12 2-6h6", route: "M6 19a2 2 0 100-4 2 2 0 000 4zM18 9a2 2 0 100-4 2 2 0 000 4zM6 15V9a3 3 0 013-3h6M18 9v6a3 3 0 01-3 3H9", pen: "M4 20l4.5-1L19 8.5 15.5 5 5 15.5zM13.5 7l3.5 3.5", person: "M12 11a3.5 3.5 0 100-7 3.5 3.5 0 000 7zM5 20.5a7 7 0 0114 0", motion: "M3 17c3.5 0 5-10 9-10s4.5 6 9 6M3 7h3M3 11h2", x: "M6 6l12 12M18 6L6 18", up: "M12 19V5M5 12l7-7 7 7", folder: "M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z",
  clip: "M21 12.5l-8.5 8.5a5.5 5.5 0 01-7.8-7.8l9-9a3.7 3.7 0 015.2 5.2l-9 9a1.8 1.8 0 01-2.6-2.6l8.3-8.3", sliders: "M4 6h9M17 6h3M4 12h3M11 12h9M4 18h11M19 18h1M15 4v4M9 10v4M17 16v4",
  film: "M4 4h16v16H4zM8 4v16M16 4v16M4 9h4M16 9h4M4 15h4M16 15h4", gamepad: "M6 11h4M8 9v4M15 12h.01M18 10h.01M17.3 5H6.7a4 4 0 00-3.9 3.1L1.5 14a3 3 0 005.3 2.4L8 15h8l1.2 1.4A3 3 0 0022.5 14l-1.3-5.9A4 4 0 0017.3 5z", sparkle: "M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9zM19 16l.8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8z", download: "M12 3v12M7 11l5 5 5-5M4 20h16", refresh: "M20 11a8 8 0 00-14.9-3M4 4v4h4M4 13a8 8 0 0014.9 3M20 20v-4h-4", chart: "M4 20V10M10 20V4M16 20v-7M2 20h20", book: "M5 4h13a1 1 0 011 1v15H6.5A1.5 1.5 0 015 18.5zM5 18.5A1.5 1.5 0 016.5 17H19", branch: "M6 4v10M6 14a3 3 0 100 6 3 3 0 000-6zM18 4a3 3 0 100 6 3 3 0 000-6zM18 10c0 5-6 3-9 6",
  globe: "M12 3a9 9 0 100 18 9 9 0 000-18zM3 12h18M12 3c3 3.5 3 14.5 0 18M12 3c-3 3.5-3 14.5 0 18", reload: "M20 11a8 8 0 10-2.3 5.7M20 4v7h-7", back: "M15 6l-6 6 6 6", fwd: "M9 6l6 6-6 6",
  ext: "M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 01-1 1H5a1 1 0 01-1-1V7a1 1 0 011-1h5", chev: "M6 9l6 6 6-6", check: "M5 12l5 5 9-10", term: "M4 6l6 6-6 6M12 18h8", file: "M6 3h8l4 4v14H6zM14 3v4h4",
  search: "M11 4a7 7 0 100 14 7 7 0 000-14zM21 21l-4.5-4.5", star: "M12 3l2.7 5.6 6.1.8-4.5 4.3 1.1 6.1L12 16.9 6.6 19.8l1.1-6.1L3.2 9.4l6.1-.8z", trash: "M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13", undo: "M9 14L4 9l5-5M4 9h10a6 6 0 010 12h-3",
  panel: "M3 5h18v14H3zM10 5v14", bolt: "M13 2L4 14h7l-1 8 9-12h-7z", shield: "M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z", edit: "M4 20h4L19 9l-4-4L4 16zM13.5 6.5l4 4", eye: "M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12zM12 9a3 3 0 100 6 3 3 0 000-6z",
  list: "M8 6h13M8 12h13M8 18h13M3.5 6h.01M3.5 12h.01M3.5 18h.01", play: "M7 4l13 8-13 8z", box: "M12 3l9 5v8l-9 5-9-5V8zM3 8l9 5 9-5M12 13v8", brain: "M9 4a3 3 0 00-3 3 3 3 0 00-2 5 3 3 0 002 5 3 3 0 006 0V7a3 3 0 00-3-3zM15 4a3 3 0 013 3 3 3 0 012 5 3 3 0 01-2 5 3 3 0 01-6 0",
  dots: "M12 5h.01M12 12h.01M12 19h.01", arrowL: "M19 12H5M11 6l-6 6 6 6", arrowR: "M5 12h14M13 6l6 6-6 6", panelR: "M3 5h18v14H3zM14 5v14", history: "M3 12a9 9 0 109-9 9 9 0 00-6.4 2.6L3 8M3 3v5h5M12 7v5l3 2", clock: "M12 3a9 9 0 100 18 9 9 0 000-18zM12 7v5l3 2",
  gear: "M12 9a3 3 0 100 6 3 3 0 000-6zM10.3 3h3.4l.5 2.6 1.9 1.1 2.5-.9 1.7 3-2 1.7v2.2l2 1.7-1.7 3-2.5-.9-1.9 1.1-.5 2.6h-3.4l-.5-2.6-1.9-1.1-2.5.9-1.7-3 2-1.7v-2.2l-2-1.7 1.7-3 2.5.9 1.9-1.1z", folderPlus: "M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2zM12 11v5M9.5 13.5h5",
  sun: "M12 8a4 4 0 100 8 4 4 0 000-8zM12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4", moon: "M20 14.5A8.5 8.5 0 019.5 4a7 7 0 1010.5 10.5z", key: "M14 10a4 4 0 10-3.9 4H12l1.5 1.5H15V17h1.5v1.5H19V16l-5.2-5.2c.1-.3.2-.5.2-.8zM9 9h.01",
  phone: "M8 3h8a1 1 0 011 1v16a1 1 0 01-1 1H8a1 1 0 01-1-1V4a1 1 0 011-1zM11 18h2", tablet: "M5 3h14a1 1 0 011 1v16a1 1 0 01-1 1H5a1 1 0 01-1-1V4a1 1 0 011-1zM11 18h2", screen: "M3 4h18v12H3zM8 20h8M12 16v4", bug: "M8 8a4 4 0 018 0v6a4 4 0 01-8 0zM4 10h4M16 10h4M4 16h4M16 16h4M9 4l1.5 2M15 4l-1.5 2",
};
const ico = (name, size = 16) => `<svg class="ico" viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="${ICONS[name] || ""}"/></svg>`;
const icoEl = (name, size) => h("span", { class: "i", html: ico(name, size) });

const textDir = (t) => (/[؀-ۿ]/.test(String(t).slice(0, 400)) ? "rtl" : "ltr");
const fmtTok = (n) => (n >= 1e6 ? (n / 1e6).toFixed(n >= 1e7 ? 0 : 1) + "M" : n >= 1000 ? (n / 1000).toFixed(n >= 1e4 ? 0 : 1) + "k" : String(n || 0));
const fmtCost = (c) => "$" + (c >= 1 ? c.toFixed(2) : c >= 0.01 ? c.toFixed(3) : c > 0 ? c.toFixed(4) : "0");
const baseName = (p) => String(p || "").replace(/[\\/]+$/, "").split(/[\\/]/).pop();
const shortPath = (p) => { p = String(p || ""); if (S.home && p.toLowerCase().startsWith(S.home.toLowerCase())) p = "~" + p.slice(S.home.length); const parts = p.split(/[\\/]/); return parts.length > 4 ? "…/" + parts.slice(-3).join("/") : parts.join("/"); };
const ago = (t) => { const s = (Date.now() - t) / 1000; return s < 60 ? "now" : s < 3600 ? `${s / 60 | 0}m` : s < 86400 ? `${s / 3600 | 0}h` : s < 2592000 ? `${s / 86400 | 0}d` : `${s / 2592000 | 0}mo`; };
const store = { get: (k, d) => { try { const v = localStorage.getItem("antillusion." + k); return v == null ? d : JSON.parse(v); } catch { return d; } }, set: (k, v) => { try { localStorage.setItem("antillusion." + k, JSON.stringify(v)); } catch {} } };

const S = { settings: {}, models: [], sess: new Map(), order: [], tabs: [], active: null, servers: [], home: "", panel: { open: false, tabs: [], active: null, size: "desktop" } };
const cur = () => S.sess.get(S.active);
const modelOf = (id) => S.models.find((m) => m.id === id);
const MODES = { agent: ["كود", "الوكيل ينفّذ: يكتب الملفات ويشغّل الأوامر"], plan: ["خطة", "يستكشف ويكتب خطة فقط، بلا أي تعديل"], ask: ["سؤال", "يجيب ويشرح بقراءة الكود فقط"] };
const PERMS = { ask: ["اسأل في كل مرة", "يطلب إذنك قبل كل تعديل ملف أو أمر"], edits: ["قبول التعديلات", "يعدّل الملفات مباشرة ويسأل قبل الأوامر"], auto: ["تلقائي", "ينفّذ كل شيء، ويسأل فقط عند الأوامر الخطِرة"] };
const EFFORTS = { off: "بلا تفكير", low: "تفكير خفيف", medium: "تفكير متوسط", high: "تفكير عميق" };

function toast(text, kind = "") {
  const el = h("div", { class: "toast " + kind }, text);
  $("#layer").append(el); setTimeout(() => el.classList.add("out"), 3600); setTimeout(() => el.remove(), 4000);
}
const call = async (ch, ...a) => { try { return await api.invoke(ch, ...a); } catch (e) { toast(e.message, "err"); return null; } };

/* ---------- popovers & modals ---------- */

let popEl = null;
// every surface that animates in also animates out: mark it leaving, let the CSS exit play, then detach
function fadeOut(el, ms = 200) { if (!el || el.classList.contains("leaving")) return; el.classList.add("leaving"); setTimeout(() => el.remove(), ms); }
function closePop() { if (popEl) { fadeOut(popEl, 150); popEl = null; } }
function popAt(anchor, el) {
  closePop(); popEl = el; el.classList.add("pop"); $("#layer").append(el);
  const r = anchor.getBoundingClientRect(), w = el.offsetWidth, ht = el.offsetHeight;
  const up = r.top > innerHeight * 0.55;
  el.style.left = Math.max(8, Math.min(r.left, innerWidth - w - 8)) + "px";
  el.style.top = Math.max(46, up ? r.top - ht - 6 : Math.min(r.bottom + 6, innerHeight - ht - 8)) + "px";
  return el;
}
function menu(anchor, items) {
  popAt(anchor, h("div", { class: "menu" }, items.filter(Boolean).map((it) => it.sep ? h("div", { class: "msep" }) : it.head ? h("div", { class: "mhead" }, it.head)
    : h("button", { class: "mitem" + (it.checked ? " on" : "") + (it.danger ? " danger" : ""), disabled: it.disabled, onclick: () => { closePop(); it.onClick && it.onClick(); } },
      it.icon ? icoEl(it.icon) : null, h("span", { class: "mtext" }, h("b", null, it.label), it.sub ? h("small", null, it.sub) : null), it.checked ? icoEl("check", 14) : null))));
}
document.addEventListener("mousedown", (e) => { if (popEl && !popEl.contains(e.target)) closePop(); }, true);

function modal(title, body, cls = "") {
  const close = () => { fadeOut(wrap, 210); document.removeEventListener("keydown", onKey); };
  const onKey = (e) => { if (e.key === "Escape") close(); };
  const wrap = h("div", { class: "modal-wrap", onmousedown: (e) => { if (e.target === wrap) close(); } },
    h("div", { class: "modal " + cls }, h("div", { class: "modal-h" }, h("b", null, title), h("button", { class: "ic-btn", onclick: close, html: ico("x") })), h("div", { class: "modal-b" }, body)));
  $("#layer").append(wrap); document.addEventListener("keydown", onKey);
  return { close, el: wrap };
}
function ask(title, { label, value = "", ok = "تأكيد", note, danger, input = true }) {
  return new Promise((resolve) => {
    const inp = input ? h("input", { class: "field", value, placeholder: label, dir: "auto" }) : null;
    const done = (v) => { m.close(); resolve(v); };
    const m = modal(title, h("div", { class: "ask" }, note ? h("p", { class: "muted" }, note) : null, inp,
      h("div", { class: "btn-row" }, h("button", { class: "btn " + (danger ? "danger" : "primary"), onclick: () => done(input ? inp.value.trim() : true) }, ok), h("button", { class: "btn", onclick: () => done(null) }, "إلغاء"))), "small");
    if (inp) { inp.focus(); inp.select(); inp.addEventListener("keydown", (e) => { if (e.key === "Enter") done(inp.value.trim()); }); }
  });
}

/* ---------- sessions & tabs ---------- */

function view(meta, log = []) { const v = { meta, log, loaded: false, running: false, draft: "", atts: [], open: new Set(), planReady: false, unread: false, git: null }; S.sess.set(meta.id, v); return v; }

async function openSession(id) {
  let v = S.sess.get(id);
  if (!v || !v.loaded) {
    const d = await call("session:get", id); if (!d) return;
    v = v || view(d.meta); v.meta = d.meta; v.log = d.log; v.running = d.running; v.loaded = true;
  }
  if (!S.tabs.includes(id)) S.tabs.push(id);
  if (S.active && cur()) cur().draft = $("#input").value;
  S.active = id; v.unread = false;
  if (!nav.moving) { nav.list = nav.list.slice(0, nav.i + 1).filter((x) => x !== id); nav.list.push(id); nav.i = nav.list.length - 1; } nav.moving = false;
  store.set("tabs", S.tabs); store.set("active", id);
  renderAll(); refreshGit(); $("#input").focus();
}
/** Antillusion Code: a session specialised for building and fixing software — smart model routing, a team, verified results. */
function newCodeSession(init = {}) { return newSession({ kind: "code", mode: "agent", model: S.models.some((m) => m.id === "antillusion/auto") ? "antillusion/auto" : undefined, ...init }); }
async function newSession(init) {
  const prev = cur();
  const d = await call("session:create", { cwd: prev ? prev.meta.baseCwd : S.settings.lastCwd || undefined, ...init }); if (!d) return null;
  const v = view(d.meta, []); v.loaded = true; S.order.unshift(d.meta);
  await openSession(d.meta.id); return v;
}
const nav = { list: [], i: -1, moving: false };
function navGo(d) { const j = nav.i + d; if (j < 0 || j >= nav.list.length) return; const id = nav.list[j]; if (!S.order.some((m) => m.id === id)) { nav.list.splice(j, 1); return; } nav.i = j; nav.moving = true; openSession(id); }
function closeTab(id) {
  const i = S.tabs.indexOf(id); if (i < 0) return;
  S.tabs.splice(i, 1); store.set("tabs", S.tabs);
  if (S.active === id) { const next = S.tabs[Math.min(i, S.tabs.length - 1)]; if (next) openSession(next); else newSession(); } else renderTabs();
}
async function deleteSession(id) {
  const meta = S.order.find((m) => m.id === id);
  if (!(await ask("حذف الجلسة", { input: false, ok: "حذف", danger: true, note: `سيُحذف سجلّ «${meta ? meta.title : ""}» نهائياً. ملفات المشروع لا تتأثر.` }))) return;
  await call("session:delete", id);
  S.order = S.order.filter((m) => m.id !== id); S.sess.delete(id);
  if (S.tabs.includes(id)) closeTab(id); renderSidebar();
}
const syncMeta = (meta) => { const v = S.sess.get(meta.id); if (v) v.meta = meta; const i = S.order.findIndex((m) => m.id === meta.id); if (i >= 0) S.order[i] = meta; else S.order.unshift(meta); };
async function patchSession(patch) { const v = cur(); const meta = await call("session:update", v.meta.id, patch); if (meta) { syncMeta(meta); const { title, rating, ...keep } = patch; Object.assign(S.settings, keep); if (rating !== undefined) renderHead(); renderControls(); renderTabs(); renderSidebar(); } }
async function refreshGit() { const v = cur(); if (!v) return; v.git = await call("git:info", v.meta.id); if (cur() === v) renderHead(); }

function renderTabs() {
  $("#tabs").replaceChildren(...S.tabs.map((id) => {
    const v = S.sess.get(id); if (!v) return null;
    return h("div", { class: "tab" + (id === S.active ? " on" : "") + (v.unread ? " unread" : ""), title: v.meta.title, onclick: () => openSession(id), onauxclick: (e) => e.button === 1 && closeTab(id) },
      v.running ? h("span", { class: "spin" }) : v.unread ? h("span", { class: "dot" }) : null, h("span", { class: "tab-t" }, v.meta.title),
      h("button", { class: "tab-x", title: "إغلاق التبويب", onclick: (e) => { e.stopPropagation(); closeTab(id); }, html: ico("x", 12) }));
  }), h("button", { class: "tab-new", title: "جلسة جديدة (Ctrl+T)", onclick: () => newSession(), html: ico("plus", 15) }));
}

const expanded = new Set();
function renderSidebar() {
  const groups = new Map();
  for (const m of [...S.order].sort((x, y) => y.updated - x.updated)) { const k = String(m.baseCwd || m.cwd).toLowerCase(); if (!groups.has(k)) groups.set(k, { cwd: m.baseCwd || m.cwd, list: [] }); groups.get(k).list.push(m); }
  $("#sessions").replaceChildren(...(groups.size ? [...groups.entries()].map(([k, g]) => {
    const all = expanded.has(k), shown = all ? g.list : g.list.slice(0, 5);
    return h("div", { class: "proj" },
      h("div", { class: "proj-h", title: g.cwd }, icoEl("folder", 15), h("span", { dir: "auto" }, baseName(g.cwd) || g.cwd), h("button", { class: "mini", title: "محادثة جديدة في هذا المجلد", onclick: () => newSession({ cwd: g.cwd }), html: ico("plus", 13) })),
      shown.map((m) => { const v = S.sess.get(m.id);
        return h("div", { class: "sess" + (m.id === S.active ? " on" : ""), title: m.title, onclick: () => openSession(m.id) },
          m.kind === "code" ? h("span", { class: "sess-code", title: "Antillusion Code" }, "</>") : null, h("span", { class: "sess-t", dir: "auto" }, m.title), m.worktree ? h("span", { class: "wt-badge", html: ico("box", 12), title: "worktree" }) : null,
          v && v.running ? h("span", { class: "spin" }) : v && v.unread ? h("span", { class: "dot" }) : h("span", { class: "sess-time" }, ago(m.updated)),
          h("button", { class: "sess-x", title: "حذف", onclick: (e) => { e.stopPropagation(); deleteSession(m.id); }, html: ico("trash", 13) })); }),
      g.list.length > 5 ? h("button", { class: "see-all", onclick: () => { all ? expanded.delete(k) : expanded.add(k); renderSidebar(); } }, all ? "عرض أقل" : `See all (${g.list.length})`) : null);
  }) : [h("div", { class: "side-empty" }, "لا توجد محادثات بعد")]));
  renderServers();
}

function renderServers() {
  $("#servers").replaceChildren(...(S.servers.length ? [h("div", { class: "side-h" }, "خوادم تعمل الآن"), ...S.servers.map((s) => h("div", { class: "srv" },
    h("div", { class: "srv-t" }, h("span", { class: "live" }), h("span", null, s.name)),
    h("div", { class: "srv-s", dir: "ltr" }, s.url || s.command),
    h("div", { class: "srv-a" },
      s.url ? h("button", { class: "mini", title: "فتح في لوحة الاستعراض", onclick: () => openPreview({ url: s.url, title: s.name }), html: ico("globe", 13) }) : null,
      h("button", { class: "mini", title: "السجلّ", onclick: () => openLogs(s), html: ico("term", 13) }),
      h("button", { class: "mini danger", title: "إيقاف", onclick: () => call("servers:stop", s.id), html: ico("x", 13) }))))] : []));
}

/* ---------- chat header ---------- */

function renderHead() {
  const v = cur(); if (!v) return;
  const m = v.meta, g = v.git;
  $("#chatHead").replaceChildren(
    m.kind === "code" ? h("span", { class: "code-pill", dir: "ltr" }, h("b", null, "</>"), "Antillusion Code") : null,
    h("button", { class: "crumb", title: m.cwd, onclick: (e) => folderMenu(e.currentTarget) }, h("span", { dir: "auto" }, baseName(m.baseCwd) || m.cwd)), h("span", { class: "crumb-sep" }, "/"),
    h("span", { class: "crumb cur", dir: "auto", title: "انقر مرتين لإعادة التسمية", ondblclick: renameSession }, m.title),
    h("span", { class: "grow" }),
    quotaChip(),
    h("button", { class: "mini tm-btn", title: "آلة الزمن — أعد المشروع إلى أي لحظة", onclick: () => timeMachine(), html: ico("rewind", 15) }),
    h("button", { class: "hchip quiet", title: "استخدام هذه الجلسة — اضغط للتفاصيل", onclick: usageModal }, h("span", { dir: "ltr" }, `${fmtCost(m.usage.cost)} · ${fmtTok(m.usage.prompt + m.usage.completion)}`)),
    h("button", { class: "mini", title: "خيارات المحادثة", onclick: (e) => menu(e.currentTarget, [
      { label: "إعادة تسمية", icon: "edit", onClick: renameSession },
      { label: m.rating === "good" ? "✓ معلَّمة ناجحة — تدخل في التدريب" : "علّمها ناجحة (للتدريب)", icon: "check", checked: m.rating === "good", onClick: () => patchSession({ rating: m.rating === "good" ? null : "good" }) },
      { label: m.rating === "bad" ? "✓ مستبعَدة من التدريب" : "استبعدها من التدريب", icon: "x", checked: m.rating === "bad", onClick: () => patchSession({ rating: m.rating === "bad" ? null : "bad" }) },
      { label: "ضغط السياق الآن", icon: "box", disabled: v.running, onClick: () => call("chat:compact", m.id) },
      { label: "فتح مجلد العمل", icon: "ext", onClick: () => call("open:path", m.cwd) }, { sep: 1 },
      { label: "مسح المحادثة", icon: "undo", danger: true, onClick: clearChat }, { label: "حذف المحادثة", icon: "trash", danger: true, onClick: () => deleteSession(m.id) }]), html: ico("dots", 16) }));

  const folderChip = h("button", { class: "hero-folder", title: m.cwd, onclick: (e) => folderMenu(e.currentTarget) }, icoEl("folder", 15), h("span", { dir: "auto" }, baseName(m.baseCwd) || m.cwd), icoEl("chev", 12));
  $("#heroTop").replaceChildren(v.log.length ? null : folderChip);
  $("#underBar").replaceChildren(
    m.worktree
      ? h("button", { class: "under-chip wt", onclick: (e) => menu(e.currentTarget, [
        { head: `worktree معزول — الأساس: ${m.worktree.base}` }, { label: "الحالة والتغييرات", icon: "list", onClick: worktreeStatus }, { label: `دمج في ${m.worktree.base}…`, icon: "check", onClick: worktreeMerge },
        { label: "فتح مجلد الـworktree", icon: "ext", onClick: () => call("open:path", m.worktree.path) }, { sep: 1 }, { label: "إزالة والعودة إلى Local…", icon: "trash", danger: true, onClick: worktreeRemove }]) },
        icoEl("box", 13), h("span", { dir: "ltr" }, "Worktree · " + m.worktree.branch), icoEl("chev", 11))
      : h("button", { class: "under-chip", onclick: (e) => menu(e.currentTarget, [
        { label: "Local", sub: "يعمل مباشرة في مجلد المشروع", icon: "screen", checked: true },
        { label: "Worktree جديد…", sub: "نسخة معزولة على فرع جديد، تدمجها متى أعجبتك", icon: "box", onClick: worktreeCreate }]) }, icoEl("screen", 13), "Local", icoEl("chev", 11)),
    g && g.repo ? h("span", { class: "under-chip static", title: "الفرع الحالي" }, icoEl("branch", 13), h("span", { dir: "ltr" }, g.branch), g.dirty ? h("span", { class: "dirty" }, "●" + g.dirty) : null) : null,
    v.log.length ? h("button", { class: "under-chip", title: m.cwd, onclick: (e) => folderMenu(e.currentTarget) }, icoEl("folder", 13), h("span", { dir: "ltr" }, shortPath(m.cwd))) : null);
}
function folderMenu(anchor) {
  const m = cur().meta, recent = [...new Set(S.order.map((x) => x.baseCwd || x.cwd))].filter((p) => p && p !== m.baseCwd).slice(0, 6);
  menu(anchor, [{ label: "اختيار مجلد المشروع لهذه الجلسة…", icon: "folder", sub: "كل المسارات والأوامر تُنفَّذ داخله", onClick: pickFolder },
    { label: "فتح المجلد في مستكشف الملفات", icon: "ext", onClick: () => call("open:path", m.cwd) },
    ...(recent.length && !cur().log.length ? [{ sep: 1 }, { head: "مشاريع أخيرة" }, ...recent.map((p) => ({ label: baseName(p), sub: shortPath(p), icon: "folder", onClick: () => setFolder(p) }))] : [])]);
}
async function setFolder(p) { const v = cur(); const meta = await call("session:setFolder", v.meta.id, p); if (meta) { syncMeta(meta); renderAll(); refreshGit(); } }
async function renameSession() { const v = cur(), t = await ask("إعادة تسمية المحادثة", { label: "العنوان", value: v.meta.title, ok: "حفظ" }); if (t) patchSession({ title: t }); }

async function pickFolder() {
  const v = cur(); if (v.running) return toast("أوقف الوكيل أولاً", "err");
  const meta = await call("session:pickFolder", v.meta.id);
  if (meta) { syncMeta(meta); S.settings.lastCwd = meta.cwd; renderAll(); refreshGit(); toast("تم تحديد مجلد المشروع"); }
}
async function worktreeCreate() {
  const v = cur();
  const name = await ask("worktree جديد", { label: "اسم المهمة (مثال: login-page)", ok: "إنشاء", note: "يُنشئ فرعاً جديداً antillusion/<الاسم> في مجلد مستقل بجوار المشروع، وتنتقل هذه الجلسة للعمل فيه. ملفاتك الحالية لا تُمَس، وتدمج النتيجة متى أعجبتك." });
  if (name === null) return;
  let r = await call("worktree:create", v.meta.id, { name });
  if (r && r.needInit) { if (!(await ask("المجلد ليس مستودع git", { input: false, ok: "إنشاء مستودع ومتابعة", note: "الـworktree يحتاج مستودع git. هل أُنشئ مستودعاً هنا (git init + أول commit)؟" }))) return; r = await call("worktree:create", v.meta.id, { name, init: true }); }
  if (!r) return; if (r.error) return toast(r.error, "err");
  toast(`الجلسة تعمل الآن في ${r.branch}`); refreshGit();
}
async function worktreeStatus() {
  const r = await call("worktree:status", cur().meta.id); if (!r || r.error) return r && toast(r.error, "err");
  modal("حالة الـworktree", h("div", { class: "wt-status" }, h("p", null, h("b", null, "الفرع: "), h("code", { dir: "ltr" }, r.branch), "  ←  ", h("code", { dir: "ltr" }, r.base)), h("p", { class: "muted", dir: "ltr" }, r.path),
    h("h4", null, "تغييرات غير محفوظة"), h("pre", { dir: "ltr" }, r.status || "(لا شيء)"), h("h4", null, "Commits على الفرع"), h("pre", { dir: "ltr" }, r.commits || "(لا شيء)"), h("h4", null, "الفرق عن الأساس"), h("pre", { dir: "ltr" }, r.diff || "(لا فرق)")));
}
async function worktreeMerge() {
  const v = cur(), msg = await ask("دمج الـworktree", { label: "رسالة الـcommit", value: v.meta.title, ok: "دمج", note: `سيُحفظ كل ما في الـworktree في commit ثم يُدمج الفرع في ${v.meta.worktree.base}.` });
  if (msg === null) return;
  const r = await call("worktree:merge", v.meta.id, msg); if (!r) return;
  r.error ? modal("تعذّر الدمج", h("pre", { dir: "auto", class: "prewrap" }, r.error), "small") : toast(`تم الدمج في ${r.into}`);
}
async function worktreeRemove() {
  const v = cur();
  if (!(await ask("إزالة الـworktree", { input: false, ok: "إزالة", danger: true, note: "سيُحذف مجلد الـworktree وفرعه مع أي تغييرات لم تُدمج. تعود الجلسة إلى المجلد الأساسي." }))) return;
  const r = await call("worktree:remove", v.meta.id, { deleteBranch: true }); if (!r) return;
  r.error ? toast(r.error, "err") : (toast("تمت الإزالة"), refreshGit());
}

/* ---------- messages ---------- */

const TOOL = {
  read_file: ["قراءة", "file", (a) => a.path], write_file: ["كتابة", "edit", (a) => a.path], edit_file: ["تعديل", "edit", (a) => a.path], list_dir: ["استعراض مجلد", "folder", (a) => a.path || "."],
  glob: ["بحث عن ملفات", "search", (a) => a.pattern], grep: ["بحث في الكود", "search", (a) => a.pattern + (a.glob ? `  (${a.glob})` : "")], run_command: ["أمر", "term", (a) => a.command],
  start_server: ["تشغيل خادم", "play", (a) => a.command], serve_static: ["استعراض محلي", "globe", (a) => a.dir || "."], stop_server: ["إيقاف خادم", "x", (a) => a.id], server_logs: ["سجلّ الخادم", "term", (a) => a.id || "الكل"],
  open_preview: ["فتح الاستعراض", "globe", (a) => a.target], preview_read: ["فحص الصفحة", "eye", (a) => a.js || "النص وأخطاء الكونسول"], library_search: ["المكتبة", "book", (a) => a.query], library_read: ["قراءة مرجع", "book", (a) => a.id],
  sources_search: ["بحث في المصادر", "search", (a) => `${a.source || "all"}: ${a.query}`], pkg_info: ["معلومات حزمة", "box", (a) => `${a.ecosystem || "npm"}: ${a.name}`], web_fetch: ["جلب صفحة", "globe", (a) => a.url], todo_write: ["تحديث المهام", "list", (a) => `${(a.todos || []).length} مهام`], ask_expert: ["سؤال الخبير", "brain", (a) => a.question], use_template: ["قالب جاهز", "box", (a) => a.name + (a.dest ? " → " + a.dest : "")],
};

function diffEl(d) {
  const lines = [];
  if (d.kind === "edit") { for (const l of d.del.split("\n")) lines.push(h("div", { class: "dl del" }, "- " + l)); for (const l of d.add.split("\n")) lines.push(h("div", { class: "dl add" }, "+ " + l)); }
  else { const all = d.add.split("\n"); for (const l of all.slice(0, 60)) lines.push(h("div", { class: "dl add" }, "+ " + l)); if (all.length > 60 || d.more) lines.push(h("div", { class: "dl more" }, `… ${d.plus} سطراً إجمالاً`)); }
  return h("div", { class: "diff", dir: "ltr" }, lines);
}
function argsPreview(it) {
  const a = it.args || {};
  if (it.name === "write_file") return diffEl({ kind: "create", add: String(a.content || "").slice(0, 6000), plus: String(a.content || "").split("\n").length, more: String(a.content || "").length > 6000 });
  if (it.name === "edit_file") return diffEl({ kind: "edit", del: String(a.old_string || ""), add: String(a.new_string || "") });
  if (a.command) return h("pre", { class: "cmd", dir: "ltr" }, a.command + (a.cwd ? `\n# in ${a.cwd}` : ""));
  return h("pre", { class: "out", dir: "ltr" }, JSON.stringify(a, null, 2));
}

function permEl(v, it) {
  const p = it.perm, note = h("input", { class: "field perm-note", placeholder: "عند الرفض: قل للوكيل ماذا يفعل بدلاً من ذلك (اختياري)", dir: "auto" });
  const reply = (decision) => call("perm:reply", p.reqId, decision, note.value.trim());
  const always = it.name === "write_file" || it.name === "edit_file" ? "السماح بتعديل الملفات طوال الجلسة" : p.key ? `السماح دائماً بـ «${p.key}» في هذه الجلسة` : "السماح دائماً في هذه الجلسة";
  return h("div", { class: "perm" + (p.danger ? " danger" : "") },
    h("div", { class: "perm-q" }, icoEl("shield", 16), h("b", null, p.danger ? "تنبيه: " : "يطلب الإذن: "), p.reason),
    argsPreview(it), note,
    h("div", { class: "btn-row" }, h("button", { class: "btn primary", onclick: () => reply("once") }, "السماح"), p.danger ? null : h("button", { class: "btn", onclick: () => reply("always") }, always), h("button", { class: "btn danger", onclick: () => reply("deny") }, "رفض")));
}

function toolEl(v, it) {
  const [label, icon, argFn] = TOOL[it.name] || [it.name, "bolt", () => ""];
  const pending = it.status === "pending", open = pending || v.open.has(it.id);
  const stat = { running: h("span", { class: "spin" }), pending: h("span", { class: "wait" }, "بانتظار إذنك"), ok: icoEl("check", 14), error: h("span", { class: "bad" }, "فشل"), denied: h("span", { class: "bad" }, "مرفوض") }[it.status];
  let arg = ""; try { arg = String(argFn(it.args || {}) ?? ""); } catch {}
  const head = h("button", { class: "tool-h", onclick: () => { v.open.has(it.id) ? v.open.delete(it.id) : v.open.add(it.id); upsertDom(v, it); } },
    icoEl(icon, 15), h("span", { class: "t-label" }, label), h("code", { class: "t-arg", dir: "ltr" }, arg.split("\n")[0].slice(0, 160)),
    it.diff ? h("span", { class: "t-diff", dir: "ltr" }, h("i", { class: "p" }, "+" + it.diff.plus), it.diff.kind !== "create" ? h("i", { class: "m" }, "−" + it.diff.minus) : null) : null,
    it.reverted ? h("span", { class: "bad" }, "تم التراجع") : null, h("span", { class: "t-stat" }, stat));
  const body = [];
  if (pending) body.push(permEl(v, it));
  else if (open) {
    if (it.diff) body.push(diffEl(it.diff));
    else if (it.args && it.args.command) body.push(h("pre", { class: "cmd", dir: "ltr" }, it.args.command));
    else if (it.name === "preview_read" && it.args.js) body.push(h("pre", { class: "cmd", dir: "ltr" }, it.args.js));
    if (it.output && !(it.diff && it.status === "ok")) body.push(h("pre", { class: "out", dir: "ltr" }, it.output));
    if (it.canRevert) body.push(h("button", { class: "btn small", onclick: async () => { if (await call("chat:revert", v.meta.id, it.id)) toast("أُعيد الملف إلى حالته السابقة"); } }, icoEl("undo", 13), " تراجع عن هذا التعديل"));
  } else if (it.status === "running" && it.live) body.push(h("pre", { class: "out live", dir: "ltr" }, it.live.split("\n").slice(-4).join("\n")));
  return h("div", { class: `tool st-${it.status}` + (open ? " open" : ""), data: { id: it.id } }, head, body.length ? h("div", { class: "tool-b" }, body) : null);
}

function codeHero() {
  const ideas = [["لعبة شوتر ثلاثية الأبعاد", "اعمل لعبة شوتر ثلاثية الأبعاد للاعبين محليين بشاشة مقسومة، فيها M16 وقناص وديزرت إيجل ومسدس، مع دعم يد التحكم"],
    ["تطبيق ويب كامل", "ابنِ تطبيق إدارة مهام كامل: واجهة جميلة، قاعدة بيانات، بحث وفلاتر، ووضع داكن"], ["أصلح مشروعي", "افحص هذا المشروع، شغّله، اعثر على الأخطاء وأصلحها كلها ثم اختبره"], ["API و قاعدة بيانات", "ابنِ REST API بقاعدة بيانات SQLite مع تحقق من المدخلات وتوثيق واختبارات"]];
  const feats = [["route", "موجّه ذكي", "يختار أفضل نموذج لكل مهمة ويتعلّم من كل نتيجة"], ["person", "فريق وكلاء", "يقسّم المشاريع الكبيرة على عدة وكلاء يعملون بالتوازي"], ["check", "تسليم مُختبَر", "لا يقول «انتهيت» قبل أن يشغّل العمل ويتأكد أنه يعمل"]];
  return h("div", { class: "code-hero" },
    h("div", { class: "ch-title", dir: "ltr" }, h("span", null, "</>"), "Antillusion Code"),
    h("p", null, "بيئة متخصصة بالبرمجة: تخطّط، توزّع العمل على فريق، تنفّذ، وتختبر قبل التسليم."),
    h("div", { class: "ch-feats" }, feats.map(([i, t, d]) => h("div", { class: "ch-feat" }, h("i", { html: ico(i, 18) }), h("b", null, t), h("small", null, d)))),
    h("div", { class: "suggest" }, ideas.map(([t, p]) => h("button", { title: p, onclick: () => { $("#input").value = p; autosize(); $("#input").focus(); } }, t))));
}
function teamEl(it) {
  const st = { queued: ["في الانتظار", "q"], running: ["يعمل", "run"], done: ["أنجز", "ok"], error: ["تعثّر", "bad"], stopped: ["أُوقف", "q"] };
  return h("div", { class: "team" + (it.done ? " done" : ""), data: { id: it.id } },
    h("div", { class: "team-h" }, icoEl("person", 15), h("b", null, it.done ? "أنجز الفريق عمله" : `فريق من ${it.workers.length} وكلاء يعمل بالتوازي`), it.done ? null : h("span", { class: "spin" })),
    h("div", { class: "team-grid" }, it.workers.map((w, i) => { const [label, cls] = st[w.status] || st.queued;
      return h("div", { class: "worker " + cls }, h("div", { class: "w-top" }, h("span", { class: "w-n" }, String(i + 1)), h("b", { dir: "auto" }, w.title), h("span", { class: "w-st" }, label)),
        h("div", { class: "w-files", dir: "ltr" }, (w.files || []).slice(0, 4).join("  ·  ")),
        h("div", { class: "w-meta", dir: "ltr" }, w.model ? h("span", null, w.model) : null, w.steps ? h("span", null, `${w.steps} steps`) : null, w.errors ? h("span", { class: "bad" }, `${w.errors} errors`) : null),
        w.last && w.status === "running" ? h("div", { class: "w-last", dir: "ltr" }, w.last) : null); })));
}
function verifyEl(it) {
  const NAMES = { syntax: "الصياغة", refs: "الملفات المرتبطة", run: "التشغيل الفعلي", tests: "الاختبارات" };
  const head = it.status === "running" ? "يختبر العمل قبل التسليم…" : it.status === "ok" ? "اجتاز الاختبار — العمل يعمل" : it.status === "fail" ? `وجد الاختبار مشاكل — يصلحها الوكيل الآن (جولة ${it.round} من 3)` : "لا توجد ملفات معدّلة لاختبارها";
  return h("div", { class: "verify " + it.status, data: { id: it.id } },
    h("div", { class: "vf-h" }, it.status === "running" ? h("span", { class: "spin" }) : icoEl(it.status === "ok" ? "check" : it.status === "fail" ? "x" : "eye", 15), h("b", null, head), it.files ? h("small", null, `${it.files} ملفاً`) : null),
    (it.checks || []).length ? h("div", { class: "vf-checks" }, it.checks.map((c) => h("span", { class: "vf-c " + (c.ok ? "ok" : "bad") }, icoEl(c.ok ? "check" : "x", 12), h("b", null, NAMES[c.name] || c.name), h("small", null, c.detail)))) : null,
    it.status === "fail" && (it.problems || []).length ? h("ul", { class: "vf-p", dir: "ltr" }, it.problems.slice(0, 5).map((p) => h("li", null, p))) : null);
}
function itemEl(v, it) {
  if (it.kind === "team") return teamEl(it);
  if (it.kind === "verify") return verifyEl(it);
  if (it.kind === "user") return h("div", { class: "msg user", data: { id: it.id } }, h("div", { class: "bubble" },
    (it.attachments || []).length ? h("div", { class: "u-atts" }, it.attachments.map((a) => a.thumb ? h("img", { src: a.thumb, title: a.name }) : h("span", { class: "att-chip" }, icoEl("file", 13), a.name))) : null,
    h("div", { class: "u-text", dir: "auto" }, it.text)));
  if (it.kind === "assistant") {
    if (!it.text && !it.reasoning && !it.streaming) return h("div", { data: { id: it.id }, hidden: true });
    return h("div", { class: "msg ai" + (it.streaming ? " streaming" : ""), data: { id: it.id } },
      it.reasoning ? h("details", { class: "reason", open: v.open.has("r" + it.id), ontoggle: (e) => (e.target.open ? v.open.add("r" + it.id) : v.open.delete("r" + it.id)) }, h("summary", null, icoEl("brain", 14), " التفكير"), h("div", { class: "reason-b", dir: "auto" }, it.reasoning)) : null,
      h("div", { class: "md", dir: textDir(it.text), html: MD.render(it.text) }));
  }
  if (it.kind === "tool") return toolEl(v, it);
  const acts = (it.actions || []).map((a) => a === "router" ? h("button", { class: "btn small", onclick: () => call("open:external", String(S.settings.baseUrl || "http://localhost:20128/v1").replace(/\/v1\/?$/, "") + "/dashboard") }, icoEl("ext", 12), " لوحة OmniRoute")
    : a === "model" ? h("button", { class: "btn small primary", onclick: (e) => modelPicker(e.currentTarget) }, icoEl("brain", 12), " اختر نموذجاً آخر")
    : a === "health" ? h("button", { class: "btn small", onclick: () => healthModal() }, icoEl("pulse", 12), " صحة النماذج") : null).filter(Boolean);
  const trail = it.route && it.route.length ? h("div", { class: "n-route", dir: "ltr" }, it.route.map((r) => h("span", { class: "rt-hop " + (r.kind || "") }, h("i"), h("b", null, r.model), h("small", { dir: "rtl" }, r.reason))),
    it.settled ? h("span", { class: "rt-hop ok" }, h("i"), h("b", null, (String(it.text).match(/بـ (\S+)/) || [])[1] || "")) : null) : null;
  if (it.route && it.settled) return h("details", { class: "notice route settled", data: { id: it.id }, dir: "auto" }, h("summary", null, icoEl("route", 13), h("span", null, it.text)), trail);
  return h("div", { class: "notice " + (it.level || "info") + (it.detail || acts.length || trail ? " rich" : "") + (it.route ? " route" : ""), data: { id: it.id }, dir: "auto" }, h("div", { class: "n-text" }, it.route && it.level === "warn" ? h("span", { class: "spin" }) : null, it.text),
    trail, it.diag && it.diag.length ? diagEl(it.diag) : null, acts.length ? h("div", { class: "n-acts" }, acts) : null,
    it.detail ? h("details", { class: "n-detail" }, h("summary", null, "التفاصيل التقنية"), h("pre", { dir: "ltr" }, String(it.detail).replace(/;\s+/g, ";\n"))) : null);
}

const act = { el: null, t0: 0, timer: 0, sid: null, text: "" };
function setActivity(v, e) {
  if (v !== cur()) return;
  const label = e.tool ? `${(TOOL[e.tool] || [e.tool])[0]}${e.hint ? " " + e.hint : ""}${e.chars > 400 ? ` · ${fmtTok(e.chars)} حرف` : ""}` : e.text;
  if (!label) { clearInterval(act.timer); if (act.el) fadeOut(act.el, 160); act.el = null; return; }
  if (!act.el || !act.el.isConnected) { act.t0 = Date.now(); act.el = h("div", { class: "activity" }, h("span", { class: "spin" }), h("span", { class: "a-text", dir: "auto" }), h("span", { class: "a-time", dir: "ltr" })); clearInterval(act.timer); act.timer = setInterval(() => { if (act.el) $(".a-time", act.el).textContent = ((Date.now() - act.t0) / 1000).toFixed(0) + "s"; }, 500); }
  $(".a-text", act.el).textContent = label; msgs().append(act.el); scrollDown();
}
let stick = true;
const msgs = () => $("#msgs");
const scrollDown = () => { if (stick) msgs().scrollTop = msgs().scrollHeight; };
function upsertDom(v, it) {
  if (v !== cur()) return;
  const old = msgs().querySelector(`[data-id="${it.id}"]`), el = itemEl(v, it);
  if (act.el && act.el.isConnected && it.kind !== "notice") { act.t0 = Date.now(); }
  if (old) old.replaceWith(el); else { if ($("#chat").classList.contains("empty")) { $("#chat").classList.remove("empty"); $("#heroBottom").replaceChildren(); renderHead(); } msgs().append(el); }
  scrollDown();
}

const SUGGEST = [
  ["صفحة هبوط", "ابنِ صفحة هبوط أنيقة لمنتج قهوة مختصة بالعربية (RTL) مع قسم مزايا وأسعار ونموذج تواصل، ثم شغّلها في الاستعراض."],
  ["تطبيق مهام كامل", "أنشئ تطبيق مهام React + Vite + TypeScript مع حفظ محلي وتصفية وبحث ووضع ليلي، شغّله وتأكد أنه يعمل بلا أخطاء."],
  ["API مع قاعدة بيانات", "ابنِ REST API بـ Node وSQLite لإدارة منتجات (CRUD، تحقق من المدخلات، ترقيم صفحات) مع اختبارات، وشغّله."],
  ["افهم هذا المشروع", "استكشف هذا المجلد واشرح لي بنية المشروع، كيف أشغّله، وأهم ثلاث نقاط تحتاج تحسيناً."],
];
function renderMsgs() {
  const v = cur(); if (!v) return;
  stick = true;
  $("#chat").classList.toggle("empty", !v.log.length);
  $("#chat").classList.toggle("code", v.meta.kind === "code");
  $("#input").placeholder = v.meta.kind === "code" ? "صف ما تريد بناءه أو إصلاحه — Antillusion Code يخطّط، يوزّع العمل، ينفّذ ويختبر" : "Ask anything, @ to mention, / for actions";
  $("#heroBottom").replaceChildren(v.log.length ? null : v.meta.kind === "code" ? codeHero() : h("div", { class: "suggest" }, SUGGEST.map(([t, p]) => h("button", { title: p, onclick: () => { $("#input").value = p; autosize(); $("#input").focus(); } }, t))));
  if (!v.log.length) { msgs().replaceChildren(); return; }
  msgs().replaceChildren(...v.log.map((it) => itemEl(v, it)));
  msgs().scrollTop = msgs().scrollHeight;
}

const dirty = new Set(); let raf = 0;
function flushDeltas() {
  raf = 0; const v = cur(); if (!v) return dirty.clear();
  for (const id of dirty) {
    const it = v.log.find((x) => x.id === id), el = msgs().querySelector(`[data-id="${id}"]`); if (!it) continue;
    if (!el || el.hidden || (it.reasoning && !$(".reason-b", el))) { upsertDom(v, it); continue; }
    $(".md", el).innerHTML = MD.render(it.text); $(".md", el).dir = textDir(it.text);
    if (it.reasoning) $(".reason-b", el).textContent = it.reasoning;
  }
  dirty.clear(); scrollDown();
}

/* ---------- composer ---------- */

function renderTodos() {
  const v = cur(), t = (v && v.meta.todos) || [], box = $("#todos");
  box.hidden = !t.length || t.every((x) => x.status === "done") && !v.running;
  if (box.hidden) return;
  const done = t.filter((x) => x.status === "done").length;
  box.replaceChildren(h("div", { class: "todo-h" }, icoEl("list", 14), ` المهام ${done}/${t.length}`, h("div", { class: "bar" }, h("i", { style: `width:${(done / t.length) * 100}%` }))),
    h("div", { class: "todo-l" }, t.map((x) => h("div", { class: "todo " + x.status, dir: "auto" }, h("span", { class: "tk" }), x.text))));
}
function renderAtts() {
  const v = cur();
  $("#atts").replaceChildren(...v.atts.map((a, i) => h("span", { class: "att-chip", title: a.path || a.name }, a.kind === "image" ? h("img", { src: a.dataUrl }) : icoEl(a.dir ? "folder" : "file", 13), a.name,
    a.kind === "ref" && !a.dir ? h("small", null, "(مرجع)") : null, h("button", { onclick: () => { v.atts.splice(i, 1); renderAtts(); }, html: ico("x", 11) }))));
}
function renderPlanBar() {
  const v = cur(), bar = $("#planBar"); bar.hidden = !(v && v.planReady && !v.running && v.meta.mode === "plan");
  if (!bar.hidden) bar.replaceChildren(h("span", null, "الخطة جاهزة."), h("button", { class: "btn primary small", onclick: async () => { v.planReady = false; await patchSession({ mode: "agent" }); $("#input").value = "الخطة معتمدة — نفّذها الآن خطوة بخطوة."; send(); } }, icoEl("play", 13), " نفّذ الخطة"),
    h("button", { class: "btn small", onclick: () => { v.planReady = false; renderPlanBar(); $("#input").focus(); } }, "عدّل الخطة"));
}
function renderControls() {
  const v = cur(); if (!v) return;
  const m = v.meta, info = modelOf(m.model);
  $("#modeSeg").replaceChildren(...Object.entries(MODES).map(([k, [label, tip]]) => h("button", { class: m.mode === k ? "on" : "", title: tip, onclick: () => patchSession({ mode: k }) }, label)));
  $("#btnPerm").replaceChildren(icoEl("shield", 14), PERMS[m.perm][0], icoEl("chev", 11)); $("#btnPerm").className = "chip-btn perm-" + m.perm;
  $("#btnModel").replaceChildren(icoEl("bolt", 14), h("span", { dir: "ltr" }, info ? info.name.replace(/^[^:]+:\s*/, "") : m.model), icoEl("chev", 11));
  const canThink = info && (info.supported_parameters || []).includes("reasoning");
  $("#btnEffort").replaceChildren(icoEl("brain", 14), EFFORTS[canThink ? m.effort : "off"], icoEl("chev", 11)); $("#btnEffort").disabled = !canThink;
  const max = (info && info.context_length) || m.ctx.max || 0, pct = max ? Math.min(100, (m.ctx.used / max) * 100) : 0;
  $("#btnCtx").innerHTML = `<svg viewBox="0 0 36 36" width="22" height="22"><circle cx="18" cy="18" r="15" class="ring-bg"/><circle cx="18" cy="18" r="15" class="ring-fg ${pct > 80 ? "hot" : pct > 60 ? "warm" : ""}" stroke-dasharray="${(pct * 0.942).toFixed(1)} 94.2" transform="rotate(-90 18 18)"/></svg><span dir="ltr">${pct < 1 && m.ctx.used ? "<1" : Math.round(pct)}%</span>`;
  const b = $("#btnSend"); b.className = "send-btn" + (v.running ? " stop" : ""); b.title = v.running ? "إيقاف (Esc)" : "إرسال"; b.innerHTML = v.running ? '<span class="sq"></span>' : ico("up", 18);
  renderPlanBar(); renderTodos();
}

function renderAll() { renderTabs(); renderSidebar(); renderHead(); renderMsgs(); renderControls(); renderAtts(); $("#input").value = cur() ? cur().draft : ""; autosize(); }
function autosize() { const t = $("#input"); t.style.height = "auto"; t.style.height = Math.min(t.scrollHeight, 260) + "px"; }

async function send() {
  const v = cur(), inp = $("#input"), text = inp.value.trim();
  if (v.running) return;
  if (!text && !v.atts.length) return;
  if (/^\/expand(\s|$)/.test(text)) return expandPromptUI();
  if (text === "/compact") { inp.value = ""; return call("chat:compact", v.meta.id); }
  if (text === "/clear") { inp.value = ""; return clearChat(); }
  const sw = { "/plan": "plan", "/code": "agent", "/ask": "ask" }[text.split(/\s/)[0]];
  if (sw) { await patchSession({ mode: sw }); inp.value = text.replace(/^\S+\s*/, ""); if (!inp.value.trim()) return; return send(); }
  if (!S.settings.hasKey) { toast("أضِف مفتاح API أولاً", "err"); return settingsModal(); }
  const atts = v.atts; v.atts = []; v.draft = ""; v.planReady = false; inp.value = ""; autosize(); renderAtts(); stick = true;
  try { await api.invoke("chat:send", v.meta.id, { text, attachments: atts }); } catch (e) { toast(e.message, "err"); inp.value = text; v.atts = atts; renderAtts(); }
}
async function clearChat() {
  const v = cur(); if (v.running) return toast("أوقف الوكيل أولاً", "err");
  if (!(await ask("مسح المحادثة", { input: false, ok: "مسح", danger: true, note: "يُمسح سجلّ هذه الجلسة وسياقها. الملفات لا تتأثر." }))) return;
  const meta = await call("session:clear", v.meta.id); if (meta) { syncMeta(meta); v.log = []; renderAll(); }
}
async function addAttachments(list) { const v = cur(); for (const a of list) if (v.atts.length < 12) v.atts.push(a); renderAtts(); }

/* ---------- slash commands, skills and prompt expansion ---------- */

const BUILTIN_CMDS = [
  { cmd: "expand", title: "حسّن البرومت", desc: "يحوّل فكرتك إلى مواصفات واضحة قبل التنفيذ" }, { cmd: "plan", title: "وضع الخطة", desc: "يستكشف ويضع خطة بلا أي تعديل" },
  { cmd: "code", title: "وضع الكود", desc: "الوكيل ينفّذ ويكتب الملفات" }, { cmd: "ask", title: "وضع السؤال", desc: "إجابة بالقراءة فقط" },
  { cmd: "compact", title: "ضغط السياق", desc: "يلخّص المحادثة لتوفير المساحة" }, { cmd: "clear", title: "مسح المحادثة", desc: "يبدأ من جديد" },
];
let slash = null;
async function loadSkills() { S.skills = (await call("skills:list", S.active)) || []; }
function updateSlash() {
  const inp = $("#input"), box = $("#slash"), m = inp.value.match(/^\/([\w-]*)$/);
  if (!m) { box.hidden = true; slash = null; return; }
  const q = m[1].toLowerCase(), items = [...(S.skills || []).map((s) => ({ cmd: s.command, title: s.title, desc: s.description, skill: true, icon: s.icon })), ...BUILTIN_CMDS].filter((i) => i.cmd.startsWith(q));
  if (!items.length) { box.hidden = true; slash = null; return; }
  slash = { items, i: 0 }; drawSlash();
}
function drawSlash() {
  const box = $("#slash"); box.hidden = false;
  box.replaceChildren(...slash.items.map((it, i) => h("button", { class: i === slash.i ? "on" : "", onmousedown: (e) => { e.preventDefault(); slash.i = i; pickSlash(); } },
    icoEl(it.skill ? it.icon || "bolt" : "term", 14), h("code", { dir: "ltr" }, "/" + it.cmd), h("b", null, it.title), h("small", null, it.desc))));
}
function pickSlash() { const inp = $("#input"), it = slash.items[slash.i]; inp.value = "/" + it.cmd + " "; slash = null; $("#slash").hidden = true; inp.focus(); inp.setSelectionRange(inp.value.length, inp.value.length); autosize(); }

async function expandPromptUI() {
  const v = cur(), inp = $("#input"), btn = $("#btnExpand"), text = inp.value.trim().replace(/^\/expand\s*/, "");
  if (!text) return toast("اكتب فكرتك أولاً ثم اضغط ✨");
  if (!S.settings.hasKey) { toast("أضِف مفتاح API أولاً", "err"); return settingsModal(); }
  if (btn.classList.contains("busy")) return;
  btn.classList.add("busy"); inp.disabled = true;
  const out = await call("prompt:expand", v.meta.id, text);
  btn.classList.remove("busy"); inp.disabled = false;
  if (out) { v.draftBeforeExpand = text; inp.value = out; autosize(); inp.focus(); toast("تم توسيع الفكرة — عدّلها كما تشاء ثم أرسل"); } else inp.focus();
}

async function skillsModal() {
  const body = h("div", { class: "skills" }, h("div", { class: "muted" }, "جارٍ التحميل…")); modal("القدرات (Skills)", body, "wide");
  await loadSkills(); const list = S.skills || [];
  const use = (sk) => { fadeOut(document.querySelector(".modal-wrap")); const inp = $("#input"); inp.value = "/" + sk.command + " " + (sk.example || ""); autosize(); inp.focus(); inp.setSelectionRange(("/" + sk.command + " ").length, inp.value.length); };
  body.replaceChildren(
    h("p", { class: "muted" }, "القدرة = خبرة جاهزة يفعّلها الوكيل تلقائياً عند فهم طلبك، أو تستدعيها بكتابة ", h("code", { dir: "ltr" }, "/"), " في المحادثة. كل قدرة تأتي بمنهج عمل ومراجع وقوالب جاهزة."),
    h("div", { class: "skill-grid" }, list.map((sk) => h("div", { class: "skill-card" },
      h("div", { class: "sk-h" }, icoEl(sk.icon || "bolt", 18), h("b", null, sk.title), h("code", { dir: "ltr" }, "/" + sk.command), sk.origin === "yours" ? h("em", null, "قدرتك") : null),
      h("p", null, sk.description || ""),
      sk.example ? h("small", { class: "sk-ex", dir: "auto" }, "مثال: " + sk.example) : null,
      h("button", { class: "btn small primary", onclick: () => use(sk) }, "جرّب")))),
    h("div", { class: "sk-foot" }, h("button", { class: "btn small", onclick: () => call("skills:openFolder") }, icoEl("folder", 13), " مجلد قدراتك"),
      h("small", { class: "muted" }, "أنشئ ملف .md بترويسة (name, title, command, triggers, refs) ثم المنهج — يظهر هنا فوراً. يمكنك أيضاً وضع قدرات خاصة بمشروع داخل .antillusion/skills")));
}

/* @-mention of project files */
let mention = null;
async function updateMention() {
  const inp = $("#input"), box = $("#mention"), m = inp.value.slice(0, inp.selectionStart).match(/(^|\s)@([^\s@]*)$/);
  if (!m) { box.hidden = true; mention = null; return; }
  const q = m[2], files = await call("files:search", cur().meta.id, q);
  if (!files || !files.length) { box.hidden = true; mention = null; return; }
  mention = { start: inp.selectionStart - q.length - 1, end: inp.selectionStart, files, i: 0 };
  drawMention();
}
function drawMention() { const box = $("#mention"); box.hidden = false; box.replaceChildren(...mention.files.map((f, i) => h("button", { class: i === mention.i ? "on" : "", dir: "ltr", onmousedown: (e) => { e.preventDefault(); mention.i = i; pickMention(); } }, icoEl("file", 13), f))); }
function pickMention() { const inp = $("#input"), f = mention.files[mention.i]; inp.value = inp.value.slice(0, mention.start) + "@" + f + " " + inp.value.slice(mention.end); const p = mention.start + f.length + 2; inp.setSelectionRange(p, p); mention = null; $("#mention").hidden = true; }

/* ---------- pickers ---------- */

function modelPicker(anchor) {
  const v = cur(); let filter = "all";
  const search = h("input", { class: "field", placeholder: "ابحث في النماذج المتاحة…", dir: "auto" }), listEl = h("div", { class: "mlist" });
  const price = (m) => { const p = +m.pricing.prompt * 1e6, c = +m.pricing.completion * 1e6; return p === 0 && c === 0 ? "متاح" : `$${p < 1 ? p.toFixed(2) : p.toFixed(p % 1 ? 1 : 0)} / $${c < 1 ? c.toFixed(2) : c.toFixed(c % 1 ? 1 : 0)}`; };
  const draw = () => {
    const q = search.value.trim().toLowerCase(), fav = new Set(S.settings.favorites || []);
    let list = S.models.filter((m) => (!q || (m.id + " " + m.name).toLowerCase().includes(q)));
    if (filter === "fav") list = list.filter((m) => fav.has(m.id)); if (filter === "vision") list = list.filter((m) => m.architecture.input_modalities.includes("image"));
    list = [...list.filter((m) => fav.has(m.id)), ...list.filter((m) => !fav.has(m.id))].slice(0, 120);
    const rowFor = (m) => h("div", { class: "mrow" + (m.id === v.meta.model ? " on" : ""), onclick: () => { closePop(); patchSession({ model: m.id }); } },
      h("button", { class: "star" + (fav.has(m.id) ? " on" : ""), title: "مفضّلة", onclick: async (e) => { e.stopPropagation(); fav.has(m.id) ? fav.delete(m.id) : fav.add(m.id); S.settings = await call("settings:set", { favorites: [...fav] }) || S.settings; draw(); }, html: ico("star", 14) }),
      healthDot(m.id),
      h("div", { class: "mmain" }, h("b", { dir: "ltr" }, m.name), h("small", { dir: "ltr" }, m.id.replace(/:free$/, ""))),
      h("div", { class: "mmeta", dir: "ltr" }, h("span", { title: "نافذة السياق" }, fmtTok(m.context_length)), m.architecture.input_modalities.includes("image") ? h("span", { title: "يقرأ الصور", html: ico("eye", 12) }) : null,
        (m.supported_parameters || []).includes("reasoning") ? h("span", { title: "يدعم التفكير", html: ico("brain", 12) }) : null, h("span", { class: +m.pricing.prompt === 0 ? "free" : "", title: +m.pricing.prompt === 0 ? "متاح للاستخدام بمفتاحك" : "سعر الإدخال / الإخراج لكل مليون رمز" }, price(m))));
    const sc = S.settings.scout && Date.now() - S.settings.scout.at < 6 * 3600e3 ? new Set(S.settings.scout.ok.map((x) => x.id)) : new Set();
    const okList = q || filter !== "all" ? [] : S.models.filter((m) => sc.has(m.id));
    const favList = list.filter((m) => fav.has(m.id) && !okList.includes(m)), rest = list.filter((m) => !fav.has(m.id) && !okList.includes(m)), kids = [];
    if (okList.length) kids.push(h("div", { class: "mgroup" }, "تعمل الآن — مُختبرة"), ...okList.map(rowFor));
    if (favList.length) kids.push(h("div", { class: "mgroup" }, "المفضّلة"), ...favList.map(rowFor));
    if (rest.length) { if (favList.length || okList.length) kids.push(h("div", { class: "mgroup" }, "كل النماذج")); kids.push(...rest.map(rowFor)); }
    listEl.replaceChildren(...(kids.length ? kids : [h("div", { class: "side-empty" }, "لا نتائج")]));
  };
  const filters = h("div", { class: "seg small" }, [["all", "الكل"], ["fav", "المفضّلة"], ["vision", "يقرأ الصور"]].map(([k, l]) => h("button", { class: k === filter ? "on" : "", onclick: (e) => { filter = k; [...e.target.parentNode.children].forEach((b) => b.classList.toggle("on", b === e.target)); draw(); } }, l)));
  const el = h("div", { class: "model-pop" }, search, h("div", { class: "mp-row" }, filters, h("button", { class: "mini", title: "تحديث القائمة من OpenRouter", onclick: async () => { const l = await call("models:refresh"); if (l) { S.models = l; draw(); toast(`${l.length} نموذجاً متاحاً`); } }, html: ico("reload", 13) })), listEl);
  search.addEventListener("input", draw); draw(); popAt(anchor, el); search.focus();
}

function ctxPopover(anchor) {
  const v = cur(), m = v.meta, info = modelOf(m.model), max = (info && info.context_length) || m.ctx.max || 0, u = m.usage;
  const row = (a, b) => h("div", { class: "kv" }, h("span", null, a), h("b", { dir: "ltr" }, b));
  popAt(anchor, h("div", { class: "ctx-pop" }, h("div", { class: "mhead" }, "نافذة السياق"),
    h("div", { class: "bigbar" }, h("i", { style: `width:${max ? Math.min(100, (m.ctx.used / max) * 100) : 0}%` })),
    row("المستخدَم الآن", `${fmtTok(m.ctx.used)} / ${fmtTok(max)}`), row("ضغط تلقائي عند", `${S.settings.compactAt || 80}%`),
    row("إجمالي الإدخال (الجلسة)", fmtTok(u.prompt)), row("منها من الذاكرة المؤقتة", fmtTok(u.cached)), row("إجمالي الإخراج", fmtTok(u.completion)), row("الطلبات", u.requests), row("التكلفة", fmtCost(u.cost)),
    h("div", { class: "btn-row" }, h("button", { class: "btn small", disabled: v.running, onclick: () => { closePop(); call("chat:compact", m.id); } }, "ضغط السياق الآن"), h("button", { class: "btn small danger", disabled: v.running, onclick: () => { closePop(); clearChat(); } }, "مسح المحادثة"))));
}

/* ---------- preview panel ---------- */

const P = S.panel;
const ptab = (id) => P.tabs.find((t) => t.id === id);
const activeTab = () => ptab(P.active);
function setPanel(open) {
  const pn = $("#panel");
  if (!open && P.open && !pn.hidden) {   // slide out first, then hide
    P.open = false; $("#btnPanel").classList.remove("on"); pn.classList.add("leaving"); clearTimeout(setPanel.t);
    setPanel.t = setTimeout(() => { pn.classList.remove("leaving"); if (!P.open) { pn.hidden = true; $("#splitter").hidden = true; } }, 220);
    return;
  }
  pn.classList.remove("leaving");
  P.open = open; pn.hidden = !open; $("#splitter").hidden = !open; $("#btnPanel").classList.toggle("on", open);
  if (open) { $("#panel").style.width = store.get("panelW", Math.round(innerWidth * 0.46)) + "px"; if (!P.tabs.length) addPTab({}); }
}
function normUrl(u) { u = String(u || "").trim(); if (!u) return ""; if (/^(https?|file):/i.test(u)) return u; if (/^(localhost|127\.0\.0\.1|\[::1\])(:\d+)?(\/|$)/i.test(u) || /^[\w-]+:\d+/.test(u)) return "http://" + u; if (/^[\w-]+(\.[\w-]+)+(\/|$)/.test(u)) return "https://" + u; return "https://duckduckgo.com/?q=" + encodeURIComponent(u); }

function addPTab({ url, title, kind = "web", server }) {
  const t = { id: "p" + Math.random().toString(36).slice(2, 8), kind, url: url || "", title: title || (kind === "logs" ? "سجلّ" : "تبويب جديد"), errors: [], loadError: "", loading: false, ready: false, server };
  t.el = h("div", { class: "pview" }); $("#pviews").append(t.el);
  P.tabs.push(t);
  if (kind === "logs") { t.pre = h("pre", { class: "logs", dir: "ltr" }); t.el.append(t.pre); }
  else if (url) mountWebview(t, url); else drawBlank(t);
  activatePTab(t.id); return t;
}
function drawBlank(t) {
  t.el.replaceChildren(h("div", { class: "blank" }, icoEl("globe", 34), h("h3", null, "لوحة الاستعراض"), h("p", null, "اكتب عنواناً في الشريط أعلاه، أو اطلب من الوكيل تشغيل مشروعك وسيظهر هنا تلقائياً."),
    S.servers.filter((s) => s.url).map((s) => h("button", { class: "btn", onclick: () => navigate(t, s.url) }, icoEl("play", 13), ` ${s.name} — `, h("span", { dir: "ltr" }, s.url)))));
}
function mountWebview(t, url) {
  const wv = document.createElement("webview");
  wv.setAttribute("partition", "persist:antillusion-preview"); wv.setAttribute("allowpopups", ""); wv.src = url;
  t.wv = wv; t.url = url; t.ready = false; t.el.replaceChildren(h("div", { class: "vp " + P.size }, wv));
  wv.addEventListener("dom-ready", () => { t.ready = true; });
  wv.addEventListener("did-start-loading", () => { t.loading = true; drawPBar(); });
  wv.addEventListener("did-stop-loading", () => { t.loading = false; drawPBar(); });
  wv.addEventListener("did-start-navigation", (e) => { if (e.isMainFrame && !e.isSameDocument) { t.errors = []; t.loadError = ""; t.ready = false; } });
  wv.addEventListener("did-navigate", (e) => { t.url = e.url; drawPBar(); });
  wv.addEventListener("did-navigate-in-page", (e) => { if (e.isMainFrame) { t.url = e.url; drawPBar(); } });
  wv.addEventListener("page-title-updated", (e) => { t.title = e.title || t.title; drawPTabs(); });
  wv.addEventListener("did-fail-load", (e) => { if (e.isMainFrame && e.errorCode !== -3) { t.loadError = `${e.errorDescription} (${e.errorCode}) — ${e.validatedURL}`; t.ready = true; drawPBar(); } });
  wv.addEventListener("console-message", (e) => { if (e.level === 3 || e.level === "error") { t.errors.push(`${e.message}${e.sourceId ? ` (${String(e.sourceId).split("/").pop()}:${e.line || e.lineNumber || 0})` : ""}`); if (t.errors.length > 60) t.errors.shift(); drawPBar(); } });
}
function navigate(t, url) { url = normUrl(url); if (!url) return; if (t.kind !== "web") return; t.title = url.replace(/^https?:\/\//, ""); if (t.wv) { t.wv.src = url; t.url = url; } else mountWebview(t, url); drawPTabs(); drawPBar(); }
function activatePTab(id) { P.active = id; for (const t of P.tabs) t.el.classList.toggle("on", t.id === id); drawPTabs(); drawPBar(); }
function closePTab(id) { const i = P.tabs.findIndex((t) => t.id === id); if (i < 0) return; const [t] = P.tabs.splice(i, 1); clearInterval(t.timer); t.el.remove(); if (!P.tabs.length) { P.active = null; return setPanel(false); } if (P.active === id) activatePTab(P.tabs[Math.min(i, P.tabs.length - 1)].id); else drawPTabs(); }

function openPreview({ url, title }) {
  setPanel(true);
  const same = P.tabs.find((t) => t.kind === "web" && t.url && t.url.split("#")[0].replace(/\/$/, "") === url.split("#")[0].replace(/\/$/, ""));
  if (same) { activatePTab(same.id); same.errors = []; try { same.wv.reloadIgnoringCache(); } catch { same.wv.src = url; } return; }
  const blank = P.tabs.find((t) => t.kind === "web" && !t.wv);
  if (blank) { if (title) blank.title = title; navigate(blank, url); if (title) { blank.title = title; drawPTabs(); } activatePTab(blank.id); } else addPTab({ url, title });
}
function openLogs(s) {
  setPanel(true);
  const ex = P.tabs.find((t) => t.kind === "logs" && t.server === s.id); if (ex) return activatePTab(ex.id);
  const t = addPTab({ kind: "logs", title: "سجلّ · " + s.name, server: s.id });
  const tick = async () => { const txt = await api.invoke("servers:logs", s.id).catch(() => ""); const atEnd = t.pre.scrollTop + t.pre.clientHeight >= t.pre.scrollHeight - 30; t.pre.textContent = txt || "(لا يوجد خرج بعد)"; if (atEnd) t.pre.scrollTop = t.pre.scrollHeight; };
  tick(); t.timer = setInterval(tick, 1200);
}

function drawPTabs() {
  $("#ptabs").replaceChildren(...P.tabs.map((t) => h("div", { class: "ptab" + (t.id === P.active ? " on" : ""), title: t.url || t.title, onclick: () => activatePTab(t.id), onauxclick: (e) => e.button === 1 && closePTab(t.id) },
    icoEl(t.kind === "logs" ? "term" : "globe", 13), h("span", { class: "tab-t" }, t.title), h("button", { class: "tab-x", onclick: (e) => { e.stopPropagation(); closePTab(t.id); }, html: ico("x", 11) }))),
    h("button", { class: "tab-new", title: "تبويب جديد", onclick: (e) => menu(e.currentTarget, [{ label: "تبويب فارغ", icon: "plus", onClick: () => addPTab({}) },
      ...(S.servers.length ? [{ sep: 1 }, { head: "الخوادم العاملة" }] : []), ...S.servers.flatMap((s) => [s.url ? { label: s.name, sub: s.url, icon: "globe", onClick: () => addPTab({ url: s.url, title: s.name }) } : null, { label: "سجلّ " + s.name, icon: "term", onClick: () => openLogs(s) }])]), html: ico("plus", 14) }),
    h("span", { class: "grow" }), h("button", { class: "tab-new", title: "إخفاء اللوحة (تبقى التبويبات)", onclick: () => setPanel(false), html: ico("x", 14) }));
}
function drawPBar() {
  const t = activeTab(), bar = $("#pbar");
  if (!t || t.kind !== "web") { bar.replaceChildren(h("span", { class: "muted pad" }, t ? "خرج الخادم المباشر" : "")); return; }
  if (document.activeElement && document.activeElement.classList.contains("url") && bar.contains(document.activeElement)) { const st = $(".pstat", bar); if (st) st.replaceWith(pstat(t)); return; }
  const url = h("input", { class: "url", dir: "ltr", value: t.url, placeholder: "localhost:5173 أو أي عنوان…", spellcheck: false, onkeydown: (e) => { if (e.key === "Enter") { navigate(t, e.target.value); e.target.blur(); } }, onfocus: (e) => e.target.select() });
  const wv = () => t.wv;
  bar.replaceChildren(
    h("button", { class: "mini", title: "رجوع", onclick: () => wv() && wv().canGoBack() && wv().goBack(), html: ico("back", 14) }), h("button", { class: "mini", title: "تقدّم", onclick: () => wv() && wv().canGoForward() && wv().goForward(), html: ico("fwd", 14) }),
    h("button", { class: "mini" + (t.loading ? " spinning" : ""), title: "إعادة تحميل", onclick: () => wv() && wv().reloadIgnoringCache(), html: ico("reload", 14) }), url, pstat(t),
    h("div", { class: "seg small" }, [["desktop", "screen", "عرض كامل"], ["tablet", "tablet", "لوحي 768"], ["mobile", "phone", "جوال 390"]].map(([k, ic, tip]) => h("button", { class: P.size === k ? "on" : "", title: tip, onclick: () => { P.size = k; document.querySelectorAll(".vp").forEach((el) => (el.className = "vp " + k)); drawPBar(); }, html: ico(ic, 13) }))),
    h("button", { class: "mini", title: "أدوات المطوّر للصفحة", onclick: () => wv() && wv().openDevTools(), html: ico("bug", 14) }),
    h("button", { class: "mini", title: "فتح في المتصفح", onclick: () => t.url && call("open:external", t.url), html: ico("ext", 14) }));
}
const pstat = (t) => h("span", { class: "pstat" + (t.loadError || t.errors.length ? " bad" : ""), title: t.loadError || t.errors.slice(-8).join("\n") || "لا أخطاء في الكونسول",
  onclick: () => (t.loadError || t.errors.length) && modal("أخطاء الصفحة", h("pre", { dir: "ltr", class: "prewrap" }, [t.loadError, ...t.errors].filter(Boolean).join("\n\n")), "small") }, t.loadError ? "فشل التحميل" : t.errors.length ? `${t.errors.length} خطأ` : "");

async function handlePreviewRead(e) {
  const reply = (d) => api.invoke("preview:reply", e.reqId, d);
  const t = (activeTab() && activeTab().kind === "web" && activeTab().wv ? activeTab() : null) || [...P.tabs].reverse().find((x) => x.kind === "web" && x.wv);
  if (!t) return reply(null);
  try {
    for (let i = 0; i < 80 && (!t.ready || t.loading); i++) await sleep(100);
    if (t.loadError) return reply({ title: "", url: t.url, text: "", errors: t.errors.slice(), loadError: t.loadError });
    let result;
    if (e.js) { result = await t.wv.executeJavaScript(`(async()=>{try{const v=await (0,eval)(${JSON.stringify(e.js)});return v===undefined?"undefined":JSON.parse(JSON.stringify(v))}catch(err){return "JS error: "+(err&&err.message||err)}})()`); await sleep(250); }
    const base = await t.wv.executeJavaScript(`({title:document.title,url:location.href,text:(document.body?document.body.innerText:"").slice(0,8000)})`);
    reply({ ...base, errors: t.errors.slice(), loadError: t.loadError, result });
  } catch (err) { reply({ error: err.message }); }
}

(function splitter() {
  const sp = $("#splitter"); let on = false;
  sp.addEventListener("mousedown", (e) => { on = true; document.body.classList.add("dragging"); e.preventDefault(); });
  addEventListener("mousemove", (e) => { if (!on) return; const r = $("#panel").getBoundingClientRect(); const w = Math.max(320, Math.min(S.settings.panelSide === "left" ? e.clientX - r.left : r.right - e.clientX, innerWidth - 640)); $("#panel").style.width = w + "px"; });
  addEventListener("mouseup", () => { if (!on) return; on = false; document.body.classList.remove("dragging"); store.set("panelW", parseInt($("#panel").style.width)); });
})();

/* ---------- modals: settings, usage, library ---------- */

const setRow = (label, hint, ctl, tight) => h("div", { class: "set-row" }, h("div", { class: "lbl" }, h("b", null, label), hint ? h("small", null, hint) : null), h("div", { class: "set-ctl" + (tight ? " tight" : "") }, ctl));
const switchEl = (checked, onchange) => h("label", { class: "sw2" }, h("input", { type: "checkbox", checked: !!checked, onchange: (e) => onchange(e.target.checked) }), h("i"));
const segEl = (opts, value, onpick) => { const el = h("div", { class: "seg" }, Object.entries(opts).map(([k, l]) => h("button", { type: "button", class: String(value) === k ? "on" : "", onclick: () => { [...el.children].forEach((b) => b.classList.toggle("on", b === el.children[Object.keys(opts).indexOf(k)])); onpick(k); } }, l))); return el; };

async function settingsModal(openTab) {
  const s = S.settings;
  const save = async (patch) => { const r = await call("settings:set", patch); if (r) { S.settings = r; applyTheme(); } return r; };
  const R = (label, hint, ctl, o = {}) => ({ label, hint, ctl, o });
  const sel = (key, opts) => h("select", { class: "field", onchange: (e) => save({ [key]: e.target.value }) }, Object.entries(opts).map(([k, l]) => h("option", { value: k, selected: String(s[key]) === k }, l)));
  const num = (key, min, max, step = 1) => h("input", { class: "field num", type: "number", min, max, step, value: s[key], dir: "ltr", onchange: (e) => save({ [key]: Math.max(min, Math.min(max, +e.target.value || 0)) }) });
  const keyInp = h("input", { class: "field", type: "password", dir: "ltr", placeholder: s.hasKey ? "•••••••• محفوظ ومشفّر — اكتب مفتاحاً جديداً للاستبدال" : "sk-or-v1-…", autocomplete: "off" });
  const setUrl = async (u) => {
    await save({ baseUrl: u }); S.models = await call("models:refresh") || []; renderControls(); pollQuota();
    toast(S.models.length ? `${S.models.length} نموذجاً متاحاً` : "لا نماذج على هذا العنوان — تأكد أن السيرفر يعمل", S.models.length ? "" : "err");
    const v = cur(); if (v && !modelOf(v.meta.model) && S.models[0] && !v.running) patchSession({ model: S.models[0].id });
  };
  const PRESETS = { omniroute: "http://localhost:20128/v1", openrouter: "https://openrouter.ai/api/v1", ollama: "http://localhost:11434/v1", vllm: "http://localhost:8000/v1" };
  const urlInp = h("input", { class: "field", dir: "ltr", value: s.baseUrl, placeholder: "http://IP:8000/v1", onchange: (e) => setUrl(e.target.value.trim()) });
  const preset = Object.keys(PRESETS).find((k) => PRESETS[k] === s.baseUrl) || "custom";
  const keyText = h("span", null, s.hasKey ? "جارٍ فحص المفتاح…" : "لا يوجد مفتاح بعد."), keyNote = h("div", { class: "set-note" }, h("i", { class: "dot" }), keyText);
  const check = async () => {
    const u = await call("usage:get"); if (!u) return; const k = u.key || {}, bad = !!k.error; keyNote.className = "set-note " + (bad ? "bad" : "ok");
    keyText.textContent = bad ? k.error : S.settings.ownServer ? `متصل · ${k.label || "السيرفر"}` : `المفتاح يعمل · ${k.label || "OpenRouter"}${k.usage ? ` · استُخدم ${fmtCost(k.usage)}` : ""}${k.limit != null ? ` من حدّ ${fmtCost(k.limit)}` : ""}${k.free_model_daily_requests ? ` · طلبات اليوم ${k.free_model_daily_requests.used}/${k.free_model_daily_requests.limit}` : ""}`;
  };
  if (s.hasKey) check();
  const keyWarn = s.keyUnencrypted ? h("div", { class: "set-note bad" }, h("i", { class: "dot" }), "تشفير نظام التشغيل غير متاح على هذا الجهاز، فالمفتاح محفوظ كنص عادي في ملف الإعدادات. لا تشارك مجلد بيانات التطبيق.") : null;

  // version / updates card
  const verName = h("b", null, "Antillusion"), verSub = h("small", { dir: "ltr" }, "…"), verPill = h("span", { class: "upd-pill" }, "");
  const drawVer = async () => { const v = await call("app:version"); if (v) { verName.textContent = "Antillusion v" + (v.version || "?"); verSub.textContent = [v.commit, v.channel === "dev" ? "dev" : v.mode === "git" ? v.branch : "", v.run ? "build #" + v.run : ""].filter(Boolean).join(" · "); } const st = U.st || {}; const m = { idle: ["لم يُفحص بعد", ""], checking: ["جارٍ الفحص…", "busy"], installing: ["جارٍ التحديث…", "busy"], uptodate: ["أنت على أحدث إصدار", "ok"], available: ["يتوفر تحديث", "new"], ready: ["جاهز — أعد التشغيل", "new"], error: ["تعذّر الفحص", "bad"] }[st.phase] || ["", ""]; verPill.textContent = m[0]; verPill.className = "upd-pill " + m[1]; };
  drawVer(); const vl = () => { if (!document.body.contains(verName)) U.listeners.delete(vl); else drawVer(); }; U.listeners.add(vl);
  const verCard = h("div", { class: "ver-card" }, h("div", { class: "vlogo", html: ico("download", 26) }), h("div", { class: "grow" }, verName, verSub), verPill,
    h("button", { class: "btn small", onclick: () => call("update:check") }, "افحص الآن"), h("button", { class: "btn small primary", onclick: () => updateModal() }, "التفاصيل"));

  const themeCard = (k, l, bg) => h("button", { type: "button", class: "theme-card" + (s.theme === k || (!s.theme && k === "dark") ? " on" : ""), onclick: async (e) => { await save({ theme: k }); [...e.currentTarget.parentNode.children].forEach((b) => b.classList.toggle("on", b === e.currentTarget)); } }, h("div", { class: "sw-prev", style: `background:${bg}` }), l);
  const sections = [
    { id: "conn", title: "الاتصال", icon: "globe", sub: "المزوّد، المفتاح وعنوان السيرفر", rows: [
      R("مفتاح API", "مفتاح OmniRoute أو OpenRouter — يُحفظ مشفّراً على جهازك", h("div", { class: "keybox", style: "display:flex;gap:8px;width:100%" }, keyInp, h("button", { class: "btn primary", onclick: async () => { if (!keyInp.value.trim()) return; const r = await call("key:set", keyInp.value); if (r) { S.settings = r; keyInp.value = ""; keyInp.placeholder = "•••••••• محفوظ"; toast("تم حفظ المفتاح"); check(); } } }, "حفظ"))),
      R("مصدر النماذج", "سيرفرك أو جهازك: بلا مفتاح، بلا اشتراك، بلا حدّ طلبات", h("select", { class: "field", onchange: (e) => { const u = PRESETS[e.target.value]; if (u) { urlInp.value = u; setUrl(u); } else { urlInp.focus(); urlInp.select(); } } },
        [["omniroute", "OmniRoute (المحلي :20128)"], ["openrouter", "OpenRouter"], ["ollama", "Ollama على هذا الجهاز"], ["vllm", "vLLM على هذا الجهاز"], ["custom", "سيرفري السحابي (اكتب العنوان)"]].map(([k, l]) => h("option", { value: k, selected: k === preset }, l)))),
      R("عنوان الـAPI", "أي سيرفر متوافق مع OpenAI: OmniRoute، vLLM، Ollama", urlInp),
    ], notes: [keyNote, keyWarn] },
    { id: "agent", title: "الوكيل", icon: "bolt", sub: "السلوك الافتراضي والصلاحيات والأدوات", rows: [
      R("التحقق قبل التسليم", "يختبر الوكيل عمله قبل أن يقول «انتهيت»: الصياغة، الملفات المفقودة، تشغيل الصفحة فعلياً، والاختبارات — ويصلح ما يجده (كاملاً في Antillusion Code)", switchEl(s.verify !== false, (v) => save({ verify: v })), { tight: true }),
      R("الوضع الافتراضي", "كيف تبدأ الجلسات الجديدة", segEl({ agent: "كود", plan: "خطة", ask: "سؤال" }, s.mode, (k) => save({ mode: k })), { tight: true }),
      R("الصلاحيات الافتراضية", "تُطبَّق على الجلسات الجديدة", sel("perm", { ask: PERMS.ask[0], edits: PERMS.edits[0], auto: PERMS.auto[0] })),
      R("الطرفية", "auto = Git Bash إن وُجد وإلا PowerShell", sel("shell", { auto: "تلقائي", bash: "Git Bash", powershell: "PowerShell", cmd: "cmd" })),
      R("أقصى طول للرد (رموز)", "ارفعه للملفات الطويلة", num("maxTokens", 1000, 128000, 1000), { tight: true }),
      R("أقصى خطوات في الدورة", "حدّ أمان لحلقة الوكيل", num("maxSteps", 5, 400), { tight: true }),
      R("فتح الاستعراض تلقائياً", "عند تشغيل الوكيل خادماً محلياً", switchEl(s.autoPreview !== false, (v) => save({ autoPreview: v })), { tight: true }),
      R("تعليمات دائمة للوكيل", "تُضاف لكل جلسة. لتعليمات خاصة بمشروع ضع ملف AGENTS.md في جذره.", h("textarea", { class: "field", rows: 4, dir: "auto", placeholder: "مثال: استخدم TypeScript دائماً، واكتب التعليقات بالعربية.", onchange: (e) => save({ instructions: e.target.value }) }, s.instructions || ""), { col: true }),
    ] },
    { id: "models", title: "النماذج والخبير", icon: "brain", sub: "أي النماذج تظهر، ونموذج الاستشارة القوي", rows: [
      R("الخبير", "نموذج قويّ يضع خطة البناء ويتدخّل عند تعثّر النموذج المتاح. مدفوع من رصيد مفتاحك (سنتات قليلة لكل استشارة)", switchEl(!!s.expert, (v) => save({ expert: v })), { tight: true }),
      R("نموذج الخبير", "أي معرّف من OpenRouter", h("input", { class: "field", dir: "ltr", value: s.expertModel || "anthropic/claude-opus-5.5", onchange: (e) => save({ expertModel: e.target.value.trim() }) })),
      R("إظهار كل النماذج", "المتاحة لمفتاحك فقط افتراضياً؛ فعّله لإظهار المدفوعة أيضاً", switchEl(s.freeOnly === false, async (v) => { await save({ freeOnly: !v }); S.models = await call("models:refresh") || S.models; renderControls(); }), { tight: true }),
    ] },
    { id: "ctx", title: "السياق والإنفاق", icon: "chart", sub: "ضغط المحادثات وحدود التكلفة", rows: [
      R("ضغط السياق عند (%)", "يلخّص المحادثة القديمة تلقائياً عند بلوغ هذه النسبة من النافذة", num("compactAt", 30, 95), { tight: true }),
      R("حدّ إنفاق الجلسة ($)", "يتوقف الوكيل عند بلوغه — 0 = بلا حد", num("sessionBudget", 0, 1000, 0.5), { tight: true }),
    ] },
    { id: "look", title: "المظهر", icon: "sun", sub: "السِّمة وتخطيط الواجهة", rows: [
      R("السِّمة", "داكنة أو فاتحة", h("div", { class: "theme-cards" }, themeCard("dark", "داكنة", "linear-gradient(135deg,#191b1f,#0e0f11)"), themeCard("light", "فاتحة", "linear-gradient(135deg,#ffffff,#e9eaee)")), { tight: true }),
      R("موضع لوحة الاستعراض", "الجهة التي تُفتح فيها بجانب المحادثة", segEl({ right: "يمين", left: "يسار" }, s.panelSide || "right", (k) => save({ panelSide: k })), { tight: true }),      R("نافذة شفافة", "تُظهر ما خلف النافذة بخامة Acrylic على Windows 11 (معطّلة افتراضياً) — تُطبَّق بعد إعادة التشغيل", switchEl(s.windowGlass === true, (v) => save({ windowGlass: v })), { tight: true }),
      R("Quick Ask", "اختصار عام يفتح نافذة سؤال سريعة من أي برنامج (افتراضياً Alt+Space) — يُطبَّق بعد إعادة التشغيل", h("input", { class: "field", dir: "ltr", value: s.quickKey || "", placeholder: "Alt+Space", onchange: (e) => save({ quickKey: e.target.value.trim() }) })),
      R("ما الجديد", "اعرض شاشة مزايا الإصدار الحالي", h("button", { class: "btn", onclick: async () => { const w = await call("app:whatsnew"); if (w && w.current) whatsNew(w.current, w.all, { preview: true }); } }, "عرض"), { tight: true }),
    ] },
    { id: "update", title: "التحديثات", icon: "download", sub: "النسخة الحالية والتحديث التلقائي", head: verCard, dot: () => ["available", "ready"].includes((U.st || {}).phase), rows: [
      R("تحديث تلقائي", "يفحص كل 3 ساعات وعند التشغيل، وينزّل التحديث عندما لا يكون الوكيل مشغولاً — ثم يطلب منك إعادة التشغيل", switchEl(s.autoUpdate !== false, (v) => save({ autoUpdate: v })), { tight: true }),
      R("فرع التحديث", "للنسخ المستنسخة عبر git — اتركه فارغاً لاستخدام الفرع الحالي", h("input", { class: "field", dir: "ltr", value: s.updateBranch || "", placeholder: "main", onchange: async (e) => { await save({ updateBranch: e.target.value.trim() }); call("update:check"); } })),
    ] },
    { id: "adv", title: "متقدّم", icon: "sliders", sub: "التدريب، الإعداد والمجلدات", rows: [
      R("قدراتك الخاصة (Skills)", "ملفات .md تضيف قدرات جديدة للوكيل — تظهر عند كتابة / في المحادثة", h("button", { class: "btn", onclick: () => call("skills:openFolder") }, "فتح المجلد"), { tight: true }),
      R("مكتبتك الخاصة", "أضف مراجع .md ليستفيد منها الوكيل في كل جلساتك", h("button", { class: "btn", onclick: () => call("library:openFolder") }, "فتح المجلد"), { tight: true }),
      R("بيانات التدريب", "المحادثات الناجحة بصيغة JSONL لتدريب نموذجك (علّم المحادثة «ناجحة» من قائمة ⋮)", h("button", { class: "btn", onclick: async () => { const r = await call("train:export"); if (r) toast(`صُدّر ${r.examples} محادثة للتدريب`); } }, "تصدير JSONL"), { tight: true }),
      R("معالج الإعداد", "السِّمة، المفتاح، النموذج، الصلاحيات، المجلد", h("button", { class: "btn", onclick: () => { document.querySelector(".modal-wrap")?.remove(); setupWizard(); } }, "إعادة تشغيل الإعداد"), { tight: true }),
    ] },
  ];

  let tab = sections.some((x) => x.id === openTab) ? openTab : "conn";
  const pane = h("div", { class: "set-pane" }), side = h("div", { class: "set-side" }), search = h("input", { class: "field", placeholder: "ابحث في الإعدادات…", dir: "auto", autocomplete: "off" });
  const rowEl = (r) => h("div", { class: "set-row" + (r.o.col ? " col" : "") }, h("div", { class: "lbl" }, h("b", null, r.label), r.hint ? h("small", null, r.hint) : null), h("div", { class: "set-ctl" + (r.o.tight ? " tight" : "") }, r.ctl));
  const draw = () => {
    const q = search.value.trim().toLowerCase();
    [...side.querySelectorAll(".set-tab")].forEach((b) => b.classList.toggle("on", !q && b.dataset.id === tab));
    if (q) {
      const hits = sections.flatMap((x) => x.rows.filter((r) => (r.label + " " + (r.hint || "")).toLowerCase().includes(q)).map((r) => [x, r]));
      pane.replaceChildren(h("div", { class: "set-head" }, h("h3", null, "نتائج البحث"), h("p", null, hits.length ? `${hits.length} إعداداً` : "")), hits.length ? h("div", { class: "set-card" }, hits.map(([, r]) => rowEl(r))) : h("div", { class: "set-empty" }, "لا نتائج لـ «" + search.value + "»"));
      return;
    }
    const x = sections.find((y) => y.id === tab);
    pane.replaceChildren(h("div", { class: "set-head" }, h("h3", null, x.title), h("p", null, x.sub)), x.head || null, h("div", { class: "set-card" }, x.rows.map(rowEl), ...(x.notes || []).filter(Boolean)));
    pane.scrollTop = 0;
  };
  side.append(h("div", { class: "set-search" }, icoEl("search", 14), search), ...sections.map((x) => h("button", { type: "button", class: "set-tab", "data-id": x.id, onclick: () => { search.value = ""; tab = x.id; draw(); } }, icoEl(x.icon, 16), x.title, x.dot && x.dot() ? h("i", { class: "dot2" }) : null)));
  search.addEventListener("input", draw); draw();
  modal("الإعدادات", h("div", { class: "set-wrap" }, side, pane), "xl settings-modal");
}

async function usageModal() {
  const body = h("div", { class: "usage" }, h("div", { class: "muted" }, "جارٍ التحميل…")); modal("الاستخدام والحصص", body, "xl");
  const u = await call("usage:get"); if (!u) return;
  const v = cur(), k = u.key || {}, own = !!S.settings.ownServer, tokOf = (x) => (x.prompt || 0) + (x.completion || 0);
  const stat = (title, x, hero) => h("div", { class: "u-stat" + (hero ? " featured" : "") }, h("small", null, title), h("b", null, fmtTok(tokOf(x))), h("span", null, `${fmtCost(x.cost)} · ${x.requests} req`));
  const tokensEver = tokOf(u.all);
  // connection line (never mentions OpenRouter when the source is OmniRoute / a local server)
  const conn = h("div", { class: "u-conn" + (k.error ? " bad" : "") }, h("i", { class: "live" }),
    h("div", { class: "grow" }, h("b", null, k.error ? "تعذّر فحص الاتصال" : own ? (k.label || "السيرفر المحلي") : "OpenRouter" + (k.label ? ` · ${k.label}` : "")),
      h("div", { class: "muted", style: "font-size:12px;margin-top:2px" }, k.error ? k.error : own ? "لا مفتاح مدفوع هنا — حدود كل مزوّد تظهر في الحصص أدناه" : `المستهلَك ${fmtCost(k.usage || 0)}${k.limit != null ? ` من ${fmtCost(k.limit)} (المتبقي ${fmtCost(k.limit_remaining || 0)})` : " · بلا حدّ إنفاق"}${k.free_model_daily_requests ? ` · طلبات اليوم ${k.free_model_daily_requests.used}/${k.free_model_daily_requests.limit}` : ""}`)),
    h("code", null, S.settings.baseUrl || ""));
  // 14-day chart with a metric switch
  const chartHost = h("div", { class: "u-chart" }); let metric = store.get("usageMetric", "tokens");
  const drawChart = () => {
    const val = (d) => (metric === "cost" ? d.cost : metric === "requests" ? d.requests : tokOf(d)), fmt = (x) => (metric === "cost" ? fmtCost(x) : metric === "requests" ? String(x) : fmtTok(x)), max = Math.max(...u.days.map(val), 1e-9);
    chartHost.replaceChildren(h("div", { class: "u-bars" }, u.days.map((d, i) => { const x = val(d); return h("div", { class: "u-bar" + (x ? "" : " zero") }, h("span", { class: "tip" }, `${d.day} · ${fmt(x)}`), h("i", { style: `height:${x ? Math.max(4, (x / max) * 100) : 3}%;animation-delay:${i * 28}ms` }), h("small", null, i % 2 ? "" : d.day.slice(3))); })));
  };
  const seg = segEl({ tokens: "الرموز", requests: "الطلبات", cost: "التكلفة" }, metric, (m) => { metric = m; store.set("usageMetric", m); drawChart(); });
  drawChart();
  const table = (rows, first) => h("div", { class: "u-table" }, h("table", { class: "utable" }, h("thead", null, h("tr", null, [first, "الرموز", "إدخال", "مخزّن", "إخراج", "طلبات", "التكلفة"].map((x) => h("th", null, x)))),
    h("tbody", null, rows.length ? rows.map((r) => h("tr", null, h("td", { dir: "auto" }, r.label), ...[fmtTok(tokOf(r)), fmtTok(r.prompt), fmtTok(r.cached), fmtTok(r.completion), r.requests, fmtCost(r.cost)].map((x) => h("td", { dir: "ltr" }, x)))) : h("tr", null, h("td", { colSpan: 7, class: "muted" }, "لا بيانات بعد")))));
  const quotaBox = h("div", { class: "uquota" }, h("small", { class: "muted" }, "جارٍ فحص الحصص…")); if (own || /20128/.test(S.settings.baseUrl || "")) drawQuota(quotaBox); else quotaBox.hidden = true;
  body.replaceChildren(
    h("div", { class: "u-top" }, v ? stat("هذه الجلسة", v.meta.usage, true) : null, stat("اليوم", u.today, !v), stat("آخر 7 أيام", u.week), stat("آخر 30 يوماً", u.month), stat("الإجمالي", u.all)),
    conn, quotaBox,
    h("div", { class: "u-sec" }, h("h4", null, "آخر 14 يوماً"), seg), chartHost,
    h("div", { class: "u-sec" }, h("h4", null, "حسب النموذج")), table(u.byModel, "النموذج"), h("div", { class: "u-sec" }, h("h4", null, "حسب الجلسة")), table(u.bySession, "الجلسة"));
}

const pctColor = (p) => (p == null ? "var(--muted)" : p < 15 ? "var(--danger, #e5484d)" : p < 40 ? "#f5a524" : "var(--accent)");
const fmtPct = (p) => (p == null ? "—" : p.toFixed(p < 10 ? 1 : 0) + "%");
const fmtReset = (iso) => { const t = new Date(iso).getTime(); if (!iso || isNaN(t)) return ""; const d = t - Date.now(); if (d <= 0) return "يتجدد الآن"; const m = Math.round(d / 60000), dd = Math.floor(m / 1440), hh = Math.floor((m % 1440) / 60); return "يتجدد بعد " + (dd ? `${dd}ي ${hh}س` : hh ? `${hh}س ${m % 60}د` : `${m}د`); };
const ringEl = (pct, label) => { const C = 2 * Math.PI * 26, off = pct == null ? C : C * (1 - pct / 100); return h("div", { class: "q-ring", html: `<svg viewBox="0 0 64 64"><circle class="bg" cx="32" cy="32" r="26"/><circle class="fg" cx="32" cy="32" r="26" stroke="${pctColor(pct)}" stroke-dasharray="${C.toFixed(1)}" stroke-dashoffset="${off.toFixed(1)}"/></svg><b>${label != null ? label : fmtPct(pct)}</b>` }); };
async function drawQuota(box) {
  const q = await call("omni:quota"); if (!q) return;
  if (q.error) return box.replaceChildren(h("div", { class: "u-conn bad" }, h("i", { class: "live" }), h("div", { class: "grow" }, "تعذّر قراءة حصص OmniRoute", h("div", { class: "muted", style: "font-size:12px;margin-top:2px" }, q.error))));
  const cur = q.current, known = q.known || 0, total = q.providers.length;
  const qrow = (x) => { const name = String(x.name).replace(/[_-]+/g, " "); if (x.kind === "window") return h("div", { class: "q-row" }, h("span", { class: "n" }, name), h("span", { class: "v" }, `${Math.round(x.remaining ?? 0).toLocaleString("en")} / ${Math.round(x.total).toLocaleString("en")}`),
      h("div", { class: "q-bar" }, h("i", { style: `width:${x.remainingPct == null ? 0 : x.remainingPct}%;background:${pctColor(x.remainingPct)}` })), x.resetAt ? h("small", null, fmtReset(x.resetAt)) : null);
    return h("div", { class: "q-row" }, h("span", { class: "n" }, name), h("span", { class: "v dim" }, x.remaining != null ? Math.round(x.remaining).toLocaleString("en") : "—")); };
  box.replaceChildren(
    h("div", { class: "u-sec" }, h("h4", null, "المتبقي من الحصص"), h("span", { class: "muted", style: "font-size:12.5px" }, known ? `${known} من ${total} مزوّد لديه حصة محددة` : "لا حصص محددة بعد")),
    h("div", { class: "q-grid", style: "margin-top:10px" },
      q.providers.length ? [
        h("div", { class: "q-card sum" }, ringEl(q.overallPct), h("div", null, h("h5", null, "المجموع المتبقي"), h("div", { class: "plan" }, known ? "متوسط المزوّدين الذين لهم حصة محددة" : "ستظهر النسبة عند توفر حصة"))),
        ...q.providers.map((p) => h("div", { class: "q-card" + (cur && p.id && p.id === cur.id ? " cur" : "") }, ringEl(p.remainingPct, p.remainingPct == null ? "—" : null), h("h5", null, cur && p.id && p.id === cur.id ? h("em", null, "الحالي") : null, p.provider), h("div", { class: "plan" }, p.plan || ""), h("div", { class: "q-rows" }, p.quotas.map(qrow)))),
      ] : h("div", { class: "muted" }, "لا توجد بيانات حصص مخزّنة بعد — أرسل رسالة عبر OmniRoute ثم أعد المحاولة.")),
    h("details", { class: "qraw" }, h("summary", null, "البيانات الخام من OmniRoute (للتشخيص)"), h("pre", { dir: "ltr" }, JSON.stringify(q.raw, null, 2))));
}

/* ---------- OmniRoute quota chip + low-quota alert ---------- */

const Q = { data: null, warned: new Set() };
function quotaChip() {
  const d = Q.data; if (!d || d.error || !d.providers || !d.providers.length) return null;
  const cur = d.current, pct = cur ? cur.remainingPct : d.overallPct;
  return h("button", { class: "hchip quiet qchip", title: "المتبقي من حصص OmniRoute — اضغط للتفاصيل", onclick: usageModal },
    h("i", { class: "qdot", style: `background:${pctColor(pct)}` }), h("span", { dir: "ltr" }, `${cur ? cur.provider : "OmniRoute"} · ${fmtPct(pct)}`));
}
async function pollQuota() {
  if (!/20128/.test((S.settings && S.settings.baseUrl) || "")) { Q.data = null; return; }
  let q; try { q = await api.invoke("omni:quota"); } catch { return; }
  Q.data = q; if (cur()) renderHead();
  if (!q || q.error) return;
  for (const p of q.providers) {
    const low = p.remainingPct != null && p.remainingPct < 15, k = p.id || p.provider;
    if (low && !Q.warned.has(k)) { Q.warned.add(k); const alt = q.providers.filter((x) => x !== p && (x.remainingPct == null || x.remainingPct >= 15))[0]; toast(`⚠ حصة ${p.provider} على وشك النفاد (${fmtPct(p.remainingPct)})` + (alt ? ` — جرّب التحويل إلى ${alt.provider}` : ""), "err"); }
    if (!low) Q.warned.delete(k);
  }
}

/* ---------- updates (GitHub) ---------- */

const U = { st: { phase: "idle" }, listeners: new Set() };
/** Bottom-corner badge with the exact build that is running; refreshed after every update/restart. */
async function drawVersionBadge() {
  const v = await call("app:version"), b = $("#verBadge"); if (!v || !b) return;
  const parts = ["v" + (v.version || "?")]; if (v.commit) parts.push(v.commit);
  const tag = v.channel === "dev" ? "dev" : v.mode === "git" ? v.branch : "";
  b.replaceChildren(h("i", { class: "vdot" }), h("span", { dir: "ltr" }, parts.join(" · ") + (tag ? " · " + tag : "")));
  b.title = `Antillusion ${parts.join(" ")}${v.run ? "\nبناء رقم " + v.run : ""}${v.builtAt ? "\nبُنيت: " + new Date(v.builtAt).toLocaleString("ar") : ""}\nاضغط لفتح التحديثات`;
  b.hidden = false; b.onclick = updateModal;
  const key = parts.join("|"), seen = S.settings.lastVersionKey;
  if (seen !== key) { if (seen) toast(`تم تحديث Antillusion إلى ${parts.join(" · ")}`); const r = await call("settings:set", { lastVersionKey: key }); if (r) S.settings = r; }
}
function onUpdateState(st) {
  const prev = U.st.phase; U.st = st;
  const vb = $("#verBadge"); if (vb) vb.classList.toggle("new", st.phase === "available" || st.phase === "ready");
  const b = $("#btnUpdate"); if (b) { b.classList.toggle("has-update", st.phase === "available" || st.phase === "ready"); b.title = st.phase === "ready" ? "تم التحديث — أعد التشغيل" : st.phase === "available" ? "يتوفر تحديث جديد" : "التحديثات"; }
  U.listeners.forEach((fn) => fn(st));
  if (st.phase === "ready" && prev !== "ready") showUpdateBanner(st);
  else if (st.phase === "available" && prev !== "available" && !(S.settings && S.settings.autoUpdate !== false && st.mode === "git")) toast(`يتوفر تحديث جديد لـ Antillusion${st.behind ? ` (${st.behind} تغييرات)` : st.latest ? " " + st.latest : ""}`);
}
function showUpdateBanner(st) {
  document.querySelector(".upd-banner")?.remove();
  const bar = h("div", { class: "upd-banner" }, icoEl("refresh", 16), h("span", null, `تم تنزيل التحديث${st.latest ? " (" + st.latest + ")" : ""} — أعد تشغيل Antillusion لتطبيقه`),
    h("button", { class: "btn primary", onclick: () => call("update:restart") }, "إعادة التشغيل الآن"), h("button", { class: "ic-btn", title: "لاحقاً", onclick: () => fadeOut(bar), html: ico("x") }));
  document.body.append(bar);
}
/* ---------- What's New: a release presented like a phone OS update, once per minor version ---------- */
const WN_TINT = { person: "#5b8def", check: "#3ecf8e", term: "#4aa3ff", bug: "#ff7a59", drop: "#4aa3ff", spark: "#f5b14c", sparkle: "#f5b14c", pulse: "#3ecf8e", route: "#38bdc9", clock: "#7aa2ff", gamepad: "#ff8a4c", film: "#ff7a59", bolt: "#f5b14c", download: "#4aa3ff", chart: "#3ecf8e" };
function whatsNew(rel, all = [], opts = {}) {
  if (!rel) return;
  const close = async () => { wrap.classList.add("out"); setTimeout(() => wrap.remove(), 260); document.removeEventListener("keydown", onKey); if (!opts.preview) { const r = await call("settings:set", { seenRelease: rel.version }); if (r) S.settings = r; } };
  const onKey = (e) => { if (e.key === "Escape") close(); };
  const card = (x, i) => h("div", { class: "wn-card", style: `--i:${i};--tint:${WN_TINT[x.icon] || "var(--accent)"}` }, h("div", { class: "wn-ico", html: ico(x.icon === "spark" ? "sparkle" : x.icon, 22) }), h("div", null, h("b", null, x.title), h("p", null, x.body)));
  const older = all.filter((r) => r.version !== rel.version);
  const sheet = h("div", { class: "wn-sheet" },
    h("div", { class: "wn-glow" }),
    h("div", { class: "wn-head" }, h("span", { class: "wn-k" }, opts.preview ? "التحديث القادم" : "ما الجديد في"), h("h1", { dir: "ltr" }, "Antillusion ", h("span", null, rel.version)), h("div", { class: "wn-name", dir: "ltr" }, rel.name || ""), h("p", { class: "wn-tag" }, rel.tagline || ""), rel.hero ? h("p", { class: "wn-hero" }, rel.hero) : null),
    h("div", { class: "wn-grid" }, (rel.highlights || []).map(card)),
    (rel.more || []).length ? h("div", { class: "wn-more" }, h("h4", null, "وأيضاً"), h("ul", null, rel.more.map((t) => h("li", null, t)))) : null,
    older.length && !opts.preview ? h("details", { class: "wn-older" }, h("summary", null, "الإصدارات السابقة"), older.map((r) => h("div", { class: "wn-old" }, h("b", { dir: "ltr" }, `${r.version} · ${r.name || ""}`), h("span", null, r.tagline || ""), h("ul", null, (r.highlights || []).map((x) => h("li", null, h("b", null, x.title), " — ", x.body)))))) : null,
    h("div", { class: "wn-foot" }, h("button", { class: "btn primary wn-go", onclick: close }, opts.preview ? "حسناً" : "متابعة")));
  const wrap = h("div", { class: "wn-wrap", onmousedown: (e) => { if (e.target === wrap) close(); } }, sheet);
  $("#layer").append(wrap); document.addEventListener("keydown", onKey);
}

/* ---------- Time machine: every edit of this session on one line; rewind the project to any point ---------- */
async function timeMachine() {
  const v = cur(); if (!v) return;
  const list = await call("chat:timeline", v.meta.id); if (!list) return;
  const body = h("div", { class: "tm" });
  const m = modal("آلة الزمن", body, "wide");
  if (!list.length) { body.append(h("div", { class: "side-empty" }, h("div", { class: "empty-art" }), "لا توجد تعديلات قابلة للاسترجاع في هذه المحادثة بعد.")); return; }
  const fmt = (t) => t ? new Date(t).toLocaleTimeString("ar", { hour: "2-digit", minute: "2-digit" }) : "";
  body.append(h("p", { class: "muted", style: "margin:0 0 14px" }, `${list.length} تعديلاً على ملفاتك بالترتيب. اختر لحظة لإرجاع المشروع إلى ما قبلها — يُلغى ذلك التعديل وكل ما بعده.`),
    h("ol", { class: "tm-line" }, [...list].reverse().map((x, i) => h("li", { class: "tm-pt" + (i === 0 ? " now" : "") },
      h("div", { class: "tm-dot" }), h("div", { class: "tm-main" }, h("b", { dir: "ltr" }, x.path.split(/[\\/]/).slice(-2).join("/")), h("small", null, `${x.created ? "أنشأه" : "عدّله"} الوكيل · ${fmt(x.at)}`, x.diff ? h("span", { class: "t-diff", dir: "ltr" }, h("i", { class: "p" }, "+" + x.diff.add), h("i", { class: "m" }, "−" + x.diff.del)) : null)),
      h("button", { class: "btn small", disabled: v.running, onclick: async () => { if (!(await ask("إرجاع المشروع إلى ما قبل هذا التعديل؟", { input: false, ok: "أرجِع", danger: true, note: `سيُلغى ${list.length - list.indexOf(x)} تعديلاً (هذا وما بعده).` }))) return; const n = await call("chat:rewind", v.meta.id, x.id); if (n != null) { toast(`أُلغي ${n} تعديلاً`); m.close(); } } }, icoEl("rewind", 12), " إلى ما قبل هذا")))));
}

/* ---------- model health: what the router has been doing, per model ---------- */
function healthOf(id) {
  const x = (S.health || {})[id]; if (!x) return { st: "unknown", label: "لم يُستخدم بعد" };
  if (x.until && x.until > Date.now()) return { st: x.kind === "cooldown" ? "cool" : "down", label: `${x.last || "متعطّل"} — يُتجاوز حتى ${new Date(x.until).toLocaleTimeString("ar", { hour: "2-digit", minute: "2-digit" })}` };
  if (x.lastOk && (!x.lastFail || x.lastOk > x.lastFail)) return { st: "ok", label: `يعمل · ${x.ms ? (x.ms / 1000).toFixed(1) + " ث للخطوة" : ""}` };
  return { st: "warn", label: x.last ? "آخر محاولة: " + x.last : "غير مستقر" };
}
const diagEl = (list) => h("div", { class: "diag" }, list.map((p) => h("div", { class: "dg-row" },
  h("b", { dir: "ltr" }, p.provider), h("span", { class: "dg-why" }, p.reason), h("small", null, p.fix || ""), h("code", { dir: "ltr", title: p.models.join("\n") }, p.models[0] + (p.models.length > 1 ? ` +${p.models.length - 1}` : "")))));
const healthDot = (id) => { const x = healthOf(id); return h("span", { class: "hdot " + x.st, title: x.label }); };
function scoutBox(redraw) {
  const sc = S.settings.scout, fresh = sc && Date.now() - sc.at < 6 * 3600e3;
  const run = async (e) => { const b = e.currentTarget; b.disabled = true; b.replaceChildren(h("span", { class: "spin" }), h("span", { class: "scout-prog" }, "يفحص النماذج…"));
    const r = await call("router:scout"); if (r) { S.settings.scout = r; toast(r.ok.length ? `يعمل الآن ${r.ok.length} نموذجاً — سيُستخدم أسرعها تلقائياً عند الحاجة` : "لم يستجب أي نموذج — راجع تشخيص المزوّدين"); } redraw(); };
  return h("div", { class: "h-sec scout" },
    h("div", { class: "scout-h" }, h("div", null, h("h4", null, "نماذج تعمل الآن"), h("small", { class: "muted" }, fresh ? `آخر فحص ${relTime(sc.at)} — ${sc.ok.length} يعمل من ${sc.ok.length + sc.bad.length}` : "يرسل طلباً صغيراً جداً لنموذج أو اثنين من كل مزوّد ليعرف أيها يستجيب فعلاً، ثم يستخدمها الوكيل عند تعطّل المسارات المعتادة.")),
      h("button", { class: "btn primary", onclick: run }, fresh ? "أعد الفحص" : "ابحث عن نماذج تعمل")),
    fresh && sc.ok.length ? h("div", { class: "scout-ok" }, sc.ok.map((x) => h("button", { class: "rt-hop ok", title: "استخدمه", onclick: () => { patchSession({ model: x.id }); toast("تم التبديل إلى " + x.id); } }, h("i"), h("b", null, x.id), h("small", null, (x.ms / 1000).toFixed(1) + " ث")))) : null);
}
async function healthModal() {
  const r = await call("router:health"); if (r) { S.health = r.models || {}; if (r.diag) S.diag = r.diag; if (r.scout) S.settings.scout = r.scout; S.ranking = r.ranking; }
  const body = h("div", { class: "health" });
  const m = modal("صحة النماذج", body, "wide");
  const draw = () => {
    const ids = [...new Set([...Object.keys(S.health || {}), ...(S.models || []).slice(0, 12).map((x) => x.id)])];
    const order = { down: 0, cool: 1, warn: 2, ok: 3, unknown: 4 };
    ids.sort((a, b) => order[healthOf(a).st] - order[healthOf(b).st]);
    const counts = ids.reduce((c, id) => ((c[healthOf(id).st] = (c[healthOf(id).st] || 0) + 1), c), {});
    body.replaceChildren(
      h("p", { class: "muted", style: "margin:0 0 14px" }, "يتتبّع Antillusion كل نموذج يمرّ عبر الموجّه: النماذج المتعطّلة تُتجاوز تلقائياً لفترة تناسب سبب العطل (دقيقة لحدّ الطلبات، 10 دقائق لنفاد الرصيد)، ثم تُجرَّب من جديد."),
      scoutBox(draw),
      S.ranking && S.ranking.code && S.ranking.code.length ? h("div", { class: "h-sec" }, h("h4", null, "اختيارات الموجّه الذكي الآن"), h("div", { class: "rank-rows" },
        [["code", "للبرمجة"], ["reason", "للتخطيط وقيادة الفريق"], ["fast", "للمهام السريعة"]].map(([k, l]) => h("div", { class: "rank-row" }, h("span", null, l), h("div", { dir: "ltr" }, (S.ranking[k] || []).map((id, i) => h("span", { class: "rt-hop" + (i ? "" : " ok") }, h("i"), h("b", null, id)))))))) : null,
      S.diag && S.diag.providers && S.diag.providers.length ? h("div", { class: "h-sec" }, h("h4", null, "تشخيص المزوّدين — آخر فشل"), diagEl(S.diag.providers)) : null,
      h("div", { class: "h-sum" }, [["ok", "تعمل"], ["cool", "في تبريد"], ["down", "متعطّلة"], ["unknown", "لم تُجرَّب"]].map(([k, l]) => h("div", { class: "h-stat " + k }, h("b", null, String(counts[k] || 0)), h("span", null, l)))),
      h("div", { class: "h-grid" }, ids.map((id) => { const x = (S.health || {})[id] || {}, st = healthOf(id);
        return h("div", { class: "h-card " + st.st }, h("div", { class: "h-top" }, h("span", { class: "hdot " + st.st }), h("b", { dir: "ltr" }, id)),
          h("small", null, st.label), h("div", { class: "h-meta", dir: "ltr" }, h("span", null, "✓ " + (x.ok || 0)), h("span", null, "✕ " + (x.fail || 0)), x.ms ? h("span", null, (x.ms / 1000).toFixed(1) + "s") : null),
          h("div", { class: "h-acts" }, h("button", { class: "btn small", onclick: () => { patchSession({ model: id }); m.close(); toast("تم التبديل إلى " + id); } }, "استخدمه"))); })),
      h("div", { class: "btn-row", style: "margin-top:16px" }, h("button", { class: "btn", onclick: async () => { await call("router:reset"); S.health = {}; draw(); toast("أُعيد ضبط حالة النماذج"); } }, "إعادة المحاولة مع الكل"),
        h("button", { class: "btn", onclick: () => call("open:external", String(S.settings.baseUrl || "http://localhost:20128/v1").replace(/\/v1\/?$/, "") + "/dashboard") }, icoEl("ext", 13), " لوحة OmniRoute")));
  };
  draw();
}

async function updateModal() {
  // Layout: version + status bar (one action) → progress → what's new (timeline) | settings & source. Quiet, neutral, no decoration.
  const body = h("div", { class: "up2" });
  modal("التحديثات", body, "wide");
  let ver = null; call("app:version").then((v) => { ver = v; draw(U.st || {}); });
  const fmtTime = (t) => t ? new Date(t).toLocaleTimeString("ar", { hour: "2-digit", minute: "2-digit" }) : "—";
  const draw = (st) => {
    if (!body.isConnected) { U.listeners.delete(draw); return; }
    const busy = st.phase === "checking" || st.phase === "installing";
    const S2 = { idle: ["لم يُفحص بعد", "idle"], checking: ["يفحص GitHub…", "busy"], installing: ["يثبّت التحديث…", "busy"], uptodate: ["أنت على أحدث إصدار", "ok"], available: ["يتوفر إصدار جديد", "new"], ready: ["التحديث جاهز — أعد التشغيل لتطبيقه", "new"], error: ["تعذّر الفحص", "bad"] }[st.phase] || ["—", "idle"];
    const version = st.version || (ver && ver.version) || "";
    const [major, ...rest] = String(version).split(".");
    const action = st.phase === "ready" ? h("button", { class: "btn primary", onclick: () => call("update:restart") }, "إعادة التشغيل")
      : st.available && (st.mode === "git" || st.url || st.filesUrl) ? h("button", { class: "btn primary", disabled: busy || (st.mode === "git" && (st.dirty || st.ahead > 0)), onclick: () => call("update:install") }, busy ? "جارٍ التثبيت…" : st.latest ? `ثبّت ${st.latest}` : "ثبّت التحديث")
      : h("button", { class: "btn", disabled: busy, onclick: () => call("update:check") }, busy ? "يفحص…" : "افحص الآن");
    const head = h("div", { class: "up2-head" },
      h("div", { class: "up2-ver" },
        h("span", { class: "up2-k" }, "الإصدار الحالي"),
        h("div", { class: "up2-num", dir: "ltr" }, h("b", null, major || "—"), rest.length ? h("span", null, "." + rest.join(".")) : null),
        h("div", { class: "up2-tags", dir: "ltr" }, ver && ver.channel ? h("span", { class: "up2-tag" }, ver.channel === "dev" ? "dev channel" : "stable") : null, ver && ver.commit ? h("code", null, ver.commit) : null, ver && ver.run ? h("span", { class: "up2-tag" }, "build " + ver.run) : null)),
      h("div", { class: "up2-status" },
        h("div", { class: "up2-state " + S2[1] }, h("i"), h("span", null, S2[0])),
        h("small", null, (st.latest && st.available ? `المتاح: ${st.latest} · ` : "") + "آخر فحص " + fmtTime(st.checkedAt)),
        h("div", { class: "up2-actions" }, action,
          st.phase !== "ready" && (st.available || busy) ? h("button", { class: "btn ghost", disabled: busy, onclick: () => call("update:check") }, "إعادة الفحص") : null)));
    const parts = [head];
    if (st.phase === "installing") parts.push(h("div", { class: "up2-prog" + (st.progress == null ? " ind" : "") }, h("i", { style: st.progress != null ? `width:${Math.round(st.progress * 100)}%` : "" })));
    const notes = [];
    if (st.error) notes.push(["bad", st.error]);
    if (st.dirty) notes.push(["warn", "توجد تعديلات محلية غير محفوظة في ملفات التطبيق، لذلك لن يُحدَّث تلقائياً حتى تحفظها أو تتراجع عنها."]);
    if (st.ahead > 0) notes.push(["warn", `نسختك المحلية متقدمة بـ ${st.ahead} commit عن GitHub — لن يُطبَّق تحديث تلقائي.`]);
    if (st.note) notes.push(["info", st.note]);
    if (st.installed) notes.push(["ok", "حُدِّثت الاعتماديات (npm install) تلقائياً."]);
    for (const [k, t] of notes) parts.push(h("div", { class: "up2-note " + k }, h("i"), h("span", { dir: "auto" }, t)));
    const list = (st.phase === "ready" ? st.applied : st.commits) || [];
    const s = S.settings || {};
    // what the update brings, told like a product release: a new minor version gets its own presentation
    const curMM = String(version).split(".").slice(0, 2).join("."), rel = (st.available || st.phase === "ready") && st.release ? st.release : null, bigRel = rel && rel.version !== curMM;
    if (rel) parts.push(h("div", { class: "up2-rel" +  (bigRel ? " major" : "") },
      h("div", { class: "up2-rel-h" }, h("div", null, h("span", { class: "up2-k" }, bigRel ? "إصدار رئيسي جديد" : "تحديث لـ " + rel.version), h("h3", { dir: "ltr" }, bigRel ? `Antillusion ${rel.version} · ${rel.name || ""}` : "تحسينات وإصلاحات"), h("p", null, bigRel ? rel.tagline : `${list.length || "عدة"} تحسينات على ${rel.name || "الإصدار الحالي"}`)),
        bigRel ? h("button", { class: "btn ghost", onclick: () => whatsNew(rel, [], { preview: true }) }, "اكتشف الجديد") : null),
      bigRel ? h("div", { class: "up2-feats" }, (rel.highlights || []).slice(0, 4).map((x) => h("div", { class: "up2-feat", style: `--tint:${WN_TINT[x.icon] || "var(--accent)"}` }, h("i", { html: ico(x.icon === "spark" ? "sparkle" : x.icon, 16) }), h("b", null, x.title)))) : null));
    const left = h("div", { class: "up2-col" },
      h("div", { class: "up2-h" }, st.phase === "ready" ? "ما الذي تغيّر" : list.length ? (rel ? "التفاصيل التقنية" : `التغييرات (${st.behind || list.length})`) : "سجل التغييرات"),
      list.length ? h("ol", { class: "up2-log" }, list.map((c) => h("li", null, h("p", { dir: "auto" }, c.subject), h("small", { dir: "ltr" }, h("code", null, c.sha), ` · ${c.author || ""} · ${c.when || ""}`))))
        : h("div", { class: "up2-empty" }, st.phase === "uptodate" ? "لا تغييرات جديدة منذ آخر تحديث." : "افحص التحديثات لعرض ما تغيّر."),
      st.notes ? h("pre", { class: "up2-relnotes", dir: "auto" }, st.notes) : null);
    const right = h("div", { class: "up2-col side" },
      h("div", { class: "up2-h" }, "الإعدادات"),
      setRow("تحديث تلقائي", "يفحص عند التشغيل وكل 3 ساعات، وينزّل الملفات المعدّلة فقط عندما لا يكون الوكيل مشغولاً", switchEl(s.autoUpdate !== false, async (v) => { const r = await call("settings:set", { autoUpdate: v }); if (r) S.settings = r; }), true),
      st.mode === "git" ? setRow("فرع التحديث", "فارغ = الفرع الحالي", h("input", { class: "field", dir: "ltr", value: s.updateBranch || "", placeholder: st.branch || "main", onchange: async (e) => { const r = await call("settings:set", { updateBranch: e.target.value.trim() }); if (r) { S.settings = r; call("update:check"); } } })) : null,
      h("div", { class: "up2-h", style: "margin-top:18px" }, "المصدر"),
      h("dl", { class: "up2-dl" },
        h("dt", null, "المستودع"), h("dd", { dir: "ltr" }, st.repo || "—"),
        h("dt", null, "الطريقة"), h("dd", null, st.mode === "git" ? `git · ${st.branch || ""}${st.head ? " @ " + st.head : ""}` : "إصدار مثبّت · تحديث تفاضلي"),
        st.size ? [h("dt", null, "حجم المثبّت"), h("dd", { dir: "ltr" }, (st.size / 1048576).toFixed(1) + " MB (احتياطي)")] : null),
      S.settings.prevHead && st.mode === "git" ? h("button", { class: "btn ghost up2-rb", disabled: busy, onclick: async () => { if (await ask("التراجع عن آخر تحديث؟", { input: false, ok: "تراجع", danger: true, note: "سيعود الكود إلى النسخة السابقة ويُوقَف التحديث التلقائي. أعد تشغيل التطبيق بعدها." })) { const r = await call("update:rollback"); if (r) { const ns = await call("settings:set", {}); if (ns) S.settings = ns; } } } }, "التراجع إلى النسخة السابقة") : null);
    parts.push(h("div", { class: "up2-grid" }, left, right));
    body.replaceChildren(...parts.filter(Boolean));
  };
  U.listeners.add(draw); draw(U.st || {});
  const st = await call("update:state"); if (st) { U.st = st; draw(st); }
  if (!st || st.phase === "idle" || st.phase === "error") call("update:check");
}

async function libraryModal() {
  const lib = await call("library:list", S.active); if (!lib) return;
  const viewer = h("div", { class: "lib-view md" }), listEl = h("div", { class: "lib-list" }), search = h("input", { class: "field", placeholder: "ابحث في المراجع والفهرس…", dir: "auto" });
  const showCard = async (c) => { viewer.className = "lib-view md"; viewer.dir = "ltr"; viewer.innerHTML = MD.render(await call("library:read", c.id, S.active) || ""); viewer.scrollTop = 0; };
  const showCatalog = (q) => {
    const rows = lib.catalog.map((l) => l.split("|").map((x) => x.trim())).filter((r) => !q || r.join(" ").toLowerCase().includes(q));
    viewer.className = "lib-view"; viewer.replaceChildren(h("p", { class: "muted" }, `فهرس الحزم الموثوقة — ${rows.length} مجالاً. الوكيل يتحقق من أحدث إصدار من السجلّ الرسمي قبل الاستخدام.`),
      h("table", { class: "utable cat" }, h("tbody", null, rows.map((r) => h("tr", null, h("td", { dir: "ltr" }, h("span", { class: "eco" }, r[0])), h("td", { dir: "ltr" }, h("b", null, r[1])), h("td", { dir: "ltr" }, r[2]))))));
  };
  const draw = () => {
    const q = search.value.trim().toLowerCase();
    const cards = lib.cards.filter((c) => !q || (c.id + c.title + c.tags).toLowerCase().includes(q));
    listEl.replaceChildren(h("button", { class: "lib-item cat", onclick: () => showCatalog(q) }, icoEl("box", 14), h("span", null, h("b", null, "فهرس الحزم"), h("small", null, `${lib.catalog.length} مجالاً عبر كل اللغات`))),
      ...cards.map((c) => h("button", { class: "lib-item", onclick: () => showCard(c) }, icoEl("book", 14), h("span", null, h("b", { dir: "ltr" }, c.title), h("small", null, c.origin === "yours" ? "من مكتبتك" : `${(c.size / 1000).toFixed(1)}k حرف`)))));
    if (q) showCatalog(q);
  };
  search.addEventListener("input", draw);
  modal("المكتبة الهندسية", h("div", { class: "lib" }, h("div", { class: "lib-side" }, search, listEl,
    h("div", { class: "btn-row" }, h("button", { class: "btn small", onclick: async () => { const n = await call("library:import"); if (n) { toast(`أُضيف ${n} مرجعاً — الوكيل سيستخدمها`); libClose(); libraryModal(); } } }, icoEl("plus", 13), " استيراد مرجع"), h("button", { class: "btn small", onclick: () => call("library:openFolder") }, "مجلد مكتبتي"))), viewer), "xwide");
  const libClose = () => fadeOut(document.querySelector(".modal-wrap"));
  draw(); showCard(lib.cards.find((c) => c.id === "scaffolds") || lib.cards[0]);
}

const relTime = (t) => { const d = Date.now() - t, m = Math.round(d / 60000); if (m < 1) return "الآن"; if (m < 60) return `قبل ${m} د`; const hh = Math.round(m / 60); if (hh < 24) return `قبل ${hh} س`; const dd = Math.round(hh / 24); if (dd < 30) return `قبل ${dd} ي`; return new Date(t).toLocaleDateString("ar"); };
function historyModal() {
  const search = h("input", { class: "field", placeholder: "ابحث في كل المحادثات…", dir: "auto" }), listEl = h("div", { class: "hist" });
  const draw = () => { const q = search.value.trim().toLowerCase();
    const list = S.order.filter((m) => !q || m.title.toLowerCase().includes(q) || String(m.cwd).toLowerCase().includes(q)).sort((x, y) => y.updated - x.updated);
    listEl.replaceChildren(...(list.length ? list.map((m) => h("button", { class: "hist-row", onclick: () => { md.close(); openSession(m.id); } }, h("b", { dir: "auto" }, m.title),
      h("small", null, h("span", { class: "chip-path", dir: "ltr" }, icoEl("folder", 11), shortPath(m.cwd)), h("span", null, relTime(m.updated)), h("span", { dir: "ltr" }, fmtCost(m.usage.cost) + " · " + fmtTok((m.usage.prompt || 0) + (m.usage.completion || 0)))))) : [h("div", { class: "side-empty" }, h("div", { class: "empty-art" }), q ? "لا نتائج لـ «" + search.value + "»" : "لا محادثات بعد")])); };
  search.addEventListener("input", draw);
  const md = modal("سجل المحادثات", h("div", { class: "ask" }, search, listEl), "wide"); draw(); search.focus();
}

async function tasksModal() {
  const body = h("div", { class: "tasks" }); const md = modal("Scheduled Tasks", body, "wide");
  const draw = async () => {
    const list = await call("tasks:list") || [];
    const edit = (t) => {
      t = t || { title: "", prompt: "", cwd: cur().meta.baseCwd, kind: "daily", time: "09:00", minutes: 60, enabled: true, model: cur().meta.model };
      const f = { title: h("input", { class: "field", value: t.title, placeholder: "اسم المهمة", dir: "auto" }), prompt: h("textarea", { class: "field", rows: 5, dir: "auto", placeholder: "ماذا يفعل الوكيل في كل تشغيل؟ مثال: شغّل الاختبارات وأصلح ما يفشل ثم لخّص النتيجة." }, t.prompt),
        cwd: h("input", { class: "field", value: t.cwd, dir: "ltr" }), kind: h("select", { class: "field" }, h("option", { value: "daily", selected: t.kind === "daily" }, "يومياً في وقت محدد"), h("option", { value: "interval", selected: t.kind === "interval" }, "كل عدد من الدقائق")),
        time: h("input", { class: "field num", type: "time", value: t.time || "09:00" }), minutes: h("input", { class: "field num", type: "number", min: 5, value: t.minutes || 60 }) };
      const row = (l, c) => h("label", { class: "srow" }, h("div", null, h("b", null, l)), c);
      body.replaceChildren(row("الاسم", f.title), h("label", { class: "scol" }, h("b", null, "التعليمات"), f.prompt), row("مجلد المشروع", f.cwd), row("التكرار", f.kind), row("الوقت (يومي)", f.time), row("كل (دقيقة)", f.minutes),
        h("p", { class: "muted" }, "تعمل المهام ما دام التطبيق مفتوحاً، في محادثة جديدة بصلاحية «تلقائي» (الأوامر الخطِرة تبقى بانتظار إذنك) وبالنموذج الحالي."),
        h("div", { class: "btn-row" }, h("button", { class: "btn primary", onclick: async () => { if (!f.title.value.trim() || !f.prompt.value.trim()) return toast("أدخل الاسم والتعليمات", "err");
          await call("tasks:save", { ...t, title: f.title.value.trim(), prompt: f.prompt.value.trim(), cwd: f.cwd.value.trim(), kind: f.kind.value, time: f.time.value, minutes: Math.max(5, +f.minutes.value || 60) }); draw(); } }, "حفظ"), h("button", { class: "btn", onclick: draw }, "رجوع")));
    };
    body.replaceChildren(
      ...(list.length ? list.map((t) => h("div", { class: "task-row" }, h("input", { type: "checkbox", class: "sw", checked: t.enabled, title: "مفعّلة", onchange: async (e) => { await call("tasks:save", { ...t, enabled: e.target.checked }); } }),
        h("div", { class: "task-main" }, h("b", { dir: "auto" }, t.title), h("small", null, t.kind === "daily" ? `يومياً ${t.time}` : `كل ${t.minutes} دقيقة`, " · ", h("span", { dir: "ltr" }, baseName(t.cwd)), t.lastRun ? ` · آخر تشغيل ${new Date(t.lastRun).toLocaleString("ar")}` : " · لم تُشغَّل بعد")),
        h("button", { class: "mini", title: "شغّل الآن", onclick: async () => { const r = await call("tasks:run", t.id); if (r) { md.close(); openSession(r); } }, html: ico("play", 13) }),
        h("button", { class: "mini", title: "تعديل", onclick: () => edit(t), html: ico("edit", 13) }), h("button", { class: "mini danger", title: "حذف", onclick: async () => { await call("tasks:delete", t.id); draw(); }, html: ico("trash", 13) })))
        : [h("div", { class: "side-empty" }, "لا توجد مهام مجدولة. أنشئ مهمة ليشغّلها الوكيل تلقائياً: اختبارات ليلية، تحديث تبعيات، تقرير يومي عن المستودع…")]),
      h("div", { class: "btn-row" }, h("button", { class: "btn primary", onclick: () => edit(null) }, icoEl("plus", 14), " مهمة جديدة")));
  };
  draw();
}

/* ---------- first-run setup ---------- */

const MARK = '<svg viewBox="0 0 24 24" width="100%" height="100%"><circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M12 3a9 9 0 010 18z" fill="currentColor"/></svg>';
function setupWizard() {
  const old = document.querySelector(".setup"); if (old) old.remove();
  const st = { theme: S.settings.theme || "dark", model: S.settings.model, perm: S.settings.perm || "ask", cwd: S.settings.lastCwd || "", shortcut: true };
  const save = async (patch) => { const r = await call("settings:set", patch); if (r) S.settings = r; };
  const card = (on, onClick, ...kids) => h("button", { class: "s-card" + (on ? " on" : ""), onclick: onClick }, kids, on ? h("span", { class: "s-check", html: ico("check", 14) }) : null);
  let step = 0, keyState = null;
  const steps = [
    { title: "أهلاً بك في Antillusion", sub: "وكيل برمجة يعمل على جهازك: يقرأ مشروعك، يكتب الكود، يشغّله ويعرضه لك حيّاً. لنجهّزه في دقيقة — ابدأ باختيار المظهر.",
      body: () => h("div", { class: "s-grid two" }, [["dark", "داكن", "مريح للعين في العمل الطويل"], ["light", "فاتح", "واضح ونظيف في النهار"]].map(([k, name, tip]) => card(st.theme === k, async () => { st.theme = k; await save({ theme: k }); applyTheme(); draw(); },
        h("div", { class: "s-prev " + k }, h("i", { class: "sp-side" }), h("i", { class: "sp-line a" }), h("i", { class: "sp-line b" }), h("i", { class: "sp-box" })), h("b", null, name), h("small", null, tip)))) },
    { title: "اربط مفتاح OpenRouter", sub: "مفتاح واحد يفتح لك مئات النماذج. يُحفظ مشفّراً على جهازك فقط ولا يُرسَل إلا إلى OpenRouter.",
      body: () => {
        const inp = h("input", { class: "field", type: "password", dir: "ltr", placeholder: S.settings.hasKey ? "•••••••• (محفوظ — اكتب مفتاحاً جديداً للاستبدال)" : "sk-or-v1-…", autocomplete: "off" });
        const info = h("div", { class: "s-status" + (keyState && keyState.error ? " bad" : keyState ? " ok" : "") }, keyState ? (keyState.error ? "⚠ " + keyState.error : `✓ المفتاح يعمل — ${keyState.label || ""} · استُخدم ${fmtCost(keyState.usage || 0)}`) : S.settings.hasKey ? "يوجد مفتاح محفوظ. اضغط «تحقّق» لاختباره." : "لم يُضَف مفتاح بعد.");
        const check = async () => { if (inp.value.trim()) { const r = await call("key:set", inp.value); if (r) S.settings = r; } if (!S.settings.hasKey) return toast("أدخل المفتاح أولاً", "err"); info.textContent = "جارٍ التحقق…"; const u = await call("usage:get"); keyState = (u && u.key) || { error: "تعذّر الاتصال" }; draw(); };
        if (S.settings.hasKey && !keyState) setTimeout(check, 50);
        inp.addEventListener("keydown", (e) => e.key === "Enter" && check());
        return h("div", { class: "s-col" }, h("div", { class: "keybox" }, inp, h("button", { class: "btn primary", onclick: check }, "تحقّق واحفظ")), info,
          h("button", { class: "s-link", onclick: () => call("open:external", "https://openrouter.ai/keys") }, "ليس لديك مفتاح؟ أنشئ واحداً من openrouter.ai/keys ↗"));
      } },
    { title: "اختر النموذج الافتراضي", sub: "يمكنك تبديله في أي لحظة من أسفل مربع الكتابة.",
      body: () => {
        const known = [["poolside/laguna-s-2.1:free", "موصى به", "مخصّص للبرمجة، سريع ومتوازن"], ["nvidia/nemotron-3-ultra-550b-a55b:free", "الأقوى", "نموذج كبير بسياق مليون رمز"], ["cohere/north-mini-code:free", "سريع", "خفيف ومخصّص للكود"],
          ["thinkingmachines/inkling:free", "يقرأ الصور", "سياق واسع ويفهم لقطات الشاشة"], ["nvidia/nemotron-3.5-lightning:free", "الأسرع", "ردود فورية للمهام الصغيرة"], ["google/gemma-4-31b-it:free", "بديل", "من Google، يقرأ الصور"]].filter((p) => modelOf(p[0]));
        const picks = known.length >= 3 ? known : S.models.slice(0, 6).map((m) => [m.id, "متاح", fmtTok(m.context_length) + " سياق"]);
        if (!picks.some((p) => p[0] === st.model)) st.model = picks[0][0];
        return h("div", { class: "s-grid three" }, picks.map(([id, tag, tip]) => card(st.model === id, () => { st.model = id; draw(); }, h("span", { class: "s-tag" }, tag), h("b", { dir: "ltr" }, modelOf(id).name.replace(/^[^:]+:\s*/, "")), h("small", null, tip))));
      } },
    { title: "كم تريد أن يستأذنك الوكيل؟", sub: "الأوامر الخطِرة وما هو خارج مجلد المشروع يُسأل عنها دائماً، أياً كان اختيارك.",
      body: () => h("div", { class: "s-grid three" }, Object.entries(PERMS).map(([k, [name, tip]]) => card(st.perm === k, () => { st.perm = k; draw(); }, h("span", { class: "s-ico", html: ico(k === "auto" ? "bolt" : k === "edits" ? "edit" : "shield", 20) }), h("b", null, name), h("small", null, tip)))) },
    { title: "أين تعمل؟", sub: "اختر مجلد المشروع الذي تبدأ به. يمكنك تحديد مجلد مختلف لكل محادثة لاحقاً.",
      body: () => h("div", { class: "s-col" },
        h("button", { class: "s-folder", onclick: async () => { const p = await call("setup:pickFolder"); if (p) { st.cwd = p; draw(); } } }, icoEl("folder", 20), h("span", { dir: "ltr" }, st.cwd || "اختر مجلداً…"), h("u", null, st.cwd ? "تغيير" : "استعراض")),
        h("label", { class: "s-opt" }, h("input", { type: "checkbox", class: "sw", checked: st.shortcut, onchange: (e) => (st.shortcut = e.target.checked) }), "أنشئ اختصاراً لـ Antillusion على سطح المكتب")) },
  ];
  const finish = async () => {
    await save({ theme: st.theme, model: st.model, perm: st.perm, setupDone: true });
    if (st.shortcut) await call("setup:shortcut");
    const v = cur();
    if (v && !v.log.length) { await patchSession({ model: st.model, perm: st.perm }); if (st.cwd && st.cwd !== v.meta.baseCwd) await setFolder(st.cwd); }
    wrap.classList.add("out"); setTimeout(() => wrap.remove(), 300); renderAll(); $("#input").focus(); toast("كل شيء جاهز — ماذا نبني؟");
  };
  const wrap = h("div", { class: "setup" }); $("#layer").append(wrap);
  function draw() {
    const s = steps[step], last = step === steps.length - 1;
    wrap.replaceChildren(h("div", { class: "s-drag" }), h("div", { class: "s-box" },
      h("div", { class: "s-top" }, h("span", { class: "s-mark", html: MARK }), h("div", { class: "s-dots" }, steps.map((_, i) => h("i", { class: i === step ? "on" : i < step ? "done" : "" }))), h("span", { class: "s-count", dir: "ltr" }, `${step + 1} / ${steps.length}`)),
      h("h1", null, s.title), h("p", { class: "s-sub" }, s.sub), h("div", { class: "s-body" }, s.body()),
      h("div", { class: "s-nav" }, step ? h("button", { class: "btn", onclick: () => { step--; draw(); } }, "السابق") : h("span"), h("span", { class: "grow" }),
        step === 1 && !S.settings.hasKey ? h("button", { class: "btn", onclick: () => { step++; draw(); } }, "تخطَّ الآن") : null,
        h("button", { class: "btn primary", disabled: step === 1 && !S.settings.hasKey, onclick: () => (last ? finish() : (step++, draw())) }, last ? "ابدأ العمل" : "التالي"))));
  }
  draw();
}

/* ---------- events from main ---------- */

function onEvt(e) {
  if (e.t === "servers") { S.servers = e.list; renderServers(); const t = activeTab(); if (t && t.kind === "web" && !t.wv) drawBlank(t); return; }
  if (e.t === "update") return onUpdateState(e.state);
  if (e.t === "open-session") { const m = e.meta; if (!S.sess.has(m.id)) { view(m, []); S.order.unshift(m); } openSession(m.id); renderSidebar(); return; }
  if (e.t === "scout") { S.settings.scout = e.result; return; }
  if (e.t === "diag") { S.diag = e.diag; return; }
  if (e.t === "scout-progress") { const el = document.querySelector(".scout-prog"); if (el) el.textContent = `يفحص ${e.done}/${e.total}${e.ok ? ` · يعمل ${e.ok}` : ""}…`; return; }
  if (e.t === "health") { if (e.reset) S.health = {}; else (S.health || (S.health = {}))[e.model] = e.health; return; }
  if (e.t === "router") return toast("OmniRoute يُثبَّت في الخلفية — قد يستغرق بضع دقائق، وسيعمل تلقائياً عند اكتماله");
  if (e.t === "preview") return openPreview(e);
  if (e.t === "previewRead") return handlePreviewRead(e);
  if (e.t === "session" && !S.sess.has(e.sid)) { view(e.meta); syncMeta(e.meta); return renderSidebar(); }
  const v = S.sess.get(e.sid); if (!v) return;
  if (e.t === "item") {
    const i = v.log.findIndex((x) => x.id === e.item.id);
    const prev = i >= 0 ? v.log[i] : null; if (prev && prev.live && e.item.status === "running") e.item.live = prev.live;
    if (i >= 0) v.log[i] = e.item; else v.log.push(e.item);
    if (v === cur()) { upsertDom(v, e.item); if (act.el && act.el.isConnected) msgs().append(act.el); } else if (e.item.kind !== "user") { v.unread = true; renderTabs(); }
  } else if (e.t === "delta") {
    const it = v.log.find((x) => x.id === e.id); if (!it) return;
    if (e.set !== undefined) it.text = e.set; if (e.text) it.text += e.text; if (e.reasoning) it.reasoning += e.reasoning;
    if (v === cur()) { dirty.add(e.id); if (!raf) raf = requestAnimationFrame(flushDeltas); }
  } else if (e.t === "activity") { setActivity(v, e);
  } else if (e.t === "progress") {
    const it = v.log.find((x) => x.id === e.id); if (it) { it.live = e.tail; if (v === cur() && !v.open.has(it.id)) upsertDom(v, it); }
  } else if (e.t === "status") {
    v.running = e.running;
    if (!e.running) { const last = v.log[v.log.length - 1]; v.planReady = v.meta.mode === "plan" && last && last.kind === "assistant" && last.text.length > 200; v.meta.updated = Date.now(); if (v === cur()) refreshGit(); if (!document.hasFocus() || v !== cur()) { v.unread = v !== cur(); } }
    renderTabs(); renderSidebar(); if (v === cur()) renderControls();
  } else if (e.t === "usage") { v.meta.usage = e.usage; v.meta.ctx = e.ctx; if (v === cur()) { renderControls(); renderHead(); } }
  else if (e.t === "todos") { v.meta.todos = e.todos; if (v === cur()) renderTodos(); }
  else if (e.t === "session") { syncMeta(e.meta); renderTabs(); renderSidebar(); if (v === cur()) renderHead(); }
  else if (e.t === "attention" && v !== cur()) { v.unread = true; renderTabs(); toast(`«${v.meta.title}» ينتظر إذنك`); }
}

/* ---------- wiring ---------- */

function applyTheme() { document.documentElement.dataset.theme = S.settings.theme || "dark"; const tb = $("#btnTheme"); if (tb) tb.innerHTML = ico(S.settings.theme === "light" ? "moon" : "sun"); $("#main").classList.toggle("pleft", S.settings.panelSide === "left"); api.invoke("theme:set", S.settings.theme || "dark"); }

function wire() {
  const inp = $("#input");
  $("#btnUsage").innerHTML = ico("chart"); $("#btnSkills").innerHTML = ico("bolt"); $("#btnExpand").innerHTML = ico("sparkle", 17); $("#btnUpdate").innerHTML = ico("download"); $("#btnLibrary").innerHTML = ico("book"); $("#btnPanel").innerHTML = ico("panelR"); $("#btnAttach").innerHTML = ico("plus", 17);
  $("#btnSide").innerHTML = ico("panel"); $("#btnBack").innerHTML = ico("arrowL"); $("#btnFwd").innerHTML = ico("arrowR"); $("#btnNewProject").innerHTML = ico("folderPlus", 15);
  $("#btnNew").replaceChildren(icoEl("plus", 16), "New Conversation"); $("#btnHistory").replaceChildren(icoEl("history", 16), "Conversation History"); $("#btnTasks").replaceChildren(icoEl("clock", 16), "Scheduled Tasks"); $("#btnSettings").replaceChildren(icoEl("gear", 16), "Settings");
  $("#btnTheme").onclick = async () => { S.settings = await call("settings:set", { theme: S.settings.theme === "light" ? "dark" : "light" }) || S.settings; applyTheme(); };
  $("#btnHistory").onclick = historyModal; $("#btnTasks").onclick = tasksModal; $("#btnBack").onclick = () => navGo(-1); $("#btnFwd").onclick = () => navGo(1);
  $("#btnSide").onclick = () => {
    const b = document.body, hide = !b.classList.contains("noside");
    if (hide) { b.classList.add("side-leaving"); setTimeout(() => { b.classList.remove("side-leaving"); b.classList.add("noside"); }, 200); } else b.classList.remove("noside");
    store.set("noside", hide);
  }; document.body.classList.toggle("noside", store.get("noside", false));
  $("#btnNewProject").onclick = async () => { const v = await newSession(); if (v) pickFolder(); };
  $("#btnNew").onclick = () => newSession();
  $("#btnNewCode").replaceChildren(h("span", { class: "code-glyph" }, "</>"), h("span", null, "Antillusion Code"), h("span", { class: "new-tag" }, "جديد"));
  $("#btnNewCode").onclick = () => newCodeSession(); $("#btnUsage").onclick = usageModal; $("#btnSkills").onclick = skillsModal; $("#btnExpand").onclick = expandPromptUI; $("#btnUpdate").onclick = updateModal; $("#btnLibrary").onclick = libraryModal; $("#btnSettings").onclick = settingsModal; $("#btnPanel").onclick = () => setPanel(!P.open);
  $("#btnSend").onclick = () => (cur().running ? call("chat:stop", S.active) : send());
  $("#btnAttach").onclick = async () => { const l = await call("attach:pick"); if (l) addAttachments(l); };
  $("#btnPerm").onclick = (e) => menu(e.currentTarget, [{ head: "صلاحيات الوكيل في هذه الجلسة" }, ...Object.entries(PERMS).map(([k, [label, sub]]) => ({ label, sub, checked: cur().meta.perm === k, icon: k === "auto" ? "bolt" : k === "edits" ? "edit" : "shield", onClick: () => patchSession({ perm: k }) }))]);
  $("#btnModel").onclick = (e) => modelPicker(e.currentTarget);
  $("#btnEffort").onclick = (e) => menu(e.currentTarget, [{ head: "مجهود التفكير قبل الرد" }, ...Object.entries(EFFORTS).map(([k, label]) => ({ label, checked: cur().meta.effort === k, onClick: () => patchSession({ effort: k }) }))]);
  $("#btnCtx").onclick = (e) => ctxPopover(e.currentTarget);
  msgs().addEventListener("scroll", () => { stick = msgs().scrollTop + msgs().clientHeight >= msgs().scrollHeight - 60; });
  msgs().addEventListener("click", (e) => {
    const c = e.target.closest("[data-copy]"); if (c) { navigator.clipboard.writeText(c.closest(".codeblock").querySelector("code").textContent); c.textContent = "تم النسخ"; setTimeout(() => (c.textContent = "نسخ"), 1200); return; }
    const a = e.target.closest("a[href]"); if (a) { e.preventDefault(); const u = a.getAttribute("href"); /^https?:\/\/(localhost|127\.0\.0\.1)/.test(u) ? openPreview({ url: u }) : call("open:external", u); }
  });
  document.addEventListener("click", (e) => { const a = e.target.closest(".modal a[href]"); if (a) { e.preventDefault(); call("open:external", a.getAttribute("href")); } });

  inp.addEventListener("input", () => { autosize(); updateMention(); updateSlash(); });
  inp.addEventListener("keydown", (e) => {
    if (slash) {
      if (e.key === "ArrowDown" || e.key === "ArrowUp") { e.preventDefault(); slash.i = (slash.i + (e.key === "ArrowDown" ? 1 : -1) + slash.items.length) % slash.items.length; return drawSlash(); }
      if ((e.key === "Enter" || e.key === "Tab") && !e.shiftKey && !e.isComposing && !(e.key === "Enter" && inp.value.trim() === "/" + slash.items[slash.i].cmd && !slash.items[slash.i].skill)) { e.preventDefault(); return pickSlash(); }
      if (e.key === "Escape") { slash = null; $("#slash").hidden = true; return; }
    }
    if (mention) {
      if (e.key === "ArrowDown" || e.key === "ArrowUp") { e.preventDefault(); mention.i = (mention.i + (e.key === "ArrowDown" ? 1 : -1) + mention.files.length) % mention.files.length; return drawMention(); }
      if (e.key === "Enter" || e.key === "Tab") { e.preventDefault(); return pickMention(); }
      if (e.key === "Escape") { mention = null; $("#mention").hidden = true; return; }
    }
    if (e.key === "Enter" && !e.shiftKey && !e.isComposing) { e.preventDefault(); send(); }
  });
  inp.addEventListener("paste", (e) => {
    for (const f of e.clipboardData.files) if (f.type.startsWith("image/")) { e.preventDefault(); const r = new FileReader(); r.onload = () => addAttachments([{ name: f.name || "صورة ملصقة.png", kind: "image", dataUrl: r.result }]); r.readAsDataURL(f); }
  });
  const chat = $("#chat");
  chat.addEventListener("dragover", (e) => { e.preventDefault(); chat.classList.add("drop"); });
  chat.addEventListener("dragleave", (e) => { if (!chat.contains(e.relatedTarget)) chat.classList.remove("drop"); });
  chat.addEventListener("drop", async (e) => { e.preventDefault(); chat.classList.remove("drop"); const paths = [...e.dataTransfer.files].map((f) => api.pathFor(f)).filter(Boolean); if (paths.length) addAttachments(await call("attach:read", paths) || []); });

  addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !popEl && !document.querySelector(".modal-wrap") && cur() && cur().running) call("chat:stop", S.active);
    if (e.key === "Escape") closePop();
    if (e.ctrlKey && e.key.toLowerCase() === "t") { e.preventDefault(); newSession(); }
    if (e.ctrlKey && e.key.toLowerCase() === "w") { e.preventDefault(); closeTab(S.active); }
    if (e.ctrlKey && e.key.toLowerCase() === "b") { e.preventDefault(); setPanel(!P.open); }
    if (e.ctrlKey && e.key === ",") { e.preventDefault(); settingsModal(); }
    if (e.ctrlKey && e.key === "Tab" && S.tabs.length > 1) { e.preventDefault(); openSession(S.tabs[(S.tabs.indexOf(S.active) + (e.shiftKey ? -1 : 1) + S.tabs.length) % S.tabs.length]); }
  });
  addEventListener("focus", () => { const v = cur(); if (v && v.unread) { v.unread = false; renderTabs(); } });
}

if (new URLSearchParams(location.search).has("material")) document.documentElement.classList.add("material");   // Windows 11 Acrylic behind the window
(async function boot() {
  const b = await api.invoke("boot");
  Object.assign(S, { settings: b.settings, models: b.models, order: b.sessions, servers: b.servers, home: b.home });
  applyTheme(); wire(); api.on(onEvt); setTimeout(() => { const s = $("#splash"); s.classList.add("out"); setTimeout(() => s.remove(), 350); }, 500);
  for (const m of b.sessions) view(m);
  if (b.selftest) {
    const v = await newSession({ cwd: b.selftest.cwd, perm: b.selftest.perm || "auto", model: b.selftest.model || undefined, mode: "agent" });
    $("#input").value = b.selftest.prompt; return send();
  }
  const tabs = store.get("tabs", []).filter((id) => S.sess.has(id));
  if (!tabs.length) await newSession(); else { S.tabs = tabs; const active = store.get("active"); await openSession(tabs.includes(active) ? active : tabs[0]); }
  if (!S.settings.setupDone || b.forceSetup) setupWizard();
  call("update:state").then((st) => st && onUpdateState(st)); drawVersionBadge(); loadSkills(); pollQuota(); setInterval(pollQuota, 60000);
  call("router:health").then((r) => { if (r) S.health = r.models || {}; });
  call("app:whatsnew").then((w) => { if (w && w.current && w.seen !== w.current.version && S.settings.setupDone) setTimeout(() => whatsNew(w.current, w.all), 900); });
})();
