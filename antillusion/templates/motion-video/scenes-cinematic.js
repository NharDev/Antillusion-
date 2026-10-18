/* CINEMATIC DEMO — a short film in three shots, built with Cine (letterbox, parallax skyline, silhouettes, subtitles, dialogue, title card).
   Open with index.html?demo=cinematic. Copy this file over scenes.js (or point index.html at it) and rewrite the story.
   Write your story as a SHOT LIST first: shot size · camera move · duration · sound, then turn each shot into one M.scene(). */
const CONFIG = {
  width: 1920, height: 1080, fps: 30, duration: 17, rtl: false,
  font: "Cairo, Tajawal, 'Segoe UI', system-ui, sans-serif",
};
const { ease, fx, cam, prog, rng, hex, lerp, clamp } = Motion, F = CONFIG.font, RTL = CONFIG.rtl;
const M = Motion.create({ canvas: document.getElementById("stage"), width: CONFIG.width, height: CONFIG.height, fps: CONFIG.fps, duration: CONFIG.duration, background: "#000" });
Cine.ratio = 2.39;   // letterbox ratio: subtitles and dialogue boxes automatically stay inside the visible picture
const LINES = {
  n1: "They told us the city had gone silent.", n2: "But every night at 3 a.m., the radio woke up.",
  mara1: "Is somebody there?", voice1: "I've been waiting for you, Mara.", mara2: "Who are you? How do you know my name?", voice2: "Look at the window.",
  title: "THE LAST SIGNAL", tagline: "Some voices were never meant to be answered.",
};

/* SHOT 1 — wide establishing: dusk city, slow push-in, a lone figure walking ------------------------------ */
M.scene(0, 6.6, (ctx, s) => {
  const { w, h, t } = s, c = cam.drift(t, s.dur, { x: -40, y: 0, zoom: 1 }, { x: 40, y: -20, zoom: 1.12 });
  ctx.save(); cam.apply(ctx, w, h, c);
  Cine.sky(ctx, w, h, ["#070a22", "#2b2160", "#c25b6a", "#ffc58a"], 0.78);
  ctx.fillStyle = "rgba(255,240,210,.9)"; fx.circle(ctx, w * 0.72, h * 0.34, 70); ctx.fill();                       // moon
  Cine.skyline(ctx, w, h, { seed: 2, color: "#2a2257", base: 0.74, amp: 0.26, x: t * 6, kind: "mountains" });
  Cine.skyline(ctx, w, h, { seed: 5, color: "#150f33", base: 0.79, amp: 0.3, x: t * 14, windows: "#ffb86b" });
  Cine.skyline(ctx, w, h, { seed: 8, color: "#07060f", base: 0.855, amp: 0.3, x: t * 30, windows: "#ffd98a" });
  const px = lerp(-200, w + 100, prog(t, 0.6, 6, ease.linear));
  Cine.silhouette(ctx, px, h * 0.855, 210, { color: "#030308", pose: "walk", t: t * 1.1 });
  ctx.restore();
  Cine.grade(ctx, w, h, "#ff8a4c", 0.2); Cine.vignette(ctx, w, h, 0.6);
  Cine.subtitle(ctx, w, h, LINES.n1, { t: t - 1.2, dur: 2.6, font: F, rtl: RTL }); Cine.subtitle(ctx, w, h, LINES.n2, { t: t - 4.0, dur: 2.5, font: F, rtl: RTL });
  Cine.fade(ctx, w, h, 1 - clamp(t / 1.0));
}, { out: "fade", outDur: 0.5 });

/* SHOT 2 — medium close-up: the radio wakes, a conversation in the dark ------------------------------------ */
M.scene(6.3, 12.4, (ctx, s) => {
  const { w, h, t } = s, c = cam.drift(t, s.dur, { x: 0, y: 0, zoom: 1.05 }, { x: 0, y: 0, zoom: 1.22 }), flick = 0.82 + 0.18 * Math.sin(t * 31) * Math.sin(t * 7.3);
  ctx.save(); cam.apply(ctx, w, h, c);
  ctx.fillStyle = "#06070f"; ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = fx.radial(ctx, w / 2, h * 0.52, 0, h * 0.7, [`rgba(255,170,90,${0.22 * flick})`, "rgba(255,170,90,0)"]); ctx.fillRect(0, 0, w, h);   // glow from the dial
  // the radio
  const rw = 760, rh = 420, rx = w / 2 - rw / 2, ry = h * 0.52 - rh / 2;
  ctx.fillStyle = "#1a1410"; fx.roundRect(ctx, rx, ry, rw, rh, 36); ctx.fill(); ctx.strokeStyle = "#3a2a1c"; ctx.lineWidth = 6; ctx.stroke();
  ctx.fillStyle = `rgba(255,190,110,${0.18 + 0.5 * flick * ease.outCubic(clamp(t / 0.8))})`; fx.roundRect(ctx, rx + 50, ry + 50, rw * 0.62, rh * 0.42, 14); ctx.fill();
  ctx.strokeStyle = "#ffd9a0"; ctx.lineWidth = 4; ctx.beginPath(); for (let x = 0; x <= rw * 0.62 - 40; x += 6) { const a = (Math.sin(x * 0.05 + t * 9) + Math.sin(x * 0.13 - t * 5)) * 22 * (t > 0.8 ? 1 : 0); ctx.lineTo(rx + 70 + x, ry + 50 + rh * 0.21 + a); } ctx.stroke();
  [0, 1].forEach((i) => { ctx.fillStyle = "#2b2016"; fx.circle(ctx, rx + rw - 120 + (i ? 0 : -150) + 70, ry + rh * 0.62, 56); ctx.fill(); ctx.strokeStyle = "#0e0a07"; ctx.lineWidth = 4; fx.circle(ctx, rx + rw - 120 + (i ? 0 : -150) + 70, ry + rh * 0.62, 56); ctx.stroke(); });
  for (let i = 0; i < 9; i++) { ctx.fillStyle = "#0e0a07"; ctx.fillRect(rx + 60 + i * 26, ry + rh - 90, 12, 50); }
  ctx.restore();
  Cine.vignette(ctx, w, h, 0.75);
  // one dialogue line at a time: [start time, who, text, colour]
  const beats = [[0.9, "MARA", LINES.mara1, "#9db8ff"], [2.6, "VOICE", LINES.voice1, "#ffb86b"], [4.5, "MARA", LINES.mara2, "#9db8ff"]], cur = beats.filter((b) => t >= b[0]).pop();
  if (cur) Cine.dialogue(ctx, w, h, { name: cur[1], text: cur[2], t: t - cur[0], color: cur[3], font: F, rtl: RTL });
  Cine.grain(ctx, w, h, t, 0.06);
}, { in: "fade", inDur: 0.5, out: "none" });

/* SHOT 3 — the twist: the window shows who is speaking ------------------------------------------------------ */
M.scene(11.9, 17, (ctx, s) => {
  const { w, h, t } = s, c = cam.drift(t, s.dur, { x: 0, y: 0, zoom: 1 }, { x: 0, y: -6, zoom: 1.1 });
  ctx.save(); cam.apply(ctx, w, h, c);
  ctx.fillStyle = "#05060d"; ctx.fillRect(0, 0, w, h);
  // window frame with the night outside
  const wx = w * 0.3, wy = h * 0.14, ww = w * 0.4, wh = h * 0.66; ctx.save(); fx.roundRect(ctx, wx, wy, ww, wh, 18); ctx.clip(); Cine.sky(ctx, w, h, ["#04050f", "#1a1f4a", "#47356b"], 0.8);
  Cine.skyline(ctx, w, h, { seed: 5, color: "#0a0a1c", base: 0.8, amp: 0.4, x: 200, windows: "#ffb86b" }); ctx.restore();
  ctx.strokeStyle = "#241c14"; ctx.lineWidth = 14; fx.roundRect(ctx, wx, wy, ww, wh, 18); ctx.stroke(); ctx.beginPath(); ctx.moveTo(w / 2, wy); ctx.lineTo(w / 2, wy + wh); ctx.stroke();
  // Mara in front (back view) and her reflection with a delay — the reveal at t = 1.8
  Cine.silhouette(ctx, w * 0.5 - 150, h * 0.98, 520, { color: "#020207", pose: "stand", t });
  const rv = ease.outCubic(clamp((t - 1.8) / 1.2));
  ctx.save(); ctx.globalAlpha = rv * 0.9; Cine.silhouette(ctx, w * 0.5 + 110, wy + wh - 40, 300, { color: "#a8c2ff", pose: "point", t, flip: true }); ctx.restore();
  ctx.restore();
  Cine.flash(ctx, w, h, t - 1.8, 0.35); Cine.vignette(ctx, w, h, 0.7);
  Cine.subtitle(ctx, w, h, LINES.voice2, { t: t - 0.3, dur: 1.7, font: F, rtl: RTL });
  Cine.fade(ctx, w, h, clamp((t - 3.1) / 0.7));
  if (t > 3.2) Cine.title(ctx, w, h, LINES.title, { t: t - 3.2, tagline: LINES.tagline, font: F, rtl: RTL });
  Cine.grain(ctx, w, h, t, 0.06);
}, { in: "fade", inDur: 0.5 });

/* Letterbox over everything (a separate top layer) */
M.scene(0, CONFIG.duration, (ctx, s) => Cine.letterbox(ctx, s.w, s.h, ease.outCubic(clamp(s.t / 1.2)), 2.39), { layer: 10 });

/* SOUND */
M.music({ bpm: 70, bars: 6, key: "D", mode: "minor", style: "cinematic", vol: 0.32 });
M.sfx(0.2, "riser", { dur: 1.2, vol: 0.3 }); M.sfx(6.35, "click"); M.sfx(6.5, "chime", { vol: 0.5, note: 60 });
M.sfx(11.9 + 1.8, "boom", { vol: 0.8 }); M.sfx(11.9 + 1.8, "whoosh", { vol: 0.6 }); M.sfx(11.9 + 3.3, "hit", { vol: 0.5 });
