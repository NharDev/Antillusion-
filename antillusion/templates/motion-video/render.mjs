// Render the video to MP4 (with sound) — frame-exact, no real-time capture.
//   node render.mjs [--demo cinematic] [--fps 30] [--out video.mp4] [--crf 16]
// Needs: Node 18+, `npm i -D playwright` (+ `npx playwright install chromium` once) and ffmpeg on PATH.
import { chromium } from "playwright";
import { spawn, spawnSync } from "node:child_process";
import { createServer } from "node:http";
import { readFile, writeFile, rm } from "node:fs/promises";
import { extname, join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { tmpdir } from "node:os";

const arg = (k, d) => { const i = process.argv.indexOf("--" + k); return i > 0 ? process.argv[i + 1] : d; };
const dir = dirname(fileURLToPath(import.meta.url)), out = arg("out", "video.mp4"), crf = arg("crf", "16"), demo = arg("demo", "");
if (spawnSync("ffmpeg", ["-version"]).error) { console.error("ffmpeg was not found on PATH. Install it (https://ffmpeg.org) or use the page's WebM / PNG export."); process.exit(1); }

const types = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".png": "image/png" };
const server = createServer(async (req, res) => { try { const p = new URL(req.url, "http://x").pathname; const f = join(dir, p === "/" ? "index.html" : p.replace(/\.\./g, "")); res.writeHead(200, { "content-type": types[extname(f)] || "application/octet-stream" }); res.end(await readFile(f)); } catch { res.writeHead(404).end(); } }).listen(0);
const port = server.address().port;

const browser = await chromium.launch({ args: ["--autoplay-policy=no-user-gesture-required"] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
page.on("pageerror", (e) => console.error("page error:", e.message));
await page.goto(`http://localhost:${port}/index.html?render=1${demo ? "&demo=" + demo : ""}`);
await page.waitForFunction("window.__ready === true", null, { timeout: 30000 });
const info = await page.evaluate(() => ({ fps: video.fps, duration: video.duration, w: video.width, h: video.height }));
const fps = +arg("fps", info.fps), frames = Math.round(info.duration * fps);
console.log(`Rendering ${frames} frames (${info.w}×${info.h} @ ${fps} fps)…`);

// 1) soundtrack, rendered offline and deterministic
const wavB64 = await page.evaluate(async () => { const b = await video.renderAudio(); if (!b) return null; const buf = new Uint8Array(await b.arrayBuffer()); let s = ""; for (let i = 0; i < buf.length; i += 0x8000) s += String.fromCharCode(...buf.subarray(i, i + 0x8000)); return btoa(s); });
const wav = join(tmpdir(), "motion-audio-" + process.pid + ".wav"); if (wavB64) await writeFile(wav, Buffer.from(wavB64, "base64"));

// 2) frames piped straight into ffmpeg
const args = ["-y", "-f", "image2pipe", "-framerate", String(fps), "-i", "-", ...(wavB64 ? ["-i", wav] : []), "-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", crf, "-preset", "medium", ...(wavB64 ? ["-c:a", "aac", "-b:a", "192k", "-shortest"] : []), "-movflags", "+faststart", out];
const ff = spawn("ffmpeg", args, { stdio: ["pipe", "ignore", "inherit"] });
for (let i = 0; i < frames; i++) {
  const b64 = await page.evaluate((t) => { video.renderFrame(t); return video.canvas.toDataURL("image/png").split(",")[1]; }, i / fps);
  if (!ff.stdin.write(Buffer.from(b64, "base64"))) await new Promise((r) => ff.stdin.once("drain", r));
  if (i % 30 === 0) process.stdout.write(`\r${i}/${frames}`);
}
ff.stdin.end(); await new Promise((r) => ff.on("close", r));
await browser.close(); server.close(); if (wavB64) await rm(wav, { force: true });
console.log(`\nDone → ${out}`);
