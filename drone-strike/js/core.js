// World core: procedural textures, merged-geometry builder, spatial collision,
// moving hazards and target models. Shared by all biomes.
const WC = (() => {
  const T = THREE;

  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // ---------- procedural textures (cached for the whole session) ----------
  const texCache = {};
  const rr = Math.random;
  function canvasTex(key, w, h, draw) {
    if (texCache[key]) return texCache[key];
    const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
    const c = cv.getContext('2d');
    draw(c, w, h);
    const t = new T.CanvasTexture(cv);
    t.wrapS = t.wrapT = T.RepeatWrapping;
    t.anisotropy = 8;
    texCache[key] = t;
    return t;
  }
  function rgbNoise(c, w, h, n, r, g, b, spread, alpha, size) {
    for (let i = 0; i < n; i++) {
      const k = (rr() - 0.5) * spread;
      c.fillStyle = `rgba(${(r + k) | 0},${(g + k) | 0},${(b + k) | 0},${alpha})`;
      const s = size * (0.5 + rr());
      c.fillRect(rr() * w, rr() * h, s, s);
    }
  }
  function blobs(c, w, h, n, col, rmin, rmax) {
    c.fillStyle = col;
    for (let i = 0; i < n; i++) {
      const x = rr() * w, y = rr() * h, r = rmin + rr() * (rmax - rmin);
      for (const [ox, oy] of [[0, 0], [w, 0], [-w, 0], [0, h], [0, -h]]) {
        c.beginPath(); c.ellipse(x + ox, y + oy, r, r * (0.5 + rr() * 0.6), rr() * 3, 0, Math.PI * 2); c.fill();
      }
    }
  }

  const TEX = {
    facade: () => canvasTex('facade', 256, 384, (c, W, H) => {
      c.fillStyle = '#c9ccd2'; c.fillRect(0, 0, W, H);
      rgbNoise(c, W, H, 1600, 200, 200, 205, 40, 0.25, 2);
      const cols = 4, rows = 6, cw = W / cols, ch = H / rows;
      for (let r = 0; r < rows; r++) for (let k = 0; k < cols; k++) {
        const x = k * cw + cw * 0.2, y = r * ch + ch * 0.2, w = cw * 0.6, h = ch * 0.55;
        const g = c.createLinearGradient(x, y, x, y + h);
        g.addColorStop(0, '#5b7da0'); g.addColorStop(1, '#1d2c3f');
        c.fillStyle = g; c.fillRect(x, y, w, h);
        c.fillStyle = 'rgba(255,255,255,0.16)';
        c.beginPath(); c.moveTo(x, y + h); c.lineTo(x + w * 0.45, y); c.lineTo(x + w * 0.7, y); c.lineTo(x + w * 0.25, y + h); c.fill();
        c.fillStyle = '#9aa0a8'; c.fillRect(x - 2, y + h, w + 4, 3);
      }
    }),
    facadeLit: () => canvasTex('facadeLit', 256, 384, (c, W, H) => {
      c.fillStyle = '#000'; c.fillRect(0, 0, W, H);
      const cols = 4, rows = 6, cw = W / cols, ch = H / rows;
      for (let r = 0; r < rows; r++) for (let k = 0; k < cols; k++) {
        if (rr() > 0.42) continue;
        const v = rr();
        c.fillStyle = v < 0.7 ? '#ffd48a' : v < 0.9 ? '#fff2cf' : '#9fd0ff';
        c.fillRect(k * cw + cw * 0.2, r * ch + ch * 0.2, cw * 0.6, ch * 0.55);
      }
    }),
    concrete: () => canvasTex('concrete', 256, 256, (c, W, H) => {
      c.fillStyle = '#8e9093'; c.fillRect(0, 0, W, H);
      rgbNoise(c, W, H, 5000, 142, 144, 147, 50, 0.35, 2);
      blobs(c, W, H, 10, 'rgba(60,60,58,0.10)', 10, 40);
      c.strokeStyle = 'rgba(40,40,40,0.25)'; c.lineWidth = 2;
      c.beginPath(); c.moveTo(0, H / 2); c.lineTo(W, H / 2); c.moveTo(W / 2, 0); c.lineTo(W / 2, H); c.stroke();
    }),
    brick: () => canvasTex('brick', 256, 256, (c, W, H) => {
      c.fillStyle = '#a79d92'; c.fillRect(0, 0, W, H);
      const bh = 16, bw = 48;
      for (let y = 0; y < H; y += bh) {
        const off = (y / bh) % 2 ? bw / 2 : 0;
        for (let x = -bw; x < W + bw; x += bw) {
          const r = 130 + rr() * 50, g = 60 + rr() * 30, b = 45 + rr() * 20;
          c.fillStyle = `rgb(${r | 0},${g | 0},${b | 0})`;
          c.fillRect(x + off + 2, y + 2, bw - 4, bh - 4);
        }
      }
      rgbNoise(c, W, H, 2500, 120, 80, 60, 60, 0.2, 2);
    }),
    plaster: () => canvasTex('plaster', 256, 256, (c, W, H) => {
      c.fillStyle = '#e4ded2'; c.fillRect(0, 0, W, H);
      rgbNoise(c, W, H, 4000, 225, 220, 210, 30, 0.25, 2);
      blobs(c, W, H, 6, 'rgba(150,140,120,0.05)', 20, 60);
    }),
    woodfloor: () => canvasTex('woodfloor', 256, 256, (c, W, H) => {
      const pw = 32;
      for (let x = 0; x < W; x += pw) {
        const r = 120 + rr() * 40, g = 80 + rr() * 25, b = 45 + rr() * 15;
        c.fillStyle = `rgb(${r | 0},${g | 0},${b | 0})`; c.fillRect(x, 0, pw, H);
        c.strokeStyle = 'rgba(40,20,10,0.25)';
        for (let i = 0; i < 6; i++) { c.beginPath(); const gx = x + rr() * pw; c.moveTo(gx, 0); c.bezierCurveTo(gx + 4, H * 0.3, gx - 4, H * 0.6, gx + 2, H); c.stroke(); }
        c.fillStyle = 'rgba(30,15,5,0.6)'; c.fillRect(x, 0, 2, H);
        c.fillRect(x, (rr() * H) | 0, pw, 2);
      }
    }),
    logs: () => canvasTex('logs', 256, 256, (c, W, H) => {
      const lh = 32;
      for (let y = 0; y < H; y += lh) {
        const g = c.createLinearGradient(0, y, 0, y + lh);
        g.addColorStop(0, '#4a2f1a'); g.addColorStop(0.25, '#8a5a35'); g.addColorStop(0.6, '#7a4d2c'); g.addColorStop(1, '#2e1c0f');
        c.fillStyle = g; c.fillRect(0, y, W, lh);
      }
      rgbNoise(c, W, H, 3000, 110, 70, 40, 50, 0.25, 2);
    }),
    metal: () => canvasTex('metal', 256, 256, (c, W, H) => {
      c.fillStyle = '#6b737b'; c.fillRect(0, 0, W, H);
      rgbNoise(c, W, H, 4000, 110, 118, 126, 40, 0.3, 2);
      c.strokeStyle = 'rgba(20,24,28,0.6)'; c.lineWidth = 3; c.strokeRect(2, 2, W - 4, H - 4);
      c.fillStyle = 'rgba(30,30,30,0.7)';
      for (let i = 12; i < W; i += 40) { c.fillRect(i, 8, 4, 4); c.fillRect(i, H - 12, 4, 4); }
      blobs(c, W, H, 5, 'rgba(120,70,30,0.12)', 8, 30);
    }),
    camo: () => canvasTex('camo', 256, 256, (c, W, H) => {
      c.fillStyle = '#56603e'; c.fillRect(0, 0, W, H);
      blobs(c, W, H, 14, '#6d6a45', 15, 40);
      blobs(c, W, H, 12, '#3a3b29', 12, 32);
      blobs(c, W, H, 8, '#7d6b4a', 10, 26);
      rgbNoise(c, W, H, 3000, 80, 85, 60, 40, 0.2, 2);
    }),
    sandbag: () => canvasTex('sandbag', 256, 256, (c, W, H) => {
      c.fillStyle = '#5e5440'; c.fillRect(0, 0, W, H);
      const bh = 32, bw = 64;
      for (let y = 0; y < H; y += bh) {
        const off = (y / bh) % 2 ? bw / 2 : 0;
        for (let x = -bw; x < W + bw; x += bw) {
          const v = 150 + rr() * 30;
          c.fillStyle = `rgb(${v | 0},${(v * 0.88) | 0},${(v * 0.65) | 0})`;
          c.beginPath(); c.ellipse(x + off + bw / 2, y + bh / 2, bw / 2 - 2, bh / 2 - 2, 0, 0, Math.PI * 2); c.fill();
        }
      }
      rgbNoise(c, W, H, 3000, 150, 130, 100, 50, 0.25, 2);
    }),
    grass: () => canvasTex('grass', 256, 256, (c, W, H) => {
      c.fillStyle = '#4c6a2c'; c.fillRect(0, 0, W, H);
      blobs(c, W, H, 18, 'rgba(110,120,50,0.35)', 10, 40);
      blobs(c, W, H, 12, 'rgba(40,60,25,0.35)', 10, 40);
      for (let i = 0; i < 9000; i++) {
        const g = 70 + rr() * 80;
        c.fillStyle = `rgba(${(g * 0.55) | 0},${g | 0},${(g * 0.3) | 0},0.6)`;
        c.fillRect(rr() * W, rr() * H, 1, 2 + rr() * 3);
      }
    }),
    mud: () => canvasTex('mud', 256, 256, (c, W, H) => {
      c.fillStyle = '#4a3f33'; c.fillRect(0, 0, W, H);
      blobs(c, W, H, 20, 'rgba(30,25,20,0.35)', 8, 40);
      blobs(c, W, H, 14, 'rgba(110,95,70,0.25)', 8, 30);
      rgbNoise(c, W, H, 6000, 80, 68, 55, 50, 0.4, 2);
    }),
    rock: () => canvasTex('rock', 256, 256, (c, W, H) => {
      c.fillStyle = '#7c7a75'; c.fillRect(0, 0, W, H);
      blobs(c, W, H, 20, 'rgba(50,50,48,0.2)', 6, 30);
      rgbNoise(c, W, H, 6000, 125, 122, 116, 60, 0.35, 2);
    }),
    bark: () => canvasTex('bark', 128, 256, (c, W, H) => {
      c.fillStyle = '#4a3626'; c.fillRect(0, 0, W, H);
      for (let i = 0; i < 160; i++) {
        const v = 40 + rr() * 50; c.fillStyle = `rgba(${v | 0},${(v * 0.75) | 0},${(v * 0.55) | 0},0.7)`;
        c.fillRect(rr() * W, rr() * H, 2 + rr() * 4, 20 + rr() * 60);
      }
    }),
    leaves: () => canvasTex('leaves', 256, 256, (c, W, H) => {
      c.fillStyle = '#2f5a24'; c.fillRect(0, 0, W, H);
      for (let i = 0; i < 2200; i++) {
        const g = 60 + rr() * 90;
        c.fillStyle = `rgba(${(g * 0.45) | 0},${g | 0},${(g * 0.3) | 0},0.8)`;
        c.beginPath(); c.ellipse(rr() * W, rr() * H, 2 + rr() * 4, 1 + rr() * 2, rr() * 3, 0, Math.PI * 2); c.fill();
      }
    }),
    roof: () => canvasTex('roof', 256, 256, (c, W, H) => {
      c.fillStyle = '#5a2a22'; c.fillRect(0, 0, W, H);
      for (let y = 0; y < H; y += 20) for (let x = (y / 20) % 2 ? -16 : 0; x < W; x += 32) {
        const v = 110 + rr() * 40; c.fillStyle = `rgb(${v | 0},${(v * 0.42) | 0},${(v * 0.32) | 0})`;
        c.fillRect(x + 1, y + 1, 30, 18);
      }
    }),
    hazard: () => canvasTex('hazard', 128, 128, (c, W, H) => {
      c.fillStyle = '#f2b51c'; c.fillRect(0, 0, W, H);
      c.fillStyle = '#151515';
      for (let i = -W; i < W * 2; i += 32) { c.beginPath(); c.moveTo(i, 0); c.lineTo(i + 16, 0); c.lineTo(i + 16 + H, H); c.lineTo(i + H, H); c.fill(); }
    }),
    tunnel: () => canvasTex('tunnel', 256, 256, (c, W, H) => {
      c.fillStyle = '#55585b'; c.fillRect(0, 0, W, H);
      rgbNoise(c, W, H, 6000, 85, 88, 92, 45, 0.35, 2);
      blobs(c, W, H, 10, 'rgba(30,35,30,0.18)', 10, 40);
      c.fillStyle = 'rgba(20,20,20,0.5)'; c.fillRect(0, 0, W, 3); c.fillRect(0, 0, 3, H);
      blobs(c, W, H, 4, 'rgba(90,60,30,0.15)', 6, 20);
    }),
    tunnelFloor: () => canvasTex('tunnelFloor', 256, 256, (c, W, H) => {
      c.fillStyle = '#3c3d3e'; c.fillRect(0, 0, W, H);
      rgbNoise(c, W, H, 7000, 60, 61, 62, 40, 0.4, 2);
      blobs(c, W, H, 8, 'rgba(15,20,25,0.35)', 8, 30);
    }),
    asphalt: (P, B) => canvasTex('asphalt' + P + '_' + B, 512, 512, (c, px) => {
      c.fillStyle = '#2a2d33'; c.fillRect(0, 0, px, px);
      rgbNoise(c, px, px, 6000, 45, 47, 52, 25, 0.5, 2);
      const m = px / P, side = (B + 3) * m, ins = (B - 0.2) * m;
      c.fillStyle = '#6e7178'; c.fillRect((px - side) / 2, (px - side) / 2, side, side);
      c.fillStyle = '#55585f'; c.fillRect((px - ins) / 2, (px - ins) / 2, ins, ins);
      c.fillStyle = '#d9c75a';
      const dash = 3.2 * m, lw = Math.max(2, 0.3 * m);
      for (let y = 0; y < px; y += dash * 2) { c.fillRect(-lw / 2, y, lw, dash); c.fillRect(px - lw / 2, y, lw, dash); }
      for (let x = 0; x < px; x += dash * 2) { c.fillRect(x, -lw / 2, dash, lw); c.fillRect(x, px - lw / 2, dash, lw); }
    }),
    glow: () => canvasTex('glow', 64, 64, (c) => {
      const g = c.createRadialGradient(32, 32, 0, 32, 32, 32);
      g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.35, 'rgba(255,255,255,0.45)'); g.addColorStop(1, 'rgba(255,255,255,0)');
      c.fillStyle = g; c.fillRect(0, 0, 64, 64);
    }),
  };

  // material definitions: texture + world-space tile size (m)
  const MATDEF = {
    facade: { tex: 'facade', tu: 12.8, tv: 21, plainTop: true, emissive: 'facadeLit' },
    concrete: { tex: 'concrete', tu: 6, tv: 6 },
    brick: { tex: 'brick', tu: 4, tv: 4 },
    plaster: { tex: 'plaster', tu: 4, tv: 4 },
    woodfloor: { tex: 'woodfloor', tu: 3, tv: 3 },
    logs: { tex: 'logs', tu: 3, tv: 2.4 },
    metal: { tex: 'metal', tu: 2.5, tv: 2.5 },
    camo: { tex: 'camo', tu: 4, tv: 4 },
    sandbag: { tex: 'sandbag', tu: 2, tv: 1 },
    rock: { tex: 'rock', tu: 4, tv: 4 },
    bark: { tex: 'bark', tu: 1.5, tv: 3 },
    roof: { tex: 'roof', tu: 3, tv: 3 },
    hazard: { tex: 'hazard', tu: 1.5, tv: 1.5 },
    tunnel: { tex: 'tunnel', tu: 5, tv: 5 },
    tunnelFloor: { tex: 'tunnelFloor', tu: 5, tv: 5 },
  };

  // ---------- merged static geometry ----------
  function Builder() {
    const groups = {};
    const col = new T.Color();
    const G = (k) => groups[k] || (groups[k] = { pos: [], nor: [], uv: [], col: [], idx: [], n: 0 });
    // oriented box (yaw only) given centre and half extents
    function box(k, cx, cy, cz, hx, hy, hz, rot, tint, ao) {
      const def = MATDEF[k], g = G(k);
      const c = Math.cos(rot || 0), s = Math.sin(rot || 0);
      const tu = def.tu, tv = def.tv;
      col.setHex(tint == null ? 0xffffff : tint);
      const br = col.r, bg = col.g, bb = col.b;
      const ou = ((cx * 0.137 + cz * 0.071) % 1 + 1) % 1;
      const P0 = 0.002;
      const W = (lx, ly, lz) => [cx + lx * c + lz * s, cy + ly, cz - lx * s + lz * c];
      function quad(ps, nx, ny, nz, uvs, fs) {
        const wnx = nx * c + nz * s, wnz = -nx * s + nz * c;
        for (let i = 0; i < 4; i++) {
          const p = W(ps[i][0], ps[i][1], ps[i][2]);
          g.pos.push(p[0], p[1], p[2]); g.nor.push(wnx, ny, wnz);
          g.uv.push(uvs[i][0], uvs[i][1]);
          g.col.push(br * fs[i], bg * fs[i], bb * fs[i]);
        }
        g.idx.push(g.n, g.n + 1, g.n + 2, g.n, g.n + 2, g.n + 3);
        g.n += 4;
      }
      const segs = [];
      const h2 = hy * 2;
      if (ao && h2 > 1) {
        const m = -hy + Math.min(3, h2 * 0.4);
        segs.push([-hy, m, 0.55, 1]); segs.push([m, hy, 1, 1]);
      } else segs.push([-hy, hy, 1, 1]);
      for (const [ya, yb, fa, fb] of segs) {
        const va = (cy + ya) / tv, vb = (cy + yb) / tv;
        const fs = [fa, fa, fb, fb];
        const U = (a) => a / tu + ou;
        quad([[-hx, ya, hz], [hx, ya, hz], [hx, yb, hz], [-hx, yb, hz]], 0, 0, 1, [[U(-hx), va], [U(hx), va], [U(hx), vb], [U(-hx), vb]], fs);
        quad([[hx, ya, -hz], [-hx, ya, -hz], [-hx, yb, -hz], [hx, yb, -hz]], 0, 0, -1, [[U(hx), va], [U(-hx), va], [U(-hx), vb], [U(hx), vb]], fs);
        quad([[hx, ya, hz], [hx, ya, -hz], [hx, yb, -hz], [hx, yb, hz]], 1, 0, 0, [[U(hz), va], [U(-hz), va], [U(-hz), vb], [U(hz), vb]], fs);
        quad([[-hx, ya, -hz], [-hx, ya, hz], [-hx, yb, hz], [-hx, yb, -hz]], -1, 0, 0, [[U(-hz), va], [U(hz), va], [U(hz), vb], [U(-hz), vb]], fs);
      }
      const tf = def.plainTop ? 0.62 : 0.9;
      const tuv = def.plainTop
        ? [[P0, P0], [P0, P0], [P0, P0], [P0, P0]]
        : [[(cx - hx) / tu, (cz - hz) / tu], [(cx - hx) / tu, (cz + hz) / tu], [(cx + hx) / tu, (cz + hz) / tu], [(cx + hx) / tu, (cz - hz) / tu]];
      quad([[-hx, hy, -hz], [-hx, hy, hz], [hx, hy, hz], [hx, hy, -hz]], 0, 1, 0, tuv, [tf, tf, tf, tf]);
      quad([[-hx, -hy, -hz], [hx, -hy, -hz], [hx, -hy, hz], [-hx, -hy, hz]], 0, -1, 0, tuv, [0.7, 0.7, 0.7, 0.7]);
    }
    function build(theme) {
      const meshes = [], dispose = [];
      for (const k in groups) {
        const g = groups[k];
        if (!g.n) continue;
        const geo = new T.BufferGeometry();
        geo.setAttribute('position', new T.Float32BufferAttribute(g.pos, 3));
        geo.setAttribute('normal', new T.Float32BufferAttribute(g.nor, 3));
        geo.setAttribute('uv', new T.Float32BufferAttribute(g.uv, 2));
        geo.setAttribute('color', new T.Float32BufferAttribute(g.col, 3));
        geo.setIndex(g.idx);
        geo.computeBoundingSphere();
        const def = MATDEF[k];
        const mat = new T.MeshLambertMaterial({ map: TEX[def.tex](), vertexColors: true });
        if (def.emissive) { mat.emissiveMap = TEX[def.emissive](); mat.emissive.setScalar(theme.emissive || 0); }
        const m = new T.Mesh(geo, mat);
        m.castShadow = m.receiveShadow = true;
        meshes.push(m); dispose.push(geo, mat);
      }
      return { meshes, dispose };
    }
    return { box, build };
  }

  // ---------- colliders with a 2D spatial hash ----------
  function Colliders() {
    const CS = 8, M = 4;
    const cells = new Map();
    const EMPTY = [];
    const key = (ix, iz) => (ix + 32768) * 65536 + (iz + 32768);
    function insert(c, minx, maxx, minz, maxz) {
      const x0 = Math.floor((minx - M) / CS), x1 = Math.floor((maxx + M) / CS);
      const z0 = Math.floor((minz - M) / CS), z1 = Math.floor((maxz + M) / CS);
      for (let ix = x0; ix <= x1; ix++) for (let iz = z0; iz <= z1; iz++) {
        const k = key(ix, iz);
        let a = cells.get(k); if (!a) { a = []; cells.set(k, a); }
        a.push(c);
      }
    }
    function obb(cx, cy, cz, hx, hy, hz, rot, kind) {
      const c = Math.cos(rot || 0), s = Math.sin(rot || 0);
      const o = { t: 0, cx, cy, cz, hx, hy, hz, c, s, kind };
      const ex = Math.abs(c) * hx + Math.abs(s) * hz, ez = Math.abs(s) * hx + Math.abs(c) * hz;
      insert(o, cx - ex, cx + ex, cz - ez, cz + ez);
    }
    function cyl(x, z, r, y0, y1, kind) { insert({ t: 1, x, z, r, y0, y1, kind }, x - r, x + r, z - r, z + r); }
    function sph(x, y, z, r, kind) { insert({ t: 2, x, y, z, r, kind }, x - r, x + r, z - r, z + r); }
    function dist(o, p) {
      if (o.t === 0) {
        const dx = p.x - o.cx, dz = p.z - o.cz;
        const lx = o.c * dx - o.s * dz, lz = o.s * dx + o.c * dz;
        const ax = Math.max(Math.abs(lx) - o.hx, 0), ay = Math.max(Math.abs(p.y - o.cy) - o.hy, 0), az = Math.max(Math.abs(lz) - o.hz, 0);
        return Math.sqrt(ax * ax + ay * ay + az * az);
      }
      if (o.t === 1) {
        const dh = Math.max(Math.hypot(p.x - o.x, p.z - o.z) - o.r, 0);
        const dy = Math.max(o.y0 - p.y, 0, p.y - o.y1);
        return Math.hypot(dh, dy);
      }
      return Math.max(0, Math.hypot(p.x - o.x, p.y - o.y, p.z - o.z) - o.r);
    }
    function near(p) { return cells.get(key(Math.floor(p.x / CS), Math.floor(p.z / CS))) || EMPTY; }
    function hit(p, r) {
      const a = near(p);
      for (let i = 0; i < a.length; i++) if (dist(a[i], p) < r) return a[i].kind;
      return null;
    }
    function nearest(p) {
      const a = near(p); let m = 1e9;
      for (let i = 0; i < a.length; i++) { const d = dist(a[i], p); if (d < m) m = d; }
      return m;
    }
    return { obb, cyl, sph, hit, nearest };
  }

  // ---------- moving hazards ----------
  const sharedMats = {};
  function mat(key, make) { return sharedMats[key] || (sharedMats[key] = make()); }
  const hazardMat = () => mat('hazard', () => new T.MeshLambertMaterial({ map: TEX.hazard() }));
  const darkMat = () => mat('dark', () => new T.MeshLambertMaterial({ color: 0x22252b }));
  const metalMat = () => mat('metal', () => new T.MeshLambertMaterial({ map: TEX.metal() }));

  function Spinner(root, o) {
    // o: {x,y,z, axis:'x'|'y'|'z', len, thick, w, phase, blades}
    const g = new T.Group();
    g.position.set(o.x, o.y, o.z);
    const geo = o.axis === 'x' ? new T.BoxGeometry(o.thick, o.len, o.thick) : new T.BoxGeometry(o.len, o.thick, o.thick);
    const n = o.blades || 1;
    for (let k = 0; k < n; k++) {
      const m = new T.Mesh(geo, hazardMat());
      m.rotation[o.axis] = (k * Math.PI) / n;
      m.castShadow = true;
      g.add(m);
    }
    const hub = new T.Mesh(new T.SphereGeometry(o.thick * 1.2, 10, 8), darkMat());
    g.add(hub);
    root.add(g);
    let a = o.phase || 0;
    const half = o.len / 2, ht = o.thick / 2;
    function d(p) {
      const dx = p.x - o.x, dy = p.y - o.y, dz = p.z - o.z;
      let best = 1e9;
      for (let k = 0; k < n; k++) {
        const ang = a + (k * Math.PI) / n, c = Math.cos(ang), s = Math.sin(ang);
        let along, perp, ax;
        if (o.axis === 'y') { along = c * dx - s * dz; perp = s * dx + c * dz; ax = dy; }
        else if (o.axis === 'x') { along = c * dy + s * dz; perp = -s * dy + c * dz; ax = dx; }
        else { along = c * dx + s * dy; perp = -s * dx + c * dy; ax = dz; }
        const e1 = Math.max(Math.abs(along) - half, 0), e2 = Math.max(Math.abs(perp) - ht, 0), e3 = Math.max(Math.abs(ax) - ht, 0);
        best = Math.min(best, Math.sqrt(e1 * e1 + e2 * e2 + e3 * e3));
      }
      return best;
    }
    return {
      update(dt) { a += o.w * dt; g.rotation[o.axis] = a; },
      collide(p, r) { return d(p) < r ? o.kind || 'spinning blade' : null; },
      near: d,
      geo: [geo, hub.geometry],
    };
  }

  let patrolGeo = null;
  function Patrol(root, a, b, speed, phase) {
    if (!patrolGeo) {
      patrolGeo = {
        body: new T.BoxGeometry(1.5, 0.45, 1.5), arm: new T.BoxGeometry(3.4, 0.12, 0.2),
        rot: new T.CylinderGeometry(0.75, 0.75, 0.03, 14), eye: new T.SphereGeometry(0.28, 8, 6),
      };
    }
    const rotMat = mat('rotor', () => new T.MeshBasicMaterial({ color: 0xbfd8ff, transparent: true, opacity: 0.35 }));
    const eyeMat = mat('eye', () => new T.MeshBasicMaterial({ color: 0xff2030 }));
    const g = new T.Group();
    g.add(new T.Mesh(patrolGeo.body, darkMat()));
    const a1 = new T.Mesh(patrolGeo.arm, darkMat()); a1.rotation.y = Math.PI / 4; g.add(a1);
    const a2 = new T.Mesh(patrolGeo.arm, darkMat()); a2.rotation.y = -Math.PI / 4; g.add(a2);
    const rotors = [];
    for (const [x, z] of [[1.2, 1.2], [-1.2, 1.2], [1.2, -1.2], [-1.2, -1.2]]) {
      const r = new T.Mesh(patrolGeo.rot, rotMat); r.position.set(x, 0.15, z); g.add(r); rotors.push(r);
    }
    const eye = new T.Mesh(patrolGeo.eye, eyeMat); eye.position.y = -0.35; g.add(eye);
    g.traverse((m) => { m.castShadow = true; });
    root.add(g);
    const pos = new T.Vector3();
    const len = Math.max(1, a.distanceTo(b));
    let t = phase || 0;
    return {
      update(dt) {
        t += dt;
        const u = 0.5 + 0.5 * Math.sin(t * speed * Math.PI / len);
        pos.lerpVectors(a, b, u);
        pos.y += Math.sin(t * 1.7) * 0.4;
        g.position.copy(pos);
        g.rotation.y += dt * 0.6;
        for (const r of rotors) r.rotation.y += dt * 45;
      },
      collide(p, r) { return p.distanceTo(pos) < r + 1.3 ? 'patrol drone' : null; },
      near(p) { return p.distanceTo(pos) - 1.3; },
    };
  }

  // sliding blast door: closes the corridor periodically
  function Door(root, o) {
    // o: {cx,cy,cz,hx,hy,hz, open, closed, move, phase}
    const geo = new T.BoxGeometry(o.hx * 2, o.hy * 2, o.hz * 2);
    const m = new T.Mesh(geo, hazardMat());
    m.castShadow = true;
    root.add(m);
    const P = o.open + o.closed + 2 * o.move;
    let t = o.phase || 0, off = 0;
    function frac() {
      const u = ((t % P) + P) % P;
      if (u < o.closed) return 0;
      if (u < o.closed + o.move) return (u - o.closed) / o.move;
      if (u < o.closed + o.move + o.open) return 1;
      return 1 - (u - o.closed - o.move - o.open) / o.move;
    }
    function d(p) {
      const cy = o.cy + off;
      const ax = Math.max(Math.abs(p.x - o.cx) - o.hx, 0), ay = Math.max(Math.abs(p.y - cy) - o.hy, 0), az = Math.max(Math.abs(p.z - o.cz) - o.hz, 0);
      return Math.sqrt(ax * ax + ay * ay + az * az);
    }
    return {
      update(dt) { t += dt; off = frac() * o.hy * 2 * 0.98; m.position.set(o.cx, o.cy + off, o.cz); },
      collide(p, r) { return d(p) < r ? 'blast door' : null; },
      near: d,
      geo: [geo],
    };
  }

  // blinking laser grid (lethal while on)
  function Laser(root, o) {
    // o: {cx,cy,cz,hx,hy,hz,on,off,phase,lines}
    const g = new T.Group();
    const lm = new T.MeshBasicMaterial({ color: 0xff2020, transparent: true, opacity: 0.9, blending: T.AdditiveBlending, depthWrite: false });
    const n = o.lines || 4;
    const horizontalAlongX = o.hx > o.hz;
    const len = (horizontalAlongX ? o.hx : o.hz) * 2;
    const geo = horizontalAlongX ? new T.BoxGeometry(len, 0.05, 0.05) : new T.BoxGeometry(0.05, 0.05, len);
    for (let i = 0; i < n; i++) {
      const m = new T.Mesh(geo, lm);
      m.position.set(o.cx, o.cy - o.hy + ((i + 0.5) / n) * o.hy * 2, o.cz);
      g.add(m);
    }
    root.add(g);
    const P = o.on + o.off;
    let t = o.phase || 0, on = true;
    function d(p) {
      const ax = Math.max(Math.abs(p.x - o.cx) - o.hx, 0), ay = Math.max(Math.abs(p.y - o.cy) - o.hy, 0), az = Math.max(Math.abs(p.z - o.cz) - o.hz, 0);
      return Math.sqrt(ax * ax + ay * ay + az * az);
    }
    return {
      update(dt) {
        t += dt;
        const u = ((t % P) + P) % P;
        on = u < o.on;
        const warn = !on && u > P - 0.35; // flicker just before switching on
        lm.opacity = on ? 0.85 + 0.15 * Math.sin(t * 40) : warn ? 0.35 : 0.06;
      },
      collide(p, r) { return on && d(p) < r ? 'laser' : null; },
      near(p) { return on ? d(p) : 1e9; },
      geo: [geo], mats: [lm],
    };
  }

  // anti-aircraft gun firing tracer bursts; tracks the drone when it flies high
  function AAGun(root, o, ctx) {
    // o: {x,y,z, lockAlt, turn, spread}
    const base = new T.Group();
    base.position.set(o.x, o.y, o.z);
    const plat = new T.Mesh(new T.CylinderGeometry(1.6, 1.9, 0.8, 12), metalMat()); plat.position.y = 0.4; base.add(plat);
    const yawG = new T.Group(); yawG.position.y = 1.0; base.add(yawG);
    const turret = new T.Mesh(new T.BoxGeometry(1.6, 1.0, 1.8), mat('camoS', () => new T.MeshLambertMaterial({ map: TEX.camo() }))); yawG.add(turret);
    const pitchG = new T.Group(); pitchG.position.set(0, 0.4, 0); yawG.add(pitchG);
    const barrelGeo = new T.CylinderGeometry(0.09, 0.11, 3.2, 8); barrelGeo.rotateX(-Math.PI / 2); barrelGeo.translate(0, 0, -1.6);
    for (const bx of [-0.25, 0.25]) { const b = new T.Mesh(barrelGeo, darkMat()); b.position.x = bx; pitchG.add(b); }
    base.traverse((m) => { m.castShadow = true; });
    root.add(base);
    const flash = new T.Sprite(new T.SpriteMaterial({ map: TEX.glow(), color: 0xffc060, blending: T.AdditiveBlending, transparent: true, depthWrite: false }));
    flash.scale.setScalar(2.5); root.add(flash);

    const MAX = 90;
    const bp = new Float32Array(MAX * 6);
    const bgeo = new T.BufferGeometry(); bgeo.setAttribute('position', new T.BufferAttribute(bp, 3));
    const lines = new T.LineSegments(bgeo, new T.LineBasicMaterial({ color: 0xffb040, transparent: true, opacity: 0.95, blending: T.AdditiveBlending }));
    lines.frustumCulled = false;
    root.add(lines);
    const bullets = [];
    for (let i = 0; i < MAX; i++) bullets.push({ p: new T.Vector3(), q: new T.Vector3(), v: new T.Vector3(), life: 0 });
    let next = 0, yaw = ctx.rand() * 6, pitch = 0.4, t = ctx.rand() * 5, fireT = 0, locked = false;
    const muzzle = new T.Vector3(), dir = new T.Vector3(), tmp = new T.Vector3();
    const SPEED = 150;
    return {
      update(dt, time, dp) {
        t += dt;
        const center = new T.Vector3(o.x, o.y + 1.4, o.z);
        const agl = dp ? dp.y - ctx.groundAt(dp.x, dp.z, dp.y) : 0;
        const dist = dp ? center.distanceTo(dp) : 1e9;
        locked = !!dp && agl > o.lockAlt && dist < 260;
        let ty, tp;
        if (locked) {
          // lead the target a little, with aim error
          tmp.copy(dp).sub(center);
          ty = Math.atan2(-tmp.x, -tmp.z) + Math.sin(t * 2.3) * o.spread;
          tp = Math.atan2(tmp.y, Math.hypot(tmp.x, tmp.z)) + Math.cos(t * 1.9) * o.spread * 0.6;
        } else {
          ty = o.sweep + Math.sin(t * 0.35) * 1.3;
          tp = 0.35 + 0.3 * Math.sin(t * 0.5);
        }
        const step = o.turn * dt;
        let dy = ((ty - yaw + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
        yaw += Math.max(-step, Math.min(step, dy));
        pitch += Math.max(-step, Math.min(step, tp - pitch));
        yawG.rotation.y = yaw; pitchG.rotation.x = pitch;
        // bursts
        const cyc = (t % 3.4);
        const firing = cyc < 2.0;
        flash.visible = false;
        if (firing) {
          fireT -= dt;
          while (fireT <= 0) {
            fireT += 0.075;
            dir.set(0, 0, -1).applyEuler(new T.Euler(pitch, yaw, 0, 'YXZ'));
            muzzle.copy(center).addScaledVector(dir, 3.4);
            const b = bullets[next]; next = (next + 1) % MAX;
            b.p.copy(muzzle); b.q.copy(muzzle);
            b.v.copy(dir).multiplyScalar(SPEED);
            b.v.x += (ctx.rand() - 0.5) * 6; b.v.y += (ctx.rand() - 0.5) * 6; b.v.z += (ctx.rand() - 0.5) * 6;
            b.life = 2.2;
            flash.visible = true; flash.position.copy(muzzle);
            if (dp && dist < 140 && Sfx.gun) Sfx.gun(Math.max(0.02, 0.18 * (1 - dist / 140)));
          }
        }
        for (let i = 0; i < MAX; i++) {
          const b = bullets[i];
          if (b.life > 0) {
            b.life -= dt;
            b.q.copy(b.p);
            b.p.addScaledVector(b.v, dt);
            if (b.p.y < ctx.groundAt(b.p.x, b.p.z, b.p.y)) b.life = 0;
          }
          const k = i * 6;
          if (b.life > 0) {
            tmp.copy(b.v).normalize();
            bp[k] = b.p.x; bp[k + 1] = b.p.y; bp[k + 2] = b.p.z;
            bp[k + 3] = b.p.x - tmp.x * 5; bp[k + 4] = b.p.y - tmp.y * 5; bp[k + 5] = b.p.z - tmp.z * 5;
          } else { bp[k] = bp[k + 1] = bp[k + 2] = bp[k + 3] = bp[k + 4] = bp[k + 5] = 0; }
        }
        bgeo.attributes.position.needsUpdate = true;
      },
      collide(p, r) {
        for (const b of bullets) {
          if (b.life <= 0) continue;
          // distance from p to segment q->p (path travelled this frame)
          tmp.subVectors(b.p, b.q);
          const l2 = tmp.lengthSq();
          let u = l2 > 0 ? ((p.x - b.q.x) * tmp.x + (p.y - b.q.y) * tmp.y + (p.z - b.q.z) * tmp.z) / l2 : 0;
          u = Math.max(0, Math.min(1, u));
          const dx = b.q.x + tmp.x * u - p.x, dy = b.q.y + tmp.y * u - p.y, dz = b.q.z + tmp.z * u - p.z;
          if (dx * dx + dy * dy + dz * dz < (r + 0.25) * (r + 0.25)) return 'anti-air fire';
        }
        const dx = p.x - o.x, dz = p.z - o.z;
        if (dx * dx + dz * dz < (2 + r) * (2 + r) && p.y < o.y + 2.6) return 'anti-air gun';
        return null;
      },
      near(p) { return Math.hypot(p.x - o.x, p.z - o.z) - 2; },
      get locked() { return locked; },
      geo: [bgeo, barrelGeo],
    };
  }

  // artillery shells landing near the drone's path (warning ring first)
  function Artillery(root, o, ctx) {
    // o: {interval, radius}
    const ringGeo = new T.RingGeometry(o.radius * 0.85, o.radius, 40);
    ringGeo.rotateX(-Math.PI / 2);
    const ringMat = new T.MeshBasicMaterial({ color: 0xff3020, transparent: true, opacity: 0.6, depthWrite: false, side: T.DoubleSide });
    const ring = new T.Mesh(ringGeo, ringMat); ring.visible = false; root.add(ring);
    let timer = o.interval * (0.6 + ctx.rand() * 0.6), pending = null, blast = null;
    return {
      update(dt, time, dp, dv) {
        if (!dp) return;
        timer -= dt;
        if (!pending && timer <= 0) {
          const ahead = dv ? dv.clone().multiplyScalar(1.6) : new T.Vector3();
          const x = dp.x + ahead.x + (ctx.rand() - 0.5) * 24, z = dp.z + ahead.z + (ctx.rand() - 0.5) * 24;
          pending = { x, z, y: ctx.groundAt(x, z), t: 1.6 };
          ring.position.set(x, pending.y + 0.3, z); ring.visible = true;
          if (Sfx.whistle) Sfx.whistle();
        }
        if (pending) {
          pending.t -= dt;
          ringMat.opacity = 0.35 + 0.35 * Math.sin(time * 18);
          if (pending.t <= 0) {
            const at = new T.Vector3(pending.x, pending.y + 1.5, pending.z);
            FX.explode(at, 1.1);
            Sfx.explosion(false, Math.max(0.15, 1 - at.distanceTo(dp) / 120));
            blast = { p: at, t: 0.3 };
            pending = null; ring.visible = false;
            timer = o.interval * (0.7 + ctx.rand() * 0.6);
          }
        }
        if (blast) { blast.t -= dt; if (blast.t <= 0) blast = null; }
      },
      collide(p, r) { return blast && p.distanceTo(blast.p) < o.radius + r ? 'artillery strike' : null; },
      near() { return 1e9; },
      geo: [ringGeo], mats: [ringMat],
    };
  }

  // ---------- target models ----------
  function makeTarget(kind) {
    const g = new T.Group();
    const add = (geo, m, x, y, z, rx, ry, rz) => {
      const mesh = new T.Mesh(geo, m); mesh.position.set(x, y, z);
      if (rx) mesh.rotation.x = rx; if (ry) mesh.rotation.y = ry; if (rz) mesh.rotation.z = rz;
      mesh.castShadow = true; g.add(mesh); return mesh;
    };
    const camo = mat('camoS', () => new T.MeshLambertMaterial({ map: TEX.camo() }));
    const tire = mat('tire', () => new T.MeshLambertMaterial({ color: 0x1a1a1a }));
    const red = mat('redLed', () => new T.MeshBasicMaterial({ color: 0xff2a1a }));
    let r = 2, spin = null;
    if (kind === 'truck') {
      add(new T.BoxGeometry(2.4, 1.8, 2), camo, 0, 1.6, -2.4);
      add(new T.BoxGeometry(2.5, 2.2, 4.6), camo, 0, 1.9, 0.9);
      const wg = new T.CylinderGeometry(0.55, 0.55, 0.4, 14); wg.rotateZ(Math.PI / 2);
      for (const z of [-2.4, 0, 2]) for (const x of [-1.2, 1.2]) add(wg, tire, x, 0.55, z);
      r = 3.6;
    } else if (kind === 'tank') {
      add(new T.BoxGeometry(3.4, 1.2, 6.4), camo, 0, 1.0, 0);
      add(new T.BoxGeometry(3.6, 0.9, 6.8), tire, 0, 0.45, 0);
      add(new T.BoxGeometry(2.2, 0.9, 2.6), camo, 0, 2.05, 0.3);
      const bg = new T.CylinderGeometry(0.13, 0.15, 4, 10); bg.rotateX(Math.PI / 2);
      add(bg, camo, 0, 2.1, -2.6);
      r = 4;
    } else if (kind === 'radar') {
      add(new T.BoxGeometry(2.6, 1.6, 5), camo, 0, 1.3, 0);
      add(new T.CylinderGeometry(0.25, 0.3, 2, 8), mat('metal', () => new T.MeshLambertMaterial({ map: TEX.metal() })), 0, 3, 0);
      const dish = add(new T.CylinderGeometry(2, 0.3, 0.5, 20, 1, true), mat('dish', () => new T.MeshLambertMaterial({ color: 0xd8dde0, side: T.DoubleSide })), 0, 4.2, 0, Math.PI / 2.6);
      spin = dish;
      r = 3.6;
    } else if (kind === 'server') {
      add(new T.BoxGeometry(1, 2, 1), darkMat(), 0, 1, 0);
      for (let i = 0; i < 6; i++) add(new T.BoxGeometry(0.08, 0.08, 0.02), i % 2 ? red : mat('greenLed', () => new T.MeshBasicMaterial({ color: 0x40ff60 })), 0.3, 0.3 + i * 0.28, -0.51);
      r = 1.6;
    } else if (kind === 'bomb') {
      add(new T.BoxGeometry(1.4, 0.8, 1), mat('olive', () => new T.MeshLambertMaterial({ color: 0x4b5536 })), 0, 0.4, 0);
      const cg = new T.CylinderGeometry(0.22, 0.22, 1.3, 12); cg.rotateZ(Math.PI / 2);
      for (const z of [-0.25, 0.25]) add(cg, mat('cylRed', () => new T.MeshLambertMaterial({ color: 0x8a1c14 })), 0, 1.0, z);
      add(new T.BoxGeometry(0.5, 0.3, 0.05), mat('screen', () => new T.MeshBasicMaterial({ color: 0x30ff60 })), 0, 0.5, -0.53);
      r = 1.4;
    } else { // ammo crates
      const wood = mat('crate', () => new T.MeshLambertMaterial({ map: TEX.logs() }));
      add(new T.BoxGeometry(1.8, 1.1, 1.2), wood, 0, 0.55, 0);
      add(new T.BoxGeometry(1.8, 1.1, 1.2), wood, 0.2, 1.65, 0.1, 0, 0.3);
      add(new T.BoxGeometry(1.2, 0.9, 1.0), camo, 1.7, 0.45, 0.3, 0, -0.4);
      r = 2;
    }
    // red beacon + glow so it reads as the target
    const top = kind === 'server' ? 2.2 : kind === 'bomb' ? 1.5 : kind === 'radar' ? 5.6 : kind === 'tank' ? 2.8 : kind === 'truck' ? 3.2 : 2.4;
    const beacon = add(new T.SphereGeometry(0.18, 10, 8), red, 0, top + 0.2, 0);
    const glow = new T.Sprite(new T.SpriteMaterial({ map: TEX.glow(), color: 0xff3020, blending: T.AdditiveBlending, transparent: true, depthWrite: false }));
    glow.position.set(0, top + 0.2, 0); glow.scale.setScalar(3); g.add(glow);
    const center = new T.Vector3(0, top * 0.45, 0);
    return {
      group: g, r, center,
      animate(time) {
        const on = Math.sin(time * 7) > 0;
        beacon.visible = on;
        glow.material.opacity = on ? 0.95 : 0.25;
        glow.scale.setScalar(on ? 3.6 : 2.4);
        if (spin) spin.rotation.z = time * 1.2;
      },
    };
  }

  // ---------- instanced trees ----------
  function Trees(root, list) {
    // list: {x,y,z,h,type:'pine'|'oak',cr (canopy radius), tr (trunk r)}
    const disposables = [];
    const trunkGeo = new T.CylinderGeometry(0.7, 1, 1, 7); trunkGeo.translate(0, 0.5, 0);
    const pineGeo = new T.ConeGeometry(1, 1, 8); pineGeo.translate(0, 0.5, 0);
    const oakGeo = new T.IcosahedronGeometry(1, 1);
    disposables.push(trunkGeo, pineGeo, oakGeo);
    const barkM = new T.MeshLambertMaterial({ map: TEX.bark() });
    const leafM = new T.MeshLambertMaterial({ map: TEX.leaves(), vertexColors: false });
    const leafM2 = new T.MeshLambertMaterial({ map: TEX.leaves(), color: 0x9fb07a });
    disposables.push(barkM, leafM, leafM2);
    const pines = list.filter((t) => t.type === 'pine'), oaks = list.filter((t) => t.type !== 'pine');
    const trunks = new T.InstancedMesh(trunkGeo, barkM, list.length);
    const pineM = new T.InstancedMesh(pineGeo, leafM, Math.max(1, pines.length * 2));
    const oakM = new T.InstancedMesh(oakGeo, leafM2, Math.max(1, oaks.length));
    const m4 = new T.Matrix4(), q = new T.Quaternion(), s = new T.Vector3(), p = new T.Vector3(), e = new T.Euler();
    const col = new T.Color();
    list.forEach((t, i) => {
      const th = t.type === 'pine' ? t.h * 0.9 : t.h * 0.62;
      m4.compose(p.set(t.x, t.y - 0.3, t.z), q.identity(), s.set(t.tr, th, t.tr)); trunks.setMatrixAt(i, m4);
    });
    pines.forEach((t, i) => {
      e.set(0, t.x * 7.1, 0); q.setFromEuler(e);
      m4.compose(p.set(t.x, t.y + t.h * 0.22, t.z), q, s.set(t.cr, t.h * 0.55, t.cr)); pineM.setMatrixAt(i * 2, m4);
      m4.compose(p.set(t.x, t.y + t.h * 0.5, t.z), q, s.set(t.cr * 0.7, t.h * 0.5, t.cr * 0.7)); pineM.setMatrixAt(i * 2 + 1, m4);
      col.setHSL(0.27 + (t.x * 0.013 % 0.04), 0.45, 0.32 + ((t.z * 0.017) % 0.08));
      pineM.setColorAt(i * 2, col); pineM.setColorAt(i * 2 + 1, col);
    });
    oaks.forEach((t, i) => {
      e.set(t.x, t.z, 0); q.setFromEuler(e);
      m4.compose(p.set(t.x, t.y + t.h * 0.68, t.z), q, s.set(t.cr, t.cr * 0.85, t.cr)); oakM.setMatrixAt(i, m4);
      col.setHSL(0.22 + ((t.x * 0.011) % 0.06), 0.5, 0.36 + ((t.z * 0.013) % 0.1));
      oakM.setColorAt(i, col);
    });
    if (!pines.length) pineM.count = 0;
    if (!oaks.length) oakM.count = 0;
    for (const m of [trunks, pineM, oakM]) { m.castShadow = true; m.receiveShadow = true; root.add(m); }
    return disposables;
  }

  return { mulberry32, TEX, MATDEF, Builder, Colliders, Spinner, Patrol, Door, Laser, AAGun, Artillery, makeTarget, Trees, mat };
})();
