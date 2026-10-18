# Voxel / Minecraft-like games: architecture and extension recipes
tags: minecraft voxel block blocks chunk three.js 3d sandbox mine craft cube terrain ماينكرافت ماين كرافت مكعبات لعبه العاب ثلاثيه ابعاد عالم بناء تعدين

Start from the tested starter: `use_template("voxel-game")` (index.html + game.js, three.js from CDN, must be served over http). Then extend — do not rewrite the engine.

Architecture that scales:
- World = Map of chunks (16×16×H `Uint8Array`, index `(y*16+z)*16+x`), block id 0 = air. Generate from deterministic noise so the world is infinite and reproducible from a seed.
- One mesh per chunk containing only faces whose neighbour is air (face culling); rebuild a chunk (and the touching neighbour when the edit is on a border) after `setBlock`. Budget rebuilds per frame (2–4) and sort by distance.
- Vertex colours × per-face shade (top 1.0, sides 0.65–0.9, bottom 0.5) gives the look without textures or lights and is the fastest path. `MeshBasicMaterial({ vertexColors: true })`.
- Player = AABB (0.6 × 1.8), feet position; move one axis at a time and undo on collision; clamp dt ≤ 0.05 and fall speed so it never tunnels.
- Picking = march the camera ray in 0.02 steps up to reach 6, remember the last empty cell → break the hit cell, place in the previous cell (reject if it intersects the player).

Recipes (where to change in game.js):
- New block type: add `{ name, color }` (or top/side/bottom) to `BLOCKS`, put its id in `HOTBAR`.
- Textures instead of colours: build a canvas atlas (16 px tiles, `NearestFilter`, `colorSpace = SRGBColorSpace`), add a `uv` attribute per face (tile column/row ÷ atlas size), use `MeshBasicMaterial({ map })`.
- Water / glass: a second mesh per chunk with `transparent: true, opacity: .7, depthWrite: false`; in the solid mesh treat transparent neighbours as air; make water non-colliding and slow the player inside it.
- Day/night: lerp `scene.background`/fog colour and multiply face shades by a `uniform`-like global brightness (rebuild not needed if you use `material.color`).
- Ambient occlusion (the Minecraft corner shading): per vertex count the 3 neighbouring blocks around the corner → shade 1.0/0.8/0.6/0.45; flip the quad diagonal when `ao[0]+ao[2] < ao[1]+ao[3]`.
- Caves: 3D noise threshold in `generate()` (`noise3(x/18,y/14,z/18) > 0.62` → air) below the surface. Ores: hash-based sprinkle inside stone by depth.
- Saving: keep `edits = new Map("x,y,z" → id)` updated in `setBlock`, apply after `generate()`, persist with `localStorage` (debounced) or IndexedDB for big worlds.
- Inventory & crafting: counts per block id; decrement on place, increment on break; crafting = table of `{ in: {id:n}, out: id }`.
- Mobs: entities with the same AABB physics; simple AI = wander, face the player within 12 blocks, jump when blocked.
- Mobile: virtual joystick (touchstart/touchmove on left half), look by dragging the right half, buttons for jump/break/place; no pointer lock.
- Performance: greedy meshing (merge coplanar same-colour faces) cuts triangles ~5×; build geometry in a Web Worker and transfer the typed arrays; lower `VIEW` and cap `devicePixelRatio` at 2; reuse arrays instead of allocating per frame.
- Multiplayer: WebSocket server holds the edit map and relays `{type:"set",x,y,z,id}` and player transforms at 10–15 Hz; clients interpolate others.

Verify in the preview: `preview_read` with js `({ chunks: game.chunks.size, y: game.player.pos.y, ground: game.player.onGround })` and check there are no console errors. Pointer lock needs a real click, so test movement by setting `game.player.pos`/`yaw` from js.
