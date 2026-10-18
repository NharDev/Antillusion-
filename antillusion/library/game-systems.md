# Game systems cookbook: collision, pathfinding, AI, procedural generation, combat, progression, multiplayer
tags: game collision aabb physics spatial hash pathfinding astar a* steering ai fsm behavior tree procedural generation noise dungeon cave wfc loot combat balance progression economy multiplayer websocket netcode لعبه العاب تصادم فيزياء مسار ذكاء اصطناعي اعداء توليد اجرائي كهف زنزانه قتال توازن تقدم اقتصاد متعدد لاعبين

## Collision
- **AABB vs AABB**: `a.x < b.x+b.w && a.x+a.w > b.x && a.y < b.y+b.h && a.y+a.h > b.y`. Circle–circle: distance² < (r1+r2)².
- **Tile maps (platformers)**: move on X, resolve against solid tiles, then move on Y and resolve (separate axes avoids corner snagging). Check only the tiles the box overlaps (`floor(x/T)…floor((x+w)/T)`).
- **Tunnelling** (fast bullets): swept test (ray vs box) or sub-step movement (`steps = ceil(speed*dt / (size/2))`).
- **Spatial hash** for many entities: `key = (x/CELL|0) + ',' + (y/CELL|0)`; insert each entity in the cells it overlaps; query neighbours only. CELL ≈ 2× average entity size. Rebuild per frame (cheap).
- Rotated/convex shapes → SAT (separating axis theorem); use a library (matter-js, planck.js, rapier) for real physics, not for simple platformers.

## Pathfinding
Grid A* (4/8-dir, binary heap open list, closed set, heuristic = Manhattan/octile):
```js
function astar(grid, s, g) { const open = new MinHeap((n) => n.f), key = (x, y) => y * W + x, best = new Map([[key(s.x, s.y), 0]]);
  open.push({ x: s.x, y: s.y, g: 0, f: h(s, g), p: null });
  while (open.size) { const n = open.pop(); if (n.x === g.x && n.y === g.y) return unwind(n);
    for (const [dx, dy] of DIRS) { const x = n.x + dx, y = n.y + dy; if (!walkable(grid, x, y)) continue; const ng = n.g + (dx && dy ? 1.414 : 1);
      if (ng < (best.get(key(x, y)) ?? Infinity)) { best.set(key(x, y), ng); open.push({ x, y, g: ng, f: ng + h({ x, y }, g), p: n }); } } } return null; }
```
Many agents → one **flow field** (BFS/Dijkstra from the target; each cell stores the best direction). Navmesh for 3D. Smooth paths with string-pulling; re-path every 0.3–0.5 s, not every frame.

## Steering (organic movement)
seek, flee, arrive (slow near target), wander (random target on a circle ahead), pursue (aim at predicted position), separation/alignment/cohesion (boids), obstacle avoidance. Sum weighted forces, clamp to `maxSpeed`/`maxForce`.

## Decision-making
- **FSM**: `states = {idle:{enter,update,exit}, chase:…, attack:…}` + transitions by conditions; add a cooldown/hysteresis so they don't flicker.
- **Behavior tree** (selector/sequence/condition/action returning SUCCESS/FAILURE/RUNNING) when states multiply; **utility AI** (score each action 0..1 by curves, pick the best) for natural variety; **GOAP** for planning.
- Make enemies readable: telegraphs (wind-up flash), fair reaction windows (≥ 300 ms), one pattern at a time, variety through combination.

## Procedural generation
- **Noise**: value/simplex/Perlin; fractal sum (octaves 4–6, lacunarity 2, gain .5) → heightmaps, biomes (height × moisture), clouds. Seeded, so worlds are reproducible.
- **Caves**: random fill 45 %, 4–5 smoothing passes of cellular automata (wall if ≥ 5 wall neighbours), flood-fill to keep the largest region.
- **Dungeons**: BSP split + room per leaf + corridors between siblings; or random room placement + MST of room centres + a few extra loops; place keys/doors by graph distance from start.
- **Levels for platformers**: chunk templates stitched with guaranteed solvable jumps (max jump height/distance from CONFIG).
- **Wave Function Collapse** for tile coherence (tileset + adjacency rules; pick lowest-entropy cell; propagate constraints; restart on contradiction).
- **Loot/weighted random**: `pickWeighted([{id,w}])`; pity timers; rarity tiers with diminishing odds; deterministic seeds per run for fairness.

## Combat & stats
Damage = `max(1, atk * (100/(100+def)))` (never negative, diminishing returns); crits ×1.5–2; i-frames 0.5–1 s after being hit; knockback = impulse away from the hit; hit-stop 50–90 ms; status effects as timers on entities; clear damage numbers and enemy health bars.

## Progression & balance
Difficulty curve: teach (safe) → test → twist → master → rest; new mechanic per level then recombine. XP curve `need = base * level^1.5`. Economy: sinks must match faucets; one currency per purpose; log average earn/spend from a bot run to tune numbers. Spreadsheet the numbers in `config.js` and playtest with logged telemetry (death locations heatmap).

## Inventory/quests/dialogue as data
Items `{id,name,type,stack,stats,desc}`; recipes `{in:[[id,n]],out:[id,n]}`; quests `{id,steps:[{type:'kill',target,n}],reward}` with an event-driven tracker; dialogue graphs `{id,speaker,text,choices:[{label,goto,if,set}]}` (see storytelling → interactive narrative).

## Multiplayer basics
Pick the model first: **turn-based** (HTTP/WebSocket, server validates moves) · **real-time authoritative server** (clients send inputs, server simulates at 20–30 Hz, clients interpolate remote entities 100 ms behind and predict/reconcile their own) · **lockstep** (deterministic sim, send inputs only; needs fixed-point/seeded RNG) · **P2P WebRTC** for small co-op. Node + `ws`/Socket.IO for rooms; never trust the client (validate speed, cooldowns, damage); send deltas not full state; sequence numbers on inputs; handle disconnect/reconnect; lag-compensate hit detection on the server.
