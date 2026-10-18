// Level generators. Each receives the world context and returns
// { spawn, yaw?, target:{kind,pos,rot?,move?}, pathLen, avgSpeed, preview* }.
const Biomes = (() => {
  const T = THREE;
  const V = (x, y, z) => new T.Vector3(x, y, z);

  function labels(biome, t) {
    const L = [];
    if (biome === 'forest') {
      L.push('DENSE TREES');
      if (t >= 1) L.push('LOW CEILING', 'FALLEN LOGS', 'WIND', 'TARGET MAY BE IN A CABIN');
      if (t >= 2) L.push('HUNTER DRONES');
    } else if (biome === 'city') {
      L.push('LAMP POSTS', 'PARKED CARS');
      if (t >= 1) L.push('PATROL DRONES', 'CABLES', 'NARROW ALLEYS', 'WIND');
      if (t >= 2) L.push('SPINNING BLADES', 'MOVING TARGET');
    } else if (biome === 'battle') {
      L.push('ANTI-AIR FIRE', 'RUINS', 'WRECKS');
      if (t >= 1) L.push('RADAR LOCK ABOVE LOW ALTITUDE', 'ARTILLERY', 'BARBED WIRE', 'MOVING TANK');
      if (t >= 2) L.push('BUNKER SLIT', 'PATROL DRONES');
    } else if (biome === 'house') {
      L.push('INDOOR FLIGHT', 'DOORWAYS');
      if (t >= 1) L.push('CEILING FANS', 'POWER LINES', 'GUARD DRONES');
      if (t >= 2) L.push('LASER TRIPWIRES');
    } else if (biome === 'tunnel') {
      L.push('DARKNESS', 'PIPES', 'FANS');
      if (t >= 1) L.push('BLAST DOORS', 'VERTICAL SHAFTS');
      if (t >= 2) L.push('LASER GRIDS');
    }
    return L;
  }

  function skyFor(t, list) { return list[Math.min(t, list.length - 1)]; }

  // ---------------------------------------------------------------- FOREST
  function forest(ctx) {
    const { tier: t, R, rand } = ctx;
    ctx.labels = labels('forest', t);
    ctx.sky = skyFor(t, ['day', 'sunset', 'fog', 'night']);
    const A = Math.min(470, 230 + t * 70), half = A / 2;
    const amp = Math.min(13, 4 + t * 3);
    const ph = [R(0, 6), R(0, 6), R(0, 6), R(0, 6)];
    const raw = (x, z) => amp * (0.55 * Math.sin(x * 0.017 + ph[0]) * Math.cos(z * 0.014 + ph[1]) + 0.3 * Math.sin(x * 0.043 + z * 0.037 + ph[2]) + 0.15 * Math.sin(x * 0.11 + ph[3]) * Math.sin(z * 0.09));
    const flats = [];
    const ground = (x, z) => {
      let h = raw(x, z);
      for (const f of flats) {
        const d = Math.hypot(x - f.x, z - f.z);
        if (d < f.r + 10) { const k = d < f.r ? 1 : 1 - (d - f.r) / 10; const s = k * k * (3 - 2 * k); h = h * (1 - s) + f.h * s; }
      }
      return h;
    };
    ctx.groundAt = ground;

    const sx = -half + 16, sz = -half + 16;
    let tx = half - R(22, 40), tz = R(-half * 0.1, half - 22);
    if (rand() < 0.5) [tx, tz] = [tz, tx];
    flats.push({ x: sx, z: sz, r: 6, h: raw(sx, sz) });
    flats.push({ x: tx, z: tz, r: 11, h: raw(tx, tz) });

    ctx.terrain('grass', 0, 0, A + 320, 150, (x, z, y, c) => {
      const n = 0.82 + 0.18 * Math.sin(x * 0.07) * Math.cos(z * 0.05) + y * 0.006;
      c.setRGB(n, n * (0.97 + 0.05 * Math.sin(z * 0.03)), n * 0.92);
    });
    // launch pad
    const sh = ground(sx, sz);
    ctx.box('concrete', sx - 2.5, sh - 1, sz - 2.5, sx + 2.5, sh + 0.12, sz + 2.5, { collide: false, ao: false, tint: 0x9fd8a8 });

    // target
    let target, cabin = null;
    const th = ground(tx, tz);
    if (t >= 1 && rand() < 0.65) {
      const dx = sx - tx, dz = sz - tz;
      const side = Math.abs(dx) > Math.abs(dz) ? (dx < 0 ? 'w' : 'e') : (dz < 0 ? 's' : 'n');
      cabin = { x: tx, z: tz, w: 9, d: 7 };
      ctx.room({ x: tx, z: tz, w: 9, d: 7, y0: th + 0.3, H: 3.3, mat: 'logs', windows: true, kind: 'cabin wall',
        door: { side, w: Math.max(2.1, 2.8 - t * 0.15), h: 2.6 } });
      target = { kind: 'crate', pos: V(tx, th + 0.35, tz), rot: R(0, 3) };
    } else {
      target = { kind: t === 0 ? 'radar' : ctx.pick(['truck', 'crate', 'radar']), pos: V(tx, th, tz), rot: R(0, 6) };
    }

    // trees on a jittered grid
    const cell = Math.max(5.8, 10.5 - t * 1.6);
    const density = t >= 2 ? 0.72 : 0.8;
    const pinesP = t === 0 ? 0.55 : 0.35;
    const list = [];
    const outer = half + 110;
    for (let gx = -outer; gx < outer; gx += cell) {
      for (let gz = -outer; gz < outer; gz += cell) {
        const inside = Math.abs(gx) < half && Math.abs(gz) < half;
        if (rand() > (inside ? density : 0.5)) continue;
        const x = gx + R(0.15, 0.85) * cell, z = gz + R(0.15, 0.85) * cell;
        if (Math.hypot(x - sx, z - sz) < 11) continue;
        if (Math.hypot(x - tx, z - tz) < (cabin ? 10 : 13)) continue;
        const pine = rand() < pinesP;
        const h = Math.min(26, R(9, 16) + t * R(1, 3));
        const tr = pine ? R(0.28, 0.42) : R(0.35, 0.55);
        const cr = pine ? h * R(0.16, 0.22) : h * R(0.24, 0.32);
        const y = ground(x, z);
        list.push({ x, y, z, h, tr, cr, type: pine ? 'pine' : 'oak' });
        if (!inside && Math.max(Math.abs(x), Math.abs(z)) > half + 4) continue; // scenery only
        if (pine) {
          ctx.cyl(x, z, tr + 0.05, y - 1, y + h * 0.9, 'tree');
          ctx.sph(x, y + h * 0.36, z, cr * 0.78, 'tree');
          ctx.sph(x, y + h * 0.62, z, cr * 0.5, 'tree');
          ctx.sph(x, y + h * 0.85, z, cr * 0.26, 'tree');
        } else {
          ctx.cyl(x, z, tr + 0.05, y - 1, y + h * 0.62, 'tree');
          ctx.sph(x, y + h * 0.68, z, cr * 0.86, 'tree');
        }
      }
    }
    if (list.length > 3200) list.length = 3200;
    ctx.trees(list);

    // fallen logs and boulders
    if (t >= 1) {
      for (let i = 0; i < 15 + t * 10; i++) {
        const x = R(-half + 10, half - 10), z = R(-half + 10, half - 10);
        if (Math.hypot(x - sx, z - sz) < 15 || Math.hypot(x - tx, z - tz) < 14) continue;
        const y = ground(x, z);
        if (rand() < 0.6) ctx.obox('bark', x, y + 0.45, z, R(3, 5), 0.45, 0.45, R(0, 3), { kind: 'fallen log', ao: false });
        else { const s = R(0.8, 2); ctx.obox('rock', x, y + s * 0.6, z, s, s * 0.8, s * R(0.7, 1.1), R(0, 3), { kind: 'rock', ao: false }); }
      }
    }
    if (t >= 2) {
      for (let i = 0; i < t * 2; i++) {
        const ax = R(-half * 0.6, half * 0.6), az = R(-half * 0.6, half * 0.6);
        const bx = ax + R(-50, 50), bz = az + R(-50, 50);
        if (Math.hypot(ax - sx, az - sz) < 40) continue;
        const y = R(2.5, 5.5);
        ctx.hazard(WC.Patrol(ctx.root, V(ax, ground(ax, az) + y, az), V(bx, ground(bx, bz) + y, bz), R(4, 6) + t, R(0, 6)));
      }
    }
    ctx.wind = t >= 1 ? 1.5 + t : 0;
    ctx.ceilingAGL = [40, 16, 12, 10][Math.min(t, 3)];
    ctx.bounds = { minX: -half, maxX: half, minZ: -half, maxZ: half };
    return {
      spawn: V(sx, sh + 2.2, sz), target,
      pathLen: Math.hypot(tx - sx, tz - sz) * 1.25 + (cabin ? 15 : 0),
      avgSpeed: t === 0 ? 10 : 6.5,
      previewCenter: V(0, 0, 0), previewRadius: half * 0.85, previewHeight: 45,
    };
  }

  // ---------------------------------------------------------------- CITY
  function city(ctx) {
    const { tier: t, R, rand, pick } = ctx;
    ctx.labels = labels('city', t);
    ctx.sky = skyFor(t, ['day', 'sunset', 'fog', 'night']);
    const N = Math.min(10, 4 + t * 2), S = Math.max(13, 28 - t * 4), B = 38, P = B + S;
    const minH = 16, maxH = Math.min(90, 34 + t * 14);
    const streetAt = (k) => (k - 0.5) * P;
    const lo = streetAt(0) - S / 2 + 1, hi = streetAt(N) + S / 2 - 1;
    ctx.bounds = { minX: lo, maxX: hi, minZ: lo, maxZ: hi };
    ctx.ceilingAGL = Math.max(24, 48 - t * 7);
    const tints = [0xffffff, 0xe9dfcf, 0xcfd9e6, 0xdcc6b8, 0xbfcabb, 0xaebbd0];
    const mid = (N - 1) / 2, maxD = Math.hypot(mid, mid) + 1;
    const height = (i, j) => {
      const f = 1 - 0.45 * Math.hypot(i - mid, j - mid) / maxD;
      return Math.max(minH, (minH + (maxH - minH) * Math.pow(rand(), 1.2)) * (0.7 + 0.6 * f));
    };
    const building = (x0, z0, x1, z1, h, collide) => {
      ctx.box('facade', x0, 0, z0, x1, h, z1, { tint: pick(tints), collide, kind: 'building' });
      const w = x1 - x0, d = z1 - z0;
      if (w > 8 && d > 8) {
        for (let q = 0; q < Math.floor(R(0, 3)); q++) {
          const pw = R(2, 4.5), pd = R(2, 4.5), ph = R(1.2, 2.6);
          const px = R(x0 + 1, x1 - 1 - pw), pz = R(z0 + 1, z1 - 1 - pd);
          ctx.box('metal', px, h, pz, px + pw, h + ph, pz + pd, { collide, kind: 'rooftop unit', ao: false });
        }
        if (h > 30 && rand() < 0.5) {
          const ah = R(4, 9), ax = R(x0 + 2, x1 - 2), az = R(z0 + 2, z1 - 2);
          ctx.box('metal', ax - 0.2, h, az - 0.2, ax + 0.2, h + ah, az + 0.2, { collide, kind: 'antenna', ao: false });
        }
      }
    };
    const alleys = [];
    const alleyChance = t >= 1 ? Math.min(0.6, 0.3 + 0.1 * t) : 0, alleyW = Math.max(6.5, 10 - t * 1.2);
    for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) {
      const cx = i * P, cz = j * P, hx = B / 2 - R(0, 1.6), hz = B / 2 - R(0, 1.6);
      if (rand() < alleyChance) {
        const a = alleyW;
        if (rand() < 0.5) {
          building(cx - hx, cz - hz, cx - a / 2, cz + hz, height(i, j), true);
          building(cx + a / 2, cz - hz, cx + hx, cz + hz, height(i, j), true);
          alleys.push({ x: cx, z: cz, i, j });
        } else {
          building(cx - hx, cz - hz, cx + hx, cz - a / 2, height(i, j), true);
          building(cx - hx, cz + a / 2, cx + hx, cz + hz, height(i, j), true);
          alleys.push({ x: cx, z: cz, i, j });
        }
      } else building(cx - hx, cz - hz, cx + hx, cz + hz, height(i, j), true);
    }
    const FAR = 4;
    for (let i = -FAR; i < N + FAR; i++) for (let j = -FAR; j < N + FAR; j++) {
      if (i >= 0 && i < N && j >= 0 && j < N) continue;
      const hx = B / 2 - R(0, 3), hz = B / 2 - R(0, 3);
      building(i * P - hx, j * P - hz, i * P + hx, j * P + hz, R(28, 80), false);
    }
    // street ground
    const nT = (N + 2 * FAR) | 1, cI = Math.floor(N / 2);
    const gtex = WC.TEX.asphalt(P, B);
    gtex.repeat.set(nT, nT);
    const gm = new T.Mesh(ctx.track(new T.PlaneGeometry(nT * P, nT * P)), ctx.track(new T.MeshLambertMaterial({ map: gtex })));
    gm.rotation.x = -Math.PI / 2; gm.position.set(cI * P, 0, cI * P); gm.receiveShadow = true;
    ctx.root.add(gm);

    const sxz = [streetAt(0), streetAt(0)];
    const far = (x, z, d) => Math.hypot(x - sxz[0], z - sxz[1]) > d;
    // target vehicle
    const d = Math.min(2 * N - 1, 3 + t * 2);
    const cands = [];
    for (let k = 0; k <= N; k++) for (let l = 0; l <= N; l++) if (k + l === d) cands.push([k, l]);
    const c = pick(cands.length ? cands : [[N, N]]);
    let tx = streetAt(c[0]), tz = streetAt(c[1]), tAxis = 'z', move = null;
    const inAlley = alleys.length && t >= 1 && rand() < 0.35;
    if (inAlley) {
      let best = alleys[0], bd = 1e9;
      for (const a of alleys) { const q = Math.abs(a.i + a.j + 1 - d) + rand(); if (q < bd) { bd = q; best = a; } }
      tx = best.x; tz = best.z;
    } else {
      if (c[0] > 0 && rand() < 0.5) { tz += (c[1] > 0 ? -1 : 1) * P / 2; tAxis = 'z'; }
      else { tx += (c[0] > 0 ? -1 : 1) * P / 2; tAxis = 'x'; }
      if (tAxis === 'x') tx = Math.max(streetAt(0) + 10, Math.min(streetAt(N) - 10, tx));
      if (t >= 2) {
        const amp = Math.min(P * 0.3, 14);
        move = (time) => (tAxis === 'x' ? V(Math.sin(time * 0.3) * amp, 0, 0) : V(0, 0, Math.sin(time * 0.3) * amp));
      }
    }
    // the truck parks along its street
    const target = { kind: 'truck', pos: V(tx, 0, tz), rot: tAxis === 'x' ? Math.PI / 2 : 0, move };

    // parked cars along curbs
    const carCols = [0x7a1f1f, 0x1f3d7a, 0xdedede, 0x222222, 0x8a8a8a, 0x2f6b3a, 0xc9a227];
    for (let q = 0; q < 18 + N * 5; q++) {
      const k = Math.floor(rand() * (N + 1)), l = Math.floor(rand() * N);
      const side = rand() < 0.5 ? -1 : 1;
      const alongZ = rand() < 0.5;
      const x = alongZ ? streetAt(k) + side * (S / 2 - 1.5) : l * P + R(-14, 14);
      const z = alongZ ? l * P + R(-14, 14) : streetAt(k) + side * (S / 2 - 1.5);
      if (!far(x, z, 25) || Math.hypot(x - tx, z - tz) < 12) continue;
      const rot = alongZ ? 0 : Math.PI / 2, tint = pick(carCols);
      ctx.obox('metal', x, 0.75, z, 0.95, 0.5, 2.2, rot, { kind: 'parked car', tint, ao: false });
      ctx.obox('metal', x, 1.55, z, 0.85, 0.35, 1.2, rot, { kind: 'parked car', tint: 0x30343a, ao: false });
    }
    // lamp posts at street edges
    for (let q = 0; q < 6 + t * 4 + N * 2; q++) {
      const k = Math.floor(rand() * (N + 1)), l = Math.floor(rand() * N);
      const side = rand() < 0.5 ? -1 : 1, alongZ = rand() < 0.5;
      const x = alongZ ? streetAt(k) + side * (S / 2 - 0.6) : l * P + R(-16, 16);
      const z = alongZ ? l * P + R(-16, 16) : streetAt(k) + side * (S / 2 - 0.6);
      if (!far(x, z, 20)) continue;
      ctx.box('metal', x - 0.15, 0, z - 0.15, x + 0.15, 8, z + 0.15, { kind: 'lamp post', ao: false });
      const ox = alongZ ? -side * 1.6 : 0, oz = alongZ ? 0 : -side * 1.6;
      ctx.box('metal', Math.min(x, x + ox) - 0.1, 7.8, Math.min(z, z + oz) - 0.1, Math.max(x, x + ox) + 0.1, 8.05, Math.max(z, z + oz) + 0.1, { kind: 'lamp post', ao: false });
      if (ctx.sky === 'night' || ctx.sky === 'fog') ctx.lamp(x + ox, 7.5, z + oz, 0xffd9a0, 1.6, 22);
    }
    // cables across streets
    if (t >= 1) {
      for (let q = 0; q < 3 + t * 3; q++) {
        const k = 1 + Math.floor(rand() * (N - 1)), l = Math.floor(rand() * N);
        const y = R(6, 16), len = S + 6;
        if (rand() < 0.5) {
          const x = streetAt(k), z = l * P + R(-10, 10);
          if (!far(x, z, 35)) continue;
          ctx.box('metal', x - len / 2, y - 0.1, z - 0.1, x + len / 2, y + 0.1, z + 0.1, { kind: 'cable', ao: false, tint: 0x333333 });
        } else {
          const z = streetAt(k), x = l * P + R(-10, 10);
          if (!far(x, z, 35)) continue;
          ctx.box('metal', x - 0.1, y - 0.1, z - len / 2, x + 0.1, y + 0.1, z + len / 2, { kind: 'cable', ao: false, tint: 0x333333 });
        }
      }
      for (let q = 0; q < t * 3; q++) {
        const axis = rand() < 0.5, k = Math.floor(rand() * (N + 1)), l = Math.floor(rand() * N);
        const line = streetAt(k) + R(-S * 0.2, S * 0.2), a = streetAt(l) - 6, b = streetAt(l + 1) + 6, y = R(5, 18);
        const A = axis ? V(line, y, a) : V(a, y, line), Bv = axis ? V(line, y, b) : V(b, y, line);
        if (!far(A.x, A.z, 45)) continue;
        ctx.hazard(WC.Patrol(ctx.root, A, Bv, R(5, 7) + t, R(0, 6)));
      }
    }
    if (t >= 2) {
      for (let q = 0; q < (t - 1) * 2; q++) {
        const x = streetAt(1 + Math.floor(rand() * (N - 1))), z = streetAt(1 + Math.floor(rand() * (N - 1)));
        if (!far(x, z, 40) || Math.hypot(x - tx, z - tz) < 16) continue;
        const y = R(6, 13);
        ctx.box('metal', x - 0.35, 0, z - 0.35, x + 0.35, y, z + 0.35, { kind: 'blade pylon', ao: false });
        ctx.hazard(WC.Spinner(ctx.root, { x, y: y + 0.5, z, axis: 'y', len: Math.min(S * 0.9, 22), thick: 0.6, w: (0.9 + 0.2 * t) * (rand() < 0.5 ? -1 : 1), phase: R(0, 6) }));
      }
    }
    ctx.wind = t >= 1 ? 1 + t : 0;
    const spawn = V(sxz[0], 2.4, sxz[1]);
    ctx.box('concrete', spawn.x - 2.5, -0.5, spawn.z - 2.5, spawn.x + 2.5, 0.12, spawn.z + 2.5, { collide: false, ao: false, tint: 0x9fd8a8 });
    return {
      spawn, target,
      pathLen: Math.abs(tx - spawn.x) + Math.abs(tz - spawn.z) + 20,
      avgSpeed: 10,
      previewCenter: V(mid * P, 0, mid * P), previewRadius: N * P * 0.55 + 60, previewHeight: 55,
    };
  }

  // ---------------------------------------------------------------- BATTLE
  function battle(ctx) {
    const { tier: t, R, rand, pick } = ctx;
    ctx.labels = labels('battle', t);
    ctx.sky = skyFor(t, ['war', 'war', 'warnight']);
    const A = Math.min(460, 260 + t * 60), half = A / 2;
    const amp = 2.5 + t * 0.8;
    const ph = [R(0, 6), R(0, 6), R(0, 6)];
    const craters = [];
    for (let i = 0; i < 25 + t * 15; i++) craters.push({ x: R(-half, half), z: R(-half, half), r: R(3, 9), d: R(1, 2.6) });
    const flats = [];
    const raw = (x, z) => {
      let h = amp * (0.6 * Math.sin(x * 0.02 + ph[0]) * Math.cos(z * 0.017 + ph[1]) + 0.4 * Math.sin(x * 0.05 + z * 0.04 + ph[2]));
      for (const c of craters) {
        const dx = x - c.x, dz = z - c.z;
        if (Math.abs(dx) > c.r * 1.5 || Math.abs(dz) > c.r * 1.5) continue;
        const q = Math.hypot(dx, dz) / c.r;
        if (q < 1) h -= c.d * (1 - q * q);
        else if (q < 1.45) h += c.d * 0.25 * (1 - (q - 1) / 0.45);
      }
      return h;
    };
    const ground = (x, z) => {
      let h = raw(x, z);
      for (const f of flats) {
        const d = Math.hypot(x - f.x, z - f.z);
        if (d < f.r + 8) { const k = d < f.r ? 1 : 1 - (d - f.r) / 8; const s = k * k * (3 - 2 * k); h = h * (1 - s) + f.h * s; }
      }
      return h;
    };
    ctx.groundAt = ground;
    const sx = -half + 20, sz = R(-half * 0.3, half * 0.3);
    const tx = half - 35, tz = R(-half * 0.4, half * 0.4);
    flats.push({ x: sx, z: sz, r: 6, h: raw(sx, sz) }, { x: tx, z: tz, r: 14, h: raw(tx, tz) });
    craters.forEach((c) => { if (Math.hypot(c.x - sx, c.z - sz) < 15 || Math.hypot(c.x - tx, c.z - tz) < 20) c.d = 0; });
    ctx.terrain('mud', 0, 0, A + 340, 170, (x, z, y, c) => {
      const n = 0.75 + 0.25 * Math.sin(x * 0.05 + z * 0.03) + y * 0.02;
      c.setRGB(n, n * 0.95, n * 0.88);
    });
    const used = [{ x: sx, z: sz, r: 25 }, { x: tx, z: tz, r: 22 }];
    const free = (x, z, r) => used.every((u) => Math.hypot(x - u.x, z - u.z) > u.r + r);
    const place = (r, tries) => {
      for (let i = 0; i < (tries || 30); i++) {
        const x = R(-half + 10, half - 10), z = R(-half + 10, half - 10);
        if (free(x, z, r)) { used.push({ x, z, r }); return [x, z]; }
      }
      return null;
    };
    // ruined buildings
    for (let q = 0; q < 8 + t * 4; q++) {
      const w = R(8, 16), d = R(8, 14), H = R(4, 11);
      const at = place(Math.max(w, d) * 0.75 + 4); if (!at) continue;
      const [x, z] = at;
      const base = Math.min(ground(x - w / 2, z - d / 2), ground(x + w / 2, z + d / 2), ground(x, z)) - 0.6;
      const sides = [[x - w / 2, z - d / 2, x + w / 2, z - d / 2], [x - w / 2, z + d / 2, x + w / 2, z + d / 2], [x - w / 2, z - d / 2, x - w / 2, z + d / 2], [x + w / 2, z - d / 2, x + w / 2, z + d / 2]];
      for (const s of sides) {
        const n = 3;
        for (let k = 0; k < n; k++) {
          if (rand() < 0.22) continue;
          const a0 = k / n, a1 = (k + 1) / n;
          const x0 = s[0] + (s[2] - s[0]) * a0, z0 = s[1] + (s[3] - s[1]) * a0, x1 = s[0] + (s[2] - s[0]) * a1, z1 = s[1] + (s[3] - s[1]) * a1;
          const h = H * R(0.35, 1);
          const segLen = Math.hypot(x1 - x0, z1 - z0);
          const ops = h > 3.4 ? [{ at: segLen / 2, w: 1.5, y0: base + 1.8, y1: base + 3.1 }] : [];
          ctx.wall('concrete', x0, z0, x1, z1, base, base + h, 0.45, ops, { kind: 'ruined wall', tint: 0xb8b0a4 });
        }
      }
      if (H > 7 && rand() < 0.5) ctx.box('concrete', x - w / 2, base + 3.8, z - d / 2, x, base + 4.2, z + d / 2, { kind: 'collapsed floor', tint: 0xa8a098, ao: false });
      for (let k = 0; k < 6; k++) {
        const rx = x + R(-w * 0.7, w * 0.7), rz = z + R(-d * 0.7, d * 0.7), s = R(0.5, 1.4);
        ctx.obox('concrete', rx, ground(rx, rz) + s * 0.4, rz, s, s * 0.6, s * R(0.6, 1.2), R(0, 3), { kind: 'rubble', ao: false, tint: 0x9a9286 });
      }
      if (rand() < 0.3) ctx.smoke(x, base + 2, z);
    }
    // wrecked tanks
    for (let q = 0; q < 5 + t * 2; q++) {
      const at = place(6); if (!at) continue;
      const [x, z] = at, rot = R(0, 6), y = ground(x, z);
      ctx.obox('camo', x, y + 0.9, z, 1.7, 0.75, 3.2, rot, { kind: 'tank wreck', ao: false });
      const tr = rot + R(-0.6, 0.6);
      ctx.obox('camo', x, y + 2.0, z, 1.1, 0.4, 1.3, tr, { kind: 'tank wreck', ao: false });
      const bx = x - Math.sin(tr) * 2.6, bz = z - Math.cos(tr) * 2.6;
      ctx.obox('metal', bx, y + 2.05, bz, 0.12, 0.12, 1.8, tr, { kind: 'tank wreck', ao: false, tint: 0x555555 });
      if (rand() < 0.45) ctx.fire(x, y + 2.2, z, R(0.7, 1.1));
    }
    // sandbag walls
    for (let q = 0; q < 10 + t * 5; q++) {
      const at = place(4); if (!at) continue;
      const [x, z] = at; let rot = R(0, 6);
      for (let k = 0; k < 3; k++) {
        const bx = x + Math.cos(rot) * k * 2.8, bz = z - Math.sin(rot) * k * 2.8;
        ctx.obox('sandbag', bx, ground(bx, bz) + 0.55, bz, 1.5, 0.6, 0.5, rot, { kind: 'sandbags', ao: false });
        rot += 0.35;
      }
    }
    // tank traps
    for (let q = 0; q < 8 + t * 6; q++) {
      const at = place(2); if (!at) continue;
      const [x, z] = at, y = ground(x, z), r = R(0, 3);
      ctx.obox('metal', x, y + 0.6, z, 1.2, 0.12, 0.12, r, { kind: 'tank trap', ao: false, tint: 0x6a5a4a });
      ctx.obox('metal', x, y + 0.6, z, 1.2, 0.12, 0.12, r + Math.PI / 2, { kind: 'tank trap', ao: false, tint: 0x6a5a4a });
      ctx.obox('metal', x, y + 0.7, z, 0.12, 0.7, 0.12, r, { kind: 'tank trap', ao: false, tint: 0x6a5a4a });
    }
    // barbed wire
    if (t >= 1) {
      for (let q = 0; q < 4 + t * 3; q++) {
        const x0 = R(-half * 0.6, half * 0.6), z0 = R(-half * 0.8, half * 0.8);
        const len = R(20, 40), ang = R(0, 3);
        if (Math.hypot(x0 - sx, z0 - sz) < 30) continue;
        const ca = Math.cos(ang), sa = Math.sin(ang);
        for (let s = 0; s <= len; s += 4) {
          const px = x0 + ca * s, pz = z0 - sa * s;
          ctx.obox('metal', px, ground(px, pz) + 0.8, pz, 0.06, 0.8, 0.06, ang, { kind: 'barbed wire', ao: false, tint: 0x5a4a3a });
        }
        const mx = x0 + ca * len / 2, mz = z0 - sa * len / 2, my = ground(mx, mz);
        for (const hy of [0.5, 1.0, 1.5]) ctx.obox('metal', mx, my + hy, mz, len / 2, 0.03, 0.03, ang, { kind: 'barbed wire', ao: false, tint: 0x777777 });
      }
    }
    for (let q = 0; q < 5 + t * 2; q++) { const x = R(-half, half), z = R(-half, half); ctx.smoke(x, ground(x, z), z); }
    for (let q = 0; q < 4; q++) { const at = place(3); if (at) ctx.fire(at[0], ground(at[0], at[1]) + 0.3, at[1], R(0.6, 1)); }

    // anti-air guns
    const nGuns = Math.min(8, 1 + t * 2);
    for (let q = 0; q < nGuns; q++) {
      let x, z, ok = false;
      for (let i = 0; i < 30 && !ok; i++) {
        x = R(-half + 70, half - 40); z = R(-half * 0.8, half * 0.8);
        ok = free(x, z, 6);
      }
      if (!ok) continue;
      used.push({ x, z, r: 6 });
      const y = ground(x, z);
      for (let k = 0; k < 6; k++) {
        const a = (k / 6) * Math.PI * 2;
        ctx.obox('sandbag', x + Math.cos(a) * 3.4, y + 0.5, z - Math.sin(a) * 3.4, 1.6, 0.55, 0.5, a + Math.PI / 2, { kind: 'sandbags', ao: false });
      }
      ctx.hazard(WC.AAGun(ctx.root, {
        x, y, z, lockAlt: t === 0 ? 1e9 : Math.max(6, 16 - t * 3), turn: 0.6 + 0.25 * t,
        spread: Math.max(0.03, 0.12 - t * 0.025), sweep: Math.atan2(-(sx - x), -(sz - z)),
      }, ctx));
    }
    if (t >= 1) ctx.hazard(WC.Artillery(ctx.root, { interval: Math.max(3.2, 9 - t * 1.5), radius: 7 }, ctx));
    if (t >= 2) {
      for (let q = 0; q < t * 2; q++) {
        const ax = R(-half * 0.5, half * 0.7), az = R(-half * 0.7, half * 0.7);
        const A1 = V(ax, ground(ax, az) + R(5, 12), az), B1 = V(ax + R(-60, 60), A1.y, az + R(-60, 60));
        ctx.hazard(WC.Patrol(ctx.root, A1, B1, R(6, 8) + t, R(0, 6)));
      }
    }

    // target
    let target;
    const th = ground(tx, tz);
    if (t >= 2 && rand() < 0.6) {
      const side = 'w';
      ctx.room({ x: tx, z: tz, w: 10, d: 8, y0: th + 0.2, H: 3.2, mat: 'concrete', floorMat: 'concrete', roofMat: 'concrete', roofT: 1.0, kind: 'bunker wall', lamp: true,
        door: { side, w: Math.max(2.5, 3.8 - (t - 2) * 0.35), h: 1.9, y: 0.7 } });
      for (let k = 0; k < 6; k++) ctx.obox('sandbag', tx - 6.5, th + 0.5, tz - 5 + k * 2, 0.5, 0.55, 0.9, 0, { kind: 'sandbags', ao: false });
      target = { kind: 'crate', pos: V(tx + 1, th + 0.25, tz), rot: R(0, 6) };
      ctx.labels.push('TARGET INSIDE BUNKER');
    } else if (t >= 1) {
      target = { kind: 'tank', pos: V(tx, th, tz), rot: 0, move: (time) => V(0, 0, Math.sin(time * 0.22) * 14), face: (time) => (Math.cos(time * 0.22) >= 0 ? Math.PI : 0) };
    } else {
      target = { kind: 'radar', pos: V(tx, th, tz), rot: R(0, 6) };
    }
    ctx.wind = 2 + t;
    ctx.ceilingAGL = [40, 26, 18, 14][Math.min(t, 3)];
    ctx.bounds = { minX: -half, maxX: half, minZ: -half, maxZ: half };
    const sh = ground(sx, sz);
    ctx.box('concrete', sx - 2.5, sh - 1, sz - 2.5, sx + 2.5, sh + 0.12, sz + 2.5, { collide: false, ao: false, tint: 0x9fd8a8 });
    return {
      spawn: V(sx, sh + 2.2, sz), target,
      pathLen: Math.hypot(tx - sx, tz - sz) * 1.25, avgSpeed: 9.5,
      previewCenter: V(0, 0, 0), previewRadius: half * 0.8, previewHeight: 50,
    };
  }

  // ---------------------------------------------------------------- HOUSE
  function house(ctx) {
    const { tier: t, R, rand, pick } = ctx;
    ctx.labels = labels('house', t);
    ctx.sky = skyFor(t, ['day', 'sunset', 'night']);
    const dims = [[2, 2], [2, 3], [3, 3], [3, 4], [4, 4]][Math.min(t, 4)];
    const rows = dims[0], cols = dims[1];
    const rs = Math.max(5.8, 7 - t * 0.3), H = Math.max(3.0, 3.6 - t * 0.15);
    const doorW = Math.max(2.0, 2.9 - t * 0.22), doorH = Math.max(2.35, 2.9 - t * 0.15), th = 0.3;
    const ox = -cols * rs / 2, oz = 0, W = cols * rs, D = rows * rs;
    ctx.terrain('grass', 0, rows * rs / 2, 420, 40, (x, z, y, c) => { const n = 0.85 + 0.15 * Math.sin(x * 0.09) * Math.cos(z * 0.07); c.setRGB(n, n, n); });
    // maze of rooms (spanning tree guarantees a route)
    const entry = Math.floor(rand() * cols);
    const id = (r, c) => r * cols + c;
    const conn = new Set();
    const ek = (a, b) => (a < b ? a + ':' + b : b + ':' + a);
    const seen = new Set([id(0, entry)]);
    const stack = [[0, entry]];
    while (stack.length) {
      const [r, c] = stack[stack.length - 1];
      const nb = [[r + 1, c], [r - 1, c], [r, c + 1], [r, c - 1]].filter(([a, b]) => a >= 0 && a < rows && b >= 0 && b < cols && !seen.has(id(a, b)));
      if (!nb.length) { stack.pop(); continue; }
      const [a, b] = nb[Math.floor(rand() * nb.length)];
      conn.add(ek(id(r, c), id(a, b))); seen.add(id(a, b)); stack.push([a, b]);
    }
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
      if (c + 1 < cols && rand() < 0.2) conn.add(ek(id(r, c), id(r, c + 1)));
      if (r + 1 < rows && rand() < 0.2) conn.add(ek(id(r, c), id(r + 1, c)));
    }
    // farthest room from the entry
    const dist = new Map([[id(0, entry), 0]]);
    const q = [[0, entry]];
    while (q.length) {
      const [r, c] = q.shift();
      for (const [a, b] of [[r + 1, c], [r - 1, c], [r, c + 1], [r, c - 1]]) {
        if (a < 0 || a >= rows || b < 0 || b >= cols || dist.has(id(a, b)) || !conn.has(ek(id(r, c), id(a, b)))) continue;
        dist.set(id(a, b), dist.get(id(r, c)) + 1); q.push([a, b]);
      }
    }
    let far = [0, entry], fd = -1;
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) { const d = dist.get(id(r, c)); if (d > fd) { fd = d; far = [r, c]; } }

    const doors = []; // {x,z,alongX}
    const roomDoors = new Map();
    const noteDoor = (cells, x, z, alongX) => { const d = { x, z, alongX }; doors.push(d); cells.forEach((k) => { if (!roomDoors.has(k)) roomDoors.set(k, []); roomDoors.get(k).push(d); }); };
    const doorAt = () => R(doorW / 2 + 0.6, rs - doorW / 2 - 0.6);
    // interior walls
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols - 1; c++) {
      const x = ox + (c + 1) * rs, z0 = oz + r * rs, z1 = z0 + rs;
      const ops = [];
      if (conn.has(ek(id(r, c), id(r, c + 1)))) { const at = doorAt(); ops.push({ at, w: doorW, y0: 0, y1: doorH }); noteDoor([id(r, c), id(r, c + 1)], x, z0 + at, false); }
      ctx.wall('plaster', x, z0, x, z1, -0.2, H, th, ops, { kind: 'wall' });
    }
    for (let r = 0; r < rows - 1; r++) for (let c = 0; c < cols; c++) {
      const z = oz + (r + 1) * rs, x0 = ox + c * rs, x1 = x0 + rs;
      const ops = [];
      if (conn.has(ek(id(r, c), id(r + 1, c)))) { const at = doorAt(); ops.push({ at, w: doorW, y0: 0, y1: doorH }); noteDoor([id(r, c), id(r + 1, c)], x0 + at, z, true); }
      ctx.wall('plaster', x0, z, x1, z, -0.2, H, th, ops, { kind: 'wall' });
    }
    // exterior walls, front door and windows
    const win = () => ({ at: rs / 2 + R(-0.8, 0.8), w: 1.4, y0: 1.1, y1: 2.3, glass: true });
    let frontDoorX = 0;
    for (let c = 0; c < cols; c++) {
      const x0 = ox + c * rs;
      let ops;
      if (c === entry) { const at = rs / 2; ops = [{ at, w: doorW + 0.3, y0: 0, y1: doorH + 0.1 }]; frontDoorX = x0 + at; noteDoor([id(0, c)], frontDoorX, oz, true); }
      else ops = rand() < 0.8 ? [win()] : [];
      ctx.wall('brick', x0, oz, x0 + rs, oz, -0.2, H, th, ops, { kind: 'wall' });
      ctx.wall('brick', x0, oz + D, x0 + rs, oz + D, -0.2, H, th, rand() < 0.8 ? [win()] : [], { kind: 'wall' });
    }
    for (let r = 0; r < rows; r++) {
      const z0 = oz + r * rs;
      ctx.wall('brick', ox, z0, ox, z0 + rs, -0.2, H, th, rand() < 0.7 ? [win()] : [], { kind: 'wall' });
      ctx.wall('brick', ox + W, z0, ox + W, z0 + rs, -0.2, H, th, rand() < 0.7 ? [win()] : [], { kind: 'wall' });
    }
    ctx.box('woodfloor', ox, -0.3, oz, ox + W, 0.02, oz + D, { collide: false, ao: false });
    ctx.box('plaster', ox, H, oz, ox + W, H + 0.25, oz + D, { kind: 'ceiling', ao: false });
    ctx.box('roof', ox - 0.7, H + 0.25, oz - 0.7, ox + W + 0.7, H + 0.6, oz + D + 0.7, { kind: 'roof', ao: false });
    for (let k = 1; k <= 3; k++) {
      const inset = k * Math.min(W, D) * 0.12;
      ctx.box('roof', ox - 0.7 + inset, H + 0.6 + (k - 1) * 0.6, oz - 0.7 + inset, ox + W + 0.7 - inset, H + 0.6 + k * 0.6, oz + D + 0.7 - inset, { kind: 'roof', ao: false });
    }
    ctx.lamp(frontDoorX, doorH + 0.4, oz - 0.6, 0xffd9a0, 1.0, 10);
    // furniture
    const furnMat = ['woodfloor', 'plaster', 'camo', 'logs'];
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
      const cx = ox + c * rs + rs / 2, cz = oz + r * rs + rs / 2;
      ctx.lamp(cx, H - 0.3, cz, 0xffe2b0, 1.3, rs * 1.6);
      ctx.box('plaster', cx - 0.25, H - 0.08, cz - 0.25, cx + 0.25, H, cz + 0.25, { collide: false, ao: false, tint: 0xfff4d0 });
      const ds = roomDoors.get(id(r, c)) || [];
      const isTarget = r === far[0] && c === far[1];
      const spots = [[-1, -1], [1, -1], [-1, 1], [1, 1]];
      for (const [sxs, szs] of spots) {
        if (rand() < 0.35) continue;
        const px = cx + sxs * (rs / 2 - 1.1), pz = cz + szs * (rs / 2 - 1.1);
        if (ds.some((d) => Math.hypot(d.x - px, d.z - pz) < 2.4)) continue;
        const kind = pick(['table', 'shelf', 'sofa', 'boxes']);
        if (kind === 'table') {
          ctx.box('woodfloor', px - 0.8, 0.72, pz - 0.45, px + 0.8, 0.8, pz + 0.45, { kind: 'table', ao: false });
          for (const [lx, lz] of [[-0.7, -0.35], [0.7, -0.35], [-0.7, 0.35], [0.7, 0.35]]) ctx.box('woodfloor', px + lx - 0.04, 0, pz + lz - 0.04, px + lx + 0.04, 0.72, pz + lz + 0.04, { kind: 'table', ao: false });
        } else if (kind === 'shelf') {
          const along = rand() < 0.5;
          ctx.obox('woodfloor', px + sxs * 0.5, 1.0, pz + szs * 0.5, along ? 0.9 : 0.22, 1.0, along ? 0.22 : 0.9, 0, { kind: 'bookshelf', tint: 0x9a7a5a });
        } else if (kind === 'sofa') {
          ctx.obox('camo', px, 0.4, pz, 1.0, 0.4, 0.45, rand() < 0.5 ? 0 : Math.PI / 2, { kind: 'sofa', tint: pick([0x8a3a3a, 0x3a5a8a, 0x6a6a6a]) });
        } else {
          ctx.obox('logs', px, 0.4, pz, 0.4, 0.4, 0.4, R(0, 1), { kind: 'boxes', ao: false });
          if (rand() < 0.6) ctx.obox('logs', px + 0.1, 1.2, pz, 0.35, 0.4, 0.35, R(0, 1), { kind: 'boxes', ao: false });
        }
      }
      if (t >= 1 && !isTarget && rand() < 0.55) {
        ctx.cyl(cx, cz, 0.08, H - 0.45, H, 'ceiling fan');
        ctx.hazard(WC.Spinner(ctx.root, { x: cx, y: H - 0.45, z: cz, axis: 'y', len: Math.min(2.6, rs * 0.42), thick: 0.08, w: 5, phase: R(0, 6), blades: 2, kind: 'ceiling fan' }));
      }
    }
    if (t >= 2) {
      for (const d of doors) {
        if (d.z === oz || rand() > 0.5) continue;
        ctx.hazard(WC.Laser(ctx.root, { cx: d.x, cy: doorH / 2, cz: d.z, hx: d.alongX ? doorW / 2 : 0.03, hy: doorH / 2 - 0.05, hz: d.alongX ? 0.03 : doorW / 2, on: R(0.9, 1.3), off: R(1.4, 1.9), phase: R(0, 3), lines: 6 }));
      }
    }
    // village outside
    const hcx = ox + W / 2, hcz = oz + D / 2;
    const others = [];
    for (let k = 0; k < 6 + t * 2; k++) {
      for (let tries = 0; tries < 20; tries++) {
        const x = hcx + R(-80, 80), z = hcz + R(-60, 90);
        const w = R(8, 14), d = R(8, 12);
        if (Math.abs(x - frontDoorX) < w / 2 + 9 && z < oz + 2) continue;
        if (x + w / 2 > ox - 8 && x - w / 2 < ox + W + 8 && z + d / 2 > oz - 8 && z - d / 2 < oz + D + 8) continue;
        if (others.some((o) => Math.abs(o.x - x) < (o.w + w) / 2 + 5 && Math.abs(o.z - z) < (o.d + d) / 2 + 5)) continue;
        others.push({ x, z, w, d });
        const h = R(4, 7);
        ctx.box(pick(['brick', 'plaster']), x - w / 2, 0, z - d / 2, x + w / 2, h, z + d / 2, { kind: 'house', tint: pick([0xffffff, 0xe8dccb, 0xd6c8b6]) });
        for (let s = 0; s < 3; s++) {
          const inset = s * Math.min(w, d) * 0.14;
          ctx.box('roof', x - w / 2 - 0.5 + inset, h + s * 0.7, z - d / 2 - 0.5 + inset, x + w / 2 + 0.5 - inset, h + (s + 1) * 0.7, z + d / 2 + 0.5 - inset, { kind: 'roof', ao: false });
        }
        break;
      }
    }
    const trees = [];
    for (let k = 0; k < 40; k++) {
      const x = hcx + R(-110, 110), z = hcz + R(-80, 120);
      if (Math.abs(x - frontDoorX) < 10 && z < oz + 2 && z > oz - 40) continue;
      if (x > ox - 6 && x < ox + W + 6 && z > oz - 6 && z < oz + D + 6) continue;
      if (others.some((o) => Math.abs(o.x - x) < o.w / 2 + 3 && Math.abs(o.z - z) < o.d / 2 + 3)) continue;
      const h = R(8, 14), cr = h * 0.3;
      trees.push({ x, y: 0, z, h, tr: 0.4, cr, type: 'oak' });
      ctx.cyl(x, z, 0.45, -1, h * 0.62, 'tree');
      ctx.sph(x, h * 0.68, z, cr * 0.86, 'tree');
    }
    ctx.trees(trees);
    // fence with a gate opening in front
    const fz = oz - 14;
    for (const [a, b] of [[ox - 12, frontDoorX - 3], [frontDoorX + 3, ox + W + 12]]) {
      for (let x = a; x < b; x += 2.2) ctx.box('woodfloor', x - 0.07, 0, fz - 0.07, x + 0.07, 1.3, fz + 0.07, { kind: 'fence', ao: false, tint: 0xb89a70 });
      ctx.box('woodfloor', a, 0.9, fz - 0.04, b, 1.0, fz + 0.04, { kind: 'fence', ao: false, tint: 0xb89a70 });
    }
    if (t >= 1) {
      // power line across the approach
      const pz = oz - R(6, 10), py = R(4.5, 6);
      ctx.box('logs', ox - 15, 0, pz - 0.15, ox - 14.7, py + 1, pz + 0.15, { kind: 'power pole', ao: false });
      ctx.box('logs', ox + W + 14.7, 0, pz - 0.15, ox + W + 15, py + 1, pz + 0.15, { kind: 'power pole', ao: false });
      for (const dy of [0, 0.6]) ctx.box('metal', ox - 15, py + dy - 0.03, pz - 0.03, ox + W + 15, py + dy + 0.03, pz + 0.03, { kind: 'power line', ao: false, tint: 0x222222 });
      for (let k = 0; k < t; k++) {
        const y = R(3, 7);
        ctx.hazard(WC.Patrol(ctx.root, V(ox - 10, y, oz - R(4, 12)), V(ox + W + 10, y, oz - R(4, 12)), R(3, 5) + t, R(0, 6)));
      }
    }
    const tr = far;
    const target = { kind: 'bomb', pos: V(ox + tr[1] * rs + rs / 2, 0.02, oz + tr[0] * rs + rs / 2), rot: R(0, 6) };
    ctx.ceilingAGL = 22;
    ctx.bounds = { minX: ox - 70, maxX: ox + W + 70, minZ: oz - 60, maxZ: oz + D + 60 };
    ctx.groundAt = () => 0;
    const spawn = V(frontDoorX, 1.8, oz - 24);
    ctx.box('concrete', spawn.x - 2.5, -0.5, spawn.z - 2.5, spawn.x + 2.5, 0.12, spawn.z + 2.5, { collide: false, ao: false, tint: 0x9fd8a8 });
    return {
      spawn, yaw: Math.PI, target,
      pathLen: 24 + (fd + 1) * rs * 1.6, avgSpeed: 3,
      previewCenter: V(hcx, 0, hcz), previewRadius: 38 + W, previewHeight: 22,
    };
  }

  // ---------------------------------------------------------------- TUNNEL
  function tunnel(ctx) {
    const { tier: t, R, rand, pick } = ctx;
    ctx.labels = labels('tunnel', t);
    ctx.sky = 'under';
    const W = Math.max(4.4, 7 - t * 0.8), H = Math.max(3.8, 5.6 - t * 0.5), C = Math.max(W, H) + 4;
    const nCells = Math.min(40, 11 + t * 6);
    const DIRS = { px: [1, 0, 0], nx: [-1, 0, 0], pz: [0, 0, 1], nz: [0, 0, -1], up: [0, 1, 0], dn: [0, -1, 0] };
    const OPP = { px: 'nx', nx: 'px', pz: 'nz', nz: 'pz', up: 'dn', dn: 'up' };
    const LEFT = { px: 'nz', nz: 'nx', nx: 'pz', pz: 'px' };
    const RIGHT = { px: 'pz', pz: 'nx', nx: 'nz', nz: 'px' };
    const key = (c) => c.join(',');
    // random walk; retry until the tunnel is long enough (walks can trap themselves)
    let cells = [], best = [];
    for (let attempt = 0; attempt < 30 && best.length < Math.min(nCells, 9 + t * 5); attempt++) {
    cells = [{ p: [0, 0, 0], open: new Set() }];
    const visited = new Set([key([0, 0, 0])]);
    let heading = 'px', lastVertical = false;
    for (let s = 1; s < nCells; s++) {
      const cur = cells[cells.length - 1];
      const opts = [];
      if (s < 3) opts.push(heading);
      else {
        const r = rand();
        if (!lastVertical && t >= 1 && r < 0.12) opts.push(rand() < 0.7 ? 'dn' : 'up');
        else if (r < 0.55) opts.push(heading);
        else opts.push(rand() < 0.5 ? LEFT[heading] : RIGHT[heading]);
        opts.push(heading, LEFT[heading], RIGHT[heading]);
      }
      let moved = false;
      for (const d of opts) {
        const v = DIRS[d];
        const np = [cur.p[0] + v[0], cur.p[1] + v[1], cur.p[2] + v[2]];
        if (visited.has(key(np))) continue;
        // keep a gap between parallel corridors on the same level
        const crowd = [[1, 0, 0], [-1, 0, 0], [0, 0, 1], [0, 0, -1]].filter((o) => visited.has(key([np[0] + o[0], np[1], np[2] + o[2]]))).length;
        if (d !== 'up' && d !== 'dn' && crowd > 1) continue;
        cur.open.add(d);
        cells.push({ p: np, open: new Set([OPP[d]]) });
        visited.add(key(np));
        lastVertical = d === 'up' || d === 'dn';
        if (!lastVertical) heading = d;
        moved = true;
        break;
      }
      if (!moved) break;
    }
    if (cells.length > best.length) best = cells;
    }
    cells = best;
    const bandXZ = [[-C / 2, -W / 2], [-W / 2, W / 2], [W / 2, C / 2]];
    const bandY = [[-C / 2, -H / 2], [-H / 2, H / 2], [H / 2, C / 2]];
    const openSub = (open, a, b, c) => {
      if (a === 1 && b === 1 && c === 1) return true;
      if (b === 1 && c === 1 && a === 2) return open.has('px');
      if (b === 1 && c === 1 && a === 0) return open.has('nx');
      if (a === 1 && b === 1 && c === 2) return open.has('pz');
      if (a === 1 && b === 1 && c === 0) return open.has('nz');
      if (a === 1 && c === 1 && b === 2) return open.has('up');
      if (a === 1 && c === 1 && b === 0) return open.has('dn');
      return false;
    };
    const center = (cell) => V(cell.p[0] * C, cell.p[1] * C, cell.p[2] * C);
    cells.forEach((cell, idx) => {
      const c0 = center(cell);
      for (let a = 0; a < 3; a++) for (let b = 0; b < 3; b++) for (let c = 0; c < 3; c++) {
        if (openSub(cell.open, a, b, c)) continue;
        const m = b === 0 ? 'tunnelFloor' : 'tunnel';
        ctx.box(m, c0.x + bandXZ[a][0], c0.y + bandY[b][0], c0.z + bandXZ[c][0], c0.x + bandXZ[a][1], c0.y + bandY[b][1], c0.z + bandXZ[c][1],
          { kind: b === 0 ? 'tunnel floor' : b === 2 ? 'tunnel ceiling' : 'tunnel wall', ao: false });
      }
      // ceiling light strip
      const vertical = cell.open.has('up') || cell.open.has('dn');
      if (!vertical) {
        ctx.box('hazard', c0.x - 0.6, c0.y + H / 2 - 0.08, c0.z - 0.6, c0.x + 0.6, c0.y + H / 2, c0.z + 0.6, { collide: false, ao: false, tint: 0xffffff });
        ctx.lamp(c0.x, c0.y + H / 2 - 0.3, c0.z, idx % 3 === 0 ? 0xffb070 : 0xcfe0ff, 1.8, C * 1.6);
      } else ctx.lamp(c0.x, c0.y, c0.z, 0xff9050, 1.6, C * 1.4);
    });
    // obstacles in straight horizontal cells
    const kinds = ['pipe', 'barrier', 'fan'];
    if (t >= 1) kinds.push('door');
    if (t >= 2) kinds.push('laser');
    let prevHaz = false;
    for (let i = 3; i < cells.length - 1; i++) {
      const cell = cells[i], o = cell.open;
      const alongX = o.has('px') && o.has('nx'), alongZ = o.has('pz') && o.has('nz');
      if (!(alongX || alongZ) || prevHaz || rand() > Math.min(0.85, 0.5 + t * 0.1)) { prevHaz = false; continue; }
      prevHaz = true;
      const c0 = center(cell), floor = c0.y - H / 2;
      const kind = pick(kinds);
      const perp = (half, y0, y1, thick) => alongX
        ? ctx.box('metal', c0.x - thick, y0, c0.z - half, c0.x + thick, y1, c0.z + half, { kind: 'pipe', ao: false, tint: 0x8a6a4a })
        : ctx.box('metal', c0.x - half, y0, c0.z - thick, c0.x + half, y1, c0.z + thick, { kind: 'pipe', ao: false, tint: 0x8a6a4a });
      if (kind === 'pipe') {
        const low = () => perp(W / 2 + 0.5, floor + 0.4, floor + R(0.9, 1.3), 0.3);
        const high = () => perp(W / 2 + 0.5, floor + H - R(1.1, 1.5), floor + H - 0.4, 0.3);
        const both = t >= 1 && H >= 4.6 && rand() < 0.5; // gap of at least 1.8 m left in the middle
        if (both) { low(); high(); } else if (rand() < 0.5) low(); else high();
      } else if (kind === 'barrier') {
        const r = rand();
        if (r < 0.4) perp(W / 2 + 0.5, floor - 0.2, floor + H * 0.45, 0.4);
        else if (r < 0.7) perp(W / 2 + 0.5, floor + H * 0.55, floor + H + 0.2, 0.4);
        else {
          // side block covering ~45% of the width
          const s = rand() < 0.5 ? -1 : 1, wPart = W * 0.45;
          if (alongX) ctx.box('concrete', c0.x - 0.5, floor - 0.2, c0.z + (s < 0 ? -W / 2 - 0.5 : W / 2 - wPart), c0.x + 0.5, floor + H + 0.2, c0.z + (s < 0 ? -W / 2 + wPart : W / 2 + 0.5), { kind: 'barrier', ao: false, tint: 0xd0c070 });
          else ctx.box('concrete', c0.x + (s < 0 ? -W / 2 - 0.5 : W / 2 - wPart), floor - 0.2, c0.z - 0.5, c0.x + (s < 0 ? -W / 2 + wPart : W / 2 + 0.5), floor + H + 0.2, c0.z + 0.5, { kind: 'barrier', ao: false, tint: 0xd0c070 });
        }
      } else if (kind === 'fan') {
        ctx.hazard(WC.Spinner(ctx.root, { x: c0.x, y: c0.y, z: c0.z, axis: alongX ? 'x' : 'z', len: Math.min(W, H) - 0.3, thick: 0.35, w: (1 + t * 0.35) * (rand() < 0.5 ? -1 : 1), phase: R(0, 6), blades: t >= 2 ? 2 : 1, kind: 'tunnel fan' }));
      } else if (kind === 'door') {
        ctx.hazard(WC.Door(ctx.root, {
          cx: c0.x, cy: c0.y, cz: c0.z, hx: alongX ? 0.3 : W / 2 + 0.2, hy: H / 2, hz: alongX ? W / 2 + 0.2 : 0.3,
          open: Math.max(1.4, R(2.4, 3.0) - t * 0.25), closed: 1.3, move: 0.5, phase: R(0, 4),
        }));
      } else {
        ctx.hazard(WC.Laser(ctx.root, { cx: c0.x, cy: c0.y, cz: c0.z, hx: alongX ? 0.03 : W / 2, hy: H / 2 - 0.05, hz: alongX ? W / 2 : 0.03, on: 1.2, off: R(1.4, 1.8), phase: R(0, 3), lines: 7 }));
      }
    }
    const first = cells[0], last = cells[cells.length - 1];
    const s0 = center(first), e0 = center(last);
    const firstDir = DIRS[[...first.open][0]];
    // ground lookup for the HUD (floor of the nearest cell level)
    ctx.groundLethal = false;
    ctx.groundAt = (x, z, y) => Math.round((y || 0) / C) * C - H / 2;
    ctx.ceilingAGL = Infinity;
    ctx.bounds = null;
    const spawn = V(s0.x - firstDir[0] * 1.5, s0.y - H / 2 + Math.min(1.9, H / 2), s0.z - firstDir[2] * 1.5);
    return {
      spawn, yaw: Math.atan2(-firstDir[0], -firstDir[2]),
      target: { kind: rand() < 0.5 ? 'server' : 'bomb', pos: V(e0.x, e0.y - H / 2 + 0.02, e0.z), rot: R(0, 6) },
      pathLen: cells.length * C, avgSpeed: t === 0 ? 6 : 5,
      preview(camera, time) {
        const a = Math.min(cells.length - 1, 1 + Math.floor((time * 0.25) % Math.max(1, Math.min(4, cells.length - 2))));
        const c = center(cells[a]);
        camera.position.set(s0.x + Math.sin(time * 0.3) * 0.5, s0.y + Math.sin(time * 0.5) * 0.3, s0.z);
        camera.lookAt(c.x, c.y, c.z);
      },
    };
  }

  return { forest, city, battle, house, tunnel, labels };
})();
