# Game development (browser, 2D and 3D)
tags: game canvas three.js phaser loop physics sprite collision webgl 3d 2d animation input لعبه العاب متصفح حلقه اللعبه فيزياء تصادم

Core loop (fixed-timestep update, interpolated render):
```js
let last = performance.now(), acc = 0; const STEP = 1000 / 60;
function frame(now) { acc += Math.min(now - last, 100); last = now; while (acc >= STEP) { update(STEP / 1000); acc -= STEP; } render(acc / STEP); requestAnimationFrame(frame); }
requestAnimationFrame(frame);
```
Never tie game speed to frame rate — screens run at 60 to 360 Hz; multiply motion by dt or use the fixed step above.

Structure: game state object (entities array or ECS), systems (input → physics → AI → collisions → cleanup), scene/state machine (menu, playing, paused, game over), asset loader with a loading screen, input map (keyboard + pointer + gamepad; store key state on keydown/keyup and read it in update).

Canvas 2D: size the backing store for devicePixelRatio (`canvas.width = cssW * dpr; ctx.scale(dpr, dpr)`), `imageSmoothingEnabled = false` for pixel art, draw order = z order, sprite sheets with `drawImage(img, sx, sy, sw, sh, dx, dy, dw, dh)`, camera = translate by −camera position, object pooling for bullets/particles.

Collision: AABB (`a.x < b.x + b.w && …`), circle (distance² < (r1+r2)²), tilemaps (resolve axis by axis), spatial hash or quadtree when entities > a few hundred. Physics libraries: matter-js (2D), rapier or cannon-es (3D).

Phaser 3: `new Phaser.Game({ type: Phaser.AUTO, width, height, physics: { default: "arcade" }, scene: { preload, create, update } })` — arcade physics, tilemaps, tweens, input and audio built in.

Three.js: scene + PerspectiveCamera + WebGLRenderer (`setPixelRatio(Math.min(devicePixelRatio, 2))`, `setAnimationLoop`), lights (ambient + directional with shadows), `MeshStandardMaterial`, GLTFLoader for models, OrbitControls / PointerLockControls, resize handler updating `camera.aspect` and `renderer.setSize`. Import via importmap from a CDN for no-build projects. Performance: instancing (`InstancedMesh`), merged geometries, frustum culling, texture atlases, dispose what you remove.

Feel ("juice"): easing, screen shake, hit-stop, particles, sound on every action (Web Audio / howler; unlock audio on first input), coyote time and input buffering for platformers.

Save games in localStorage/IndexedDB; pause on `visibilitychange`.
