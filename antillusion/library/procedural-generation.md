# Procedural generation: seeded RNG, noise, terrain, dungeons, caves, WFC, Poisson disc, L-systems, loot, names, validation
tags: procedural generation procgen seed seeded random rng mulberry32 sfc32 noise perlin simplex value noise fbm domain warp terrain heightmap biome dungeon bsp rooms cellular automata cave drunkard walk wave function collapse wfc poisson disc l-system loot table weights pity name generator markov flood fill لعبه العاب توليد اجرائي عشوائي بذره ضوضاء تضاريس خريطه زنزانه كهف غنائم اسماء

## Seeded RNG (never `Math.random()` for generation — it can't be seeded)
```js
// string seed → 32-bit ints
function cyrb128(str) { let h1 = 1779033703, h2 = 3144134277, h3 = 1013904242, h4 = 2773480762;
  for (let i = 0, k; i < str.length; i++) { k = str.charCodeAt(i);
    h1 = h2 ^ Math.imul(h1 ^ k, 597399067); h2 = h3 ^ Math.imul(h2 ^ k, 2869860233);
    h3 = h4 ^ Math.imul(h3 ^ k, 951274213); h4 = h1 ^ Math.imul(h4 ^ k, 2716044179); }
  h1 = Math.imul(h3 ^ (h1 >>> 18), 597399067); h2 = Math.imul(h4 ^ (h2 >>> 22), 2869860233);
  h3 = Math.imul(h1 ^ (h3 >>> 17), 951274213); h4 = Math.imul(h2 ^ (h4 >>> 19), 2716044179);
  return [(h1 ^ h2 ^ h3 ^ h4) >>> 0, (h2 ^ h1) >>> 0, (h3 ^ h1) >>> 0, (h4 ^ h1) >>> 0]; }
function mulberry32(a) { return () => { a |= 0; a = (a + 0x6D2B79F5) | 0;
  let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
function sfc32(a, b, c, d) { return () => { a >>>= 0; b >>>= 0; c >>>= 0; d >>>= 0;
  let t = (a + b) | 0; a = b ^ (b >>> 9); b = (c + (c << 3)) | 0; c = (c << 21) | (c >>> 11);
  d = (d + 1) | 0; t = (t + d) | 0; c = (c + t) | 0; return (t >>> 0) / 4294967296; }; }
const rng = sfc32(...cyrb128('daily-2026-10-18'));
const R = {
  float: (a = 0, b = 1) => a + (b - a) * rng(),
  int: (a, b) => a + Math.floor(rng() * (b - a + 1)),            // inclusive
  chance: (p) => rng() < p,
  pick: (arr) => arr[Math.floor(rng() * arr.length)],
  shuffle: (arr) => { for (let i = arr.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [arr[i], arr[j]] = [arr[j], arr[i]]; } return arr; },
};
```
- **Separate streams** per system (`world`, `loot`, `combat`, `cosmetic`) derived from the master seed (`cyrb128(seed + ':loot')`), so adding a roll in combat doesn't change the map.
- Per-chunk generation: seed from coordinates (`hash(seed, cx, cy)`) so chunks are order-independent.
- Show/share seeds; daily challenge = date string seed. Floats can differ across platforms for long chains — keep generation integer/grid-based where cross-platform determinism matters.

## Noise
```js
// hash-based 2D value noise (deterministic per seed), smooth interpolation
const hash2 = (x, y, s) => { let h = Math.imul(x, 374761393) + Math.imul(y, 668265263) + Math.imul(s, 2147483647);
  h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
const fade = t => t * t * t * (t * (t * 6 - 15) + 10);
function valueNoise(x, y, s = 0) { const xi = Math.floor(x), yi = Math.floor(y), xf = fade(x - xi), yf = fade(y - yi);
  const a = hash2(xi, yi, s), b = hash2(xi + 1, yi, s), c = hash2(xi, yi + 1, s), d = hash2(xi + 1, yi + 1, s);
  return (a + (b - a) * xf) + ((c + (d - c) * xf) - (a + (b - a) * xf)) * yf; }   // 0..1
function fbm(x, y, { oct = 5, lac = 2, gain = 0.5, s = 0, n = valueNoise } = {}) {
  let sum = 0, amp = 1, f = 1, norm = 0;
  for (let i = 0; i < oct; i++) { sum += amp * n(x * f, y * f, s + i); norm += amp; amp *= gain; f *= lac; }
  return sum / norm; }
const ridged = (x, y) => 1 - Math.abs(fbm(x, y) * 2 - 1);                   // mountain ridges
function warped(x, y) { const qx = fbm(x, y, { s: 1 }), qy = fbm(x + 5.2, y + 1.3, { s: 2 });
  return fbm(x + 4 * qx, y + 4 * qy, { s: 3 }); }                              // domain warping: organic swirls
```
- Value noise is blocky-ish; **Perlin/gradient** and **simplex** look better (fewer grid artefacts). Use the `simplex-noise` npm package (`createNoise2D(seededRandomFn)` returns −1..1) or `open-simplex-noise` style ports rather than hand-rolling.
- Frequency: start at 1/64–1/128 per tile/pixel for continents; octaves 4–6, lacunarity 2, gain (persistence) 0.5.

## Terrain / heightmaps / biomes
- `h = fbm(x/scale, y/scale)`; island mask: `h -= k * dist(x,y, centre)^2` (k so edges go below sea level); redistribute: `h = Math.pow(h, 1.5–3)` for flatter lowlands and sharp peaks.
- Biomes from height × moisture (second noise): water < 0.30, beach < 0.34, then grass/forest/jungle by moisture, rock > 0.75, snow > 0.85. Temperature from latitude + height.
- Rivers: from high points, step to lowest neighbour until sea (fill pits first). Erosion (hydraulic droplets) for realism if time allows.
- 3D voxels: density `d = fbm3(x,y,z) - (y - groundLevel) * 0.05`; solid if `d > 0`; caves where `|noise3| < 0.05` (worm caves).

## Dungeons
**BSP rooms**: recursively split a rectangle (choose horizontal/vertical by aspect, split at 35–65 %) until leaves < min size (e.g. 10×10); place a room inside each leaf with 1–2 tile padding; connect sibling leaves' rooms with L-shaped corridors, walking back up the tree.
```js
function bsp(r, min = 10, out = []) {
  const canH = r.h >= min * 2, canV = r.w >= min * 2;
  if (!canH && !canV) { const m = Math.floor(min / 2), w = R.int(m, r.w - 2), h = R.int(m, r.h - 2);
    out.push({ x: r.x + R.int(1, r.w - w - 1), y: r.y + R.int(1, r.h - h - 1), w, h }); return out.at(-1); }
  const horiz = canH && (!canV || r.h > r.w || R.chance(0.5)), t = R.float(0.35, 0.65);
  const [a, b] = horiz ? [{ ...r, h: Math.floor(r.h * t) }, { ...r, y: r.y + Math.floor(r.h * t), h: r.h - Math.floor(r.h * t) }]
                       : [{ ...r, w: Math.floor(r.w * t) }, { ...r, x: r.x + Math.floor(r.w * t), w: r.w - Math.floor(r.w * t) }];
  const ra = bsp(a, min, out), rb = bsp(b, min, out); corridor(ra, rb); return R.chance(0.5) ? ra : rb;   // corridor(): carve an L between room centres
}
```
Alternatives: random room placement + reject overlaps + connect with a minimum spanning tree (Delaunay → MST + 10–15 % extra edges for loops); hand-made room templates stitched on a grid (Spelunky-style guaranteed path first, filler rooms after).

**Cellular-automata caves**: fill 45 % walls (borders always wall) → 4–5 iterations of "wall if ≥ 5 of 8 neighbours are wall (or 0 neighbours, to break big open areas in the first 2 passes)" → flood-fill regions → keep the largest (or connect others with tunnels) → remove regions < 10 tiles.

**Drunkard walk**: start at centre, step to a random 4-neighbour, carve floor; stop when 35–45 % of the map is floor. Variants: multiple walkers, bias toward a direction, "spawn room every N steps". Good for organic caves that are always connected.

## Wave Function Collapse (overview)
Each cell starts with all tiles possible. Loop: pick the cell with the **lowest entropy** (fewest options, random tiebreak) → collapse it to one tile (weighted by frequency) → **propagate** constraints to neighbours (remove tiles with no compatible neighbour, BFS until stable). On contradiction (a cell with 0 options): restart with a new seed or backtrack. *Simple tiled* model uses explicit adjacency rules per edge (sockets); *overlapping* model learns N×N patterns from a sample image. Pre-place fixed cells (entrances, borders) before running. Use for towns, tile decorations, pipes; combine with a guaranteed path carved first. Reference: mxgmn/WaveFunctionCollapse.

## Poisson-disc sampling (Bridson) — natural object scatter with min spacing
```js
function poisson(w, h, r, k = 30) {
  const cell = r / Math.SQRT2, gw = Math.ceil(w / cell), gh = Math.ceil(h / cell), grid = new Array(gw * gh), pts = [], active = [];
  const add = p => { pts.push(p); active.push(p); grid[(p.x / cell | 0) + (p.y / cell | 0) * gw] = p; };
  add({ x: R.float(0, w), y: R.float(0, h) });
  while (active.length) { const i = R.int(0, active.length - 1), s = active[i]; let found = false;
    for (let n = 0; n < k; n++) { const a = R.float(0, Math.PI * 2), d = R.float(r, 2 * r), p = { x: s.x + Math.cos(a) * d, y: s.y + Math.sin(a) * d };
      if (p.x < 0 || p.y < 0 || p.x >= w || p.y >= h) continue;
      const gx = p.x / cell | 0, gy = p.y / cell | 0; let ok = true;
      for (let y = Math.max(0, gy - 2); y <= Math.min(gh - 1, gy + 2) && ok; y++)
        for (let x = Math.max(0, gx - 2); x <= Math.min(gw - 1, gx + 2); x++) { const q = grid[x + y * gw];
          if (q && (q.x - p.x) ** 2 + (q.y - p.y) ** 2 < r * r) { ok = false; break; } }
      if (ok) { add(p); found = true; break; } }
    if (!found) active.splice(i, 1); }
  return pts;
}
```
Vary density by multiplying `r` with a noise value (forests thinning at edges).

## L-systems (plants, coral, lightning)
Axiom + rewrite rules applied N times, then interpreted by a turtle: `F` draw forward, `+`/`-` turn by angle, `[`/`]` push/pop state.
```js
function lsystem(axiom, rules, n) { let s = axiom; for (let i = 0; i < n; i++) s = [...s].map(c => rules[c] ?? c).join(''); return s; }
const plant = lsystem('X', { X: 'F+[[X]-X]-F[-FX]+X', F: 'FF' }, 5);   // angle 25°, shrink step each iteration
```
Add randomness with stochastic rules (pick among alternatives by weight) and jitter angle ±5°.

## Loot tables, weights and pity
```js
const table = [{ id: 'common', w: 70 }, { id: 'rare', w: 25 }, { id: 'epic', w: 4.5 }, { id: 'legendary', w: 0.5 }];
function roll(t, rng) { const total = t.reduce((s, e) => s + e.w, 0); let x = rng() * total;
  for (const e of t) if ((x -= e.w) < 0) return e.id; return t.at(-1).id; }
let sinceLegendary = 0;
function rollWithPity(rng) {
  const softStart = 60, hard = 90;                       // soft pity ramps odds, hard pity guarantees
  const t = table.map(e => e.id === 'legendary' ? { ...e, w: e.w + Math.max(0, sinceLegendary - softStart) * 3 } : e);
  const id = sinceLegendary + 1 >= hard ? 'legendary' : roll(t, rng);
  sinceLegendary = id === 'legendary' ? 0 : sinceLegendary + 1; return id;
}
```
- Nested tables (roll rarity → roll item in rarity → roll affixes). Guaranteed drops for quest items. "Bad-luck protection" also applies to non-gacha drops (e.g. increase rare chance 1 % per miss).
- Shuffle bags (deck of outcomes, refill when empty) for fair-feeling short-term randomness (e.g. Tetris 7-bag).
- Disclose odds if real money is involved; many regions regulate paid loot boxes.

## Name generators
- Syllable combiner: `pick(prefix) + pick(middle)? + pick(suffix)` per culture (e.g. elvish `['Ael','Ith','Lor'] + ['an','ia','wen']`); filter banned substrings and too-long results.
- Markov chain (order 2–3) trained on 50+ real names: map each 2–3-letter context → next-letter counts, generate until end token; reject names present in the training set and lengths outside 4–10.
- Places: `[adjective|colour|animal] + [geography]` ("Ashfen", "Crowmere"), with compound joining rules.

## Validation (generate → test → retry)
- **Reachability**: BFS/flood-fill from start; all required tiles (exit, keys, NPCs) must be reached; unreached floor removed or connected.
```js
function reachable(grid, W, H, sx, sy) { const seen = new Uint8Array(W * H), q = [sx + sy * W]; seen[q[0]] = 1;
  for (let i = 0; i < q.length; i++) { const c = q[i], x = c % W, y = (c / W) | 0;
    for (const [dx, dy] of [[1,0],[-1,0],[0,1],[0,-1]]) { const nx = x + dx, ny = y + dy, n = nx + ny * W;
      if (nx >= 0 && ny >= 0 && nx < W && ny < H && !seen[n] && grid[n] !== 1) { seen[n] = 1; q.push(n); } } }
  return seen; }   // grid: 1 = wall
```
- **Lock-and-key**: place keys only in regions reachable *before* their door (BFS with doors as walls, then open in order).
- **Quality metrics**: path length start → exit within range, room count, dead-end ratio, open-area %, distance between spawns and enemies. Reject and regenerate with `seed + 1` (cap attempts, fall back to a hand-made map).
- Platformers: validate jumps with the player's actual jump arc (max gap / height table), not just grid connectivity.
- Log the seed with every bug report; add a debug overlay to view the generator's stages.
