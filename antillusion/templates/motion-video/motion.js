/* Antillusion Motion — a deterministic canvas motion-graphics engine (no dependencies).
   Every frame is a pure function of time, so scrubbing, real-time export and frame-exact export all look identical.
   Globals: Motion (this file), Cine (cinematic.js). You normally edit only scenes.js. */
(function (global) {
  "use strict";
  const TAU = Math.PI * 2;
  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const lerp = (a, b, t) => a + (b - a) * t;

  /* ---------- easing ---------- */
  const c1 = 1.70158, c3 = c1 + 1;
  const ease = {
    linear: (t) => t,
    inQuad: (t) => t * t, outQuad: (t) => 1 - (1 - t) * (1 - t), inOutQuad: (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2),
    inCubic: (t) => t * t * t, outCubic: (t) => 1 - Math.pow(1 - t, 3), inOutCubic: (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
    inQuart: (t) => t ** 4, outQuart: (t) => 1 - Math.pow(1 - t, 4), inOutQuart: (t) => (t < 0.5 ? 8 * t ** 4 : 1 - Math.pow(-2 * t + 2, 4) / 2),
    inExpo: (t) => (t === 0 ? 0 : Math.pow(2, 10 * t - 10)), outExpo: (t) => (t === 1 ? 1 : 1 - Math.pow(2, -10 * t)),
    inOutExpo: (t) => (t === 0 ? 0 : t === 1 ? 1 : t < 0.5 ? Math.pow(2, 20 * t - 10) / 2 : (2 - Math.pow(2, -20 * t + 10)) / 2),
    inSine: (t) => 1 - Math.cos((t * Math.PI) / 2), outSine: (t) => Math.sin((t * Math.PI) / 2), inOutSine: (t) => -(Math.cos(Math.PI * t) - 1) / 2,
    inBack: (t) => c3 * t * t * t - c1 * t * t, outBack: (t) => 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2),
    inOutBack: (t) => { const c2 = c1 * 1.525; return t < 0.5 ? (Math.pow(2 * t, 2) * ((c2 + 1) * 2 * t - c2)) / 2 : (Math.pow(2 * t - 2, 2) * ((c2 + 1) * (t * 2 - 2) + c2) + 2) / 2; },
    outElastic: (t) => (t === 0 ? 0 : t === 1 ? 1 : Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * ((2 * Math.PI) / 3)) + 1),
    outBounce: (t) => { const n = 7.5625, d = 2.75; if (t < 1 / d) return n * t * t; if (t < 2 / d) return n * (t -= 1.5 / d) * t + 0.75; if (t < 2.5 / d) return n * (t -= 2.25 / d) * t + 0.9375; return n * (t -= 2.625 / d) * t + 0.984375; },
    /** critically-underdamped spring, settles at 1: ease.spring(t, 0.5) — lower damping = more bounce */
    spring: (t, damping = 0.45) => (t <= 0 ? 0 : t >= 1 ? 1 : 1 - Math.exp(-6 * t / (1 + damping)) * Math.cos(t * 14 * (1 - damping * 0.6))),
  };
  /** map t from [a,b] to [from,to] with easing and clamping */
  const map = (t, a, b, from = 0, to = 1, e = ease.linear) => lerp(from, to, e(clamp((t - a) / (b - a))));
  /** progress 0..1 of something that starts at `start` and lasts `dur` seconds */
  const prog = (t, start, dur, e = ease.linear) => e(clamp((t - start) / dur));
  /** deterministic random: const r = Motion.rng(7); r() -> 0..1 */
  function rng(seed) { let a = seed >>> 0; return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  const hex = (c, a = 1) => { if (c[0] !== "#") return c; const n = parseInt(c.length === 4 ? c.replace(/./g, (m, i) => (i ? m + m : m)).slice(1) : c.slice(1), 16); return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`; };
  const mix = (c1, c2, t) => { const p = (c) => { const n = parseInt(c.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }, a = p(c1), b = p(c2); return `rgb(${a.map((v, i) => Math.round(lerp(v, b[i], t))).join(",")})`; };

  /* ---------- drawing helpers (fx) ---------- */
  const fx = {
    roundRect(ctx, x, y, w, h, r) { r = Math.min(r, w / 2, h / 2); ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); },
    circle(ctx, x, y, r) { ctx.beginPath(); ctx.arc(x, y, Math.max(0, r), 0, TAU); },
    /** ring that draws itself: p 0..1 */
    ring(ctx, x, y, r, p, width = 8, color = "#fff") { ctx.save(); ctx.strokeStyle = color; ctx.lineWidth = width; ctx.lineCap = "round"; ctx.beginPath(); ctx.arc(x, y, r, -Math.PI / 2, -Math.PI / 2 + TAU * clamp(p)); ctx.stroke(); ctx.restore(); },
    /** line that draws itself from (x1,y1) to (x2,y2) */
    line(ctx, x1, y1, x2, y2, p, width = 6, color = "#fff") { ctx.save(); ctx.strokeStyle = color; ctx.lineWidth = width; ctx.lineCap = "round"; ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(lerp(x1, x2, clamp(p)), lerp(y1, y2, clamp(p))); ctx.stroke(); ctx.restore(); },
    /** stroke an arbitrary Path2D progressively using the dash trick (give its approximate length) */
    path(ctx, path2d, length, p, width = 6, color = "#fff") { ctx.save(); ctx.strokeStyle = color; ctx.lineWidth = width; ctx.lineCap = "round"; ctx.lineJoin = "round"; ctx.setLineDash([length, length]); ctx.lineDashOffset = length * (1 - clamp(p)); ctx.stroke(path2d); ctx.restore(); },
    gradient(ctx, x0, y0, x1, y1, stops) { const g = ctx.createLinearGradient(x0, y0, x1, y1); stops.forEach((c, i) => g.addColorStop(stops.length === 1 ? 0 : i / (stops.length - 1), c)); return g; },
    radial(ctx, x, y, r0, r1, stops) { const g = ctx.createRadialGradient(x, y, r0, x, y, r1); stops.forEach((c, i) => g.addColorStop(stops.length === 1 ? 0 : i / (stops.length - 1), c)); return g; },
    glow(ctx, color, blur = 30) { ctx.shadowColor = color; ctx.shadowBlur = blur; },
    noGlow(ctx) { ctx.shadowColor = "transparent"; ctx.shadowBlur = 0; },

    /** animated background. mode: 'mesh' (orbiting soft colour blobs) | 'gradient' | 'grid' | 'stars' | 'solid' */
    bg(ctx, w, h, t, { mode = "mesh", colors = ["#0b1020", "#3b2bd9", "#12b5cb", "#ff5fa2"], speed = 0.15 } = {}) {
      ctx.save();
      if (mode === "solid") { ctx.fillStyle = colors[0]; ctx.fillRect(0, 0, w, h); }
      else if (mode === "gradient") { const a = t * speed * TAU; ctx.fillStyle = fx.gradient(ctx, w / 2 + Math.cos(a) * w, h / 2 + Math.sin(a) * h, w / 2 - Math.cos(a) * w, h / 2 - Math.sin(a) * h, colors); ctx.fillRect(0, 0, w, h); }
      else {
        ctx.fillStyle = colors[0]; ctx.fillRect(0, 0, w, h);
        if (mode === "mesh") for (let i = 1; i < colors.length; i++) {
          const a = t * speed * TAU + i * 2.1, x = w * (0.5 + 0.38 * Math.cos(a * (0.7 + i * 0.13))), y = h * (0.5 + 0.38 * Math.sin(a * (0.9 + i * 0.1))), r = Math.max(w, h) * (0.45 + 0.08 * Math.sin(a));
          ctx.fillStyle = fx.radial(ctx, x, y, 0, r, [hex(colors[i], 0.75), hex(colors[i], 0)]); ctx.fillRect(0, 0, w, h);
        }
        if (mode === "grid") { ctx.strokeStyle = hex(colors[1] || "#fff", 0.18); ctx.lineWidth = 2; const s = Math.round(w / 24), o = (t * speed * 200) % s; ctx.beginPath(); for (let x = -s + o; x < w; x += s) { ctx.moveTo(x, 0); ctx.lineTo(x, h); } for (let y = -s + o; y < h; y += s) { ctx.moveTo(0, y); ctx.lineTo(w, y); } ctx.stroke(); }
        if (mode === "stars") { const r = rng(11); for (let i = 0; i < 160; i++) { const x = r() * w, y = (r() * h + t * (6 + r() * 30)) % h, tw = 0.5 + 0.5 * Math.sin(t * (1 + r() * 3) + i); ctx.fillStyle = `rgba(255,255,255,${0.15 + tw * 0.7})`; const s = 1 + r() * 2.4; ctx.fillRect(x, y, s, s); } }
      }
      ctx.restore();
    },

    /** Text with entrance animation. o: { font, size, weight, color, align, baseline, t (seconds since the text appears), dur, mode, unit, stagger, ease, rtl, maxWidth, lineHeight, shadow, stroke, glow }
        modes: 'fade' | 'rise' | 'mask' (slides up out of a clip) | 'scale' | 'blur' | 'type' | 'drop' | 'none' ; unit: 'char' | 'word' | 'line' (rtl/Arabic is forced to 'word'/'line' so letters keep joining) */
    text(ctx, str, x, y, o = {}) {
      const size = o.size || 64, rtl = !!o.rtl, mode = o.mode || "rise", t = o.t == null ? 99 : o.t, dur = o.dur || 0.7, ef = o.ease || ease.outCubic;
      const unit = rtl && o.unit === "char" ? "word" : o.unit || (mode === "type" ? "char" : "line"), lh = (o.lineHeight || 1.25) * size;
      ctx.save();
      ctx.font = `${o.weight || 700} ${size}px ${o.font || "system-ui, sans-serif"}`; ctx.textBaseline = o.baseline || "alphabetic"; ctx.direction = rtl ? "rtl" : "ltr";
      const align = o.align || "center"; ctx.textAlign = "left";
      // wrap into lines
      const words = String(str).split(/\s+/), lines = []; let cur = "";
      for (const wd of words) { const tryS = cur ? cur + " " + wd : wd; if (o.maxWidth && ctx.measureText(tryS).width > o.maxWidth && cur) { lines.push(cur); cur = wd; } else cur = tryS; }
      if (cur) lines.push(cur);
      // build units with positions
      const units = [];
      lines.forEach((ln, li) => {
        const lw = ctx.measureText(ln).width, lx = align === "center" ? x - lw / 2 : align === "right" ? x - lw : x, ly = y + li * lh - ((lines.length - 1) * lh) / 2 * (o.vcenter === false ? 0 : 1);
        if (unit === "line") units.push({ s: ln, x: lx, y: ly, li });
        else {
          const parts = unit === "word" ? ln.split(/(\s+)/) : [...ln]; let px = rtl ? lx + lw : lx;
          for (const p of parts) { const pw = ctx.measureText(p).width; if (rtl) px -= pw; if (p.trim() !== "" || unit === "char") units.push({ s: p, x: rtl ? px : px, y: ly, li, w: pw }); if (!rtl) px += pw; }
        }
      });
      const n = units.length, stagger = o.stagger == null ? (unit === "line" ? 0.12 : unit === "word" ? 0.09 : 0.035) : o.stagger;
      units.forEach((u, i) => {
        const start = (rtl ? n - 1 - i : i) * stagger, p = clamp((t - start) / dur), e = ef(p);
        if (p <= 0 && mode !== "none") return;
        ctx.save();
        let a = 1, dx = 0, dy = 0, sc = 1;
        if (mode === "fade") a = e; else if (mode === "rise") { a = e; dy = (1 - e) * size * 0.6; } else if (mode === "drop") { a = e; dy = -(1 - e) * size * 0.8; }
        else if (mode === "scale") { a = clamp(e * 1.4); sc = lerp(0.6, 1, e); } else if (mode === "blur") { a = e; ctx.filter = `blur(${((1 - e) * size * 0.25).toFixed(1)}px)`; }
        else if (mode === "mask") { ctx.beginPath(); ctx.rect(u.x - size, u.y - lh * 0.9, (u.w || 4000) + size * 2, lh * 1.15); ctx.clip(); dy = (1 - e) * lh; }
        else if (mode === "type") a = p > 0 ? 1 : 0;
        ctx.globalAlpha *= a; ctx.translate(u.x + dx + (u.w || 0) / 2, u.y + dy); ctx.scale(sc, sc); ctx.translate(-(u.w || 0) / 2, 0);
        if (o.glow) { ctx.shadowColor = o.glow; ctx.shadowBlur = size * 0.5; }
        else if (o.shadow) { ctx.shadowColor = "rgba(0,0,0,.45)"; ctx.shadowBlur = size * 0.2; ctx.shadowOffsetY = size * 0.06; }
        if (o.stroke) { ctx.lineWidth = o.strokeWidth || size * 0.06; ctx.strokeStyle = o.stroke; ctx.lineJoin = "round"; ctx.strokeText(u.s, 0, 0); }
        ctx.fillStyle = Array.isArray(o.color) ? fx.gradient(ctx, 0, -size, u.w || size * 6, 0, o.color) : o.color || "#fff";
        ctx.fillText(u.s, 0, 0); ctx.restore();
      });
      ctx.restore();
      return { lines: lines.length, height: lines.length * lh, duration: (n - 1) * stagger + dur };
    },

    /** count-up number: Motion.fx.counter(t, 0, 12500, 1.4, ease.outExpo, v => "$" + Math.round(v).toLocaleString()) */
    counter(t, from, to, dur = 1.2, e = ease.outExpo, fmt = (v) => Math.round(v).toString()) { return fmt(lerp(from, to, e(clamp(t / dur)))); },

    /** animated bar chart. o: {x,y,w,h,values,labels,t,dur,stagger,colors,font,size,gap,radius,max,showValues,rtl} — origin (x,y) is the top-left of the chart area */
    bars(ctx, o) {
      const { x, y, w, h, values, labels = [], t = 99, dur = 0.9, stagger = 0.12, colors = ["#7c9cff"], gap = 0.28, radius = 14, rtl = false } = o, max = o.max || Math.max(...values), n = values.length, bw = w / (n + (n + 1) * gap);
      ctx.save(); ctx.font = `600 ${o.size || 30}px ${o.font || "system-ui, sans-serif"}`; ctx.textAlign = "center";
      values.forEach((v, i0) => {
        const i = rtl ? n - 1 - i0 : i0, p = ease.outBack(clamp((t - i0 * stagger) / dur)), bh = (v / max) * h * p, bx = x + bw * gap + i * bw * (1 + gap);
        ctx.fillStyle = Array.isArray(colors) ? colors[i0 % colors.length] : colors; fx.roundRect(ctx, bx, y + h - bh, bw, Math.max(bh, 0.01), radius); ctx.fill();
        ctx.fillStyle = o.labelColor || "rgba(255,255,255,.85)"; if (labels[i0]) ctx.fillText(labels[i0], bx + bw / 2, y + h + (o.size || 30) * 1.4);
        if (o.showValues !== false && p > 0.2) { ctx.fillStyle = "#fff"; ctx.globalAlpha = clamp((p - 0.2) * 2); ctx.fillText(String(Math.round(v * clamp(p, 0, 1))), bx + bw / 2, y + h - bh - 14); ctx.globalAlpha = 1; }
      });
      ctx.restore();
    },
    /** donut chart: values array, draws itself with t. */
    donut(ctx, cx, cy, r, values, t, { colors = ["#7c9cff", "#ff5fa2", "#12b5cb", "#ffd166"], width = 46, dur = 1.1 } = {}) {
      const sum = values.reduce((a, b) => a + b, 0), p = ease.outCubic(clamp(t / dur)); let a0 = -Math.PI / 2;
      ctx.save(); ctx.lineWidth = width; ctx.lineCap = "butt";
      values.forEach((v, i) => { const a1 = a0 + (v / sum) * TAU * p; ctx.strokeStyle = colors[i % colors.length]; ctx.beginPath(); ctx.arc(cx, cy, r, a0, Math.max(a0, a1 - 0.02)); ctx.stroke(); a0 = a1; });
      ctx.restore();
    },
    /** line chart that draws itself */
    lineChart(ctx, o) {
      const { x, y, w, h, values, t = 99, dur = 1.4, color = "#7c9cff", width = 8, fill = true } = o, max = o.max || Math.max(...values), min = o.min == null ? 0 : o.min, n = values.length;
      const pts = values.map((v, i) => [x + (i / (n - 1)) * w, y + h - ((v - min) / (max - min)) * h]), p = ease.inOutCubic(clamp(t / dur));
      ctx.save(); ctx.beginPath(); ctx.rect(x - 20, y - 40, w * p + 40, h + 80); ctx.clip();
      ctx.beginPath(); pts.forEach((q, i) => (i ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1])));
      ctx.strokeStyle = color; ctx.lineWidth = width; ctx.lineJoin = "round"; ctx.lineCap = "round"; ctx.stroke();
      if (fill) { ctx.lineTo(x + w, y + h); ctx.lineTo(x, y + h); ctx.closePath(); ctx.fillStyle = fx.gradient(ctx, 0, y, 0, y + h, [hex(color, 0.35), hex(color, 0)]); ctx.fill(); }
      ctx.restore();
      const head = pts[Math.min(n - 1, Math.floor(p * (n - 1)))]; if (p < 1 && head) { ctx.save(); ctx.fillStyle = "#fff"; fx.circle(ctx, head[0], head[1], width * 1.1); ctx.fill(); ctx.restore(); }
    },

    /** deterministic particles. type: 'confetti' | 'dust' | 'sparks' | 'bubbles' | 'snow'. t = seconds since the burst/start */
    particles(ctx, { seed = 1, count = 80, t = 0, x = 0, y = 0, w = 0, h = 0, type = "dust", colors = ["#fff"], size = 6, gravity = 900, speed = 600, life = 2.2 } = {}) {
      const r = rng(seed); ctx.save();
      for (let i = 0; i < count; i++) {
        const a = r() * TAU, sp = (0.3 + r() * 0.7) * speed, c = colors[Math.floor(r() * colors.length)], s = size * (0.5 + r()), ph = r(), wob = r() * 6, delay = type === "confetti" || type === "sparks" ? 0 : r() * life, lt = (t - delay) % (life + 0.0001);
        if (t < delay) continue;
        let px, py, al = 1, rot = 0;
        if (type === "confetti" || type === "sparks") { const tt = t; px = x + Math.cos(a) * sp * tt * (type === "sparks" ? 1 : 0.6); py = y + Math.sin(a) * sp * tt + 0.5 * gravity * tt * tt * (type === "sparks" ? 0.15 : 0.35); al = clamp(1 - tt / life); rot = a * 3 + tt * (4 + wob); }
        else { const k = lt / life; px = x + r() * w + Math.sin(k * wob * 2 + ph * TAU) * 30; py = type === "bubbles" || type === "dust" ? y + h - k * h : y + k * h; al = Math.sin(k * Math.PI); rot = k * TAU * wob; }
        ctx.globalAlpha = clamp(al); ctx.fillStyle = c; ctx.save(); ctx.translate(px, py); ctx.rotate(rot);
        if (type === "confetti") ctx.fillRect(-s / 2, -s / 4, s, s / 2); else if (type === "bubbles") { ctx.strokeStyle = c; ctx.lineWidth = 2; fx.circle(ctx, 0, 0, s); ctx.stroke(); } else { fx.circle(ctx, 0, 0, s / 2); ctx.fill(); }
        ctx.restore();
      }
      ctx.restore();
    },

    /** simple device / window frames for app promos: kind 'phone' | 'browser' | 'card'; draw(ctx, w, h) paints the screen content */
    device(ctx, { kind = "phone", x, y, w, h, color = "#0f1220", screen = "#fff", radius, draw } = {}) {
      ctx.save(); ctx.translate(x, y); const r = radius || (kind === "phone" ? w * 0.13 : 24);
      ctx.shadowColor = "rgba(0,0,0,.45)"; ctx.shadowBlur = 60; ctx.shadowOffsetY = 24; ctx.fillStyle = color; fx.roundRect(ctx, 0, 0, w, h, r); ctx.fill(); ctx.shadowColor = "transparent";
      const pad = kind === "phone" ? w * 0.035 : 0, top = kind === "browser" ? 54 : pad;
      ctx.save(); fx.roundRect(ctx, pad, top, w - pad * 2, h - top - pad, Math.max(6, r - pad)); ctx.clip(); ctx.fillStyle = screen; ctx.fillRect(0, 0, w, h);
      if (draw) { ctx.translate(pad, top); draw(ctx, w - pad * 2, h - top - pad); } ctx.restore();
      if (kind === "phone") { ctx.fillStyle = color; fx.roundRect(ctx, w * 0.33, pad * 1.2, w * 0.34, w * 0.07, w * 0.035); ctx.fill(); }
      if (kind === "browser") ["#ff5f57", "#febc2e", "#28c840"].forEach((c, i) => { ctx.fillStyle = c; fx.circle(ctx, 28 + i * 26, 27, 8); ctx.fill(); });
      ctx.restore();
    },
  };

  /* ---------- camera ---------- */
  const cam = {
    /** call before drawing the world: zoom around the centre, pan (x,y in px), rotate (radians). Wrap with ctx.save()/restore(). */
    apply(ctx, w, h, { x = 0, y = 0, zoom = 1, rot = 0 } = {}) { ctx.translate(w / 2, h / 2); ctx.rotate(rot); ctx.scale(zoom, zoom); ctx.translate(-w / 2 - x, -h / 2 - y); },
    /** slow push-in / drift: returns {x,y,zoom} for local time t of a scene of length dur */
    drift(t, dur, from = { x: 0, y: 0, zoom: 1 }, to = { x: 0, y: 0, zoom: 1.12 }, e = ease.inOutSine) { const p = e(clamp(t / dur)); return { x: lerp(from.x, to.x, p), y: lerp(from.y, to.y, p), zoom: lerp(from.zoom, to.zoom, p) }; },
    /** deterministic shake offsets (decays over `decay` seconds after the hit at time 0) */
    shake(t, { amp = 18, freq = 28, decay = 0.6, seed = 3 } = {}) { const k = Math.max(0, 1 - t / decay), r = rng(seed + Math.floor(t * freq)); return { x: (r() - 0.5) * 2 * amp * k * k, y: (r() - 0.5) * 2 * amp * k * k }; },
  };

  /* ---------- audio: synthesised sound effects + a small procedural music bed (no files needed) ---------- */
  const NOTE = { C: 0, "C#": 1, D: 2, "D#": 3, E: 4, F: 5, "F#": 6, G: 7, "G#": 8, A: 9, "A#": 10, B: 11 };
  const midi = (n) => 440 * Math.pow(2, (n - 69) / 12);
  const audio = {
    /** schedule one event on an AudioContext. ev: {time, kind:'sfx'|'note', name, freq, dur, vol, type} ; when = context time of timeline 0 */
    play(ac, dest, ev, when) {
      const t0 = when + ev.time, vol = (ev.vol == null ? 0.5 : ev.vol);
      const env = (g, a, d, peak, end = 0.0001) => { g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(Math.max(peak, 0.0002), t0 + a); g.gain.exponentialRampToValueAtTime(end, t0 + a + d); };
      const osc = (type, f0, f1, dur) => { const o = ac.createOscillator(); o.type = type; o.frequency.setValueAtTime(f0, t0); if (f1) o.frequency.exponentialRampToValueAtTime(f1, t0 + dur); return o; };
      const noise = (dur) => { const b = ac.createBuffer(1, Math.ceil(ac.sampleRate * dur), ac.sampleRate), d = b.getChannelData(0), r = rng(5); for (let i = 0; i < d.length; i++) d[i] = r() * 2 - 1; const s = ac.createBufferSource(); s.buffer = b; return s; };
      const out = ac.createGain(); out.connect(dest);
      if (ev.kind === "note") { const o = osc(ev.type || "triangle", ev.freq), g = ac.createGain(); env(g, Math.min(0.08, ev.dur * 0.3), ev.dur, vol * 0.35); o.connect(g); g.connect(out); o.start(t0); o.stop(t0 + ev.dur + 0.3); return; }
      const n = ev.name;
      if (n === "whoosh") { const s = noise(0.9), f = ac.createBiquadFilter(), g = ac.createGain(); f.type = "bandpass"; f.Q.value = 0.8; f.frequency.setValueAtTime(300, t0); f.frequency.exponentialRampToValueAtTime(5200, t0 + 0.55); f.frequency.exponentialRampToValueAtTime(700, t0 + 0.9); env(g, 0.35, 0.5, vol * 0.7); s.connect(f); f.connect(g); g.connect(out); s.start(t0); }
      else if (n === "hit" || n === "boom") { const big = n === "boom", o = osc("sine", big ? 90 : 160, 38, big ? 0.8 : 0.35), g = ac.createGain(); env(g, 0.004, big ? 0.9 : 0.4, vol); o.connect(g); g.connect(out); o.start(t0); o.stop(t0 + 1.2); const s = noise(0.25), g2 = ac.createGain(); env(g2, 0.002, 0.2, vol * 0.4); s.connect(g2); g2.connect(out); s.start(t0); }
      else if (n === "pop") { const o = osc("sine", 520, 1100, 0.12), g = ac.createGain(); env(g, 0.004, 0.14, vol * 0.8); o.connect(g); g.connect(out); o.start(t0); o.stop(t0 + 0.3); }
      else if (n === "click" || n === "tick") { const o = osc("square", n === "tick" ? 1800 : 900, 400, 0.04), g = ac.createGain(); env(g, 0.001, 0.05, vol * 0.4); o.connect(g); g.connect(out); o.start(t0); o.stop(t0 + 0.1); }
      else if (n === "chime") { [0, 4, 7, 12].forEach((st, i) => { const o = osc("sine", midi((ev.note || 72) + st)), g = ac.createGain(), tt = t0 + i * 0.07; g.gain.setValueAtTime(0.0001, tt); g.gain.exponentialRampToValueAtTime(vol * 0.3, tt + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, tt + 1.4); o.connect(g); g.connect(out); o.start(tt); o.stop(tt + 1.5); }); }
      else if (n === "riser") { const d = ev.dur || 2, s = noise(d), f = ac.createBiquadFilter(), g = ac.createGain(); f.type = "highpass"; f.frequency.setValueAtTime(200, t0); f.frequency.exponentialRampToValueAtTime(7000, t0 + d); g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(vol * 0.5, t0 + d); g.gain.linearRampToValueAtTime(0.0001, t0 + d + 0.05); s.connect(f); f.connect(g); g.connect(out); s.start(t0); }
      else if (n === "kick") { const o = osc("sine", 150, 45, 0.18), g = ac.createGain(); env(g, 0.002, 0.22, vol); o.connect(g); g.connect(out); o.start(t0); o.stop(t0 + 0.4); }
      else if (n === "hat") { const s = noise(0.08), f = ac.createBiquadFilter(), g = ac.createGain(); f.type = "highpass"; f.frequency.value = 7000; env(g, 0.001, 0.06, vol * 0.25); s.connect(f); f.connect(g); g.connect(out); s.start(t0); }
      else if (n === "type") { const o = osc("square", 1200 + (ev.i || 0) % 5 * 90, 0, 0.02), g = ac.createGain(); env(g, 0.001, 0.025, vol * 0.18); o.connect(g); g.connect(out); o.start(t0); o.stop(t0 + 0.06); }
    },
    /** turn a music preset into note/sfx events: {bpm, bars, key:'A', mode:'minor'|'major', style:'ambient'|'upbeat'|'cinematic', vol} */
    musicEvents({ bpm = 100, bars = 8, key = "A", mode = "minor", style = "ambient", vol = 0.5, start = 0 } = {}) {
      const ev = [], beat = 60 / bpm, root = 57 + (NOTE[key] || 0) - 9 + 12 * 0, scale = mode === "major" ? [0, 2, 4, 5, 7, 9, 11] : [0, 2, 3, 5, 7, 8, 10];
      const prog = mode === "major" ? [0, 4, 5, 3] : [0, 5, 2, 6], deg = (d, o = 0) => root + scale[d % 7] + 12 * Math.floor(d / 7) + o;
      for (let b = 0; b < bars; b++) {
        const d = prog[b % prog.length], t0 = start + b * 4 * beat;
        [0, 2, 4].forEach((k) => ev.push({ time: t0, kind: "note", freq: midi(deg(d + k, 0)), dur: 4 * beat * 0.98, vol: vol * (style === "cinematic" ? 0.9 : 0.55), type: style === "cinematic" ? "sawtooth" : "triangle" }));
        ev.push({ time: t0, kind: "note", freq: midi(deg(d, -12)), dur: 4 * beat * 0.98, vol: vol * 0.8, type: "sine" });
        if (style !== "ambient") for (let i = 0; i < 4; i++) { ev.push({ time: t0 + i * beat, kind: "sfx", name: "kick", vol: vol * 0.7 }); ev.push({ time: t0 + i * beat + beat / 2, kind: "sfx", name: "hat", vol }); }
        if (style === "upbeat") for (let i = 0; i < 8; i++) ev.push({ time: t0 + i * beat / 2, kind: "note", freq: midi(deg(d + [0, 2, 4, 2][i % 4], 12)), dur: beat * 0.4, vol: vol * 0.45, type: "square" });
      }
      return ev;
    },
  };

  /* ---------- zip (store) + wav writers for exports ---------- */
  const crcTable = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
  const crc32 = (u8) => { let c = 0xffffffff; for (let i = 0; i < u8.length; i++) c = crcTable[(c ^ u8[i]) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
  function makeZip(files) {   // files: [{name, data:Uint8Array}] -> Blob (no compression: PNGs are already compressed)
    const parts = [], central = []; let offset = 0; const enc = new TextEncoder();
    for (const f of files) {
      const name = enc.encode(f.name), crc = crc32(f.data), head = new DataView(new ArrayBuffer(30));
      head.setUint32(0, 0x04034b50, true); head.setUint16(4, 20, true); head.setUint16(8, 0, true); head.setUint32(14, crc, true); head.setUint32(18, f.data.length, true); head.setUint32(22, f.data.length, true); head.setUint16(26, name.length, true);
      parts.push(head.buffer, name, f.data);
      const c = new DataView(new ArrayBuffer(46)); c.setUint32(0, 0x02014b50, true); c.setUint16(4, 20, true); c.setUint16(6, 20, true); c.setUint32(16, crc, true); c.setUint32(20, f.data.length, true); c.setUint32(24, f.data.length, true); c.setUint16(28, name.length, true); c.setUint32(42, offset, true);
      central.push(c.buffer, name); offset += 30 + name.length + f.data.length;
    }
    const csize = central.reduce((a, b) => a + (b.byteLength || b.length), 0), end = new DataView(new ArrayBuffer(22));
    end.setUint32(0, 0x06054b50, true); end.setUint16(8, files.length, true); end.setUint16(10, files.length, true); end.setUint32(12, csize, true); end.setUint32(16, offset, true);
    return new Blob([...parts, ...central, end.buffer], { type: "application/zip" });
  }
  function wavBlob(buf) {   // AudioBuffer -> 16-bit PCM WAV
    const ch = buf.numberOfChannels, len = buf.length, out = new DataView(new ArrayBuffer(44 + len * ch * 2)), w = (o, s) => { for (let i = 0; i < s.length; i++) out.setUint8(o + i, s.charCodeAt(i)); };
    w(0, "RIFF"); out.setUint32(4, 36 + len * ch * 2, true); w(8, "WAVEfmt "); out.setUint32(16, 16, true); out.setUint16(20, 1, true); out.setUint16(22, ch, true); out.setUint32(24, buf.sampleRate, true); out.setUint32(28, buf.sampleRate * ch * 2, true); out.setUint16(32, ch * 2, true); out.setUint16(34, 16, true); w(36, "data"); out.setUint32(40, len * ch * 2, true);
    const data = []; for (let c = 0; c < ch; c++) data.push(buf.getChannelData(c)); let o = 44;
    for (let i = 0; i < len; i++) for (let c = 0; c < ch; c++) { const s = Math.max(-1, Math.min(1, data[c][i])); out.setInt16(o, s < 0 ? s * 0x8000 : s * 0x7fff, true); o += 2; }
    return new Blob([out.buffer], { type: "audio/wav" });
  }
  const download = (blob, name) => { const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 4000); };

  /* ---------- the timeline ---------- */
  /** Motion.create({ canvas, width, height, fps, duration, background }) */
  function create(cfg) {
    const canvas = cfg.canvas, ctx = canvas.getContext("2d"), M = { cfg, canvas, ctx, width: cfg.width || 1920, height: cfg.height || 1080, fps: cfg.fps || 30, duration: cfg.duration || 10, time: 0, playing: false, scenes: [], events: [], listeners: [] };
    canvas.width = M.width; canvas.height = M.height;
    M.on = (fn) => M.listeners.push(fn);
    const emit = () => M.listeners.forEach((fn) => fn(M));

    /** Add a scene visible from `start` to `end` (seconds). draw(ctx, s) with s = { t: local seconds, p: 0..1, dur, T: global seconds, w, h, M }.
        opts: { in: 'fade'|'slide'|'zoom'|'wipe'|'none', out: same, inDur: 0.5, outDur: 0.4, name, layer } — scenes may overlap to cross-fade. */
    M.scene = (start, end, draw, opts = {}) => { M.scenes.push({ start, end, draw, opts: { in: "none", out: "none", inDur: 0.5, outDur: 0.4, layer: 0, ...opts } }); M.scenes.sort((a, b) => a.opts.layer - b.opts.layer || a.start - b.start); return M; };
    /** Add a sound effect at time t: 'whoosh' | 'hit' | 'boom' | 'pop' | 'click' | 'tick' | 'chime' | 'riser' | 'kick' | 'hat' | 'type' */
    M.sfx = (time, name, o = {}) => { M.events.push({ time, kind: "sfx", name, ...o }); return M; };
    /** Music bed: M.music({ bpm: 96, bars: 8, key: 'A', mode: 'minor', style: 'ambient'|'upbeat'|'cinematic', vol: .5 }) */
    M.music = (o) => { M.events.push(...audio.musicEvents(o)); return M; };

    function transitionFx(kind, p, w, h, dir) {   // p: 0 = fully hidden, 1 = fully shown
      const e = ease.outCubic(p);
      if (kind === "fade") ctx.globalAlpha *= e;
      else if (kind === "slide") ctx.translate((1 - e) * w * 0.25 * dir, 0), ctx.globalAlpha *= clamp(e * 1.6);
      else if (kind === "zoom") { ctx.translate(w / 2, h / 2); ctx.scale(lerp(dir > 0 ? 0.85 : 1.15, 1, e), lerp(dir > 0 ? 0.85 : 1.15, 1, e)); ctx.translate(-w / 2, -h / 2); ctx.globalAlpha *= e; }
      else if (kind === "wipe") { ctx.beginPath(); ctx.rect(dir > 0 ? 0 : w * (1 - e), 0, w * e, h); ctx.clip(); }
    }
    /** draw the whole video at time t (seconds). Pure: calling it twice with the same t gives the same pixels. */
    M.renderFrame = (t) => {
      ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 1; ctx.fillStyle = cfg.background || "#000"; ctx.fillRect(0, 0, M.width, M.height); ctx.restore();
      for (const s of M.scenes) {
        if (t < s.start || t > s.end) continue;
        const lt = t - s.start, dur = s.end - s.start, o = s.opts;
        ctx.save();
        if (o.in !== "none" && lt < o.inDur) transitionFx(o.in, clamp(lt / o.inDur), M.width, M.height, 1);
        if (o.out !== "none" && t > s.end - o.outDur) transitionFx(o.out, clamp((s.end - t) / o.outDur), M.width, M.height, -1);
        s.draw(ctx, { t: lt, p: clamp(lt / dur), dur, T: t, w: M.width, h: M.height, M });
        ctx.restore();
      }
    };
    M.seek = (t) => { M.time = clamp(t, 0, M.duration); M.renderFrame(M.time); emit(); return M.time; };

    /* audio engine */
    let actx = null, live = [], master = null;
    const ensureAudio = () => { if (!actx) { const AC = global.AudioContext || global.webkitAudioContext; if (AC) { actx = new AC(); master = actx.createGain(); master.connect(actx.destination); } } if (actx && actx.state === "suspended") actx.resume(); return actx; };
    function scheduleAudio(ac, dest, from) { const when = ac.currentTime + 0.05 - from; for (const ev of M.events) if (ev.time >= from - 0.001) audio.play(ac, dest, ev, when); }
    let raf = 0, t0 = 0, base = 0;
    const tick = () => { if (!M.playing) return; M.time = Math.min(M.duration, base + (performance.now() - t0) / 1000); M.renderFrame(M.time); emit(); if (M.time >= M.duration) { M.pause(); return; } raf = requestAnimationFrame(tick); };
    M.play = ({ sound = true } = {}) => { if (M.playing) return; if (M.time >= M.duration - 0.01) M.time = 0; M.playing = true; base = M.time; t0 = performance.now(); if (sound && ensureAudio()) { master.gain.value = 1; scheduleAudio(actx, master, M.time); } raf = requestAnimationFrame(tick); emit(); };
    M.pause = () => { M.playing = false; cancelAnimationFrame(raf); if (actx) { try { master.disconnect(); } catch (e) {} master = actx.createGain(); master.connect(actx.destination); } emit(); };
    M.toggle = () => (M.playing ? M.pause() : M.play());

    /** Real-time capture of canvas + sound into a WebM Blob (what the page's Export button uses). */
    M.exportWebM = ({ fps = M.fps, bitrate = 14e6, sound = true } = {}) => new Promise((resolve, reject) => {
      M.pause(); const stream = canvas.captureStream(fps); let dest = null, ac = null;
      if (sound && M.events.length && (ac = ensureAudio())) { dest = ac.createMediaStreamDestination(); stream.addTrack(dest.stream.getAudioTracks()[0]); }
      const type = ["video/webm;codecs=vp9,opus", "video/webm;codecs=vp8,opus", "video/webm"].find((m) => global.MediaRecorder && MediaRecorder.isTypeSupported(m));
      if (!type) return reject(new Error("MediaRecorder WebM is not supported in this browser"));
      const rec = new MediaRecorder(stream, { mimeType: type, videoBitsPerSecond: bitrate }), chunks = [];
      rec.ondataavailable = (e) => e.data.size && chunks.push(e.data); rec.onstop = () => resolve(new Blob(chunks, { type: "video/webm" })); rec.onerror = (e) => reject(e.error || e);
      M.time = 0; M.renderFrame(0); rec.start(250); if (dest) scheduleAudio(ac, dest, 0);
      const start = performance.now(); M.playing = true;
      const step = () => { const el = (performance.now() - start) / 1000, t = Math.min(M.duration, el); M.time = t; M.renderFrame(t); emit(); if (el < M.duration + 0.25) requestAnimationFrame(step); else { M.playing = false; rec.stop(); } };   // +0.25 s tail so the last frame is captured
      requestAnimationFrame(step);
    });
    /** Frame-exact export: every frame i/fps inside one .zip. format 'jpeg' (default, ~250 KB/frame) or 'png' (lossless but ~2.5 MB/frame at 1080p — only for short videos).
        Feed it to ffmpeg: ffmpeg -framerate 30 -i frame_%05d.jpg -c:v libx264 -pix_fmt yuv420p out.mp4.  onProgress(i, n) */
    M.exportFrames = async ({ fps = M.fps, format = "jpeg", quality = 0.93, onProgress } = {}) => {
      M.pause(); const n = Math.round(M.duration * fps), files = [], ext = format === "png" ? "png" : "jpg";
      for (let i = 0; i < n; i++) {
        M.renderFrame(i / fps); const blob = await new Promise((r) => canvas.toBlob(r, format === "png" ? "image/png" : "image/jpeg", quality)); files.push({ name: `frame_${String(i).padStart(5, "0")}.${ext}`, data: new Uint8Array(await blob.arrayBuffer()) });
        if (onProgress && i % 5 === 0) { onProgress(i, n); await new Promise((r) => setTimeout(r)); }
      }
      return makeZip(files);
    };
    /** Offline-render the whole soundtrack to a WAV Blob (used by render.mjs to mux audio with ffmpeg). */
    M.renderAudio = async () => { const OAC = global.OfflineAudioContext; if (!OAC || !M.events.length) return null; const rate = 44100, ac = new OAC(2, Math.ceil((M.duration + 1.5) * rate), rate); scheduleAudio(ac, ac.destination, 0); return wavBlob(await ac.startRendering()); };
    M.download = download;
    return M;
  }

  global.Motion = { create, ease, map, prog, lerp, clamp, rng, hex, mix, fx, cam, audio, TAU, makeZip, download };
})(typeof window !== "undefined" ? window : globalThis);
