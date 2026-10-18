/* Antillusion smart router: learns which model to use for which job from what actually happened — success rate, latency,
   valid tool calls, replies cut at the length limit — on top of what a model's name says it is good at, and the scout's
   "answers right now" list. Ranks models per role: "code" (writing/fixing code), "reason" (planning, leading a team),
   "fast" (small chores), "vision" (screenshots).   node test/router.test.js */
"use strict";
const fs = require("fs"), path = require("path");

const AUTO = "antillusion/auto";
const SKIP = /embed|whisper|tts|speech|audio|transcri|image-gen|dall-?e|flux|stable-?diff|sdxl|imagen|video|veo|sora|music|rerank|moderation|guard/i;
// what a name tells us before any evidence (0..1 per role)
function prior(id, role) {
  const s = String(id).toLowerCase(); let v = 0.35;
  const top = /claude-(opus|sonnet)|gpt-?5|o[34]-|gemini-(2\.5|3)-pro|grok-?4/, strong = /deepseek-(v3|v4|r1|chat|coder)|qwen-?3|qwen.*coder|glm-?(4\.[5-9]|5)|kimi-k2|minimax-m|devstral|codestral|mistral-(large|medium)|llama-?4|gpt-?4\.1|gpt-?4o(?!-mini)|nemotron-(super|ultra)/;
  const small = /(^|[-_/:.])(mini|nano|tiny|small|lite|1b|3b|7b|8b|0\.5b|1\.5b)([-_/:.]|$)/;
  if (top.test(s)) v = 0.9; else if (strong.test(s)) v = 0.72;
  if (/^auto\//.test(s)) v = 0.6;   // router combos: decent, but only as good as the providers behind them
  if (role === "code" && /coder|code|devstral|codestral/.test(s)) v += 0.1;
  if (role === "reason" && /reason|think|r1\b|opus|pro|o[34]-/.test(s)) v += 0.1;
  if (role === "fast" && (small.test(s) || /flash|fast|haiku|turbo|instant/.test(s))) v += 0.25;
  if (role !== "fast" && small.test(s)) v -= 0.25;
  if (role === "vision" && !/vision|vl\b|-vl|gpt-?4o|gpt-?5|claude|gemini|pixtral|llava|qwen.*vl/.test(s)) v -= 0.5;
  return Math.max(0, Math.min(1, v));
}

function createRouter({ dir } = {}) {
  const file = dir ? path.join(dir, "router.json") : null;
  let stats = {}; try { if (file) stats = JSON.parse(fs.readFileSync(file, "utf8")); } catch {}
  let dirty = false, timer = null;
  const save = () => { if (!file) return; dirty = true; clearTimeout(timer); timer = setTimeout(() => { if (!dirty) return; dirty = false; try { fs.writeFileSync(file, JSON.stringify(stats)); } catch {} }, 1500); };

  /** One outcome: { ok, ms, toolsOk, cut, kind } (kind = failure class from the agent). */
  function record(model, o) {
    if (!model || model === AUTO) return;
    const s = stats[model] || (stats[model] = { ok: 0, fail: 0, ms: 0, cut: 0, badTools: 0, recent: [] });
    if (o.ok) { s.ok++; s.ms = s.ms ? s.ms * 0.7 + o.ms * 0.3 : o.ms; s.lastOk = Date.now(); } else { s.fail++; s.lastFail = Date.now(); s.lastKind = o.kind || ""; }
    if (o.cut) s.cut++; if (o.toolsOk === false) s.badTools++;
    s.recent = [...s.recent, o.ok ? 1 : 0].slice(-12);
    save();
  }
  /** 0..1: how much to trust this model for this role right now. */
  function score(model, role = "code", opt = {}) {
    const s = stats[model], p = prior(model, role);
    if (!s) return p * (opt.scouted && opt.scouted.has(model) ? 1.15 : 1);
    const n = s.ok + s.fail, rate = (s.ok + 1) / (n + 2);
    const recent = s.recent.length ? s.recent.reduce((a, b) => a + b, 0) / s.recent.length : rate;
    const fresh = s.lastFail && Date.now() - s.lastFail < 10 * 60e3 && (!s.lastOk || s.lastFail > s.lastOk) ? 0.35 : 1;   // failed a moment ago
    const speed = s.ms ? (role === "fast" ? 1 / (1 + s.ms / 8000) : 1 / (1 + s.ms / 40000)) : 0.8;
    const quality = 1 - Math.min(0.4, (s.cut + s.badTools) / Math.max(4, s.ok));
    const evidence = Math.min(1, n / 6);
    const v = (p * (1 - evidence) + (0.55 * recent + 0.45 * rate) * evidence) * fresh * (0.7 + 0.3 * speed) * quality;
    return v * (opt.scouted && opt.scouted.has(model) ? 1.15 : 1);
  }
  /** Models best-first for a role. models: [{id}] or ids; exclude: ids to skip; isBad: id => bool. */
  function rank(models, role = "code", { exclude = [], isBad = () => false, scouted = new Set(), limit = 8 } = {}) {
    const ids = [...new Set(models.map((m) => (typeof m === "string" ? m : m.id)))].filter((id) => id && id !== AUTO && !SKIP.test(id) && !exclude.includes(id) && !isBad(id));
    return ids.map((id) => [score(id, role, { scouted }), id]).sort((a, b) => b[0] - a[0]).slice(0, limit).map((x) => x[1]);
  }
  const report = () => JSON.parse(JSON.stringify(stats));
  const reset = () => { stats = {}; save(); };
  return { record, score, rank, report, reset, prior };
}

module.exports = { createRouter, prior, AUTO };
