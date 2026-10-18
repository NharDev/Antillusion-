/* Antillusion — the built-in engineering library: playbooks (library/*.md) + package catalogue (library/catalog.txt).
   Extra folders (the user's own library, a project's .antillusion/library) are merged in at search time. */
"use strict";

const fs = require("fs");
const path = require("path");

const BUILTIN = path.join(__dirname, "..", "library");
const cache = new Map();   // dir -> { stamp, cards, catalog }

function loadDir(dir, origin) {
  let names; try { names = fs.readdirSync(dir); } catch { return { cards: [], catalog: [] }; }
  const stamp = names.map((n) => { try { return n + fs.statSync(path.join(dir, n)).mtimeMs; } catch { return n; } }).join("|");
  const hit = cache.get(dir); if (hit && hit.stamp === stamp) return hit;
  const cards = [], catalog = [];
  for (const n of names) {
    const fp = path.join(dir, n);
    if (/\.(md|txt)$/i.test(n) && n !== "catalog.txt") {
      const text = fs.readFileSync(fp, "utf8");
      const title = (text.match(/^#\s+(.+)$/m) || [, n.replace(/\.\w+$/, "")])[1].trim();
      const tags = (text.match(/^tags:\s*(.+)$/im) || [, ""])[1].toLowerCase();
      cards.push({ id: n.replace(/\.\w+$/, "").toLowerCase(), title, tags, text, origin });
    } else if (n === "catalog.txt") {
      for (const line of fs.readFileSync(fp, "utf8").split(/\r?\n/)) if (line.trim() && !line.startsWith("#")) catalog.push(line.trim());
    }
  }
  const v = { stamp, cards, catalog }; cache.set(dir, v); return v;
}

function loadAll(extraDirs = []) {
  const cards = [], catalog = [];
  const dirs = [[BUILTIN, "built-in"], ...extraDirs.filter(Boolean).map((d) => [d, "yours"])];
  for (const [d, origin] of dirs) { const v = loadDir(d, origin); cards.push(...v.cards); catalog.push(...v.catalog); }
  return { cards, catalog };
}

// Arabic is normalised (alef/ya/ta-marbuta forms, the "al-" article) so "اللعبة" matches a card tagged "لعبه"
const norm = (s) => String(s).toLowerCase().replace(/[\u064b-\u0652\u0640]/g, "").replace(/[أإآ]/g, "ا").replace(/ى/g, "ي").replace(/ة/g, "ه");
const words = (s) => norm(s).split(/[^a-z0-9+#.\u0600-\u06ff]+/).map((w) => w.replace(/^(وال|بال|لل|ال)(?=.{3,})/, "")).filter((w) => w.length > 1);

const TEMPLATES = path.join(__dirname, "..", "templates");
function templates() { try { return JSON.parse(fs.readFileSync(path.join(TEMPLATES, "index.json"), "utf8")); } catch { return []; } }

/** Best-matching playbooks and starter template for a user request — injected up front so the model need not search. */
function autoRefs(query, extraDirs, maxChars = 9000) {
  const { cards } = loadAll(extraDirs), qs = [...new Set(words(query))];
  if (!qs.length) return { cards: [], template: null };
  const score = (tags, title, id) => { const tg = words(tags), ti = words(title + " " + id); let sc = 0; for (const w of qs) { if (tg.includes(w) || (w.length > 4 && tg.includes(w.slice(1)))) sc += 5;   /* one-letter Arabic prefixes: لمطعم، بمتجر */ else if (ti.includes(w)) sc += 4; } return sc; };
  const picked = [], ranked = cards.map((c) => [score(c.tags, c.title, c.id), c]).filter((x) => x[0] >= 5).sort((a, b) => b[0] - a[0]);
  let used = 0;
  for (const [, c] of ranked) { if (picked.length >= 2 || used + c.text.length > maxChars) continue; picked.push(c); used += c.text.length; }
  const strongHit = (t) => words(t.strong || "").some((w) => qs.includes(w));
  const tpl = templates().map((t) => [score(t.tags, t.title, t.name) + (strongHit(t) ? 100 : 0), t]).filter((x) => x[0] >= 10).sort((a, b) => b[0] - a[0])[0];
  return { cards: picked, template: tpl ? tpl[1] : null };
}

function search(query, extraDirs) {
  const { cards, catalog } = loadAll(extraDirs), qs = words(query);
  if (!qs.length) return "Give some keywords.";
  const scored = cards.map((c) => {
    const body = norm(c.text); let sc = 0;
    for (const w of qs) { if (c.id.includes(w)) sc += 8; if (norm(c.title).includes(w)) sc += 6; if (norm(c.tags).includes(w)) sc += 5; const n = body.split(w).length - 1; sc += Math.min(n, 6); }
    return [sc, c];
  }).filter((x) => x[0] > 0).sort((a, b) => b[0] - a[0]).slice(0, 5);
  const lines = catalog.map((l) => { const low = l.toLowerCase(); let sc = 0; for (const w of qs) if (low.includes(w)) sc += low.split("|")[1] && low.split("|")[1].includes(w) ? 3 : 1; return [sc, l]; })
    .filter((x) => x[0] > 0).sort((a, b) => b[0] - a[0]).slice(0, 14);
  let out = "";
  if (scored.length) out += "## Playbooks (read one in full with library_read)\n" + scored.map(([, c]) => {
    const para = c.text.split(/\n{2,}/).find((p) => qs.some((w) => p.toLowerCase().includes(w)) && !p.startsWith("# ")) || "";
    return `- ${c.id} — ${c.title}${c.origin === "yours" ? " (your library)" : ""}\n    ${para.replace(/\s+/g, " ").slice(0, 260)}`;
  }).join("\n");
  if (lines.length) out += (out ? "\n\n" : "") + "## Package catalogue (ecosystem | area | proven choices)\n" + lines.map(([, l]) => "- " + l).join("\n") + "\nGet the current version and API of any of these with pkg_info.";
  return out || `Nothing in the library for "${query}". Try sources_search for live results.`;
}

function read(id, extraDirs) {
  const { cards } = loadAll(extraDirs), key = String(id || "").toLowerCase().replace(/\.md$/, "");
  const c = cards.find((x) => x.id === key) || cards.find((x) => x.id.includes(key) || x.title.toLowerCase().includes(key));
  return c ? c.text : `No playbook "${id}". Available: ${cards.map((x) => x.id).join(", ")}`;
}

const list = (extraDirs) => { const { cards, catalog } = loadAll(extraDirs); return { cards: cards.map(({ id, title, tags, origin, text }) => ({ id, title, tags, origin, size: text.length })), catalog }; };
const index = (extraDirs) => loadAll(extraDirs).cards.map((c) => `${c.id} (${c.title})`).join(" · ");

module.exports = { search, read, list, index, autoRefs, templates, TEMPLATES, BUILTIN };
