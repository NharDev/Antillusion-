/* Antillusion — reads the remaining quota per provider from OmniRoute (GET /api/usage/om-usage?format=json).
   The quota payload is normalised defensively because OmniRoute versions differ in field names. */
"use strict";

const num = (...v) => { for (const x of v) { const n = typeof x === "string" ? parseFloat(x) : x; if (typeof n === "number" && isFinite(n)) return n; } return null; };
const clampPct = (p) => (p == null ? null : Math.max(0, Math.min(100, p)));

function normQuota(name, q) {
  if (q == null || typeof q !== "object") { const n = num(q); return n == null ? null : { name, remainingPct: clampPct(n), used: null, total: null, remaining: null, resetAt: null }; }
  const total = num(q.total, q.limit, q.quotaTotal, q.max);
  let used = num(q.used, q.quotaUsed, q.consumed);
  let remaining = num(q.remaining, q.left, q.quotaRemaining);
  if (remaining == null && total != null && used != null) remaining = Math.max(0, total - used);
  if (used == null && total != null && remaining != null) used = Math.max(0, total - remaining);
  let pct = num(q.remainingPercentage, q.remainingPercent, q.percentRemaining, q.remaining_percentage);
  if (pct == null) { const usedPct = num(q.usedPercentage, q.usedPercent, q.percentUsed, q.used_percentage); if (usedPct != null) pct = 100 - usedPct; }
  if (pct == null && total && remaining != null) pct = (remaining / total) * 100;
  return { name: String(q.name || q.label || name), remainingPct: clampPct(pct), used, total, remaining, resetAt: q.resetAt || q.resetsAt || q.nextResetAt || q.reset_at || null };
}

function normProvider(p) {
  if (!p || typeof p !== "object") return null;
  let raw = p.quotas || p.limits || p.windows; const list = [];
  if (raw && !Array.isArray(raw) && typeof raw === "object" && (raw.windows || raw.items || raw.quotas)) raw = raw.windows || raw.items || raw.quotas;
  if (Array.isArray(raw)) raw.forEach((q, i) => list.push(normQuota("quota " + (i + 1), q)));
  else if (raw && typeof raw === "object") Object.entries(raw).forEach(([k, q]) => list.push(normQuota(k, q)));
  const quotas = list.filter(Boolean), pcts = quotas.map((q) => q.remainingPct).filter((x) => x != null);
  return { id: p.connectionId || null, provider: String(p.provider || p.name || "?"), plan: p.plan || null, quotas,
    remainingPct: pcts.length ? Math.min(...pcts) : null };   // the tightest window decides how much is really left on this provider
}

/** Turns the om-usage JSON into { providers, current, overallPct, personal }. */
function normalize(j) {
  if (!j || j.allowed === false) throw new Error((j && j.error && j.error.message) || "OmniRoute رفض الطلب");
  const providers = (Array.isArray(j.providers) ? j.providers : []).map(normProvider).filter(Boolean);
  const current = normProvider(j.provider) || null;
  if (current && !providers.some((p) => p.id && p.id === current.id)) providers.unshift(current);
  const pcts = providers.map((p) => p.remainingPct).filter((x) => x != null);
  return { providers, current, personal: j.personal || null, raw: j,
    overallPct: pcts.length ? pcts.reduce((a, b) => a + b, 0) / pcts.length : null };
}

async function fetchQuota(baseUrl, key) {
  const root = String(baseUrl).replace(/\/+$/, "").replace(/\/v1$/, "");
  const res = await fetch(root + "/api/usage/om-usage?format=json", { headers: key ? { Authorization: "Bearer " + key } : {}, signal: AbortSignal.timeout(8000) });
  let j; try { j = await res.json(); } catch { throw new Error("ردّ غير مفهوم من OmniRoute (HTTP " + res.status + ")"); }
  if (!res.ok && !(j && j.allowed === false)) throw new Error("HTTP " + res.status);
  return normalize(j);
}

module.exports = { normalize, fetchQuota };
