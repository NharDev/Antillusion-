# Animation principles for code: the 12 principles with numbers, cycles, acting, game animation and procedural motion
tags: animation animator 12 principles squash stretch anticipation follow through overlap spring easing cubic bezier timing spacing arcs walk cycle run cycle jump idle breathing blink lip sync visemes acting state machine blend tree root motion inverse kinematics ik ragdoll procedural sprite sheet spine rive lottie aseprite blender nla animationmixer crossfade animationtree mecanim animation blueprint تحريك انيميشن رسوم متحركه مبادئ التحريك مشي جري قفز تنفس رمش مزامنه الشفاه حركه شخصيه نوابض توقيت

Animate like a pro: **pose → timing → spacing → arcs → overlap → polish**. Block key poses first (storytelling poses), time them, then breakdowns, then easing. Never animate everything linearly at once.

## 1. The 12 principles, in numbers
| Principle | Code recipe |
|---|---|
| Squash & stretch | preserve volume: `sy = s; sx = 1/sqrt(s)` (3D) or `sx = 1/s` (2D area) so `sx·sy ≈ 1`. Landing squash s≈0.75–0.85, launch stretch s≈1.15–1.3; stretch along velocity: rotate to `atan2(vy,vx)` and `s = 1 + k·|v|`, k tuned so max ≈1.3 |
| Anticipation | 15–25 % of the action's duration in the opposite direction, 5–15 % of its amplitude (wind-up before a punch, crouch before a jump) |
| Staging | one idea per moment: clear silhouette, contrast focal element, stop other motion while the key action plays |
| Straight-ahead vs pose-to-pose | code = pose-to-pose keyframes + procedural straight-ahead layers (particles, hair, cloth) |
| Follow-through & overlap | parts settle after the root stops: delay children 2–4 frames (@24 fps) each, or drive them with damped springs (below); overshoot 5–15 % then settle |
| Slow in / slow out | ease in/out for natural moves; ease-out for entering things, ease-in for leaving/falling |
| Arcs | move limbs/heads along arcs: rotate around pivots rather than tweening x/y linearly; for x/y paths add a perpendicular sine bump or use quadratic béziers |
| Secondary action | blink, tail, hair, breathing, a hand adjusting a hat — support, never compete with, the primary action |
| Timing | number of frames = weight and mood: heavy = slower start and harder stop; light = quick and floaty |
| Exaggeration | push poses/curves 20–50 % beyond reality, consistently with the style |
| Solid drawing | think in volumes: rotate in 3D (scaleX ±cos for turning flat parts, parallax inner features, overlap on turn) |
| Appeal | clear readable poses, asymmetry, variation in rhythm (not every beat the same length) |

### Damped spring (follow-through, overshoot, UI)
```js
// semi-implicit Euler, stable for typical values; dt in seconds
function spring(s, target, dt, k = 170, c = 26, m = 1){
  const a = (-k * (s.x - target) - c * s.v) / m;
  s.v += a * dt; s.x += s.v * dt; return s.x;
}
// critical damping c = 2*sqrt(k*m). zeta = c / (2*sqrt(k*m)):
// zeta 1 = no overshoot, 0.5–0.7 = 1 visible overshoot (snappy UI), 0.2–0.4 = wobbly (jelly, antennae)
```
Typical: UI snap k 300–500, ζ 0.7–0.9; character secondary (ears, hair) k 60–150, ζ 0.3–0.5; camera k 50–120, ζ 1. For frame-independence, sub-step when dt > 1/60.

## 2. Timing tables
| Action | fps 12 | fps 24 | fps 30 | fps 60 | seconds |
|---|---|---|---|---|---|
| blink | 1–2 | 3–4 | 3–5 | 6–9 | 0.10–0.15 |
| fast head turn | 3 | 6 | 8 | 15 | 0.25 |
| punch (strike part) | 1–2 | 2–4 | 3–5 | 5–8 | 0.08–0.15 |
| walk step (normal) | 6 | 12 | 15 | 30 | 0.5 |
| run step | 4 | 8 | 10 | 20 | 0.33 |
| jump (full) | 10–14 | 20–28 | 25–35 | 50–70 | 0.8–1.2 |
| hold to read a pose | 4–6 | 8–12 | 10–15 | 20–30 | 0.33–0.5 |
- **On twos**: hold each drawing 2 frames at 24 fps (12 unique/s) — standard for 2D; ones for fast action. Stepped sprites at 8–12 fps feel crafted; code-driven rigs at 60 fps feel smooth (mix: rig at 60, hand-drawn effects on twos).
- **Spacing chart**: the distance between successive positions. Even = linear (robotic); clustering near a key = ease into it. "Slow in/out ×3" means thirds of the remaining gap: 1/2, 1/4, 1/8… spacing toward the key.

### Easing curves
| Name | cubic-bezier | Use |
|---|---|---|
| standard | (.2, 0, 0, 1) | most UI movement |
| decelerate / ease-out | (0, 0, .2, 1) | entering, landing in place |
| accelerate / ease-in | (.4, 0, 1, 1) | exiting, falling |
| ease-in-out sine | (.37, 0, .63, 1) | loops, breathing, pendulums |
| expo out | (.16, 1, .3, 1) | dramatic fast reveal |
| back / overshoot | (.34, 1.56, .64, 1) | pop-in, ~10 % overshoot |
| anticipate (back in) | (.36, 0, .66, -.56) | wind-up before leaving |
```js
const easeOutBack = (t, s = 1.70158) => 1 + (s + 1) * (t - 1) ** 3 + s * (t - 1) ** 2;   // s=1.70158 ≈ 10% overshoot
const easeOutElastic = t => t === 0 || t === 1 ? t
  : Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * (2 * Math.PI) / 3) + 1;
```

## 3. Walk cycle
Key poses per step: **contact** (heel strikes, legs widest, arms widest) → **down** (weight lands, knee bends, body lowest) → **passing** (free leg passes the support leg, body mid) → **up** (pushing off the toe, body highest) → next contact.
| Pose | 8-frame step | 12-frame step | hip height | notes |
|---|---|---|---|---|
| contact | 1 | 1 | mid | front heel down, toe up; back foot on toe |
| down | 2–3 | 3 | lowest (−3 to −6 % of leg length) | front knee bends, foot flat; arms past widest |
| passing | 4–5 | 6–7 | mid | free foot lifted, passes ankle; arms at sides |
| up | 6–7 | 9–10 | highest (+2 to +4 %) | support leg straight, heel lifts; body pitches forward |
| contact (other leg) | 9 | 13 | mid | mirror of frame 1 |
- One cycle = 2 steps (16 or 24 frames @24 fps). Hip bob = 2 per cycle; hip also shifts sideways over the support foot (1 per cycle) and tilts (free side drops 3–6°).
- **Counter-rotation**: shoulders rotate opposite to hips (±5–15° around the spine), arms swing **opposite** to legs, peak arm swing just after contact, elbows bend more on the back swing.
- **Foot roll**: heel strike → foot flat (down) → heel lifts (up) → toe off; the planted foot must not slide (lock it in world space or use IK).
- Head stabilises: counter some of the bob; overlap hands and head by 1–2 frames. Personality via stride length, bob amount, arm swing and timing (sad: short steps, low bob, head down; proud: chest up, long strides).
- **Sneak**: exaggerated long, slow steps (16–24 frames/step), high knees, toe-first contacts, body low and leaning, arms raised. **Tiptoe**: on toes, bouncy, short.

## 4. Run cycle
- **Flight phase**: neither foot touches; **no double-contact** (unlike walk). Poses: contact → down (deep compress) → push-off → flight (highest, legs split) → contact.
- Lean forward 10–20° (more = faster), arms bent ~90°, pumping forward/back (not across), bigger bob, foot lands under the body.
- 8 frames/step @24 fps normal run (16-frame cycle), 6 for sprint, 4 for cartoon zoom with smears/streaks.

## 5. Jump
| Phase | Duration | Notes |
|---|---|---|
| anticipation crouch | 4–8 frames @24 | squash 0.8, arms back |
| takeoff | 1–2 | stretch 1.2–1.3 along velocity, arms up |
| rise | ballistic, ease-out | legs tuck |
| apex hang | 2–4 frames slower spacing | the "hang time" sells weight/air |
| fall | ease-in, accelerating | stretch slightly, legs reach down |
| landing squash | 2–4 | squash 0.7–0.85, knees bend, arms overshoot down |
| recover | 4–8 | overshoot up to ~1.05 then settle; secondary parts settle last |
Physics in code: keep the arc parabolic; tie squash to impact speed.

## 6. Combat / attack frame data (60 fps)
| Attack | Startup | Active | Recovery | Hit-stop |
|---|---|---|---|---|
| light | 3–6 | 2–4 | 8–14 | 3–5 frames (50–80 ms) |
| heavy | 10–20 | 3–6 | 18–30 | 6–10 (100–170 ms) |
| special | 8–15 | 4–12 | 20–40 | 6–12 |
Startup = anticipation (readable telegraph for enemies ≥ 400 ms), active = smear frame + hitbox on, recovery = follow-through (vulnerable). **Cancel windows**: allow chaining into the next attack in the last ⅓ of recovery or on hit. Hit-stop freezes both attacker and victim; add victim knockback, flash, shake (see `game-feel`).

## 7. Idle, blinks, head turns, lip-sync
- **Breathing**: chest/shoulders scaleY 1→1.02 (or translateY 1–2 px), period **2–4 s** (calm ~3.5 s, tired/scared 1–1.5 s), ease-in-out sine, head following with 0.1–0.2 s delay. Add a weight shift every 4–8 s; avoid perfect loops — layer 2–3 sines with non-integer period ratios.
- **Blinks**: every **2–6 s** (random), **100–150 ms** (close 2 frames, hold 1, open 3 @24), ~20 % chance of a double blink; lids close a bit faster than they open; blink on head turns and on emotional changes.
- **Head turn**: eyes lead (move 2–4 frames before the head), blink mid-turn, head moves on a slight downward arc (dip ~5° in the middle), overshoot 3–5° and settle; body follows last.
- **Lip-sync** (Preston Blair set → viseme):
| Shape | Sounds | Mouth |
|---|---|---|
| A / I | ah, ay, i | wide open, jaw down |
| E | eh, ee | open, stretched sideways, teeth visible |
| O | oh | round open |
| U | oo, w (narrow) | small round, lips forward |
| consonants (C,D,G,K,N,R,S,T,Y,Z) | most consonants | slightly open, teeth close |
| M / B / P | m, b, p | lips closed (hold ≥ 1 frame before the release) |
| F / V | f, v | lower lip under top teeth |
| L / Th | l, th | tongue up behind teeth, mouth open |
| W / Q | w, q | puckered, smaller than U |
| rest | silence | relaxed closed |
  Rules: animate to the sounds, not the letters; mouth shapes **1–2 frames before** the audio; drop shapes faster than 2 frames apart; accent vowels with jaw and head; closed shapes (M/B/P) must hit.
- **Acting**: thought → action (eyes and brows change first, then head, then body); key storytelling poses held 8–24 frames; **moving holds** (drift 1–3 % during the hold) so characters never freeze dead; contrast big and small, fast and slow.

## 8. Game animation systems
- **State machine**: Idle, Locomotion, Jump(Start/Loop/Land), Attack(1/2/3), Hit, Death; transitions with conditions + blend times 0.1–0.25 s (0 for hits/attacks that must be immediate), exit-time rules for one-shots.
- **Blend spaces/trees**: 1D speed: idle (0) → walk (1.4 m/s) → run (4–6 m/s); sync phases (matching foot contacts, normalised time). 2D directional for strafing (forward/back/left/right at each speed).
- **Root motion** (animation moves the character: precise for attacks/climbs) vs **in-place** (code moves, animation plays: responsive for player locomotion). Match playback speed to ground speed to prevent foot sliding: `rate = speed / clipSpeed`.
- **Layering**: base locomotion + upper-body override (masked bones) + **additive** (breathing, recoil, lean = pose − reference pose).
- **Foot IK & look-at**: raycast down from each foot, move foot target to ground, rotate to normal, lower hips by the largest offset; look-at with clamped angles (head ±70° yaw, ±40° pitch), distributed over spine 20 % / neck 30 % / head 50 %.
```js
// analytic 2-bone IK in 2D: root at (0,0), bone lengths a (upper), b (lower), target (tx,ty)
function ik2(a, b, tx, ty, bendSign = 1){
  const d = Math.min(Math.hypot(tx, ty), a + b - 1e-6);
  const cosElbow = (a*a + b*b - d*d) / (2*a*b);                 // law of cosines
  const elbow = Math.PI - Math.acos(Math.max(-1, Math.min(1, cosElbow)));   // 0 = straight
  const cosA = (a*a + d*d - b*b) / (2*a*d);
  const shoulder = Math.atan2(ty, tx) - bendSign * Math.acos(Math.max(-1, Math.min(1, cosA)));
  return { shoulder, elbow: bendSign * elbow };                  // upper rotation, lower relative rotation
}
```
- **Procedural**: springs for antennas/tails (chain of springs, each following the previous), noise (`simplex(t*0.5)`) for idle sway and camera handheld (amplitude 0.5–2°), CCD/FABRIK IK for tentacles and spider legs (step a foot when it is > threshold from its rest target, ease along an arc in 0.1–0.2 s, alternate diagonal legs), verlet ropes/cloth, **ragdoll** = physics bodies per bone + joint limits, blend from animation to ragdoll on death (and back with "get-up" animations).

## 9. Assets and tools
- **Sprite sheets & atlases**: pack frames with padding 1–2 px + extrusion to avoid bleeding; store pivot per frame; power-of-two textures for older GPUs; metadata JSON (frame rect, duration). Aseprite exports sheet + JSON with tags per clip.
- **Spine / DragonBones**: 2D skeletal, meshes + weights, runtimes for web/engines. **Rive**: interactive vector + state machines in-runtime. **Lottie**: After Effects → JSON for UI/vector motion. **Blender**: actions in the NLA, export glTF.
- **three.js**: `mixer.clipAction(clip)`, `a.crossFadeTo(b, 0.25, true)` (call `b.reset().play()` first), `action.setLoop(THREE.LoopOnce)` + `clampWhenFinished = true` for one-shots, `mixer.addEventListener('finished', …)`, `THREE.AnimationUtils.makeClipAdditive` for additive layers, `setEffectiveTimeScale` for speed matching.
- **Godot 4**: `AnimationTree` with `AnimationNodeStateMachine` + `BlendSpace1D/2D`; `travel("Run")` on the playback; `SkeletonIK3D`/`LookAtModifier3D` for IK.
- **Unity**: Animator Controller (Mecanim) states, transitions, parameters, Blend Trees, Avatar Masks for layers, Animation Rigging package (Two Bone IK, Multi-Aim).
- **Unreal 5**: Animation Blueprint (AnimGraph state machines, Blend Spaces, Layered blend per bone), Control Rig, IK Rig, Motion Matching.

## 10. UI / motion design durations
Micro (hover, press) 80–150 ms · small components 150–250 ms · panels/modals 250–400 ms · page transitions 300–500 ms · hero choreography ≤ 1.2 s total, stagger 30–60 ms per item (cap total stagger at ~300 ms) · logo stings 1–3 s. Exits faster than enters; animate opacity + transform; respect `prefers-reduced-motion`.

## 11. Polish checklist
- [ ] Every action has anticipation → action → follow-through
- [ ] No linear tweens on characters; arcs on limbs and heads
- [ ] Feet never slide; contacts readable
- [ ] Overlapping parts settle at different times
- [ ] Holds are moving holds; idle never perfectly loops in < 6 s
- [ ] Transitions blend (no pops) except where snap is intended
- [ ] Frame-rate independent (dt-based), tested at 30/60/144 Hz
