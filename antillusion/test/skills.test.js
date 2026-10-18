"use strict";
const assert = require("assert");
const skills = require("../core/skills");
const library = require("../core/library");

const all = skills.list();
assert.ok(all.length >= 8, "built-in skills are missing");
const cards = new Set(library.list().cards.map((c) => c.id)), templates = new Set(library.templates().map((t) => t.name));
for (const sk of all) {
  assert.ok(sk.title && sk.command && sk.triggers.length, `skill ${sk.name} needs title, command and triggers`);
  assert.ok(sk.size > 300, `skill ${sk.name} has no workflow body`);
  for (const r of sk.refs) assert.ok(cards.has(r), `skill ${sk.name} refers to a missing library card: ${r}`);
  if (sk.template) assert.ok(templates.has(sk.template), `skill ${sk.name} refers to a missing template: ${sk.template}`);
}
assert.deepStrictEqual(all.slice(0, 3).map((s) => s.command), ["video", "story", "game"], "UI order");
assert.strictEqual(new Set(all.map((s) => s.command)).size, all.length, "slash commands must be unique");

const m = (t) => (skills.match(t) || {}).name || null;
// should switch a skill on
assert.strictEqual(m("اعمل لي فيديو موشن جرافيك لتطبيقي"), "motion-video");
assert.strictEqual(m("make a promo video for my app"), "motion-video");
assert.strictEqual(m("اعمل انترو للقناة"), "motion-video");
assert.strictEqual(m("اكتب لي قصة فيها تويست غير متوقع"), "story-cinematic");
assert.strictEqual(m("write a story about a dragon"), "story-cinematic");
assert.strictEqual(m("ابني لعبة منصات"), "game-dev");
assert.strictEqual(m("أريد تصميم صفحة هبوط جميلة"), "ui-design");
assert.strictEqual(m("التطبيق لا يعمل ويظهر خطأ"), "fix");
assert.strictEqual(m("راجع الكود وابحث عن اخطاء"), "review");
// ordinary requests must not trigger anything
for (const q of ["add error handling to the api", "hello", "اشرح لي ما هو الـ closure", "rename the variable foo to bar", "اضف زر حفظ للنموذج"]) assert.strictEqual(m(q), null, "false positive: " + q);

// slash commands
const sl = skills.parseSlash("/video اعمل انترو 10 ثواني");
assert.strictEqual(sl.skill.name, "motion-video"); assert.strictEqual(sl.rest, "اعمل انترو 10 ثواني");
assert.strictEqual(skills.parseSlash("/story").rest, ""); assert.strictEqual(skills.parseSlash("/nope hi"), null); assert.strictEqual(skills.parseSlash("hello /video"), null);
// header parsing
const p = skills.parse("---\nname: X\ntitle: T\ncommand: /xx\ntriggers: !one, two words\nrefs: a, b\n---\nbody here", "x.md");
assert.deepStrictEqual([p.name, p.command, p.refs.length, p.triggers[0], p.body], ["x", "xx", 2, "!one", "body here"]);
console.log("PASS skills (" + all.length + " built-in)");
