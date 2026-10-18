// World assembly: picks the biome for a level, builds it through a shared
// context, and exposes update / collision / HUD helpers to the game.
const World = (() => {
  const T = THREE;

  const BIOMES = ['forest', 'city', 'battle', 'house', 'tunnel'];
  const NAMES = {
    forest: ['FOREST', 'الغابة'],
    city: ['CITY', 'المدينة'],
    battle: ['WAR ZONE', 'ساحة المعركة'],
    house: ['SAFE HOUSE', 'داخل المنزل'],
    tunnel: ['TUNNEL', 'النفق'],
  };
  const SKIES = {
    day: { top: 0x3f86d6, bottom: 0xcfe9ff, fog: 0xc6e2f7, fogNear: 120, fogFar: 650, sun: 1.3, sunCol: 0xfff3dd, hemi: 0.7, hemiGround: 0x4a4a3a, emissive: 0, light: false },
    sunset: { top: 0x2b3a73, bottom: 0xff9a5c, fog: 0xe0906a, fogNear: 80, fogFar: 480, sun: 1.05, sunCol: 0xffa766, hemi: 0.55, hemiGround: 0x3a3030, emissive: 0.25, light: false, sunDir: [-0.8, 0.45, 0.3] },
    fog: { top: 0x7a8794, bottom: 0xa3aeb8, fog: 0x98a4af, fogNear: 6, fogFar: 140, sun: 0.5, sunCol: 0xdde6ee, hemi: 0.85, hemiGround: 0x404448, emissive: 0.4, light: true },
    night: { top: 0x03050d, bottom: 0x1b2447, fog: 0x0a1020, fogNear: 15, fogFar: 230, sun: 0.3, sunCol: 0x8fa5ff, hemi: 0.35, hemiGround: 0x101018, emissive: 1.0, light: true },
    war: { top: 0x4a4440, bottom: 0xc08a5a, fog: 0x8a7260, fogNear: 30, fogFar: 330, sun: 0.85, sunCol: 0xffc890, hemi: 0.6, hemiGround: 0x3a3028, emissive: 0.3, light: false, sunDir: [-0.7, 0.5, 0.4] },
    warnight: { top: 0x07060a, bottom: 0x3a2418, fog: 0x1c1410, fogNear: 20, fogFar: 250, sun: 0.22, sunCol: 0xff9a60, hemi: 0.35, hemiGround: 0x100808, emissive: 1, light: true },
    under: { top: 0, bottom: 0, fog: 0x040506, fogNear: 4, fogFar: 62, sun: 0, sunCol: 0xffffff, hemi: 0.22, hemiGround: 0x151515, emissive: 0, light: true, noSky: true },
  };

  function info(L) {
    const biome = BIOMES[(L - 1) % BIOMES.length];
    const tier = Math.floor((L - 1) / BIOMES.length);
    return { biome, tier, name: NAMES[biome] };
  }

  function build(L, scene) {
    const { biome, tier, name } = info(L);
    const rand = WC.mulberry32(L * 7919 + 13);
    const root = new T.Group();
    scene.add(root);
    const disposables = [];
    const builder = WC.Builder();
    const col = WC.Colliders();
    const hazards = [];
    const lamps = [];
    const fires = [];
    const smokes = [];
    const glassMat = new T.MeshLambertMaterial({ color: 0x9ec8e8, transparent: true, opacity: 0.28, depthWrite: false });
    const glassGeo = new T.BoxGeometry(1, 1, 1);
    disposables.push(glassMat, glassGeo);

    const ctx = {
      L, tier, rand, root,
      R: (a, b) => a + (b - a) * rand(),
      pick: (arr) => arr[Math.floor(rand() * arr.length)],
      chance: (p) => rand() < p,
      track(o) { disposables.push(o); return o; },
      groundAt: () => 0,
      groundLethal: true,
      ceilingAGL: Infinity,
      bounds: null,
      wind: 0,
      sky: 'day',
      labels: [],
      obox(m, cx, cy, cz, hx, hy, hz, rot, o) {
        o = o || {};
        builder.box(m, cx, cy, cz, hx, hy, hz, rot || 0, o.tint, o.ao !== false);
        if (o.collide !== false) col.obb(cx, cy, cz, hx, hy, hz, rot || 0, o.kind || 'wall');
      },
      box(m, x0, y0, z0, x1, y1, z1, o) {
        ctx.obox(m, (x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2, Math.abs(x1 - x0) / 2, Math.abs(y1 - y0) / 2, Math.abs(z1 - z0) / 2, 0, o);
      },
      cyl: (x, z, r, y0, y1, kind) => col.cyl(x, z, r, y0, y1, kind),
      sph: (x, y, z, r, kind) => col.sph(x, y, z, r, kind),
      hazard(h) {
        hazards.push(h);
        (h.geo || []).forEach((g) => disposables.push(g));
        (h.mats || []).forEach((m) => disposables.push(m));
        return h;
      },
      lamp(x, y, z, color, intensity, dist, flicker) { lamps.push({ p: new T.Vector3(x, y, z), color, intensity, dist, flicker: !!flicker }); },
      fire(x, y, z, s) { fires.push({ x, y, z, s: s || 1, acc: 0 }); ctx.lamp(x, y + 1.5, z, 0xff7a30, 2.2 * (s || 1), 26, true); },
      smoke(x, y, z) { smokes.push({ x, y, z, acc: 0 }); },
      glass(x0, y0, z0, x1, y1, z1) {
        const m = new T.Mesh(glassGeo, glassMat);
        m.scale.set(Math.max(0.02, x1 - x0), y1 - y0, Math.max(0.02, z1 - z0));
        m.position.set((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
        root.add(m);
        col.obb(m.position.x, m.position.y, m.position.z, m.scale.x / 2, m.scale.y / 2, m.scale.z / 2, 0, 'window');
      },
      // straight wall (along x or z) with rectangular openings {at, w, y0, y1}
      wall(m, x0, z0, x1, z1, y0, y1, th, openings, o) {
        if (x0 > x1) [x0, x1] = [x1, x0];
        if (z0 > z1) [z0, z1] = [z1, z0];
        const alongX = x1 - x0 >= z1 - z0;
        const len = alongX ? x1 - x0 : z1 - z0;
        const e = th / 2;
        const seg = (a, b, ya, yb) => {
          if (b - a < 0.02 || yb - ya < 0.02) return;
          if (alongX) ctx.box(m, x0 + a, ya, z0 - e, x0 + b, yb, z0 + e, o);
          else ctx.box(m, x0 - e, ya, z0 + a, x0 + e, yb, z0 + b, o);
        };
        const ops = (openings || []).slice().sort((a, b) => a.at - b.at);
        let cur = -e;
        for (const op of ops) {
          const s = op.at - op.w / 2, f = op.at + op.w / 2;
          seg(cur, s, y0, y1);
          seg(s, f, y0, op.y0);
          seg(s, f, op.y1, y1);
          if (op.glass) {
            if (alongX) ctx.glass(x0 + s, op.y0, z0 - 0.03, x0 + f, op.y1, z0 + 0.03);
            else ctx.glass(x0 - 0.03, op.y0, z0 + s, x0 + 0.03, op.y1, z0 + f);
          }
          cur = f;
        }
        seg(cur, len + e, y0, y1);
      },
      // single room / cabin / bunker with one doorway
      room(o) {
        const x0 = o.x - o.w / 2, x1 = o.x + o.w / 2, z0 = o.z - o.d / 2, z1 = o.z + o.d / 2;
        const y0 = o.y0, y1 = o.y0 + o.H, th = o.th || 0.35;
        const sides = { s: [x0, z0, x1, z0], n: [x0, z1, x1, z1], w: [x0, z0, x0, z1], e: [x1, z0, x1, z1] };
        for (const k in sides) {
          const sd = sides[k];
          const len = Math.abs(sd[2] - sd[0]) + Math.abs(sd[3] - sd[1]);
          const ops = [];
          if (k === o.door.side) ops.push({ at: len / 2 + (o.door.off || 0), w: o.door.w, y0: y0 + (o.door.y || 0), y1: y0 + (o.door.y || 0) + o.door.h });
          else if (o.windows && len > 4) ops.push({ at: len / 2, w: 1.3, y0: y0 + 1.1, y1: y0 + 2.2, glass: true });
          ctx.wall(o.mat, sd[0], sd[1], sd[2], sd[3], y0 - 0.8, y1, th, ops, { kind: o.kind || 'wall' });
        }
        ctx.box(o.floorMat || 'woodfloor', x0, y0 - 0.8, z0, x1, y0 + 0.05, z1, { kind: 'floor', ao: false });
        ctx.box(o.roofMat || 'roof', x0 - 0.6, y1, z0 - 0.6, x1 + 0.6, y1 + (o.roofT || 0.35), z1 + 0.6, { kind: 'roof', ao: false });
        if (o.lamp !== false) ctx.lamp(o.x, y1 - 0.4, o.z, 0xffd9a0, 1.2, 10);
        const out = { s: [0, -1], n: [0, 1], w: [-1, 0], e: [1, 0] }[o.door.side];
        const dx = o.door.side === 's' || o.door.side === 'n' ? (o.door.off || 0) : 0;
        const dz = o.door.side === 'w' || o.door.side === 'e' ? (o.door.off || 0) : 0;
        return { doorX: o.x + dx + out[0] * (o.w / 2), doorZ: o.z + dz + out[1] * (o.d / 2), out };
      },
      terrain(texKey, cx, cz, size, seg, tint) {
        const g = new T.PlaneGeometry(size, size, seg, seg);
        g.rotateX(-Math.PI / 2);
        const p = g.attributes.position;
        const cols = [];
        const c = new T.Color();
        for (let i = 0; i < p.count; i++) {
          const x = p.getX(i) + cx, z = p.getZ(i) + cz;
          const y = ctx.groundAt(x, z);
          p.setXYZ(i, x, y, z);
          c.setHex(0xffffff);
          if (tint) tint(x, z, y, c);
          cols.push(c.r, c.g, c.b);
        }
        g.setAttribute('color', new T.Float32BufferAttribute(cols, 3));
        g.computeVertexNormals();
        const tex = WC.TEX[texKey]().clone();
        tex.needsUpdate = true;
        tex.repeat.set(size / 7, size / 7);
        const m = new T.Mesh(g, new T.MeshLambertMaterial({ map: tex, vertexColors: true }));
        m.receiveShadow = true;
        root.add(m);
        disposables.push(g, m.material, tex);
      },
      trees(list) { WC.Trees(root, list).forEach((d) => disposables.push(d)); },
    };

    const res = Biomes[biome](ctx);
    const sky = SKIES[ctx.sky];

    // static geometry
    const built = builder.build(sky);
    built.meshes.forEach((m) => root.add(m));
    built.dispose.forEach((d) => disposables.push(d));

    // sky dome, lights, fog
    if (!sky.noSky) {
      const skyGeo = new T.SphereGeometry(1800, 24, 16);
      const cs = [], ct = new T.Color(sky.top), cb = new T.Color(sky.bottom), cm = new T.Color();
      const sp = skyGeo.attributes.position;
      for (let i = 0; i < sp.count; i++) {
        cm.copy(cb).lerp(ct, Math.pow(Math.max(0, sp.getY(i) / 1800), 0.6));
        cs.push(cm.r, cm.g, cm.b);
      }
      skyGeo.setAttribute('color', new T.Float32BufferAttribute(cs, 3));
      const skyMat = new T.MeshBasicMaterial({ vertexColors: true, side: T.BackSide, fog: false, depthWrite: false });
      const skyMesh = new T.Mesh(skyGeo, skyMat);
      skyMesh.renderOrder = -1;
      root.add(skyMesh);
      disposables.push(skyGeo, skyMat);
    }
    scene.fog = new T.Fog(sky.fog, sky.fogNear, sky.fogFar);
    scene.background = new T.Color(sky.noSky ? 0x000000 : sky.bottom);
    const hemi = new T.HemisphereLight(sky.top || 0x404040, sky.hemiGround, sky.hemi);
    root.add(hemi);
    let sun = null;
    const sunDir = new T.Vector3().fromArray(sky.sunDir || [-0.5, 1, 0.35]).normalize();
    if (sky.sun > 0) {
      sun = new T.DirectionalLight(sky.sunCol, sky.sun);
      sun.castShadow = true;
      sun.shadow.mapSize.set(2048, 2048);
      const sc = sun.shadow.camera;
      sc.left = -70; sc.right = 70; sc.top = 70; sc.bottom = -70; sc.near = 1; sc.far = 450;
      sun.shadow.bias = -0.0006;
      sun.shadow.normalBias = 0.04;
      root.add(sun, sun.target);
    }

    // nearest-lamp light pool (fixed light count keeps shaders stable)
    const pool = [];
    if (lamps.length) {
      for (let i = 0; i < 4; i++) { const l = new T.PointLight(0xffffff, 0, 10, 2); root.add(l); pool.push(l); }
    }

    // target
    const tm = WC.makeTarget(res.target.kind);
    const tBase = res.target.pos.clone();
    tm.group.position.copy(tBase);
    tm.group.rotation.y = res.target.rot || 0;
    root.add(tm.group);
    const targetPos = tBase.clone().add(tm.center);

    const startPos = res.spawn.clone();
    const startYaw = res.yaw != null ? res.yaw : Math.atan2(-(targetPos.x - startPos.x), -(targetPos.z - startPos.z));

    const slack = Math.max(1.2, 1.55 - 0.08 * tier);
    const timeLimit = Math.round(res.pathLen / res.avgSpeed * slack + 14);

    const windAng = rand() * Math.PI * 2;
    let time = 0;
    let lockWarning = false;
    const tmpV = new T.Vector3();

    function update(dt, dp, dv) {
      time += dt;
      lockWarning = false;
      for (const h of hazards) {
        h.update(dt, time, dp, dv);
        if (h.locked) lockWarning = true;
      }
      // target
      tm.group.position.copy(tBase);
      if (res.target.move) tm.group.position.add(res.target.move(time));
      if (res.target.face) tm.group.rotation.y = res.target.face(time);
      targetPos.copy(tm.group.position).add(tm.center);
      tm.animate(time);
      // fires and smoke columns
      const ref = dp || targetPos;
      for (const f of fires) {
        if (Math.abs(f.x - ref.x) + Math.abs(f.z - ref.z) > 260) continue;
        f.acc += dt * 26 * f.s;
        while (f.acc > 1) { f.acc -= 1; FX.puff(f.x, f.y, f.z, 'fire', f.s); }
      }
      for (const s of smokes) {
        if (Math.abs(s.x - ref.x) + Math.abs(s.z - ref.z) > 320) continue;
        s.acc += dt * 7;
        while (s.acc > 1) { s.acc -= 1; FX.puff(s.x, s.y, s.z, 'column', 1); }
      }
      if (pool.length && dp) {
        lamps.sort((a, b) => a.p.distanceToSquared(dp) - b.p.distanceToSquared(dp));
        for (let i = 0; i < pool.length; i++) {
          const l = pool[i], lp = lamps[i];
          if (!lp) { l.intensity = 0; continue; }
          l.position.copy(lp.p); l.color.setHex(lp.color); l.distance = lp.dist;
          l.intensity = lp.intensity * (lp.flicker ? 0.7 + 0.3 * Math.sin(time * 13 + i) * Math.sin(time * 7.3 + i * 2) : 1);
        }
      }
      if (sun) {
        const c = dp || targetPos;
        // snap to texel grid so shadows don't shimmer
        const snap = 140 / 2048;
        tmpV.set(Math.round(c.x / snap) * snap, Math.round(c.y / snap) * snap, Math.round(c.z / snap) * snap);
        sun.target.position.copy(tmpV);
        sun.position.copy(tmpV).addScaledVector(sunDir, 200);
      }
    }

    function collide(p, r) {
      if (ctx.groundLethal && p.y < ctx.groundAt(p.x, p.z, p.y) + 0.3) return 'ground';
      const k = col.hit(p, r);
      if (k) return k;
      for (const h of hazards) { const hk = h.collide(p, r); if (hk) return hk; }
      return null;
    }

    function nearestHazard(p) {
      let m = col.nearest(p);
      if (ctx.groundLethal) m = Math.min(m, p.y - ctx.groundAt(p.x, p.z, p.y) + 0.5); // warn below ~1 m
      for (const h of hazards) m = Math.min(m, h.near(p));
      return m;
    }

    function preview(camera, t) {
      if (res.preview) { res.preview(camera, t); return; }
      const c = res.previewCenter || targetPos;
      const r = res.previewRadius || 120;
      const a = t * 0.1;
      camera.position.set(c.x + Math.cos(a) * r, (c.y || 0) + (res.previewHeight || 55) + 8 * Math.sin(t * 0.3), c.z + Math.sin(a) * r);
      camera.lookAt(c.x, (c.y || 0) + 8, c.z);
    }

    function dispose() {
      scene.remove(root);
      disposables.forEach((d) => d && d.dispose && d.dispose());
      scene.fog = null;
    }

    update(0, null, null);

    return {
      L, biome, tier, name, labels: ctx.labels, sky,
      update, collide, nearestHazard, preview, dispose,
      startPos, startYaw, targetPos, targetR: tm.r, timeLimit,
      groundAt: ctx.groundAt, groundLethal: ctx.groundLethal,
      ceilingAt: (x, z) => ctx.groundAt(x, z) + ctx.ceilingAGL,
      bounds: ctx.bounds,
      windAt(t) {
        if (!ctx.wind) return null;
        const g = ctx.wind * (0.6 + 0.3 * Math.sin(t * 0.8) + 0.2 * Math.sin(t * 2.1 + 1));
        return { x: Math.cos(windAng) * g, z: Math.sin(windAng) * g, speed: ctx.wind };
      },
      get lockWarning() { return lockWarning; },
      target: tm.group,
    };
  }

  function labelsFor(L) {
    // hazard list without building the level (for the menu)
    const { biome, tier } = info(L);
    return Biomes.labels(biome, tier);
  }

  return { build, info, labelsFor, NAMES };
})();
