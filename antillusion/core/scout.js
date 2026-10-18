/* Model scout: when a router's combos keep failing (empty wallets, expired cookies, rate limits), find the models that
   actually answer right now by sending each candidate a tiny request through the normal /chat/completions endpoint
   (with one small tool, because the agent needs tool calling). Also turns a router's aggregated error into a per-provider
   diagnosis with the fix for each. No dependencies.   node test/scout.test.js */
"use strict";

const SKIP = /embed|whisper|tts|speech|audio|transcri|image|dall-?e|flux|stable-?diff|sdxl|imagen|video|veo|sora|music|rerank|moderation|guard|ocr|search|realtime|vision-only/i;
const GOOD = /claude|gpt-?5|gpt-?4\.1|gpt-?4o|o[34]-|deepseek|qwen|glm|kimi|gemini|llama-?3\.[13]|llama-?4|mistral-(large|medium)|codestral|grok|minimax|step-|nemotron|command-a/i;
const CODE = /coder|code|devstral|codestral/i;
const SMALL = /(^|[-_/:.])(mini|nano|tiny|small|lite|1b|3b|7b|8b|0\.5b|1\.5b)([-_/:.]|$)/i;
const providerOf = (id) => (String(id).includes("/") ? String(id).split("/")[0] : "other");

/** Up to `max` candidates, at most `perProvider` per provider, best-looking first, spread across providers. */
function candidates(models, { max = 30, perProvider = 2, exclude = [] } = {}) {
  const by = new Map();
  for (const m of models) {
    const id = typeof m === "string" ? m : m.id;
    if (!id || /^auto\//i.test(id) || SKIP.test(id) || exclude.includes(id)) continue;
    const p = providerOf(id), score = (GOOD.test(id) ? 5 : 0) + (CODE.test(id) ? 3 : 0) - (SMALL.test(id) ? 3 : 0) - (/:free$|-free$/i.test(id) ? 0 : 0);
    if (!by.has(p)) by.set(p, []);
    by.get(p).push({ id, provider: p, score });
  }
  const lists = [...by.values()].map((l) => l.sort((a, b) => b.score - a.score).slice(0, perProvider)).sort((a, b) => b[0].score - a[0].score);
  const out = [];
  for (let i = 0; out.length < max && lists.some((l) => l[i]); i++) for (const l of lists) if (l[i] && out.length < max) out.push(l[i]);
  return out;
}

const TOOL = [{ type: "function", function: { name: "noop", description: "Does nothing.", parameters: { type: "object", properties: {} } } }];

async function probe({ baseUrl, key, model, fetchImpl = fetch, timeoutMs = 25000, signal }) {
  const t0 = Date.now(), ac = new AbortController(), timer = setTimeout(() => ac.abort(), timeoutMs);
  const onAbort = () => ac.abort(); if (signal) signal.addEventListener("abort", onAbort, { once: true });
  try {
    const r = await fetchImpl(baseUrl.replace(/\/+$/, "") + "/chat/completions", {
      method: "POST", signal: ac.signal, headers: { "Content-Type": "application/json", ...(key ? { Authorization: "Bearer " + key } : {}) },
      body: JSON.stringify({ model, messages: [{ role: "user", content: "Reply with the single word: ok" }], max_tokens: 16, stream: false, tools: TOOL }),
    });
    const text = await r.text(); let j = null; try { j = JSON.parse(text); } catch {}
    const msg = j && j.choices && j.choices[0] && j.choices[0].message;
    if (r.ok && msg && (msg.content || msg.tool_calls || msg.reasoning || msg.reasoning_content)) return { id: model, ok: true, ms: Date.now() - t0 };
    return { id: model, ok: false, code: r.status, reason: reasonOf(r.status, (j && j.error && (j.error.message || j.error)) || text) };
  } catch (e) { return { id: model, ok: false, code: 0, reason: signal && signal.aborted ? "أُلغي" : "لا استجابة خلال " + Math.round(timeoutMs / 1000) + " ث" }; }
  finally { clearTimeout(timer); if (signal) signal.removeEventListener("abort", onAbort); }
}

/** Probes the candidates with limited concurrency. onProgress({ done, total, ok }) after each answer. Stops early when `enough` work. */
async function scout({ baseUrl, key, models, fetchImpl = fetch, max = 30, concurrency = 6, timeoutMs = 25000, enough = 5, onProgress, signal, exclude } = {}) {
  const list = candidates(models, { max, exclude }), ok = [], bad = [];
  let next = 0, done = 0;
  const worker = async () => {
    while (next < list.length && ok.length < enough && !(signal && signal.aborted)) {
      const c = list[next++], r = await probe({ baseUrl, key, model: c.id, fetchImpl, timeoutMs, signal });
      (r.ok ? ok : bad).push({ ...r, provider: c.provider }); done++;
      if (onProgress) try { onProgress({ done, total: list.length, ok: ok.length, last: r }); } catch {}
    }
  };
  await Promise.all(Array.from({ length: Math.min(concurrency, list.length) }, worker));
  ok.sort((a, b) => a.ms - b.ms);
  return { at: Date.now(), ok, bad, tried: done, total: list.length };
}

/* ---------- diagnosis: what is wrong with each provider and what to do about it ---------- */
function reasonOf(code, msg) {
  const m = String(msg || "").toLowerCase();
  if (/cookie|expired|re-?login|session/.test(m) && (code === 401 || code === 403 || /401|403/.test(m))) return "انتهت صلاحية الجلسة/الكوكيز";
  if (code === 413 || /too large|reduce your message|context length|maximum context|tokens per minute|\btpm\b/.test(m)) return "الطلب أكبر من حدّ الطبقة المجانية";
  if (code === 402 || /insufficient|balance|credit|recharge|billing|payment|quota exceeded|suspended/.test(m)) return "الرصيد نفد أو الحساب معلّق";
  if (code === 401 || code === 403 || /api key|unauthori|forbidden|invalid key|requires .*key/.test(m)) return "مفتاح أو صلاحية مفقودة";
  if (code === 429 || /rate limit|too many|cooling/.test(m)) return "حدّ طلبات مؤقت";
  if (code === 404 || code === 400 && /unknown model|not found|does not exist|no such model/.test(m)) return "النموذج غير موجود لدى المزوّد";
  if (code === 405) return "الطريقة غير مدعومة لدى المزوّد";
  if (/stream ended|non-ping sse|empty/.test(m)) return "انقطع البث قبل أي ردّ";
  if (code >= 500 || /unavailable|bad gateway|timeout/.test(m)) return "عطل مؤقت عند المزوّد";
  if (code === 400) return "رفض الطلب (400)";
  return code ? "خطأ " + code : "خطأ غير معروف";
}
const FIX = {
  "انتهت صلاحية الجلسة/الكوكيز": "أعد ربط الحساب أو حدّث الكوكيز من صفحة المزوّد في OmniRoute",
  "الرصيد نفد أو الحساب معلّق": "اشحن الرصيد أو عطّل هذا المزوّد من OmniRoute حتى لا يُجرَّب",
  "مفتاح أو صلاحية مفقودة": "أضف مفتاح API صالحاً للمزوّد في OmniRoute",
  "الطلب أكبر من حدّ الطبقة المجانية": "حدّ الطبقة المجانية صغير جداً لوكيل برمجة — استخدم مزوّداً آخر لهذا العمل",
  "حدّ طلبات مؤقت": "مؤقت — يعود خلال دقائق",
  "النموذج غير موجود لدى المزوّد": "حدّث قائمة نماذج المزوّد أو أزله من الكومبو (Sync models)",
  "انقطع البث قبل أي ردّ": "عطل لدى المزوّد — جرّب لاحقاً أو أزله من الكومبو",
  "عطل مؤقت عند المزوّد": "مؤقت عادةً — جرّب لاحقاً",
};
/** Parses OmniRoute's aggregated "bad_gateway: prov/model: kind — [code]: message; …" into one entry per provider. */
function diagnose(raw) {
  const text = String(raw || ""), out = new Map(), more = +((text.match(/\(\+(\d+) more\)/) || [])[1] || 0);
  const body = text.replace(/^[\s\S]*?bad_gateway:\s*/i, "").replace(/\)?\s*(\.\.\.)?\s*\(\+\d+ more\)\)?\s*$/, "");
  for (const part of body.split(/;\s*(?=[a-z0-9][\w.-]*\/)/i)) {
    const m = part.match(/^\s*([a-z0-9][\w.-]*)\/(\S+?):\s*[\w ]+?\s+[—-]\s+(?:\[(\d{3})\]:\s*)?([\s\S]*)$/i); if (!m) continue;
    const code = +(m[3] || (m[4].match(/\(HTTP (\d{3})\)/) || [])[1] || 0), reason = reasonOf(code, m[4]);
    const e = out.get(m[1]) || { provider: m[1], models: [], reason, code, fix: FIX[reason] || "" };
    if (!e.models.includes(m[2])) e.models.push(m[2]);
    out.set(m[1], e);
  }
  return { providers: [...out.values()], more };
}

module.exports = { scout, probe, candidates, diagnose, reasonOf, providerOf, FIX };
