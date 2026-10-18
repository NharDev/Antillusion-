// World: procedural city per level, hazards, target and collision.
const World = (() => {
  const T = THREE;

  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  const THEMES = [
    { name: 'DAY', top: 0x3f86d6, bottom: 0xcfe9ff, fog: 0xcfe9ff, fogNear: 160, fogFar: 700, sun: 1.15, sunCol: 0xfff3dd, hemi: 0.85, emissive: 0.0, light: false, tint: [0xffffff, 0xe9dfcf, 0xcfd9e6, 0xdcc6b8, 0xbfcabb, 0xaebbd0] },
    { name: 'SUNSET', top: 0x2b3a73, bottom: 0xff9a5c, fog: 0xe8966e, fogNear: 100, fogFar: 520, sun: 0.95, sunCol: 0xffa766, hemi: 0.6, emissive: 0.22, light: false, tint: [0xffe8d0, 0xe2c8b0, 0xc8c3d6, 0xd9b4a0, 0xb9b8aa, 0xa8a8c4] },
    { name: 'FOG', top: 0x7a8794, bottom: 0xa3aeb8, fog: 0x98a4af, fogNear: 14, fogFar: 230, sun: 0.55, sunCol: 0xdde6ee, hemi: 0.75, emissive: 0.4, light: true, tint: [0xe6eaee, 0xd2d8de, 0xc2cad2, 0xb9bfc6, 0xaab4bb, 0xcfc9c0] },
    { name: 'NIGHT', top: 0x03050d, bottom: 0x1b2447, fog: 0x0a1020, fogNear: 18, fogFar: 270, sun: 0.28, sunCol: 0x7f95ff, hemi: 0.28, emissive: 1.0, light: true, tint: [0xb9c0d6, 0xa6adc4, 0x9ba3bd, 0xb4a8a8, 0x98a8a0, 0x8d9bb8] },
  ];

  const ACTIVE = (L) => ({
    wind: L >= 4,
    patrols: L >= 3,
    poles: L >= 2,
    cables: L >= 5,
    alleys: L >= 5,
    moving: L >= 6,
    spinners: L >= 8,
  });

  function params(L) {
    const N = Math.min(11, 3 + Math.ceil(L * 0.6));
    const S = Math.max(12, 30 - L * 1.5);
    const B = 38;
    const themeIdx = Math.min(3, Math.floor((L - 1) / 3));
    const a = ACTIVE(L);
    return {
      L, N, S, B, P: B + S, theme: THEMES[themeIdx], themeIdx,
      minH: 16, maxH: Math.min(85, 28 + L * 4),
      ceiling: Math.max(26, 52 - L * 2),
      targetD: Math.max(2, Math.min(2 * N - 1, Math.round(2 + L * 0.9))),
      targetR: Math.max(2.4, 4.6 - 0.14 * L),
      wind: a.wind ? Math.min(5.5, 0.7 * (L - 3)) : 0,
      patrols: a.patrols ? Math.min(10, 1 + Math.floor((L - 3) / 1.5)) : 0,
      poles: a.poles ? Math.min(16, 2 + L) : 0,
      cables: a.cables ? Math.min(9, L - 4) : 0,
      alleyChance: a.alleys ? Math.min(0.7, 0.3 + 0.03 * L) : 0,
      alleyW: Math.max(6, 10 - L * 0.35),
      moving: a.moving,
      spinners: a.spinners ? Math.min(6, L - 7) : 0,
      beam: L <= 4 ? 0.5 : L <= 6 ? 0.28 : 0,
      markerRange: L <= 4 ? 1e9 : L <= 8 ? 130 : 75,
    };
  }

  function hazardsList(p) {
    const h = [];
    if (p.wind) h.push('WIND');
    if (p.patrols) h.push('PATROL DRONES');
    if (p.poles) h.push('LAMP POSTS');
    if (p.cables) h.push('CABLES');
    if (p.alleyChance) h.push('NARROW ALLEYS');
    if (p.moving) h.push('MOVING TARGET');
    if (p.spinners) h.push('SPINNING BLADES');
    if (p.theme.name !== 'DAY') h.push(p.theme.name);
    return h;
  }

  // ---------- textures ----------
  function windowTextures() {
    const W = 256, H = 384, cols = 4, rows = 6;
    const diff = document.createElement('canvas'); diff.width = W; diff.height = H;
    const emis = document.createElement('canvas'); emis.width = W; emis.height = H;
    const d = diff.getContext('2d'), e = emis.getContext('2d');
    d.fillStyle = '#c9ccd2'; d.fillRect(0, 0, W, H);
    for (let i = 0; i < 1400; i++) {
      const g = 190 + Math.random() * 30;
      d.fillStyle = `rgba(${g},${g},${g + 4},0.25)`;
      d.fillRect(Math.random() * W, Math.random() * H, 2, 2);
    }
    e.fillStyle = '#000'; e.fillRect(0, 0, W, H);
    const cw = W / cols, ch = H / rows;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const x = c * cw + cw * 0.2, y = r * ch + ch * 0.2, w = cw * 0.6, h = ch * 0.55;
        const gr = d.createLinearGradient(x, y, x, y + h);
        gr.addColorStop(0, '#5b7da0'); gr.addColorStop(1, '#1d2c3f');
        d.fillStyle = gr; d.fillRect(x, y, w, h);
        d.fillStyle = 'rgba(255,255,255,0.18)';
        d.beginPath(); d.moveTo(x, y + h); d.lineTo(x + w * 0.45, y); d.lineTo(x + w * 0.7, y); d.lineTo(x + w * 0.25, y + h); d.fill();
        d.fillStyle = '#9aa0a8'; d.fillRect(x - 2, y + h, w + 4, 3); // sill
        if (Math.random() < 0.42) {
          const warm = Math.random();
          e.fillStyle = warm < 0.7 ? '#ffd48a' : warm < 0.9 ? '#fff2cf' : '#9fd0ff';
          e.fillRect(x, y, w, h);
        }
      }
    }
    const mk = (cv) => {
      const t = new T.CanvasTexture(cv);
      t.wrapS = t.wrapT = T.RepeatWrapping;
      t.anisotropy = 4;
      return t;
    };
    return { map: mk(diff), emissive: mk(emis) };
  }
  const TILE_W = 12.8, TILE_H = 21;

  function groundTexture(P, B, S) {
    const px = 512;
    const cv = document.createElement('canvas'); cv.width = cv.height = px;
    const c = cv.getContext('2d');
    c.fillStyle = '#2a2d33'; c.fillRect(0, 0, px, px);
    for (let i = 0; i < 4000; i++) {
      const g = 30 + Math.random() * 25;
      c.fillStyle = `rgba(${g},${g},${g + 3},0.5)`;
      c.fillRect(Math.random() * px, Math.random() * px, 2, 2);
    }
    const m = px / P;
    const side = (B + 1.5) * m; // sidewalk block
    c.fillStyle = '#6e7178';
    c.fillRect((px - side) / 2, (px - side) / 2, side, side);
    c.fillStyle = '#51545b';
    const ins = (B - 1) * m;
    c.fillRect((px - ins) / 2, (px - ins) / 2, ins, ins);
    // dashed centre lines in the streets (tile edges = street centres)
    c.fillStyle = '#d9c75a';
    const dash = 3.2 * m, gap = 3.2 * m, lw = Math.max(2, 0.35 * m);
    for (let y = 0; y < px; y += dash + gap) {
      c.fillRect(0 - lw / 2, y, lw, dash); c.fillRect(px - lw / 2, y, lw, dash);
    }
    for (let x = 0; x < px; x += dash + gap) {
      c.fillRect(x, 0 - lw / 2, dash, lw); c.fillRect(x, px - lw / 2, dash, lw);
    }
    const t = new T.CanvasTexture(cv);
    t.wrapS = t.wrapT = T.RepeatWrapping;
    t.anisotropy = 8;
    return t;
  }

  function glowTexture() {
    const cv = document.createElement('canvas'); cv.width = cv.height = 64;
    const c = cv.getContext('2d');
    const g = c.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.35, 'rgba(255,255,255,0.45)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    c.fillStyle = g; c.fillRect(0, 0, 64, 64);
    return new T.CanvasTexture(cv);
  }

  // ---------- merged geometry builder ----------
  function Builder() {
    const pos = [], nor = [], uv = [], col = [], idx = [];
    let n = 0;
    const tmp = new T.Color();
    function quad(p0, p1, p2, p3, nx, ny, nz, uvs, c0, c1) {
      const ps = [p0, p1, p2, p3];
      for (let i = 0; i < 4; i++) {
        pos.push(ps[i][0], ps[i][1], ps[i][2]);
        nor.push(nx, ny, nz);
        uv.push(uvs[i][0], uvs[i][1]);
        const cc = i < 2 ? c0 : c1;
        col.push(cc[0], cc[1], cc[2]);
      }
      idx.push(n, n + 1, n + 2, n, n + 2, n + 3);
      n += 4;
    }
    function shade(base, f) { return [base.r * f, base.g * f, base.b * f]; }
    // windowed box. tint: hex. roofOnly: plain colour sides (props)
    function box(x0, z0, x1, z1, y0, y1, tint, plain) {
      tmp.setHex(tint);
      const base = { r: tmp.r, g: tmp.g, b: tmp.b };
      const ou = Math.random();
      const segs = [];
      const mid = Math.min(y0 + 6, y1);
      if (mid > y0 + 0.01) segs.push([y0, mid, 0.5, 1.0]);
      if (y1 > mid + 0.01) segs.push([mid, y1, 1.0, 1.0]);
      const P0 = 0.002;
      for (const [ya, yb, fa, fb] of segs) {
        const ca = shade(base, fa), cb = shade(base, fb);
        const va = plain ? P0 : ya / TILE_H, vb = plain ? P0 : yb / TILE_H;
        const uA = (a) => (plain ? P0 : a / TILE_W + ou);
        // +z
        quad([x0, ya, z1], [x1, ya, z1], [x1, yb, z1], [x0, yb, z1], 0, 0, 1, [[uA(x0), va], [uA(x1), va], [uA(x1), vb], [uA(x0), vb]], ca, cb);
        // -z
        quad([x1, ya, z0], [x0, ya, z0], [x0, yb, z0], [x1, yb, z0], 0, 0, -1, [[uA(x1), va], [uA(x0), va], [uA(x0), vb], [uA(x1), vb]], ca, cb);
        // +x
        quad([x1, ya, z1], [x1, ya, z0], [x1, yb, z0], [x1, yb, z1], 1, 0, 0, [[uA(z1), va], [uA(z0), va], [uA(z0), vb], [uA(z1), vb]], ca, cb);
        // -x
        quad([x0, ya, z0], [x0, ya, z1], [x0, yb, z1], [x0, yb, z0], -1, 0, 0, [[uA(z0), va], [uA(z1), va], [uA(z1), vb], [uA(z0), vb]], ca, cb);
      }
      const rc = shade(base, 0.62);
      quad([x0, y1, z0], [x0, y1, z1], [x1, y1, z1], [x1, y1, z0], 0, 1, 0, [[P0, P0], [P0, P0], [P0, P0], [P0, P0]], rc, rc);
    }
    function build() {
      const g = new T.BufferGeometry();
      g.setAttribute('position', new T.Float32BufferAttribute(pos, 3));
      g.setAttribute('normal', new T.Float32BufferAttribute(nor, 3));
      g.setAttribute('uv', new T.Float32BufferAttribute(uv, 2));
      g.setAttribute('color', new T.Float32BufferAttribute(col, 3));
      g.setIndex(idx);
      g.computeBoundingSphere();
      return g;
    }
    return { box, build };
  }

  // ---------- level construction ----------
  function build(L, scene) {
    const p = params(L);
    const rand = mulberry32(L * 7919 + 13);
    const R = (a, b) => a + (b - a) * rand();
    const pick = (arr) => arr[Math.floor(rand() * arr.length)];
    const { N, S, B, P, theme } = p;
    const root = new T.Group();
    scene.add(root);
    const disposables = [];
    const track = (o) => { disposables.push(o); return o; };

    const boxes = [];   // [minx,miny,minz,maxx,maxy,maxz]
    const boxKind = [];
    const addCollider = (x0, y0, z0, x1, y1, z1, kind) => { boxes.push([x0, y0, z0, x1, y1, z1]); boxKind.push(kind); };
    const cyls = [];    // {x,z,r,h,kind}

    const streetAt = (k) => (k - 0.5) * P;
    const bounds = { lo: streetAt(0) - S / 2 + 1.2, hi: streetAt(N) + S / 2 - 1.2 };

    const tex = windowTextures();
    track(tex.map); track(tex.emissive);
    const bd = Builder();
    const alleys = [];
    const blockCenter = (c) => c * P;
    const mid = (N - 1) / 2;
    const maxDist = Math.hypot(mid, mid) + 1;

    function skyscraperHeight(i, j) {
      const dist = Math.hypot(i - mid, j - mid) / maxDist;
      const f = 1.0 - 0.45 * dist;
      const h = p.minH + (p.maxH - p.minH) * Math.pow(rand(), 1.2);
      return Math.max(p.minH, h * (0.7 + 0.6 * f));
    }

    function addBuilding(x0, z0, x1, z1, h, collide) {
      bd.box(x0, z0, x1, z1, 0, h, pick(theme.tint));
      if (collide) addCollider(x0, 0, z0, x1, h, z1, 'building');
      // rooftop props
      const w = x1 - x0, d = z1 - z0;
      if (w > 8 && d > 8) {
        const nProps = Math.floor(R(0, 3));
        for (let q = 0; q < nProps; q++) {
          const pw = R(2, 4.5), pd = R(2, 4.5), ph = R(1.2, 2.6);
          const px = R(x0 + 1, x1 - 1 - pw), pz = R(z0 + 1, z1 - 1 - pd);
          bd.box(px, pz, px + pw, pz + pd, h, h + ph, 0x8a8d94, true);
          if (collide) addCollider(px, h, pz, px + pw, h + ph, pz + pd, 'building');
        }
        if (h > 30 && rand() < 0.5) {
          const ah = R(4, 9), ax = R(x0 + 2, x1 - 2), az = R(z0 + 2, z1 - 2);
          bd.box(ax - 0.2, az - 0.2, ax + 0.2, az + 0.2, h, h + ah, 0xb0b3b8, true);
          if (collide) addCollider(ax - 0.2, h, az - 0.2, ax + 0.2, h + ah, az + 0.2, 'antenna');
        }
      }
    }

    // real blocks
    for (let i = 0; i < N; i++) {
      for (let j = 0; j < N; j++) {
        const cx = blockCenter(i), cz = blockCenter(j);
        const hx = B / 2 - R(0, 1.6), hz = B / 2 - R(0, 1.6);
        if (rand() < p.alleyChance) {
          const a = p.alleyW;
          if (rand() < 0.5) { // alley runs along Z, splits X
            addBuilding(cx - hx, cz - hz, cx - a / 2, cz + hz, skyscraperHeight(i, j), true);
            addBuilding(cx + a / 2, cz - hz, cx + hx, cz + hz, skyscraperHeight(i, j), true);
            alleys.push({ x: cx, z: cz, axis: 'z', i, j });
          } else {
            addBuilding(cx - hx, cz - hz, cx + hx, cz - a / 2, skyscraperHeight(i, j), true);
            addBuilding(cx - hx, cz + a / 2, cx + hx, cz + hz, skyscraperHeight(i, j), true);
            alleys.push({ x: cx, z: cz, axis: 'x', i, j });
          }
        } else {
          addBuilding(cx - hx, cz - hz, cx + hx, cz + hz, skyscraperHeight(i, j), true);
        }
      }
    }
    // far blocks: scenery only (unreachable, bounds keep the drone inside)
    const FAR = 6;
    for (let i = -FAR; i < N + FAR; i++) {
      for (let j = -FAR; j < N + FAR; j++) {
        if (i >= 0 && i < N && j >= 0 && j < N) continue;
        const cx = blockCenter(i), cz = blockCenter(j);
        const hx = B / 2 - R(0, 3), hz = B / 2 - R(0, 3);
        const ring = Math.max(Math.abs(i - mid), Math.abs(j - mid)) - N / 2;
        const h = R(28, 70) + ring * R(2, 9);
        addBuilding(cx - hx, cz - hz, cx + hx, cz + hz, h, false);
      }
    }

    const cityGeo = track(bd.build());
    const cityMat = track(new T.MeshLambertMaterial({
      map: tex.map, emissiveMap: tex.emissive, emissive: 0xffffff, vertexColors: true,
    }));
    cityMat.emissive.setScalar(theme.emissive);
    root.add(new T.Mesh(cityGeo, cityMat));

    // ground
    const nTiles = (N + 2 * FAR) | 1;
    const gTex = track(groundTexture(P, B, S));
    gTex.repeat.set(nTiles, nTiles);
    const cI = Math.floor(N / 2);
    const ground = new T.Mesh(
      new T.PlaneGeometry(nTiles * P, nTiles * P),
      track(new T.MeshLambertMaterial({ map: gTex }))
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.set(cI * P, 0, cI * P);
    root.add(ground);
    disposables.push(ground.geometry);

    // street intersections / helpers
    const spawnXZ = new T.Vector2(streetAt(0), streetAt(0));
    const farFromSpawn = (x, z, d) => Math.hypot(x - spawnXZ.x, z - spawnXZ.y) > d;

    // ---- target ----
    let tx, tz, ty, tAxis = null, tBase = null;
    {
      // candidate intersections at lattice distance targetD
      const cands = [];
      for (let k = 0; k <= N; k++) for (let l = 0; l <= N; l++) if (k + l === p.targetD) cands.push([k, l]);
      const useAlley = alleys.length && rand() < 0.4 && p.L >= 5;
      if (useAlley) {
        // pick the alley closest to the desired lattice distance
        let best = null, bd2 = 1e9;
        for (const a of alleys) {
          const d = Math.abs(a.i + a.j + 1 - p.targetD) + rand() * 0.9;
          if (d < bd2) { bd2 = d; best = a; }
        }
        tx = best.x; tz = best.z; ty = R(3.5, 9);
      } else {
        const c = pick(cands.length ? cands : [[N, N]]);
        tx = streetAt(c[0]); tz = streetAt(c[1]);
        const wantMid = p.moving || rand() < 0.6;
        if (wantMid) {
          // move half a block along a street that stays inside the lattice
          const opts = [];
          if (c[0] > 0) opts.push(['x', -1]);
          if (c[0] < N) opts.push(['x', 1]);
          if (c[1] > 0) opts.push(['z', -1]);
          if (c[1] < N) opts.push(['z', 1]);
          const o = pick(opts);
          if (o[0] === 'x') { tx += o[1] * P / 2; tAxis = 'x'; } else { tz += o[1] * P / 2; tAxis = 'z'; }
        }
        ty = R(3.5, Math.min(22, 7 + L * 1.2));
      }
      tBase = new T.Vector3(tx, ty, tz);
    }

    // ---- lamp posts ----
    const lampMat = track(new T.MeshLambertMaterial({ color: 0x555a62 }));
    const lampGeo = track(new T.CylinderGeometry(0.35, 0.45, 12, 8));
    const lampHeadGeo = track(new T.SphereGeometry(0.7, 8, 6));
    const lampHeadMat = track(new T.MeshBasicMaterial({ color: 0xffe9a8 }));
    const usedInter = new Set();
    for (let q = 0; q < p.poles; q++) {
      let x, z, tries = 0;
      do {
        const k = 1 + Math.floor(rand() * Math.max(1, N - 1)), l = Math.floor(rand() * (N + 1));
        if (rand() < 0.5) { x = streetAt(k); z = streetAt(l); } else { x = streetAt(l); z = streetAt(k); }
        tries++;
      } while (tries < 20 && (!farFromSpawn(x, z, 28) || usedInter.has(x + ',' + z) || Math.hypot(x - tx, z - tz) < 12));
      usedInter.add(x + ',' + z);
      const m = new T.Mesh(lampGeo, lampMat); m.position.set(x, 6, z); root.add(m);
      const hd = new T.Mesh(lampHeadGeo, lampHeadMat); hd.position.set(x, 12.4, z); root.add(hd);
      cyls.push({ x, z, r: 0.5, h: 13, kind: 'lamp post' });
    }

    // ---- cables across streets ----
    const cableMat = track(new T.MeshLambertMaterial({ color: 0x22252b }));
    const markMat = track(new T.MeshBasicMaterial({ color: 0xff5a2a }));
    const markGeo = track(new T.SphereGeometry(0.55, 8, 6));
    for (let q = 0; q < p.cables; q++) {
      let x, z, along, tries = 0;
      do {
        const k = Math.floor(rand() * (N + 1)), l = Math.floor(rand() * N);
        // cable crosses a street that runs along `along`
        if (rand() < 0.5) { along = 'x'; x = streetAt(k); z = blockCenter(l) + R(-8, 8); }
        else { along = 'z'; z = streetAt(k); x = blockCenter(l) + R(-8, 8); }
        tries++;
      } while (tries < 20 && (!farFromSpawn(x, z, 35) || Math.hypot(x - tx, z - tz) < 10));
      if (k_isOuter(along === 'x' ? x : z)) continue;
      const y = R(5.5, 18);
      const len = S + 6;
      const g = track(new T.CylinderGeometry(0.13, 0.13, len, 6));
      const m = new T.Mesh(g, cableMat);
      m.position.set(x, y, z);
      if (along === 'x') { m.rotation.z = Math.PI / 2; addCollider(x - len / 2, y - 0.2, z - 0.2, x + len / 2, y + 0.2, z + 0.2, 'cable'); }
      else { m.rotation.x = Math.PI / 2; addCollider(x - 0.2, y - 0.2, z - len / 2, x + 0.2, y + 0.2, z + len / 2, 'cable'); }
      root.add(m);
      for (let s = -len / 2 + 5; s < len / 2 - 3; s += 7) {
        const mk = new T.Mesh(markGeo, markMat);
        if (along === 'x') mk.position.set(x + s, y, z); else mk.position.set(x, y, z + s);
        root.add(mk);
      }
    }
    function k_isOuter(c) { return c < bounds.lo + S || c > bounds.hi - S; } // cables only inside the lattice

    // ---- spinning blades ----
    const spinners = [];
    {
      const barMat = track(new T.MeshLambertMaterial({ color: 0xff8a1f, emissive: 0x552200 }));
      const stripeMat = track(new T.MeshLambertMaterial({ color: 0x1a1a1a }));
      for (let q = 0; q < p.spinners; q++) {
        let x, z, tries = 0;
        do {
          x = streetAt(1 + Math.floor(rand() * (N - 1)));
          z = streetAt(1 + Math.floor(rand() * (N - 1)));
          tries++;
        } while (tries < 20 && (!farFromSpawn(x, z, 40) || usedInter.has(x + ',' + z) || Math.hypot(x - tx, z - tz) < 16));
        usedInter.add(x + ',' + z);
        const y = R(6, 13), len = Math.min(S * 0.9, 24);
        const g = new T.Group();
        const bar = new T.Mesh(track(new T.BoxGeometry(len, 0.7, 0.7)), barMat);
        g.add(bar);
        for (let s = -len / 2 + 1.5; s < len / 2; s += 3) {
          const st = new T.Mesh(track(new T.BoxGeometry(1.2, 0.74, 0.74)), stripeMat);
          st.position.x = s; g.add(st);
        }
        g.position.set(x, y, z);
        root.add(g);
        const pole = new T.Mesh(track(new T.CylinderGeometry(0.4, 0.5, y, 8)), lampMat);
        pole.position.set(x, y / 2, z); root.add(pole);
        cyls.push({ x, z, r: 0.6, h: y + 0.5, kind: 'blade pylon' });
        spinners.push({ g, x, y, z, len, w: (0.8 + 0.07 * L) * (rand() < 0.5 ? -1 : 1), a: R(0, 6.28) });
      }
    }

    // ---- patrol drones ----
    const patrols = [];
    {
      const bodyMat = track(new T.MeshLambertMaterial({ color: 0x20232a }));
      const rotMat = track(new T.MeshBasicMaterial({ color: 0xbfd8ff, transparent: true, opacity: 0.35 }));
      const eyeMat = track(new T.MeshBasicMaterial({ color: 0xff2030 }));
      const bodyGeo = track(new T.BoxGeometry(1.5, 0.45, 1.5));
      const armGeo = track(new T.BoxGeometry(3.4, 0.12, 0.2));
      const rotGeo = track(new T.CylinderGeometry(0.75, 0.75, 0.03, 14));
      const eyeGeo = track(new T.SphereGeometry(0.28, 8, 6));
      for (let q = 0; q < p.patrols; q++) {
        let axis, line, a, b, tries = 0, y = R(4, 19);
        do {
          axis = rand() < 0.5 ? 'x' : 'z';
          const k = Math.floor(rand() * (N + 1)), l = Math.floor(rand() * N);
          line = streetAt(k);
          a = streetAt(l) - 6; b = streetAt(l + 1) + 6;
          tries++;
          const px = axis === 'x' ? line : (a + b) / 2, pz = axis === 'x' ? (a + b) / 2 : line;
          if (farFromSpawn(px, pz, 50)) break;
        } while (tries < 20);
        const lat = R(-S * 0.22, S * 0.22);
        const g = new T.Group();
        g.add(new T.Mesh(bodyGeo, bodyMat));
        const a1 = new T.Mesh(armGeo, bodyMat); a1.rotation.y = Math.PI / 4; g.add(a1);
        const a2 = new T.Mesh(armGeo, bodyMat); a2.rotation.y = -Math.PI / 4; g.add(a2);
        const rotors = [];
        for (const [rx, rz] of [[1.2, 1.2], [-1.2, 1.2], [1.2, -1.2], [-1.2, -1.2]]) {
          const r = new T.Mesh(rotGeo, rotMat); r.position.set(rx, 0.15, rz); g.add(r); rotors.push(r);
        }
        const eye = new T.Mesh(eyeGeo, eyeMat); eye.position.y = -0.35; g.add(eye);
        root.add(g);
        patrols.push({ g, axis, line, lat, a, b, y, speed: R(4, 6) + L * 0.45, phase: R(0, 6.28), rotors, pos: new T.Vector3(), r: 1.6 });
      }
    }

    // ---- target visuals ----
    const target = new T.Group();
    const tcol = 0xff3a2a;
    const shell = new T.Mesh(track(new T.SphereGeometry(p.targetR, 20, 14)),
      track(new T.MeshBasicMaterial({ color: tcol, wireframe: true, transparent: true, opacity: 0.55, blending: T.AdditiveBlending, depthWrite: false })));
    const core = new T.Mesh(track(new T.SphereGeometry(p.targetR * 0.34, 14, 10)),
      track(new T.MeshBasicMaterial({ color: 0xffd0c0, transparent: true, opacity: 0.95, blending: T.AdditiveBlending, depthWrite: false })));
    const ringMat = track(new T.MeshBasicMaterial({ color: 0xff7a40, transparent: true, opacity: 0.9, blending: T.AdditiveBlending, depthWrite: false }));
    const ringGeo = track(new T.TorusGeometry(p.targetR * 0.95, 0.14, 8, 40));
    const ring1 = new T.Mesh(ringGeo, ringMat), ring2 = new T.Mesh(ringGeo, ringMat);
    ring2.rotation.x = Math.PI / 2;
    const gl = glowTexture(); track(gl);
    const glow = new T.Sprite(track(new T.SpriteMaterial({ map: gl, color: 0xff4020, transparent: true, opacity: 0.85, blending: T.AdditiveBlending, depthWrite: false })));
    glow.scale.setScalar(p.targetR * 5);
    target.add(shell, core, ring1, ring2, glow);
    root.add(target);
    let beam = null;
    if (p.beam > 0) {
      beam = new T.Mesh(track(new T.CylinderGeometry(0.35, 0.35, 220, 10, 1, true)),
        track(new T.MeshBasicMaterial({ color: 0xff4a30, transparent: true, opacity: p.beam, blending: T.AdditiveBlending, depthWrite: false, side: T.DoubleSide })));
      root.add(beam);
    }

    // ---- launch pad ----
    {
      const pad = new T.Mesh(track(new T.CylinderGeometry(3, 3, 0.15, 24)), track(new T.MeshBasicMaterial({ color: 0x3df08a })));
      pad.position.set(spawnXZ.x, 0.08, spawnXZ.y); root.add(pad);
      const pad2 = new T.Mesh(track(new T.CylinderGeometry(2.3, 2.3, 0.18, 24)), track(new T.MeshBasicMaterial({ color: 0x103a22 })));
      pad2.position.set(spawnXZ.x, 0.09, spawnXZ.y); root.add(pad2);
    }

    // ---- sky ----
    const skyGeo = track(new T.SphereGeometry(1800, 24, 16));
    const cols = [];
    const ct = new T.Color(theme.top), cb = new T.Color(theme.bottom), cm = new T.Color();
    const sp = skyGeo.attributes.position;
    for (let i = 0; i < sp.count; i++) {
      const f = Math.pow(Math.max(0, sp.getY(i) / 1800), 0.6);
      cm.copy(cb).lerp(ct, f);
      cols.push(cm.r, cm.g, cm.b);
    }
    skyGeo.setAttribute('color', new T.Float32BufferAttribute(cols, 3));
    const sky = new T.Mesh(skyGeo, track(new T.MeshBasicMaterial({ vertexColors: true, side: T.BackSide, fog: false, depthWrite: false })));
    root.add(sky);

    // ---- lights / fog ----
    const hemi = new T.HemisphereLight(theme.top, 0x333a44, theme.hemi);
    const sun = new T.DirectionalLight(theme.sunCol, theme.sun);
    sun.position.set(-0.5, 1, 0.35).normalize();
    root.add(hemi, sun);
    scene.fog = new T.Fog(theme.fog, theme.fogNear, theme.fogFar);
    scene.background = new T.Color(theme.bottom);

    // spawn
    const startPos = new T.Vector3(spawnXZ.x, 2.4, spawnXZ.y);
    const startYaw = Math.atan2(-(tBase.x - spawnXZ.x), -(tBase.z - spawnXZ.y));

    const targetPos = new T.Vector3().copy(tBase);
    const moveAmp = p.moving && tAxis ? Math.min(P * 0.34, 7 + L) : 0;
    const moveW = R(0.35, 0.6);
    const moveHy = p.moving ? R(0, 2) : 0;

    let time = 0;
    function update(dt) {
      time += dt;
      for (const s of spinners) { s.a += s.w * dt; s.g.rotation.y = s.a; }
      for (const d of patrols) {
        const len = d.b - d.a;
        const u = 0.5 + 0.5 * Math.sin(d.phase + time * d.speed * Math.PI / len);
        const s = d.a + len * u;
        if (d.axis === 'x') d.pos.set(d.line + d.lat, d.y, s); else d.pos.set(s, d.y, d.line + d.lat);
        d.g.position.copy(d.pos);
        d.g.rotation.y += dt * 0.5;
        for (const r of d.rotors) r.rotation.y += dt * 40;
      }
      // target
      targetPos.copy(tBase);
      if (moveAmp) {
        const o = Math.sin(time * moveW) * moveAmp;
        if (tAxis === 'x') targetPos.z += o; else targetPos.x += o;
        targetPos.y += moveHy * Math.sin(time * moveW * 1.3);
      }
      target.position.copy(targetPos);
      ring1.rotation.y += dt * 1.6; ring2.rotation.z += dt * 1.1;
      const pulse = 1 + 0.12 * Math.sin(time * 6);
      core.scale.setScalar(pulse);
      shell.rotation.y += dt * 0.3;
      if (beam) beam.position.set(targetPos.x, 110, targetPos.z);
    }
    update(0);

    // returns kind string or null
    function collide(pt, r) {
      if (pt.y < 0.35) return 'ground';
      for (let i = 0; i < boxes.length; i++) {
        const b = boxes[i];
        if (pt.x > b[0] - r && pt.x < b[3] + r && pt.y > b[1] - r && pt.y < b[4] + r && pt.z > b[2] - r && pt.z < b[5] + r) return boxKind[i];
      }
      for (let i = 0; i < cyls.length; i++) {
        const c = cyls[i];
        if (pt.y < c.h + r) {
          const dx = pt.x - c.x, dz = pt.z - c.z, rr = c.r + r;
          if (dx * dx + dz * dz < rr * rr) return c.kind;
        }
      }
      for (let i = 0; i < patrols.length; i++) {
        const d = patrols[i], rr = d.r + r;
        if (pt.distanceToSquared(d.pos) < rr * rr) return 'patrol drone';
      }
      for (let i = 0; i < spinners.length; i++) {
        const s = spinners[i];
        if (Math.abs(pt.y - s.y) < 0.35 + r) {
          const dx = pt.x - s.x, dz = pt.z - s.z;
          const c = Math.cos(s.a), sn = Math.sin(s.a);
          const lx = c * dx - sn * dz, lz = sn * dx + c * dz;
          if (Math.abs(lx) < s.len / 2 + r && Math.abs(lz) < 0.35 + r) return 'spinning blade';
        }
      }
      return null;
    }

    function nearestHazard(pt) {
      // rough proximity (m) for HUD warning beeps
      let m = 1e9;
      for (let i = 0; i < boxes.length; i++) {
        const b = boxes[i];
        const dx = Math.max(b[0] - pt.x, 0, pt.x - b[3]);
        const dy = Math.max(b[1] - pt.y, 0, pt.y - b[4]);
        const dz = Math.max(b[2] - pt.z, 0, pt.z - b[5]);
        const d = Math.sqrt(dx * dx + dy * dy + dz * dz);
        if (d < m) m = d;
      }
      for (const d of patrols) m = Math.min(m, pt.distanceTo(d.pos) - d.r);
      return pt.y < 1.6 ? Math.min(m, pt.y) : m;
    }

    function dispose() {
      scene.remove(root);
      disposables.forEach((d) => d && d.dispose && d.dispose());
      scene.fog = null;
    }

    // time limit from path distance
    const pathLen = Math.abs(targetPos.x - startPos.x) + Math.abs(targetPos.z - startPos.z);
    const timeLimit = Math.round(Math.max(30, pathLen / (4.2 + 0.45 * L) + 22 - Math.min(L, 12)));

    return {
      params: p, hazards: hazardsList(p), update, collide, nearestHazard, dispose,
      startPos, startYaw, targetPos, targetR: p.targetR, bounds,
      ceiling: p.ceiling, timeLimit, theme, sun, hemi, target,
    };
  }

  return { build, params, THEMES, hazardsList };
})();
