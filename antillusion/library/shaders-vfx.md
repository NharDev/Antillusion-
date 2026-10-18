# Shaders & VFX: three.js materials, toon, rim, outlines, dissolve, water, GPU particles, bloom, 2D canvas effects, engine equivalents
tags: shader glsl vfx effects three threejs shadermaterial onbeforecompile toon cel shading rim light fresnel outline inverted hull dissolve noise hit flash water particles instancedmesh bloom postprocessing effectcomposer unrealbloompass canvas additive glow trail godot shader unity shader graph urp vfx graph unreal niagara material لعبه العاب مؤثرات تاثيرات بصريه شيدر ظل اضاءه توهج جزيئات ماء انفجار

## three.js setup that makes effects look right
```js
renderer.outputColorSpace = THREE.SRGBColorSpace;          // default in recent three
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.0;
colorTexture.colorSpace = THREE.SRGBColorSpace;            // albedo/emissive maps only (not normal/roughness/noise)
```
Pre-compile shaders to avoid first-use stutter: `renderer.compile(scene, camera)` (or the async variant) after loading.

## ShaderMaterial skeleton
`ShaderMaterial` injects `projectionMatrix`, `modelViewMatrix`, `modelMatrix`, `normalMatrix`, `cameraPosition`, and attributes `position`, `normal`, `uv`. (`RawShaderMaterial` injects nothing.)
```js
const uniforms = { uTime: { value: 0 }, uColor: { value: new THREE.Color('#4cf') } };
const mat = new THREE.ShaderMaterial({ uniforms, transparent: false,
  vertexShader: /* glsl */`
    varying vec3 vN; varying vec3 vView; varying vec2 vUv;
    void main() {
      vUv = uv; vN = normalize(normalMatrix * normal);
      vec4 mv = modelViewMatrix * vec4(position, 1.0); vView = -mv.xyz;
      gl_Position = projectionMatrix * mv;
    }`,
  fragmentShader: /* glsl */`
    uniform vec3 uColor; uniform float uTime;
    varying vec3 vN; varying vec3 vView; varying vec2 vUv;
    void main() { gl_FragColor = vec4(uColor, 1.0); }`,
});
// in the loop: uniforms.uTime.value = clock.getElapsedTime();
```
For lighting/fog support inside a ShaderMaterial, merge `THREE.UniformsLib.lights` and set `lights: true` — usually easier to patch a built-in material instead:

## Patching built-in materials (onBeforeCompile)
Keeps PBR lighting, shadows, fog; inject code at `#include` chunks.
```js
const mat = new THREE.MeshStandardMaterial({ color: 0x88aa66 });
mat.onBeforeCompile = (shader) => {
  shader.uniforms.uTime = uniforms.uTime;
  shader.vertexShader = 'uniform float uTime;\n' + shader.vertexShader.replace('#include <begin_vertex>',
    `#include <begin_vertex>
     transformed.x += sin(uTime * 2.0 + position.y * 3.0) * 0.05 * position.y;  // grass/flag sway`);
};
mat.customProgramCacheKey = () => 'sway-v1';   // distinguish from unpatched materials
```
Useful chunks: vertex `#include <begin_vertex>` (`transformed`), `#include <beginnormal_vertex>` (`objectNormal`); fragment `#include <color_fragment>` (`diffuseColor`), `#include <emissivemap_fragment>` (`totalEmissiveRadiance`), `#include <dithering_fragment>` (end, `gl_FragColor`). Chunk names change between three versions — print `shader.fragmentShader` once to check.

## Toon / cel shading
Built-in: `new THREE.MeshToonMaterial({ color, gradientMap })` where `gradientMap` is a tiny DataTexture/PNG (3–5 texels) with `minFilter = magFilter = THREE.NearestFilter` (otherwise the bands blur). Custom:
```glsl
float ndl = max(dot(normalize(vN), normalize(uLightDirView)), 0.0);
float bands = 3.0;
float shade = floor(ndl * bands) / bands;                  // hard steps
// soft-edged steps: shade = smoothstep(0.48, 0.52, ndl) * 0.6 + 0.4;
vec3 col = uColor * mix(0.35, 1.0, shade);
```
Pair with outlines + rim + flat/hand-painted textures. Transform the light direction into view space on the CPU (`dir.transformDirection(camera.matrixWorldInverse)`).

## Rim light / fresnel
```glsl
vec3 N = normalize(vN), V = normalize(vView);
float fres = pow(1.0 - max(dot(N, V), 0.0), 3.0);           // 2–5: lower = wider rim
col += uRimColor * fres * 0.8;
// Schlick (physically): F = F0 + (1.0 - F0) * pow(1.0 - cosTheta, 5.0);  F0 ≈ 0.02–0.04 for water/glass
```
Uses: shields/force fields (additive, transparent, depthWrite false), holograms (+ scanlines `step(0.5, fract(vWorldPos.y * 40.0 - uTime))`), selection highlight, ghost/x-ray.

## Outlines
1. **Inverted hull** (cheap, per object, great for toon): second mesh, back faces only, pushed along normals.
```js
const outline = new THREE.Mesh(mesh.geometry, new THREE.ShaderMaterial({ side: THREE.BackSide,
  uniforms: { uT: { value: 0.03 } },
  vertexShader: `uniform float uT; void main(){ vec3 p = position + normal * uT;
                 gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0); }`,
  fragmentShader: `void main(){ gl_FragColor = vec4(0.05,0.03,0.08,1.0); }` }));
mesh.add(outline);
```
Needs smooth normals (hard edges split → gaps: compute averaged normals into a separate attribute). Scale thickness by distance for constant screen width.
2. **Post-process edges**: Sobel/Roberts on depth + normals (custom pass) for whole-scene ink lines; `OutlinePass` (three addons) for highlighting selected objects (glow outline, hidden-edge colour).

## Dissolve with noise
```glsl
uniform sampler2D uNoise; uniform float uProgress;           // 0 → 1
float n = texture2D(uNoise, vUv).r;
if (n < uProgress) discard;
float edge = 1.0 - smoothstep(0.0, 0.06, n - uProgress);     // 0.06 = edge width
col += uEdgeColor * edge * 3.0;                              // HDR edge → blooms
```
Use world-space or triplanar noise if UVs are bad; animate `uProgress` 0 → 1 over 0.8–1.5 s; emit particles at the edge for extra punch. `discard` is costly on mobile tile GPUs — fine for short effects.

## Hit flash
Simplest (any lit material): set `material.emissive.setRGB(1,1,1)` + `emissiveIntensity` 1→0 over 80–120 ms (materials shared between enemies? clone per instance or use a uniform/instance attribute). Shader: `col = mix(col, vec3(1.0), uFlash);` with `uFlash` decaying `*= exp(-dt*25.)`. Red tint for player damage, white for enemies.

## Water (stylised)
- Vertex: sum of 3–4 sine/Gerstner waves (different directions, wavelengths 2–20 m, amplitudes 0.05–0.4 m) on a subdivided plane.
- Fragment: colour by depth (shallow turquoise → deep navy) using the scene depth texture, foam where depth difference < 0.3 m or at wave crests, fresnel blend toward sky colour, scrolling normal maps (two layers, different speeds/directions), specular sun highlight.
- three addons include `Water` (reflective ocean with a normal map) and a second water object with flow maps; good starting points.

## GPU particles
- **InstancedMesh** (≤ ~10k): one draw call; update `setMatrixAt(i, m)` + `instanceMatrix.needsUpdate = true`; per-instance colour via `setColorAt`. CPU-simulated but cheap.
- **Fully GPU**: store spawn data in `InstancedBufferAttribute`s (start position, velocity, birth time, life) and compute in the vertex shader; CPU only resets dead slots in a ring buffer.
```glsl
attribute vec3 aStart; attribute vec3 aVel; attribute float aBirth; attribute float aLife;
uniform float uTime; varying float vAge;
void main(){
  float t = uTime - aBirth; vAge = clamp(t / aLife, 0.0, 1.0);
  vec3 p = aStart + aVel * t + 0.5 * vec3(0.0, -9.8, 0.0) * t * t;
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  mv.xy += position.xy * mix(0.3, 0.0, vAge);                 // camera-facing quad, shrinks with age
  gl_Position = projectionMatrix * mv;
}
```
Material: `transparent: true, depthWrite: false, blending: THREE.AdditiveBlending` for fire/sparks/magic (normal blending for smoke/dust). `THREE.Points` + `gl_PointSize` is simplest but point size limits vary by GPU. Recipes: sparks (50–150, life 0.2–0.5 s, high speed, stretched along velocity), explosion (flash sprite 1 frame + fireball 0.3 s + smoke 1–2 s + debris + shockwave ring + light), magic (spiral `angle += t*6`, colour over life).

## Bloom and post-processing
```js
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
composer.addPass(new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.8 /*strength*/, 0.4 /*radius*/, 0.85 /*threshold*/));
composer.addPass(new OutputPass());               // tone mapping + colour space at the end
// loop: composer.render();  resize: composer.setSize(w, h)
```
Selective bloom: keep threshold high (0.8–1.0) and push only emissive things above 1.0 (`emissiveIntensity` 2–5, HDR colours). Also: vignette, colour grading LUT, chromatic aberration (tiny), FXAA/SMAA pass when MSAA is off. The `postprocessing` npm library (pmndrs) merges effects into fewer passes — faster on mobile. Render post at reduced resolution on weak GPUs.
WebGPU: three's WebGPURenderer with node materials (TSL) is the newer path; concepts above carry over.

## 2D canvas VFX
```js
ctx.save(); ctx.globalCompositeOperation = 'lighter';          // additive glow for sparks/lasers/fire
for (const p of particles) { ctx.globalAlpha = p.life / p.max; ctx.drawImage(glowSprite, p.x - 16, p.y - 16); }
ctx.restore();
// motion trail: instead of clearing, fade the previous frame
ctx.fillStyle = 'rgba(10,10,20,0.25)'; ctx.fillRect(0, 0, w, h);
// white hit-flash of a sprite: pre-tint once into an offscreen canvas
function whiteVersion(img) { const c = new OffscreenCanvas(img.width, img.height), x = c.getContext('2d');
  x.drawImage(img, 0, 0); x.globalCompositeOperation = 'source-atop'; x.fillStyle = '#fff';
  x.fillRect(0, 0, c.width, c.height); return c; }
```
- Pre-render glows as radial-gradient sprites; `shadowBlur` and `ctx.filter` are slow (and `filter` support varies) — avoid per-frame.
- Trails for specific objects: ring buffer of last 6–12 positions, draw with decreasing alpha/width.
- Screen flash: full-screen white rect alpha 0.6 → 0 over 100 ms. Shockwave: expanding stroked circle, lineWidth shrinking.
- Pixi.js: `blendMode = 'add'`, filters (glow, displacement, CRT) on containers; ParticleContainer for many sprites.

## Engine equivalents
| Effect | Godot 4 | Unity (URP) | Unreal 5 |
|---|---|---|---|
| Custom shader | `.gdshader`: `shader_type spatial;` / `canvas_item;` with `vertex()`, `fragment()`, `light()` | Shader Graph (or HLSL) | Material Editor graph, Material Instances |
| Toon | `light()` function with stepped `DIFFUSE_LIGHT`, or a ramp texture | Shader Graph custom lighting / toon assets | Custom lighting via post-process material or unlit + stepped dot |
| Fresnel / rim | `pow(1.0 - dot(NORMAL, VIEW), 3.0)` | Fresnel Effect node | Fresnel node |
| Dissolve | `ALPHA_SCISSOR_THRESHOLD` or `discard` + noise texture | Alpha Clip Threshold + Simple Noise / texture | Masked blend mode + Opacity Mask + noise |
| Outline | second material pass with `cull_front` + vertex grow (`next_pass`) | renderer feature / inverted hull material | Custom Depth/Stencil + post-process material |
| Particles | GPUParticles2D/3D + ParticleProcessMaterial (CPUParticles fallback) | VFX Graph (GPU, compute-capable platforms) or Particle System (CPU) | Niagara systems/emitters |
| Bloom / post | WorldEnvironment: Glow, tonemap, adjustments | Volume with Bloom, Tonemapping, Color Adjustments | Post Process Volume |
| Runtime params | `material.set_shader_parameter("progress", v)` | `material.SetFloat("_Progress", v)` (use MaterialPropertyBlock to avoid copies) | Dynamic Material Instance → set scalar parameter |
Godot hit flash (2D):
```glsl
shader_type canvas_item;
uniform float flash : hint_range(0.0, 1.0) = 0.0;
uniform vec4 flash_color : source_color = vec4(1.0);
void fragment() { vec4 c = texture(TEXTURE, UV); COLOR = vec4(mix(c.rgb, flash_color.rgb, flash), c.a); }
```

## Performance rules
- Overdraw kills mobile: keep big transparent/additive quads few and small; sort and cull particles; cap counts by quality preset.
- Use `mediump` where possible on mobile; avoid dependent texture reads and heavy branching in fragment shaders.
- Share materials; vary per instance with instance attributes, not material clones.
- Bake what you can (lighting, AO, noise into textures). Profile with Spector.js / browser GPU timings / engine profilers.
