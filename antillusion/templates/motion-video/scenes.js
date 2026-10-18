/* SCENES — edit this file. Everything is a function of time, so the video is frame-exact and exportable.
   Quick map: CONFIG (size/fps/palette/text) → scenes (each: M.scene(start, end, (ctx, s) => {...}, opts)) → sounds (M.sfx / M.music).
   s = { t: seconds since this scene started, p: 0..1 progress, dur, w, h, T: global time }.  Library: Motion.fx / Motion.cam / Motion.ease / Cine. */
const CONFIG = {
  width: 1920, height: 1080,            // 1080×1920 for vertical (reels / tiktok / shorts)
  fps: 30, duration: 14,
  rtl: false,                            // true for Arabic text (animates by word, keeps letters joined)
  font: "Cairo, Tajawal, 'Segoe UI', system-ui, sans-serif",
  palette: { bg: "#0a0f24", a: "#7c9cff", b: "#ff5fa2", c: "#12d6c0", gold: "#ffd166", text: "#ffffff", dim: "rgba(255,255,255,.72)" },
};
const TEXT = {
  hook: "Your idea, in motion", sub: "Make videos that look designed.",
  features: [["Fast", "Built in minutes"], ["Precise", "Frame-exact timing"], ["Flexible", "Export anywhere"]],
  stat: "Creators this month", bars: [["Jan", 32], ["Feb", 48], ["Mar", 61], ["Apr", 92]],
  end: "Start creating", url: "yourbrand.com",
};

const { ease, fx, cam, map, prog, hex } = Motion, P = CONFIG.palette, F = CONFIG.font, RTL = CONFIG.rtl;
const M = Motion.create({ canvas: document.getElementById("stage"), width: CONFIG.width, height: CONFIG.height, fps: CONFIG.fps, duration: CONFIG.duration, background: P.bg });
const U = CONFIG.height / 1080;           // scale unit: sizes below are written for 1080p height

/* 1 · HOOK ------------------------------------------------------------------------------------------------ */
M.scene(0, 4.2, (ctx, s) => {
  const { w, h, t } = s, c = cam.drift(t, s.dur, { x: 0, y: 0, zoom: 1 }, { x: 0, y: -10, zoom: 1.06 });
  ctx.save(); cam.apply(ctx, w, h, c);
  fx.bg(ctx, w, h, t, { mode: "mesh", colors: [P.bg, P.a, P.b, P.c] });
  fx.particles(ctx, { seed: 4, count: 70, t, x: 0, y: 0, w, h, type: "dust", colors: ["rgba(255,255,255,.7)"], size: 8 * U, life: 4 });
  ctx.restore();
  // orbit ring that draws itself behind the title
  fx.ring(ctx, w / 2, h / 2, 330 * U * ease.outBack(Math.min(1, t / 1.2)), prog(t, 0.2, 1.4, ease.inOutCubic), 6 * U, hex(P.text, 0.35));
  const title = fx.text(ctx, TEXT.hook, w / 2, h / 2 - 30 * U, { size: 132 * U, font: F, weight: 800, color: [P.text, "#cfe0ff"], mode: "mask", t: t - 0.35, dur: 0.9, rtl: RTL, maxWidth: w * 0.78, shadow: true });
  fx.text(ctx, TEXT.sub, w / 2, h / 2 + 150 * U, { size: 52 * U, font: F, weight: 500, color: P.dim, mode: "fade", t: t - 1.5, dur: 0.8, rtl: RTL });
  // accent underline
  const lw = 380 * U * ease.outExpo(Math.min(1, Math.max(0, (t - 1.3) / 0.8)));
  ctx.fillStyle = P.b; fx.roundRect(ctx, w / 2 - lw / 2, h / 2 + 95 * U, lw, 8 * U, 4 * U); ctx.fill();
}, { out: "fade", outDur: 0.5 });

/* 2 · THREE FEATURES -------------------------------------------------------------------------------------- */
M.scene(3.7, 8.2, (ctx, s) => {
  const { w, h, t } = s;
  fx.bg(ctx, w, h, t + 3, { mode: "mesh", colors: [P.bg, P.c, P.a, P.b] });
  fx.text(ctx, "Why it works", w / 2, 190 * U, { size: 78 * U, font: F, weight: 800, color: P.text, mode: "rise", t, dur: 0.7, rtl: RTL });
  const cw = 440 * U, ch = 520 * U, gap = 70 * U, x0 = (w - (cw * 3 + gap * 2)) / 2, colors = [P.a, P.b, P.c];
  TEXT.features.forEach(([name, desc], i) => {
    const st = 0.5 + i * 0.28, p = ease.outBack(Math.min(1, Math.max(0, (t - st) / 0.7))), x = x0 + i * (cw + gap), y = h / 2 - ch / 2 + 70 * U + (1 - p) * 140 * U;
    ctx.save(); ctx.globalAlpha = Math.min(1, p * 1.5); ctx.translate(x + cw / 2, y + ch / 2); ctx.scale(0.85 + 0.15 * p, 0.85 + 0.15 * p); ctx.translate(-cw / 2, -ch / 2);
    ctx.shadowColor = "rgba(0,0,0,.4)"; ctx.shadowBlur = 50; ctx.shadowOffsetY = 20; ctx.fillStyle = "rgba(255,255,255,.08)"; fx.roundRect(ctx, 0, 0, cw, ch, 36 * U); ctx.fill(); ctx.shadowColor = "transparent";
    ctx.strokeStyle = "rgba(255,255,255,.18)"; ctx.lineWidth = 2; ctx.stroke();
    // icon: a glowing disc with an animated ring
    ctx.fillStyle = fx.radial(ctx, cw / 2, 170 * U, 0, 110 * U, [hex(colors[i], 1), hex(colors[i], 0.15)]); fx.circle(ctx, cw / 2, 170 * U, 86 * U); ctx.fill();
    fx.ring(ctx, cw / 2, 170 * U, 108 * U, prog(t, st + 0.3, 1.0, ease.outCubic), 7 * U, "#fff");
    fx.text(ctx, name, cw / 2, 340 * U, { size: 62 * U, font: F, weight: 800, color: P.text, mode: "none", rtl: RTL });
    fx.text(ctx, desc, cw / 2, 410 * U, { size: 36 * U, font: F, weight: 500, color: P.dim, mode: "none", rtl: RTL, maxWidth: cw - 70 * U });
    ctx.restore();
  });
}, { in: "fade", inDur: 0.5, out: "fade", outDur: 0.5 });

/* 3 · NUMBERS --------------------------------------------------------------------------------------------- */
M.scene(7.7, 11.2, (ctx, s) => {
  const { w, h, t } = s;
  fx.bg(ctx, w, h, t + 7, { mode: "gradient", colors: [P.bg, "#141a3d", P.bg] });
  const big = fx.counter(t, 0, 128000, 1.6, ease.outExpo, (v) => Math.round(v).toLocaleString("en-US"));
  fx.text(ctx, big, w * 0.3, h / 2 - 20 * U, { size: 190 * U, font: F, weight: 800, color: [P.a, P.c], mode: "scale", t: t - 0.15, dur: 0.6 });
  fx.text(ctx, TEXT.stat, w * 0.3, h / 2 + 90 * U, { size: 48 * U, font: F, weight: 500, color: P.dim, mode: "fade", t: t - 0.7, dur: 0.6, rtl: RTL });
  fx.bars(ctx, { x: w * 0.56, y: h / 2 - 270 * U, w: 700 * U, h: 420 * U, values: TEXT.bars.map((b) => b[1]), labels: TEXT.bars.map((b) => b[0]), t: t - 0.4, colors: [P.a, P.b, P.c, P.gold], size: 34 * U, font: F, radius: 18 * U, rtl: RTL });
}, { in: "fade", inDur: 0.5, out: "fade", outDur: 0.5 });

/* 4 · END CARD -------------------------------------------------------------------------------------------- */
M.scene(10.8, 14, (ctx, s) => {
  const { w, h, t } = s;
  fx.bg(ctx, w, h, t + 11, { mode: "mesh", colors: [P.bg, P.b, P.a, P.c] });
  const lp = ease.outBack(Math.min(1, Math.max(0, t / 0.9))), cx = w / 2, cy = h / 2 - 120 * U;
  ctx.save(); ctx.translate(cx, cy); ctx.scale(lp, lp); ctx.rotate((1 - lp) * -1.2);
  ctx.fillStyle = fx.gradient(ctx, -90 * U, -90 * U, 90 * U, 90 * U, [P.a, P.b]); fx.circle(ctx, 0, 0, 92 * U); ctx.fill();
  ctx.fillStyle = P.bg; ctx.beginPath(); ctx.arc(0, 0, 92 * U, -Math.PI / 2, Math.PI / 2); ctx.closePath(); ctx.globalAlpha = 0.55; ctx.fill(); ctx.restore();
  fx.text(ctx, TEXT.end, w / 2, h / 2 + 100 * U, { size: 112 * U, font: F, weight: 800, color: P.text, mode: "mask", t: t - 0.5, dur: 0.8, rtl: RTL, shadow: true });
  fx.text(ctx, TEXT.url, w / 2, h / 2 + 215 * U, { size: 56 * U, font: F, weight: 600, color: P.gold, mode: "fade", t: t - 1.2, dur: 0.7, rtl: RTL });
  fx.particles(ctx, { seed: 9, count: 120, t: t - 0.35, x: cx, y: cy, type: "confetti", colors: [P.a, P.b, P.c, P.gold, "#fff"], size: 16 * U, speed: 900 * U, gravity: 1500 * U, life: 2.6 });
}, { in: "fade", inDur: 0.5 });

/* SOUND ---------------------------------------------------------------------------------------------------- */
M.music({ bpm: 104, bars: 8, key: "A", mode: "minor", style: "upbeat", vol: 0.35 });
M.sfx(0.3, "whoosh"); M.sfx(0.55, "hit", { vol: 0.5 });
M.sfx(3.9, "whoosh"); [0.5, 0.78, 1.06].forEach((d, i) => M.sfx(3.7 + d, "pop", { vol: 0.45 + i * 0.05 }));
M.sfx(7.5, "riser", { dur: 0.9, vol: 0.4 }); [0, 0.15, 0.3, 0.45].forEach((d) => M.sfx(8.1 + d, "tick", { vol: 0.5 }));
M.sfx(10.75, "whoosh"); M.sfx(11.3, "hit", { vol: 0.6 }); M.sfx(11.4, "chime", { vol: 0.6 });
