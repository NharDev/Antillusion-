# Game feel & juice: the numbers that make controls and feedback feel great
tags: game feel juice polish controls platformer jump coyote buffer screen shake hit stop particles easing camera sound feedback tutorial difficulty flow لعبه العاب احساس لمسه جمالية تحكم قفز اهتزاز شاشه جزيئات صوت تغذيه راجعه صعوبه

## Movement (platformer / top-down)
- **Acceleration, not instant speed**: `vx += (target - vx) * (1 - exp(-accel*dt))`; ground accel ≈ 0.08 s to full speed, friction ≈ 0.06 s to stop, air control ≈ 60 % of ground.
- **Variable jump**: apply gravity ×2–3 when the button is released while rising (short hop vs full jump). Jump apex hang: reduce gravity ×0.5 near velocity 0.
- **Coyote time** 0.08–0.12 s (can still jump just after leaving a ledge); **jump buffer** 0.10–0.14 s (jump pressed just before landing still fires); **corner correction** (nudge ≤ 4 px around ceiling/ledge corners).
- Max fall speed cap; fast-fall option; one-way platforms; slopes treated as flat for input.
- Top-down: normalise diagonals, tiny dash with i-frames, aim assist cone for gamepad.
- Typical values (px, 60 Hz, 16 px tile): run 180–260 px/s, jump height 3.5–4.5 tiles, gravity 1800–2400 px/s², jump velocity ≈ √(2·g·h).

## Impact feedback ("juice") — use 3 of these per important action
| Effect | Recipe |
|---|---|
| Hit-stop | freeze gameplay 50–90 ms on hit (not the particles/UI) |
| Screen shake | `offset = rand(-1,1) * amp * trauma²`, trauma decays ~1.5/s; amp 4–14 px; add trauma 0.3–0.6 per hit |
| Squash & stretch | scale (1.25, 0.8) on landing, (0.8, 1.25) on jump, ease back in 0.12 s |
| Flash | draw sprite white for 2–3 frames on damage |
| Particles | 6–20 short-lived (0.2–0.5 s) with velocity away from impact, fading size/alpha; dust on landing/turning |
| Knockback / recoil | brief impulse away from the source; camera kick opposite to fire |
| Trails & afterimages | for dashes/projectiles (ring buffer of last 6 positions) |
| Number pops | damage numbers rising and fading (0.6 s), bigger for crits |
| Sound | layer 2–3 sounds per hit (transient + body + tail), ±5 % random pitch so repeats don't fatigue; sound ≤ 50 ms after input |
| Slow-mo | timeScale 0.3 for 0.2 s on boss kill / last-enemy |
| Camera | smooth follow `1-exp(-8dt)`, lookahead 60–120 px in facing direction, zoom punch +3 % on big hits |

## UI feedback
Buttons: hover/press scale 1.04/0.97 with 80 ms ease; score counters tick up (`fx.counter`); toasts slide in; menu transitions 150–250 ms; every click has a sound; show cooldowns radially; low-health vignette pulse; never block input with long animations (skippable).

## Readability
Contrast between player, enemies, hazards, pickups and background (value first, hue second); telegraph dangerous things (flash, sound, shadow) ≥ 0.4 s before they hurt; limit on-screen particles that hide hazards; colour-blind safe (shapes + colours).

## Difficulty & flow
Introduce one new idea at a time in a safe space, then test, then combine. Checkpoints before hard sections; instant restart (< 1 s); optional assist modes; keep failure cheap and learning visible. Aim for ~70 % first-try success on early levels and rising challenge. Tutorials = level design (an unavoidable pit teaches jumping), text only when necessary.

## Audio & music
Adaptive layers (add percussion at intensity), stingers on events, silence before big moments, mute/volume sliders. Procedural WebAudio: oscillator `square/triangle` + exponential gain envelope (5 ms attack, 80–200 ms decay) + pitch slide for jumps/coins; noise burst + lowpass sweep for explosions.

## Polish pass checklist
Title screen with animation · pause/resume/restart · screen transitions · every action has sound + visual response · consistent palette & pixel scale · save + best score · gamepad + touch · loading state · favicon/title · no console errors · 60 fps on a mid laptop · playtested by someone new.
