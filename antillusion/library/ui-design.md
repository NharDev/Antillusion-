# UI design system and visual quality
tags: design ui ux typography color spacing layout dark mode animation polish beautiful style theme تصميم واجهه مظهر الوان خطوط جميل انيق ثيم

Decide before coding: a point of view (editorial, technical, playful, luxurious, brutalist…), one display + one text typeface, a restrained palette (1 neutral ramp, 1 accent, semantic success/warn/danger), a spacing scale and one radius family. Consistency beats decoration.

Typography: scale ~1.2–1.333 (e.g. 12, 14, 16, 20, 24, 32, 48, 64). Line-height 1.5 body / 1.1–1.25 headings; tighten letter-spacing on large headings (−0.01 to −0.03em); `text-wrap: balance` on headings, `pretty` on paragraphs; `font-variant-numeric: tabular-nums` for numbers in tables. Arabic: IBM Plex Sans Arabic, Noto Sans/Kufi Arabic, Tajawal, Cairo, Readex Pro; line-height ≥ 1.7; never letter-space Arabic.

Colour: define in OKLCH or HSL tokens; surfaces in 3 levels (page, card, raised); text in 3 levels (primary, secondary, muted); borders subtle (≈ 8–12% contrast). Dark theme is not inverted light: lower saturation, elevation by lighter surface rather than shadow. Check contrast.

Layout: generous whitespace; align to a grid; group by proximity; one primary action per view; consistent 8px rhythm. Responsive breakpoints from content (≈ 480 / 768 / 1024 / 1280). Empty, loading (skeleton), error and success states are part of the design.

Depth and motion: layered soft shadows (`0 1px 2px rgb(0 0 0/.06), 0 8px 24px rgb(0 0 0/.08)`), 150–250 ms ease-out transitions on transform/opacity only; one orchestrated entrance beats many scattered effects; respect `prefers-reduced-motion`.

Components checklist: buttons (primary/secondary/ghost/danger; hover, active, focus-visible, disabled, loading), inputs (label, hint, error), cards, modal (`<dialog>`, focus trap, Esc), toast, tabs, table (sticky header, zebra or dividers, right-aligned numbers), nav (current state), tooltip.

Avoid the generic look: default system-blue buttons on white, purple gradients everywhere, uniform card grids with emoji icons, centred everything, lorem ipsum. Use real copy, real data shapes and a distinctive type pairing.
