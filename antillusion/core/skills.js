/* Antillusion — skills: named capabilities (motion video, story & cinema, game dev…) the agent can switch on.
   A skill is a markdown file with a small header:
     ---
     name: motion-video          (id)
     title: فيديو موشن جرافيك     (shown in the UI)
     icon: film
     command: video               (slash command: /video …)
     triggers: motion graphics, فيديو موشن, ...   (comma separated; Arabic is normalised)
     refs: motion-video, ui-design   (library playbooks loaded together with the skill)
     template: motion-video       (optional starter template)
     example: ...                 (optional example prompt shown in the UI)
     brief: ...                   (what the prompt expander should cover for this kind of request)
     ---
     <the workflow the agent must follow>
   Built-in skills live in /skills; yours in <userData>/skills and <project>/.antillusion/skills. */
"use strict";

const fs = require("fs");
const path = require("path");

const BUILTIN = path.join(__dirname, "..", "skills");
const cache = new Map();

const norm = (s) => String(s).toLowerCase().replace(/[ً-ْـ]/g, "").replace(/[أإآ]/g, "ا").replace(/ى/g, "ي").replace(/ة/g, "ه");
const words = (s) => norm(s).split(/[^a-z0-9+#.؀-ۿ]+/).map((w) => w.replace(/^(وال|بال|لل|ال)(?=.{3,})/, "")).filter((w) => w.length > 1);

function parse(text, file) {
  const m = String(text).match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!m) return null;
  const meta = {};
  for (const line of m[1].split(/\r?\n/)) { const k = line.match(/^([a-zA-Z_]+):\s*(.*)$/); if (k) meta[k[1].toLowerCase()] = k[2].trim(); }
  const name = (meta.name || path.basename(file).replace(/\.\w+$/, "")).toLowerCase();
  const csv = (v) => String(v || "").split(",").map((x) => x.trim()).filter(Boolean);
  return { name, title: meta.title || name, icon: meta.icon || "bolt", command: (meta.command || name).replace(/^\//, "").toLowerCase(), description: meta.description || "", example: meta.example || "",
    triggers: csv(meta.triggers), refs: csv(meta.refs), template: meta.template || "", brief: meta.brief || "", body: m[2].trim() };
}

function loadDir(dir, origin) {
  let names; try { names = fs.readdirSync(dir).filter((n) => /\.md$/i.test(n)); } catch { return []; }
  const stamp = names.map((n) => { try { return n + fs.statSync(path.join(dir, n)).mtimeMs; } catch { return n; } }).join("|");
  const hit = cache.get(dir); if (hit && hit.stamp === stamp) return hit.skills;
  const skills = [];
  for (const n of names) { try { const sk = parse(fs.readFileSync(path.join(dir, n), "utf8"), n); if (sk) skills.push({ ...sk, origin }); } catch {} }
  cache.set(dir, { stamp, skills }); return skills;
}

/** Built-in skills first; a skill with the same name in your folders replaces the built-in one. */
function loadAll(extraDirs = []) {
  const byName = new Map();
  for (const sk of loadDir(BUILTIN, "built-in")) byName.set(sk.name, sk);
  for (const d of extraDirs.filter(Boolean)) for (const sk of loadDir(d, "yours")) byName.set(sk.name, sk);
  return [...byName.values()];
}

const ORDER = ["motion-video", "story-cinematic", "game-dev", "character-design", "animation", "brand-identity", "project-builder", "ui-design", "spec", "review", "fix"];
const rank = (n) => { const i = ORDER.indexOf(n); return i < 0 ? 99 : i; };
const list = (extraDirs) => loadAll(extraDirs).sort((a, b) => rank(a.name) - rank(b.name) || a.name.localeCompare(b.name)).map(({ body, ...rest }) => ({ ...rest, size: body.length }));
const get = (name, extraDirs) => loadAll(extraDirs).find((s) => s.name === String(name).toLowerCase()) || null;
const bySlash = (cmd, extraDirs) => loadAll(extraDirs).find((s) => s.command === String(cmd).replace(/^\//, "").toLowerCase()) || null;

/** "/video make an intro" -> { skill, rest: "make an intro" }; null when the text is not a skill command. */
function parseSlash(text, extraDirs) {
  const m = String(text || "").match(/^\/([a-zA-Z][\w-]*)(?:\s+([\s\S]*))?$/);
  if (!m) return null;
  const skill = bySlash(m[1], extraDirs);
  return skill ? { skill, rest: (m[2] || "").trim() } : null;
}

/** Best skill for free text, or null. A trigger counts when all its words occur in the text. Phrases (2+ words) and triggers marked
    with a leading "!" are strong enough alone; two or more weak single words together also qualify (so "add error handling" stays a normal request). */
function match(text, extraDirs, minScore = 8) {
  const qs = new Set(words(text)); if (!qs.size) return null;
  const has = (w) => qs.has(w) || [...qs].some((q) => q.length > 3 && w.length > 3 && (q.startsWith(w) || w.startsWith(q)));
  let best = null;
  for (const sk of loadAll(extraDirs)) {
    let score = 0;
    for (const raw of sk.triggers) { const strong = raw.startsWith("!"), tw = words(raw.replace(/^!/, "")); if (tw.length && tw.every(has)) score += strong ? 9 : 4 + tw.length * 2; }
    if (score >= minScore && (!best || score > best.score)) best = { skill: sk, score };
  }
  return best ? best.skill : null;
}

module.exports = { list, get, bySlash, parseSlash, match, parse, BUILTIN };
