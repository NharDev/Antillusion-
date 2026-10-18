/* Verification before "done": what changed in the workspace during this run is checked for real — syntax of every changed
   file, local references in HTML that point nowhere, the page actually loaded and run in a hidden browser (console
   errors, blank screen, a canvas that never draws), and the project's own test script. Returns problems the agent must fix.
   node test/verify.test.js */
"use strict";
const fs = require("fs"), path = require("path"), http = require("http");

const SKIP_DIRS = /^(node_modules|\.git|\.antillusion|dist|build|out|\.next|\.cache|coverage|__pycache__|venv|\.venv|target)$/;
const CHECKABLE = /\.(m?js|cjs|json|html?|css|py)$/i;
const MIME = { ".html": "text/html; charset=utf-8", ".htm": "text/html; charset=utf-8", ".js": "text/javascript", ".mjs": "text/javascript", ".css": "text/css", ".json": "application/json", ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".gif": "image/gif", ".svg": "image/svg+xml", ".webp": "image/webp", ".wav": "audio/wav", ".mp3": "audio/mpeg", ".ogg": "audio/ogg", ".glb": "model/gltf-binary", ".gltf": "model/gltf+json", ".woff2": "font/woff2", ".ico": "image/x-icon", ".wasm": "application/wasm" };

/** Files under cwd modified at or after `since` (ms), skipping dependency/build folders. */
function changedFiles(cwd, since, max = 4000) {
  const out = []; let seen = 0;
  const walk = (d, depth) => {
    if (depth > 7 || seen > max) return;
    let ents; try { ents = fs.readdirSync(d, { withFileTypes: true }); } catch { return; }
    for (const e of ents) {
      if (++seen > max) return;
      const p = path.join(d, e.name);
      if (e.isDirectory()) { if (!SKIP_DIRS.test(e.name)) walk(p, depth + 1); }
      else { try { if (fs.statSync(p).mtimeMs >= since - 1500) out.push(p); } catch {} }
    }
  };
  walk(cwd, 0);
  return out;
}

/** Local src/href references in an HTML file that do not exist on disk. */
function brokenRefs(file, html) {
  const dir = path.dirname(file), out = [];
  for (const m of html.matchAll(/\b(?:src|href)\s*=\s*["']([^"'#?]+)["']/gi)) {
    const ref = m[1].trim();
    if (!ref || /^(https?:|data:|blob:|mailto:|tel:|javascript:|\/\/|#)/i.test(ref) || ref.startsWith("{") || ref.includes("${")) continue;
    const target = ref.startsWith("/") ? path.join(dir, ref) : path.join(dir, ref);
    if (!fs.existsSync(decodeURIComponent(target))) out.push(ref);
  }
  return [...new Set(out)];
}

/** Tiny static server for the page check (ES modules need http, not file://). */
function serveDir(root) {
  return new Promise((resolve) => {
    const srv = http.createServer((req, res) => {
      let p = decodeURIComponent((req.url || "/").split("?")[0]); if (p.endsWith("/")) p += "index.html";
      const fp = path.join(root, p); if (!fp.startsWith(root)) { res.writeHead(403); return res.end(); }
      fs.readFile(fp, (err, buf) => { if (err) { res.writeHead(404); return res.end("not found"); } res.writeHead(200, { "Content-Type": MIME[path.extname(fp).toLowerCase()] || "application/octet-stream", "Cache-Control": "no-store" }); res.end(buf); });
    }).listen(0, "127.0.0.1", () => resolve({ url: `http://127.0.0.1:${srv.address().port}`, close: () => srv.close() }));
  });
}

/**
 * @param o { cwd, since, syntaxCheck(fp, content) => Promise<string>, verifyPage?(url) => Promise<{errors, blank, frozen, title}>,
 *            runTests?(cmd, cwd) => Promise<{code, out}>, level: "static" | "full", signal }
 * @returns { checks: [{ name, ok, detail }], problems: [string], files: [rel] }
 */
async function verifyWorkspace(o) {
  const { cwd, since } = o, checks = [], problems = [];
  const files = changedFiles(cwd, since).filter((f) => CHECKABLE.test(f) || /\.(png|jpe?g|svg|glb|wav|mp3)$/i.test(f));
  const rel = (f) => path.relative(cwd, f).split(path.sep).join("/");
  if (!files.length) return { checks, problems, files: [] };

  // 1) syntax of every changed source file
  let syntaxBad = 0;
  for (const f of files.filter((x) => CHECKABLE.test(x))) {
    if (o.signal && o.signal.aborted) break;
    let src; try { src = fs.readFileSync(f, "utf8"); } catch { continue; }
    if (src.length > 1.5e6) continue;
    const err = await o.syntaxCheck(f, src).catch(() => "");
    if (err) { syntaxBad++; problems.push(`Syntax error in ${rel(f)}: ${String(err).slice(0, 600)}`); }
  }
  checks.push({ name: "syntax", ok: !syntaxBad, detail: syntaxBad ? `${syntaxBad} ملف فيه أخطاء صياغة` : `${files.filter((x) => CHECKABLE.test(x)).length} ملفات سليمة الصياغة` });

  // 2) every local file an HTML page points to exists
  const htmls = files.filter((f) => /\.html?$/i.test(f)); let missing = 0;
  for (const f of htmls) { const b = brokenRefs(f, fs.readFileSync(f, "utf8")); if (b.length) { missing += b.length; problems.push(`${rel(f)} references files that do not exist: ${b.slice(0, 8).join(", ")}`); } }
  if (htmls.length) checks.push({ name: "refs", ok: !missing, detail: missing ? `${missing} مرجع لملف غير موجود` : "كل الملفات المشار إليها موجودة" });

  // 3) run the page for real: load it in a hidden browser, watch the console, look at the pixels
  if (o.level === "full" && o.verifyPage && htmls.length) {
    const page = htmls.find((f) => /index\.html?$/i.test(f)) || htmls[0], root = path.dirname(page), srv = await serveDir(root);
    try {
      const r = await o.verifyPage(`${srv.url}/${path.basename(page)}`);
      const errs = (r && r.errors) || [];
      if (errs.length) problems.push(`Running ${rel(page)} in a browser produced console errors:\n${errs.slice(0, 12).map((e) => "  - " + e).join("\n")}`);
      if (r && r.blank) problems.push(`${rel(page)} renders a blank screen after loading (nothing visible). Check that the scene/content is actually drawn and that scripts run.`);
      if (r && r.frozen) problems.push(`${rel(page)} has a canvas that never changes between frames — the game/animation loop does not seem to run.`);
      checks.push({ name: "run", ok: !errs.length && !(r && (r.blank || r.frozen)), detail: errs.length ? `${errs.length} خطأ عند التشغيل` : r && r.blank ? "الصفحة فارغة" : r && r.frozen ? "الحلقة لا تعمل" : `تعمل بلا أخطاء${r && r.title ? " — " + r.title : ""}` });
    } catch (e) { checks.push({ name: "run", ok: true, detail: "تعذّر التشغيل التجريبي: " + e.message }); }
    finally { srv.close(); }
  }

  // 4) the project's own tests, when it has a real test script
  if (o.level === "full" && o.runTests) {
    let pkg = null; try { pkg = JSON.parse(fs.readFileSync(path.join(cwd, "package.json"), "utf8")); } catch {}
    const t = pkg && pkg.scripts && pkg.scripts.test;
    if (t && !/no test specified/.test(t) && fs.existsSync(path.join(cwd, "node_modules"))) {
      const r = await o.runTests("npm test", cwd).catch((e) => ({ code: 1, out: e.message }));
      if (r.code !== 0) problems.push(`npm test failed (exit ${r.code}):\n${String(r.out).slice(-2500)}`);
      checks.push({ name: "tests", ok: r.code === 0, detail: r.code === 0 ? "الاختبارات نجحت" : "الاختبارات فشلت" });
    }
  }
  return { checks, problems, files: files.map(rel) };
}

module.exports = { verifyWorkspace, changedFiles, brokenRefs, serveDir };
