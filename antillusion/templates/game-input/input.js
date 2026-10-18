/* GameInput — one action map for keyboard, mouse, every gamepad (Xbox, PlayStation, Switch, Steam, generic) and touch.
   No dependencies. Classic script: <script src="input.js"></script> → window.GameInput (also works with import "./input.js").

   const input = GameInput.create({
     actions: {
       move:   { axis: ["wasd", "arrows", "lstick", "dpad", "touchstick"] },   // 2D vector actions
       look:   { axis: ["rstick", "mouse"] },
       jump:   ["Space", "pad:south", "touch:A"],                               // button actions: any binding counts
       attack: ["KeyJ", "mouse:0", "pad:west", "touch:B"],
       aim:    ["mouse:2", "pad:lt"],                                           // triggers are analog: input.value("aim")
       pause:  ["Escape", "pad:start"],
     },
     storageKey: "mygame.bindings",   // rebinding persists here (localStorage)
   });
   every frame:  input.update(dt);  then  input.vec("move") {x,y} · input.down/pressed/released("jump") · input.held("jump") seconds
                 input.buffered("jump", 0.12) (pressed within the window; consumes it) · input.value("aim") 0..1
   ui actions:   "ui_confirm" / "ui_back" are built in and follow the platform convention (Switch: A=east confirms).
   devices:      input.device → "keyboard" | "xbox" | "playstation" | "switch" | "steam" | "generic" | "touch" (last used)
                 input.on("device" | "connect" | "disconnect" | "rebind", fn) — pause the game on "disconnect".
   prompts:      input.glyph("jump") → SVG string for the current device ·  input.label("jump") → "A" / "Cross" / "Space"
                 GameInput.glyphSVG("pad:south", "playstation", 28)
   feedback:     input.rumble(strong 0..1, weak 0..1, ms) · tuning: input.configure({ deadzone: 0.2, curve: 1.3, triggerThreshold: 0.3 })
   rebinding:    await input.rebind("jump", 1) waits for the next key/button (Esc cancels) · input.resetBindings()
   Pad buttons (positions, standard mapping): south east west north lb rb lt rt select start ls rs up down left right home touchpad */
(function (root) {
  "use strict";

  const PAD_BUTTONS = ["south", "east", "west", "north", "lb", "rb", "lt", "rt", "select", "start", "ls", "rs", "up", "down", "left", "right", "home", "touchpad"];
  const PAD_INDEX = Object.fromEntries(PAD_BUTTONS.map((b, i) => [b, i]));

  // what each position is called on each family (W3C "standard" mapping is positional)
  const NAMES = {
    xbox:        { south: "A", east: "B", west: "X", north: "Y", lb: "LB", rb: "RB", lt: "LT", rt: "RT", select: "View", start: "Menu", ls: "LS", rs: "RS", home: "Xbox", touchpad: "Share" },
    playstation: { south: "Cross", east: "Circle", west: "Square", north: "Triangle", lb: "L1", rb: "R1", lt: "L2", rt: "R2", select: "Create", start: "Options", ls: "L3", rs: "R3", home: "PS", touchpad: "Touchpad" },
    switch:      { south: "B", east: "A", west: "Y", north: "X", lb: "L", rb: "R", lt: "ZL", rt: "ZR", select: "−", start: "+", ls: "LS", rs: "RS", home: "Home", touchpad: "Capture" },
    steam:       { south: "A", east: "B", west: "X", north: "Y", lb: "L1", rb: "R1", lt: "L2", rt: "R2", select: "View", start: "Menu", ls: "L3", rs: "R3", home: "Steam", touchpad: "…" },
  };
  NAMES.generic = { ...NAMES.xbox, home: "Home" };
  const DIRS = { up: "D-pad Up", down: "D-pad Down", left: "D-pad Left", right: "D-pad Right" };

  const KEY_LABELS = { Space: "Space", Escape: "Esc", Enter: "Enter", Tab: "Tab", Backspace: "⌫", ShiftLeft: "Shift", ShiftRight: "Shift", ControlLeft: "Ctrl", ControlRight: "Ctrl", AltLeft: "Alt", AltRight: "Alt",
    ArrowUp: "↑", ArrowDown: "↓", ArrowLeft: "←", ArrowRight: "→", Backquote: "`", Minus: "-", Equal: "=", BracketLeft: "[", BracketRight: "]", Semicolon: ";", Quote: "'", Comma: ",", Period: ".", Slash: "/", Backslash: "\\" };
  const keyLabel = (code) => KEY_LABELS[code] || code.replace(/^Key/, "").replace(/^Digit/, "").replace(/^Numpad/, "Num ");
  const MOUSE_NAMES = ["Left click", "Middle click", "Right click", "Mouse 4", "Mouse 5"];

  const COMPOSITE = { wasd: ["KeyW", "KeyS", "KeyA", "KeyD"], arrows: ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"], ijkl: ["KeyI", "KeyK", "KeyJ", "KeyL"] };

  function familyOf(id) {
    const s = String(id || ""), v = (s.match(/Vendor:\s*([0-9a-f]{4})/i) || s.match(/^([0-9a-f]{1,4})-[0-9a-f]{1,4}-/i) || [])[1];
    const vendor = v ? v.toLowerCase().padStart(4, "0") : "";
    if (vendor === "054c" || /dualsense|dualshock|playstation|ps[345]/i.test(s)) return "playstation";
    if (vendor === "057e" || /nintendo|pro controller|joy-?con/i.test(s)) return "switch";
    if (vendor === "28de" || /steam|valve/i.test(s)) return "steam";
    if (vendor === "045e" || /xbox|xinput|x-?box/i.test(s)) return "xbox";
    return "generic";
  }

  /* ---------- glyphs (SVG strings, crisp at any size, currentColor-friendly) ---------- */
  const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
  const svg = (w, h, size, body) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${(size * w) / h}" height="${size}" role="img">${body}</svg>`;
  const GLYPH = { bg: "#1d2127", rim: "#3a414b", fg: "#f2f4f7", dim: "#9aa3ae" };
  const XBOX_COLORS = { south: "#5dc21e", east: "#e8473d", west: "#2f8cea", north: "#f3b61f" };
  function faceShape(pos) {   // PlayStation symbols, drawn as strokes (monochrome, like the PS5 prompts)
    const st = `fill="none" stroke="${GLYPH.fg}" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"`;
    if (pos === "south") return `<path d="M11 11l10 10M21 11L11 21" ${st}/>`;
    if (pos === "east") return `<circle cx="16" cy="16" r="5.6" ${st}/>`;
    if (pos === "west") return `<rect x="10.6" y="10.6" width="10.8" height="10.8" rx="1" ${st}/>`;
    return `<path d="M16 10l6.2 10.6H9.8z" ${st}/>`;
  }
  function glyphSVG(binding, family = "xbox", size = 28) {
    const b = String(binding);
    if (b.startsWith("pad:")) {
      const pos = b.slice(4), fam = NAMES[family] ? family : "generic", name = NAMES[fam][pos];
      if (["south", "east", "west", "north"].includes(pos)) {
        const ring = `<circle cx="16" cy="16" r="14" fill="${GLYPH.bg}" stroke="${GLYPH.rim}" stroke-width="1.5"/>`;
        if (fam === "playstation") return svg(32, 32, size, ring + faceShape(pos));
        const col = fam === "xbox" ? XBOX_COLORS[pos] : GLYPH.fg;
        return svg(32, 32, size, ring + `<text x="16" y="21.5" text-anchor="middle" font-family="system-ui,Segoe UI,sans-serif" font-weight="700" font-size="15" fill="${col}">${esc(name)}</text>`);
      }
      if (["up", "down", "left", "right"].includes(pos)) {
        const hi = { up: "M13 4h6v9h-6z", down: "M13 19h6v9h-6z", left: "M4 13h9v6H4z", right: "M19 13h9v6h-9z" }[pos];
        return svg(32, 32, size, `<path d="M12 3h8v9h9v8h-9v9h-8v-9H3v-8h9z" fill="${GLYPH.bg}" stroke="${GLYPH.rim}" stroke-width="1.5" stroke-linejoin="round"/><path d="${hi}" fill="${GLYPH.fg}"/>`);
      }
      if (pos === "ls" || pos === "rs") return svg(32, 32, size, `<circle cx="16" cy="16" r="14" fill="${GLYPH.bg}" stroke="${GLYPH.rim}" stroke-width="1.5"/><circle cx="16" cy="16" r="8.5" fill="none" stroke="${GLYPH.dim}" stroke-width="1.6"/><text x="16" y="20" text-anchor="middle" font-family="system-ui,sans-serif" font-weight="700" font-size="10.5" fill="${GLYPH.fg}">${esc(name)}</text>`);
      if (pos === "lt" || pos === "rt") return svg(40, 32, size, `<path d="M6 28V12c0-5 4-9 9-9h10c5 0 9 4 9 9v16z" fill="${GLYPH.bg}" stroke="${GLYPH.rim}" stroke-width="1.5"/><text x="20" y="21" text-anchor="middle" font-family="system-ui,sans-serif" font-weight="700" font-size="11.5" fill="${GLYPH.fg}">${esc(name)}</text>`);
      const w = Math.max(40, 14 + name.length * 8);   // bumpers, menu buttons
      return svg(w, 32, size, `<rect x="1.5" y="6" width="${w - 3}" height="20" rx="10" fill="${GLYPH.bg}" stroke="${GLYPH.rim}" stroke-width="1.5"/><text x="${w / 2}" y="20.2" text-anchor="middle" font-family="system-ui,sans-serif" font-weight="700" font-size="11.5" fill="${GLYPH.fg}">${esc(name)}</text>`);
    }
    if (b.startsWith("mouse:")) {
      const n = +b.slice(6), part = n === 0 ? `<path d="M7 13V11a9 9 0 0 1 9-9v11z" fill="${GLYPH.fg}"/>` : n === 2 ? `<path d="M25 13V11a9 9 0 0 0-9-9v11z" fill="${GLYPH.fg}"/>` : `<rect x="14.5" y="6" width="3" height="6" rx="1.5" fill="${GLYPH.fg}"/>`;
      return svg(32, 32, size, `<rect x="7" y="2" width="18" height="28" rx="9" fill="${GLYPH.bg}" stroke="${GLYPH.rim}" stroke-width="1.5"/>${part}<path d="M7 13h18M16 2v11" stroke="${GLYPH.rim}" stroke-width="1.2"/>`);
    }
    if (b.startsWith("touch:")) return svg(32, 32, size, `<circle cx="16" cy="16" r="14" fill="none" stroke="${GLYPH.fg}" stroke-width="1.8" stroke-dasharray="3 3"/><text x="16" y="21" text-anchor="middle" font-family="system-ui,sans-serif" font-weight="700" font-size="13" fill="${GLYPH.fg}">${esc(b.slice(6))}</text>`);
    if (COMPOSITE[b] || ["lstick", "rstick", "dpad", "mouse", "touchstick"].includes(b)) {
      if (b === "lstick" || b === "rstick") return glyphSVG("pad:" + (b === "lstick" ? "ls" : "rs"), family, size);
      if (b === "dpad") return glyphSVG("pad:up", family, size).replace(/<path d="M13 4h6v9h-6z" fill="[^"]+"\/>/, "");
      if (b === "mouse") return glyphSVG("mouse:1", family, size);
      if (b === "touchstick") return glyphSVG("touch:◎", family, size);
      return COMPOSITE[b].map((k) => glyphSVG(k, family, size * 0.8)).join("");
    }
    const label = keyLabel(b), w = Math.max(32, 16 + label.length * 8.2);   // keyboard keycap
    return svg(w, 32, size, `<rect x="1.5" y="1.5" width="${w - 3}" height="29" rx="6" fill="${GLYPH.bg}" stroke="${GLYPH.rim}" stroke-width="1.5"/><rect x="4" y="26" width="${w - 8}" height="2" rx="1" fill="${GLYPH.rim}"/><text x="${w / 2}" y="20.5" text-anchor="middle" font-family="system-ui,Segoe UI,sans-serif" font-weight="650" font-size="${label.length > 3 ? 11.5 : 14}" fill="${GLYPH.fg}">${esc(label)}</text>`);
  }
  function labelOf(binding, family) {
    const b = String(binding);
    if (b.startsWith("pad:")) { const p = b.slice(4); return DIRS[p] || (NAMES[family] || NAMES.generic)[p] || p; }
    if (b.startsWith("mouse:")) return MOUSE_NAMES[+b.slice(6)] || "Mouse " + b.slice(6);
    if (b.startsWith("touch:")) return "Touch " + b.slice(6);
    return { wasd: "WASD", arrows: "Arrow keys", lstick: "Left stick", rstick: "Right stick", dpad: "D-pad", mouse: "Mouse", touchstick: "Touch stick", ijkl: "IJKL" }[b] || keyLabel(b);
  }

  /* ---------- the input system ---------- */
  function create(opts = {}) {
    const o = { deadzone: 0.16, outerDeadzone: 0.04, curve: 1.15, triggerThreshold: 0.3, stickButton: 0.5, mouseSensitivity: 0.12, touch: "auto", target: root, rumble: true, ...opts };
    const defaults = JSON.parse(JSON.stringify(o.actions || {}));
    const isPadFamily = (d) => d && d !== "keyboard" && d !== "touch";
    let actions = JSON.parse(JSON.stringify(defaults));
    if (o.storageKey) try { const saved = JSON.parse(localStorage.getItem(o.storageKey) || "null"); if (saved) for (const k in saved) if (actions[k]) actions[k] = saved[k]; } catch {}

    const keys = new Set(), mouseBtn = new Set(), touchBtn = new Set();
    const mouse = { dx: 0, dy: 0, wheel: 0, x: 0, y: 0 }, touchStick = { x: 0, y: 0 };
    const state = {}, listeners = {};
    let pads = [], device = "keyboard", capture = null, time = 0;
    const emit = (ev, data) => (listeners[ev] || []).forEach((f) => { try { f(data); } catch (e) { console.error(e); } });
    const setDevice = (d) => { if (d !== device) { device = d; emit("device", d); } };

    const T = o.target, doc = T.document;
    const onKey = (down) => (e) => {
      if (capture && down) { e.preventDefault(); return capture(e.code === "Escape" ? null : e.code); }
      if (down) keys.add(e.code); else keys.delete(e.code);
      if (down) setDevice("keyboard");
      if (boundKeys().has(e.code) && !e.ctrlKey && !e.metaKey) e.preventDefault();   // arrows/space must not scroll the page
    };
    const kd = onKey(true), ku = onKey(false), blur = () => { keys.clear(); mouseBtn.clear(); };
    const md = (e) => { if (capture) { e.preventDefault(); return capture("mouse:" + e.button); } mouseBtn.add(e.button); setDevice("keyboard"); };
    const mu = (e) => mouseBtn.delete(e.button);
    const mm = (e) => { mouse.dx += e.movementX || 0; mouse.dy += e.movementY || 0; mouse.x = e.clientX; mouse.y = e.clientY; };
    const wh = (e) => { mouse.wheel += Math.sign(e.deltaY); };
    const cm = (e) => { if (boundMouse(2)) e.preventDefault(); };
    if (T.addEventListener) {
      T.addEventListener("keydown", kd); T.addEventListener("keyup", ku); T.addEventListener("blur", blur);
      T.addEventListener("mousedown", md); T.addEventListener("mouseup", mu); T.addEventListener("mousemove", mm); T.addEventListener("wheel", wh, { passive: true }); T.addEventListener("contextmenu", cm);
      T.addEventListener("gamepadconnected", (e) => { emit("connect", { index: e.gamepad.index, id: e.gamepad.id, family: familyOf(e.gamepad.id) }); });
      T.addEventListener("gamepaddisconnected", (e) => { emit("disconnect", { index: e.gamepad.index, id: e.gamepad.id, family: familyOf(e.gamepad.id) }); if (isPadFamily(device) && !livePads().length) setDevice("keyboard"); });
    }
    function boundKeys() { const s = new Set(); for (const a of Object.values(actions)) for (const b of list(a)) { if (COMPOSITE[b]) COMPOSITE[b].forEach((k) => s.add(k)); else if (!/[:]/.test(b) && !["lstick", "rstick", "dpad", "mouse", "touchstick"].includes(b)) s.add(b); } return s; }
    function boundMouse(n) { return Object.values(actions).some((a) => list(a).includes("mouse:" + n)); }
    const list = (a) => (Array.isArray(a) ? a : a.axis || a.buttons || []);
    const livePads = () => { try { return [...(T.navigator && T.navigator.getGamepads ? T.navigator.getGamepads() : [])].filter((p) => p && p.connected !== false); } catch { return []; } };

    /* ---------- touch overlay: a floating stick on the left half, buttons bottom-right ---------- */
    let overlay = null;
    function touchButtonsNeeded() { const n = new Set(); for (const a of Object.values(actions)) for (const b of list(a)) if (/^touch:/.test(b)) n.add(b.slice(6)); return [...n]; }
    function buildOverlay() {
      if (overlay || !doc) return;
      overlay = doc.createElement("div"); overlay.className = "gi-touch";
      overlay.innerHTML = `<style>.gi-touch{position:fixed;inset:0;pointer-events:none;z-index:50;touch-action:none;user-select:none;-webkit-user-select:none}.gi-touch .zone{position:absolute;inset:0 50% 0 0;pointer-events:auto}.gi-touch .base{position:absolute;width:132px;height:132px;margin:-66px 0 0 -66px;border-radius:50%;border:2px solid #ffffff38;background:#0000002e;display:none}.gi-touch .knob{position:absolute;left:50%;top:50%;width:58px;height:58px;margin:-29px;border-radius:50%;background:#ffffffd0;box-shadow:0 4px 14px #0006}.gi-touch .btns{position:absolute;right:max(18px,env(safe-area-inset-right));bottom:max(22px,env(safe-area-inset-bottom));display:flex;flex-wrap:wrap-reverse;gap:14px;width:178px;justify-content:flex-end;pointer-events:auto}.gi-touch .b{width:74px;height:74px;border-radius:50%;border:2px solid #ffffff55;background:#00000040;color:#fff;font:700 22px system-ui,sans-serif;display:grid;place-items:center;backdrop-filter:blur(4px)}.gi-touch .b.on{background:#ffffffd8;color:#111}</style><div class="zone"><div class="base"><div class="knob"></div></div></div><div class="btns"></div>`;
      const zone = overlay.querySelector(".zone"), base = overlay.querySelector(".base"), knob = overlay.querySelector(".knob"), btns = overlay.querySelector(".btns");
      let sid = null, cx = 0, cy = 0;
      zone.addEventListener("pointerdown", (e) => { sid = e.pointerId; cx = e.clientX; cy = e.clientY; base.style.left = cx + "px"; base.style.top = cy + "px"; base.style.display = "block"; zone.setPointerCapture(e.pointerId); setDevice("touch"); });
      zone.addEventListener("pointermove", (e) => { if (e.pointerId !== sid) return; let dx = (e.clientX - cx) / 56, dy = (e.clientY - cy) / 56; const m = Math.hypot(dx, dy); if (m > 1) { dx /= m; dy /= m; } touchStick.x = dx; touchStick.y = dy; knob.style.transform = `translate(${dx * 46}px,${dy * 46}px)`; });
      const end = (e) => { if (e.pointerId !== sid) return; sid = null; touchStick.x = touchStick.y = 0; knob.style.transform = ""; base.style.display = "none"; };
      zone.addEventListener("pointerup", end); zone.addEventListener("pointercancel", end);
      for (const name of touchButtonsNeeded()) {
        const b = doc.createElement("div"); b.className = "b"; b.textContent = name;
        b.addEventListener("pointerdown", (e) => { e.preventDefault(); touchBtn.add(name); b.classList.add("on"); setDevice("touch"); b.setPointerCapture(e.pointerId); });
        const up = () => { touchBtn.delete(name); b.classList.remove("on"); };
        b.addEventListener("pointerup", up); b.addEventListener("pointercancel", up);
        btns.append(b);
      }
      doc.body.append(overlay);
    }
    if (doc && o.touch !== false) {
      if (o.touch === true) (doc.body ? buildOverlay() : T.addEventListener("DOMContentLoaded", buildOverlay));
      else T.addEventListener && T.addEventListener("touchstart", function first() { T.removeEventListener("touchstart", first); buildOverlay(); setDevice("touch"); }, { passive: true });
    }

    /* ---------- sampling ---------- */
    const stick = (x, y) => {   // radial deadzone + outer deadzone + response curve
      const m = Math.hypot(x, y); if (m < o.deadzone) return { x: 0, y: 0 };
      const n = Math.min(1, (m - o.deadzone) / (1 - o.deadzone - o.outerDeadzone)), k = Math.pow(n, o.curve) / m;
      return { x: x * k, y: y * k };
    };
    function padSample(p) {
      const btn = (i) => { const b = p.buttons[i]; return b ? (typeof b === "object" ? b.value || (b.pressed ? 1 : 0) : b) : 0; };
      const ax = (i) => p.axes[i] || 0;
      const s = { family: familyOf(p.id), id: p.id, index: p.index, buttons: {}, ls: stick(ax(0), ax(1)), rs: stick(ax(2), ax(3)), raw: p };
      PAD_BUTTONS.forEach((b, i) => (s.buttons[b] = btn(i)));
      if (p.mapping !== "standard" && p.axes.length >= 8 && !s.buttons.up && !s.buttons.down) {   // some non-standard pads report the d-pad as axes 6/7
        const hx = ax(6), hy = ax(7); s.buttons.left = hx < -0.5 ? 1 : 0; s.buttons.right = hx > 0.5 ? 1 : 0; s.buttons.up = hy < -0.5 ? 1 : 0; s.buttons.down = hy > 0.5 ? 1 : 0;
      }
      return s;
    }
    const padActive = (s) => Object.values(s.buttons).some((v) => v > 0.5) || Math.hypot(s.ls.x, s.ls.y) > 0.3 || Math.hypot(s.rs.x, s.rs.y) > 0.3;

    function buttonValue(b) {
      if (b.startsWith("pad:")) {
        const pos = b.slice(4); let v = 0;
        for (const p of pads) { const raw = p.buttons[pos] || 0; v = Math.max(v, pos === "lt" || pos === "rt" ? (raw >= o.triggerThreshold ? raw : 0) : raw > 0.5 ? 1 : 0); }
        return v;
      }
      if (b.startsWith("mouse:")) return mouseBtn.has(+b.slice(6)) ? 1 : 0;
      if (b.startsWith("touch:")) return touchBtn.has(b.slice(6)) ? 1 : 0;
      if (b === "wheel:up") return mouse.wheel < 0 ? 1 : 0;
      if (b === "wheel:down") return mouse.wheel > 0 ? 1 : 0;
      if (/^(lstick|rstick):(up|down|left|right)$/.test(b)) { const [s, d] = b.split(":"), v = vecOf(s); return (d === "up" ? -v.y : d === "down" ? v.y : d === "left" ? -v.x : v.x) > o.stickButton ? 1 : 0; }
      return keys.has(b) ? 1 : 0;
    }
    function vecOf(src) {
      if (COMPOSITE[src]) { const [u, d, l, r] = COMPOSITE[src]; return { x: (keys.has(r) ? 1 : 0) - (keys.has(l) ? 1 : 0), y: (keys.has(d) ? 1 : 0) - (keys.has(u) ? 1 : 0) }; }
      if (src === "lstick" || src === "rstick") { let x = 0, y = 0; for (const p of pads) { const v = p[src === "lstick" ? "ls" : "rs"]; if (Math.hypot(v.x, v.y) > Math.hypot(x, y)) { x = v.x; y = v.y; } } return { x, y }; }
      if (src === "dpad") { let x = 0, y = 0; for (const p of pads) { x += (p.buttons.right > 0.5) - (p.buttons.left > 0.5); y += (p.buttons.down > 0.5) - (p.buttons.up > 0.5); } return { x: Math.max(-1, Math.min(1, x)), y: Math.max(-1, Math.min(1, y)) }; }
      if (src === "mouse") return { x: mouse.dx * o.mouseSensitivity, y: mouse.dy * o.mouseSensitivity };
      if (src === "touchstick") return stick(touchStick.x, touchStick.y);
      if (typeof src === "object" && src) return { x: buttonValue(src.right) - buttonValue(src.left), y: buttonValue(src.down) - buttonValue(src.up) };
      return { x: 0, y: 0 };
    }

    // ui_confirm / ui_back follow the convention of the device in use (Nintendo confirms with the east button)
    const uiBindings = () => {
      const sw = device === "switch";
      return { ui_confirm: ["Enter", "Space", sw ? "pad:east" : "pad:south", "touch:A"], ui_back: ["Escape", "Backspace", sw ? "pad:south" : "pad:east", "touch:B"],
        ui_up: ["ArrowUp", "KeyW", "pad:up", "lstick:up"], ui_down: ["ArrowDown", "KeyS", "pad:down", "lstick:down"], ui_left: ["ArrowLeft", "KeyA", "pad:left", "lstick:left"], ui_right: ["ArrowRight", "KeyD", "pad:right", "lstick:right"] };
    };

    function update(dt = 1 / 60) {
      time += dt;
      pads = livePads().map(padSample);
      if (capture) {   // rebinding: the first pad button (not a resting trigger) wins
        for (const p of pads) for (const b of PAD_BUTTONS) if (p.buttons[b] > 0.6 && !(prevCapture[p.index] || {})[b]) { const c = capture; setTimeout(() => c("pad:" + b)); break; }
        prevCapture = Object.fromEntries(pads.map((p) => [p.index, Object.fromEntries(PAD_BUTTONS.map((b) => [b, p.buttons[b] > 0.6]))]));
      }
      const activePad = pads.find(padActive); if (activePad) setDevice(activePad.family);
      const all = { ...uiBindings(), ...actions };
      for (const name in all) {
        const a = all[name], st = state[name] || (state[name] = { down: false, was: false, value: 0, vec: { x: 0, y: 0 }, since: 0, lastPress: -1e9, consumed: true });
        st.was = st.down;
        if (!Array.isArray(a) && a.axis) {
          let x = 0, y = 0; for (const src of a.axis) { const v = vecOf(src); x += v.x; y += v.y; }
          const m = Math.hypot(x, y); if (m > 1 && !a.axis.includes("mouse")) { x /= m; y /= m; }
          st.vec = { x, y }; st.value = Math.min(1, Math.hypot(x, y)); st.down = st.value > 0.5;
        } else {
          let v = 0; for (const b of list(a)) v = Math.max(v, buttonValue(b));
          st.value = v; st.down = v > 0;
        }
        if (st.down && !st.was) { st.since = time; st.lastPress = time; st.consumed = false; }
      }
      mouse.dx = mouse.dy = 0; mouse.wheel = 0;
    }
    let prevCapture = {};
    const S = (name) => state[name] || { down: false, was: false, value: 0, vec: { x: 0, y: 0 }, since: 0, lastPress: -1e9, consumed: true };

    function bindingFor(name, dev = device) {   // the binding to show in a prompt for this device
      const a = { ...uiBindings(), ...actions }[name]; if (!a) return null;
      const l = list(a), pad = isPadFamily(dev);
      return l.find((b) => (pad ? /^(pad:|lstick|rstick|dpad)/.test(b) : dev === "touch" ? /^touch/.test(b) : !/^(pad:|touch|lstick|rstick|dpad)/.test(b))) || l[0];
    }
    const save = () => { if (o.storageKey) try { localStorage.setItem(o.storageKey, JSON.stringify(actions)); } catch {} };

    const api = {
      update,
      down: (n) => S(n).down, pressed: (n) => S(n).down && !S(n).was, released: (n) => !S(n).down && S(n).was,
      held: (n) => (S(n).down ? time - S(n).since : 0), value: (n) => S(n).value, vec: (n) => ({ ...S(n).vec }),
      buffered(n, window = 0.12) { const s = S(n); if (!s.consumed && time - s.lastPress <= window) { s.consumed = true; return true; } return false; },
      get device() { return device; }, get pads() { return pads.map(({ raw, ...p }) => p); }, get mouse() { return { ...mouse }; }, get actions() { return JSON.parse(JSON.stringify(actions)); },
      on(ev, fn) { (listeners[ev] || (listeners[ev] = [])).push(fn); return () => (listeners[ev] = listeners[ev].filter((f) => f !== fn)); },
      binding: bindingFor,
      label: (n, dev = device) => { const b = bindingFor(n, dev); return b ? labelOf(b, isPadFamily(dev) ? dev : "xbox") : ""; },
      glyph: (n, size = 28, dev = device) => { const b = bindingFor(n, dev); return b ? glyphSVG(b, isPadFamily(dev) ? dev : "xbox", size) : ""; },
      rumble(strong = 0.6, weak = 0.4, ms = 180) {
        if (!o.rumble) return;
        for (const p of livePads()) {
          try {
            if (p.vibrationActuator && p.vibrationActuator.playEffect) p.vibrationActuator.playEffect("dual-rumble", { duration: ms, strongMagnitude: Math.min(1, strong), weakMagnitude: Math.min(1, weak) }).catch(() => {});
            else if (p.hapticActuators && p.hapticActuators[0]) p.hapticActuators[0].pulse(Math.max(strong, weak), ms);
          } catch {}
        }
      },
      setRumble(on) { o.rumble = !!on; },
      configure(patch) { Object.assign(o, patch); },   // deadzone, outerDeadzone, curve, triggerThreshold, mouseSensitivity
      rebind(name, slot = 0) {
        return new Promise((resolve) => {
          if (!actions[name] || !Array.isArray(actions[name])) return resolve(null);
          prevCapture = Object.fromEntries(livePads().map(padSample).map((p) => [p.index, Object.fromEntries(PAD_BUTTONS.map((b) => [b, p.buttons[b] > 0.6]))]));
          capture = (b) => {
            capture = null; keys.clear(); mouseBtn.clear();
            if (!b) return resolve(null);
            for (const k in actions) if (Array.isArray(actions[k]) && k !== name) { const i = actions[k].indexOf(b); if (i >= 0) actions[k].splice(i, 1); }   // one input, one action
            const l = actions[name]; if (slot >= l.length) l.push(b); else l[slot] = b;
            save(); emit("rebind", { action: name, binding: b }); resolve(b);
          };
        });
      },
      setBindings(name, bindings) { actions[name] = bindings; save(); },
      resetBindings() { actions = JSON.parse(JSON.stringify(defaults)); if (o.storageKey) try { localStorage.removeItem(o.storageKey); } catch {} emit("rebind", { reset: true }); },
      get rebinding() { return !!capture; },
      showTouch: buildOverlay,
      destroy() { if (T.removeEventListener) { T.removeEventListener("keydown", kd); T.removeEventListener("keyup", ku); T.removeEventListener("blur", blur); T.removeEventListener("mousedown", md); T.removeEventListener("mouseup", mu); T.removeEventListener("mousemove", mm); T.removeEventListener("wheel", wh); T.removeEventListener("contextmenu", cm); } if (overlay) overlay.remove(); },
    };
    return api;
  }

  const GameInput = { create, familyOf, glyphSVG, label: labelOf, NAMES, PAD_BUTTONS, PAD_INDEX };
  root.GameInput = GameInput;
  if (typeof module === "object" && module.exports) module.exports = GameInput;
})(typeof window !== "undefined" ? window : globalThis);
