# Cinematic direction: shot language, camera, lighting, sound and cutscenes (screen + in-game)
tags: cinematic cutscene camera shot film director trailer storyboard lighting color grading editing sound design letterbox dolly parallax dialogue scene shot list سينمائي مشهد كاميرا لقطه اخراج تصوير اضاءه الوان مونتاج صوت ستوريبورد حوار تريلر

## Shot list first
Format: `# | shot size | angle | camera move | duration | what happens | sound`. One idea per shot; 2–6 s each (action 1–3 s, emotion 4–8 s). 10 s of film ≈ 3–6 shots.

## Shot sizes & meaning
Extreme wide (scale, isolation) · Wide/establishing (where) · Medium (conversation, body language) · Close-up (emotion) · Extreme close-up (detail, tension: an eye, a trembling hand, a dial) · Over-the-shoulder (dialogue connection) · POV (identification) · Insert (object that matters).
Angles: low = power/threat, high = vulnerability, dutch tilt = unease, eye-level = neutral.

## Camera moves
Push-in (focus, dread, realisation) · Pull-out (reveal, isolation) · Pan/tilt (follow/reveal) · Dolly/track (immersion) · Crane/rise (scale) · Handheld/shake (urgency) · Static (control, awkwardness) · Rack focus (shift attention) · Parallax (depth from layers moving at different speeds: far 0.1×, mid 0.3×, near 1×). In code: `cam.drift` for slow pushes, `cam.shake` for impacts, `Cine.parallax` for depth.

## Composition & lighting
Rule of thirds, leading lines, foreground framing, negative space for dread. Motivated light (a dial, a window, a screen) beats flat light. Contrast = drama; backlit silhouettes hide identity (great for reveals). Colour language: warm amber = comfort/nostalgia; teal/blue = cold/tech/loneliness; red = danger/passion; green = sickness/uncanny; desaturate for despair, saturate for joy. Limit palette to 3 hues + neutrals; use `Cine.grade(tint, alpha)` for a unified look; add vignette and subtle grain to feel filmic.

## Editing rhythm
Cut on action; vary shot length (short = tension, long = intimacy); match cuts (shape/motion), smash cuts for shock, J/L cuts (sound leads/trails image), cross-dissolve = time passing, fade to black = ending/death, flash cut = trauma. Hold the last frame a beat before the title.

## Sound design (half of the film)
Room tone under every scene (silence feels wrong), foley hits on actions, a motif (3–4 notes) for the central idea, risers into reveals, a sudden drop-out of sound before a shock, diegetic sound (radio, rain) that becomes score. Dialogue always intelligible: duck music −8 dB. `M.sfx('riser'|'boom'|'whoosh'|'hit'…)` and `M.music({style:'cinematic'})`.

## Title cards, subtitles, dialogue
Title: short, letter-spaced, 1.5–3 s fade-up, tagline smaller. Subtitles: max 2 lines, ≤ 42 chars/line, 1–7 s on screen, never cover faces; inside the letterbox picture. Dialogue box (game-style): name tag + typewriter 25–40 chars/s, click/▼ to advance.

## A scene in code (Motion + Cine)
1. Write the shot list and the lines.
2. One `M.scene` per shot; use `layer` for a global letterbox/grain scene.
3. Camera per shot (`cam.drift`), parallax layers, silhouettes/props, light flicker with `Math.sin(t*31)*Math.sin(t*7)`.
4. Text via `Cine.subtitle/dialogue`, audio via `M.sfx/M.music`.
5. Check frames at each shot start/mid/end with `video.renderFrame(t)`; export.

## In-game cutscenes (Canvas/three.js/Phaser)
Drive them with a timeline of keyed events (`[{t:0,cam:{…}},{t:2,say:{who,text}},{t:5,anim:'door.open'}]`) evaluated against a clock, so they can be skipped (jump to end state), paused, replayed, and are deterministic. Always provide a skip button (hold Esc) and subtitles on by default. Letterbox in/out (0.6 s) signals control being taken from the player. Keep cutscenes under 60 s; prefer in-engine scenes with the real assets over pre-rendered video.
Three.js: `camera.position.lerpVectors(a,b,ease(t))`, `camera.lookAt(target)`, CatmullRomCurve3 for camera rails, `THREE.AnimationMixer` for characters, EffectComposer (bloom, film, vignette) for the look.
