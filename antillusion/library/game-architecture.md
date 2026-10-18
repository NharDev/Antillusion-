# Game architecture: loop, states, entities, input, assets, save, structure
tags: game architecture loop state machine ecs entity component input gamepad touch scene asset audio save load pool event bus config structure phaser canvas three.js godot unity لعبه العاب معماريه حلقه حاله مشهد كيان مكونات ادخال تحكم حفظ تحميل اصول صوت

## Project layout (browser game, no build)
```
index.html  style.css
src/ main.js (boot) · config.js (all tunables) · loop.js · input.js · audio.js · assets.js · state.js (scene machine)
     entities/ player.js enemy.js bullet.js · systems/ physics.js ai.js render.js · scenes/ menu.js play.js gameover.js
     levels/ level1.json …  ui/ hud.js
```
Keep every tunable (speeds, gravity, timers, colours) in `config.js`; gameplay code has no magic numbers.

## Loop
Fixed update (60 Hz) + variable render with interpolation (see the games playbook). Clamp frame delta (≤ 100 ms) so a background tab doesn't explode physics. Pause on `visibilitychange`.

## Scene / state machine
```js
const scenes = { menu, play, pause, gameover }; let cur = menu;
function go(name, data) { cur.exit?.(); cur = scenes[name]; cur.enter?.(data); }
// each scene: { enter(data), exit(), update(dt), render(ctx), input(ev) }
```
Overlay scenes (pause, dialogue) keep the world scene alive but stop its `update`.

## Entities
- Small games: array of plain objects per kind + one function per system (`updateEnemies`, `drawEnemies`). Remove dead entities by swap-pop or filter at end of frame, never inside the loop that iterates.
- Many entity types/behaviours → tiny ECS: `world = { entities: Map<id, {pos?, vel?, sprite?, ai?, hp?}> }` and systems that query by component presence (`for (const e of world.with("pos","vel"))`). Components are data only; systems own behaviour.
- Pool frequently spawned things (bullets, particles): preallocate N, mark `active`, reuse. No allocations (`{}`/`[]`/closures) in the per-frame hot path.

## Input abstraction
Map devices to **actions**, not keys: `actions = {left,right,jump,fire,pause}` with `held`, `pressed` (this frame), `released`. Sources: keyboard (`e.code`, preventDefault for arrows/space), gamepad (`navigator.getGamepads()` polled each frame, deadzone .2), touch (on-screen buttons via pointer events, multi-touch). Buffer presses for ~120 ms (jump buffer). Rebindable keys stored in localStorage.

## Assets & audio
Preload with a promise list and a progress bar; images via `new Image()` + `decode()`, JSON via fetch, audio via `decodeAudioData`. No asset files? Draw with shapes/pixel arrays and synthesize sound with WebAudio (oscillator + envelope + filter; noise for explosions). Audio starts on the first user gesture (`resume()`); master gain + mute toggle; limit simultaneous voices.

## Events & decoupling
Tiny event bus (`bus.on('enemy:died', fn)`, `bus.emit`) for score, achievements, sfx, particles so systems don't know each other. Keep the bus synchronous and small.

## Time utilities
Timers/cooldowns as numbers decremented by dt (`this.cd -= dt`), tweens `{from,to,dur,ease}` in a manager, coroutines via generators for scripted sequences (`function*(){ yield wait(1); … }`).

## Save/load
`localStorage.setItem('save', JSON.stringify({v:2, level, coins, best}))`, versioned with a migrate function; try/catch around parse; autosave at checkpoints; "reset progress" option. Never store derived/transient state.

## Randomness
Seeded RNG (mulberry32) for levels/replays/daily challenges; separate streams for gameplay vs cosmetics (particles) so replays stay deterministic.

## Camera & rendering
Camera = target + lerp smoothing (`cam += (target-cam)*(1-Math.exp(-k*dt))`), lookahead in movement direction, clamp to level bounds, shake as additive offset. Canvas: render at logical resolution and scale (`ctx.imageSmoothingEnabled=false` for pixel art; integer scale), handle `devicePixelRatio`, draw only visible tiles, cache static layers to an offscreen canvas.

## UI/HUD
DOM overlays for menus/HUD (accessible, easy text, RTL) over a canvas; or canvas text for in-world labels. Always: pause menu, restart, mute, controls hint, fullscreen.

## Debugging & testing
`?debug=1` overlay (fps, entities, hitboxes, state). Keep simulation separate from rendering so you can run `update` headlessly in tests (e.g., "player falls into pit → lives 2→1"). Log state transitions. Playtest with someone who has not seen it.

## Performance budget
60 fps = 16 ms/frame. Typical wins: pooling, spatial hash for collisions (see game-systems), batch draw calls, avoid `ctx.shadowBlur` on many sprites, offscreen cache for static background, `requestAnimationFrame` only, no layout reads in the loop, `performance.now()` for timing.

## Shipping
Web: zip with `index.html` → itch.io HTML5, GitHub Pages, Netlify. Desktop: Electron/Tauri; mobile: Capacitor. Add a favicon, title, loading screen, and a README with controls.
