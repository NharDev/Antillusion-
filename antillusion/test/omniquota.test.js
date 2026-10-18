"use strict";
const assert = require("assert");
const { normalize } = require("../core/omniquota");
const r = normalize({ allowed: true,
  provider: { connectionId: "a", provider: "kimi", plan: "pro", quotas: { daily: { used: 20, total: 100 }, weekly: { remainingPercentage: 80 } } },
  providers: [{ connectionId: "a", provider: "kimi", plan: "pro", quotas: { daily: { used: 20, total: 100 } } }, { connectionId: "b", provider: "openrouter", quotas: [{ name: "req", remaining: 25, total: 50 }] }] });
assert.strictEqual(r.providers.length, 2); assert.strictEqual(r.current.provider, "kimi"); assert.strictEqual(r.current.remainingPct, 80);
assert.strictEqual(r.providers[1].remainingPct, 50); assert.strictEqual(Math.round(r.overallPct), 65);
assert.throws(() => normalize({ allowed: false, error: { message: "bad key" } }), /bad key/);
console.log("PASS omniquota");
