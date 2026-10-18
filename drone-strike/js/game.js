// DRONE STRIKE — game loop, FPV flight model, HUD, menus.
(() => {
  const $ = (id) => document.getElementById(id);
  const T = THREE;

  const canvas = $('c');
  const renderer = new T.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  const scene = new T.Scene();
  const camera = new T.PerspectiveCamera(100, 1, 0.1, 2500);
  camera.rotation.order = 'YXZ';
  scene.add(camera);
  const headlight = new T.SpotLight(0xffffff, 0, 110, 0.6, 0.6, 1);
  camera.add(headlight, headlight.target);
  headlight.target.position.set(0, 0, -1);
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
  let unlocked = store.get('ds_unlocked', 1);
  const best = store.get('ds_best', {});

  // ---------- state ----------
  let state = 'title';
  let level = Math.min(unlocked, store.get('ds_last', 1));
  let selLevel = level;
  let world = null;
  let stateT = 0;
  let time = 0;
  let tLeft = 0, elapsed = 0;
  let camTilt = 25;
  let shake = 0;
  let crashCam = null;
  let lastWarn = 0, lastBeep = 0;
  let warnMsg = '', warnT = 0;
  let countStep = -1;
  let preview = { dirty: true, t: 0 };

  const drone = { pos: new T.Vector3(), vel: new T.Vector3(), yaw: 0, pitch: 0, roll: 0 };
  const tmpV = new T.Vector3();

  const REASON = {
    ground: ['You hit the ground', 'اصطدمت بالأرض'],
    building: ['You hit a building', 'اصطدمت بمبنى'],
    antenna: ['You hit an antenna', 'اصطدمت بهوائي'],
    cable: ['You hit a cable', 'اصطدمت بكابل'],
    'lamp post': ['You hit a lamp post', 'اصطدمت بعمود إنارة'],
    'patrol drone': ['You hit a patrol drone', 'اصطدمت بدرون دورية'],
    'spinning blade': ['You hit a spinning blade', 'اصطدمت بشفرة دوّارة'],
    'blade pylon': ['You hit a blade pylon', 'اصطدمت بعمود الشفرات'],
    battery: ['Battery depleted — out of time', 'نفدت البطارية — انتهى الوقت'],
  };

  const isPad = () => Input.state.device === 'pad';
  const K = {
    ok: () => (isPad() ? '✕' : 'ENTER'),
    redo: () => (isPad() ? '□' : 'R'),
    back: () => (isPad() ? '○' : 'BACKSPACE'),
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
    headlight.intensity = world.theme.light ? 2.2 : 0;
  }

  function levelInfoText(L) {
    const p = World.params(L);
    const hz = World.hazardsList(p);
    return hz.length ? hz.join(' · ') : 'CLEAR SKIES · LEARN THE CONTROLS';
  }

  function toTitle() {
    state = 'title';
    selLevel = Math.min(level, unlocked);
    preview.dirty = true;
    setPanels('title');
    Sfx.engine(false, 0, 0);
  }

  function startLevel(L) {
    level = L;
    store.set('ds_last', L);
    loadWorld(L);
    drone.pos.copy(world.startPos);
    drone.vel.set(0, 0, 0);
    drone.yaw = world.startYaw;
    drone.pitch = drone.roll = 0;
    tLeft = world.timeLimit;
    elapsed = 0;
    shake = 0;
    crashCam = null;
    state = 'ready';
    stateT = 0;
    countStep = -1;
    setPanels(null);
    show('hud', true);
    show('count', true);
    $('hLevel').textContent = L;
    $('flash').style.opacity = 0;
    $('static').style.opacity = 0;
    Input.clearEdges();
  }

  function crash(kind) {
    if (state !== 'flying') return;
    state = 'crashed';
    stateT = 0;
    const r = REASON[kind] || ['You crashed', 'تحطمت'];
    $('crashReason').innerHTML = `${r[0]}<br><span class="ar" dir="rtl">${r[1]}</span>`;
    FX.explode(drone.pos, 1.15);
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
    state = 'won';
    stateT = 0;
    FX.explode(world.targetPos, 1.6, 'target');
    FX.explode(world.targetPos, 0.9);
    Sfx.explosion(true);
    Sfx.engine(false, 0, 0);
    Input.rumble(900, 0.8, 1);
    shake = 1.2;
    $('flash').style.opacity = 1;
    show('hud', false);
    makeCrashCam(world.targetPos, drone.vel);
    world.target.visible = false;
    const stars = tLeft / world.timeLimit > 0.5 ? 3 : tLeft / world.timeLimit > 0.25 ? 2 : 1;
    const t = elapsed;
    const prev = best[level];
    if (!prev || t < prev) { best[level] = +t.toFixed(2); store.set('ds_best', best); }
    if (level + 1 > unlocked) { unlocked = level + 1; store.set('ds_unlocked', unlocked); }
    $('winStats').innerHTML = `LEVEL ${level} COMPLETE<br>Time ${t.toFixed(1)} s${best[level] && best[level] < t ? ` · Best ${best[level].toFixed(1)} s` : prev === undefined || t < prev ? ' · NEW BEST!' : ''}`;
    $('stars').textContent = '★'.repeat(stars) + '☆'.repeat(3 - stars);
  }

  function makeCrashCam(at, vel) {
    // external camera watching the explosion; back off along the incoming path if it's free
    const dir = tmpV.copy(vel);
    if (dir.lengthSq() < 0.5) dir.set(-Math.sin(drone.yaw), 0, -Math.cos(drone.yaw));
    dir.y = 0; dir.normalize();
    let cam = at.clone();
    for (const d of [16, 11, 7, 4]) {
      const c = new T.Vector3(at.x - dir.x * d, Math.max(2, at.y + d * 0.3), at.z - dir.z * d);
      if (!world.collide(c, 0.8) && c.x > world.bounds.lo && c.x < world.bounds.hi && c.z > world.bounds.lo && c.z < world.bounds.hi) { cam = c; break; }
    }
    crashCam = { pos: cam, look: at.clone() };
  }

  // ---------- flight model ----------
  const MAX_TILT = 0.62;
  const R_DRONE = 0.7;
  function stepDrone(dt, inp) {
    const d = drone, prm = world.params;
    d.pitch += (inp.pitch * MAX_TILT - d.pitch) * Math.min(1, dt * 7);
    d.roll += (inp.roll * MAX_TILT - d.roll) * Math.min(1, dt * 7);
    d.yaw -= inp.yaw * 2.3 * dt;
    const sy = Math.sin(d.yaw), cy = Math.cos(d.yaw);
    const fx = -sy, fz = -cy, rx = cy, rz = -sy;
    const boost = inp.boost;
    const A = 15 * (1 + 0.75 * boost);
    const pn = d.pitch / MAX_TILT, rn = d.roll / MAX_TILT;
    let ax = fx * pn * A + rx * rn * A;
    let az = fz * pn * A + rz * rn * A;
    const drag = 0.9 + 2.6 * inp.brake;
    ax -= d.vel.x * drag; az -= d.vel.z * drag;
    if (prm.wind) {
      const ang = prm.L * 2.1;
      const g = prm.wind * 0.8 * (0.65 + 0.35 * Math.sin(time * 0.9) + 0.15 * Math.sin(time * 2.3 + 1));
      ax += Math.cos(ang) * g; az += Math.sin(ang) * g;
    }
    const vyT = inp.throttle * 8 * (1 + 0.3 * boost);
    const ay = (vyT - d.vel.y) * 3.5;
    d.vel.x += ax * dt; d.vel.y += ay * dt; d.vel.z += az * dt;
    d.pos.addScaledVector(d.vel, dt);
  }

  function physics(dt, inp) {
    const STEP = 1 / 120;
    let acc = dt;
    while (acc > 0 && state === 'flying') {
      const h = Math.min(STEP, acc); acc -= h;
      stepDrone(h, inp);
      const p = drone.pos, b = world.bounds;
      if (p.y > world.ceiling) { p.y = world.ceiling; if (drone.vel.y > 0) drone.vel.y = 0; flag('ALTITUDE LIMIT'); }
      if (p.x < b.lo) { p.x = b.lo; drone.vel.x = Math.max(0, drone.vel.x); flag('OUT OF RANGE'); }
      if (p.x > b.hi) { p.x = b.hi; drone.vel.x = Math.min(0, drone.vel.x); flag('OUT OF RANGE'); }
      if (p.z < b.lo) { p.z = b.lo; drone.vel.z = Math.max(0, drone.vel.z); flag('OUT OF RANGE'); }
      if (p.z > b.hi) { p.z = b.hi; drone.vel.z = Math.min(0, drone.vel.z); flag('OUT OF RANGE'); }
      if (p.distanceTo(world.targetPos) < world.targetR + 0.25) { win(); return; }
      const k = world.collide(p, R_DRONE);
      if (k) { crash(k); return; }
    }
  }
  function flag(msg) { warnMsg = msg; warnT = 0.4; }

  // ---------- camera ----------
  function placeFpvCamera(dt) {
    camera.position.copy(drone.pos);
    const bob = Math.sin(time * 40) * 0.0035 * (0.4 + drone.vel.length() / 15);
    camera.rotation.set(
      T.MathUtils.degToRad(camTilt) - drone.pitch + bob,
      drone.yaw,
      -drone.roll * 0.9,
      'YXZ'
    );
    const spd = Math.hypot(drone.vel.x, drone.vel.z);
    const fov = 98 + Math.min(22, spd * 0.9);
    if (Math.abs(camera.fov - fov) > 0.05) { camera.fov = fov; camera.updateProjectionMatrix(); FX.setScale(innerHeight * renderer.getPixelRatio(), fov); }
    if (shake > 0) {
      const s = shake * 0.35;
      camera.position.x += (Math.random() - 0.5) * s;
      camera.position.y += (Math.random() - 0.5) * s;
      camera.position.z += (Math.random() - 0.5) * s;
      camera.rotation.z += (Math.random() - 0.5) * shake * 0.05;
    }
  }

  function placeOrbitCamera() {
    const P = world.params, c = ((P.N - 1) / 2) * P.P;
    const a = time * 0.12, r = P.N * P.P * 0.55 + 60;
    camera.position.set(c + Math.cos(a) * r, 58 + 12 * Math.sin(time * 0.3), c + Math.sin(a) * r);
    camera.lookAt(c, 14, c);
    if (camera.fov !== 62) { camera.fov = 62; camera.updateProjectionMatrix(); FX.setScale(innerHeight * renderer.getPixelRatio(), 62); }
  }

  // ---------- HUD ----------
  const el = {
    time: $('hTime'), fill: $('battFill'), speed: $('hSpeed'), alt: $('hAlt'), wind: $('hWind'),
    dist: $('hDist'), warn: $('hWarn'), comp: $('compassArrow'), marker: $('marker'), mDist: $('markerDist'),
    edge: $('edgeArrow'), horiz: $('horizon'), cam: $('cam'),
  };
  const projV = new T.Vector3();
  function updateHud() {
    const W = innerWidth, H = innerHeight;
    const tl = Math.max(0, tLeft);
    el.time.textContent = tl.toFixed(1);
    const frac = Math.max(0, tl / world.timeLimit);
    el.fill.style.width = frac * 100 + '%';
    const low = tl < 10;
    $('hud').style.color = low ? '#ffb347' : '#7dff9a';
    el.time.classList.toggle('warnflash', low && state === 'flying');
    const spd = drone.vel.length();
    el.speed.innerHTML = `${Math.round(spd * 3.6)} <small>km/h</small>`;
    el.alt.innerHTML = `${drone.pos.y.toFixed(0)} <small>m / ${world.ceiling}</small>`;
    el.wind.textContent = world.params.wind ? `WIND ${(world.params.wind * 0.8 / 0.9).toFixed(0)} m/s` : '';
    el.cam.textContent = `CAM ${camTilt}°`;

    const tp = world.targetPos;
    const dist = drone.pos.distanceTo(tp);
    const signal = dist < world.params.markerRange;
    el.dist.textContent = signal ? `TARGET ${Math.round(dist)} m` : 'SIGNAL WEAK — FIND THE TARGET';
    const dx = tp.x - drone.pos.x, dz = tp.z - drone.pos.z;
    const fx = -Math.sin(drone.yaw), fz = -Math.cos(drone.yaw), rx = Math.cos(drone.yaw), rz = -Math.sin(drone.yaw);
    el.comp.style.transform = `rotate(${Math.atan2(dx * rx + dz * rz, dx * fx + dz * fz)}rad)`;

    // target marker
    camera.updateMatrixWorld(true);
    projV.copy(tp).project(camera);
    let behind = false;
    if (projV.z > 1) { projV.x = -projV.x; projV.y = -projV.y; behind = true; }
    const onScreen = !behind && Math.abs(projV.x) < 0.92 && Math.abs(projV.y) < 0.9;
    el.marker.style.display = signal && onScreen ? 'block' : 'none';
    el.edge.style.display = signal && !onScreen ? 'block' : 'none';
    if (signal && onScreen) {
      el.marker.style.left = (projV.x * 0.5 + 0.5) * W + 'px';
      el.marker.style.top = (-projV.y * 0.5 + 0.5) * H + 'px';
      el.mDist.textContent = Math.round(dist) + ' m';
    } else if (signal) {
      const s = Math.max(Math.abs(projV.x) / 0.9, Math.abs(projV.y) / 0.82, 1);
      const ex = projV.x / s, ey = projV.y / s;
      el.edge.style.left = ((ex * 0.5 + 0.5) * W - 15) + 'px';
      el.edge.style.top = ((-ey * 0.5 + 0.5) * H - 15) + 'px';
      el.edge.style.transform = `rotate(${Math.atan2(-ey, ex)}rad)`;
    }

    // artificial horizon
    const ppr = H / (camera.fov * Math.PI / 180);
    el.horiz.style.transform = `rotate(${camera.rotation.z}rad) translateY(${camera.rotation.x * ppr}px)`;

    // warnings
    let w = '';
    if (warnT > 0) w = warnMsg;
    const near = world.nearestHazard(drone.pos);
    if (!w && near < 3.2 && state === 'flying') {
      w = '⚠ PROXIMITY';
      if (time - lastBeep > Math.max(0.09, near * 0.09)) { Sfx.warn(); lastBeep = time; }
    }
    if (!w && tl < 10 && state === 'flying') {
      w = 'LOW BATTERY';
      if (time - lastWarn > 1) { Sfx.warn(); lastWarn = time; }
    }
    el.warn.textContent = w;
  }

  // ---------- static / feed-lost ----------
  function drawStatic(opacity) {
    $('static').style.opacity = opacity;
    if (opacity <= 0.01) return;
    const d = sImg.data;
    for (let i = 0; i < d.length; i += 4) {
      const v = Math.random() * 255;
      d[i] = d[i + 1] = d[i + 2] = v; d[i + 3] = 255;
    }
    sctx.putImageData(sImg, 0, 0);
  }

  // ---------- main loop ----------
  let last = performance.now();
  function frame(now) {
    requestAnimationFrame(frame);
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    time += dt;
    stateT += dt;
    const inp = Input.poll(dt);
    handleMenuInput(inp);
    if (warnT > 0) warnT -= dt;

    if (state === 'title') {
      if (preview.dirty) {
        preview.dirty = false;
        loadWorld(selLevel);
        $('selLevel').textContent = selLevel;
        $('levelInfo').textContent = levelInfoText(selLevel) + (best[selLevel] ? `   ·   BEST ${best[selLevel].toFixed(1)} s` : '');
      }
      const locked = selLevel > unlocked;
      $('startPrompt').innerHTML = locked ? '🔒 LEVEL LOCKED' : `${K.ok()}  START / <bdi>ابدأ</bdi>`;
      $('padStatus').textContent = inp.pad
        ? `🎮 Controller connected: ${inp.padName || 'Gamepad'}`
        : '🎮 Connect a PlayStation controller (USB / Bluetooth) and press any button — or use the keyboard';
      world.update(dt);
      placeOrbitCamera();
    } else {
      if (state === 'ready') {
        world.update(dt);
        const step = Math.floor(stateT);
        if (step !== countStep) {
          countStep = step;
          const hz = world.hazards.length ? world.hazards.join(' · ') : 'CLEAR SKIES';
          if (step < 3) { $('count').innerHTML = `${3 - step}<small>LEVEL ${level} — ${hz}<br>TIME LIMIT ${world.timeLimit} s</small>`; Sfx.tick(false); }
          else { $('count').innerHTML = 'GO!'; Sfx.tick(true); }
        }
        drone.pos.y = world.startPos.y + Math.sin(time * 3) * 0.05;
        Sfx.engine(true, 0.3 + stateT * 0.15, 0);
        if (stateT >= 3.7) { state = 'flying'; stateT = 0; show('count', false); }
      } else if (state === 'flying') {
        world.update(dt);
        elapsed += dt; tLeft -= dt;
        physics(dt, inp);
        if (state === 'flying' && tLeft <= 0) crash('battery');
        if (state === 'flying') {
          const spd01 = Math.min(1, drone.vel.length() / 22);
          Sfx.engine(true, Math.min(1, 0.25 + 0.4 * Math.abs(inp.throttle) + 0.35 * inp.boost + 0.3 * spd01), spd01);
        }
      } else if (state === 'paused') {
        // frozen
      } else if (state === 'crashed' || state === 'won') {
        world.update(dt);
        const flashV = Math.max(0, 1 - stateT * 2.8);
        $('flash').style.opacity = flashV;
        // FPV feed dies (static), then cut to the external replay camera
        const st = stateT < 0.12 ? 0 : stateT < 0.55 ? 0.95 : Math.max(0, 0.95 - (stateT - 0.55) * 3);
        drawStatic(st);
        if (stateT > 1.7 && $(state === 'crashed' ? 'crash' : 'win').classList.contains('hidden')) {
          setPanels(state === 'crashed' ? 'crash' : 'win');
        }
        if (state === 'crashed') $('crashPrompt').innerHTML = `${K.ok()} RETRY / <bdi>إعادة</bdi>   ·   ${K.back()} MENU`;
        else $('winPrompt').innerHTML = `${K.ok()} NEXT LEVEL / <bdi>المرحلة التالية</bdi>   ·   ${K.redo()} REPLAY   ·   ${K.back()} MENU`;
      }

      if (state === 'ready' || state === 'flying' || state === 'paused') placeFpvCamera(dt);
      else if (crashCam) {
        if (stateT < 0.55) placeFpvCamera(dt);
        else { camera.position.copy(crashCam.pos); camera.lookAt(crashCam.look); camera.fov = 70; camera.updateProjectionMatrix(); }
      }
      if (state === 'ready' || state === 'flying') updateHud();
    }

    if (shake > 0) shake = Math.max(0, shake - dt * 1.4);
    FX.update(dt);
    renderer.render(scene, camera);
  }

  // ---------- menu / meta input ----------
  function handleMenuInput() {
    const wasConfirm = Input.was('confirm'), wasBack = Input.was('back'), wasRestart = Input.was('restart');
    const wasPause = Input.was('pause');
    Input.was('backOrPause');
    const wasLeft = Input.was('left'), wasRight = Input.was('right');
    const wasCamD = Input.was('camDown'), wasCamU = Input.was('camUp');
    if (wasConfirm || wasBack || wasRestart || wasPause || Input.state.device === 'pad') Sfx.init();
    if (wasCamD) camTilt = Math.max(0, camTilt - 5);
    if (wasCamU) camTilt = Math.min(50, camTilt + 5);

    if (state === 'title') {
      if (wasLeft && selLevel > 1) { selLevel--; preview.dirty = true; Sfx.ui(); }
      if (wasRight && selLevel < unlocked) { selLevel++; preview.dirty = true; Sfx.ui(); }
      else if (wasRight && selLevel >= unlocked) Sfx.beep(200, 0.1, 0.1, 'square');
      if (wasConfirm && selLevel <= unlocked) { Sfx.ui(); startLevel(selLevel); }
    } else if (state === 'ready') {
      if (wasBack) toTitle();
    } else if (state === 'flying') {
      if (wasPause) { state = 'paused'; setPanels('pause'); show('hud', true); Sfx.engine(false, 0, 0); }
    } else if (state === 'paused') {
      $('pausePrompt').textContent = `${K.ok()} RESUME   ·   ${K.redo()} RESTART   ·   ${K.back()} MENU`;
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

  // clicks on prompts behave like "confirm"
  ['startPrompt', 'crashPrompt', 'winPrompt', 'pausePrompt'].forEach((id) =>
    $(id).addEventListener('click', () => { Sfx.init(); Input.state.device = 'keyboard'; synth('confirm'); }));
  $('lvlL').addEventListener('click', () => synth('left'));
  $('lvlR').addEventListener('click', () => synth('right'));
  function synth(name) {
    // push a synthetic edge through the same path as real input
    const ev = new KeyboardEvent('keydown', { code: name === 'confirm' ? 'Enter' : name === 'left' ? 'ArrowLeft' : 'ArrowRight' });
    dispatchEvent(ev);
    dispatchEvent(new KeyboardEvent('keyup', { code: ev.code }));
  }
  addEventListener('pointerdown', () => Sfx.init());
  document.addEventListener('visibilitychange', () => { if (document.hidden && state === 'flying') { state = 'paused'; setPanels('pause'); show('hud', true); Sfx.engine(false, 0, 0); } });

  // ---------- boot ----------
  resize();
  setPanels('title');
  $('lvlL').textContent = '◀'; $('lvlR').textContent = '▶';
  requestAnimationFrame(frame);

  // exposed for automated testing
  window.__ds = {
    get state() { return state; },
    get world() { return world; },
    drone, startLevel, crash, win,
    unlock(n) { unlocked = Math.max(unlocked, n); },
    setLevel(n) { selLevel = n; preview.dirty = true; },
  };
})();
