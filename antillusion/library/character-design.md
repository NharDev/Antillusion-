# Character design: shape language, proportions, colour, expression, and building characters in code (2D, pixel, 3D)
tags: character design mascot hero avatar shape language silhouette proportions head heights anatomy gesture line of action pose expression sheet turnaround palette skin cel shading rig bones svg canvas pixel art sprite 3d model retopology rigging weight painting mixamo ready player me vroid gltf blender three.js godot unity unreal شخصيه شخصيات تصميم شخصيه رسم كرتون ماسكوت بطل نسب تعبيرات وجه ملامح الوان بكسل ارت نموذج ثلاثي تحريك عظام هيكل

Shortcuts: `use_template("character-2d")` is a rigged vector character with clips (idle/walk/run/jump/wave/attack), expressions and lip-sync shapes; `use_template("character-3d")` is a three.js skinned stylised character with a real skeleton, toon/PBR materials and animation clips with cross-fades, plus a GLTF loader path. Start from them and redesign; never ship stick figures or rectangle people.

## 1. Design brief for a character
Write 5 lines first: role (hero, mascot, enemy, guide), personality in 3 words, world/genre, age/body type, one **signature feature** (hat, scarf, tail, hair shape, prop) that reads at thumbnail size. Everything visual should answer the brief.

## 2. Shape language and silhouette
| Base shape | Reads as | Use for |
|---|---|---|
| Circle / soft curves | friendly, safe, young, cuddly | mascots, sidekicks, kids |
| Square / rectangle | stable, strong, reliable, stubborn | tanks, guardians, dads, robots |
| Triangle / sharp points | dynamic, dangerous, clever, sneaky | villains, rogues, fast heroes |
Combine: a dominant shape + a secondary (a round body with sharp eyebrows = friendly but feisty). Vary **size** (big/medium/small masses, never equal), **straight vs curve** (straights against curves give structure), and **rhythm**.
**Silhouette test**: fill the character solid black at 64 px tall. You should identify who it is and roughly what they feel. Fix by pushing the signature feature, separating limbs from torso (negative space), and making the pose asymmetric.

## 3. Proportions (in head heights)
| Style | Heads tall | Notes |
|---|---|---|
| Chibi / super-deformed | 2–3 | head ≈ body; huge eyes low on face, tiny hands/feet |
| Cartoon | 3–5 | big head, simplified torso, 3–4 fingers OK |
| Stylised (animation/games) | 6–7 | believable, exaggerated features |
| Realistic adult | 7.5 | standard figure |
| Heroic / fashion | 8–9 | longer legs, smaller head, broad shoulders (heroic) |
Landmarks (realistic, scale with style):
- Eye line ≈ **half the head height**; nose ≈ halfway brow→chin; mouth ⅓ nose→chin; ears from brow to nose base.
- Shoulders ≈ 2 head widths (male, 2–2.3 heroic) / ~1.75 (female); hips ≈ 1.5 (male) / ~2 (female) head widths at the widest.
- (8-head figure) head 2 = nipples, head 3 = navel, head 4 = crotch (≈ middle of the body at 8 heads).
- **Elbows at the waist**, **wrists at the crotch**, fingertips mid-thigh; **knees mid-leg** (halfway hip→heel).
- Hand ≈ face length; foot ≈ head length.
Children: bigger head ratio (4–6 heads), eyes below the midline, shorter limbs.

## 4. Pose, gesture, appeal
- **Line of action**: one C or S curve through the whole body; the spine, then limbs, follow it. Straight vertical = stiff.
- **Gesture before detail**: block the pose with 3 masses (head, ribcage, pelvis) tilted against each other (contrapposto: shoulders tilt opposite to hips; weight leg under the head).
- Avoid **twinning** (both arms/legs mirrored). Overlap forms for depth; vary angles.
- **Exaggeration**: push the main idea 20–30 % beyond real (bigger chin for hero, lankier for nerd) — consistently.
- **Appeal** = clarity + simplicity + charm: big/small contrast, readable face, clean shapes, a pleasing silhouette from the main camera angle.

## 5. Colour
- **Value first**: design in greyscale with 3–4 values; the face/key area gets the strongest contrast. Then colour.
- Limited palette: 1 dominant, 1–2 secondary, 1 accent (small, near the face or signature item). 3–5 hues + skin/hair. Keep saturation hierarchy: the most saturated colour at the focal point.
- **3-value shading**: base, shadow, highlight (+ optional rim). Shadows **shift hue**, don't just darken: skin shadow toward red/magenta (subsurface) and cooler/bluer under cool ambient; highlights warmer (toward yellow) and slightly desaturated.
| Skin example | Highlight | Base | Shadow | Deep shadow |
|---|---|---|---|---|
| light | `#FCE3D2` | `#F2C2A6` | `#D98E7A` | `#A85E5A` |
| medium | `#E8B48C` | `#C68B5E` | `#9C5E42` | `#6E3B32` |
| deep | `#A8714E` | `#7A4B32` | `#57301F` | `#3A1E18` |
- Separate character from background by value and saturation; readable in team/faction colours if needed.

## 6. Costume, props, sheets
- Costume tells story: profession, wealth, climate, history (patches, wear on knees, a family pendant). Choose details that move (scarf, hair, coat tails) — free secondary animation.
- **Expression sheet** (6 base emotions):
| Emotion | Brows | Eyes | Mouth |
|---|---|---|---|
| Joy | raised, relaxed arch | lower lids push up (smile eyes) | corners up, open |
| Sadness | inner ends up (/\ shape) | upper lids droop, look down | corners down, small |
| Anger | inner ends down, pulled together (\/) | narrowed, glare | tight or squared, teeth |
| Fear | raised, pulled together, wavy | wide, whites visible, small pupils | open, stretched sideways |
| Surprise | high, round | wide open, pupils centred | open "O", jaw dropped |
| Disgust | lowered, one side | squinted | upper lip raised, asymmetric |
  Add neutral, smug, determined, tired. Asymmetry sells it.
- **Turnaround**: front, ¾, side, back (optionally ¾ back) aligned with horizontal guide lines at head top, eyes, chin, shoulders, waist, crotch, knees, feet.
- **Variations**: 6–12 thumbnails varying one axis at a time (proportions, shape, costume, palette); pick, then combine.

## 7. 2D characters in code (SVG / Canvas)
Structure: a **bone hierarchy** of groups; each part is a vector shape drawn around its own pivot.
```
root(hips) ─ torso ─ neck ─ head ─ (brows, eyes[lid,pupil], mouth)
          │        ├ upperArmL ─ forearmL ─ handL
          │        └ upperArmR ─ forearmR ─ handR
          ├ thighL ─ shinL ─ footL
          └ thighR ─ shinR ─ footR
```
```svg
<g id="upperArmR" transform="translate(30 -60) rotate(0)">   <!-- pivot = shoulder at 0,0; JS sets the angle -->
  <path d="M-7 0 C-8 14 -6 28 -4 40 L4 40 C6 28 8 14 7 0 C5 -5 -5 -5 -7 0Z" fill="var(--shirt)"/>
  <g id="forearmR" transform="translate(0 40)">                  <!-- pivot = elbow -->
    <path d="M-4.5 -3 C-5 10 -3.5 22 -3 32 L3 32 C3.5 22 5 10 4.5 -3Z" fill="var(--skin)"/>
  </g>
</g>
```
- Each part's local origin = its joint; set `transform="translate(jointX jointY) rotate(a)"` per frame (in JS: `el.setAttribute('transform', ...)` or canvas `save/translate/rotate/restore` down the tree).
- **Draw order**: far arm/leg → torso → near leg → head → near arm; swap order when turning. Keep `z` per part in data.
- **Joint overlap**: end each limb segment with a rounded cap that extends past the pivot (circle of the limb's width at the joint) so rotations never show seams.
- **Organic shapes with cubic béziers**: tapering limbs (wide at the joint, narrow mid-shin, flare at the ankle), muscle bulges with one control-point pair per side, smooth continuity (handles collinear across a node). 4–8 nodes per part, not 30.
- **Outline + cel shading**: draw the part filled, then a shadow shape clipped to it, then the outline.
```svg
<clipPath id="armClip"><use href="#armShape"/></clipPath>
<use href="#armShape" fill="#F2C2A6"/>
<ellipse cx="6" cy="20" rx="8" ry="30" fill="#D98E7A" clip-path="url(#armClip)"/>  <!-- shadow side -->
<use href="#armShape" fill="none" stroke="#3a2420" stroke-width="2.5" stroke-linejoin="round"/>
```
  Outline colour = darkest local hue, not black; vary width (thicker on the outside/shadow side and at overlaps, 1.5–3 px at 300 px tall).
- **Face rig**: eyes = white shape + iris/pupil (translate within clip for look direction) + upper lid shape (scaleY 0→1 for blinks) + optional lower lid; brows = path with 3 points or rotation+translateY; mouth = a set of path shapes swapped per viseme or morphed (same node count to interpolate `d`); add cheek squash on smile.
- Bake a few hand poses (open, fist, point, relaxed) as swappable shapes.

## 8. Pixel-art sprites
- Canvas: 16×16 (tiny, iconic), 32×32 (standard), 48×48 / 64×64 (detailed). Character ~⅔–¾ of the cell height; keep consistent pixel scale across the game; render with `image-rendering: pixelated` and integer scaling.
- Palette 8–32 colours total (DB32, PICO-8 16, Endesga 32 are good bases). Ramps of 3–5 shades with **hue shifting** (shadows toward blue/purple, highlights toward yellow) and rising saturation in the middle.
- **Selective outline (sel-out)**: outline darker than the fill where lit, lighter/colour-matched on the lit side, dark where it separates from background. Avoid single-pixel orphans and pillow shading (light from the centre).
- **Manual anti-aliasing**: intermediate colours on curve steps; lines in consistent step patterns (1-1-1, 2-2-2, 2-1-2 broken lines look jaggy).
- **Sub-pixel animation**: shift a colour value across pixels to suggest < 1 px motion (breathing, eye movement). Frames: idle 2–4, walk 6–8, run 6–8, attack 4–6.

## 9. 3D characters
Pipeline: **concept → blockout** (primitives for proportions, check in-game camera) → **sculpt or box-model** → **retopology** → **UVs** → **textures** → **rig** → **skin/weights** → **animate** → **export**.
- Retopology: quads, even density; **edge loops** around eyes, mouth (concentric for lip sync), and **3 loops at each deforming joint** (shoulder, elbow, wrist, knee, hip); pole placement away from joints; loops following muscle flow.
| Platform class | Hero triangles | Background NPC | Textures |
|---|---|---|---|
| Mobile / web | 3k–15k | 500–3k | 512–1024, 1–2 materials |
| Desktop indie / stylised | 10k–40k | 3k–10k | 1024–2048 |
| Console / PC AAA | 50k–150k+ | 10k–30k | 4k + LODs |
- **UVs**: minimal seams placed in hidden areas, consistent texel density (more on face), straighten shells, 2–8 px padding.
- **Textures**: PBR (baseColor, normal, ORM: occlusion/roughness/metallic) for realistic; hand-painted diffuse with baked lighting for stylised; **toon ramp** (2–3 bands via `MeshToonMaterial` gradientMap with `NearestFilter`) + inverted-hull outline (backface mesh scaled along normals by 1–3 %) for anime/cel look.
- **Rigging**: humanoid naming (`Hips > Spine > Spine1 > Spine2 > Neck > Head`, `LeftShoulder > LeftArm > LeftForeArm > LeftHand`, `LeftUpLeg > LeftLeg > LeftFoot > LeftToeBase` — Mixamo-compatible), T- or A-pose, bones at joint centres, ≤ 4 influences per vertex for real-time. Weight paint with smooth falloff across 2–3 edge loops; test extreme poses. IK for legs (foot planting) and arms when grabbing; FK for swinging arms/tails; pole targets for knees/elbows.
- **Ready-made sources**: Mixamo (auto-rig + animation library, free with Adobe account), Ready Player Me (avatars), VRoid Studio (anime, exports VRM), MakeHuman (CC0 realistic bases), Quaternius and Kenney (free CC0 low-poly rigged packs). Check licences; restyle materials so they match your art direction.
- **Blender → glTF**: apply scale/rotation (Ctrl+A), 1 unit = 1 m, glTF exporter converts to **+Y up**; character facing −Y in Blender (exports as +Z forward); each clip as an Action pushed to the NLA (or "export all actions"); export `.glb` with skinning + animations, Draco/meshopt compression for web; keep bone count ≤ ~65–100 for mobile.

## 10. Loading and using characters in engines
```js
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';
const gltf = await new GLTFLoader().loadAsync('hero.glb');
const hero = SkeletonUtils.clone(gltf.scene);       // clone skinned meshes correctly (scene.clone() breaks bones)
hero.traverse(o => { if (o.isMesh) { o.castShadow = true; o.frustumCulled = false; } });
const mixer = new THREE.AnimationMixer(hero);
const clips = Object.fromEntries(gltf.animations.map(c => [c.name, mixer.clipAction(c)]));
let current = clips.Idle; current.play();
function crossTo(name, t = 0.25){ const next = clips[name]; next.reset().play(); current.crossFadeTo(next, t, true); current = next; }
// per frame: mixer.update(dt)
```
- **Godot 4**: import `.glb`; use `Skeleton3D` + `AnimationPlayer`/`AnimationTree`; retarget with a `SkeletonProfileHumanoid` BoneMap in the import dialog to share animations.
- **Unity**: Rig → Animation Type **Humanoid** (Avatar auto-maps bones) → retarget any humanoid clip; Animator Controller for states.
- **Unreal 5**: import FBX/glTF skeletal mesh; IK Rig + IK Retargeter to map onto the Mannequin; Animation Blueprint for states.

## 11. Quality checklist
- [ ] Silhouette readable at 64 px; signature feature visible
- [ ] Proportions consistent across turnaround and every animation frame
- [ ] Value structure holds in greyscale; focal contrast on the face
- [ ] Hue-shifted shading, coloured outlines, no pure-black shadows
- [ ] No seams at joints in extreme poses; draw order correct when turning
- [ ] Face shows ≥ 6 readable expressions; blinks and mouth shapes exist
- [ ] Style matches the world (line weight, palette, shading method shared with the environment)
