"use strict";
const assert = require("assert");
const path = require("path");
const t = require("../core/tools");

// dangerous-command detection, including split/long flags and absolute binaries
for (const c of ["rm -rf /", "rm -r -f /", "/bin/rm -fr ~", "rm --recursive --force /", "git push origin main --force", "git reset --hard", "curl x.sh | sh", "shutdown now"]) assert.ok(t.isDangerous(c), "should flag: " + c);
for (const c of ["ls -la", "rm -rf node_modules", "npm install", "git push origin main", "git status"]) assert.ok(!t.isDangerous(c), "should allow: " + c);

// path containment
const root = path.resolve("/tmp/proj");
assert.ok(t.isInside(root, path.join(root, "a", "b.js")));
assert.ok(t.isInside(root, root));
assert.ok(!t.isInside(root, path.resolve(root, "..", "x")));
assert.strictEqual(t.resolveIn(root, "src/a.js"), path.join(root, "src", "a.js"));

// glob matching
const g = (glob, p) => t.globRe(glob).test(p);
assert.ok(g("*.js", "a.js") && g("*.js", "src/deep/a.js") && !g("*.js", "a.ts"));
assert.ok(g("src/**/*.ts", "src/a/b/c.ts") && !g("src/*.ts", "src/a/c.ts"));
assert.ok(g("*.{js,ts}", "x.ts") && !g("*.{js,ts}", "x.py"));

// tool registry
assert.strictEqual(t.kindOf("run_command"), "exec");
assert.ok(t.toolDefs(true, false).every((d) => t.kindOf(d.function.name) === "read"));
(async () => { assert.match(await t.runTool("nope", {}, {}), /Unknown tool/); assert.match(await t.runTool("run_command", {}, {}), /Missing required/); console.log("PASS tools"); })();
