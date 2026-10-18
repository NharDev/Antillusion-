# Game audio: procedural WebAudio SFX, mixing buses, ducking, adaptive music, spatial sound, middleware, loudness, accessibility
tags: audio sound sfx music webaudio web audio oscillator noise envelope gain bus mixer ducking adaptive music layers stingers spatial panner 3d sound howler tone.js zzfx fmod wwise godot audiobus unity audiomixer unreal metasounds voice dialogue barks loudness lufs subtitles captions لعبه العاب صوت اصوات موسيقي مؤثرات صوتيه مكساج مستوي صوت حوار ترجمه

## Context, unlock, master chain
```js
const ctx = new (window.AudioContext || window.webkitAudioContext)();
const unlock = () => { if (ctx.state !== 'running') ctx.resume(); };
addEventListener('pointerdown', unlock); addEventListener('keydown', unlock); // autoplay policy: needs a gesture
// buses: master ← compressor ← {music, sfx, ui, voice}
const master = ctx.createGain(), comp = ctx.createDynamicsCompressor();
comp.threshold.value = -12; comp.knee.value = 6; comp.ratio.value = 4; comp.attack.value = 0.003; comp.release.value = 0.25;
master.connect(comp).connect(ctx.destination);
const bus = Object.fromEntries(['music', 'sfx', 'ui', 'voice'].map(n => { const g = ctx.createGain(); g.connect(master); return [n, g]; }));
// slider 0..1 → perceptual gain (−60 dB..0 dB); 0 = true mute
const setVolume = (name, s) => { const g = s <= 0 ? 0 : 10 ** ((-60 + 60 * s) / 20);
  (name === 'master' ? master : bus[name]).gain.setTargetAtTime(g, ctx.currentTime, 0.02); };
document.addEventListener('visibilitychange', () => document.hidden ? ctx.suspend() : ctx.resume());
```
Never set `.value` while a ramp is scheduled; use `setTargetAtTime` / `linearRampToValueAtTime` for clicks-free changes. `exponentialRampToValueAtTime` cannot reach 0 — ramp to 0.0001.

## Procedural SFX helpers
```js
function tone({ type = 'square', f0 = 440, f1 = f0, dur = 0.15, vol = 0.3, attack = 0.005, out = bus.sfx, at = ctx.currentTime }) {
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.type = type; o.frequency.setValueAtTime(f0, at);
  if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(f1, at + dur);
  g.gain.setValueAtTime(0.0001, at); g.gain.exponentialRampToValueAtTime(vol, at + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
  o.connect(g).connect(out); o.start(at); o.stop(at + dur + 0.02);
}
const noiseBuf = (() => { const b = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate), d = b.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; return b; })();
function noise({ dur = 0.3, vol = 0.5, type = 'lowpass', fStart = 3000, fEnd = 100, q = 1, out = bus.sfx, at = ctx.currentTime }) {
  const s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
  s.buffer = noiseBuf; f.type = type; f.Q.value = q;
  f.frequency.setValueAtTime(fStart, at); f.frequency.exponentialRampToValueAtTime(fEnd, at + dur);
  g.gain.setValueAtTime(vol, at); g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
  s.connect(f).connect(g).connect(out); s.start(at); s.stop(at + dur + 0.02);
}
const vary = (x, pct = 0.05) => x * (1 + (Math.random() * 2 - 1) * pct);   // ±5 % pitch so repeats don't fatigue
```

## Recipes (parameters for the helpers above)
| Sound | Recipe |
|---|---|
| Jump | `tone({ type:'square', f0: vary(220), f1: 660, dur: 0.14, vol: 0.25 })` (rising sweep; triangle for softer) |
| Double jump | same, f0 330 → f1 990, dur 0.10 |
| Coin / pickup | `tone({ f0: 988, dur: 0.07 })` then `tone({ f0: 1319, dur: 0.25, at: t + 0.07 })` (B5 → E6) |
| Power-up | arpeggio of 4–6 notes, 50–60 ms apart, rising (C E G C' …), square, vol 0.2 |
| Hit / punch | `noise({ dur: 0.08, type:'highpass', fStart: 1500, fEnd: 800, vol: 0.5 })` + `tone({ type:'triangle', f0: 160, f1: 60, dur: 0.10, vol: 0.6 })` |
| Player hurt | `tone({ type:'sawtooth', f0: 300, f1: 80, dur: 0.25 })` + short noise; duck music briefly |
| Explosion | `noise({ dur: 0.9, fStart: 3000, fEnd: 80, vol: 0.8 })` + sub `tone({ type:'sine', f0: 70, f1: 30, dur: 0.6, vol: 0.8 })`; big ones: add 40 ms delayed crackle noise (bandpass 2 kHz) |
| Laser / shot | `tone({ type:'sawtooth', f0: vary(1500), f1: 200, dur: 0.15, vol: 0.2 })` (square for retro) |
| UI click | `tone({ type:'sine', f0: 1200, dur: 0.03, vol: 0.15, out: bus.ui })` or `noise({ dur: 0.015, type:'bandpass', fStart: 3000, fEnd: 3000, q: 4 })` |
| UI hover / move | `tone({ type:'triangle', f0: 800, dur: 0.02, vol: 0.06, out: bus.ui })` |
| UI back / error | two descending tones 440 → 330, 60 ms each |
| Footstep | `noise({ dur: 0.05, type:'lowpass', fStart: vary(900, 0.15), fEnd: 300, vol: 0.2 })`, alternate L/R pitch |
| Engine / hum | looping oscillator (sawtooth 60–120 Hz) through lowpass; map speed → frequency + filter cutoff |
For ready-made procedural sounds: **ZzFX** (tiny, parameter arrays) or **jsfxr/sfxr** (generate, export WAV). For quality, record/buy samples and use the helpers only for prototyping and UI.

## Samples: loading, playing, voice limiting
```js
const buffers = {};
async function load(name, url) { buffers[name] = await ctx.decodeAudioData(await (await fetch(url)).arrayBuffer()); }
const playing = {};                                                  // name → active sources
function play(name, { vol = 1, rate = vary(1), out = bus.sfx, max = 6 } = {}) {
  const list = (playing[name] ??= []); if (list.length >= max) list.shift().stop(); // steal oldest
  const s = ctx.createBufferSource(), g = ctx.createGain(); s.buffer = buffers[name]; s.playbackRate.value = rate;
  g.gain.value = vol; s.connect(g).connect(out); s.start(); list.push(s);
  s.onended = () => list.splice(list.indexOf(s), 1); return s;
}
```
- Formats: Opus (WebM/Ogg) is smallest; ship an AAC (`.m4a`) or MP3 fallback for older Safari. Short SFX can be WAV/OGG; music streamed or decoded lazily.
- Limit instances per sound (4–8), per bus (~32 total), and add ±2 dB volume / ±5 % pitch randomisation or 3–5 round-robin variants.
- Don't use `<audio>` elements for loops (gaps) or rapid SFX (latency); fine for long streamed music via `createMediaElementSource`.

## Ducking
```js
function duck(target = bus.music, amount = 0.35, attack = 0.05, hold = 1.5, release = 0.4) {
  const t = ctx.currentTime, p = target.gain;
  p.cancelScheduledValues(t); p.setTargetAtTime(p.value * amount, t, attack / 3);
  p.setTargetAtTime(musicLevel, t + hold, release / 3);          // musicLevel = user's slider value
}
```
Duck music −6 to −12 dB under dialogue; duck SFX slightly under critical voice lines; low-pass music (~800 Hz) in pause menus and underwater.

## Adaptive music
- **Vertical layering**: stems of equal length (drums, bass, pads, melody, combat percussion) started at the **same `ctx.currentTime`** with `loop = true`; crossfade layer gains by intensity (0–1) over 1–2 s.
- **Horizontal re-sequencing**: sections (explore, tension, combat, victory) switch at the next bar: `next = start + Math.ceil((ctx.currentTime - start) / barLen) * barLen` where `barLen = 60 / bpm * beatsPerBar`; schedule the new section at `next`, fade the old over 1 beat.
- **Stingers**: short one-shots (level up, discovery, death) quantised to the next beat, music ducked under them.
- Seamless loops: `src.loop = true; src.loopStart / loopEnd` in seconds; export loops with tails handled (or crossfade).
- Tone.js `Transport` schedules bars/beats musically; good for generative music.
- Silence is a tool: drop music before boss reveals; return gradually.

## Spatial audio
```js
const p = new PannerNode(ctx, { panningModel: 'HRTF', distanceModel: 'inverse', refDistance: 1, maxDistance: 50, rolloffFactor: 1,
  coneInnerAngle: 360 });
src.connect(p).connect(bus.sfx);
p.positionX.value = x; p.positionY.value = y; p.positionZ.value = z;           // update per frame (or setTargetAtTime)
const L = ctx.listener; L.positionX.value = cam.x; /* … */ L.forwardX.value = fwd.x; /* … */ L.upY.value = 1;
```
- 2D games: `StereoPannerNode` with `pan = clamp((x - camX) / (viewWidth / 2), -1, 1) * 0.8` plus distance-based gain; cheaper than HRTF.
- HRTF per source is expensive — use `'equalpower'` for many sources, HRTF for a few important ones. No built-in Doppler; fake with `playbackRate`.
- Occlusion: lowpass cutoff 800–2000 Hz + −6 dB when a wall blocks line of sight. Reverb: `ConvolverNode` with a small impulse response on a send bus.
- three.js: `AudioListener` on the camera, `PositionalAudio` on objects (wraps PannerNode).

## Libraries and middleware
| Tool | Use |
|---|---|
| **Howler.js** | web: `new Howl({ src: ['sfx.webm', 'sfx.mp3'], sprite: { jump: [0, 300], coin: [400, 250] } })`, `.play('jump')`, global `Howler.volume()`, spatial plugin; handles unlock and fallbacks |
| **Tone.js** | web synthesis, effects, musical scheduling (`Tone.start()` on a gesture, `Tone.Transport`) |
| **FMOD Studio** | events with parameters, snapshots (mix states), banks, live mixing while the game runs; official Unity/Unreal integrations, community Godot integrations |
| **Wwise** | events, RTPCs (game parameters), states/switches, soundbanks, profiling; official Unity/Unreal integrations |
| Godot | AudioStreamPlayer / 2D / 3D nodes, Audio Bus Layout (buses + effects), `AudioServer.set_bus_volume_db(AudioServer.get_bus_index("Music"), db)`; `linear_to_db()` for sliders |
| Unity | AudioMixer groups + exposed parameters (`mixer.SetFloat("MusicVol", dB)`), snapshots, Duck Volume effect for sidechain |
| Unreal | MetaSounds (procedural sound graphs), Sound Classes / Sound Mixes, Submixes, attenuation assets, Quartz for beat-accurate scheduling |
Both FMOD and Wwise have free tiers for small budgets/revenue — check current licence terms before committing.

## Voice lines and barks
- IDs: `vo_<character>_<scene|context>_<nnn>` (e.g. `vo_mira_combat_reload_003`); one row per line in a table with ID, speaker, text, context, priority, localisation status, file per language.
- Priority: story > critical gameplay info > combat barks > ambient chatter. Higher priority interrupts or queues; ambient barks get dropped, not queued.
- Cooldowns per category (8–20 s for combat barks), don't repeat any of the last N lines, max one bark speaker at a time near the player.
- Subtitles driven by the same ID (text + timing), not hard-coded.
- Record "wild lines" and variants; normalise all VO to the same loudness before import.

## Loudness and mix (typical industry ranges, not certification values)
- Integrated loudness commonly targeted: about −24 to −18 LUFS for console/PC games played on TVs/speakers, about −18 to −14 LUFS for mobile/web; true peak ≤ −1 dBTP.
- Mix order: dialogue (anchor) → critical gameplay SFX → music → ambience. Music typically sits 6–12 dB under dialogue.
- Check on laptop speakers, phone speaker, TV and headphones; avoid sub-bass-only information (phones can't play < ~150 Hz).
- Don't clip: many simultaneous SFX → compressor/limiter on master and voice limiting.

## Accessibility
- Subtitles on by default (first boot asks), speaker names, size options (S–XXL), background box with adjustable opacity (≈ 50–80 % default), ≤ 2 lines, ~40–45 characters per line, displayed long enough to read (~15–20 characters/s).
- Closed captions for meaningful sounds: `[Footsteps above]`, `[Alarm blaring]`, with direction if relevant.
- **Never convey critical information only by sound**: add visual cues (directional damage indicators, footstep/gunshot radar icons, screen-edge pulses, controller rumble as a third channel).
- Separate sliders for every bus, mono-audio option (one-ear hearing), option to disable sudden loud stingers, "reduce background music during dialogue" toggle.
