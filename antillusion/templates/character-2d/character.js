/* Character2D — a rigged vector character drawn on canvas: bone hierarchy, tapered organic shapes, cel shading + outlines,
   a face rig (blinks, gaze, brows, expressions, lip-sync visemes), secondary motion (springs) and an animation system
   with clips (idle, walk, run, jump, wave, punch) and cross-fades. No dependencies. Classic script → window.Character2D.

   const hero = Character2D.create({ palette: Character2D.PALETTES.explorer, scale: 1 });
   hero.play("walk");                      // cross-fades (0.25 s by default)
   hero.expression("happy"); hero.say("Hello there");   // lip-sync from text
   hero.lookAt(x, y);  hero.facing = -1;   // turn left
   every frame: hero.update(dt); hero.draw(ctx, x, groundY);
   hero.spriteSheet("walk", 12, 256) → { canvas, frames } for game engines.

   Add a clip: Character2D.CLIPS.myClip = { period: 1, loop: true, smooth: true, tracks: { thighF: [...8 values], ... } }
   (smooth: evenly spaced values, periodic Catmull-Rom) or { period, keys: true, tracks: { armF: [[t, deg, ease], ...] } }.
   Angles are degrees. Limbs point down (+y) at 0: negative = swing forward, positive = backward. Torso: positive leans forward.
   Shin: positive bends the knee. Forearm: negative bends the elbow forward. */
(function (root) {
  "use strict";
  const D = Math.PI / 180, clamp = (v, a, b) => Math.max(a, Math.min(b, v)), lerp = (a, b, t) => a + (b - a) * t;
  const ease = { l: (t) => t, io: (t) => t * t * (3 - 2 * t), o: (t) => 1 - (1 - t) ** 3, i: (t) => t * t * t, back: (t) => { const c = 1.7; return 1 + (c + 1) * (t - 1) ** 3 + c * (t - 1) ** 2; } };

  /* ---------- colour helpers: shades are derived, never hand-picked per part ---------- */
  const hex = (h) => { h = h.replace("#", ""); if (h.length === 3) h = [...h].map((c) => c + c).join(""); const n = parseInt(h, 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
  const css = ([r, g, b], a = 1) => `rgba(${r | 0},${g | 0},${b | 0},${a})`;
  // shadow = darker, slightly cooler and more saturated (hue-shifted), highlight = lighter and warmer
  const shade = (c, k) => { const [r, g, b] = hex(c); return css([r * (1 - k) + 18 * k * 0.4, g * (1 - k * 1.05), b * (1 - k * 0.75) + 30 * k]); };
  const light = (c, k) => { const [r, g, b] = hex(c); return css([r + (255 - r) * k, g + (250 - g) * k * 0.95, b + (235 - b) * k * 0.8]); };
  const tint = (c, k) => { const [r, g, b] = hex(c); return "#" + [r, g, b].map((v) => Math.round(v * k).toString(16).padStart(2, "0")).join(""); };

  const PALETTES = {
    explorer: { skin: "#e8b58f", hair: "#3a2a22", eyes: "#3b6f8f", top: "#2f6f62", top2: "#e9e2d0", pants: "#36404f", shoes: "#5a3a2a", accent: "#e0a43a", outline: "#1d1a1c" },
    nomad:    { skin: "#b9774d", hair: "#17130f", eyes: "#4a3424", top: "#c9a15b", top2: "#efe6d2", pants: "#4b3b2f", shoes: "#2c2622", accent: "#b6452c", outline: "#1b1512" },
    pilot:    { skin: "#f2cfb4", hair: "#c88a3c", eyes: "#2f6d4f", top: "#33465f", top2: "#d9dee6", pants: "#2a2f38", shoes: "#1f2228", accent: "#e46b2e", outline: "#15171c" },
    ranger:   { skin: "#7a4a2f", hair: "#0f0d0c", eyes: "#2b1d14", top: "#4f6b3a", top2: "#d8d2b8", pants: "#3b3a32", shoes: "#3a2b1f", accent: "#d9b44a", outline: "#141210" },
  };

  /* ---------- skeleton (rest offsets in the parent's frame) ---------- */
  const BONES = [
    ["root", null, 0, 0], ["torso", "root", 0, 0], ["neck", "torso", 3, -90], ["head", "neck", 0, -12],
    ["armB", "torso", -5, -80], ["foreB", "armB", 0, 58], ["handB", "foreB", 0, 52],
    ["armF", "torso", 7, -80], ["foreF", "armF", 0, 58], ["handF", "foreF", 0, 52],
    ["legB", "root", -9, 0], ["shinB", "legB", 0, 78], ["footB", "shinB", 0, 74],
    ["legF", "root", 9, 0], ["shinF", "legF", 0, 78], ["footF", "shinF", 0, 74],
    ["scarf1", "neck", -10, -2], ["scarf2", "scarf1", 0, 22], ["scarf3", "scarf2", 0, 20],
  ];
  const LEG_LEN = 78 + 74 + 13;   // hip to sole

  /* ---------- clips ---------- */
  const CLIPS = {
    idle: { period: 3.2, loop: true, fn: (t) => { const s = Math.sin(t * 2 * Math.PI), s2 = Math.sin(t * 2 * Math.PI + 1.2);
      return { rootY: 1.4 * s, torso: 1.2 + 0.8 * s2, head: -1 + 1.5 * Math.sin(t * 2 * Math.PI - 0.6), armF: 4 + 2 * s2, foreF: -10 - 2 * s, armB: -2 - 2 * s2, foreB: -12 - 2 * s, legF: -4, shinF: 3, legB: 5, shinB: 4 }; } },
    walk: { period: 1.0, loop: true, smooth: true, speed: 150, tracks: {
      thighA: [-24, -14, 0, 12, 22, 20, -12, -28], shinA: [4, 14, 6, 4, 10, 34, 62, 22], footA: [-15, 0, 0, 0, 25, 20, 0, -8] },
      fn: (t, tr) => { const a = tr("thighA", t), b = tr("thighA", t + 0.5), sa = tr("shinA", t), sb = tr("shinA", t + 0.5), arm = (x) => tr("thighA", x - 0.04);
        return { rootY: 4.5 * Math.cos(4 * Math.PI * (t - 0.125)), torso: 4 + 1.5 * Math.cos(4 * Math.PI * (t - 0.2)), head: -3 - 1.5 * Math.cos(4 * Math.PI * (t - 0.25)),
          legF: a, shinF: sa, footF: -(a + sa) + tr("footA", t), legB: b, shinB: sb, footB: -(b + sb) + tr("footA", t + 0.5),
          armF: 0.8 * arm(t + 0.5), foreF: -14 - Math.max(0, -arm(t + 0.5)) * 0.7, armB: 0.8 * arm(t), foreB: -14 - Math.max(0, -arm(t)) * 0.7 }; } },
    run: { period: 0.66, loop: true, smooth: true, speed: 390, tracks: {
      thighA: [-30, -12, 10, 36, 30, 0, -40, -46], shinA: [12, 30, 20, 10, 70, 115, 80, 30], footA: [-10, 0, 0, 25, 30, 10, -5, -15] },
      fn: (t, tr) => { const a = tr("thighA", t), b = tr("thighA", t + 0.5), sa = tr("shinA", t), sb = tr("shinA", t + 0.5), sw = (x) => tr("thighA", x - 0.05);
        return { rootY: 7 * Math.cos(4 * Math.PI * (t - 0.125)) - 4, torso: 11 + 2 * Math.cos(4 * Math.PI * (t - 0.2)), head: -8,
          legF: a, shinF: sa, footF: -(a + sa) * 0.6 + tr("footA", t), legB: b, shinB: sb, footB: -(b + sb) * 0.6 + tr("footA", t + 0.5),
          armF: 1.05 * sw(t + 0.5), foreF: -88 + 0.25 * sw(t + 0.5), armB: 1.05 * sw(t), foreB: -88 + 0.25 * sw(t) }; } },
    jump: { period: 1.4, loop: true, keys: true, tracks: {   // anticipation → stretch → tuck at apex → reach → squash on landing → settle
      rootY:  [[0, 0], [0.16, 30, "io"], [0.24, -40, "o"], [0.48, -150, "o"], [0.7, -50, "i"], [0.76, 26, "i"], [0.9, -2, "o"], [1, 0, "io"]],
      sx:     [[0, 1], [0.16, 1.08, "io"], [0.24, 0.9, "o"], [0.36, 1, "io"], [0.72, 0.97], [0.76, 1.12, "i"], [0.88, 1, "back"], [1, 1]],
      torso:  [[0, 2], [0.16, 20, "io"], [0.24, -4, "o"], [0.48, 6], [0.7, 2], [0.76, 18, "i"], [0.9, 3, "o"], [1, 2]],
      head:   [[0, 0], [0.16, -14], [0.24, 6, "o"], [0.48, 0], [0.76, -12, "i"], [0.92, 2], [1, 0]],
      legF:   [[0, -4], [0.16, -42, "io"], [0.24, 6, "o"], [0.48, -55, "io"], [0.7, -18], [0.76, -36, "i"], [0.9, -6, "o"], [1, -4]],
      shinF:  [[0, 3], [0.16, 82, "io"], [0.24, 4, "o"], [0.48, 95, "io"], [0.7, 22], [0.76, 74, "i"], [0.9, 8, "o"], [1, 3]],
      legB:   [[0, 5], [0.16, -36, "io"], [0.24, 12, "o"], [0.48, -30, "io"], [0.7, -4], [0.76, -30, "i"], [0.9, 2, "o"], [1, 5]],
      shinB:  [[0, 4], [0.16, 76, "io"], [0.24, 8, "o"], [0.48, 70, "io"], [0.7, 18], [0.76, 68, "i"], [0.9, 6, "o"], [1, 4]],
      armF:   [[0, 4], [0.16, 38, "io"], [0.26, -150, "o"], [0.48, -120], [0.7, -70], [0.76, 20, "i"], [0.92, 6, "o"], [1, 4]],
      foreF:  [[0, -10], [0.16, -20], [0.26, -20, "o"], [0.48, -60], [0.7, -30], [0.76, -40], [1, -10]],
      armB:   [[0, -2], [0.16, 44, "io"], [0.26, -140, "o"], [0.48, -100], [0.7, -50], [0.76, 26, "i"], [0.92, 0, "o"], [1, -2]],
      foreB:  [[0, -12], [0.16, -20], [0.26, -24, "o"], [0.48, -50], [0.76, -30], [1, -12]] },
      post: (p) => { p.footF = -(p.legF + p.shinF) + (p.rootY < -20 ? 22 : 0); p.footB = -(p.legB + p.shinB) + (p.rootY < -20 ? 22 : 0); p.sy = 2 - p.sx; } },
    wave: { period: 1.3, loop: true, fn: (t) => { const w = Math.sin(t * 4 * Math.PI);
      return { rootY: 1.2 * Math.sin(t * 2 * Math.PI), torso: -2, head: 6 + 2 * w, armF: -128, foreF: -40 + 26 * w, handOpen: 1, armB: 6, foreB: -14, legF: -5, shinF: 3, legB: 6, shinB: 4, face: { expr: "happy" } }; } },
    punch: { period: 1.0, loop: true, keys: true, tracks: {   // guard → wind-up (anticipation) → snap (2 frames) → hold → recover
      armF:  [[0, -55], [0.3, 28, "io"], [0.36, -86, "o"], [0.5, -86], [0.85, -55, "io"], [1, -55]],
      foreF: [[0, -105], [0.3, -125, "io"], [0.36, -4, "o"], [0.5, -4], [0.85, -105, "io"], [1, -105]],
      armB:  [[0, -40], [0.3, -50], [0.36, 22, "o"], [0.5, 22], [0.85, -40, "io"], [1, -40]],
      foreB: [[0, -110], [0.36, -120, "o"], [1, -110]],
      torso: [[0, 6], [0.3, -10, "io"], [0.36, 18, "o"], [0.5, 16], [0.85, 6, "io"], [1, 6]],
      rootX: [[0, 0], [0.3, -10, "io"], [0.36, 16, "o"], [0.5, 14], [0.85, 0, "io"], [1, 0]],
      rootY: [[0, 6], [0.3, 9], [0.36, 4, "o"], [0.85, 6], [1, 6]],
      head:  [[0, 4], [0.3, 10], [0.36, -6, "o"], [0.85, 4], [1, 4]],
      legF: [[0, -22]], shinF: [[0, 26]], legB: [[0, 16]], shinB: [[0, 14]] },
      post: (p) => { p.footF = -(p.legF + p.shinF); p.footB = -(p.legB + p.shinB); p.fist = 1; p.face = { expr: "angry" }; } },
  };

  function sampleTrack(clip, name, t) {   // t in cycles (0..1, wraps when looping)
    const k = clip.tracks[name]; if (!k) return 0;
    if (clip.smooth) {   // evenly spaced values, periodic Catmull-Rom
      const n = k.length, x = (((t % 1) + 1) % 1) * n, i = Math.floor(x), f = x - i, p = (j) => k[((i + j) % n + n) % n];
      const a = p(-1), b = p(0), c = p(1), d = p(2);
      return 0.5 * (2 * b + (-a + c) * f + (2 * a - 5 * b + 4 * c - d) * f * f + (-a + 3 * b - 3 * c + d) * f * f * f);
    }
    if (k.length === 1) return k[0][1];
    const u = clip.loop ? ((t % 1) + 1) % 1 : clamp(t, 0, 1);
    for (let i = 1; i < k.length; i++) if (u <= k[i][0]) { const [t0, v0] = k[i - 1], [t1, v1, e] = k[i]; return lerp(v0, v1, (ease[e] || ease.io)((u - t0) / (t1 - t0 || 1))); }
    return k[k.length - 1][1];
  }
  function samplePose(clip, time) {
    const t = time / clip.period, tr = (n, x) => sampleTrack(clip, n, x);
    let p = {};
    if (clip.keys) for (const n in clip.tracks) p[n] = tr(n, t);
    if (clip.fn) Object.assign(p, clip.fn(clip.smooth || clip.keys ? t : ((t % 1) + 1) % 1, tr));
    p = { rootX: 0, rootY: 0, sx: 1, sy: 1, torso: 0, head: 0, armF: 0, foreF: -10, armB: 0, foreB: -10, legF: 0, shinF: 0, legB: 0, shinB: 0, handOpen: 0, fist: 0, ...p };
    if (p.footF === undefined) p.footF = -(p.legF + p.shinF);
    if (p.footB === undefined) p.footB = -(p.legB + p.shinB);
    if (clip.post) clip.post(p);
    return p;
  }
  const blendPose = (a, b, w) => { const o = { ...b }; for (const k in b) if (typeof b[k] === "number" && typeof a[k] === "number") o[k] = lerp(a[k], b[k], w); o.face = w < 0.5 ? a.face : b.face; return o; };

  /* ---------- face ---------- */
  const EXPR = {   // brow: [inner y, outer y, angle] · lid: [top close 0..1, angle deg] · low: lower lid raise · mouth
    neutral:   { brow: [0, 0, 0], lid: [0.12, 0], low: 0, mouth: "rest", pupil: 1 },
    happy:     { brow: [-3, -2, -4], lid: [0.05, 0], low: 0.42, mouth: "smile", pupil: 1.05 },
    sad:       { brow: [-6, 3, 16], lid: [0.38, -10], low: 0.05, mouth: "frown", pupil: 1 },
    angry:     { brow: [6, -3, -22], lid: [0.34, 14], low: 0.18, mouth: "grit", pupil: 0.85 },
    surprised: { brow: [-9, -8, 2], lid: [0, 0], low: 0, mouth: "O", pupil: 0.8 },
    determined:{ brow: [4, 0, -12], lid: [0.3, 6], low: 0.12, mouth: "set", pupil: 0.95 },
  };
  // text → visemes (Preston Blair groups)
  const VIS = (ch) => /[aàáâäå]/i.test(ch) ? "A" : /[eéèi]/i.test(ch) ? "E" : /[o]/i.test(ch) ? "O" : /[uwq]/i.test(ch) ? "U" : /[mbp]/i.test(ch) ? "M" : /[fv]/i.test(ch) ? "F" : /[lnt d]/i.test(ch) && ch !== " " ? "L" : /[\s.,!?]/.test(ch) ? "rest" : /[اآى]/.test(ch) ? "A" : /[ي]/.test(ch) ? "E" : /[و]/.test(ch) ? "O" : /[مب]/.test(ch) ? "M" : /[ف]/.test(ch) ? "F" : /[ء-ي]/.test(ch) ? "L" : "E";

  function create(opts = {}) {
    const C = { palette: PALETTES.explorer, scale: 1, outline: 3.2, shadow: 0.24, ...opts };
    const P = () => C.palette;
    const self = {
      clip: "idle", time: 0, facing: 1, from: null, fromTime: 0, fade: 1, fadeDur: 0.25, pose: null,
      face: { expr: "neutral", blink: 0, nextBlink: 2, look: { x: 1, y: 0 }, viseme: null, speech: [], speechT: 0 },
      springs: { scarf: [0, 0, 0].map(() => ({ a: 20, w: 0 })), hair: [0, 0, 0].map(() => ({ a: 0, w: 0 })) }, lastNeck: null, vel: { x: 0, y: 0 },
      world: {},
    };
    self.play = (name, fade = 0.25) => { if (!CLIPS[name] || name === self.clip) return; self.from = self.clip; self.fromTime = self.time; self.clip = name; self.time = 0; self.fade = 0; self.fadeDur = fade; };
    self.expression = (e) => { if (EXPR[e]) self.face.expr = e; };
    self.say = (text) => { const out = []; for (const ch of String(text)) { const v = VIS(ch); out.push([v, /[aeiouyاوي]/i.test(ch) ? 0.11 : v === "rest" ? 0.12 : 0.07]); } out.push(["rest", 0.2]); self.face.speech = out; self.face.speechT = 0; };
    self.lookAt = (x, y) => { self.face.lookTarget = { x, y }; };
    self.speed = () => (CLIPS[self.clip].speed || 0) * C.scale;

    self.update = (dt) => {
      self.time += dt; if (self.from) self.fromTime += dt;
      self.fade = Math.min(1, self.fade + dt / self.fadeDur);
      const cur = samplePose(CLIPS[self.clip], self.time);
      self.pose = self.from && self.fade < 1 ? blendPose(samplePose(CLIPS[self.from], self.fromTime), cur, ease.io(self.fade)) : cur;
      if (self.fade >= 1) self.from = null;
      // blinks: every 2–5 s, sometimes a double blink
      const f = self.face; f.nextBlink -= dt;
      if (f.nextBlink <= 0) { f.blinkT = 0; f.nextBlink = 2 + Math.random() * 3; if (Math.random() < 0.2) f.double = true; }
      if (f.blinkT !== undefined) { f.blinkT += dt; const b = f.blinkT / 0.14; f.blink = b < 0.5 ? b * 2 : b < 1 ? 2 - b * 2 : 0; if (b >= 1) { if (f.double) { f.double = false; f.blinkT = -0.06; } else f.blinkT = undefined; } }
      if (f.speech.length) { f.speechT += dt; let acc = 0; f.viseme = null; for (const [v, d] of f.speech) { acc += d; if (f.speechT < acc) { f.viseme = v; break; } } if (!f.viseme) { f.speech = []; f.viseme = null; } }
      // secondary motion: springs driven by how the neck moves through the world
      const n = self.world.neck; if (n) {
        const nx = n.e, ny = n.f;
        if (self.lastNeck) { self.vel.x = lerp(self.vel.x, (nx - self.lastNeck.x) / Math.max(dt, 1e-3) / C.scale + self.speed() * self.facing / C.scale, 0.3); self.vel.y = lerp(self.vel.y, (ny - self.lastNeck.y) / Math.max(dt, 1e-3) / C.scale, 0.3); }
        self.lastNeck = { x: nx, y: ny };
        const drag = clamp(self.vel.x * self.facing * 0.11, -20, 75), lift = clamp(self.vel.y * 0.05, -30, 30);
        self.springs.scarf.forEach((s, i) => { const target = 14 + drag * (0.7 + i * 0.25) - lift + Math.sin(self.time * 7 + i) * Math.min(10, Math.abs(drag) * 0.12); s.w += ((target - s.a) * 90 - s.w * 9) * dt; s.a += s.w * dt; });
        self.springs.hair.forEach((s, i) => { const target = drag * 0.18 - lift * 0.4; s.w += ((target - s.a) * 260 - s.w * 14) * dt; s.a += s.w * dt; });
      }
    };

    /* ---------- drawing ---------- */
    function computeWorld(x, y) {
      const p = self.pose, W = {};
      const base = new DOMMatrix().translate(x, y - LEG_LEN * C.scale).scale(C.scale * self.facing, C.scale).translate(p.rootX, p.rootY).translate(0, LEG_LEN).scale(p.sx, p.sy).translate(0, -LEG_LEN);
      const ang = { root: 0, torso: p.torso, neck: p.head * 0.4, head: p.head * 0.6, armF: p.armF - p.torso * 0.6, foreF: p.foreF, handF: p.fist ? -10 : 8, armB: p.armB - p.torso * 0.6, foreB: p.foreB, handB: 8,
        legF: p.legF, shinF: p.shinF, footF: p.footF, legB: p.legB, shinB: p.shinB, footB: p.footB,
        scarf1: self.springs.scarf[0].a - p.torso - p.head * 0.4, scarf2: self.springs.scarf[1].a - self.springs.scarf[0].a, scarf3: self.springs.scarf[2].a - self.springs.scarf[1].a };
      const rot = {};
      for (const [name, parent, ox, oy] of BONES) {
        const pm = parent ? W[parent] : base;
        W[name] = pm.translate(ox, oy).rotate(ang[name] || 0);
        rot[name] = (parent ? rot[parent] : 0) + (ang[name] || 0);
      }
      self.world = W; self.rot = rot;
      return W;
    }
    // fill + cel shadow on the side away from the light + outline, all in the part's local frame
    function part(ctx, M, rotDeg, path, color, opts = {}) {
      ctx.setTransform(M); path(ctx);
      ctx.fillStyle = color; ctx.fill();
      if (opts.shade !== false) {
        ctx.save(); ctx.clip();
        const a = (-rotDeg * self.facing) * D, lx = 7, ly = -4;   // light from the upper front, expressed in local space
        const dx = (lx * Math.cos(a) - ly * Math.sin(a)) * self.facing, dy = lx * Math.sin(a) + ly * Math.cos(a);
        ctx.fillStyle = shade(opts.base || color, C.shadow); ctx.fillRect(-400, -400, 800, 800);
        ctx.translate(dx * (opts.depth || 1), dy * (opts.depth || 1)); path(ctx); ctx.fillStyle = color; ctx.fill();
        ctx.restore();
      }
      if (opts.outline !== false) { ctx.setTransform(M); path(ctx); ctx.lineWidth = (opts.lw || C.outline); ctx.lineJoin = "round"; ctx.strokeStyle = P().outline; ctx.stroke(); }
    }
    const limb = (len, w0, w1, bulge = 2) => (c) => {   // tapered limb with a slight muscle curve; overlaps its joints to hide seams
      c.beginPath(); c.moveTo(-w0 / 2, 0);
      c.bezierCurveTo(-w0 / 2 - bulge, len * 0.35, -w1 / 2 - bulge * 0.3, len * 0.72, -w1 / 2, len);
      c.arc(0, len, w1 / 2, Math.PI, 0, true);
      c.bezierCurveTo(w1 / 2 + bulge * 0.2, len * 0.72, w0 / 2 + bulge * 0.6, len * 0.35, w0 / 2, 0);
      c.arc(0, 0, w0 / 2, 0, Math.PI, true); c.closePath();
    };
    const torsoPath = (c) => { c.beginPath(); c.moveTo(-21, 6); c.bezierCurveTo(-23, -28, -27, -58, -22, -84); c.bezierCurveTo(-19, -96, -6, -99, 4, -98); c.bezierCurveTo(16, -98, 27, -92, 27, -78); c.bezierCurveTo(29, -60, 22, -30, 21, 6); c.bezierCurveTo(10, 12, -10, 12, -21, 6); c.closePath(); };
    const pantsTop = (c) => { c.beginPath(); c.moveTo(-22, -12); c.bezierCurveTo(-8, -15, 10, -15, 22, -12); c.lineTo(23, 8); c.bezierCurveTo(10, 16, -10, 16, -23, 8); c.closePath(); };
    const headPath = (c) => { c.beginPath(); c.moveTo(4, -78); c.bezierCurveTo(26, -79, 40, -62, 40, -42); c.bezierCurveTo(40, -30, 38, -22, 33, -14); c.bezierCurveTo(28, -5, 18, 0, 8, 0); c.bezierCurveTo(-6, 0, -18, -6, -26, -16); c.bezierCurveTo(-34, -28, -34, -46, -28, -60); c.bezierCurveTo(-21, -72, -10, -78, 4, -78); c.closePath(); };
    const neckPath = (c) => { c.beginPath(); c.moveTo(-8, 4); c.lineTo(-9, -16); c.lineTo(9, -16); c.lineTo(8, 4); c.closePath(); };
    const handPath = (open, fist) => (c) => {
      c.beginPath();
      if (fist) { c.roundRect(-10, -2, 21, 19, 8); c.moveTo(11, 4); c.arc(9, 9, 5, -Math.PI / 2, Math.PI / 2); }
      else { c.moveTo(-8, -1); c.bezierCurveTo(-11, 8, -10, 18, -3, 22); c.bezierCurveTo(3, 25, 10, 20, 10, 12); c.bezierCurveTo(10, open ? 3 : 6, 8, -1, 0, -2); c.closePath();
        c.moveTo(7, 4); c.bezierCurveTo(14, 4, 17, 9, 15, 12); c.bezierCurveTo(13, 14, 9, 12, 8, 9); }
    };
    const shoePath = (c) => { c.beginPath(); c.moveTo(-10, -6); c.bezierCurveTo(-9, -12, 4, -12, 8, -6); c.bezierCurveTo(16, -4, 28, 0, 30, 6); c.bezierCurveTo(31, 10, 29, 13, 25, 13); c.lineTo(-8, 13); c.bezierCurveTo(-13, 13, -14, 4, -10, -6); c.closePath(); };
    const solePath = (c) => { c.beginPath(); c.moveTo(-11, 9); c.lineTo(30, 9); c.bezierCurveTo(30, 12, 28, 14, 25, 14); c.lineTo(-8, 14); c.bezierCurveTo(-11, 14, -12, 12, -11, 9); c.closePath(); };
    const scarfSeg = (len, w0, w1) => (c) => { c.beginPath(); c.moveTo(-w0 / 2, -2); c.quadraticCurveTo(-w0 / 2 - 1, len / 2, -w1 / 2, len + 2); c.lineTo(w1 / 2, len + 2); c.quadraticCurveTo(w0 / 2 + 1, len / 2, w0 / 2, -2); c.closePath(); };

    function drawLeg(ctx, W, s, back) {
      const pal = P(), k = back ? 0.84 : 1, pants = tint(pal.pants, k), shoes = tint(pal.shoes, k);
      part(ctx, W["shin" + s], self.rot["shin" + s], limb(74, 27, 19, 1.5), pants);
      part(ctx, W["leg" + s], self.rot["leg" + s], limb(80, 35, 27, 3), pants);
      part(ctx, W["foot" + s], self.rot["foot" + s], shoePath, shoes);
      part(ctx, W["foot" + s], self.rot["foot" + s], solePath, tint("#e9e4da", k), { shade: false, lw: 2 });
    }
    function drawArm(ctx, W, s, back) {
      const pal = P(), k = back ? 0.84 : 1, p = self.pose;
      part(ctx, W["fore" + s], self.rot["fore" + s], limb(52, 18, 14, 1.5), tint(pal.skin, k), { base: tint(pal.skin, k) });
      // rolled sleeve cuff on the forearm, then the sleeve
      part(ctx, W["fore" + s], self.rot["fore" + s], (c) => { c.beginPath(); c.roundRect(-11, -2, 22, 12, 5); }, tint(pal.top2, k));
      part(ctx, W["arm" + s], self.rot["arm" + s], limb(60, 29, 22, 2.5), tint(pal.top, k));
      part(ctx, W["hand" + s].scale(1.15), self.rot["hand" + s], handPath(p.handOpen, p.fist && s === "F"), tint(pal.skin, k));
    }
    function drawScarf(ctx, W) {
      const pal = P(), c = tint(pal.accent, 0.9);
      part(ctx, W.scarf3, self.rot.scarf3, scarfSeg(20, 13, 15), c, { lw: 2.6 });
      part(ctx, W.scarf2, self.rot.scarf2, scarfSeg(22, 14, 13), c, { lw: 2.6 });
      part(ctx, W.scarf1, self.rot.scarf1, scarfSeg(24, 15, 14), c, { lw: 2.6 });
    }
    function drawHead(ctx, W) {
      const pal = P(), M = W.head.scale(1.2), f = self.face, E = EXPR[f.expr] || EXPR.neutral;
      // back hair mass (behind the head)
      part(ctx, M, self.rot.head, (c) => { c.beginPath(); c.moveTo(-6, -82); c.bezierCurveTo(-30, -82, -42, -60, -38, -36); c.bezierCurveTo(-36, -22, -30, -12, -22, -8); c.bezierCurveTo(-16, -20, -10, -40, -2, -50); c.closePath(); }, pal.hair);
      part(ctx, M, self.rot.head, headPath, pal.skin);
      // ear (back side), with an inner fold
      part(ctx, M, self.rot.head, (c) => { c.beginPath(); c.ellipse(-20, -36, 6.5, 9, -0.15, 0, Math.PI * 2); }, pal.skin, { lw: 2.4 });
      ctx.setTransform(M); ctx.beginPath(); ctx.arc(-19.5, -35, 3.2, -1.2, 1.6); ctx.strokeStyle = shade(pal.skin, 0.35); ctx.lineWidth = 2; ctx.stroke();
      // cheek blush and nose
      ctx.beginPath(); ctx.ellipse(24, -20, 7, 4, 0, 0, Math.PI * 2); ctx.fillStyle = "rgba(214,110,90,.22)"; ctx.fill();
      ctx.beginPath(); ctx.moveTo(37, -36); ctx.quadraticCurveTo(45, -27, 38, -24); ctx.strokeStyle = pal.outline; ctx.lineWidth = 2.4; ctx.lineCap = "round"; ctx.stroke();
      // eyes: near (bigger) and far (foreshortened), lids for blinks/expression, gaze from lookAt
      const look = f.look; if (f.lookTarget) { const inv = self.world.head.inverse(), pt = inv.transformPoint(new DOMPoint(f.lookTarget.x, f.lookTarget.y)); const dx = pt.x - 20, dy = pt.y + 38, m = Math.hypot(dx, dy) || 1; look.x = lerp(look.x, dx / m, 0.2); look.y = lerp(look.y, dy / m, 0.2); }
      for (const [ex, ey, sx] of [[14, -38, 0.86], [30, -38, 0.6]]) {
        ctx.setTransform(M.translate(ex, ey).scale(sx, 1));
        const eye = (c) => { c.beginPath(); c.ellipse(0, 0, 7.5, 9.5, 0, 0, Math.PI * 2); };
        eye(ctx); ctx.fillStyle = "#fbfaf7"; ctx.fill();
        ctx.save(); eye(ctx); ctx.clip();
        const px = look.x * 3, py = look.y * 2.5, pr = 5.4 * (E.pupil || 1);
        ctx.beginPath(); ctx.arc(px + 1, py, 6, 0, Math.PI * 2); ctx.fillStyle = pal.eyes; ctx.fill();
        ctx.beginPath(); ctx.arc(px + 1, py, pr * 0.6, 0, Math.PI * 2); ctx.fillStyle = "#14110f"; ctx.fill();
        ctx.beginPath(); ctx.arc(px + 3, py - 3, 1.8, 0, Math.PI * 2); ctx.fillStyle = "#fff"; ctx.fill();
        // upper lid (expression + blink), lower lid (smiles push it up)
        const close = clamp(Math.max(E.lid[0], f.blink || 0), 0, 1), lidY = -10 + close * 20;
        ctx.rotate(E.lid[1] * D); ctx.fillStyle = pal.skin; ctx.fillRect(-12, -14, 24, lidY + 14);
        ctx.beginPath(); ctx.moveTo(-12, lidY); ctx.lineTo(12, lidY); ctx.strokeStyle = pal.outline; ctx.lineWidth = 2.4; ctx.stroke();
        ctx.rotate(-E.lid[1] * D);
        if (E.low) { ctx.beginPath(); ctx.ellipse(0, 14 - E.low * 10, 12, 8, 0, Math.PI, 0, true); ctx.fillStyle = pal.skin; ctx.fill(); }
        ctx.restore();
        eye(ctx); ctx.lineWidth = 2.2; ctx.strokeStyle = pal.outline; ctx.stroke();
        // lash line + brow
        ctx.beginPath(); ctx.ellipse(0, 0, 7.5, 9.5, 0, Math.PI * 1.08, Math.PI * 1.92); ctx.lineWidth = 3.2; ctx.stroke();
        ctx.setTransform(M.translate(ex, ey - 15 + (E.brow[0] + E.brow[1]) / 2).rotate(E.brow[2]).scale(sx, 1));
        ctx.beginPath(); ctx.moveTo(-8, 1); ctx.quadraticCurveTo(0, -3, 8, 0); ctx.lineWidth = 3.6; ctx.strokeStyle = pal.hair; ctx.stroke();
      }
      // mouth: viseme when speaking, else the expression's shape
      ctx.setTransform(M.translate(26, -13));
      drawMouth(ctx, f.viseme || E.mouth, pal);
      // front hair: a cap plus three tufts that lag behind head motion (springs)
      part(ctx, M, self.rot.head, (c) => { c.beginPath(); c.moveTo(-30, -48); c.bezierCurveTo(-30, -74, -8, -86, 12, -84); c.bezierCurveTo(30, -82, 42, -70, 42, -54); c.bezierCurveTo(34, -60, 24, -62, 16, -60); c.bezierCurveTo(6, -66, -8, -64, -14, -56); c.bezierCurveTo(-20, -52, -26, -50, -30, -48); c.closePath(); }, pal.hair);
      const tufts = [[34, -60, 0.7, 14], [22, -64, 0.95, 17], [8, -66, 0.8, 15]];
      tufts.forEach(([tx, ty, r, len], i) => {
        part(ctx, M.translate(tx, ty).rotate(self.springs.hair[i].a + 25 + i * 8), self.rot.head, (c) => { c.beginPath(); c.moveTo(-7, -4); c.bezierCurveTo(-6, 6, -1, len * 0.8, 3 * r, len); c.bezierCurveTo(5, len * 0.6, 7, 4, 6, -4); c.closePath(); }, pal.hair, { lw: 2.4 });
      });
      // a soft specular band on the hair
      ctx.setTransform(M); ctx.beginPath(); ctx.moveTo(-14, -74); ctx.quadraticCurveTo(4, -84, 22, -76); ctx.strokeStyle = light(pal.hair, 0.25); ctx.lineWidth = 3; ctx.stroke();
    }
    function drawMouth(ctx, m, pal) {
      const lip = pal.outline, inside = "#3a1d1f", teeth = "#f7f3ec", tongue = "#c45a5a";
      ctx.lineWidth = 2.4; ctx.strokeStyle = lip; ctx.lineCap = "round"; ctx.lineJoin = "round";
      const open = (w, h, tooth, tng) => { ctx.beginPath(); ctx.ellipse(0, 0, w, h, 0, 0, Math.PI * 2); ctx.fillStyle = inside; ctx.fill(); ctx.save(); ctx.clip();
        if (tooth) { ctx.fillStyle = teeth; ctx.fillRect(-w, -h, w * 2, h * 0.55); }
        if (tng) { ctx.beginPath(); ctx.ellipse(0, h * 0.8, w * 0.7, h * 0.6, 0, 0, Math.PI * 2); ctx.fillStyle = tongue; ctx.fill(); }
        ctx.restore(); ctx.beginPath(); ctx.ellipse(0, 0, w, h, 0, 0, Math.PI * 2); ctx.stroke(); };
      switch (m) {
        case "A": open(7, 6.5, true, true); break;
        case "E": open(8, 3.6, true, false); break;
        case "O": open(4.6, 5.6, false, true); break;
        case "U": open(3, 3.4, false, false); break;
        case "L": open(6, 4.5, true, true); break;
        case "F": ctx.beginPath(); ctx.moveTo(-6, 0); ctx.lineTo(6, 0); ctx.stroke(); ctx.fillStyle = teeth; ctx.fillRect(-4, -2.5, 8, 2.5); break;
        case "M": ctx.beginPath(); ctx.moveTo(-6, 0); ctx.quadraticCurveTo(0, 1.5, 6, 0); ctx.lineWidth = 3; ctx.stroke(); break;
        case "smile": ctx.beginPath(); ctx.moveTo(-8, -2); ctx.quadraticCurveTo(0, 7, 8, -3); ctx.quadraticCurveTo(0, 2.5, -8, -2); ctx.fillStyle = inside; ctx.fill(); ctx.stroke(); break;
        case "frown": ctx.beginPath(); ctx.moveTo(-6, 3); ctx.quadraticCurveTo(0, -3, 6, 2); ctx.stroke(); break;
        case "grit": ctx.beginPath(); ctx.roundRect(-7, -3, 14, 6, 2); ctx.fillStyle = teeth; ctx.fill(); ctx.stroke(); ctx.beginPath(); ctx.moveTo(-7, 0); ctx.lineTo(7, 0); ctx.lineWidth = 1.2; ctx.stroke(); break;
        case "set": ctx.beginPath(); ctx.moveTo(-6, 0.5); ctx.lineTo(6, -0.5); ctx.stroke(); break;
        default: ctx.beginPath(); ctx.moveTo(-5, 0); ctx.quadraticCurveTo(0, 1.8, 5, -0.5); ctx.stroke();
      }
    }

    self.draw = (ctx, x, groundY, opts = {}) => {
      if (!self.pose) self.update(0);
      const W = computeWorld(x, groundY), pal = P(), base = ctx.getTransform();
      ctx.save();
      // contact shadow shrinks as the character leaves the ground
      const air = clamp(-self.pose.rootY / 160, 0, 1);
      ctx.setTransform(base); ctx.beginPath(); ctx.ellipse(x + self.pose.rootX * C.scale * self.facing, groundY + 4 * C.scale, 46 * C.scale * (1 - air * 0.5), 8 * C.scale * (1 - air * 0.5), 0, 0, Math.PI * 2); ctx.fillStyle = `rgba(0,0,0,${0.22 * (1 - air * 0.6)})`; ctx.fill();
      const pre = (M) => base.multiply(M);
      const Wb = {}; for (const k in W) Wb[k] = pre(W[k]);
      drawScarf(ctx, Wb);
      drawArm(ctx, Wb, "B", true);
      drawLeg(ctx, Wb, "B", true);
      part(ctx, Wb.neck, self.rot.neck, neckPath, pal.skin);
      const T = Wb.torso.scale(1.18, 1);
      part(ctx, T, self.rot.torso, torsoPath, pal.top);
      // jacket details: zip line, hem, collar
      ctx.setTransform(T); ctx.beginPath(); ctx.moveTo(12, -92); ctx.bezierCurveTo(14, -60, 12, -30, 10, -6); ctx.strokeStyle = shade(pal.top, 0.35); ctx.lineWidth = 2; ctx.stroke();
      part(ctx, T, self.rot.torso, (c) => { c.beginPath(); c.moveTo(-24, -10); c.bezierCurveTo(-8, -6, 10, -6, 23, -10); c.lineTo(22, -2); c.bezierCurveTo(10, 2, -8, 2, -23, -2); c.closePath(); }, shade(pal.top, 0.12), { shade: false, lw: 2.2 });
      part(ctx, Wb.root.scale(1.18, 1), 0, pantsTop, pal.pants);
      part(ctx, Wb.neck, self.rot.neck, (c) => { c.beginPath(); c.ellipse(0, -2, 16, 8, 0, 0, Math.PI * 2); }, pal.accent, { lw: 2.6 });
      drawLeg(ctx, Wb, "F", false);
      drawHead(ctx, Wb);
      drawArm(ctx, Wb, "F", false);
      ctx.restore(); ctx.setTransform(base);
    };

    /** Renders `frames` frames of a clip into a grid → { canvas, frames:[{x,y,w,h}], fps } (for Phaser/Godot/Unity sprite sheets). */
    self.spriteSheet = (clipName, frames = 12, cell = 256) => {
      const clip = CLIPS[clipName], cols = Math.min(frames, 6), rows = Math.ceil(frames / cols);
      const cv = document.createElement("canvas"); cv.width = cols * cell; cv.height = rows * cell; const g = cv.getContext("2d");
      const saved = { clip: self.clip, time: self.time, from: self.from, fade: self.fade, scale: C.scale };
      self.clip = clipName; self.from = null; self.fade = 1; C.scale = cell / 420;
      const out = [];
      for (let i = 0; i < frames; i++) {
        self.time = (i / frames) * clip.period; self.update(0);
        const x = (i % cols) * cell, y = Math.floor(i / cols) * cell;
        g.save(); g.beginPath(); g.rect(x, y, cell, cell); g.clip(); self.draw(g, x + cell / 2, y + cell * 0.93); g.restore();
        out.push({ x, y, w: cell, h: cell });
      }
      Object.assign(self, { clip: saved.clip, time: saved.time, from: saved.from, fade: saved.fade }); C.scale = saved.scale;
      return { canvas: cv, frames: out, fps: Math.round(frames / clip.period) };
    };
    self.config = C;
    return self;
  }

  root.Character2D = { create, CLIPS, EXPR, PALETTES, samplePose };
})(typeof window !== "undefined" ? window : globalThis);
