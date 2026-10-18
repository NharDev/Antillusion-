# UI design system and visual quality
tags: design ui ux typography color spacing layout dark mode animation polish beautiful style theme تصميم واجهه مظهر الوان خطوط جميل انيق ثيم

Decide before coding: a point of view (editorial, technical, playful, luxurious, brutalist…), one display + one text typeface, a restrained palette (1 neutral ramp, 1 accent, semantic success/warn/danger), a spacing scale and one radius family. Consistency beats decoration.

Typography: scale ~1.2–1.333 (e.g. 12, 14, 16, 20, 24, 32, 48, 64). Line-height 1.5 body / 1.1–1.25 headings; tighten letter-spacing on large headings (−0.01 to −0.03em); `text-wrap: balance` on headings, `pretty` on paragraphs; `font-variant-numeric: tabular-nums` for numbers in tables. Arabic: IBM Plex Sans Arabic, Noto Sans/Kufi Arabic, Tajawal, Cairo, Readex Pro; line-height ≥ 1.7; never letter-space Arabic.

Colour: define in OKLCH or HSL tokens; surfaces in 3 levels (page, card, raised); text in 3 levels (primary, secondary, muted); borders subtle (≈ 8–12% contrast). Dark theme is not inverted light: lower saturation, elevation by lighter surface rather than shadow. Check contrast.

Layout: generous whitespace; align to a grid; group by proximity; one primary action per view; consistent 8px rhythm. Responsive breakpoints from content (≈ 480 / 768 / 1024 / 1280). Empty, loading (skeleton), error and success states are part of the design.

Depth and motion: layered soft shadows (`0 1px 2px rgb(0 0 0/.06), 0 8px 24px rgb(0 0 0/.08)`), 150–250 ms ease-out transitions on transform/opacity only; one orchestrated entrance beats many scattered effects; respect `prefers-reduced-motion`.

Components checklist: buttons (primary/secondary/ghost/danger; hover, active, focus-visible, disabled, loading), inputs (label, hint, error), cards, modal (`<dialog>`, focus trap, Esc), toast, tabs, table (sticky header, zebra or dividers, right-aligned numbers), nav (current state), tooltip.

Avoid the generic look: default system-blue buttons on white, purple gradients everywhere, uniform card grids with emoji icons, centred everything, lorem ipsum. Use real copy, real data shapes and a distinctive type pairing.

## Avoiding generic AI-looking UI
Banned defaults (use only when the brief explicitly asks for them):
- purple / pink / violet gradients, gradient backgrounds behind everything, neon glows and "aurora" blobs
- gradient text on every heading; glowing borders; animated shimmer on static content
- emoji used as icons; mixing icon sets (Lucide + Heroicons + emoji) or stroke widths
- everything centred: hero, cards, paragraphs, footers — centred long text is hard to read
- uniform grids of identical rounded cards with drop shadows and an icon + title + 2 lines each
- meaningless sparkle ✨ / star / magic-wand / brain / robot / rocket icons for "AI" or "fast"
- fake glassmorphism and `backdrop-filter: blur` on every surface; layered translucent panels with no purpose
- low-contrast grey-on-grey text (body must reach 4.5:1), tiny 12 px light-weight copy
- placeholder copy ("Lorem ipsum", "Feature 1", "Unlock your potential"), fake stats, stock 3D illustrations

Do instead:
- **Restrained palette**: a neutral ramp lightly tinted toward the brand hue + **one accent** chosen for this brand (not default violet), plus semantic colours. Accent ≈ 10 % of the surface: primary actions, selection, focus, key data.
- **Real hierarchy** through size, weight and space, not colour and effects: one clear H1, 2–3 text levels, generous space between groups and tight space within them. Left-align text; use a grid with deliberate asymmetry.
- **Purposeful motion**: animate state changes (open, add, remove, reorder) 150–250 ms with one easing family; no decorative perpetual animation.
- **One icon set, one stroke width** (e.g. Lucide at 1.75 or 2 px, 16/20/24 sizes), icons only where they speed recognition, always with a label or tooltip.
- **Real content**: realistic names, numbers, dates, lengths of text and empty/error states; design with the longest plausible string and RTL.
- **Density appropriate to the task**: dashboards and tools are compact (32–36 px rows, 13–14 px text); marketing pages breathe; settings forms sit in between.
- **Details that signal craft**: `tabular-nums` for changing numbers and table columns, right-aligned numerals, aligned baselines across side-by-side elements, icons optically centred (nudge play/arrow glyphs toward their visual mass, size icons to the cap height of adjacent text), consistent 1 px hairlines, nested radii (`inner = outer − padding`), focus-visible rings, real hover/pressed/disabled states, and no orphaned single words in headings (`text-wrap: balance`).
- See `design-systems` (tokens, ramps, states) and `brand-identity` (picking the accent, type and devices) cards.
