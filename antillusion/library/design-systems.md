# Design systems: tokens, OKLCH ramps, type, spacing, elevation, motion and components
tags: design system tokens design tokens css variables custom properties oklch colour ramp palette neutral semantic dark mode type scale spacing radius shadow elevation motion easing component states density grid breakpoints icons style dictionary tokens studio figma variables نظام تصميم رموز متغيرات الوان تدرج خطوط مسافات ظلال حركه مكونات حالات شبكه ايقونات وضع داكن

## 1. Token tiers
| Tier | Purpose | Example |
|---|---|---|
| Primitive (global) | raw values, no meaning | `--blue-600`, `--space-4`, `--radius-2` |
| Semantic (alias) | role, theme-aware | `--color-bg`, `--color-text-muted`, `--color-accent`, `--color-border` |
| Component | one component's decision | `--button-bg`, `--button-radius`, `--card-padding` |
Components read **only semantic/component tokens**; themes remap semantic → primitive. Never hard-code hex inside components.

Naming: `category-property-variant-state` → `color-bg-surface-raised`, `color-text-on-accent`, `color-border-focus`, `button-primary-bg-hover`. Numeric scales for primitives (`50…950` or `1…12`), t-shirt sizes only for small closed sets (`radius-sm/md/lg`). Avoid colour names in semantic tokens (`--color-danger`, not `--color-red`).

## 2. Colour ramps in OKLCH
OKLCH is perceptually even: same L ≈ same perceived lightness across hues, so ramps align across palettes.
Recipe (per hue):
1. Fix hue `h` (allow a small drift: yellows +5° toward orange in darks, blues −5° toward cyan in lights reads natural).
2. Lightness steps for 11 stops `50…950`: `L = [0.975, 0.94, 0.88, 0.80, 0.71, 0.62, 0.54, 0.46, 0.38, 0.30, 0.23]`.
3. Chroma peaks mid-ramp: `C(t) = Cmax * sin(π * t)^0.8` with `t` from ~0.05 (lightest) to ~0.95 (darkest); Cmax 0.12–0.22 by hue (yellow/green can go higher, blue ~0.18).
4. **Gamut clamp**: reduce C until the colour is inside sRGB (or P3 with an sRGB fallback).
```js
// returns 11 oklch() strings; inSRGB = OKLCH -> OKLab -> linear sRGB range check
const L=[.975,.94,.88,.80,.71,.62,.54,.46,.38,.30,.23];
function ramp(h, cmax){ return L.map((l,i)=>{ const t=.05+.9*i/(L.length-1);
  let c=cmax*Math.pow(Math.sin(Math.PI*t),.8);
  while(c>0 && !inSRGB(l,c,h)) c-=.005;          // gamut clamp
  return `oklch(${l} ${c.toFixed(3)} ${h})`; }); }
function inSRGB(l,c,h){ const a=c*Math.cos(h*Math.PI/180), b=c*Math.sin(h*Math.PI/180);
  const l_=l+.3963377774*a+.2158037573*b, m_=l-.1055613458*a-.0638541728*b, s_=l-.0894841775*a-1.2914855480*b;
  const [x,y,z]=[l_**3,m_**3,s_**3];
  const r= 4.0767416621*x-3.3077115913*y+.2309699292*z,
        g=-1.2684380046*x+2.6097574011*y-.3413193965*z,
        bl=-.0041960863*x-.7034186147*y+1.7076147010*z;
  return [r,g,bl].every(v=>v>=-1e-4&&v<=1+1e-4); }
```
- **Neutrals**: same L steps, chroma 0.004–0.02 at the brand hue (or a warm 60–80° / cool 250–260° tint). Pure grey (C=0) looks dead next to a coloured accent.
- **Semantic**: success ~145–155°, warning ~70–85°, danger ~25–30°, info ~240–255°; keep their L/C close to the accent's so nothing shouts louder than intended.
- Text on a stop: stops ≥ 600 carry white text at ≥ 4.5:1 in most hues; yellow/lime need dark text at all stops.
- Data viz: categorical palette of 5–8 hues at similar L (≈0.60–0.72) and C, ordered for maximum adjacent difference; sequential = one ramp; diverging = two ramps meeting at a neutral. Test for colour-blindness; never encode meaning by hue alone.

## 3. Dark mode = remap semantics, don't invert
| Semantic | Light | Dark |
|---|---|---|
| `bg` | neutral-50 | neutral-950 (L≈0.17, not #000) |
| `surface` | white | neutral-900 |
| `surface-raised` | white + shadow | neutral-850/800 (lighter = higher) |
| `text` | neutral-900 | neutral-100 (not pure white; L≈0.93) |
| `text-muted` | neutral-600 | neutral-400 |
| `border` | neutral-200 | neutral-800 |
| `accent` | accent-600 | accent-400/500, chroma −10–20 % |
Shadows barely show on dark: express elevation by surface lightness + a 1 px top highlight `inset 0 1px 0 rgb(255 255 255/.04)`. Re-check every contrast pair in both themes.

## 4. Type scale
Modular ratio: 1.125 (dense apps), 1.2 (UI), 1.25 (product/marketing), 1.333 (editorial), 1.5+ (posters). Base 16 px (14 for dense tools).
| Token | 1.25 scale | line-height | weight | tracking |
|---|---|---|---|---|
| `text-xs` | 12 | 16 | 400–500 | +0.01em |
| `text-sm` | 14 | 20 | 400 | 0 |
| `text-md` | 16 | 24 | 400 | 0 |
| `text-lg` | 20 | 28 | 500 | −0.005em |
| `text-xl` | 25 | 32 | 600 | −0.01em |
| `text-2xl` | 31 | 38 | 600 | −0.015em |
| `text-3xl` | 39 | 44 | 700 | −0.02em |
| `text-4xl` | 49 | 52 | 700 | −0.025em |
Round line-heights to the 4 px grid. Fluid display sizes: `font-size: clamp(2rem, 1.2rem + 3vw, 3.5rem)`. Use ≤ 3 weights. Numbers in tables: `font-variant-numeric: tabular-nums`.

## 5. Spacing, radius, sizing
- Spacing on a **4 px base, 8 px rhythm**: `0, 2, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64, 80, 96, 128`. Inner padding < outer gap (proximity rule). Control heights: 32 (compact) / 36–40 (default) / 44–48 (touch, ≥ 44 is the tap target guidance).
- Radius scale: `0, 2, 4, 6, 8, 12, 16, 24, 9999`. One family per product. **Nested radius**: `inner = outer − padding` so concentric corners look parallel.
- Borders 1 px (hairline `0.5px` on 2× screens only with care); focus ring 2 px + 2 px offset.

## 6. Elevation (layered shadows)
Real shadows = tight contact shadow + soft ambient; use a shadow colour tinted toward the neutral hue, not pure black.
```css
--shadow-1: 0 1px 2px oklch(0.2 0.02 255 / .06), 0 1px 1px oklch(0.2 0.02 255 / .04);
--shadow-2: 0 1px 2px oklch(0.2 0.02 255 / .06), 0 4px 8px -2px oklch(0.2 0.02 255 / .08);
--shadow-3: 0 2px 4px oklch(0.2 0.02 255 / .06), 0 12px 24px -6px oklch(0.2 0.02 255 / .12);
--shadow-4: 0 4px 8px oklch(0.2 0.02 255 / .06), 0 24px 48px -12px oklch(0.2 0.02 255 / .18);
```
Map: 1 = cards on page, 2 = hover/dropdown trigger, 3 = popovers/menus, 4 = modals. Negative spread keeps large blurs from looking dirty. Combine with a 1 px border at low contrast for crisp edges.

## 7. Motion tokens
| Token | ms | Use |
|---|---|---|
| `duration-instant` | 75–100 | hover colour, press |
| `duration-fast` | 150 | small toggles, tooltips |
| `duration-normal` | 200–250 | dropdowns, cards, tabs |
| `duration-slow` | 300–400 | modals, drawers, page sections |
| `duration-deliberate` | 500–700 | onboarding, hero choreography |
Easings: `--ease-standard: cubic-bezier(.2,0,0,1)`; `--ease-out (enter): cubic-bezier(0,0,.2,1)`; `--ease-in (exit): cubic-bezier(.4,0,1,1)`; `--ease-emphasized: cubic-bezier(.3,0,0,1)`; `--ease-overshoot: cubic-bezier(.34,1.56,.64,1)`. Exits ~20–30 % faster than enters. Scale motion distance with size (bigger travel = longer). Animate `transform`/`opacity`; wrap in `@media (prefers-reduced-motion: reduce)` → crossfade only.

## 8. Component state matrix
Every interactive component specifies all states, in both themes:
| State | Visual rule |
|---|---|
| default | base tokens |
| hover | bg one step (e.g. accent-600 → 700) or overlay `color-mix(in oklch, currentColor 8%, transparent)` |
| active/pressed | two steps or 12 % overlay; optional `scale(.98)` |
| focus-visible | 2 px ring `--color-focus` + 2 px offset; never remove outline without replacement |
| disabled | 40–50 % opacity or muted tokens, `cursor: not-allowed`, no hover; keep readable |
| loading | keep width (spinner replaces label or sits inside), `aria-busy`, block double-submit |
| error | danger border + icon + message text (not colour only) |
| selected/checked | accent fill or check, plus `aria-selected/checked` |
Variants × sizes × states grows fast: keep variants ≤ 4 (primary, secondary, ghost, danger) and sizes ≤ 3.

**Density**: expose `--density` modes (compact 0.75, default 1, comfortable 1.25) multiplying control heights and paddings, not font sizes.

## 9. Grids and breakpoints
- Columns: 4 (mobile) / 8 (tablet) / 12 (desktop); gutters 16 / 24 / 24–32; margins 16 / 32 / auto with `max-width` 1200–1440 (text measure 60–75 ch).
- Breakpoints (min-width): `sm 640, md 768, lg 1024, xl 1280, 2xl 1536`; prefer container queries for components (`@container (min-width: 480px)`).
- Use CSS grid: `grid-template-columns: repeat(auto-fill, minmax(min(100%, 280px), 1fr))`.

## 10. Icon system
- **24 px grid, 2 px padding (live area 20)**, stroke 1.5 or 2 px, round or square caps/joins consistently, corner radius 1–2 px, no fills mixed into an outline set.
- **Keylines**: circle Ø20, square 18×18, portrait 16×20, landscape 20×16 — so different shapes feel equal in weight.
- Optical sizing: at 16 px use a tuned 16-grid version or stroke 1.5→1.75; at 32+ thin the stroke proportionally.
- Align to pixel grid (integer coordinates for 2 px strokes, .5 for 1 px). Icons inherit `currentColor`; size by `1em` or tokens 16/20/24.
- Use **one** open-source set: Lucide (stroke 2, ISC), Phosphor (6 weights, MIT), Tabler (stroke 2 default, MIT), Heroicons (outline/solid, MIT). **Never mix sets**; custom icons follow the chosen set's grid, stroke and caps. No emoji as UI icons.

## 11. CSS token layer
```css
@layer tokens {
:root{
  /* primitives */
  --neutral-50: oklch(.975 .005 255); --neutral-100: oklch(.94 .006 255); --neutral-200: oklch(.88 .008 255);
  --neutral-400: oklch(.71 .012 255); --neutral-600: oklch(.54 .014 255); --neutral-800: oklch(.38 .014 255);
  --neutral-900: oklch(.30 .013 255); --neutral-950: oklch(.19 .012 255);
  --accent-400: oklch(.71 .15 255); --accent-600: oklch(.54 .17 255); --accent-700: oklch(.46 .15 255);
  --red-600: oklch(.55 .19 27); --green-600: oklch(.55 .14 150); --amber-500: oklch(.75 .15 75);
  --space-1: 4px; --space-2: 8px; --space-3: 12px; --space-4: 16px; --space-6: 24px; --space-8: 32px;
  --radius-sm: 4px; --radius-md: 8px; --radius-lg: 12px; --radius-full: 9999px;
  --font-sans: "Inter", "IBM Plex Sans Arabic", system-ui, sans-serif;
  --dur-fast: 150ms; --dur-normal: 220ms; --ease-standard: cubic-bezier(.2,0,0,1);
  /* semantics (light) */
  --color-bg: var(--neutral-50); --color-surface: #fff; --color-text: var(--neutral-950);
  --color-text-muted: var(--neutral-600); --color-border: var(--neutral-200);
  --color-accent: var(--accent-600); --color-accent-hover: var(--accent-700); --color-on-accent: #fff;
  --color-danger: var(--red-600); --color-success: var(--green-600); --color-focus: var(--accent-600);
  color-scheme: light;
}
:root[data-theme="dark"]{
  --color-bg: var(--neutral-950); --color-surface: var(--neutral-900); --color-text: var(--neutral-100);
  --color-text-muted: var(--neutral-400); --color-border: var(--neutral-800);
  --color-accent: var(--accent-400); --color-accent-hover: oklch(.78 .13 255); --color-on-accent: var(--neutral-950);
  color-scheme: dark;
}
}
.button{ --button-bg: var(--color-accent); background: var(--button-bg); color: var(--color-on-accent);
  height: calc(40px * var(--density, 1)); padding-inline: var(--space-4); border-radius: var(--radius-md);
  transition: background-color var(--dur-fast) var(--ease-standard); }
.button:hover{ --button-bg: var(--color-accent-hover); }
.button:focus-visible{ outline: 2px solid var(--color-focus); outline-offset: 2px; }
```

## 12. Tooling and documentation
- **Source of truth** in JSON (W3C Design Tokens format: `{"color":{"accent":{"$value":"{color.blue.600}","$type":"color"}}}`).
- **Style Dictionary** transforms JSON → CSS vars, SCSS, JS/TS, iOS, Android. **Tokens Studio** syncs Figma ↔ Git JSON.
- **Figma variables**: collections = Primitives / Semantic (modes Light/Dark) / Component; export with the REST API or a plugin and map 1:1 to CSS custom properties (`color/text/muted` → `--color-text-muted`).
- Document each component: purpose, anatomy, variants, states, do/don't, a11y (keyboard, ARIA), tokens used, code example. Keep a living page (Storybook or a single HTML gallery) showing all states side by side in both themes.
- Version tokens with semver; deprecate by aliasing old names for one release.
