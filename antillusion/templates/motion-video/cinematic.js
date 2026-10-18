/* Antillusion Cine — cinematic helpers on top of Motion: letterbox, camera, subtitles, dialogue boxes, title cards, colour grade,
   film grain, vignette, procedural sky/skyline/silhouettes. All functions are pure functions of time (t in seconds). */
(function (global) {
  "use strict";
  const M = global.Motion, { clamp, lerp, ease, rng, hex } = M;
  const font = (o, size, weight) => `${weight || o.weight || 600} ${size}px ${o.font || "system-ui, sans-serif"}`;

  const Cine = {
    /** set Cine.ratio = 2.39 (or 1.85) once in scenes.js when you use letterbox(): subtitles and dialogue then stay inside the visible picture */
    ratio: null,
    barHeight(w, h, ratio) { const r = ratio || Cine.ratio; return r ? Math.max(0, (h - w / r) / 2) : 0; },
    /** cinematic bars: ratio 2.39 (scope) or 1.85; animate in with p 0..1 */
    letterbox(ctx, w, h, p = 1, ratio = 2.39) { const bar = Math.max(0, (h - w / ratio) / 2) * clamp(p); ctx.save(); ctx.fillStyle = "#000"; ctx.fillRect(0, 0, w, bar); ctx.fillRect(0, h - bar, w, bar); ctx.restore(); return bar; },
    vignette(ctx, w, h, strength = 0.55) { ctx.save(); ctx.fillStyle = M.fx.radial(ctx, w / 2, h / 2, Math.min(w, h) * 0.35, Math.hypot(w, h) * 0.6, ["rgba(0,0,0,0)", `rgba(0,0,0,${strength})`]); ctx.fillRect(0, 0, w, h); ctx.restore(); },
    /** film grain; t decides the pattern so each frame differs but renders identically every time */
    grain(ctx, w, h, t, amount = 0.07, fps = 24) { const r = rng(Math.floor(t * fps) + 1), n = 1400; ctx.save(); for (let i = 0; i < n; i++) { const g = r() > 0.5 ? 255 : 0; ctx.fillStyle = `rgba(${g},${g},${g},${amount * r()})`; ctx.fillRect(r() * w, r() * h, 2, 2); } ctx.restore(); },
    /** colour grade wash: tint '#ff9a3c' warm, '#3c7bff' cold; mode 'multiply'|'overlay'|'soft-light' */
    grade(ctx, w, h, tint = "#ff9a3c", alpha = 0.25, mode = "soft-light") { ctx.save(); ctx.globalCompositeOperation = mode; ctx.globalAlpha = alpha; ctx.fillStyle = tint; ctx.fillRect(0, 0, w, h); ctx.restore(); },
    fade(ctx, w, h, p, color = "#000") { if (p <= 0) return; ctx.save(); ctx.globalAlpha = clamp(p); ctx.fillStyle = color; ctx.fillRect(0, 0, w, h); ctx.restore(); },
    /** white flash that decays */
    flash(ctx, w, h, t, dur = 0.25) { if (t < 0 || t > dur) return; ctx.save(); ctx.globalAlpha = 1 - t / dur; ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, w, h); ctx.restore(); },

    /** Subtitle line at the bottom: Cine.subtitle(ctx, w, h, "text", { t, dur, size, rtl, font }) — t = seconds since it appeared */
    subtitle(ctx, w, h, text, o = {}) {
      const t = o.t == null ? 99 : o.t, dur = o.dur || 3, a = clamp(Math.min(t / 0.25, (dur - t) / 0.25)); if (a <= 0) return;
      const size = o.size || Math.round(h * 0.042), y = o.y || (h - Cine.barHeight(w, h) - size * 2.1);
      ctx.save(); ctx.globalAlpha = a; ctx.font = font(o, size, 600); ctx.direction = o.rtl ? "rtl" : "ltr"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
      const maxW = w * 0.78, words = String(text).split(" "), lines = []; let cur = "";
      for (const wd of words) { const s = cur ? cur + " " + wd : wd; if (ctx.measureText(s).width > maxW && cur) { lines.push(cur); cur = wd; } else cur = s; }
      lines.push(cur); const lh = size * 1.3, bw = Math.max(...lines.map((l) => ctx.measureText(l).width)) + size, bh = lines.length * lh + size * 0.5, top = y - bh / 2;
      ctx.fillStyle = "rgba(0,0,0,.55)"; M.fx.roundRect(ctx, w / 2 - bw / 2, top, bw, bh, size * 0.4); ctx.fill();
      ctx.fillStyle = o.color || "#fff"; lines.forEach((l, i) => ctx.fillText(l, w / 2, top + size * 0.25 + lh * (i + 0.5))); ctx.restore();
    },
    /** RPG/visual-novel dialogue box with typewriter text. o: { name, text, t, speed (chars/s), color, rtl, font, portrait(ctx,x,y,size) } — returns {done, chars} so you can chain lines */
    dialogue(ctx, w, h, o) {
      const t = o.t == null ? 99 : o.t, speed = o.speed || 32, text = String(o.text), shown = Math.min(text.length, Math.floor(Math.max(0, t) * speed)), size = Math.round(h * 0.036), bh = h * 0.2, bx = w * 0.08, bw = w * 0.84, by = o.y || (h - Cine.barHeight(w, h) - bh - h * 0.03), a = clamp(t / 0.25);
      ctx.save(); ctx.globalAlpha = a; ctx.translate(0, (1 - ease.outCubic(a)) * 30);
      ctx.fillStyle = "rgba(10,12,24,.82)"; M.fx.roundRect(ctx, bx, by, bw, bh, 22); ctx.fill(); ctx.strokeStyle = hex(o.color || "#7c9cff", 0.8); ctx.lineWidth = 3; ctx.stroke();
      let tx = bx + 36; if (o.portrait) { o.portrait(ctx, bx + 24, by + 18, bh - 36); tx += bh - 24; }
      ctx.font = font(o, size * 0.9, 800); ctx.textBaseline = "alphabetic"; ctx.direction = o.rtl ? "rtl" : "ltr"; ctx.textAlign = o.rtl ? "right" : "left";
      const x0 = o.rtl ? bx + bw - 36 : tx; ctx.fillStyle = o.color || "#7c9cff"; if (o.name) ctx.fillText(o.name, x0, by + size * 1.35);
      ctx.font = font(o, size, 500); ctx.fillStyle = "#fff"; const maxW = bw - (tx - bx) - 40, words = text.slice(0, shown).split(" "), lines = []; let cur = "";
      for (const wd of words) { const s = cur ? cur + " " + wd : wd; if (ctx.measureText(s).width > maxW && cur) { lines.push(cur); cur = wd; } else cur = s; }
      lines.push(cur); lines.slice(0, 3).forEach((l, i) => ctx.fillText(l, x0, by + size * 2.7 + i * size * 1.35));
      if (shown >= text.length && Math.floor(t * 2) % 2 === 0) { ctx.fillStyle = o.color || "#7c9cff"; ctx.fillText("▼", bx + bw - 40, by + bh - 18); }
      ctx.restore(); return { done: shown >= text.length, chars: shown, total: text.length, time: text.length / speed };
    },
    /** movie title card: letter-spaced title that fades up, optional tagline. t = seconds since it appears */
    title(ctx, w, h, text, o = {}) {
      const t = o.t == null ? 99 : o.t, p = ease.outCubic(clamp(t / 1.6)), size = o.size || Math.round(h * 0.11); ctx.save(); ctx.globalAlpha = p; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.direction = o.rtl ? "rtl" : "ltr";
      ctx.font = font(o, size, 800); if (!o.rtl && ctx.letterSpacing !== undefined) ctx.letterSpacing = `${(1 - p) * size * 0.3 + size * 0.12}px`;
      ctx.fillStyle = o.color || "#f4efe6"; ctx.shadowColor = o.glow || "rgba(255,200,120,.55)"; ctx.shadowBlur = size * 0.4; ctx.fillText(text, w / 2, o.y || h / 2);
      if (o.tagline) { ctx.shadowBlur = 0; ctx.globalAlpha = p * clamp((t - 1) / 1); ctx.font = font(o, size * 0.26, 500); if (ctx.letterSpacing !== undefined) ctx.letterSpacing = `${size * 0.06}px`; ctx.fillStyle = "rgba(244,239,230,.75)"; ctx.fillText(o.tagline, w / 2, (o.y || h / 2) + size * 0.95); }
      ctx.restore();
    },

    /** vertical sky gradient: colours top→bottom */
    sky(ctx, w, h, colors = ["#0a0f2c", "#3b2a6b", "#e0735a", "#ffcf87"], horizon = 0.7) { ctx.save(); ctx.fillStyle = M.fx.gradient(ctx, 0, 0, 0, h * horizon, colors); ctx.fillRect(0, 0, w, h); ctx.restore(); },
    /** layered city/mountain silhouette; x shifts with camera for parallax. kind 'city' | 'mountains' | 'forest' */
    skyline(ctx, w, h, { seed = 1, color = "#0b0e1c", base = 0.8, amp = 0.22, x = 0, kind = "city", windows = "#ffd27a", t = 0 } = {}) {
      const r = rng(seed); ctx.save(); ctx.fillStyle = color; ctx.beginPath(); ctx.moveTo(-50, h);
      const step = kind === "city" ? 70 : 40, total = w + 400; let px = -200, py = h * base;
      const items = []; while (px < total) { const bw = kind === "city" ? 50 + r() * 90 : step + r() * 60, bh = (kind === "city" ? r() : Math.pow(r(), 0.8)) * h * amp + h * 0.02; items.push([px, bw, bh]); px += kind === "city" ? bw + r() * 8 : bw * 0.6; }
      const off = ((x % total) + total) % total;
      for (const [bx, bw, bh] of items) { const X = bx - off + (bx - off < -300 ? total : 0); if (kind === "city") { ctx.fillRect(X, h * base - bh, bw, bh + h); if (windows && bh > h * 0.06) { ctx.fillStyle = windows; for (let wy = h * base - bh + 14; wy < h * base - 6; wy += 22) for (let wx = X + 8; wx < X + bw - 10; wx += 16) if (rng(Math.floor(wx * 7 + wy * 13) + seed)() > 0.55) ctx.fillRect(wx, wy, 7, 10); ctx.fillStyle = color; } } else { ctx.beginPath(); ctx.moveTo(X, h); ctx.lineTo(X + bw / 2, h * base - bh); ctx.lineTo(X + bw, h); ctx.closePath(); ctx.fill(); } }
      ctx.restore();
    },
    /** stylised person silhouette (placeholder character). pose 'stand' | 'walk' | 'sit' | 'point'; s = height in px; t drives the walk cycle */
    silhouette(ctx, x, y, s, { color = "#0b0e1c", pose = "stand", t = 0, flip = false, accent } = {}) {
      ctx.save(); ctx.translate(x, y); if (flip) ctx.scale(-1, 1); ctx.fillStyle = color; ctx.strokeStyle = color; ctx.lineCap = "round"; const u = s / 10, w = Math.sin(t * 8) * (pose === "walk" ? 1 : 0);
      M.fx.circle(ctx, 0, -s + u * 1.1, u * 1.1); ctx.fill();
      ctx.lineWidth = u * 1.3; ctx.beginPath(); ctx.moveTo(0, -s + u * 2.3); ctx.lineTo(0, -s * 0.46); ctx.stroke();   // torso
      ctx.lineWidth = u * 0.95; const arm = (a) => { ctx.beginPath(); ctx.moveTo(0, -s + u * 3); ctx.lineTo(Math.sin(a) * u * 3, -s + u * 3 + Math.cos(a) * u * 3.2); ctx.stroke(); };
      arm(pose === "point" ? -1.5 : 0.35 + w * 0.5); arm(pose === "point" ? 0.35 : -0.35 - w * 0.5);
      ctx.lineWidth = u * 1.1; const leg = (a) => { ctx.beginPath(); ctx.moveTo(0, -s * 0.46); ctx.lineTo(Math.sin(a) * u * 3.4, 0); ctx.stroke(); };
      if (pose === "sit") { ctx.beginPath(); ctx.moveTo(0, -s * 0.46); ctx.lineTo(u * 3, -s * 0.4); ctx.lineTo(u * 3, 0); ctx.stroke(); } else { leg(0.12 + w * 0.5); leg(-0.12 - w * 0.5); }
      if (accent) { ctx.fillStyle = accent; ctx.fillRect(-u * 0.5, -s + u * 2.4, u, u * 0.5); }
      ctx.restore();
    },
    /** parallax helper: layers = [{ speed: 0.2, draw(ctx, x) }, ...]; x = camera position in px */
    parallax(ctx, layers, x) { for (const L of layers) { ctx.save(); L.draw(ctx, x * L.speed); ctx.restore(); } },
  };
  global.Cine = Cine;
})(typeof window !== "undefined" ? window : globalThis);
