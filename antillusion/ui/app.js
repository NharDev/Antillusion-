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
  plus: "M12 5v14M5 12h14", x: "M6 6l12 12M18 6L6 18", up: "M12 19V5M5 12l7-7 7 7", folder: "M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z",
  clip: "M21 12.5l-8.5 8.5a5.5 5.5 0 01-7.8-7.8l9-9a3.7 3.7 0 015.2 5.2l-9 9a1.8 1.8 0 01-2.6-2.6l8.3-8.3", sliders: "M4 6h9M17 6h3M4 12h3M11 12h9M4 18h11M19 18h1M15 4v4M9 10v4M17 16v4",
  download: "M12 3v12M7 11l5 5 5-5M4 20h16", refresh: "M20 11a8 8 0 00-14.9-3M4 4v4h4M4 13a8 8 0 0014.9 3M20 20v-4h-4", chart: "M4 20V10M10 20V4M16 20v-7M2 20h20", book: "M5 4h13a1 1 0 011 1v15H6.5A1.5 1.5 0 015 18.5zM5 18.5A1.5 1.5 0 016.5 17H19", branch: "M6 4v10M6 14a3 3 0 100 6 3 3 0 000-6zM18 4a3 3 0 100 6 3 3 0 000-6zM18 10c0 5-6 3-9 6",
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
function closePop() { if (popEl) { popEl.remove(); popEl = null; } }
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
  const close = () => { wrap.remove(); document.removeEventListener("keydown", onKey); };
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
          h("span", { class: "sess-t", dir: "auto" }, m.title), m.worktree ? h("span", { class: "wt-badge", html: ico("box", 12), title: "worktree" }) : null,
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
    h("button", { class: "crumb", title: m.cwd, onclick: (e) => folderMenu(e.currentTarget) }, h("span", { dir: "auto" }, baseName(m.baseCwd) || m.cwd)), h("span", { class: "crumb-sep" }, "/"),
    h("span", { class: "crumb cur", dir: "auto", title: "انقر مرتين لإعادة التسمية", ondblclick: renameSession }, m.title),
    h("span", { class: "grow" }),
    quotaChip(),
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

function itemEl(v, it) {
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
  return h("div", { class: "notice " + (it.level || "info"), data: { id: it.id }, dir: "auto" }, it.text);
}

const act = { el: null, t0: 0, timer: 0, sid: null, text: "" };
function setActivity(v, e) {
  if (v !== cur()) return;
  const label = e.tool ? `${(TOOL[e.tool] || [e.tool])[0]}${e.hint ? " " + e.hint : ""}${e.chars > 400 ? ` · ${fmtTok(e.chars)} حرف` : ""}` : e.text;
  if (!label) { clearInterval(act.timer); if (act.el) act.el.remove(); act.el = null; return; }
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
  $("#heroBottom").replaceChildren(v.log.length ? null : h("div", { class: "suggest" }, SUGGEST.map(([t, p]) => h("button", { title: p, onclick: () => { $("#input").value = p; autosize(); $("#input").focus(); } }, t))));
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
    listEl.replaceChildren(...(list.length ? list.map((m) => h("div", { class: "mrow" + (m.id === v.meta.model ? " on" : ""), onclick: () => { closePop(); patchSession({ model: m.id }); } },
      h("button", { class: "star" + (fav.has(m.id) ? " on" : ""), title: "مفضّلة", onclick: async (e) => { e.stopPropagation(); fav.has(m.id) ? fav.delete(m.id) : fav.add(m.id); S.settings = await call("settings:set", { favorites: [...fav] }) || S.settings; draw(); }, html: ico("star", 14) }),
      h("div", { class: "mmain" }, h("b", { dir: "ltr" }, m.name), h("small", { dir: "ltr" }, m.id.replace(/:free$/, ""))),
      h("div", { class: "mmeta", dir: "ltr" }, h("span", { title: "نافذة السياق" }, fmtTok(m.context_length)), m.architecture.input_modalities.includes("image") ? h("span", { title: "يقرأ الصور", html: ico("eye", 12) }) : null,
        (m.supported_parameters || []).includes("reasoning") ? h("span", { title: "يدعم التفكير", html: ico("brain", 12) }) : null, h("span", { class: +m.pricing.prompt === 0 ? "free" : "", title: +m.pricing.prompt === 0 ? "متاح للاستخدام بمفتاحك" : "سعر الإدخال / الإخراج لكل مليون رمز" }, price(m))))) : [h("div", { class: "side-empty" }, "لا نتائج")]));
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
  P.open = open; $("#panel").hidden = !open; $("#splitter").hidden = !open; $("#btnPanel").classList.toggle("on", open);
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

async function settingsModal() {
  const s = S.settings;
  const save = async (patch) => { const r = await call("settings:set", patch); if (r) { S.settings = r; applyTheme(); } };
  const row = (label, hint, ctl) => h("label", { class: "srow" }, h("div", null, h("b", null, label), hint ? h("small", null, hint) : null), ctl);
  const sel = (key, opts) => h("select", { class: "field", onchange: (e) => save({ [key]: e.target.value }) }, Object.entries(opts).map(([k, l]) => h("option", { value: k, selected: String(s[key]) === k }, l)));
  const num = (key, min, max, step = 1) => h("input", { class: "field num", type: "number", min, max, step, value: s[key], dir: "ltr", onchange: (e) => save({ [key]: Math.max(min, Math.min(max, +e.target.value || 0)) }) });
  const keyInp = h("input", { class: "field", type: "password", dir: "ltr", placeholder: s.hasKey ? "•••••••• (محفوظ ومشفّر — اكتب مفتاحاً جديداً للاستبدال)" : "sk-or-v1-…", autocomplete: "off" });
  const setUrl = async (u) => {
    await save({ baseUrl: u }); S.models = await call("models:refresh") || []; renderControls();
    toast(S.models.length ? `${S.models.length} نموذجاً متاحاً` : "لا نماذج على هذا العنوان — تأكد أن السيرفر يعمل", S.models.length ? "" : "err");
    const v = cur(); if (v && !modelOf(v.meta.model) && S.models[0] && !v.running) patchSession({ model: S.models[0].id });
  };
  const PRESETS = { omniroute: "http://localhost:20128/v1", openrouter: "https://openrouter.ai/api/v1", ollama: "http://localhost:11434/v1", vllm: "http://localhost:8000/v1" };
  const urlInp = h("input", { class: "field", dir: "ltr", value: s.baseUrl, placeholder: "http://IP:8000/v1", onchange: (e) => setUrl(e.target.value.trim()) });
  const preset = Object.keys(PRESETS).find((k) => PRESETS[k] === s.baseUrl) || "custom";
  const keyInfo = h("small", { class: "muted" }, s.hasKey ? "جارٍ فحص المفتاح…" : "لا يوجد مفتاح بعد.");
  const keyWarn = s.keyUnencrypted ? h("small", { class: "upd-note bad" }, "⚠ تشفير نظام التشغيل غير متاح على هذا الجهاز، فالمفتاح محفوظ كنص عادي في ملف الإعدادات. لا تشارك مجلد بيانات التطبيق.") : null;
  const check = async () => { const u = await call("usage:get"); if (!u) return; const k = u.key || {}; keyInfo.textContent = k.error ? "⚠ " + k.error : `المفتاح يعمل · ${k.label || "المزوّد"}${k.usage ? ` · استُخدم ${fmtCost(k.usage)}` : ""}${k.limit != null ? ` من حدّ ${fmtCost(k.limit)}` : ""}${k.free_model_daily_requests ? ` · طلبات اليوم ${k.free_model_daily_requests.used}/${k.free_model_daily_requests.limit}` : ""}`; };
  if (s.hasKey) check();
  modal("الإعدادات", h("div", { class: "settings" },
    h("h4", null, "الاتصال"),
    row("مفتاح API", "مفتاح OmniRoute أو OpenRouter — يُحفظ مشفّراً على جهازك", h("div", { class: "keybox" }, keyInp, h("button", { class: "btn primary", onclick: async () => { if (!keyInp.value.trim()) return; const r = await call("key:set", keyInp.value); if (r) { S.settings = r; keyInp.value = ""; keyInp.placeholder = "•••••••• (محفوظ)"; toast("تم حفظ المفتاح"); check(); } } }, "حفظ"))),
    h("div", { class: "srow" }, h("span"), keyInfo), keyWarn,
    row("مصدر النماذج", "سيرفرك أو جهازك: بلا مفتاح، بلا اشتراك، بلا حدّ طلبات", h("select", { class: "field", onchange: (e) => { const u = PRESETS[e.target.value]; if (u) { urlInp.value = u; setUrl(u); } else { urlInp.focus(); urlInp.select(); } } },
      [["omniroute", "OmniRoute (المحلي :20128)"], ["openrouter", "OpenRouter"], ["ollama", "Ollama على هذا الجهاز"], ["vllm", "vLLM على هذا الجهاز"], ["custom", "سيرفري السحابي (اكتب العنوان)"]].map(([k, l]) => h("option", { value: k, selected: k === preset }, l)))),
    row("عنوان الـAPI", "أي سيرفر متوافق مع OpenAI: OmniRoute، vLLM، Ollama", urlInp),
    h("h4", null, "الوكيل"),
    row("الوضع الافتراضي", null, sel("mode", { agent: "كود", plan: "خطة", ask: "سؤال" })),
    row("الصلاحيات الافتراضية", "تُطبَّق على الجلسات الجديدة", sel("perm", { ask: PERMS.ask[0], edits: PERMS.edits[0], auto: PERMS.auto[0] })),
    row("الطرفية", "auto = Git Bash إن وُجد وإلا PowerShell", sel("shell", { auto: "تلقائي", bash: "Git Bash", powershell: "PowerShell", cmd: "cmd" })),
    row("أقصى طول للرد (رموز)", "ارفعه للملفات الطويلة", num("maxTokens", 1000, 128000, 1000)),
    row("أقصى خطوات في الدورة", null, num("maxSteps", 5, 400)),
    row("الخبير", "نموذج قويّ يضع خطة البناء ويتدخّل عند تعثّر النموذج المتاح. مدفوع من رصيد مفتاحك (سنتات قليلة لكل استشارة)", h("input", { type: "checkbox", class: "sw", checked: !!s.expert, onchange: (e) => save({ expert: e.target.checked }) })),
    row("نموذج الخبير", "أي معرّف من OpenRouter", h("input", { class: "field", dir: "ltr", value: s.expertModel || "anthropic/claude-opus-5.5", onchange: (e) => save({ expertModel: e.target.value.trim() }) })),
    row("إظهار كل النماذج", "المتاحة لمفتاحك فقط افتراضياً؛ فعّله لإظهار المدفوعة أيضاً", h("input", { type: "checkbox", class: "sw", checked: s.freeOnly === false, onchange: async (e) => { await save({ freeOnly: !e.target.checked }); S.models = await call("models:refresh") || S.models; renderControls(); } })),
    row("فتح الاستعراض تلقائياً", "عند تشغيل الوكيل خادماً محلياً", h("input", { type: "checkbox", class: "sw", checked: s.autoPreview !== false, onchange: (e) => save({ autoPreview: e.target.checked }) })),
    h("h4", null, "السياق والإنفاق"),
    row("ضغط السياق عند (%)", "يلخّص المحادثة القديمة تلقائياً", num("compactAt", 30, 95)),
    row("حدّ إنفاق الجلسة ($)", "0 = بلا حد", num("sessionBudget", 0, 1000, 0.5)),
    h("h4", null, "المظهر والتعليمات"),
    row("السِّمة", null, sel("theme", { dark: "داكنة", light: "فاتحة" })),
    row("موضع لوحة الاستعراض", "الجهة التي تُفتح فيها بجانب المحادثة", sel("panelSide", { right: "يمين المحادثة", left: "يسار المحادثة (المحادثة تنكمش لليمين)" })),
    row("بيانات التدريب", "المحادثات الناجحة بصيغة JSONL لتدريب نموذجك (علّم المحادثة «ناجحة» من قائمة ⋮)", h("button", { class: "btn", onclick: async () => { const r = await call("train:export"); if (r) toast(`صُدّر ${r.examples} محادثة للتدريب`); } }, "تصدير JSONL")),
    row("معالج الإعداد", "السِّمة، المفتاح، النموذج، الصلاحيات، المجلد", h("button", { class: "btn", onclick: () => { document.querySelector(".modal-wrap").remove(); setupWizard(); } }, "إعادة تشغيل الإعداد")),
    h("label", { class: "scol" }, h("b", null, "تعليمات دائمة للوكيل"), h("small", null, "تُضاف لكل جلسة. لتعليمات خاصة بمشروع ضع ملف AGENTS.md في جذره."),
      h("textarea", { class: "field", rows: 4, dir: "auto", placeholder: "مثال: استخدم TypeScript دائماً، واكتب التعليقات بالعربية.", onchange: (e) => save({ instructions: e.target.value }) }, s.instructions || ""))), "wide");
}

async function usageModal() {
  const body = h("div", { class: "usage" }, h("div", { class: "muted" }, "جارٍ التحميل…")); modal("الاستخدام", body, "wide");
  const u = await call("usage:get"); if (!u) return;
  const card = (t, x) => h("div", { class: "ucard" }, h("small", null, t), h("b", { dir: "ltr" }, fmtCost(x.cost)), h("span", { dir: "ltr" }, `${fmtTok(x.prompt)} in · ${fmtTok(x.completion)} out · ${x.requests} req`));
  const max = Math.max(...u.days.map((d) => d.cost), 1e-9), k = u.key || {};
  const table = (rows, first) => h("table", { class: "utable" }, h("thead", null, h("tr", null, [first, "التكلفة", "إدخال", "مخزّن", "إخراج", "طلبات"].map((x) => h("th", null, x)))),
    h("tbody", null, rows.length ? rows.map((r) => h("tr", null, h("td", { dir: "auto" }, r.label), ...[fmtCost(r.cost), fmtTok(r.prompt), fmtTok(r.cached), fmtTok(r.completion), r.requests].map((x) => h("td", { dir: "ltr" }, x)))) : h("tr", null, h("td", { colSpan: 6, class: "muted" }, "لا بيانات بعد"))));
  const v = cur(), quotaBox = h("div", { class: "uquota" }, h("small", { class: "muted" }, "جارٍ فحص حصص OmniRoute…")); drawQuota(quotaBox);
  body.replaceChildren(
    h("div", { class: "ucards" }, v ? card("هذه الجلسة", v.meta.usage) : null, card("اليوم", u.today), card("آخر 7 أيام", u.week), card("آخر 30 يوماً", u.month), card("الإجمالي", u.all)),
    h("div", { class: "ukey" }, icoEl("shield", 15), k.error ? "تعذّر فحص المفتاح: " + k.error : h("span", null, "المفتاح ", h("code", { dir: "ltr" }, k.label || ""), ` — المستهلَك على OpenRouter: ${fmtCost(k.usage || 0)}`, k.limit != null ? ` من ${fmtCost(k.limit)} (المتبقي ${fmtCost(k.limit_remaining || 0)})` : " · بلا حدّ إنفاق", k.free_model_daily_requests ? ` · طلبات اليوم: ${k.free_model_daily_requests.used}/${k.free_model_daily_requests.limit}` : "")),
    quotaBox,
    h("h4", null, "آخر 14 يوماً"), h("div", { class: "ubars" }, u.days.map((d) => h("div", { class: "ubar", title: `${d.day}: ${fmtCost(d.cost)} · ${d.requests} طلب` }, h("i", { style: `height:${Math.max(d.cost ? 4 : 0, (d.cost / max) * 100)}%` }), h("small", { dir: "ltr" }, d.day.slice(3))))),
    h("h4", null, "حسب النموذج"), table(u.byModel, "النموذج"), h("h4", null, "حسب الجلسة"), table(u.bySession, "الجلسة"));
}

const pctColor = (p) => (p == null ? "var(--muted)" : p < 15 ? "var(--danger, #e5484d)" : p < 40 ? "#f5a524" : "var(--accent)");
const fmtPct = (p) => (p == null ? "—" : p.toFixed(p < 10 ? 1 : 0) + "%");
async function drawQuota(box) {
  const q = await call("omni:quota"); if (!q) return;
  if (q.error) return box.replaceChildren(h("small", { class: "muted" }, "حصص OmniRoute: " + q.error));
  const bar = (p) => h("div", { class: "qbar" }, h("i", { style: `width:${p == null ? 0 : p}%;background:${pctColor(p)}` }));
  const cur = q.current;
  box.replaceChildren(
    h("h4", null, "المتبقي من الحصص (OmniRoute)"),
    h("div", { class: "qhead" },
      h("div", { class: "ucard" }, h("small", null, "المجموع المتبقي (متوسط كل المزودين)"), h("b", { dir: "ltr" }, fmtPct(q.overallPct)), bar(q.overallPct)),
      h("div", { class: "ucard" }, h("small", null, "المزوّد الحالي"), h("b", { dir: "ltr" }, cur ? cur.provider : "—"), h("span", { dir: "auto" }, cur ? `${cur.plan ? cur.plan + " · " : ""}${fmtPct(cur.remainingPct)} متبقٍ` : "لم يُستخدم بعد"))),
    ...(q.providers.length ? q.providers.map((p) => h("div", { class: "qprov" },
      h("div", { class: "qrow" }, h("b", { dir: "ltr" }, p.provider + (cur && p.id && p.id === cur.id ? " ●" : "")), h("span", { dir: "ltr" }, (p.plan ? p.plan + " · " : "") + fmtPct(p.remainingPct))), bar(p.remainingPct),
      ...p.quotas.map((x) => h("div", { class: "qrow sub", dir: "ltr" }, h("span", null, x.name), h("span", null, x.total != null && x.remaining != null ? `${Math.round(x.remaining).toLocaleString()} / ${Math.round(x.total).toLocaleString()}` : fmtPct(x.remainingPct), x.resetAt ? " · reset " + new Date(x.resetAt).toLocaleString() : ""))))) : [h("small", { class: "muted" }, "لا توجد بيانات حصص مخزّنة بعد — أرسل رسالة عبر OmniRoute ثم أعد المحاولة.")]));
}

/* ---------- OmniRoute quota chip + low-quota alert ---------- */

const Q = { data: null, warned: new Set() };
function quotaChip() {
  const d = Q.data; if (!d || d.error || !d.providers || !d.providers.length) return null;
  const cur = d.current, pct = cur && cur.remainingPct != null ? cur.remainingPct : d.overallPct;
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
function onUpdateState(st) {
  const prev = U.st.phase; U.st = st;
  const b = $("#btnUpdate"); if (b) { b.classList.toggle("has-update", st.phase === "available" || st.phase === "ready"); b.title = st.phase === "ready" ? "تم التحديث — أعد التشغيل" : st.phase === "available" ? "يتوفر تحديث جديد" : "التحديثات"; }
  U.listeners.forEach((fn) => fn(st));
  if (st.phase === "ready" && prev !== "ready") showUpdateBanner(st);
  else if (st.phase === "available" && prev !== "available" && !(S.settings && S.settings.autoUpdate !== false && st.mode === "git")) toast(`يتوفر تحديث جديد لـ Antillusion${st.behind ? ` (${st.behind} تغييرات)` : st.latest ? " " + st.latest : ""}`);
}
function showUpdateBanner(st) {
  document.querySelector(".upd-banner")?.remove();
  const bar = h("div", { class: "upd-banner" }, icoEl("refresh", 16), h("span", null, `تم تنزيل التحديث${st.latest ? " (" + st.latest + ")" : ""} — أعد تشغيل Antillusion لتطبيقه`),
    h("button", { class: "btn primary", onclick: () => call("update:restart") }, "إعادة التشغيل الآن"), h("button", { class: "ic-btn", title: "لاحقاً", onclick: () => bar.remove(), html: ico("x") }));
  document.body.append(bar);
}
async function updateModal() {
  const body = h("div", { class: "upd" });
  modal("تحديث Antillusion", body, "wide");
  const draw = (st) => {
    if (!body.isConnected) { U.listeners.delete(draw); return; }
    const busy = st.phase === "checking" || st.phase === "installing";
    const pill = { idle: ["لم يُفحص بعد", ""], checking: ["جارٍ الفحص…", "busy"], installing: ["جارٍ التحديث…", "busy"], uptodate: ["أنت على أحدث إصدار", "ok"], available: ["يتوفر تحديث", "new"], ready: ["جاهز — أعد التشغيل", "new"], error: ["تعذّر الفحص", "bad"] }[st.phase] || ["", ""];
    const ver = st.version ? "v" + st.version : "";
    const hero = h("div", { class: "upd-hero" },
      h("div", { class: "upd-logo" + (busy ? " spin" : ""), html: ico(st.phase === "ready" ? "check" : "refresh", 30) }),
      h("div", { class: "upd-meta" }, h("b", null, "Antillusion " + ver), h("span", { class: "upd-pill " + pill[1] }, pill[0]),
        h("small", { dir: "ltr" }, st.mode === "git" ? `${st.repo} · ${st.branch || ""} @ ${st.head || ""}${st.latest && st.available ? " → " + st.latest : ""}` : st.repo ? `${st.repo} · release${st.latest ? " " + st.latest : ""}` : ""),
        st.checkedAt ? h("small", null, "آخر فحص: " + new Date(st.checkedAt).toLocaleTimeString("ar")) : null),
      h("div", { class: "upd-actions" },
        st.phase === "ready" ? h("button", { class: "btn primary", onclick: () => call("update:restart") }, "إعادة التشغيل") :
        st.available && st.mode === "git" ? h("button", { class: "btn primary", disabled: busy || st.dirty || st.ahead > 0, onclick: () => call("update:install") }, busy ? "جارٍ التحديث…" : "حدّث الآن") :
        st.available && st.url ? h("button", { class: "btn primary", onclick: () => call("open:external", st.url) }, "تنزيل المثبّت") : null,
        h("button", { class: "btn", disabled: busy, onclick: () => call("update:check") }, busy ? "…" : "افحص الآن")));
    const parts = [hero];
    if (st.error) parts.push(h("div", { class: "upd-note bad" }, "⚠ " + st.error));
    if (st.dirty) parts.push(h("div", { class: "upd-note" }, "توجد تعديلات محلية غير محفوظة في ملفات المشروع، لذلك لن يُحدَّث تلقائياً حتى تحفظها أو تتراجع عنها."));
    if (st.ahead > 0) parts.push(h("div", { class: "upd-note" }, `نسختك المحلية متقدمة بـ ${st.ahead} commit عن GitHub — لن يُطبَّق تحديث تلقائي.`));
    if (st.note) parts.push(h("div", { class: "upd-note" }, st.note));
    const list = st.phase === "ready" ? st.applied : st.commits;
    if (list && list.length) parts.push(h("h4", null, st.phase === "ready" ? "ما الذي تغيّر" : `التغييرات الجديدة (${st.behind || list.length})`),
      h("div", { class: "upd-log" }, list.map((c) => h("div", { class: "upd-c" }, h("code", { dir: "ltr" }, c.sha), h("span", { dir: "auto" }, c.subject), h("small", null, `${c.author} · ${c.when}`)))));
    if (st.notes) parts.push(h("h4", null, "ملاحظات الإصدار"), h("pre", { class: "upd-notes", dir: "auto" }, st.notes));
    if (st.installed) parts.push(h("div", { class: "upd-note ok" }, "حُدِّثت الاعتماديات (npm install) تلقائياً."));
    const s = S.settings || {};
    parts.push(h("h4", null, "الإعدادات"),
      h("label", { class: "srow" }, h("div", null, h("b", null, "تحديث تلقائي"), h("small", null, "يفحص كل 3 ساعات وعند التشغيل، وينزّل التحديث عندما لا يكون الوكيل مشغولاً — ثم يطلب منك إعادة التشغيل")),
        h("input", { type: "checkbox", checked: s.autoUpdate !== false, onchange: async (e) => { const r = await call("settings:set", { autoUpdate: e.target.checked }); if (r) S.settings = r; } })),
      st.mode === "git" ? h("label", { class: "srow" }, h("div", null, h("b", null, "فرع التحديث"), h("small", null, "اتركه فارغاً لاستخدام الفرع الحالي")),
        h("input", { class: "field", dir: "ltr", value: s.updateBranch || "", placeholder: st.branch || "main", onchange: async (e) => { const r = await call("settings:set", { updateBranch: e.target.value.trim() }); if (r) { S.settings = r; call("update:check"); } } })) : null);
    body.replaceChildren(...parts.filter(Boolean));
  };
  U.listeners.add(draw); draw(U.st);
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
  const libClose = () => { const w = document.querySelector(".modal-wrap"); if (w) w.remove(); };
  draw(); showCard(lib.cards.find((c) => c.id === "scaffolds") || lib.cards[0]);
}

function historyModal() {
  const search = h("input", { class: "field", placeholder: "ابحث في كل المحادثات…", dir: "auto" }), listEl = h("div", { class: "hist" });
  const draw = () => { const q = search.value.trim().toLowerCase();
    const list = S.order.filter((m) => !q || m.title.toLowerCase().includes(q) || String(m.cwd).toLowerCase().includes(q)).sort((x, y) => y.updated - x.updated);
    listEl.replaceChildren(...(list.length ? list.map((m) => h("button", { class: "hist-row", onclick: () => { md.close(); openSession(m.id); } }, h("b", { dir: "auto" }, m.title),
      h("small", null, h("span", { dir: "ltr" }, shortPath(m.cwd)), ` · ${new Date(m.updated).toLocaleString("ar")} · ${fmtCost(m.usage.cost)}`))) : [h("div", { class: "side-empty" }, "لا نتائج")])); };
  search.addEventListener("input", draw);
  const md = modal("Conversation History", h("div", { class: "ask" }, search, listEl)); draw(); search.focus();
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
  $("#btnUsage").innerHTML = ico("chart"); $("#btnUpdate").innerHTML = ico("download"); $("#btnLibrary").innerHTML = ico("book"); $("#btnPanel").innerHTML = ico("panelR"); $("#btnAttach").innerHTML = ico("plus", 17);
  $("#btnSide").innerHTML = ico("panel"); $("#btnBack").innerHTML = ico("arrowL"); $("#btnFwd").innerHTML = ico("arrowR"); $("#btnNewProject").innerHTML = ico("folderPlus", 15);
  $("#btnNew").replaceChildren(icoEl("plus", 16), "New Conversation"); $("#btnHistory").replaceChildren(icoEl("history", 16), "Conversation History"); $("#btnTasks").replaceChildren(icoEl("clock", 16), "Scheduled Tasks"); $("#btnSettings").replaceChildren(icoEl("gear", 16), "Settings");
  $("#btnTheme").onclick = async () => { S.settings = await call("settings:set", { theme: S.settings.theme === "light" ? "dark" : "light" }) || S.settings; applyTheme(); };
  $("#btnHistory").onclick = historyModal; $("#btnTasks").onclick = tasksModal; $("#btnBack").onclick = () => navGo(-1); $("#btnFwd").onclick = () => navGo(1);
  $("#btnSide").onclick = () => { const c = document.body.classList.toggle("noside"); store.set("noside", c); }; document.body.classList.toggle("noside", store.get("noside", false));
  $("#btnNewProject").onclick = async () => { const v = await newSession(); if (v) pickFolder(); };
  $("#btnNew").onclick = () => newSession(); $("#btnUsage").onclick = usageModal; $("#btnUpdate").onclick = updateModal; $("#btnLibrary").onclick = libraryModal; $("#btnSettings").onclick = settingsModal; $("#btnPanel").onclick = () => setPanel(!P.open);
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

  inp.addEventListener("input", () => { autosize(); updateMention(); });
  inp.addEventListener("keydown", (e) => {
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
  call("update:state").then((st) => st && onUpdateState(st)); pollQuota(); setInterval(pollQuota, 60000);
})();
