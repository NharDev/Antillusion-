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
const fs = require("fs"), os = require("os");
(async () => {
  // multi_edit: atomic, ordered, CRLF-safe; read_many: several files in one call
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "tools-")), changes = [], ctx = { cwd: dir, changed: (c) => changes.push(c) };
  fs.writeFileSync(path.join(dir, "a.txt"), "one\r\ntwo\r\nthree\r\n"); fs.writeFileSync(path.join(dir, "b.txt"), "bee\n");
  const ok = await t.runTool("multi_edit", { path: "a.txt", edits: [{ old_string: "one", new_string: "1" }, { old_string: "1\ntwo", new_string: "1\n2" }, { old_string: "three", new_string: "3" }] }, ctx);
  assert.match(ok, /Applied 3 edits/); assert.strictEqual(fs.readFileSync(path.join(dir, "a.txt"), "utf8"), "1\r\n2\r\n3\r\n"); assert.strictEqual(changes.length, 1);
  const bad = await t.runTool("multi_edit", { path: "a.txt", edits: [{ old_string: "1", new_string: "X" }, { old_string: "missing", new_string: "Y" }] }, ctx);
  assert.match(bad, /Edit 2\/2 failed/); assert.strictEqual(fs.readFileSync(path.join(dir, "a.txt"), "utf8"), "1\r\n2\r\n3\r\n", "nothing is written when any edit fails");
  assert.match(await t.runTool("multi_edit", { path: "a.txt", edits: [{ old_string: "2", new_string: "two" }, { old_string: "r", new_string: "" }] }, ctx), /failed/);
  const many = await t.runTool("read_many", { files: [{ path: "a.txt" }, { path: "b.txt", limit: 1 }, { path: "nope.txt" }] }, ctx);
  assert.match(many, /===== a.txt =====[\s\S]*===== b.txt =====[\s\S]*bee[\s\S]*===== nope.txt =====/);
  assert.ok(t.toolDefs(true, false).some((d) => d.function.name === "read_many") && !t.toolDefs(true, false).some((d) => d.function.name === "multi_edit"), "read-only modes get read_many but not multi_edit");
  assert.match(await t.runTool("nope", {}, {}), /Unknown tool/); assert.match(await t.runTool("run_command", {}, {}), /Missing required/); console.log("PASS tools"); })();
