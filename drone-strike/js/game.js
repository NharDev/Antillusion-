// DRONE STRIKE — game loop, quadcopter flight model, HUD, menus.
(() => {
  const $ = (id) => document.getElementById(id);
  const T = THREE;

  const canvas = $('c');
  const renderer = new T.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = T.PCFSoftShadowMap;
  const scene = new T.Scene();
  const camera = new T.PerspectiveCamera(100, 1, 0.08, 2500);
  scene.add(camera);
  const headlight = new T.SpotLight(0xfff4e0, 0, 70, 0.55, 0.5, 1.2);
  camera.add(headlight, headlight.target);
  headlight.target.position.set(0, -0.15, -1);
  FX.init(scene);

  const staticCv = $('static');
  const sctx = staticCv.getContext('2d');
  staticCv.width = 160; staticCv.height = 90;
  const sImg = sctx.createImageData(160, 90);

  function resize() {
    const w = innerWidth, h = innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    FX.setScale(h * renderer.getPixelRatio(), camera.fov);
  }
  addEventListener('resize', resize);

  // ---------- persistence ----------
  const store = {
    get(k, d) { try { const v = localStorage.getItem(k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* ignore */ } },
  };
  let unlocked = store.get('ds2_unlocked', 1);
  const best = store.get('ds2_best', {});

  // ---------- flight modes ----------
  const MODES = [
    { name: 'NORMAL', ar: 'سلس', tilt: 25, boostTilt: 10, yawRate: 1.9, kp: 6.5, rateResp: 14, climb: 5, autoBrake: 1, cam: 10 },
    { name: 'SPORT', ar: 'رياضي', tilt: 42, boostTilt: 16, yawRate: 2.6, kp: 9, rateResp: 18, climb: 7.5, autoBrake: 0, cam: 20 },
    { name: 'ACRO', ar: 'يدوي FPV', rate: 7.5, yawRate: 4.2, rateResp: 22, cam: 30 },
  ];
  let mode = Math.min(2, store.get('ds2_mode', 0));
  const camTilts = store.get('ds2_cam', MODES.map((m) => m.cam));

  // ---------- state ----------
  let state = 'title';
  let level = Math.max(1, Math.min(unlocked, store.get('ds2_last', 1)));
  let selLevel = level;
  let world = null;
  let stateT = 0, time = 0;
  let tLeft = 0, elapsed = 0;
  let shake = 0;
  let crashCam = null;
  let lastWarn = 0, lastBeep = 0;
  let warnMsg = '', warnT = 0;
  let toast = '', toastT = 0;
  let countStep = -1;
  let previewDirty = true;
  let thrustNow = 9.81;

  const G = 9.81, C1 = 0.1, C2 = 0.012, R_DRONE = 0.6;
  const drone = {
    pos: new T.Vector3(), vel: new T.Vector3(),
    q: new T.Quaternion(), w: new T.Vector3(), heading: 0,
  };
  const fin = { throttle: 0, yaw: 0, pitch: 0, roll: 0 };
  // scratch objects
  const qT = new T.Quaternion(), qe = new T.Quaternion(), dq = new T.Quaternion(), qTilt = new T.Quaternion();
  const eul = new T.Euler(), wd = new T.Vector3(), up = new T.Vector3(), tmpV = new T.Vector3(), axX = new T.Vector3(1, 0, 0);

  const REASON = {
    ground: ['You hit the ground', 'اصطدمت بالأرض'],
    building: ['You hit a building', 'اصطدمت بمبنى'],
    wall: ['You hit a wall', 'اصطدمت بجدار'],
    'rooftop unit': ['You hit a rooftop unit', 'اصطدمت بوحدة على السطح'],
    antenna: ['You hit an antenna', 'اصطدمت بهوائي'],
    cable: ['You hit a cable', 'اصطدمت بكابل'],
    'lamp post': ['You hit a lamp post', 'اصطدمت بعمود إنارة'],
    'parked car': ['You hit a parked car', 'اصطدمت بسيارة'],
    'patrol drone': ['You hit a patrol drone', 'اصطدمت بدرون دورية'],
    'spinning blade': ['You hit a spinning blade', 'اصطدمت بشفرة دوّارة'],
    'blade pylon': ['You hit a blade pylon', 'اصطدمت بعمود الشفرات'],
    tree: ['You hit a tree', 'اصطدمت بشجرة'],
    'fallen log': ['You hit a fallen log', 'اصطدمت بجذع شجرة'],
    rock: ['You hit a rock', 'اصطدمت بصخرة'],
    'cabin wall': ['You hit the cabin', 'اصطدمت بالكوخ'],
    window: ['You hit a window', 'اصطدمت بنافذة'],
    floor: ['You hit the floor', 'اصطدمت بالأرضية'],
    roof: ['You hit a roof', 'اصطدمت بسقف'],
    ceiling: ['You hit the ceiling', 'اصطدمت بالسقف'],
    table: ['You hit a table', 'اصطدمت بطاولة'],
    bookshelf: ['You hit a bookshelf', 'اصطدمت بمكتبة'],
    sofa: ['You hit a sofa', 'اصطدمت بكنبة'],
    boxes: ['You hit boxes', 'اصطدمت بصناديق'],
    'ceiling fan': ['You hit a ceiling fan', 'اصطدمت بمروحة السقف'],
    laser: ['You tripped a laser', 'لمست شعاع الليزر'],
    fence: ['You hit a fence', 'اصطدمت بسور'],
    'power line': ['You hit a power line', 'اصطدمت بسلك كهرباء'],
    'power pole': ['You hit a power pole', 'اصطدمت بعمود كهرباء'],
    house: ['You hit a house', 'اصطدمت بمنزل'],
    'ruined wall': ['You hit a ruined wall', 'اصطدمت بجدار مدمر'],
    'collapsed floor': ['You hit a collapsed floor', 'اصطدمت بأرضية منهارة'],
    rubble: ['You hit rubble', 'اصطدمت بالركام'],
    'tank wreck': ['You hit a tank wreck', 'اصطدمت بدبابة مدمرة'],
    sandbags: ['You hit sandbags', 'اصطدمت بأكياس الرمل'],
    'tank trap': ['You hit a tank trap', 'اصطدمت بمصد دبابات'],
    'barbed wire': ['You hit barbed wire', 'اصطدمت بالأسلاك الشائكة'],
    'anti-air fire': ['Shot down by anti-air fire', 'أُسقطت بنيران المضادات'],
    'anti-air gun': ['You hit an anti-air gun', 'اصطدمت بمدفع مضاد'],
    'artillery strike': ['Caught in an artillery strike', 'أصابتك قذيفة مدفعية'],
    'bunker wall': ['You hit the bunker', 'اصطدمت بالمخبأ'],
    'tunnel wall': ['You hit the tunnel wall', 'اصطدمت بجدار النفق'],
    'tunnel floor': ['You hit the tunnel floor', 'اصطدمت بأرضية النفق'],
    'tunnel ceiling': ['You hit the tunnel ceiling', 'اصطدمت بسقف النفق'],
    pipe: ['You hit a pipe', 'اصطدمت بأنبوب'],
    barrier: ['You hit a barrier', 'اصطدمت بحاجز'],
    'tunnel fan': ['You hit a fan', 'اصطدمت بالمروحة'],
    'blast door': ['Crushed by a blast door', 'سحقك الباب الفولاذي'],
    battery: ['Battery depleted — out of time', 'نفدت البطارية — انتهى الوقت'],
  };

  const isPad = () => Input.state.device === 'pad';
  const K = {
    ok: () => (isPad() ? '✕' : 'ENTER'),
    redo: () => (isPad() ? '□' : 'R'),
    back: () => (isPad() ? '○' : 'BACKSPACE'),
    mode: () => (isPad() ? '△' : 'M'),
  };

  function show(id, v) { $(id).classList.toggle('hidden', !v); }
  function setPanels(which) {
    ['title', 'pause', 'crash', 'win'].forEach((p) => show(p, p === which));
    show('hud', which === null || which === 'pause');
    show('count', false);
  }

  // ---------- level lifecycle ----------
  function loadWorld(L) {
    if (world) world.dispose();
    FX.clear();
    world = World.build(L, scene);
    headlight.intensity = world.sky.light ? 2.6 : 0;
  }

  function levelInfoText(L) {
    const inf = World.info(L);
    return `${inf.name[0]} · <bdi>${inf.name[1]}</bdi><br><small>${World.labelsFor(L).join(' · ')}</small>`;
  }

  function toTitle() {
    state = 'title';
    selLevel = Math.min(level, unlocked);
    previewDirty = true;
    setPanels('title');
    Sfx.engine(false, 0, 0);
  }

  function resetDrone() {
    drone.pos.copy(world.startPos);
    drone.vel.set(0, 0, 0);
    drone.w.set(0, 0, 0);
    drone.heading = world.startYaw;
    drone.q.setFromEuler(eul.set(0, drone.heading, 0, 'YXZ'));
    fin.throttle = fin.yaw = fin.pitch = fin.roll = 0;
  }

  function startLevel(L) {
    level = L;
    store.set('ds2_last', L);
    loadWorld(L);
    resetDrone();
    tLeft = world.timeLimit;
    elapsed = 0; shake = 0; crashCam = null;
    state = 'ready'; stateT = 0; countStep = -1;
    setPanels(null);
    show('hud', true); show('count', true);
    $('hLevel').textContent = L;
    $('hBiome').textContent = world.name[0];
    $('flash').style.opacity = 0;
    $('static').style.opacity = 0;
    Input.clearEdges();
  }

  function crash(kind) {
    if (state !== 'flying') return;
    state = 'crashed'; stateT = 0;
    const r = REASON[kind] || ['You crashed', 'تحطمت'];
    $('crashReason').innerHTML = `${r[0]}<br><span class="ar" dir="rtl">${r[1]}</span>`;
    FX.explode(drone.pos, 1.0);
    Sfx.explosion(false);
    Sfx.engine(false, 0, 0);
    Input.rumble(700, 1, 1);
    shake = 1.4;
    $('flash').style.opacity = 1;
    show('hud', false);
    makeCrashCam(drone.pos, drone.vel);
  }

  function win() {
    if (state !== 'flying') return;
    state = 'won'; stateT = 0;
    FX.explode(world.targetPos, 1.4, 'target');
    FX.explode(world.targetPos, 0.9);
    Sfx.explosion(true);
    Sfx.engine(false, 0, 0);
    Input.rumble(900, 0.8, 1);
    shake = 1.2;
    $('flash').style.opacity = 1;
    show('hud', false);
    makeCrashCam(world.targetPos, drone.vel);
    world.target.visible = false;
    const ratio = tLeft / world.timeLimit;
    const stars = ratio > 0.45 ? 3 : ratio > 0.2 ? 2 : 1;
    const t = elapsed, prev = best[level];
    const isBest = prev === undefined || t < prev;
    if (isBest) { best[level] = +t.toFixed(2); store.set('ds2_best', best); }
    if (level + 1 > unlocked) { unlocked = level + 1; store.set('ds2_unlocked', unlocked); }
    $('winStats').innerHTML = `LEVEL ${level} · ${world.name[0]} COMPLETE<br>Time ${t.toFixed(1)} s · ${isBest ? 'NEW BEST!' : `Best ${prev.toFixed(1)} s`}`;
    $('stars').textContent = '★'.repeat(stars) + '☆'.repeat(3 - stars);
  }

  function makeCrashCam(at, vel) {
    const dir = tmpV.copy(vel);
    if (dir.lengthSq() < 0.5) dir.set(0, 0, -1).applyQuaternion(drone.q);
    dir.y = 0;
    if (dir.lengthSq() < 1e-4) dir.set(0, 0, -1);
    dir.normalize();
    let cam = drone.pos.clone();
    for (const d of [14, 9, 6, 3.5, 2]) {
      const c = new T.Vector3(at.x - dir.x * d, at.y + d * 0.3 + 0.5, at.z - dir.z * d);
      if (!world.collide(c, 0.5)) { cam = c; break; }
    }
    crashCam = { pos: cam, look: at.clone() };
  }

  // ---------- flight model ----------
  // Quadcopter: attitude (quaternion) driven by body rates, thrust along body-up,
  // gravity, linear+quadratic drag. NORMAL/SPORT self-level and hold altitude;
  // ACRO maps sticks to rotation rates like a real FPV quad.
  function stepDrone(h, inp) {
    const d = drone, M = MODES[mode];
    let p = fin.pitch, r = fin.roll, yw = fin.yaw;
    const th = fin.throttle, boost = inp.boost, brake = inp.brake;
    if (M.name !== 'ACRO') {
      const s = Math.sin(d.heading), c = Math.cos(d.heading);
      const vf = -d.vel.x * s - d.vel.z * c, vr = d.vel.x * c - d.vel.z * s;
      const kb = 0.12;
      const bp = Math.max(-1, Math.min(1, -vf * kb)), br = Math.max(-1, Math.min(1, -vr * kb));
      // DJI-style auto brake when the stick is released (NORMAL), or on L2
      const hold = M.autoBrake;
      p += bp * (1 - Math.min(1, Math.abs(p) * 3)) * hold;
      r += br * (1 - Math.min(1, Math.abs(r) * 3)) * hold;
      if (brake > 0) { p += (bp * 1.4 - p) * brake; r += (br * 1.4 - r) * brake; }
      p = Math.max(-1, Math.min(1, p)); r = Math.max(-1, Math.min(1, r));
      const maxTilt = T.MathUtils.degToRad(M.tilt + boost * M.boostTilt);
      d.heading -= yw * M.yawRate * h;
      qT.setFromEuler(eul.set(-p * maxTilt, d.heading, -r * maxTilt, 'YXZ'));
      qe.copy(d.q).invert().multiply(qT);
      if (qe.w < 0) { qe.x = -qe.x; qe.y = -qe.y; qe.z = -qe.z; qe.w = -qe.w; }
      const ang = 2 * Math.acos(Math.min(1, qe.w));
      const sn = Math.sqrt(Math.max(0, 1 - qe.w * qe.w));
      if (sn > 1e-6) wd.set(qe.x / sn, qe.y / sn, qe.z / sn).multiplyScalar(ang * M.kp);
      else wd.set(0, 0, 0);
      if (wd.length() > 7) wd.setLength(7);
    } else {
      wd.set(-p * M.rate, -yw * M.yawRate, -r * M.rate);
    }
    d.w.lerp(wd, Math.min(1, h * M.rateResp));
    const wl = d.w.length();
    if (wl > 1e-6) { dq.setFromAxisAngle(tmpV.copy(d.w).divideScalar(wl), wl * h); d.q.multiply(dq).normalize(); }

    up.set(0, 1, 0).applyQuaternion(d.q);
    let thrust;
    if (M.name !== 'ACRO') {
      const vyT = th * M.climb * (1 + 0.4 * boost);
      const az = G + (vyT - d.vel.y) * 3.2 + d.vel.y * (C1 + C2 * Math.abs(d.vel.y));
      thrust = Math.max(0, Math.min(G * 3.2, az / Math.max(0.35, up.y)));
    } else {
      thrust = G * Math.max(0.05, Math.min(3.6, 1 + th * (th > 0 ? 1.7 : 0.95) + boost * 0.9));
    }
    thrustNow = thrust;
    const sp = d.vel.length();
    const k = C1 + C2 * sp + brake * (M.name === 'ACRO' ? 0.8 : 0);
    let ax = up.x * thrust - d.vel.x * k, ay = up.y * thrust - G - d.vel.y * k, az = up.z * thrust - d.vel.z * k;
    const wnd = world.windAt(time);
    if (wnd) { ax += wnd.x; az += wnd.z; }
    d.vel.x += ax * h; d.vel.y += ay * h; d.vel.z += az * h;
    d.pos.addScaledVector(d.vel, h);
  }

  function physics(dt, inp) {
    // smooth stick input (removes jitter, keeps it responsive)
    const a = 1 - Math.exp(-dt / 0.055);
    fin.throttle += (inp.throttle - fin.throttle) * a;
    fin.yaw += (inp.yaw - fin.yaw) * a;
    fin.pitch += (inp.pitch - fin.pitch) * a;
    fin.roll += (inp.roll - fin.roll) * a;
    const STEP = 1 / 240;
    let acc = dt;
    while (acc > 1e-6 && state === 'flying') {
      const h = Math.min(STEP, acc); acc -= h;
      stepDrone(h, inp);
      const p = drone.pos, b = world.bounds;
      const ceil = world.ceilingAt(p.x, p.z);
      if (p.y > ceil) { p.y = ceil; if (drone.vel.y > 0) drone.vel.y = 0; flag('ALTITUDE LIMIT'); }
      if (b) {
        if (p.x < b.minX) { p.x = b.minX; drone.vel.x = Math.max(0, drone.vel.x); flag('OUT OF RANGE'); }
        if (p.x > b.maxX) { p.x = b.maxX; drone.vel.x = Math.min(0, drone.vel.x); flag('OUT OF RANGE'); }
        if (p.z < b.minZ) { p.z = b.minZ; drone.vel.z = Math.max(0, drone.vel.z); flag('OUT OF RANGE'); }
        if (p.z > b.maxZ) { p.z = b.maxZ; drone.vel.z = Math.min(0, drone.vel.z); flag('OUT OF RANGE'); }
      }
      if (p.distanceTo(world.targetPos) < world.targetR + 0.3) { win(); return; }
      const k = world.collide(p, R_DRONE);
      if (k) { crash(k); return; }
    }
  }
  function flag(msg) { warnMsg = msg; warnT = 0.4; }

  // ---------- camera ----------
  function placeFpvCamera() {
    camera.position.copy(drone.pos);
    qTilt.setFromAxisAngle(axX, T.MathUtils.degToRad(camTilts[mode]));
    camera.quaternion.copy(drone.q).multiply(qTilt);
    // motor vibration, stronger with thrust
    const vib = 0.0012 + 0.0016 * Math.min(1, thrustNow / (G * 2));
    camera.rotateX((Math.random() - 0.5) * vib);
    camera.rotateZ((Math.random() - 0.5) * vib);
    const spd = drone.vel.length();
    const fov = 104 + Math.min(14, spd * 0.4);
    if (Math.abs(camera.fov - fov) > 0.05) { camera.fov = fov; camera.updateProjectionMatrix(); FX.setScale(innerHeight * renderer.getPixelRatio(), fov); }
    if (shake > 0) {
      const s = shake * 0.3;
      camera.position.x += (Math.random() - 0.5) * s;
      camera.position.y += (Math.random() - 0.5) * s;
      camera.position.z += (Math.random() - 0.5) * s;
      camera.rotateZ((Math.random() - 0.5) * shake * 0.05);
    }
  }

  // ---------- HUD ----------
  const el = {
    time: $('hTime'), fill: $('battFill'), speed: $('hSpeed'), alt: $('hAlt'), wind: $('hWind'),
    dist: $('hDist'), warn: $('hWarn'), comp: $('compassArrow'), marker: $('marker'), mDist: $('markerDist'),
    edge: $('edgeArrow'), horiz: $('horizon'), cam: $('cam'), mode: $('hMode'), toast: $('toast'),
  };
  const projV = new T.Vector3(), vR = new T.Vector3(), vU = new T.Vector3(), vF = new T.Vector3();
  function updateHud() {
    const W = innerWidth, H = innerHeight;
    const tl = Math.max(0, tLeft);
    el.time.textContent = tl.toFixed(1);
    el.fill.style.width = Math.max(0, tl / world.timeLimit) * 100 + '%';
    const low = tl < 10;
    $('hud').style.color = low ? '#ffb347' : '#7dff9a';
    el.time.classList.toggle('warnflash', low && state === 'flying');
    el.speed.innerHTML = `${Math.round(drone.vel.length() * 3.6)} <small>km/h</small>`;
    const agl = drone.pos.y - world.groundAt(drone.pos.x, drone.pos.z, drone.pos.y);
    const ceil = world.ceilingAt(drone.pos.x, drone.pos.z) - world.groundAt(drone.pos.x, drone.pos.z, drone.pos.y);
    el.alt.innerHTML = `${agl.toFixed(1)} <small>m${isFinite(ceil) ? ' / ' + Math.round(ceil) : ''}</small>`;
    const wnd = world.windAt(time);
    el.wind.textContent = wnd ? `WIND ${Math.round(wnd.speed * 1.3)} km/h` : '';
    el.cam.textContent = `CAM ${camTilts[mode]}°`;
    el.mode.textContent = `${MODES[mode].name} MODE`;

    const tp = world.targetPos;
    const dist = drone.pos.distanceTo(tp);
    el.dist.textContent = `TARGET ${Math.round(dist)} m`;
    vF.set(0, 0, -1).applyQuaternion(drone.q);
    const hd = Math.atan2(-vF.x, -vF.z);
    const dx = tp.x - drone.pos.x, dz = tp.z - drone.pos.z;
    const fx = -Math.sin(hd), fz = -Math.cos(hd), rx = Math.cos(hd), rz = -Math.sin(hd);
    el.comp.style.transform = `rotate(${Math.atan2(dx * rx + dz * rz, dx * fx + dz * fz)}rad)`;

    camera.updateMatrixWorld(true);
    projV.copy(tp).project(camera);
    let behind = false;
    if (projV.z > 1) { projV.x = -projV.x; projV.y = -projV.y; behind = true; }
    const onScreen = !behind && Math.abs(projV.x) < 0.92 && Math.abs(projV.y) < 0.9;
    el.marker.style.display = onScreen ? 'block' : 'none';
    el.edge.style.display = onScreen ? 'none' : 'block';
    if (onScreen) {
      el.marker.style.left = (projV.x * 0.5 + 0.5) * W + 'px';
      el.marker.style.top = (-projV.y * 0.5 + 0.5) * H + 'px';
      el.mDist.textContent = Math.round(dist) + ' m';
    } else {
      const s = Math.max(Math.abs(projV.x) / 0.9, Math.abs(projV.y) / 0.82, 1e-3);
      const ex = projV.x / s, ey = projV.y / s;
      el.edge.style.left = ((ex * 0.5 + 0.5) * W - 15) + 'px';
      el.edge.style.top = ((-ey * 0.5 + 0.5) * H - 15) + 'px';
      el.edge.style.transform = `rotate(${Math.atan2(-ey, ex)}rad)`;
    }

    // artificial horizon from the camera orientation
    vR.set(1, 0, 0).applyQuaternion(camera.quaternion);
    vU.set(0, 1, 0).applyQuaternion(camera.quaternion);
    vF.set(0, 0, -1).applyQuaternion(camera.quaternion);
    const roll = Math.atan2(vR.y, vU.y);
    const pitch = Math.asin(Math.max(-1, Math.min(1, vF.y)));
    const ppr = H / (camera.fov * Math.PI / 180);
    el.horiz.style.transform = `rotate(${roll}rad) translateY(${pitch * ppr}px)`;

    let w = '';
    if (warnT > 0) w = warnMsg;
    if (!w && world.lockWarning && state === 'flying') {
      w = '◉ RADAR LOCK — FLY LOWER';
      if (time - lastBeep > 0.22) { Sfx.beep(1250, 0.08, 0.09, 'square'); lastBeep = time; }
    }
    const near = world.nearestHazard(drone.pos);
    if (!w && near < 1.5 && state === 'flying') {
      w = '⚠ PROXIMITY';
      if (time - lastBeep > Math.max(0.08, near * 0.12)) { Sfx.warn(); lastBeep = time; }
    }
    if (!w && tl < 10 && state === 'flying') {
      w = 'LOW BATTERY';
      if (time - lastWarn > 1) { Sfx.warn(); lastWarn = time; }
    }
    el.warn.textContent = w;
  }

  function drawStatic(opacity) {
    $('static').style.opacity = opacity;
    if (opacity <= 0.01) return;
    const d = sImg.data;
    for (let i = 0; i < d.length; i += 4) { const v = Math.random() * 255; d[i] = d[i + 1] = d[i + 2] = v; d[i + 3] = 255; }
    sctx.putImageData(sImg, 0, 0);
  }

  function setToast(msg) { toast = msg; toastT = 1.8; }

  // ---------- main loop ----------
  let last = performance.now();
  function frame(now) {
    requestAnimationFrame(frame);
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    time += dt; stateT += dt;
    const inp = Input.poll(dt);
    handleMenuInput();
    if (warnT > 0) warnT -= dt;
    if (toastT > 0) toastT -= dt;
    el.toast.style.opacity = toastT > 0 ? Math.min(1, toastT * 2) : 0;
    el.toast.innerHTML = toast;

    if (state === 'title') {
      if (previewDirty) {
        previewDirty = false;
        loadWorld(selLevel);
        $('selLevel').textContent = selLevel;
        $('levelInfo').innerHTML = levelInfoText(selLevel) + (best[selLevel] ? `<br><small>BEST ${best[selLevel].toFixed(1)} s</small>` : '');
      }
      const locked = selLevel > unlocked;
      $('startPrompt').innerHTML = locked ? '🔒 LEVEL LOCKED' : `${K.ok()}  START / <bdi>ابدأ</bdi>`;
      $('modeSel').innerHTML = `${K.mode()} FLIGHT MODE: <b>${MODES[mode].name}</b> · <bdi>${MODES[mode].ar}</bdi>`;
      $('padStatus').textContent = inp.pad
        ? `🎮 Controller connected: ${inp.padName || 'Gamepad'}`
        : '🎮 Connect a PlayStation controller (USB / Bluetooth) and press any button — or use the keyboard';
      world.update(dt, null, null);
      world.preview(camera, time);
      if (camera.fov !== 62) { camera.fov = 62; camera.updateProjectionMatrix(); FX.setScale(innerHeight * renderer.getPixelRatio(), 62); }
    } else {
      if (state === 'ready') {
        world.update(dt, drone.pos, drone.vel);
        const step = Math.floor(stateT);
        if (step !== countStep) {
          countStep = step;
          const info = `LEVEL ${level} — ${world.name[0]} · <bdi>${world.name[1]}</bdi><br>${world.labels.join(' · ')}<br>TIME ${world.timeLimit} s · ${MODES[mode].name} MODE`;
          if (step < 3) { $('count').innerHTML = `${3 - step}<small>${info}</small>`; Sfx.tick(false); }
          else { $('count').innerHTML = 'GO!'; Sfx.tick(true); }
        }
        drone.pos.y = world.startPos.y + Math.sin(time * 3) * 0.04;
        Sfx.engine(true, 0.3 + stateT * 0.1, 0);
        if (stateT >= 3.6) { state = 'flying'; stateT = 0; show('count', false); }
      } else if (state === 'flying') {
        world.update(dt, drone.pos, drone.vel);
        elapsed += dt; tLeft -= dt;
        physics(dt, inp);
        if (state === 'flying' && tLeft <= 0) crash('battery');
        if (state === 'flying') {
          const spd01 = Math.min(1, drone.vel.length() / 30);
          Sfx.engine(true, Math.min(1, thrustNow / (G * 2.6)), spd01);
        }
      } else if (state === 'crashed' || state === 'won') {
        world.update(dt, null, null);
        $('flash').style.opacity = Math.max(0, 1 - stateT * 2.8);
        const st = stateT < 0.12 ? 0 : stateT < 0.55 ? 0.95 : Math.max(0, 0.95 - (stateT - 0.55) * 3);
        drawStatic(st);
        const panel = state === 'crashed' ? 'crash' : 'win';
        if (stateT > 1.7 && $(panel).classList.contains('hidden')) setPanels(panel);
        if (state === 'crashed') $('crashPrompt').innerHTML = `${K.ok()} RETRY / <bdi>إعادة</bdi>   ·   ${K.back()} MENU`;
        else $('winPrompt').innerHTML = `${K.ok()} NEXT LEVEL / <bdi>المرحلة التالية</bdi>   ·   ${K.redo()} REPLAY   ·   ${K.back()} MENU`;
      }

      if (state === 'ready' || state === 'flying' || state === 'paused') placeFpvCamera();
      else if (crashCam) {
        if (stateT < 0.55) placeFpvCamera();
        else {
          camera.position.copy(crashCam.pos); camera.lookAt(crashCam.look);
          if (camera.fov !== 70) { camera.fov = 70; camera.updateProjectionMatrix(); }
        }
      }
      if (state === 'ready' || state === 'flying') updateHud();
    }

    if (shake > 0) shake = Math.max(0, shake - dt * 1.4);
    FX.update(dt);
    renderer.render(scene, camera);
  }

  function cycleMode() {
    const was = MODES[mode].name;
    mode = (mode + 1) % MODES.length;
    store.set('ds2_mode', mode);
    if (was === 'ACRO' && world) {
      vF.set(0, 0, -1).applyQuaternion(drone.q);
      drone.heading = Math.atan2(-vF.x, -vF.z);
    }
    Sfx.ui();
    setToast(`${MODES[mode].name} MODE · <bdi>${MODES[mode].ar}</bdi>`);
  }

  // ---------- menu / meta input ----------
  function handleMenuInput() {
    const wasConfirm = Input.was('confirm'), wasBack = Input.was('back'), wasRestart = Input.was('restart');
    const wasPause = Input.was('pause');
    Input.was('backOrPause');
    const wasLeft = Input.was('left'), wasRight = Input.was('right');
    const wasCamD = Input.was('camDown'), wasCamU = Input.was('camUp'), wasMode = Input.was('mode');
    if (wasConfirm || wasBack || wasRestart || wasPause || Input.state.device === 'pad') Sfx.init();
    if (wasCamD || wasCamU) {
      camTilts[mode] = Math.max(0, Math.min(50, camTilts[mode] + (wasCamU ? 5 : -5)));
      store.set('ds2_cam', camTilts);
      setToast(`CAMERA TILT ${camTilts[mode]}°`);
    }
    if (wasMode && state !== 'crashed' && state !== 'won') cycleMode();

    if (state === 'title') {
      if (wasLeft && selLevel > 1) { selLevel--; previewDirty = true; Sfx.ui(); }
      if (wasRight && selLevel < unlocked) { selLevel++; previewDirty = true; Sfx.ui(); }
      else if (wasRight) Sfx.beep(200, 0.1, 0.1, 'square');
      if (wasConfirm && selLevel <= unlocked) { Sfx.ui(); startLevel(selLevel); }
    } else if (state === 'ready') {
      if (wasBack) toTitle();
    } else if (state === 'flying') {
      if (wasPause) { state = 'paused'; setPanels('pause'); show('hud', true); Sfx.engine(false, 0, 0); }
    } else if (state === 'paused') {
      $('pausePrompt').innerHTML = `${K.ok()} RESUME   ·   ${K.redo()} RESTART   ·   ${K.back()} MENU   ·   ${K.mode()} MODE`;
      if (wasConfirm || wasPause) { state = 'flying'; setPanels(null); }
      else if (wasRestart) startLevel(level);
      else if (wasBack) toTitle();
    } else if (state === 'crashed') {
      if (stateT > 0.9) {
        if (wasConfirm || wasRestart) startLevel(level);
        else if (wasBack) toTitle();
      }
    } else if (state === 'won') {
      if (stateT > 0.9) {
        if (wasConfirm) startLevel(level + 1);
        else if (wasRestart) startLevel(level);
        else if (wasBack) { level = level + 1; toTitle(); }
      }
    }
  }

  ['startPrompt', 'crashPrompt', 'winPrompt', 'pausePrompt'].forEach((id) =>
    $(id).addEventListener('click', () => { Sfx.init(); Input.state.device = 'keyboard'; synth('Enter'); }));
  $('lvlL').addEventListener('click', () => synth('ArrowLeft'));
  $('lvlR').addEventListener('click', () => synth('ArrowRight'));
  $('modeSel').addEventListener('click', () => synth('KeyM'));
  function synth(code) {
    dispatchEvent(new KeyboardEvent('keydown', { code }));
    dispatchEvent(new KeyboardEvent('keyup', { code }));
  }
  addEventListener('pointerdown', () => Sfx.init());
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && state === 'flying') { state = 'paused'; setPanels('pause'); show('hud', true); Sfx.engine(false, 0, 0); }
  });

  // ---------- boot ----------
  resize();
  setPanels('title');
  requestAnimationFrame(frame);

  // exposed for automated testing
  window.__ds = {
    get state() { return state; },
    get world() { return world; },
    get mode() { return MODES[mode].name; },
    drone, startLevel, crash, win,
    unlock(n) { unlocked = Math.max(unlocked, n); },
    setLevel(n) { selLevel = n; previewDirty = true; },
  };
})();
