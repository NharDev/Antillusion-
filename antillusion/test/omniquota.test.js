"use strict";
const assert = require("assert");
const { normalize } = require("../core/omniquota");
const r = normalize({ allowed: true,
  provider: { connectionId: "a", provider: "kimi", plan: "pro", quotas: { daily: { used: 20, total: 100 }, weekly: { remainingPercentage: 80 } } },
  providers: [{ connectionId: "a", provider: "kimi", plan: "pro", quotas: { daily: { used: 20, total: 100 } } }, { connectionId: "b", provider: "openrouter", quotas: [{ name: "req", remaining: 25, total: 50 }] }] });
assert.strictEqual(r.providers.length, 2); assert.strictEqual(r.current.provider, "kimi"); assert.strictEqual(r.current.remainingPct, 80);
assert.strictEqual(r.providers[1].remainingPct, 50); assert.strictEqual(Math.round(r.overallPct), 65);
assert.throws(() => normalize({ allowed: false, error: { message: "bad key" } }), /bad key/);
// the shape a real OmniRoute reports for a zero-balance Kimi account next to a free OpenRouter tier
const real = normalize({ allowed: true,
  provider: { connectionId: "m", provider: "moonshot", plan: "Kimi Open Platform", quotas: { available: { used: 0, total: 0, remaining: 0, remainingPercentage: 0 }, voucher: { used: 0, total: 0, remaining: 0, remainingPercentage: 0 }, cash: { used: 0, total: 0, remaining: 0, remainingPercentage: 0 } } },
  providers: [{ connectionId: "m", provider: "moonshot", plan: "Kimi Open Platform", quotas: { available: { used: 0, total: 0, remaining: 0, remainingPercentage: 0 } } },
    { connectionId: "o", provider: "openrouter", plan: "OpenRouter (Free Tier)", quotas: { free_daily: { used: 0, total: 50, remaining: 50, remainingPercentage: 100, resetAt: "2026-10-19T00:00:00Z" }, free_rpm: { used: 0, total: 20, remaining: 20 }, credits: { used: 0, total: 0, remaining: 0, remainingPercentage: 0 } } }] });
assert.strictEqual(real.providers[0].remainingPct, null, "a zero allowance is unknown, not 0%");
assert.strictEqual(real.providers[1].remainingPct, 100); assert.strictEqual(real.overallPct, 100, "overall ignores providers without a known allowance"); assert.strictEqual(real.known, 1);
assert.strictEqual(real.providers[1].quotas[0].kind, "window"); assert.strictEqual(real.providers[1].quotas[2].kind, "balance");
console.log("PASS omniquota");
