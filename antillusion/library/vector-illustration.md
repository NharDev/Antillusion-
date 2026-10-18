# Vector illustration in code: composition, bézier drawing, light, colour, texture and SVG craft
tags: illustration vector svg canvas drawing scene landscape spot illustration hero image bezier path curves composition focal point lighting shadow gradient mesh noise grain texture feTurbulence halftone clippath mask parallax isometric color harmony atmospheric perspective svgo رسم توضيحي رسم متجه ايقونه مشهد منظر رسومات خلفيه اضاءه ظل تدرج ملمس منظور ايزومتري الوان

Good illustration is decided before the first path: **idea → thumbnail composition → value plan → palette → shapes → light → texture → detail**. Code makes it easy to keep adding shapes; resist — fewer, better-drawn shapes look professional.

## 1. Composition
- **Format and focal point**: one focal point per image, placed on a rule-of-thirds intersection (x = W/3 or 2W/3) or on a strong diagonal. It gets the highest value contrast, the most saturated colour, the sharpest edges and the most detail.
- **Value grouping**: plan 3–4 value groups (light, mid, dark, accent). Squint test: the image should read as a few big shapes. Large calm areas let the focal area breathe.
- **Depth layers**: foreground (dark or very saturated, partly cropped by the frame), midground (the subject), background (simplified, lighter, cooler). Overlap is the strongest depth cue, then size, then atmospheric colour.
- **Leading lines**: paths, rivers, light rays, gazes pointing to the focal point; avoid tangents (edges that just touch — overlap clearly or separate clearly).
- **Rhythm & variety**: big/medium/small shape sizes in roughly 60/30/10 area; odd numbers of repeated elements (3, 5, 7); vary spacing.
- **Frame**: leave margins for text in hero illustrations (decide the text area first), crop things deliberately.

## 2. Drawing with cubic béziers
- Place nodes at **extremes** (topmost, leftmost… points of a curve) and at corners only; 4–8 nodes describe most organic shapes.
- Handles **horizontal/vertical at extremes**; collinear handles across a smooth node (`S`/`s` command in SVG mirrors the previous handle = G1 continuity).
- Handle length ≈ ⅓ of the distance to the next node; a quarter circle uses 0.5523 × radius.
- Contrast straights against curves (a straight back + a curved belly) — all-curve shapes look like blobs.
- **Tapered strokes as filled shapes**: draw a stroke as a closed path with two sides converging to points, not `stroke-width`. For hair strands, grass, outlines with weight variation:
```svg
<!-- tapered leaf-shaped stroke from (10,90) to (90,10) -->
<path d="M10 90 C30 60 55 35 90 10 C60 40 38 66 10 90Z" fill="#2c3a2a"/>
<!-- organic blob with 4 nodes at extremes -->
<path d="M50 8 C75 8 92 28 92 52 C92 78 72 94 48 92 C24 90 8 72 10 48 C12 24 26 8 50 8Z"/>
```
- Canvas equivalent: `ctx.beginPath(); ctx.moveTo(); ctx.bezierCurveTo(c1x,c1y,c2x,c2y,x,y); ctx.fill();` — use `Path2D('M…')` to reuse SVG path data.
- Strokes when used: `stroke-linecap="round" stroke-linejoin="round"`, `vector-effect="non-scaling-stroke"` for icons that scale; keep one line weight family (e.g. 2 / 3 / 5).

## 3. Light and shadow
- Choose **one key light** direction (e.g. top-left, warm) and keep it for every object.
- **Fill** (sky/bounce, cool, weaker) lifts shadows; **rim** (thin light edge on the side opposite the key or from behind) separates subject from background.
- Shading layers per object: base → form shadow (core shadow on the side away from light) → cast shadow (darker, sharper near the contact, softer and lighter further away) → highlight → rim.
- **Contact / ambient occlusion**: dark soft gradient where objects meet the ground or each other:
```svg
<radialGradient id="ao" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#1b1f2a" stop-opacity=".45"/>
  <stop offset="1" stop-color="#1b1f2a" stop-opacity="0"/></radialGradient>
<ellipse cx="200" cy="312" rx="70" ry="10" fill="url(#ao)"/>
```
- Shade with shapes **clipped to the object** so shadows never spill:
```svg
<clipPath id="c"><path id="body" d="M…Z"/></clipPath>
<use href="#body" fill="#e9a25f"/>
<g clip-path="url(#c)">
  <path d="M… (shadow side shape)" fill="#b8643e"/>                  <!-- form shadow -->
  <path d="M… (thin crescent on lit edge)" fill="#ffd9a0" opacity=".8"/> <!-- highlight -->
</g>
```
- Shadows shift hue: warm light → cool (blue/violet) shadows; never pure black at 40 % opacity over everything. Use `mix-blend-mode: multiply` on shadow layers for natural darkening over textures.

## 4. Colour harmony
- Start from a mood: dawn (peach, lilac, pale blue), noon (high contrast, saturated), dusk (orange key, violet shadows), night (deep blue, one warm light source).
- **Analogous base + complementary accent**: 3 neighbouring hues for 90 % of the image, the complement at the focal point (blue-green scene, small orange lantern).
- Limit to 5–8 colours plus their shade/tint steps; sample the shadow colour as `oklch(L−0.15, C+0.02, h−20°)` of the base (shift toward cool), highlight `oklch(L+0.1, C−0.02, h+10°)` (toward warm).
- **Atmospheric perspective**: each layer further away: lighter (+L), lower contrast, lower chroma, hue shifted toward the sky colour. Implement by tinting layers: `color-mix(in oklch, var(--obj) 60%, var(--sky))` for far layers.
- Keep saturation highest at the focal point; desaturate edges of the frame.

## 5. Gradients done right
- Avoid single linear 2-stop gradients on everything (cheap). Prefer flat shapes + one subtle gradient for light falloff.
- **Mesh-like gradients**: stack 3–5 `radialGradient`s with transparency on a base fill, centres at different spots:
```svg
<rect width="800" height="500" fill="#1d2b4a"/>
<radialGradient id="g1" cx=".2" cy=".1" r=".7"><stop offset="0" stop-color="#ff9d6c"/><stop offset="1" stop-color="#ff9d6c" stop-opacity="0"/></radialGradient>
<radialGradient id="g2" cx=".85" cy=".3" r=".6"><stop offset="0" stop-color="#6c8cff" stop-opacity=".8"/><stop offset="1" stop-color="#6c8cff" stop-opacity="0"/></radialGradient>
<rect width="800" height="500" fill="url(#g1)"/><rect width="800" height="500" fill="url(#g2)"/>
```
- Interpolate in OKLCH/OKLab where possible (CSS `linear-gradient(in oklch, …)`) to avoid muddy grey midpoints; add an intermediate stop when mixing complements.
- **No banding**: add 2–4 % noise on top of large smooth gradients (grain filter below), and avoid long gradients over small lightness ranges in 8-bit.

## 6. Texture: noise, grain, halftone
```svg
<filter id="grain" x="0" y="0" width="100%" height="100%">
  <feTurbulence type="fractalNoise" baseFrequency=".8" numOctaves="3" stitchTiles="stitch" result="n"/>
  <feColorMatrix in="n" type="saturate" values="0"/>
  <feComponentTransfer><feFuncA type="linear" slope=".08"/></feComponentTransfer>   <!-- 8% strength -->
</filter>
<!-- last child of the scene: a noise-only overlay; the rect's own fill is replaced by the filter output -->
<rect width="100%" height="100%" filter="url(#grain)" style="mix-blend-mode:multiply"/>
```
- `baseFrequency` 0.6–0.9 = fine grain; 0.01–0.05 = clouds, terrain, paper fibres; use `feDisplacementMap` (scale 2–8) with low-frequency noise for hand-drawn wobbly edges.
- Grain is expensive on huge animated SVGs: render once to a canvas/PNG tile and repeat it, or apply only to static layers.
- **Halftone**: a `<pattern>` of circles whose radius tracks a shade (generate in JS: `r = maxR * sqrt(darkness)` on a rotated grid, 45° for one ink, 15/75° for others), or mask a dot pattern with a gradient.
- **Hatching/stipple** for printmaking styles: generate lines/dots in JS clipped to the shadow shape.

## 7. Backgrounds and parallax
- Build backgrounds as 3–5 bands (sky, far hills, mid hills, foreground), each a single path with a subtle top-edge variation; lighten and cool with distance.
- Procedural ridges: sample 1D noise along x with 2–3 octaves, amplitude decreasing with distance, then close the path to the bottom.
```js
function ridge(w, h, base, amp, seed, step = 8){
  let d = `M0 ${h}`; for (let x = 0; x <= w; x += step){
    const y = base - amp * (0.6*Math.sin(x*0.004+seed) + 0.3*Math.sin(x*0.011+seed*2) + 0.1*Math.sin(x*0.031+seed*3));
    d += ` L${x} ${y.toFixed(1)}`; } return d + ` L${w} ${h}Z`; }
```
- Parallax: layer speed ∝ 1/depth (sky 0.05, far 0.2, mid 0.5, fg 1.0, extreme fg 1.3); translate with `transform` only; tile layers 2× width for loops.
- Add life: drifting clouds (60–120 s loop), a few birds, light flicker — sparse and slow.

## 8. Isometric drawing math
- Classic game isometric is **2:1 dimetric**: x axis goes right-down at ≈ 26.565° (`atan(0.5)`), y axis left-down.
```js
const TW = 64, TH = 32;  // tile width/height (2:1)
const toScreen = (x, y, z = 0) => ({ sx: (x - y) * TW / 2, sy: (x + y) * TH / 2 - z * TH });
// sort draw order by (x + y), then z
```
- In SVG, transform a flat top face with `matrix(0.866 0.5 -0.866 0.5 0 0)` for true isometric (30°) or `matrix(1 0.5 -1 0.5 0 0)` for 2:1 pixel isometric.
- Three visible faces of a cube: top lightest, left mid, right darkest (consistent key light). Vertical edges stay vertical.

## 9. Kinds of illustration
| Kind | Size | Detail rules |
|---|---|---|
| Icon | 16–48 px | grid-aligned, 1–2 colours, one stroke weight, no texture |
| Spot illustration | 120–320 px | single object/scene vignette, 3–5 colours, simple shadow, no full background |
| Hero / scene | full-width | composition, depth layers, light, texture, room for text |
| Pattern / supergraphic | tiled | derived from brand shapes, low contrast behind content |
Keep a style recipe for a set: same palette subset, same line weight, same light direction, same corner radius, same level of detail — consistency is what makes a set feel professional.

## 10. Exporting and optimising SVG
- Always set `viewBox`, omit fixed `width/height` for responsive (or set both for icons); `aria-hidden="true"` for decoration, `<title>` + `role="img"` for meaningful art.
- Reuse with `<symbol>`/`<use>`, put gradients/filters in `<defs>`; unique IDs per inline SVG (prefix them) to avoid collisions when multiple SVGs share a page.
- Round coordinates to 1–2 decimals; convert text to paths for logos/art (keep text live for UI).
- `npx svgo --multipass -p 2 in.svg -o out.svg` — keep `viewBox` (SVGO v3 keeps it by default; don't enable `removeViewBox`), and check that `cleanupIds` doesn't break referenced IDs across files.
- Performance: filters (blur, turbulence) and huge masks are costly — rasterise static heavy layers; animate `transform`/`opacity`; prefer canvas for thousands of animated elements.

## 11. Workflow for a scene in code
1. Thumbnail 3 compositions as grey rectangles/ellipses only (5 min each); pick the clearest.
2. Block value groups with flat fills (3–4 greys) at final size; check the squint test.
3. Swap greys for the palette (keep the same lightness per group), then refine silhouettes with béziers.
4. Add form shadows, cast shadows and AO with clipped shapes; then highlights and rim light.
5. Add atmosphere to far layers, texture/grain, and finally small details only near the focal point.

## 12. Anti-slop checklist
- [ ] One focal point, clear value structure in greyscale
- [ ] Consistent light direction, hue-shifted shadows, contact shadows present
- [ ] Shapes drawn with few, well-placed nodes; tapered lines, not uniform strokes everywhere
- [ ] Palette of 5–8 colours with an accent at the focal point — not a default purple/pink gradient
- [ ] Depth via overlap and atmospheric perspective; background simpler than the subject
- [ ] Subtle grain or texture where gradients are large; no banding
- [ ] No clip-art clichés (floating sparkles, generic blobs, random circles) unless they serve the idea
