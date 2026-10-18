# Brand identity: from discovery to a logo, colour, type and a guidelines kit
tags: brand identity branding logo logotype wordmark lettermark symbol emblem monogram favicon app icon colour palette typography guidelines style guide brand book mockup business card letterhead tokens visual identity هويه بصريه علامه تجاريه شعار لوجو تصميم الوان خطوط دليل الهويه بطاقه عمل ايقونه تطبيق

Shortcut: `use_template("brand-kit")` gives a working brand-guidelines page generator (logo, colour ramps with contrast checks, type scale, mockups, token export). Use this card for the design decisions you feed into it.

## 1. Discovery (do this before drawing anything)
Write a one-page brief, even if the user gave one sentence. Infer sensibly; ask only if the brand name or audience is unknown.
| Question | Output |
|---|---|
| Who is it for? | 1–2 audience sentences (age, context, expertise) |
| What does it do, in one line? | positioning statement: "For X, Brand is the Y that Z, unlike W" |
| How should it feel? | exactly **3 adjectives**, with one tension pair (e.g. *precise · warm · bold*) |
| Who are the competitors? | 3–5 names + their colours/logo types → pick the gap (if all are blue sans wordmarks, don't be one) |
| Where will it live? | app icon, website, print, signage, merch, video → drives detail level |
| Constraints | name length, script (Arabic/Latin/both), existing equity to keep |

Translate adjectives into form: *precise* → geometric construction, tight tracking, monoline; *warm* → rounded terminals, humanist type, warm neutrals; *bold* → heavy weight, high contrast, one saturated colour; *heritage* → serif, emblem, muted palette; *playful* → irregular rhythm, bouncy curves, 2 bright colours.

## 2. Concept routes
Produce **3 distinct routes**, not 3 colour variants of one idea. Each route = a one-line idea + mark + type + colour + one application.
- Route A *literal-abstracted*: the product's core object reduced to 2–4 primitives.
- Route B *typographic*: the name itself is the idea (a ligature, a cut, a custom letter).
- Route C *metaphor*: an adjacent idea (motion, growth, connection) expressed by one gesture.
Kill any route whose mark could belong to 100 other companies. Sketch fast (20+ thumbnails), then refine one.

## 3. Logo types
| Type | When | Example pattern |
|---|---|---|
| Wordmark | distinctive, short-ish name; text-first products | custom-kerned name, 1 modified glyph |
| Lettermark / monogram | long name, needs a compact form | 1–3 letters fused on a grid |
| Symbol (pictorial/abstract) | global, app-icon-first, needs to work tiny | geometric mark on a square grid |
| Combination | most common deliverable | symbol + wordmark, horizontal and stacked lockups |
| Emblem | heritage, clubs, crafts, food | text inside a badge — always also make a simplified badge-free version |
| Dynamic / responsive | media, cultural, tech platforms | fixed frame + variable fill, or full → compact → icon versions |
Always deliver a **lockup system**: primary horizontal, stacked, symbol-only, wordmark-only.

## 4. Constructing a mark in SVG by hand
Work on a 24- or 48-unit grid (`viewBox="0 0 48 48"`), integers or halves only. Build from circles, rects, and arcs; combine with paths rather than stacking random shapes.
```svg
<svg viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
  <!-- ring with a 90° cut: outer r=20, inner r=12 (stroke-equivalent width 8) -->
  <path fill="currentColor" fill-rule="evenodd"
    d="M24 4a20 20 0 1 0 20 20H36a12 12 0 1 1-12-12V4z"/>
  <!-- square counter-piece aligned to the cut -->
  <rect x="28" y="4" width="16" height="16" rx="2" fill="currentColor"/>
</svg>
```
Boolean-like operations in pure SVG:
- **Union**: one `<path>` with several subpaths, `fill-rule="nonzero"` and same winding.
- **Subtract**: `fill-rule="evenodd"` (inner subpath becomes a hole) or a `<mask>` (white keeps, black cuts) — but bake masks into plain paths for the final file (Inkscape *Path → Difference*, or `paper.js` `a.subtract(b)` in code).
- **Intersect**: `<clipPath>` during exploration, then flatten.
Optical corrections (what separates pro marks from geometric-but-wrong ones):
- **Overshoot**: round and pointed shapes extend past the baseline/cap height by **~1–3 %** of height (a circle next to a square of equal height looks smaller). On a 48 grid: square 40 tall, circle ≈ 41.
- **Thinner horizontals**: horizontal strokes ~5–10 % thinner than verticals to look equal.
- **Ink traps / notches** where strokes meet at acute angles so joins don't blob at small sizes.
- **Optical centre** sits slightly above geometric centre (~2–5 % up); triangles/play icons shift toward their visual mass.
- Curves meeting straights: use smooth (G2-ish) transitions — extend handles ~0.55 × radius (`0.5523` for a true circle quadrant) rather than a radius snap.
Wordmarks:
- Start from a real typeface, set the name, **convert to outlines** (Inkscape *Object to Path*, Figma *Outline stroke/Flatten*, or `opentype.js` `font.getPath(text, x, y, size).toPathData()`).
- Kern by eye on the **area** between letters, not the distance: flip upside down or blur to judge. Typical issues: `AV`, `To`, `ry`, `LT`. Tracking for logos in caps: +2 to +8 %; lowercase large: 0 to −3 %.
- Customise one or two glyphs (cut a terminal, join a ligature, modify a counter) — enough to own it, not so much that it fails readability.
- Arabic wordmarks: respect connection and baseline (kashida may stretch, never letter-spacing); dots (نقاط) are part of the identity — keep their shape consistent with the mark.

## 5. Tests the mark must pass
| Test | Pass criterion |
|---|---|
| 16 px favicon | still recognisable; make a simplified favicon version if needed (fewer details, thicker strokes) |
| 1 colour | works in pure black and pure white — no reliance on gradients or colour to separate parts |
| Reversed | white on brand colour and on near-black; adjust weights (white on dark looks heavier) |
| Silhouette | fill everything black — is the shape still distinct? |
| Squint / blur 4 px | one clear shape, no muddy clusters |
| Context | on photo, on app grid next to other icons, embroidered/1-colour print |
| Novelty | compare to the competitor list and a search of the obvious metaphor |

**Clear space**: define by a unit from the mark (e.g. *x* = cap height of the wordmark or ½ symbol width) on all sides. **Minimum size**: e.g. symbol ≥ 16 px / 5 mm, full lockup ≥ 80 px / 25 mm wide; below that switch to symbol-only.

## 6. Colour system
- Pick **one primary hue** that owns the brand + **neutrals** (slightly tinted toward the primary, chroma 0.005–0.02) + **semantic** (success/warning/danger/info) tuned to sit with the palette.
- Build ramps in **OKLCH**: fixed hue, lightness 0.97 → 0.25 in 10–12 steps, chroma peaking mid-ramp (see `design-systems` card for the formula).
- Proportion **60-30-10**: 60 % neutral surfaces, 30 % secondary/supporting, 10 % accent. Brand colour is precious — on CTAs, key moments, the mark.
- **Contrast pairs** (WCAG 2.x): body text ≥ 4.5:1, large text (≥ 24 px or 19 px bold) and UI/graphics ≥ 3:1. List approved pairs in the guidelines (e.g. *primary-600 on white 5.1:1 ✔ text*, *primary-400 on white 2.6:1 ✘ text, ✔ decoration*). APCA Lc 60–75 for body is a useful second check.
- **Dark mode**: don't invert. Surfaces at L 0.15–0.25, lower the accent's chroma 10–20 % and raise its lightness so it hits 4.5:1 on dark surfaces; the logo gets a reversed version.
- Give every colour HEX, RGB, OKLCH, CMYK (print, ask printer for profile), and Pantone if physical.
```css
:root{
  --brand-500: oklch(0.62 0.17 255); --brand-600: oklch(0.54 0.16 255);
  --ink: oklch(0.22 0.015 255); --paper: oklch(0.985 0.004 255);
}
```

## 7. Typography
- Max **2 families** (one display/brand, one text) — or one superfamily with real weight/width range. Pair by **contrast of role, harmony of structure**: similar x-height and proportions, different personality (e.g. grotesk text + humanist or serif display).
- Arabic + Latin pairing — match x-height/tooth height, stroke contrast and terminal style:
| Arabic | Latin partner | Character |
|---|---|---|
| IBM Plex Sans Arabic | IBM Plex Sans | technical, corporate, designed as a family |
| Noto Kufi Arabic | Inter / Noto Sans | geometric, neutral, strong headlines |
| Readex Pro | Readex Pro (Latin incl.) / Lexend | friendly, very readable UI |
| Cairo | Manrope | contemporary, rounded-geometric |
| Tajawal | Inter / Manrope | light, clean, compact |
  Arabic sits visually smaller: set it ~10–15 % larger or choose matching optical sizes; line-height ≥ 1.6–1.8; never letter-space Arabic; check RTL numerals choice (Arabic-Indic vs Western) per audience.
- Type scale: modular ratio 1.25 (UI) or 1.333–1.5 (marketing). E.g. 12 · 14 · 16 · 20 · 25 · 31 · 39 · 49 · 61. Headings tracking −1 to −3 %; caps labels +4 to +8 %.
- Specify: family, weights used (≤ 3), sizes, line-heights, case, tracking, and fallbacks (`font-family: "Inter", system-ui, sans-serif`). Check licences (OFL fonts above are free for commercial use).

## 8. Iconography, imagery, graphic devices
- **Icons**: one set or one custom style — grid 24, stroke 1.5 or 2 px, one corner radius, one terminal style (round vs square), consistent perspective (flat front). Derive details from the mark (its corner radius, its cut angle). Never mix sets; never use emoji as icons.
- **Imagery direction**: write rules — subject (real people at work vs objects), light (natural, soft, warm), colour grade (slight brand-hue tint in shadows), framing (lots of negative space for text), what to avoid (stock handshakes, fake screens).
- **Illustration**: define a recipe — line weight, palette subset (3–5 colours from the ramps), shading style (flat / 1 tone shadow / grain), character proportions.
- **Graphic devices** derived from the mark: repeat the symbol into a pattern (tile on its grid, rotate 90°), crop the mark huge as a supergraphic, extract the cut angle as a dividing line, use the counter shape as a frame/mask for photos. Devices make an identity recognisable without the logo.
```svg
<pattern id="p" width="24" height="24" patternUnits="userSpaceOnUse" patternTransform="rotate(15)">
  <use href="#mark" transform="scale(.4)" opacity=".12"/></pattern>
```

## 9. Voice & tone
3 voice principles mirroring the adjectives, each with *do / don't* lines ("Clear, not clever: *Export your file* — not *Let the magic happen*"). Vocabulary list (words we use / avoid), capitalisation rules (sentence case for UI), how to write errors and empty states, Arabic register (MSA vs dialect) chosen per audience.

## 10. Guidelines document outline
1. Brand story: purpose, positioning, 3 adjectives, audience
2. Logo: concept, construction grid, lockups, clear space, minimum size, colour versions, misuse (stretched, recoloured, effects, rotated, on busy photo)
3. Colour: ramps, roles, proportions, contrast pairs, dark mode, print values
4. Typography: families, scale, pairing, Arabic/Latin rules, examples
5. Iconography, illustration, photography rules with good/bad examples
6. Graphic devices, layout grids, motion principles (logo animation 0.6–1.2 s, one easing family)
7. Voice & tone
8. Applications: mockups of real touchpoints
9. Downloads and tokens

## 11. Deliverables checklist
- [ ] Logo: SVG (outlined, optimised, `viewBox`, no embedded fonts/raster), PNG @1x/2x/4x transparent, PDF/EPS for print; full colour, 1-colour black, 1-colour white, for each lockup
- [ ] Favicon set: `favicon.svg` (can include `prefers-color-scheme` style), `favicon.ico` (16/32/48), `apple-touch-icon.png` 180, `icon-192.png`, `icon-512.png`, maskable 512 with ~10 % safe padding (inner 80 % circle), `site.webmanifest`
- [ ] App icon: 1024 master, iOS (no transparency, system applies corner mask), Android adaptive (108 dp foreground/background, safe zone 66 dp)
- [ ] Social: avatar 400×400 (survives circle crop), covers (X 1500×500, LinkedIn 1584×396, YouTube 2560×1440 with 1546×423 safe area), OG image 1200×630
- [ ] Business card 85×55 mm (EU) / 3.5×2 in (US) + 3 mm bleed; letterhead A4/Letter; email signature (HTML table, PNG logo ≤ 2× size, no web fonts)
- [ ] Slide template (title, section, content, quote, data, end) 16:9
- [ ] Design tokens JSON + CSS custom properties (colour, type, spacing, radius)
- [ ] Guidelines page/PDF

## 12. Anti-slop: what makes an identity look AI-generated
Banned defaults, unless the brief truly demands them:
- purple→pink / violet→blue gradients as "the brand"; glowing orbs, lens flares, neon glow on everything
- sparkles ✨ / stars / magic wands as the AI symbol; generic brain, circuit-board, neural-node or robot-head logos; lightbulb = idea; globe = global
- random 3D blobs, iridescent chrome, gratuitous glassmorphism and backdrop blur
- Inter (or any one font) everywhere at the same weight with no hierarchy
- centred everything, symmetric card grids, emoji as icons, mixed icon sets
- meaningless abstract swoosh, initials in a circle with no idea, gradients that only work on screen
- illegible "futuristic" fonts; text effects (bevel, outer glow, drop shadow) on logos
Do instead:
- one idea per mark, drawn on a grid with optical corrections; passes 16 px and 1-colour tests
- flat solid colour; a palette grounded in the 3 adjectives and the competitor gap (earthy greens, ink blues, warm reds, off-whites — not default violet)
- typographic hierarchy: weight, size and space contrast; asymmetric, grid-based layouts with real alignment
- graphic devices derived from the mark; real photography/illustration direction; real copy in mockups
- restraint: fewer elements, executed precisely, beats more elements executed loosely
