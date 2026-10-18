# Motion-graphics & cinematic video with the Motion engine (templates/motion-video)
tags: video motion graphics animation animated explainer promo intro outro kinetic typography logo reveal trailer cinematic cutscene film export webm mp4 ffmpeg timeline easing transition particles subtitles فيديو موشن جرافيك تحريك انترو اعلان ترويجي لوجو متحرك نصوص متحركه سينمائي مشهد تصدير

Start with `use_template("motion-video")`, then edit **scenes.js only**. The engine renders every frame as a pure function of time, so scrub / preview / export are identical.

## Scenes
```js
const M = Motion.create({ canvas: document.getElementById("stage"), width: 1920, height: 1080, fps: 30, duration: 14, background: "#0a0f24" });
M.scene(start, end, (ctx, s) => { /* s = { t: local secs, p: 0..1, dur, T: global secs, w, h } */ }, { in: "fade|slide|zoom|wipe|none", out: "…", inDur: .5, outDur: .4, layer: 0 });
```
Scenes may overlap (the overlap is the cross-dissolve). Higher `layer` draws later (use it for letterbox, watermark, global grain). Vertical video: `width:1080,height:1920` and scale sizes with `const U = CONFIG.height/1080`.

## Timing helpers
`Motion.ease.<linear|inQuad|outQuad|inOutQuad|inCubic|outCubic|inOutCubic|outQuart|outExpo|inOutExpo|outBack|inOutBack|outElastic|outBounce|spring(t,damping)>`, `Motion.map(t, a, b, from, to, ease)`, `Motion.prog(t, start, dur, ease)` (0..1), `Motion.lerp`, `Motion.clamp`, `Motion.rng(seed)` (deterministic random), `Motion.hex("#7c9cff", .4)` → rgba, `Motion.mix(c1,c2,t)`.
Stagger pattern: `items.forEach((it,i) => { const p = prog(t, 0.3 + i*0.12, 0.7, ease.outBack); … })`.

## fx — drawing
- `fx.bg(ctx,w,h,t,{mode:'mesh'|'gradient'|'grid'|'stars'|'solid', colors:[bg, c1, c2, c3]})` animated backgrounds.
- `fx.text(ctx, str, x, y, {size, font, weight, color|[gradient], align, mode:'fade|rise|drop|mask|scale|blur|type|none', unit:'line|word|char', stagger, t, dur, ease, rtl, maxWidth, lineHeight, shadow, glow, stroke})` → returns `{lines,height,duration}`. `t` is seconds **since the text appears** (`t: s.t - 0.4`). Arabic: `rtl:true` and `unit` is forced to word/line so letters stay joined.
- `fx.counter(t, from, to, dur, ease, fmt)` string for count-ups; `fx.bars(ctx,{x,y,w,h,values,labels,t,colors,rtl})`, `fx.donut(ctx,cx,cy,r,values,t)`, `fx.lineChart(ctx,{x,y,w,h,values,t,color})`.
- `fx.ring / fx.line / fx.path` self-drawing strokes; `fx.roundRect / circle / gradient / radial / glow`.
- `fx.particles(ctx,{seed,count,t,x,y,w,h,type:'confetti|sparks|dust|bubbles|snow',colors,size,speed,gravity,life})` – deterministic.
- `fx.device(ctx,{kind:'phone|browser|card',x,y,w,h,draw:(ctx,w,h)=>{…screen content…}})` for app promos.
- Camera: `cam.apply(ctx,w,h,{x,y,zoom,rot})` inside `ctx.save()/restore()`, `cam.drift(t,dur,from,to)` for Ken-Burns pushes, `cam.shake(t,{amp,decay})` returns `{x,y}` to add to the camera on impacts.

## Sound (no files needed)
`M.sfx(time, 'whoosh'|'hit'|'boom'|'pop'|'click'|'tick'|'chime'|'riser'|'kick'|'hat'|'type', {vol, dur, note})` and `M.music({bpm, bars, key:'A', mode:'minor|major', style:'ambient|upbeat|cinematic', vol})`. Put a `whoosh` at every transition and a `hit/pop` on key reveals; keep music vol ≤ .35 under voice-over. Real audio files: load with `fetch → decodeAudioData` and play from `M.events` yourself, or mix in ffmpeg.

## Cine — cinematic layer (cinematic.js)
`Cine.ratio = 2.39` then `Cine.letterbox(ctx,w,h,p)`; `Cine.subtitle(ctx,w,h,text,{t,dur,rtl})`; `Cine.dialogue(ctx,w,h,{name,text,t,speed,color,rtl,portrait})` (typewriter RPG box; returns `{done,time}`); `Cine.title(ctx,w,h,text,{t,tagline})`; `Cine.sky / skyline / silhouette / parallax` for procedural scenery; `Cine.grade / vignette / grain / flash / fade` for the look. Subtitles and dialogue respect the letterbox automatically when `Cine.ratio` is set.

## Export (tell the user which one fits)
1. **Page buttons** — *Export WebM* (real time, with sound; tab must stay visible), *Frames (.zip)* (JPEG frames, frame-exact) and *Audio (.wav)*.
2. **MP4 with sound, frame-exact:** `npm i -D playwright && npx playwright install chromium` once, then `node render.mjs --out video.mp4` (options `--fps 60 --crf 14 --demo cinematic`). Needs `ffmpeg` on PATH (check `ffmpeg -version`; Windows: `winget install ffmpeg`). If ffmpeg exists, run it yourself with `run_command` and report the file path.
3. WebM → MP4 only: `ffmpeg -i in.webm -c:v libx264 -pix_fmt yuv420p out.mp4`. GIF: `ffmpeg -i in.mp4 -vf "fps=15,scale=800:-1:flags=lanczos" out.gif`.

## Craft rules that make it look professional
- Hook in 2 s; one idea per scene (2–5 s); end card with CTA; total 10–30 s for promos, ≤ 60 s for reels.
- Easing: outExpo/outCubic in, inCubic out, outBack for emphasis, never linear for movement; overlap motions and stagger (40–90 ms).
- Type: 6–9 % of frame height for titles, ≥ 3.5 % for body, ≤ 7 words per screen, safe margin 7 %, strong contrast; Arabic fonts: Cairo / Tajawal / Noto Kufi Arabic.
- Colour: 1 background + 1 accent + 1 highlight; soft glows and gradient meshes beat flat colours; check text contrast in every scene.
- Weight and follow-through: anticipation, overshoot, settle; secondary motion (shadow, particles, 2–3° rotation) sells it.
- Verify with `video.renderFrame(t)` at scene starts, mid, and just before each scene end (look for clipping, overlaps, empty frames); check the first and last frame are intentional.

## Storyboard → code recipe
`time | scene | what moves | text | sound` table → one `M.scene` per row (copy the nearest scene from scenes.js) → replace TEXT/CONFIG → add sfx on the beat → render frames → fix → export.
