// Voxel World — a compact Minecraft-like engine: infinite chunked terrain, face-culled meshes,
// AABB physics, break/place with ray picking. Sections: config · world · meshing · player · input · loop.
import * as THREE from "three";

/* ---------- config ---------- */
const CHUNK = 16, HEIGHT = 64, VIEW = 5, SEA = 16, SEED = 1337, REACH = 6;
// id 0 is air. A block has one colour, or top/side/bottom colours.
const BLOCKS = [null,
  { name: "grass", top: 0x6fc24a, side: 0x8b6b3e, bottom: 0x7a5a33 },
  { name: "dirt", color: 0x7a5a33 },
  { name: "stone", color: 0x8c8d94 },
  { name: "sand", color: 0xe3d49b },
  { name: "wood", color: 0x7c5431 },
  { name: "leaves", color: 0x3f9140 },
];
const HOTBAR = [1, 2, 3, 4, 5, 6];

/* ---------- world: noise terrain stored per chunk ---------- */
function hash(x, z) { let h = Math.imul(x, 374761393) ^ Math.imul(z, 668265263) ^ SEED; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967295; }
const smooth = (t) => t * t * (3 - 2 * t);
function noise(x, z) {
  const xi = Math.floor(x), zi = Math.floor(z), xf = smooth(x - xi), zf = smooth(z - zi);
  const a = hash(xi, zi), b = hash(xi + 1, zi), c = hash(xi, zi + 1), d = hash(xi + 1, zi + 1);
  return a + (b - a) * xf + (c - a) * zf + (a - b - c + d) * xf * zf;
}
const heightAt = (x, z) => Math.floor(8 + noise(x / 64, z / 64) * 22 + noise(x / 20, z / 20) * 9 + noise(x / 7, z / 7) * 3);

const chunks = new Map();                       // "cx,cz" -> { cx, cz, data, mesh, dirty }
const key = (cx, cz) => cx + "," + cz;
const idx = (x, y, z) => (y * CHUNK + z) * CHUNK + x;

function generate(cx, cz) {
  const data = new Uint8Array(CHUNK * CHUNK * HEIGHT);
  for (let x = 0; x < CHUNK; x++) for (let z = 0; z < CHUNK; z++) {
    const wx = cx * CHUNK + x, wz = cz * CHUNK + z, h = Math.min(heightAt(wx, wz), HEIGHT - 12);
    for (let y = 0; y <= h; y++) data[idx(x, y, z)] = y === h ? (h <= SEA ? 4 : 1) : y > h - 4 ? (h <= SEA ? 4 : 2) : 3;
    // trees stay 2 blocks inside the chunk so they never spill into a neighbour
    if (h > SEA && x > 1 && x < CHUNK - 2 && z > 1 && z < CHUNK - 2 && hash(wx * 7 + 3, wz * 13 + 5) > 0.985) {
      const top = h + 4 + Math.floor(hash(wx, wz + 99) * 2);
      for (let lx = -2; lx <= 2; lx++) for (let lz = -2; lz <= 2; lz++) for (let ly = top - 2; ly <= top + 1; ly++)
        if (Math.abs(lx) + Math.abs(lz) + Math.max(0, ly - top) * 2 < 4) data[idx(x + lx, ly, z + lz)] = 6;
      for (let y = h + 1; y < top; y++) data[idx(x, y, z)] = 5;
    }
  }
  return data;
}
function getChunk(cx, cz) {
  let c = chunks.get(key(cx, cz));
  if (!c) { c = { cx, cz, data: generate(cx, cz), mesh: null, dirty: true }; chunks.set(key(cx, cz), c); }
  return c;
}
function getBlock(x, y, z) {
  if (y < 0) return 3; if (y >= HEIGHT) return 0;
  const c = chunks.get(key(Math.floor(x / CHUNK), Math.floor(z / CHUNK)));
  return c ? c.data[idx(x & 15, y, z & 15)] : 0;
}
function setBlock(x, y, z, id) {
  if (y < 0 || y >= HEIGHT) return;
  const cx = Math.floor(x / CHUNK), cz = Math.floor(z / CHUNK), lx = x & 15, lz = z & 15;
  getChunk(cx, cz).data[idx(lx, y, lz)] = id;
  for (const [dx, dz] of [[0, 0], [lx === 0 ? -1 : 0, 0], [lx === 15 ? 1 : 0, 0], [0, lz === 0 ? -1 : 0], [0, lz === 15 ? 1 : 0]]) {
    const n = chunks.get(key(cx + dx, cz + dz)); if (n) n.dirty = true;
  }
}

/* ---------- meshing: one mesh per chunk, only faces that touch air ---------- */
const FACES = [
  { d: [1, 0, 0], c: [[1, 0, 1], [1, 0, 0], [1, 1, 0], [1, 1, 1]], s: 0.8, k: "side" },
  { d: [-1, 0, 0], c: [[0, 0, 0], [0, 0, 1], [0, 1, 1], [0, 1, 0]], s: 0.8, k: "side" },
  { d: [0, 1, 0], c: [[0, 1, 1], [1, 1, 1], [1, 1, 0], [0, 1, 0]], s: 1.0, k: "top" },
  { d: [0, -1, 0], c: [[0, 0, 0], [1, 0, 0], [1, 0, 1], [0, 0, 1]], s: 0.5, k: "bottom" },
  { d: [0, 0, 1], c: [[0, 0, 1], [1, 0, 1], [1, 1, 1], [0, 1, 1]], s: 0.9, k: "side" },
  { d: [0, 0, -1], c: [[1, 0, 0], [0, 0, 0], [0, 1, 0], [1, 1, 0]], s: 0.65, k: "side" },
];
const material = new THREE.MeshBasicMaterial({ vertexColors: true });
const tmpColor = new THREE.Color();

function buildMesh(c) {
  const pos = [], col = [], ind = [], ox = c.cx * CHUNK, oz = c.cz * CHUNK;
  for (let y = 0; y < HEIGHT; y++) for (let z = 0; z < CHUNK; z++) for (let x = 0; x < CHUNK; x++) {
    const id = c.data[idx(x, y, z)]; if (!id) continue;
    const b = BLOCKS[id], wx = ox + x, wz = oz + z, jitter = 0.93 + hash(wx * 31 + y, wz * 17 - y) * 0.14;
    for (const f of FACES) {
      if (getBlock(wx + f.d[0], y + f.d[1], wz + f.d[2])) continue;
      tmpColor.setHex(b[f.k] ?? b.color).multiplyScalar(f.s * jitter);
      const n = pos.length / 3;
      for (const v of f.c) { pos.push(wx + v[0], y + v[1], wz + v[2]); col.push(tmpColor.r, tmpColor.g, tmpColor.b); }
      ind.push(n, n + 1, n + 2, n, n + 2, n + 3);
    }
  }
  if (c.mesh) { scene.remove(c.mesh); c.mesh.geometry.dispose(); }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("color", new THREE.Float32BufferAttribute(col, 3));
  g.setIndex(ind);
  g.computeBoundingSphere();
  c.mesh = new THREE.Mesh(g, material); c.dirty = false;
  scene.add(c.mesh);
}

/** Meshes the nearest chunks that need it (a few per frame) and drops far ones. Neighbour data is generated first so borders cull correctly. */
function updateChunks(budget) {
  const pcx = Math.floor(player.pos.x / CHUNK), pcz = Math.floor(player.pos.z / CHUNK), todo = [];
  for (let dx = -VIEW; dx <= VIEW; dx++) for (let dz = -VIEW; dz <= VIEW; dz++) {
    if (dx * dx + dz * dz > VIEW * VIEW + 1) continue;
    const c = getChunk(pcx + dx, pcz + dz);
    if (c.dirty) todo.push([dx * dx + dz * dz, c]);
  }
  todo.sort((a, b) => a[0] - b[0]);
  for (const [, c] of todo.slice(0, budget)) {
    getChunk(c.cx + 1, c.cz); getChunk(c.cx - 1, c.cz); getChunk(c.cx, c.cz + 1); getChunk(c.cx, c.cz - 1);
    buildMesh(c);
  }
  for (const c of chunks.values()) if (c.mesh && (Math.abs(c.cx - pcx) > VIEW + 2 || Math.abs(c.cz - pcz) > VIEW + 2)) { scene.remove(c.mesh); c.mesh.geometry.dispose(); c.mesh = null; c.dirty = true; }
  return todo.length;
}

/* ---------- renderer & scene ---------- */
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
document.body.prepend(renderer.domElement);
const scene = new THREE.Scene();
const SKY = 0x8fc1f2;
scene.background = new THREE.Color(SKY);
scene.fog = new THREE.Fog(SKY, CHUNK * (VIEW - 2), CHUNK * VIEW);
const camera = new THREE.PerspectiveCamera(75, 1, 0.1, 400);
camera.rotation.order = "YXZ";
const highlight = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(1.002, 1.002, 1.002)), new THREE.LineBasicMaterial({ color: 0x000000 }));
highlight.visible = false; scene.add(highlight);
function resize() { renderer.setSize(innerWidth, innerHeight); camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); }
addEventListener("resize", resize); resize();

/* ---------- player: feet position, AABB 0.6 x 1.8 ---------- */
const player = { pos: new THREE.Vector3(8.5, 0, 8.5), vel: new THREE.Vector3(), yaw: 0, pitch: 0, onGround: false, fly: false, slot: 0 };
const W = 0.3, H = 1.8, EYE = 1.62;
player.pos.y = heightAt(8, 8) + 2;

function collides(p) {
  for (let x = Math.floor(p.x - W); x <= Math.floor(p.x + W); x++)
    for (let y = Math.floor(p.y); y <= Math.floor(p.y + H); y++)
      for (let z = Math.floor(p.z - W); z <= Math.floor(p.z + W); z++)
        if (getBlock(x, y, z)) return true;
  return false;
}
function physics(dt) {
  const k = keys, speed = player.fly ? 12 : k.ShiftLeft ? 7 : 4.5;
  const f = (k.KeyW ? 1 : 0) - (k.KeyS ? 1 : 0), s = (k.KeyD ? 1 : 0) - (k.KeyA ? 1 : 0), len = Math.hypot(f, s) || 1;
  const sin = Math.sin(player.yaw), cos = Math.cos(player.yaw);
  const wx = ((-sin * f + cos * s) / len) * speed, wz = ((-cos * f - sin * s) / len) * speed;
  const a = Math.min(1, dt * (player.onGround || player.fly ? 14 : 4));
  player.vel.x += (wx - player.vel.x) * a; player.vel.z += (wz - player.vel.z) * a;
  if (player.fly) player.vel.y = ((k.Space ? 1 : 0) - (k.ControlLeft ? 1 : 0)) * 9;
  else { player.vel.y = Math.max(player.vel.y - 28 * dt, -18); if (k.Space && player.onGround) player.vel.y = 8.6; }

  const p = player.pos;
  p.x += player.vel.x * dt; if (collides(p)) { p.x -= player.vel.x * dt; player.vel.x = 0; }
  p.z += player.vel.z * dt; if (collides(p)) { p.z -= player.vel.z * dt; player.vel.z = 0; }
  player.onGround = false;
  p.y += player.vel.y * dt;
  if (collides(p)) {
    if (player.vel.y < 0) { p.y = Math.floor(p.y) + 1; player.onGround = true; } else p.y -= player.vel.y * dt;
    player.vel.y = 0;
  }
  if (p.y < -20) { p.set(8.5, heightAt(8, 8) + 3, 8.5); player.vel.set(0, 0, 0); }   // fell out of the world
}

/* ---------- picking: march along the view ray, remembering the last empty cell ---------- */
const dir = new THREE.Vector3();
function pick() {
  camera.getWorldDirection(dir);
  const o = camera.position; let px = Math.floor(o.x), py = Math.floor(o.y), pz = Math.floor(o.z);
  for (let t = 0; t <= REACH; t += 0.02) {
    const x = Math.floor(o.x + dir.x * t), y = Math.floor(o.y + dir.y * t), z = Math.floor(o.z + dir.z * t);
    if (getBlock(x, y, z) && y >= 0) return { hit: [x, y, z], prev: [px, py, pz] };
    px = x; py = y; pz = z;
  }
  return null;
}

/* ---------- input ---------- */
const keys = {};
const startEl = document.getElementById("start"), hotbarEl = document.getElementById("hotbar"), hud = document.getElementById("hud");
addEventListener("keydown", (e) => {
  keys[e.code] = true;
  if (e.code === "KeyF") player.fly = !player.fly;
  if (/^Digit[1-6]$/.test(e.code)) selectSlot(+e.code.slice(5) - 1);
  if (e.code === "Space") e.preventDefault();
});
addEventListener("keyup", (e) => { keys[e.code] = false; });
addEventListener("blur", () => { for (const k in keys) keys[k] = false; });
startEl.addEventListener("click", () => renderer.domElement.requestPointerLock());
document.addEventListener("pointerlockchange", () => { startEl.style.display = document.pointerLockElement ? "none" : "grid"; });
addEventListener("mousemove", (e) => {
  if (!document.pointerLockElement) return;
  player.yaw -= e.movementX * 0.0022;
  player.pitch = Math.max(-1.55, Math.min(1.55, player.pitch - e.movementY * 0.0022));
});
addEventListener("contextmenu", (e) => e.preventDefault());
addEventListener("mousedown", (e) => {
  if (!document.pointerLockElement) return;
  const p = pick(); if (!p) return;
  if (e.button === 0) setBlock(...p.hit, 0);
  else if (e.button === 2) {
    const [x, y, z] = p.prev;
    setBlock(x, y, z, HOTBAR[player.slot]);
    if (collides(player.pos)) setBlock(x, y, z, 0);   // never place a block inside the player
  }
});
addEventListener("wheel", (e) => selectSlot((player.slot + (e.deltaY > 0 ? 1 : HOTBAR.length - 1)) % HOTBAR.length));

function selectSlot(i) { player.slot = i; [...hotbarEl.children].forEach((el, j) => el.classList.toggle("on", j === i)); }
HOTBAR.forEach((id, i) => {
  const b = BLOCKS[id], el = document.createElement("div");
  el.className = "slot"; el.title = b.name; el.innerHTML = `<span>${i + 1}</span>`;
  el.style.background = "#" + (b.top ?? b.color).toString(16).padStart(6, "0");
  hotbarEl.append(el);
});
selectSlot(0);

/* ---------- loop ---------- */
while (updateChunks(64) > 0) { /* mesh the starting area before the first frame so the player has ground */ }
let last = performance.now(), frames = 0, fps = 0, fpsAt = last;
function frame(now) {
  const dt = Math.min((now - last) / 1000, 0.05); last = now;
  physics(dt);
  updateChunks(2);
  camera.position.set(player.pos.x, player.pos.y + EYE, player.pos.z);
  camera.rotation.set(player.pitch, player.yaw, 0);
  const p = pick();
  highlight.visible = !!p; if (p) highlight.position.set(p.hit[0] + 0.5, p.hit[1] + 0.5, p.hit[2] + 0.5);
  renderer.render(scene, camera);
  frames++; if (now - fpsAt > 500) { fps = Math.round((frames * 1000) / (now - fpsAt)); frames = 0; fpsAt = now; }
  hud.textContent = `${fps} fps  ${player.pos.x.toFixed(1)}, ${player.pos.y.toFixed(1)}, ${player.pos.z.toFixed(1)}${player.fly ? "  FLY" : ""}`;
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

window.game = { player, chunks, scene, getBlock, setBlock, BLOCKS };   // handy for debugging and automated checks
