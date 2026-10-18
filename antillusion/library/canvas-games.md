# 2D canvas game recipes
tags: canvas 2d game sprite animation collision particles snake tetris pong shooter arcade لعبه العاب ثنائيه ابعاد كانفاس ثعبان تيتريس رسم حركه تصادم

Starter for platformers: `use_template("platformer-2d")`. For other genres, this skeleton:
```js
const cv = document.querySelector("canvas"), g = cv.getContext("2d");
function fit() { const dpr = Math.min(devicePixelRatio, 2); cv.width = innerWidth * dpr; cv.height = innerHeight * dpr; g.setTransform(dpr, 0, 0, dpr, 0, 0); }
addEventListener("resize", fit); fit();
const keys = new Set(); addEventListener("keydown", (e) => keys.add(e.code)); addEventListener("keyup", (e) => keys.delete(e.code));
let last = performance.now(), acc = 0; const STEP = 1 / 120;
function frame(now) { acc += Math.min((now - last) / 1000, .1); last = now; while (acc >= STEP) { update(STEP); acc -= STEP; } draw(); requestAnimationFrame(frame); }
requestAnimationFrame(frame);
```
State machine: `state = "menu" | "play" | "pause" | "over"`; `update` and `draw` switch on it. Keep all game data in one object so restart = recreate it.

Patterns:
- Grid games (snake, tetris, 2048, minesweeper, match-3): logic on integer cells, tick every N ms independent of frame rate; draw cells scaled to the canvas; input buffered to one move per tick.
- Top-down / shooter: entities `{x,y,vx,vy,r}`; circle collision `dx*dx+dy*dy < (r1+r2)**2`; object pool for bullets; spawn waves from a timeline; screen wrap or clamp.
- Sprites: `g.drawImage(img, frame*w, row*h, w, h, x, y, w, h)`; flip with `g.scale(-1, 1)`; `g.imageSmoothingEnabled = false` for pixel art.
- Camera: `g.save(); g.translate(-cam.x, -cam.y); …world…; g.restore();` then HUD. Smooth follow `cam.x += (target - cam.x) * (1 - Math.exp(-8 * dt))`.
- Particles: array of `{x,y,vx,vy,life}`; update and filter; draw as small rects with alpha = life.
- Juice: screen shake (random camera offset decaying), hit-stop (skip updates for 60 ms), squash & stretch on land, easing (`t*t*(3-2*t)`), flash on hit.
- Audio without files: `const ac = new AudioContext(); function beep(f, d = .08) { const o = ac.createOscillator(), a = ac.createGain(); o.frequency.value = f; a.gain.setValueAtTime(.15, ac.currentTime); a.gain.exponentialRampToValueAtTime(.001, ac.currentTime + d); o.connect(a).connect(ac.destination); o.start(); o.stop(ac.currentTime + d); }` — create/resume the context on the first key/click.
- Touch: `pointerdown/move/up` cover mouse and touch; add on-screen buttons for mobile; `touch-action: none` on the canvas.
- Save: `localStorage.setItem("save", JSON.stringify(data))`; high scores sorted and sliced to 10.
- Pause on `visibilitychange` so the simulation does not jump after tab switch.

Expose `window.game = {...}` so you can verify state from preview_read (e.g. score changes after a synthetic key event: `dispatchEvent(new KeyboardEvent("keydown", { code: "ArrowRight" }))`).
