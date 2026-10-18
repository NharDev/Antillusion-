/* Split-screen arena shooter for two local players (three.js). First-person, hitscan weapons with recoil, spread,
   aim-down-sights and a sniper scope, headshots, reloads, respawns, kill feed, score to win, per-player HUD, synthesized
   gun sounds, gamepad + keyboard/mouse for both players (input.js).
   Sections: CONFIG · audio · world · soldiers · players · shooting · effects · HUD · loop.  Debug: window.game */
import * as THREE from "three";

export const CONFIG = {
  killsToWin: 10, respawn: 3, maxHealth: 100, regenDelay: 4, regenRate: 18,
  move: 5.0, sprint: 1.55, jump: 6.2, gravity: 19, eye: 1.62, radius: 0.36, step: 0.45,
  look: { mouse: 0.0023, stickYaw: 3.1, stickPitch: 2.1 },
  split: "vertical",   // vertical (side by side) | horizontal (top / bottom)
  loadout: ["m16", "sniper", "deagle", "pistol"],
  weapons: {
    m16:    { name: "M16",          damage: 19, head: 2.0, rpm: 720, auto: true,  mag: 30, reload: 2.1, spread: 0.022, aimSpread: 0.006, recoil: 0.013, kick: 0.05, range: 140, zoom: 1.35, color: 0x4a4e55 },
    sniper: { name: "Sniper",       damage: 92, head: 2.5, rpm: 42,  auto: false, mag: 5,  reload: 2.8, spread: 0.07,  aimSpread: 0.0006, recoil: 0.085, kick: 0.16, range: 400, zoom: 4.5, scope: true, color: 0x5a5f43 },
    deagle: { name: "Desert Eagle", damage: 46, head: 2.0, rpm: 160, auto: false, mag: 7,  reload: 1.7, spread: 0.016, aimSpread: 0.006, recoil: 0.055, kick: 0.12, range: 90,  zoom: 1.15, color: 0x8e9196 },
    pistol: { name: "Pistol",       damage: 24, head: 2.0, rpm: 330, auto: false, mag: 12, reload: 1.3, spread: 0.014, aimSpread: 0.006, recoil: 0.022, kick: 0.07, range: 70,  zoom: 1.12, color: 0x3a3c40 },
  },
  teams: [{ name: "P1", color: 0x3f6fb5, css: "#5b8de0" }, { name: "P2", color: 0xb5513f, css: "#e0775b" }],
};

/* ---------------- audio: synthesized, no files ---------------- */
let AC = null;
const audio = () => (AC || (AC = new (window.AudioContext || window.webkitAudioContext)()));
function noiseBuf(a, sec) { const b = a.createBuffer(1, a.sampleRate * sec, a.sampleRate), d = b.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; return b; }
function sfx(kind, pan = 0, vol = 1) {
  try {
    const a = audio(), t = a.currentTime, out = a.createStereoPanner(), g = a.createGain(); out.pan.value = pan; g.connect(out).connect(a.destination);
    const P = { m16: [0.22, 2600, 0.11], sniper: [0.55, 1400, 0.5], deagle: [0.4, 1800, 0.28], pistol: [0.25, 3000, 0.14] }[kind];
    if (P) {
      const n = a.createBufferSource(); n.buffer = noiseBuf(a, P[2] + 0.05); const f = a.createBiquadFilter(); f.type = "lowpass"; f.frequency.setValueAtTime(P[1], t); f.frequency.exponentialRampToValueAtTime(300, t + P[2]);
      g.gain.setValueAtTime(P[0] * vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + P[2]); n.connect(f).connect(g); n.start(t); n.stop(t + P[2] + 0.05);
      const o = a.createOscillator(), og = a.createGain(); o.frequency.setValueAtTime(kind === "sniper" ? 90 : 140, t); o.frequency.exponentialRampToValueAtTime(40, t + 0.12); og.gain.setValueAtTime(P[0] * 0.9 * vol, t); og.gain.exponentialRampToValueAtTime(0.001, t + 0.15); o.connect(og).connect(out); o.start(t); o.stop(t + 0.16);
      return;
    }
    const o = a.createOscillator(); o.type = kind === "hit" ? "square" : "triangle";
    const [f0, f1, d, v] = { hit: [1400, 1800, 0.05, 0.06], head: [2200, 2600, 0.08, 0.08], reload: [500, 300, 0.07, 0.08], empty: [900, 900, 0.03, 0.05], kill: [600, 1200, 0.25, 0.1], hurt: [220, 120, 0.18, 0.12] }[kind] || [440, 440, 0.05, 0.05];
    o.frequency.setValueAtTime(f0, t); o.frequency.linearRampToValueAtTime(f1, t + d); g.gain.setValueAtTime(v * vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + d + 0.02);
    o.connect(g); o.start(t); o.stop(t + d + 0.03);
  } catch {}
}

/* ---------------- world ---------------- */
function canvasTex(draw, size = 256, repeat = 1) {
  const c = document.createElement("canvas"); c.width = c.height = size; draw(c.getContext("2d"), size);
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat, repeat); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
}
const concrete = (base) => (g, s) => { g.fillStyle = base; g.fillRect(0, 0, s, s); for (let i = 0; i < 2600; i++) { const v = Math.random() * 40 - 20; g.fillStyle = `rgba(${v > 0 ? 255 : 0},${v > 0 ? 255 : 0},${v > 0 ? 255 : 0},${Math.abs(v) / 400})`; g.fillRect(Math.random() * s, Math.random() * s, 2, 2); } g.strokeStyle = "rgba(0,0,0,.25)"; g.lineWidth = 2; g.strokeRect(1, 1, s - 2, s - 2); };
const crateTex = (g, s) => { g.fillStyle = "#6b5233"; g.fillRect(0, 0, s, s); for (let y = 0; y < s; y += 32) { g.fillStyle = `rgba(0,0,0,${0.08 + Math.random() * 0.1})`; g.fillRect(0, y, s, 2); } g.strokeStyle = "#3f2f1c"; g.lineWidth = 14; g.strokeRect(7, 7, s - 14, s - 14); g.beginPath(); g.moveTo(10, 10); g.lineTo(s - 10, s - 10); g.stroke(); };

export function buildWorld(scene) {
  const boxes = [];   // axis-aligned colliders {min, max}
  scene.background = new THREE.Color(0x9fb3c8); scene.fog = new THREE.Fog(0x9fb3c8, 40, 120);
  const hemi = new THREE.HemisphereLight(0xdfe9f5, 0x4a4036, 1.0); scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xfff0dc, 2.4); sun.position.set(30, 50, 20); sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -45, right: 45, top: 45, bottom: -45, near: 1, far: 140 }); sun.shadow.bias = -0.0005; sun.shadow.normalBias = 0.03; scene.add(sun);
  const floorMat = new THREE.MeshStandardMaterial({ map: canvasTex(concrete("#7d7f80"), 256, 16), roughness: 0.95 });
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(70, 70), floorMat); floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; scene.add(floor);
  const wallMat = new THREE.MeshStandardMaterial({ map: canvasTex(concrete("#b9b3a7"), 256, 1), roughness: 0.9 });
  const crateMat = new THREE.MeshStandardMaterial({ map: canvasTex(crateTex, 256, 1), roughness: 0.8 });
  const metalMat = new THREE.MeshStandardMaterial({ color: 0x55606b, roughness: 0.45, metalness: 0.6 });
  const add = (x, y, z, w, h, d, mat, rep = 1) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat.clone()); m.position.set(x, y + h / 2, z); m.castShadow = m.receiveShadow = true;
    if (m.material.map) { m.material.map = m.material.map.clone(); m.material.map.repeat.set(Math.max(1, Math.round(Math.max(w, d) / 3 * rep)), Math.max(1, Math.round(h / 3 * rep))); m.material.map.needsUpdate = true; }
    scene.add(m); boxes.push({ min: new THREE.Vector3(x - w / 2, y, z - d / 2), max: new THREE.Vector3(x + w / 2, y + h, z + d / 2), mesh: m }); return m;
  };
  const S = 32;
  add(0, 0, -S, 2 * S, 5, 1, wallMat); add(0, 0, S, 2 * S, 5, 1, wallMat); add(-S, 0, 0, 1, 5, 2 * S, wallMat); add(S, 0, 0, 1, 5, 2 * S, wallMat);
  // two "buildings" with doorways and a raised walkway, crates, pillars — cover at every range
  for (const sx of [-1, 1]) {
    const cx = sx * 14;
    add(cx, 0, -6, 8, 3.4, 0.6, wallMat); add(cx - 4, 0, -2.2, 0.6, 3.4, 8, wallMat); add(cx + 4, 0, -4.2, 0.6, 3.4, 4, wallMat); add(cx + 4, 0, 1.2, 0.6, 3.4, 1.4, wallMat);
    add(cx, 3.4, -2.2, 8.6, 0.3, 8.2, metalMat);
    for (const [x, z, s] of [[cx * 0.5, 12, 1.4], [cx * 0.5 + sx * 1.4, 12, 1.4], [cx * 0.5 + sx * 0.7, 12, 1.2], [cx * 1.6, -14, 1.6], [cx * 1.6, -15.6, 1.6]]) add(x, 0, z, s, s, s, crateMat);
    add(cx * 1.6, 1.6, -14.8, 1.4, 1.4, 1.4, crateMat);
    add(sx * 24, 0, 18, 1.2, 4, 1.2, metalMat); add(sx * 24, 0, -24, 1.2, 4, 1.2, metalMat);
  }
  add(0, 0, 0, 3, 1.1, 0.8, crateMat); add(0, 0, 4, 0.8, 1.1, 3, crateMat); add(0, 0, -4, 0.8, 1.1, 3, crateMat);
  add(-6, 0, 20, 6, 1.2, 0.6, wallMat); add(6, 0, -20, 6, 1.2, 0.6, wallMat); add(0, 0, 24, 1.6, 1.6, 1.6, crateMat); add(0, 0, -24, 1.6, 1.6, 1.6, crateMat);
  const spawns = [[-26, -26], [26, 26], [-26, 26], [26, -26], [0, -28], [0, 28], [-14, 10], [14, -14]].map(([x, z]) => new THREE.Vector3(x, 0, z));
  return { boxes, spawns, sun };
}

/* ---------------- soldiers (what the other player sees) ---------------- */
function buildSoldier(color) {
  const g = new THREE.Group(), std = (c, r = 0.8, m = 0) => new THREE.MeshStandardMaterial({ color: c, roughness: r, metalness: m });
  const uniform = std(color), dark = std(0x26292e), skin = std(0xc89a78, 0.7), vest = std(0x3a3f35, 0.9), metal = std(0x1c1d20, 0.4, 0.6);
  const part = (geo, mat, x, y, z, parent = g) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = true; parent.add(m); return m; };
  const limb = (r, len) => new THREE.CapsuleGeometry(r, len, 4, 10);
  const hips = new THREE.Group(); hips.position.y = 0.95; g.add(hips);
  const legs = [-1, 1].map((s) => { const p = new THREE.Group(); p.position.set(s * 0.12, 0, 0); hips.add(p); const th = part(limb(0.095, 0.36), uniform, 0, -0.24, 0, p); const sh = new THREE.Group(); sh.position.y = -0.46; p.add(sh); part(limb(0.08, 0.36), uniform, 0, -0.22, 0, sh); part(new THREE.BoxGeometry(0.14, 0.1, 0.28), dark, 0, -0.46, 0.05, sh); return { p, sh }; });
  part(new THREE.CapsuleGeometry(0.2, 0.36, 4, 12), uniform, 0, 0.32, 0, hips).scale.set(1.05, 1, 0.75);
  part(new THREE.BoxGeometry(0.42, 0.42, 0.3), vest, 0, 0.36, 0, hips);
  part(new THREE.BoxGeometry(0.12, 0.14, 0.06), vest, -0.1, 0.24, 0.17, hips); part(new THREE.BoxGeometry(0.12, 0.14, 0.06), vest, 0.1, 0.24, 0.17, hips);
  const neck = new THREE.Group(); neck.position.y = 0.62; hips.add(neck);
  part(new THREE.SphereGeometry(0.13, 16, 12), skin, 0, 0.1, 0, neck);
  const helmet = part(new THREE.SphereGeometry(0.15, 16, 10, 0, Math.PI * 2, 0, Math.PI * 0.55), std(color, 0.6), 0, 0.13, -0.01, neck); helmet.scale.set(1.05, 0.95, 1.1);
  part(new THREE.BoxGeometry(0.2, 0.05, 0.04), dark, 0, 0.11, 0.12, neck);   // goggles
  const arms = [-1, 1].map((s) => { const p = new THREE.Group(); p.position.set(s * 0.25, 0.52, 0); hips.add(p); part(limb(0.07, 0.24), uniform, 0, -0.17, 0, p); const fo = new THREE.Group(); fo.position.y = -0.33; p.add(fo); part(limb(0.06, 0.22), uniform, 0, -0.14, 0, fo); part(new THREE.SphereGeometry(0.06, 10, 8), skin, 0, -0.3, 0, fo); return { p, fo }; });
  const gun = new THREE.Group(); part(new THREE.BoxGeometry(0.07, 0.09, 0.7), metal, 0, 0, 0.2, gun); part(new THREE.BoxGeometry(0.05, 0.14, 0.08), metal, 0, -0.1, 0.02, gun); gun.position.set(0.12, 0.38, 0.32); hips.add(gun);
  arms[0].p.rotation.x = -1.1; arms[0].p.rotation.z = 0.4; arms[0].fo.rotation.x = -0.4; arms[1].p.rotation.x = -1.3; arms[1].fo.rotation.x = -0.2;
  g.userData = { hips, legs, arms, neck, gun };
  return g;
}
function animateSoldier(m, speed, phase, pitch, dead) {
  const u = m.userData, sw = Math.min(1, speed / CONFIG.move) * 0.7;
  u.legs[0].p.rotation.x = Math.sin(phase) * sw; u.legs[1].p.rotation.x = -Math.sin(phase) * sw;
  u.legs[0].sh.rotation.x = Math.max(0, -Math.sin(phase)) * sw * 1.2; u.legs[1].sh.rotation.x = Math.max(0, Math.sin(phase)) * sw * 1.2;
  u.hips.position.y = 0.95 + Math.abs(Math.cos(phase)) * 0.04 * sw;
  u.neck.rotation.x = -pitch * 0.6; u.gun.rotation.x = -pitch * 0.8;
  m.rotation.z = dead ? Math.min(Math.PI / 2, (m.rotation.z || 0) + 0.12) : 0;
}

/* ---------------- viewmodel (your own gun) ---------------- */
function buildViewModel(key) {
  const w = CONFIG.weapons[key], g = new THREE.Group(), mat = new THREE.MeshStandardMaterial({ color: w.color, roughness: 0.45, metalness: 0.55 }), grip = new THREE.MeshStandardMaterial({ color: 0x1a1b1d, roughness: 0.8 });
  const box = (x, y, z, sx, sy, sz, m = mat) => { const b = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), m); b.position.set(x, y, z); g.add(b); return b; };
  if (key === "m16") { box(0, 0, -0.25, 0.05, 0.07, 0.55); box(0, 0.05, -0.18, 0.03, 0.04, 0.2, grip); box(0, -0.07, -0.18, 0.04, 0.11, 0.05, grip); box(0, -0.05, 0.06, 0.04, 0.09, 0.05, grip); box(0, -0.01, 0.12, 0.05, 0.08, 0.16, grip); box(0, 0.01, -0.62, 0.02, 0.02, 0.24); }
  else if (key === "sniper") { box(0, 0, -0.3, 0.05, 0.07, 0.7); box(0, 0.075, -0.25, 0.045, 0.045, 0.28, grip); box(0, -0.06, 0.08, 0.04, 0.09, 0.05, grip); box(0, -0.01, 0.16, 0.05, 0.09, 0.2, grip); box(0, 0.01, -0.82, 0.018, 0.018, 0.32); }
  else { const big = key === "deagle"; box(0, 0, -0.1, big ? 0.045 : 0.04, big ? 0.07 : 0.06, big ? 0.26 : 0.2); box(0, -0.08, 0.0, 0.04, 0.12, 0.05, grip); }
  const flash = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 6), new THREE.MeshBasicMaterial({ color: 0xffd28a, transparent: true, opacity: 0 }));
  flash.position.set(0, 0.01, key === "sniper" ? -1.0 : key === "m16" ? -0.78 : -0.26); g.add(flash);
  g.scale.setScalar(0.62);
  g.userData = { flash, rest: new THREE.Vector3(0.13, -0.13, -0.3), aim: new THREE.Vector3(0, key === "sniper" ? -0.07 : -0.052, -0.2) };
  g.traverse((o) => { if (o.material) { o.material.depthTest = true; } });
  return g;
}

/* ---------------- players ---------------- */
export class Player {
  constructor(idx, scene, input) {
    this.idx = idx; this.input = input; this.team = CONFIG.teams[idx];
    this.cam = new THREE.PerspectiveCamera(75, 1, 0.05, 300); scene.add(this.cam);
    this.cam.layers.enable(1 + idx); this.cam.layers.enable(10 + (1 - idx));
    this.model = buildSoldier(this.team.color); this.model.traverse((o) => o.layers.set(10 + idx)); scene.add(this.model);
    const vlight = new THREE.PointLight(0xffffff, 1.2, 2); vlight.position.set(0.3, 0.3, 0.2); vlight.layers.set(1 + idx); this.cam.add(vlight);
    this.views = {}; for (const k of CONFIG.loadout) { const v = buildViewModel(k); v.traverse((o) => o.layers.set(1 + idx)); v.visible = false; this.cam.add(v); this.views[k] = v; }
    this.pos = new THREE.Vector3(); this.vel = new THREE.Vector3(); this.yaw = 0; this.pitch = 0; this.kills = 0; this.deaths = 0; this.phase = 0;
    this.ammo = {}; this.recoil = 0; this.kickBack = 0; this.aim = 0; this.reloadT = 0; this.fireCD = 0; this.hurtT = 0; this.lastHit = 0; this.hitT = 0; this.headT = 0;
    this.spawn(new THREE.Vector3((idx ? 1 : -1) * 26, 0, (idx ? 1 : -1) * 26));
  }
  get weapon() { return CONFIG.loadout[this.wi]; }
  get W() { return CONFIG.weapons[this.weapon]; }
  spawn(at) {
    this.pos.copy(at); this.vel.set(0, 0, 0); this.yaw = Math.atan2(-at.x, -at.z) + Math.PI; this.pitch = 0; this.health = CONFIG.maxHealth; this.alive = true; this.respawnT = 0;
    for (const k of CONFIG.loadout) this.ammo[k] = CONFIG.weapons[k].mag;
    this.select(0); this.model.rotation.z = 0;
  }
  select(i) { this.wi = (i + CONFIG.loadout.length) % CONFIG.loadout.length; this.reloadT = 0; for (const k in this.views) this.views[k].visible = k === this.weapon; this.swapT = 0.25; }
  eye() { return new THREE.Vector3(this.pos.x, this.pos.y + CONFIG.eye, this.pos.z); }
  forward() { return new THREE.Vector3(-Math.sin(this.yaw) * Math.cos(this.pitch), Math.sin(this.pitch), -Math.cos(this.yaw) * Math.cos(this.pitch)); }
}

/* ---------------- collision (circle vs boxes on XZ, standing on top of low boxes) ---------------- */
function moveAndCollide(p, dt, boxes) {
  const R = CONFIG.radius;
  p.pos.x += p.vel.x * dt; p.pos.z += p.vel.z * dt;
  for (const b of boxes) {
    if (b.max.y <= p.pos.y + CONFIG.step || b.min.y >= p.pos.y + 1.8) continue;
    const cx = Math.max(b.min.x, Math.min(p.pos.x, b.max.x)), cz = Math.max(b.min.z, Math.min(p.pos.z, b.max.z));
    const dx = p.pos.x - cx, dz = p.pos.z - cz, d2 = dx * dx + dz * dz;
    if (d2 < R * R) {
      if (d2 > 1e-8) { const d = Math.sqrt(d2), push = R - d; p.pos.x += (dx / d) * push; p.pos.z += (dz / d) * push; }
      else { const ox = Math.min(p.pos.x - b.min.x, b.max.x - p.pos.x), oz = Math.min(p.pos.z - b.min.z, b.max.z - p.pos.z); if (ox < oz) p.pos.x += p.pos.x - b.min.x < b.max.x - p.pos.x ? -(ox + R) : ox + R; else p.pos.z += p.pos.z - b.min.z < b.max.z - p.pos.z ? -(oz + R) : oz + R; }
    }
  }
  let ground = 0;
  for (const b of boxes) {
    if (b.max.y > p.pos.y + CONFIG.step) continue;
    const cx = Math.max(b.min.x, Math.min(p.pos.x, b.max.x)), cz = Math.max(b.min.z, Math.min(p.pos.z, b.max.z));
    if ((p.pos.x - cx) ** 2 + (p.pos.z - cz) ** 2 < (R * 0.8) ** 2) ground = Math.max(ground, b.max.y);
  }
  p.vel.y -= CONFIG.gravity * dt; p.pos.y += p.vel.y * dt;
  for (const b of boxes) {   // head bump under walkways
    if (p.vel.y > 0 && p.pos.y + 1.8 > b.min.y && p.pos.y + 1.8 - p.vel.y * dt <= b.min.y + 0.01) { const cx = Math.max(b.min.x, Math.min(p.pos.x, b.max.x)), cz = Math.max(b.min.z, Math.min(p.pos.z, b.max.z)); if ((p.pos.x - cx) ** 2 + (p.pos.z - cz) ** 2 < R * R) { p.pos.y = b.min.y - 1.8; p.vel.y = 0; } }
  }
  p.grounded = p.pos.y <= ground + 0.001; if (p.grounded) { p.pos.y = ground; p.vel.y = Math.max(0, p.vel.y); }
}

/* ---------------- shooting ---------------- */
const tmpBox = new THREE.Box3(), ray = new THREE.Ray(), hitV = new THREE.Vector3();
function castWorld(origin, dir, boxes, max) {
  ray.set(origin, dir); let best = max, point = null, normal = null;
  for (const b of boxes) { tmpBox.min.copy(b.min); tmpBox.max.copy(b.max); if (ray.intersectBox(tmpBox, hitV)) { const d = hitV.distanceTo(origin); if (d < best) { best = d; point = hitV.clone(); } } }
  if (dir.y < 0) { const t = -origin.y / dir.y; if (t > 0 && t < best) { best = t; point = origin.clone().addScaledVector(dir, t); } }
  return { dist: best, point };
}
function castPlayer(origin, dir, target, max) {
  if (!target.alive) return null;
  ray.set(origin, dir);
  const head = new THREE.Sphere(new THREE.Vector3(target.pos.x, target.pos.y + 1.66, target.pos.z), 0.2);
  if (ray.intersectSphere(head, hitV)) { const d = hitV.distanceTo(origin); if (d < max) return { dist: d, point: hitV.clone(), head: true }; }
  tmpBox.min.set(target.pos.x - 0.3, target.pos.y, target.pos.z - 0.3); tmpBox.max.set(target.pos.x + 0.3, target.pos.y + 1.48, target.pos.z + 0.3);
  if (ray.intersectBox(tmpBox, hitV)) { const d = hitV.distanceTo(origin); if (d < max) return { dist: d, point: hitV.clone(), head: false }; }
  return null;
}

/* ---------------- game ---------------- */
export function createGame({ canvas, hud, inputs }) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: "high-performance" });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5)); renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.setScissorTest(true);
  const scene = new THREE.Scene(), world = buildWorld(scene);
  const players = [0, 1].map((i) => new Player(i, scene, inputs[i]));
  const fx = [], decals = [];
  const state = { over: false, winner: null, paused: false, feed: [] };

  const farthestSpawn = (enemy) => world.spawns.slice().sort((a, b) => b.distanceTo(enemy.pos) - a.distanceTo(enemy.pos))[Math.floor(Math.random() * 2)];
  function tracer(from, to) {
    const geo = new THREE.BufferGeometry().setFromPoints([from, to]), line = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: 0xffe2a8, transparent: true, opacity: 0.85 }));
    scene.add(line); fx.push({ obj: line, t: 0.07, fade: true });
  }
  function impact(p) {
    const s = new THREE.Mesh(new THREE.SphereGeometry(0.05, 6, 4), new THREE.MeshBasicMaterial({ color: 0xfff1c4, transparent: true })); s.position.copy(p); scene.add(s); fx.push({ obj: s, t: 0.12, grow: true });
    const d = new THREE.Mesh(new THREE.CircleGeometry(0.05, 8), new THREE.MeshBasicMaterial({ color: 0x111111, transparent: true, opacity: 0.7, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4 }));
    d.position.copy(p); d.lookAt(p.clone().add(new THREE.Vector3(Math.random() - 0.5, 1, Math.random() - 0.5))); scene.add(d); decals.push(d); if (decals.length > 80) scene.remove(decals.shift());
  }
  function feed(text) { state.feed.unshift({ text, t: 5 }); state.feed = state.feed.slice(0, 4); }

  function fire(p, enemy) {
    const W = p.W; if (p.reloadT > 0 || p.fireCD > 0 || p.swapT > 0) return;
    if (p.ammo[p.weapon] <= 0) { sfx("empty", p.idx ? 0.5 : -0.5, 0.6); p.reloadT = W.reload; sfx("reload", p.idx ? 0.5 : -0.5); return; }
    p.ammo[p.weapon]--; p.fireCD = 60 / W.rpm;
    const moving = Math.hypot(p.vel.x, p.vel.z) > 0.5, spread = THREE.MathUtils.lerp(W.spread, W.aimSpread, p.aim) * (moving ? 1.7 : 1) * (p.grounded ? 1 : 2.2) + p.recoil * 0.25;
    const dir = p.forward(); dir.x += (Math.random() - 0.5) * spread * 2; dir.y += (Math.random() - 0.5) * spread * 2; dir.z += (Math.random() - 0.5) * spread * 2; dir.normalize();
    const origin = p.eye(), wall = castWorld(origin, dir, world.boxes, W.range), hit = castPlayer(origin, dir, enemy, wall.dist);
    const end = hit ? hit.point : wall.point || origin.clone().addScaledVector(dir, W.range);
    const muzzle = new THREE.Vector3(); p.views[p.weapon].userData.flash.getWorldPosition(muzzle); tracer(muzzle, end);
    p.views[p.weapon].userData.flash.material.opacity = 1; p.flashT = 0.05;
    p.recoil += W.recoil; p.pitch = Math.min(1.45, p.pitch + W.recoil * (1 - p.aim * 0.4)); p.yaw += (Math.random() - 0.5) * W.recoil * 0.5; p.kickBack = W.kick;
    sfx(p.weapon, p.idx ? 0.5 : -0.5); p.input.rumble(Math.min(1, W.damage / 60), 0.4, 70 + W.damage);
    if (hit) {
      const dmg = Math.round(W.damage * (hit.head ? W.head : 1));
      enemy.health -= dmg; enemy.hurtT = 0.4; enemy.lastHit = performance.now(); enemy.input.rumble(0.7, 0.7, 160); sfx("hurt", enemy.idx ? 0.5 : -0.5, 0.7);
      p.hitT = 0.15; p.headT = hit.head ? 0.25 : 0; sfx(hit.head ? "head" : "hit", p.idx ? 0.5 : -0.5);
      if (enemy.health <= 0 && enemy.alive) {
        enemy.alive = false; enemy.respawnT = CONFIG.respawn; enemy.deaths++; p.kills++; sfx("kill", p.idx ? 0.5 : -0.5);
        feed(`${p.team.name} ⟶ ${enemy.team.name} · ${W.name}${hit.head ? " · رأس" : ""}`);
        if (p.kills >= CONFIG.killsToWin) { state.over = true; state.winner = p; state.overAt = performance.now(); }
      }
    } else if (wall.point) impact(wall.point);
  }

  function updatePlayer(p, enemy, dt) {
    const I = p.input; I.update(dt);
    if (I.pressed("pause")) state.paused = !state.paused;
    if (state.paused || state.over) return;
    if (!p.alive) { p.respawnT -= dt; p.pitch = Math.max(-0.6, p.pitch - dt * 0.5); if (p.respawnT <= 0) p.spawn(farthestSpawn(enemy)); return; }
    // look: mouse (pixels) + stick (rate), slower while aiming
    const zoom = THREE.MathUtils.lerp(1, p.W.zoom, p.aim), m = I.vec("lookMouse"), st = I.vec("lookStick");
    p.yaw -= (m.x * CONFIG.look.mouse + st.x * CONFIG.look.stickYaw * dt) / zoom;
    p.pitch = THREE.MathUtils.clamp(p.pitch - (m.y * CONFIG.look.mouse + st.y * CONFIG.look.stickPitch * dt) / zoom, -1.45, 1.45);
    // move
    const mv = I.vec("move"), sprint = I.down("sprint") && mv.y < -0.3 && p.aim < 0.2, speed = CONFIG.move * (sprint ? CONFIG.sprint : 1) * (1 - p.aim * 0.45);
    const fx2 = -Math.sin(p.yaw), fz = -Math.cos(p.yaw), rx = Math.cos(p.yaw), rz = -Math.sin(p.yaw);
    const tx = (fx2 * -mv.y + rx * mv.x) * speed, tz = (fz * -mv.y + rz * mv.x) * speed, acc = p.grounded ? 12 : 3;
    p.vel.x += (tx - p.vel.x) * Math.min(1, acc * dt); p.vel.z += (tz - p.vel.z) * Math.min(1, acc * dt);
    if (p.grounded && I.buffered("jump", 0.15)) p.vel.y = CONFIG.jump;
    moveAndCollide(p, dt, world.boxes);
    p.phase += Math.hypot(p.vel.x, p.vel.z) * dt * 1.6;
    // weapons
    p.aim += ((I.down("aim") && !sprint ? 1 : 0) - p.aim) * Math.min(1, dt * 12);
    for (let i = 0; i < 4; i++) if (I.pressed("w" + (i + 1))) p.select(i);
    if (I.pressed("next")) p.select(p.wi + 1); if (I.pressed("prev")) p.select(p.wi - 1);
    if (I.pressed("reload") && p.reloadT <= 0 && p.ammo[p.weapon] < p.W.mag) { p.reloadT = p.W.reload; sfx("reload", p.idx ? 0.5 : -0.5); }
    if (p.reloadT > 0) { p.reloadT -= dt; if (p.reloadT <= 0) p.ammo[p.weapon] = p.W.mag; }
    p.fireCD -= dt; p.swapT = Math.max(0, p.swapT - dt);
    if (!sprint && (p.W.auto ? I.down("fire") : I.pressed("fire"))) fire(p, enemy);
    p.recoil = Math.max(0, p.recoil - dt * 0.35); p.kickBack *= Math.exp(-dt * 14);
    // health regen after a pause
    if (p.health < CONFIG.maxHealth && performance.now() - p.lastHit > CONFIG.regenDelay * 1000) p.health = Math.min(CONFIG.maxHealth, p.health + CONFIG.regenRate * dt);
    p.hurtT = Math.max(0, p.hurtT - dt); p.hitT = Math.max(0, p.hitT - dt); p.headT = Math.max(0, p.headT - dt);
    if (p.flashT > 0 && (p.flashT -= dt) <= 0) p.views[p.weapon].userData.flash.material.opacity = 0;
  }

  function placeCameras(p, t) {
    const bob = p.grounded ? Math.sin(p.phase * 2) * 0.035 * Math.min(1, Math.hypot(p.vel.x, p.vel.z) / CONFIG.move) * (1 - p.aim) : 0;
    p.cam.position.set(p.pos.x, p.pos.y + (p.alive ? CONFIG.eye : 0.5) + bob, p.pos.z);
    p.cam.rotation.set(p.pitch, p.yaw, p.alive ? 0 : 0.6, "YXZ");
    const fov = 75 / THREE.MathUtils.lerp(1, p.W.zoom, p.aim); if (Math.abs(p.cam.fov - fov) > 0.01) { p.cam.fov = fov; p.cam.updateProjectionMatrix(); }
    const v = p.views[p.weapon], u = v.userData;
    v.position.lerpVectors(u.rest, u.aim, p.aim); v.position.z += p.kickBack; v.position.y += bob * 0.6 - p.swapT * 0.6 + (p.reloadT > 0 ? -0.08 : 0);
    v.rotation.set(p.kickBack * 2 + (p.reloadT > 0 ? 0.5 : 0), 0, (p.reloadT > 0 ? 0.3 : 0));
    v.visible = p.alive && !(p.W.scope && p.aim > 0.85);
    p.model.position.copy(p.pos); p.model.rotation.y = p.yaw + Math.PI; p.model.visible = true;
    animateSoldier(p.model, Math.hypot(p.vel.x, p.vel.z), p.phase, p.pitch, !p.alive);
  }

  function viewports() {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    return CONFIG.split === "horizontal" ? [[0, h / 2, w, h / 2], [0, 0, w, h / 2]] : [[0, 0, w / 2, h], [w / 2, 0, w / 2, h]];
  }
  function resize() { renderer.setSize(canvas.clientWidth, canvas.clientHeight, false); viewports().forEach(([, , w, h], i) => { players[i].cam.aspect = w / h; players[i].cam.updateProjectionMatrix(); }); hud.layout(CONFIG.split); }
  addEventListener("resize", resize); resize();

  let last = performance.now();
  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    updatePlayer(players[0], players[1], dt); updatePlayer(players[1], players[0], dt);
    for (let i = fx.length - 1; i >= 0; i--) { const f = fx[i]; f.t -= dt; if (f.fade) f.obj.material.opacity = Math.max(0, f.t / 0.07); if (f.grow) f.obj.scale.multiplyScalar(1.12); if (f.t <= 0) { scene.remove(f.obj); f.obj.geometry.dispose(); fx.splice(i, 1); } }
    for (const f of state.feed) f.t -= dt; state.feed = state.feed.filter((f) => f.t > 0);
    players.forEach((p) => placeCameras(p, now));
    viewports().forEach(([x, y, w, h], i) => { renderer.setViewport(x, y, w, h); renderer.setScissor(x, y, w, h); renderer.render(scene, players[i].cam); });
    hud.draw(players, state);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  const restart = () => { players.forEach((p, i) => { p.kills = p.deaths = 0; p.spawn(world.spawns[i]); }); state.over = false; state.winner = null; state.feed = []; };
  return { players, world, state, scene, renderer, restart, resize, fire, CONFIG };
}
