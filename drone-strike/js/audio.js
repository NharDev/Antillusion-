// Procedural audio (no asset files): FPV motor buzz, explosion, beeps, jingle.
const Sfx = (() => {
  let ctx = null, master, eng1, eng2, engGain, engFilter, noiseBuf, wind, windGain;

  function init() {
    if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0.7;
    master.connect(ctx.destination);

    engGain = ctx.createGain(); engGain.gain.value = 0;
    engFilter = ctx.createBiquadFilter(); engFilter.type = 'lowpass'; engFilter.frequency.value = 1800;
    eng1 = ctx.createOscillator(); eng1.type = 'sawtooth';
    eng2 = ctx.createOscillator(); eng2.type = 'square';
    const g2 = ctx.createGain(); g2.gain.value = 0.35;
    eng1.connect(engFilter); eng2.connect(g2); g2.connect(engFilter);
    engFilter.connect(engGain); engGain.connect(master);
    eng1.start(); eng2.start();

    noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;

    // wind loop
    wind = ctx.createBufferSource(); wind.buffer = noiseBuf; wind.loop = true;
    const wf = ctx.createBiquadFilter(); wf.type = 'bandpass'; wf.frequency.value = 500; wf.Q.value = 0.6;
    windGain = ctx.createGain(); windGain.gain.value = 0;
    wind.connect(wf); wf.connect(windGain); windGain.connect(master);
    wind.start();
  }

  // power 0..1 (throttle/boost), speed 0..1
  function engine(on, power, speed) {
    if (!ctx) return;
    const t = ctx.currentTime;
    const f = 170 + 380 * power + 120 * speed;
    eng1.frequency.setTargetAtTime(f, t, 0.05);
    eng2.frequency.setTargetAtTime(f * 1.012, t, 0.05);
    engFilter.frequency.setTargetAtTime(900 + 1800 * power, t, 0.1);
    engGain.gain.setTargetAtTime(on ? 0.05 + 0.06 * power : 0, t, 0.08);
    windGain.gain.setTargetAtTime(on ? speed * 0.18 : 0, t, 0.15);
  }

  function beep(freq, dur, vol, type) {
    if (!ctx) return;
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type || 'sine'; o.frequency.value = freq;
    const t = ctx.currentTime;
    g.gain.setValueAtTime(vol || 0.15, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(master);
    o.start(t); o.stop(t + dur + 0.02);
  }

  function explosion(big, vol) {
    if (!ctx) return;
    const t = ctx.currentTime;
    const v = vol == null ? 1 : vol;
    const src = ctx.createBufferSource(); src.buffer = noiseBuf;
    const f = ctx.createBiquadFilter(); f.type = 'lowpass';
    f.frequency.setValueAtTime(4500, t);
    f.frequency.exponentialRampToValueAtTime(70, t + 1.7);
    const g = ctx.createGain();
    g.gain.setValueAtTime((big ? 1.1 : 0.9) * v, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 1.9);
    src.connect(f); f.connect(g); g.connect(master);
    src.start(t); src.stop(t + 2);
    const o = ctx.createOscillator(), og = ctx.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(110, t);
    o.frequency.exponentialRampToValueAtTime(28, t + 0.7);
    og.gain.setValueAtTime(v, t);
    og.gain.exponentialRampToValueAtTime(0.001, t + 0.9);
    o.connect(og); og.connect(master);
    o.start(t); o.stop(t + 1);
  }

  let lastGun = 0;
  function gun(vol) {
    if (!ctx || ctx.currentTime - lastGun < 0.06) return;
    lastGun = ctx.currentTime;
    const t = ctx.currentTime;
    const src = ctx.createBufferSource(); src.buffer = noiseBuf;
    const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 900;
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
    src.connect(f); f.connect(g); g.connect(master);
    src.start(t, Math.random()); src.stop(t + 0.14);
  }
  function whistle() {
    if (!ctx) return;
    const t = ctx.currentTime;
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(1500, t); o.frequency.exponentialRampToValueAtTime(380, t + 1.5);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.09, t + 0.3); g.gain.exponentialRampToValueAtTime(0.001, t + 1.55);
    o.connect(g); g.connect(master); o.start(t); o.stop(t + 1.6);
  }

  function jingle() {
    [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => beep(f, 0.35, 0.16, 'triangle'), i * 110));
  }
  function tick(go) { beep(go ? 1100 : 660, go ? 0.5 : 0.15, 0.14, 'square'); }
  function warn() { beep(900, 0.08, 0.1, 'square'); }
  function ui() { beep(520, 0.07, 0.08, 'triangle'); }

  return { init, engine, explosion, jingle, tick, warn, ui, beep, gun, whistle };
})();
