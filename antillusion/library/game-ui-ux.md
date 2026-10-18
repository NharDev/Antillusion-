# Game UI & UX: HUD, gamepad-navigable menus, settings, onboarding, readable and juicy interfaces
tags: game ui ux hud menu main menu pause menu settings options gamepad navigation focus spatial navigation 10 foot tv safe area subtitles accessibility colour blind onboarding tutorial game over damage numbers minimap inventory grid dialogue box typography icons tweening لعبه العاب واجهه قائمه قوائم اعدادات خيارات ترجمه نصوص وصول عمي الوان تعليم دليل خريطه مخزون حوار خط ايقونات

## Principles
- **Diegetic hierarchy**: show only what the player needs now. HUD corners for persistent info (health top-left, resources top-right, minimap top/bottom-right, prompts bottom-centre). Fade non-critical HUD after 3–5 s of no change.
- **Every screen works with: gamepad only, keyboard only, mouse only, touch only** (for the platforms you ship).
- **Readable first, pretty second**: contrast, size, motion that clarifies state changes.
- UI time ≠ game time: menus animate while the game is paused (use unscaled/real delta).

## Gamepad-navigable menus
| Rule | Detail |
|---|---|
| Default focus | every screen opens with a focused element (Resume, Continue, the last-used option) — never "nothing focused" |
| Visible focus | strong focus state (outline + scale 1.04 + colour), not hover-only; one focused element at a time |
| Spatial navigation | d-pad / left stick moves to the nearest element in that direction; explicit neighbours override for tricky layouts |
| Wrap | wrap within linear lists (bottom → top); don't wrap across grids' rows unless the grid is a carousel |
| Back = cancel | B / ○ / (Nintendo B) / Esc / browser back closes the current layer and **restores focus** to the element that opened it |
| Confirm | A / ✕ / (Nintendo A) / Enter / Space / click |
| Tabs | LB/RB (L1/R1, L/R, Q/E) switch tabs; LT/RT for sub-tabs or page jumps |
| Repeat | holding a direction repeats after 400 ms, then every 80–120 ms; sliders accelerate after 1 s |
| Sliders | left/right changes value (step 5 % or 1 unit), confirm not needed |
| Mouse/touch | hovering moves focus; focus stays where the mouse left it when switching back to pad |
| Focus stack | modal dialogs trap focus; the stack of opened layers is explicit (push/pop) |
| Prompts bar | bottom bar shows the active actions with glyphs: "Ⓐ Select  Ⓑ Back  Ⓨ Reset" |

### Vanilla-JS spatial navigation
```js
// Elements with [data-nav] are focusable. Call move('up'|'down'|'left'|'right') from keyboard/gamepad.
const DIRS = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };
export function move(dir, root = document.querySelector('.screen.active')) {
  const items = [...root.querySelectorAll('[data-nav]:not([disabled])')].filter(e => e.offsetParent);
  const cur = document.activeElement?.closest('[data-nav]') ?? null;
  if (!cur || !items.includes(cur)) return items[0]?.focus();
  const explicit = cur.dataset['nav' + dir[0].toUpperCase() + dir.slice(1)]; // data-nav-up="#id"
  if (explicit) return root.querySelector(explicit)?.focus();
  const [dx, dy] = DIRS[dir], a = cur.getBoundingClientRect();
  const ax = a.left + a.width / 2, ay = a.top + a.height / 2;
  let best = null, bestScore = Infinity;
  for (const el of items) {
    if (el === cur) continue;
    const b = el.getBoundingClientRect(), bx = b.left + b.width / 2, by = b.top + b.height / 2;
    const along = (bx - ax) * dx + (by - ay) * dy;            // distance in the pressed direction
    if (along <= 1) continue;                                 // must be ahead of us
    const across = Math.abs((bx - ax) * dy) + Math.abs((by - ay) * dx); // off-axis distance
    const score = along + across * 2.5;                       // penalise off-axis candidates
    if (score < bestScore) { bestScore = score; best = el; }
  }
  if (best) return best.focus();
  if (cur.closest('[data-wrap]')) {                           // wrap inside lists marked data-wrap
    const list = [...cur.closest('[data-wrap]').querySelectorAll('[data-nav]')];
    (dy > 0 || dx > 0 ? list[0] : list.at(-1))?.focus();
  }
}
```
Use real `<button>`s (`tabindex="0"`) so Enter/Space/screen readers work; style `:focus-visible`. Keep a `focusStack` of `{screen, lastFocused}` to restore focus on Back.

## Text size and screen distance
| Context | Minimum body text | Comfortable |
|---|---|---|
| TV / console, 10-foot (1080p reference) | ~24–28 px (Xbox accessibility guidance commonly cited at 26 px) | 28–32 px; headings 40–56 px |
| Steam Deck (1280×800, 7") | ~9 px absolute floor (Valve guidance) | ≥ 12–14 px; test on the device |
| PC monitor (1080p) | 16 px | 18–20 px for HUD numbers |
| Phone (CSS px / dp) | 14–16 | 16–18; buttons ≥ 44 pt / 48 dp |
Provide a text-size setting (at least 3 steps, 100–150 %+). Scale the UI by `min(w/1920, h/1080)` relative to a 1080p reference.

## Safe areas
TVs may overscan: keep critical HUD/text inside **title-safe ≈ 90 %** (5 % margins) and interactive elements in **action-safe ≈ 93 %**; consoles provide a system safe-area value — use it, and offer a "screen edge" calibration on first boot. Phones: CSS `env(safe-area-inset-*)` (with `viewport-fit=cover`), or engine safe-area APIs; avoid notches/home indicator.

## Settings menu checklist
- **Graphics**: display mode (windowed/borderless/fullscreen), resolution, render scale / dynamic resolution / upscaler, frame cap (30/60/120/unlimited) and VSync, quality presets + individual options (shadows, textures, effects, AA, post), FOV slider (60–110°), brightness/gamma calibration screen, motion blur toggle, film grain/chromatic aberration toggles.
- **Audio**: Master, Music, SFX, Voice, UI buses (0–100), mute when unfocused, output mode (stereo/headphones/mono), subtitles toggle lives here *and* in Accessibility.
- **Controls**: rebinding per device (keyboard, gamepad), sensitivity X/Y, invert X/Y, deadzones, vibration intensity, aim assist, hold/toggle per action, reset to defaults.
- **Accessibility**: subtitles (on by default, size S/M/L/XL, background box opacity 0–100 %, speaker names, colour per speaker), closed captions for important sounds, colour-blind modes (protanopia/deuteranopia/tritanopia filters **plus** shapes/patterns — filters alone are not enough), high-contrast HUD, screen-shake and camera-bob toggles/sliders, flashing reduction, reduce motion, hold-to-toggle, QTE/mashing alternatives, game speed slider, difficulty assists (damage taken, aim assist, skip puzzle/combat, invulnerability), text-to-speech/menu narration where possible, UI scale, dyslexia-friendly font option.
- **Gameplay**: language, difficulty (changeable any time, no shaming labels), HUD element toggles, camera options, tutorial hints on/off.
- Apply immediately with preview where possible; "Revert in 10 s" confirmation for display-mode changes; persist on change; "Reset section to defaults".

## Onboarding and tutorials
Teach by doing: introduce one verb in a safe space → test it with low stakes → combine with earlier verbs. Prompt contextually (show "Ⓐ Jump" only near the first gap, hide after 2–3 successful uses). No walls of text; ≤ 1 short sentence per prompt; let players re-read controls from the pause menu. Detect struggle (3 deaths at the same spot) and offer a hint or assist. Skippable tutorial for returning players. First 60 seconds: player is moving and doing the core verb within 10–20 s of pressing Start.

## Pause, game-over and flow screens
- **Pause**: freezes game time, ducks/low-passes audio, stops rumble; items: Resume (default focus), Settings, Controls, Restart (confirm), Quit to Menu (confirm, warn about unsaved progress). "Quit to Desktop" only on PC (hide on consoles/iOS). Pause on focus loss, controller disconnect, app backgrounding.
- **Game over**: show cause of death and what to try, key stats, **Retry focused by default**, ignore input for 400–600 ms so mashing doesn't skip it, < 1 s to restart.
- **Victory / results**: tally numbers counting up (0.6–1.2 s, skippable), best-score badge, next/continue default.
- **Loading**: progress or spinner always moving; tips; never a frozen frame.
- **Confirm dialogs**: destructive option never default-focused; Back = cancel.

## HUD elements
- **Health/resources**: bars with delayed "damage chunk" (white segment shrinking after 0.3–0.5 s), numeric value optional; low-health warning via vignette + sound, not colour alone.
- **Damage numbers**: pooled; spawn at hit point + random x ±10 px; rise 30–60 px over 0.6–0.8 s with ease-out; scale pop 1.4 → 1.0 in 100 ms; fade last 30 %; crits larger + different colour + icon; merge rapid hits on one target into one ticking number; cap ~30 on screen; toggle in settings.
- **Minimap**: north-up (simpler) or player-up; icon size constant regardless of zoom; clamp off-screen objectives to the edge with an arrow; fog of war; legend; 15–20 % of screen height max. Compass bar is a lighter alternative.
- **Objective markers**: world-space icon + distance, fade when close (< 5 m) and when aiming.
- **Crosshair**: centre dot + dynamic spread; hit marker (short X, 80–120 ms) + sound; colour/size options.
- **Off-screen threat indicators**: arrows around the screen edge pointing to attackers (also helps deaf/HoH players).

## Inventory grids
Grid cells 64–96 px (10-foot: 96–128), consistent icon framing, rarity shown by **colour + border shape/pattern**, stack count bottom-right, new-item dot. Pad: move focus with d-pad, A = select/use, X = drop/sort, Y = details; moving an item = "pick up" then "place" (two presses), not drag. Mouse: drag + right-click context menu; tooltips after 300 ms hover, with comparison to equipped (green ↑ / red ↓ arrows). Sort/filter tabs on LB/RB. Never lose an item on accidental input (confirm drops of rare items).

## Dialogue boxes
Bottom of screen, max 3 lines, ~40–60 characters per line, speaker name + portrait, text 1.2× HUD size. Typewriter at 30–60 chars/s (setting includes "instant"); first press completes the line, second advances; "next" indicator bounces when ready. Pauses on punctuation (`. ! ?` 150–250 ms, `,` 60–100 ms). Backlog/log screen, auto-advance and skip-seen options. Choices: 2–4 options, default focus on the first, no timer unless optional. Keep text in string tables by ID (localisation).

## Motion timings (UI juice)
| Interaction | Duration | Easing |
|---|---|---|
| Hover / focus | 80–120 ms | ease-out; scale 1.03–1.06 |
| Press | 50–80 ms down, 120 ms back | scale 0.95–0.97 |
| Toast / notification in | 200–250 ms, stays 2–4 s | ease-out (back-out for playful) |
| Panel / screen transition | 200–350 ms | ease-in-out; slide 20–40 px + fade |
| List stagger | 30–50 ms per item, max ~8 items staggered | ease-out |
| Number counter | 400–1200 ms | ease-out (fast then settle) |
| Reward pop (level up) | 300–500 ms scale 0 → 1.15 → 1.0 + particles + sound | back-out |
Entering: ease-out; leaving: ease-in, faster (≈ 70 % of enter time). Never block input during animations — inputs during a transition should complete it instantly. Respect a reduce-motion setting (`prefers-reduced-motion` on web).

## Typography
Max two families (display + body). Body font with large x-height and open apertures; avoid thin weights on TV. Tabular (monospaced) numerals for timers/scores so digits don't jitter (`font-variant-numeric: tabular-nums`). HUD text over 3D/busy scenes: 1–2 px outline or soft shadow, or a 40–70 % dark backing plate. Contrast ≥ 4.5:1 for body, ≥ 3:1 for large text. Avoid ALL CAPS for paragraphs; fine for short labels. Ensure the font covers every shipped language (Arabic shaping/RTL, CJK).

## Iconography
One style (stroke or filled, consistent stroke width, e.g. 2 px at 24 px), drawn on a grid (24/32/48/64), pixel-snapped for pixel art. Silhouette test: recognisable as a solid black shape at 50 % size. Label icons the first time (or on focus). Same icon = same meaning everywhere. Don't rely on colour alone (status = colour + shape). Platform button glyphs only from the correct platform family (see `game-input-platforms`).

## Main menu and first boot
- Title screen: animated background (gameplay or parallax), logo, "Press any button" on console/TV (also detects the active device), straight to the menu on PC/mobile.
- Order: **Continue** (default focus when a save exists) · New Game · Load · Settings · Extras/Credits · Quit (PC only). Max 5–7 items.
- First boot: language → subtitles/text size → brightness/safe-area calibration (TV) → straight into play; everything else lives in Settings.
- Show a save indicator icon (spinning, corner) whenever saving; never quit during it.

## Common UI mistakes to check before shipping
| Mistake | Fix |
|---|---|
| Mouse-only menus (hover tooltips, drag-only inventory) | focus-based navigation + button alternatives |
| Keyboard glyphs while using a pad (or Xbox glyphs on a PlayStation pad) | glyphs from the last-used device family |
| Text baked into images | string tables + live text, so it can be localised and scaled |
| HUD overlapping the safe area / notch | anchor to safe-area insets |
| Colour-only state (red = enemy, green = ready) | add shape, icon or label |
| Tiny click targets on touch | ≥ 44 pt / 48 dp, 8 dp spacing |
| Unskippable animations and dialogue | press to complete, hold to skip, settings for speed |
| Losing focus after closing a dialog | focus stack restores the opener |
| Numbers jittering in timers/counters | tabular numerals, fixed-width containers |
