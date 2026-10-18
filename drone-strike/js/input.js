// Input: PlayStation controller (Gamepad API "standard" mapping) + keyboard fallback.
const Input = (() => {
  const keys = new Set();
  const edges = new Set();
  const kbAxis = { throttle: 0, yaw: 0, pitch: 0, roll: 0 };
  let prevBtn = [];
  let lastDevice = 'keyboard';
  let padName = '';

  addEventListener('keydown', (e) => {
    if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab'].includes(e.code)) e.preventDefault();
    if (!keys.has(e.code)) {
      edges.add('key:' + e.code);
      if (e.code === 'Enter' || e.code === 'Space') edges.add('confirm');
      if (e.code === 'KeyR') edges.add('restart');
      if (e.code === 'Backspace') edges.add('back');
      if (e.code === 'Escape' || e.code === 'KeyP') { edges.add('pause'); edges.add('backOrPause'); }
      if (e.code === 'ArrowLeft' || e.code === 'KeyA') edges.add('left');
      if (e.code === 'ArrowRight' || e.code === 'KeyD') edges.add('right');
      if (e.code === 'BracketLeft') edges.add('camDown');
      if (e.code === 'BracketRight') edges.add('camUp');
    }
    keys.add(e.code);
    lastDevice = 'keyboard';
  });
  addEventListener('keyup', (e) => keys.delete(e.code));
  addEventListener('blur', () => keys.clear());

  function dz(v) {
    const d = 0.14;
    const a = Math.abs(v);
    if (a < d) return 0;
    const n = (a - d) / (1 - d);
    // gentle expo curve for fine control near the centre
    return Math.sign(v) * (0.55 * n + 0.45 * n * n * n);
  }
  function ramp(cur, target, dt) {
    const rate = target === 0 ? 9 : 5;
    if (cur < target) return Math.min(target, cur + rate * dt);
    return Math.max(target, cur - rate * dt);
  }
  const k = (c) => (keys.has(c) ? 1 : 0);

  function getPad() {
    const list = navigator.getGamepads ? navigator.getGamepads() : [];
    let best = null;
    for (const p of list) {
      if (!p || !p.connected) continue;
      if (!best || p.mapping === 'standard') best = p;
      if (p.mapping === 'standard') break;
    }
    return best;
  }

  const out = { throttle: 0, yaw: 0, pitch: 0, roll: 0, boost: 0, brake: 0, pad: null, device: 'keyboard' };

  function poll(dt) {
    // keyboard
    kbAxis.throttle = ramp(kbAxis.throttle, k('Space') + k('ArrowUp') - k('ShiftLeft') - k('ShiftRight') - k('ArrowDown') - k('KeyC'), dt);
    kbAxis.yaw = ramp(kbAxis.yaw, k('KeyE') + k('ArrowRight') - k('KeyQ') - k('ArrowLeft'), dt);
    kbAxis.pitch = ramp(kbAxis.pitch, k('KeyW') - k('KeyS'), dt);
    kbAxis.roll = ramp(kbAxis.roll, k('KeyD') - k('KeyA'), dt);
    let t = kbAxis.throttle, y = kbAxis.yaw, p = kbAxis.pitch, r = kbAxis.roll;
    let boost = k('KeyF'), brake = k('KeyV');

    const pad = getPad();
    out.pad = pad;
    padName = pad ? pad.id.replace(/\(.*?\)/g, '').trim() : '';
    if (pad) {
      const ax = pad.axes;
      const gt = dz(-(ax[1] || 0)), gy = dz(ax[0] || 0), gp = dz(-(ax[3] || 0)), gr = dz(ax[2] || 0);
      const b = pad.buttons;
      const bv = (i) => (b[i] ? b[i].value || (b[i].pressed ? 1 : 0) : 0);
      const gboost = bv(7), gbrake = bv(6);
      const active = gt || gy || gp || gr || gboost > 0.1 || gbrake > 0.1;
      if (active) lastDevice = 'pad';
      t = clampAdd(t, gt); y = clampAdd(y, gy); p = clampAdd(p, gp); r = clampAdd(r, gr);
      boost = Math.max(boost, gboost); brake = Math.max(brake, gbrake);

      // button edges
      const pressed = b.map((x) => !!(x && x.pressed));
      const was = (i) => !!prevBtn[i];
      const edge = (i) => pressed[i] && !was(i);
      if (edge(0)) edges.add('confirm');
      if (edge(1)) edges.add('back');
      if (edge(2)) edges.add('restart');
      if (edge(9)) { edges.add('pause'); }
      if (edge(8)) edges.add('back');
      if (edge(14)) edges.add('left');
      if (edge(15)) edges.add('right');
      if (edge(4)) edges.add('camDown');
      if (edge(5)) edges.add('camUp');
      if (pressed.some((v, i) => v && !was(i))) lastDevice = 'pad';
      // stick flick left/right in menus
      const sx = ax[0] || 0;
      if (Math.abs(sx) > 0.7 && !poll._flick) { poll._flick = true; edges.add(sx < 0 ? 'left' : 'right'); }
      if (Math.abs(sx) < 0.3) poll._flick = false;
      prevBtn = pressed;
    } else {
      prevBtn = [];
    }
    out.throttle = t; out.yaw = y; out.pitch = p; out.roll = r;
    out.boost = boost; out.brake = brake;
    out.device = lastDevice;
    out.padName = padName;
    return out;
  }
  function clampAdd(a, b) { return Math.max(-1, Math.min(1, a + b)); }

  function was(name) {
    if (edges.has(name)) { edges.delete(name); return true; }
    return false;
  }
  function clearEdges() { edges.clear(); }

  function rumble(ms, strong, weak) {
    const pad = out.pad;
    if (!pad) return;
    try {
      const a = pad.vibrationActuator;
      if (a && a.playEffect) a.playEffect('dual-rumble', { startDelay: 0, duration: ms, strongMagnitude: strong, weakMagnitude: weak });
    } catch (e) { /* ignore */ }
  }

  return { poll, was, clearEdges, rumble, state: out };
})();
