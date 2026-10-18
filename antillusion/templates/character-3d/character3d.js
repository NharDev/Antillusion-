/* character3d.js — a stylised 3D character built in code as ONE skinned mesh on a real humanoid skeleton
   (Hips/Spine/Chest/Neck/Head, arms, legs — Mixamo-like names), smooth joint deformation (blended skin weights),
   toon or PBR materials, an inverted-hull outline, a face (eyes that blink and look, brows, mouth expressions)
   and animation clips built as real THREE.AnimationClips (idle, walk, run, jump, wave, punch, dance).

   import { createCharacter, PALETTES } from "./character3d.js";
   const hero = createCharacter({ palette: PALETTES.explorer, style: "toon" });   // style: "toon" | "pbr"
   scene.add(hero.root);
   hero.play("wave");            // one-shot/loop emote with cross-fade; hero.play(null) returns to locomotion
   hero.setSpeed(m_per_s);       // blends idle → walk → run (blend tree) and syncs the cycle to the ground speed
   hero.expression("happy");     // neutral | happy | sad | angry | surprised
   hero.lookAt(worldVec3);       // eyes + head follow a point
   every frame: hero.update(dt);
   hero.clips → { name: AnimationClip } (export with GLTFExporter, or reuse on any skeleton with the same bone names). */
import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";

const D = Math.PI / 180, clamp = (v, a, b) => Math.max(a, Math.min(b, v)), lerp = (a, b, t) => a + (b - a) * t;

export const PALETTES = {
  explorer: { skin: "#e8b58f", hair: "#3a2a22", eyes: "#3b6f8f", top: "#2f6f62", pants: "#36404f", shoes: "#5a3a2a", accent: "#e0a43a", sole: "#ece6da", outline: "#1d1a1c" },
  nomad:    { skin: "#b9774d", hair: "#17130f", eyes: "#4a3424", top: "#c9a15b", pants: "#4b3b2f", shoes: "#2c2622", accent: "#b6452c", sole: "#e9e1cf", outline: "#1b1512" },
  pilot:    { skin: "#f2cfb4", hair: "#c88a3c", eyes: "#2f6d4f", top: "#33465f", pants: "#2a2f38", shoes: "#1f2228", accent: "#e46b2e", sole: "#d9dee6", outline: "#15171c" },
  ranger:   { skin: "#7a4a2f", hair: "#0f0d0c", eyes: "#2b1d14", top: "#4f6b3a", pants: "#3b3a32", shoes: "#3a2b1f", accent: "#d9b44a", sole: "#d8d2b8", outline: "#141210" },
};

/* ---------- skeleton (rest pose: standing, arms down; character faces +Z, metres) ---------- */
const BONES = [
  ["Hips", null, 0, 0.95, 0], ["Spine", "Hips", 0, 0.1, 0], ["Chest", "Spine", 0, 0.17, 0], ["Neck", "Chest", 0, 0.2, 0], ["Head", "Neck", 0, 0.07, 0],
  ["LeftUpperArm", "Chest", 0.2, 0.15, 0], ["LeftLowerArm", "LeftUpperArm", 0, -0.27, 0], ["LeftHand", "LeftLowerArm", 0, -0.25, 0],
  ["RightUpperArm", "Chest", -0.2, 0.15, 0], ["RightLowerArm", "RightUpperArm", 0, -0.27, 0], ["RightHand", "RightLowerArm", 0, -0.25, 0],
  ["LeftUpperLeg", "Hips", 0.1, -0.06, 0], ["LeftLowerLeg", "LeftUpperLeg", 0, -0.42, 0], ["LeftFoot", "LeftLowerLeg", 0, -0.4, 0],
  ["RightUpperLeg", "Hips", -0.1, -0.06, 0], ["RightLowerLeg", "RightUpperLeg", 0, -0.42, 0], ["RightFoot", "RightLowerLeg", 0, -0.4, 0],
];

function buildSkeleton() {
  const bones = {}, list = [], world = {};
  for (const [name, parent, x, y, z] of BONES) {
    const b = new THREE.Bone(); b.name = name; b.position.set(x, y, z);
    if (parent) bones[parent].add(b);
    bones[name] = b; list.push(b);
    world[name] = parent ? world[parent].clone().add(new THREE.Vector3(x, y, z)) : new THREE.Vector3(x, y, z);
  }
  return { bones, list, world };
}

/* ---------- skin weights: a vertex near a joint is shared 50/50 with the neighbouring bone ---------- */
// chain: [[boneName, jointY], ...] ordered along the limb; the part's vertices pick their segment by height
function chainWeights(y, chain, blend, up) {
  const s = up ? 1 : -1;   // up = chain goes upwards (torso), else downwards (limbs)
  let i = 0; while (i + 1 < chain.length && s * (y - chain[i + 1][1]) >= 0) i++;
  const w = [[chain[i][0], 1]];
  const dPrev = Math.abs(y - chain[i][1]), dNext = i + 1 < chain.length ? Math.abs(chain[i + 1][1] - y) : Infinity;
  if (i > 0 && dPrev < blend) { const k = 0.5 * (1 - dPrev / blend); w[0][1] -= k; w.push([chain[i - 1][0], k]); }
  if (dNext < blend) { const k = 0.5 * (1 - dNext / blend); w[0][1] -= k; w.push([chain[i + 1][0], k]); }
  return w;
}
function skin(geo, index, weightsFor) {
  const pos = geo.attributes.position, n = pos.count, si = new Uint16Array(n * 4), sw = new Float32Array(n * 4), v = new THREE.Vector3();
  for (let i = 0; i < n; i++) {
    v.fromBufferAttribute(pos, i);
    const w = weightsFor(v).slice(0, 4), tot = w.reduce((a, b) => a + b[1], 0) || 1;
    w.forEach(([b, x], j) => { si[i * 4 + j] = index[b]; sw[i * 4 + j] = x / tot; });
  }
  geo.setAttribute("skinIndex", new THREE.Uint16BufferAttribute(si, 4));
  geo.setAttribute("skinWeight", new THREE.Float32BufferAttribute(sw, 4));
  return geo;
}
const place = (geo, { s = [1, 1, 1], r = [0, 0, 0], p = [0, 0, 0] }) => geo.scale(...s).rotateX(r[0]).rotateY(r[1]).rotateZ(r[2]).translate(...p);
const capsule = (r, len, seg = 20) => new THREE.CapsuleGeometry(r, len, 8, seg);
const sphere = (r, w = 28, h = 20, ...rest) => new THREE.SphereGeometry(r, w, h, ...rest);
function limb(rTop, rBot, y0, y1, x, z = 0) {   // tapered capsule between two heights
  const len = Math.abs(y0 - y1), g = new THREE.CylinderGeometry(rTop, rBot, len, 20, 6, true), cap0 = sphere(rTop, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2), cap1 = sphere(rBot, 20, 10, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2);
  cap0.translate(0, len / 2, 0); cap1.translate(0, -len / 2, 0);
  const m = mergeGeometries([g.toNonIndexed(), cap0.toNonIndexed(), cap1.toNonIndexed()]);
  return m.translate(x, (y0 + y1) / 2, z);
}

function toonRamp() {
  const d = new Uint8Array([90, 90, 90, 255, 175, 175, 175, 255, 255, 255, 255, 255]);
  const t = new THREE.DataTexture(d, 3, 1, THREE.RGBAFormat); t.minFilter = t.magFilter = THREE.NearestFilter; t.needsUpdate = true; return t;
}

export function createCharacter(opts = {}) {
  const pal = { ...PALETTES.explorer, ...(opts.palette || {}) }, style = opts.style || "toon";
  const { bones, list, world: W } = buildSkeleton(), index = Object.fromEntries(list.map((b, i) => [b.name, i]));
  const B = 0.07;
  const torsoChain = [["Hips", -1], ["Spine", W.Spine.y], ["Chest", W.Chest.y], ["Neck", W.Neck.y], ["Head", W.Head.y]];
  const armChain = (s) => [["Chest", 9], [s + "UpperArm", W[s + "UpperArm"].y], [s + "LowerArm", W[s + "LowerArm"].y], [s + "Hand", W[s + "Hand"].y]];
  const legChain = (s) => [["Hips", 9], [s + "UpperLeg", W[s + "UpperLeg"].y], [s + "LowerLeg", W[s + "LowerLeg"].y], [s + "Foot", W[s + "Foot"].y]];
  const parts = [];   // [geometry, material key, weightsFor]
  const add = (geo, mat, wf) => parts.push([geo.index ? geo.toNonIndexed() : geo, mat, wf]);
  const torsoW = (v) => chainWeights(v.y, torsoChain, B, true);

  // torso: a chest that narrows to the waist (a scaled lathe gives a better silhouette than a box or a plain capsule)
  const prof = [[0.001, 0.86], [0.15, 0.87], [0.168, 0.95], [0.158, 1.06], [0.172, 1.2], [0.185, 1.3], [0.17, 1.37], [0.12, 1.42], [0.06, 1.44], [0.001, 1.445]].map(([r, y]) => new THREE.Vector2(r, y));
  add(new THREE.LatheGeometry(prof, 28).scale(1.12, 1, 0.8), "top", torsoW);
  add(place(sphere(0.17), { s: [1.12, 0.62, 0.84], p: [0, 0.9, 0] }), "pants", torsoW);   // pelvis
  add(place(new THREE.TorusGeometry(0.168, 0.018, 8, 32), { s: [1.12, 1, 0.82], r: [Math.PI / 2, 0, 0], p: [0, 0.965, 0] }), "accent", torsoW);   // belt
  add(place(new THREE.TorusGeometry(0.075, 0.03, 10, 24), { r: [Math.PI / 2 + 0.15, 0, 0], p: [0, 1.43, -0.005] }), "accent", torsoW);   // scarf collar
  add(limb(0.058, 0.062, 1.38, 1.53, 0), "skin", torsoW);   // neck
  // head with jaw, ears and nose — one bone
  const headW = () => [["Head", 1]], hc = W.Head.y + 0.17;
  const head = sphere(0.2, 36, 28), hp = head.attributes.position;
  for (let i = 0; i < hp.count; i++) { const x = hp.getX(i), y = hp.getY(i), z = hp.getZ(i); const jaw = y < 0 ? 1 - 0.18 * (-y / 0.2) ** 1.5 * (1 - Math.max(0, z) / 0.2 * 0.3) : 1; hp.setXYZ(i, x * jaw * 0.97, y * 1.04, z * jaw); }
  head.computeVertexNormals();
  add(head.translate(0, hc, 0.005), "skin", headW);
  for (const s of [1, -1]) add(place(sphere(0.045, 16, 12), { s: [0.5, 1, 0.8], p: [s * 0.192, hc - 0.01, -0.01] }), "skin", headW);
  add(place(sphere(0.024, 14, 10), { s: [0.9, 1, 1.1], p: [0, hc - 0.035, 0.198] }), "skin", headW);
  // hair: a cap tilted back + fringe tufts
  add(place(sphere(0.214, 36, 18, 0, Math.PI * 2, 0, Math.PI * 0.56), { r: [-0.62, 0, 0], p: [0, hc + 0.005, -0.012] }), "hair", headW);
  [[-0.11, 0.15, -0.5], [-0.04, 0.17, -0.15], [0.04, 0.17, 0.15], [0.11, 0.15, 0.5], [0.16, 0.08, 0.9], [-0.16, 0.08, -0.9]].forEach(([x, y, a]) =>
    add(place(new THREE.ConeGeometry(0.055, 0.15, 10), { r: [2.35, 0, a], p: [x, hc + y + 0.015, 0.14 - Math.abs(x) * 0.5] }), "hair", headW));
  // arms
  for (const [s, k] of [["Left", 1], ["Right", -1]]) {
    const x = k * 0.2, aw = (v) => chainWeights(v.y, armChain(s), 0.06, false);
    add(place(sphere(0.072, 20, 14), { p: [x, W[s + "UpperArm"].y - 0.01, 0] }), "top", aw);   // shoulder
    add(limb(0.064, 0.054, W[s + "UpperArm"].y, W[s + "LowerArm"].y, x), "top", aw);
    add(limb(0.05, 0.04, W[s + "LowerArm"].y, W[s + "Hand"].y, x), "skin", aw);
    add(place(new THREE.TorusGeometry(0.052, 0.014, 8, 20), { r: [Math.PI / 2, 0, 0], p: [x, W[s + "LowerArm"].y - 0.035, 0] }), "top", aw);   // cuff
    add(place(sphere(0.055, 18, 14), { s: [0.75, 1.1, 0.95], p: [x, W[s + "Hand"].y - 0.06, 0.005] }), "skin", aw);   // palm
    add(place(capsule(0.017, 0.035, 10), { r: [0.5, 0, k * -0.4], p: [x - k * 0.002, W[s + "Hand"].y - 0.045, 0.045] }), "skin", aw);   // thumb
  }
  // legs + shoes
  for (const [s, k] of [["Left", 1], ["Right", -1]]) {
    const x = k * 0.1, lw = (v) => chainWeights(v.y, legChain(s), 0.08, false);
    add(limb(0.092, 0.075, W[s + "UpperLeg"].y + 0.02, W[s + "LowerLeg"].y, x), "pants", lw);
    add(limb(0.074, 0.06, W[s + "LowerLeg"].y, W[s + "Foot"].y + 0.03, x), "pants", lw);
    add(place(capsule(0.068, 0.12, 16), { s: [1, 0.85, 1], r: [Math.PI / 2, 0, 0], p: [x, 0.07, 0.05] }), "shoes", lw);
    add(place(new THREE.BoxGeometry(0.118, 0.022, 0.25, 2, 1, 4), { p: [x, 0.011, 0.05] }), "sole", lw);
  }

  // one geometry, one material group per part
  const keys = [...new Set(parts.map((p) => p[1]))];
  const geos = parts.map(([g, , wf]) => { ["skinIndex", "skinWeight"].forEach((a) => g.deleteAttribute(a)); if (!g.attributes.uv) g.setAttribute("uv", new THREE.Float32BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2)); return skin(g, index, wf); });
  const geometry = mergeGeometries(geos, true);
  geometry.groups.forEach((gr, i) => (gr.materialIndex = keys.indexOf(parts[i][1])));
  geometry.computeBoundingSphere();
  const ramp = toonRamp();
  const makeMat = (color, extra = {}) => style === "toon" ? new THREE.MeshToonMaterial({ color, gradientMap: ramp, ...extra }) : new THREE.MeshStandardMaterial({ color, roughness: 0.62, metalness: 0, ...extra });
  const mats = keys.map((k) => makeMat(pal[k], k === "hair" && style !== "toon" ? { roughness: 0.4 } : {}));

  const root = new THREE.Group(); root.name = "Character";
  const mesh = new THREE.SkinnedMesh(geometry, mats); mesh.castShadow = true; mesh.receiveShadow = true; mesh.frustumCulled = false;
  const skeleton = new THREE.Skeleton(list);
  mesh.add(bones.Hips); mesh.bind(skeleton);
  root.add(mesh);
  // inverted-hull outline: same geometry and skeleton, back faces pushed out along the normal
  const outlineMat = new THREE.MeshBasicMaterial({ color: pal.outline, side: THREE.BackSide });
  outlineMat.onBeforeCompile = (sh) => { sh.vertexShader = sh.vertexShader.replace("#include <begin_vertex>", "#include <begin_vertex>\n transformed += normal * 0.008;"); };
  const outline = new THREE.SkinnedMesh(geometry, outlineMat); outline.bind(skeleton, mesh.bindMatrix); outline.frustumCulled = false; outline.visible = style === "toon";
  root.add(outline);

  /* ---------- face (children of the Head bone, so they follow every animation) ---------- */
  const face = new THREE.Group(); face.position.set(0, 0.17, 0); bones.Head.add(face);
  const flat = (c) => new THREE.MeshBasicMaterial({ color: c });
  const eyes = [];
  for (const k of [1, -1]) {
    const g = new THREE.Group(); g.position.set(k * 0.075, 0.015, 0.168); g.rotation.y = k * 0.32; face.add(g);
    const white = new THREE.Mesh(sphere(0.043, 20, 16), flat("#fbfaf7")); white.scale.set(1, 1.25, 0.5); g.add(white);
    const iris = new THREE.Group(); g.add(iris);
    const ir = new THREE.Mesh(sphere(0.026, 18, 14), flat(pal.eyes)); ir.scale.set(1, 1.2, 0.45); ir.position.z = 0.016; iris.add(ir);
    const pu = new THREE.Mesh(sphere(0.014, 14, 10), flat("#14110f")); pu.scale.set(1, 1.2, 0.4); pu.position.z = 0.025; iris.add(pu);
    const hl = new THREE.Mesh(sphere(0.006, 8, 6), flat("#ffffff")); hl.position.set(0.009, 0.012, 0.03); iris.add(hl);
    const brow = new THREE.Mesh(capsule(0.011, 0.05, 8), flat(pal.hair)); brow.rotation.z = Math.PI / 2; brow.position.set(k * 0.075, 0.074, 0.18); brow.userData.k = k; face.add(brow);
    eyes.push({ g, iris, brow, k });
  }
  const mouthMat = flat("#3a1d1f");
  const mouths = {
    neutral: new THREE.Mesh(new THREE.TorusGeometry(0.035, 0.007, 6, 16, Math.PI * 0.5), mouthMat),
    happy: new THREE.Mesh(new THREE.TorusGeometry(0.045, 0.01, 6, 20, Math.PI * 0.9), mouthMat),
    sad: new THREE.Mesh(new THREE.TorusGeometry(0.035, 0.008, 6, 16, Math.PI * 0.6), mouthMat),
    angry: new THREE.Mesh(capsule(0.009, 0.05, 6), mouthMat),
    surprised: new THREE.Mesh(sphere(0.022, 14, 10), mouthMat),
  };
  mouths.neutral.rotation.z = Math.PI * 1.25; mouths.happy.rotation.z = Math.PI * 1.05; mouths.sad.rotation.z = Math.PI * 0.2; mouths.angry.rotation.z = Math.PI / 2; mouths.surprised.scale.set(0.9, 1.25, 0.4);
  for (const [k, m] of Object.entries(mouths)) { m.position.set(0, k === "happy" ? -0.075 : k === "sad" ? -0.105 : -0.088, k === "surprised" ? 0.182 : 0.178); if (k === "neutral" || k === "happy") m.position.y += 0.035; m.visible = k === "neutral"; face.add(m); }
  const EXPR = { neutral: { brow: [0, 0], lid: 1 }, happy: { brow: [0.012, 0.15], lid: 0.8 }, sad: { brow: [0.006, -0.35], lid: 0.75 }, angry: { brow: [-0.01, 0.45], lid: 0.78 }, surprised: { brow: [0.025, 0], lid: 1.15 } };

  /* ---------- clips: poses (degrees, X = swing: negative forward, like the 2D rig) sampled into AnimationClips ---------- */
  const cat = (k, t) => { const n = k.length, x = (((t % 1) + 1) % 1) * n, i = Math.floor(x), f = x - i, p = (j) => k[((i + j) % n + n) % n]; const a = p(-1), b = p(0), c = p(1), d = p(2); return 0.5 * (2 * b + (-a + c) * f + (2 * a - 5 * b + 4 * c - d) * f * f + (-a + 3 * b - 3 * c + d) * f * f * f); };
  const keyed = (k, t) => { const e = (x) => x * x * (3 - 2 * x); for (let i = 1; i < k.length; i++) if (t <= k[i][0]) { const [t0, v0] = k[i - 1], [t1, v1] = k[i]; return lerp(v0, v1, e((t - t0) / (t1 - t0 || 1))); } return k[k.length - 1][1]; };
  const WALK = { th: [-24, -14, 0, 12, 22, 20, -12, -28], sh: [4, 14, 6, 4, 10, 34, 62, 22], ft: [-15, 0, 0, 0, 25, 20, 0, -8] };
  const RUN = { th: [-30, -12, 10, 36, 30, 0, -40, -46], sh: [12, 30, 20, 10, 70, 115, 80, 30], ft: [-10, 0, 0, 25, 30, 10, -5, -15] };
  const cycle = (C, t, o) => {
    const L = cat(C.th, t), R = cat(C.th, t + 0.5), sl = cat(C.sh, t), sr = cat(C.sh, t + 0.5), arm = (x) => cat(C.th, x - 0.04);
    return { y: o.bob * Math.cos(4 * Math.PI * (t - 0.125)) + o.drop, Spine: [o.lean, 6 * Math.sin(2 * Math.PI * t), 0], Chest: [o.lean * 0.5, -10 * Math.sin(2 * Math.PI * t) * o.twist, 0], Head: [-o.lean * 0.8, 4 * Math.sin(2 * Math.PI * t), 0],
      LeftUpperLeg: [L, 0, 0], LeftLowerLeg: [sl, 0, 0], LeftFoot: [-(L + sl) * o.footFlat + cat(C.ft, t), 0, 0],
      RightUpperLeg: [R, 0, 0], RightLowerLeg: [sr, 0, 0], RightFoot: [-(R + sr) * o.footFlat + cat(C.ft, t + 0.5), 0, 0],
      LeftUpperArm: [o.arm * arm(t + 0.5), 0, 8], LeftLowerArm: [o.elbow - Math.max(0, -arm(t + 0.5)) * 0.6, 0, 0],
      RightUpperArm: [o.arm * arm(t), 0, -8], RightLowerArm: [o.elbow - Math.max(0, -arm(t)) * 0.6, 0, 0] };
  };
  const POSES = {
    idle: { period: 3.2, fn: (t) => { const s = Math.sin(t * 2 * Math.PI); return { y: 0.004 * s, Spine: [1 + s, 0, 0], Chest: [1.5 * s, 0, 0], Head: [-1, 3 * Math.sin(t * 2 * Math.PI * 0.5), 0], LeftUpperArm: [3, 0, 8 + s], RightUpperArm: [-2, 0, -8 - s], LeftLowerArm: [-10, 0, 0], RightLowerArm: [-12, 0, 0], LeftUpperLeg: [-3, 0, 2], RightUpperLeg: [4, 0, -3], LeftFoot: [3, 0, 0], RightFoot: [-4, 0, 0] }; } },
    walk: { period: 1.0, speed: 1.35, fn: (t) => cycle(WALK, t, { bob: 0.018, drop: 0, lean: 4, twist: 0.6, footFlat: 1, arm: 0.8, elbow: -14 }) },
    run: { period: 0.66, speed: 3.9, fn: (t) => cycle(RUN, t, { bob: 0.03, drop: -0.02, lean: 12, twist: 1, footFlat: 0.6, arm: 1.05, elbow: -85 }) },
    jump: { period: 1.4, once: true, fn: (t) => {
      const K = (k) => keyed(k, t);
      const thigh = K([[0, -3], [0.16, -42], [0.24, 6], [0.48, -55], [0.7, -18], [0.76, -36], [0.9, -6], [1, -3]]), shin = K([[0, 3], [0.16, 82], [0.24, 4], [0.48, 95], [0.7, 22], [0.76, 74], [0.9, 8], [1, 3]]);
      const arm = K([[0, 4], [0.16, 38], [0.26, -150], [0.48, -120], [0.7, -70], [0.76, 20], [0.92, 6], [1, 4]]), up = K([[0, 0], [0.16, -0.12], [0.24, 0.12], [0.48, 0.55], [0.7, 0.18], [0.76, -0.1], [0.9, 0], [1, 0]]);
      const lean = K([[0, 2], [0.16, 22], [0.24, -4], [0.48, 6], [0.76, 18], [0.9, 3], [1, 2]]), air = up > 0.1 ? 22 : 0;
      return { y: up, Spine: [lean, 0, 0], Head: [-lean * 0.6, 0, 0], LeftUpperLeg: [thigh, 0, 3], RightUpperLeg: [thigh + 8, 0, -3], LeftLowerLeg: [shin, 0, 0], RightLowerLeg: [shin * 0.9, 0, 0], LeftFoot: [-(thigh + shin) + air, 0, 0], RightFoot: [-(thigh + 8 + shin * 0.9) + air, 0, 0],
        LeftUpperArm: [arm, 0, 12], RightUpperArm: [arm, 0, -12], LeftLowerArm: [-20, 0, 0], RightLowerArm: [-20, 0, 0] }; } },
    wave: { period: 1.3, fn: (t) => { const w = Math.sin(t * 4 * Math.PI); return { y: 0.003 * Math.sin(t * 2 * Math.PI), Spine: [-2, 0, 3], Head: [4, -8, 6 + 3 * w], RightUpperArm: [-10, 0, -150], RightLowerArm: [0, 0, -30 + 28 * w], RightHand: [0, 0, 10 * w], LeftUpperArm: [4, 0, 8], LeftLowerArm: [-12, 0, 0], LeftUpperLeg: [-3, 0, 2], RightUpperLeg: [4, 0, -3] }; } },
    punch: { period: 1.0, fn: (t) => {
      const K = (k) => keyed(k, t);
      const a = K([[0, -55], [0.3, 25], [0.36, -88], [0.5, -88], [0.85, -55], [1, -55]]), f = K([[0, -105], [0.3, -125], [0.36, -4], [0.5, -4], [0.85, -105], [1, -105]]), tw = K([[0, -10], [0.3, -30], [0.36, 28], [0.5, 25], [0.85, -10], [1, -10]]);
      return { y: -0.04, Spine: [8, tw, 0], Chest: [0, tw * 0.5, 0], Head: [0, -tw * 0.9, 0], RightUpperArm: [a, 0, -10], RightLowerArm: [f, 0, 0], LeftUpperArm: [-60, 0, 14], LeftLowerArm: [-110, 0, 0],
        LeftUpperLeg: [-24, 0, 6], LeftLowerLeg: [26, 0, 0], LeftFoot: [-2, 0, 0], RightUpperLeg: [16, 0, -6], RightLowerLeg: [14, 0, 0], RightFoot: [-30, 0, 0] }; } },
    dance: { period: 1.0, fn: (t) => { const s = Math.sin(t * 2 * Math.PI), b = Math.abs(Math.sin(t * 2 * Math.PI)); return { y: -0.04 * b, Hips: [0, 14 * s, 0], Spine: [4, -10 * s, 6 * s], Head: [6 * b, -8 * s, -6 * s], LeftUpperArm: [-30 - 30 * b, 0, 40 + 30 * b], LeftLowerArm: [-70, 0, 0], RightUpperArm: [-30 - 30 * (1 - b), 0, -40 - 30 * (1 - b)], RightLowerArm: [-70, 0, 0], LeftUpperLeg: [-18 * b, 0, 4], LeftLowerLeg: [36 * b, 0, 0], LeftFoot: [-18 * b, 0, 0], RightUpperLeg: [-18 * (1 - b), 0, -4], RightLowerLeg: [36 * (1 - b), 0, 0], RightFoot: [-18 * (1 - b), 0, 0] }; } },
  };
  const q = new THREE.Quaternion(), e = new THREE.Euler();
  const clips = {};
  for (const [name, P] of Object.entries(POSES)) {
    const fps = 30, n = Math.round(P.period * fps), times = [], tracks = {}, ys = [];
    for (let i = 0; i <= n; i++) {
      const t = i / n, pose = P.fn(t); times.push(t * P.period); ys.push(0, W.Hips.y + (pose.y || 0), 0);
      for (const b of list) { const r = pose[b.name] || (b.name === "LeftUpperArm" ? [0, 0, 8] : b.name === "RightUpperArm" ? [0, 0, -8] : [0, 0, 0]); q.setFromEuler(e.set(r[0] * D, r[1] * D, r[2] * D, "XYZ")); (tracks[b.name] || (tracks[b.name] = [])).push(q.x, q.y, q.z, q.w); }
    }
    clips[name] = new THREE.AnimationClip(name, P.period, [new THREE.VectorKeyframeTrack("Hips.position", times, ys), ...list.map((b) => new THREE.QuaternionKeyframeTrack(b.name + ".quaternion", times, tracks[b.name]))]);
  }

  /* ---------- runtime: locomotion blend tree + emotes, face, gaze ---------- */
  const mixer = new THREE.AnimationMixer(mesh);
  const act = Object.fromEntries(Object.keys(clips).map((k) => [k, mixer.clipAction(clips[k])]));
  for (const k of ["idle", "walk", "run"]) { act[k].play(); act[k].setEffectiveWeight(k === "idle" ? 1 : 0); }
  act.jump.setLoop(THREE.LoopOnce, 1); act.jump.clampWhenFinished = false;
  let speed = 0, emote = null, emoteW = 0, expr = "neutral", blinkT = 2 + Math.random() * 3, blink = 0, lookTarget = null, time = 0;
  mixer.addEventListener("finished", (ev) => { if (ev.action === act[emote]) emote = null; });
  const api = {
    root, mesh, skeleton, bones, clips, mixer, materials: mats, outline,
    play(name) {
      if (emote && act[emote]) act[emote].fadeOut(0.2);
      emote = name && act[name] ? name : null;
      if (emote) { act[emote].reset().setEffectiveWeight(1).fadeIn(0.2).play(); }
    },
    setSpeed(v) { speed = Math.max(0, v); },
    expression(name) { if (!EXPR[name]) return; expr = name; for (const [k, m] of Object.entries(mouths)) m.visible = k === name; },
    lookAt(v) { lookTarget = v ? v.clone() : null; },
    setStyle(s) { mats.forEach((m, i) => { const c = m.color.clone(); const nm = s === "toon" ? new THREE.MeshToonMaterial({ color: c, gradientMap: ramp }) : new THREE.MeshStandardMaterial({ color: c, roughness: 0.62 }); mats[i] = nm; }); mesh.material = mats; outline.visible = s === "toon"; },
    setPalette(p) { Object.assign(pal, p); keys.forEach((k, i) => mats[i].color.set(pal[k])); outlineMat.color.set(pal.outline); eyes.forEach((e) => e.iris.children[0].material.color.set(pal.eyes)); eyes.forEach((e) => e.brow.material.color.set(pal.hair)); },
    get speed() { return speed; }, get emote() { return emote; },
    update(dt) {
      time += dt;
      // blend tree: weights from speed, cycles kept in phase so feet do not slide
      const w = POSES.walk.speed, r = POSES.run.speed;
      const wWalk = speed <= w ? speed / w : clamp(1 - (speed - w) / (r - w), 0, 1), wRun = speed <= w ? 0 : clamp((speed - w) / (r - w), 0, 1), wIdle = clamp(1 - speed / w, 0, 1);
      const target = emote ? 1 : 0; emoteW = lerp(emoteW, target, 1 - Math.exp(-10 * dt));
      act.idle.setEffectiveWeight(wIdle * (1 - emoteW)); act.walk.setEffectiveWeight(wWalk * (1 - emoteW)); act.run.setEffectiveWeight(wRun * (1 - emoteW));
      const phaseRate = speed > 0.05 ? (wRun > 0.5 ? speed / r : speed / w) : 1;
      act.walk.timeScale = act.run.timeScale = Math.max(0.3, phaseRate);
      act.run.time = (act.walk.time / POSES.walk.period) % 1 * POSES.run.period;
      mixer.update(dt);
      // face: blinks every 2–5 s, brows/lids from the expression, eyes follow the target
      blinkT -= dt; if (blinkT < 0) { blink = 0.14; blinkT = 2 + Math.random() * 3; } blink = Math.max(0, blink - dt);
      const ex = EXPR[expr], lid = blink > 0 ? 0.1 : ex.lid;
      for (const ey of eyes) {
        ey.g.scale.y = lerp(ey.g.scale.y, lid, 0.5);
        ey.brow.position.y = lerp(ey.brow.position.y, 0.074 + ex.brow[0], 0.25); ey.brow.rotation.z = Math.PI / 2 - ey.k * ex.brow[1];
        if (lookTarget) { const local = ey.g.worldToLocal(lookTarget.clone()); const d = local.normalize(); ey.iris.position.x = lerp(ey.iris.position.x, clamp(d.x * 0.02, -0.014, 0.014), 0.2); ey.iris.position.y = lerp(ey.iris.position.y, clamp(d.y * 0.02, -0.012, 0.012), 0.2); }
      }
      if (lookTarget && !emote && speed < 0.2) {   // a gentle head turn toward the target, layered over the clip
        const h = bones.Head, local = h.parent.worldToLocal(lookTarget.clone()).sub(h.position);
        const yaw = clamp(Math.atan2(local.x, local.z), -0.7, 0.7), pitch = clamp(-Math.atan2(local.y, Math.hypot(local.x, local.z)), -0.4, 0.4);
        h.quaternion.multiply(q.setFromEuler(e.set(pitch * 0.6, yaw * 0.7, 0)));
      }
    },
  };
  return api;
}
