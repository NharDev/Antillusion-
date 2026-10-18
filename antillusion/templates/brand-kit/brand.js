/* Brand kit generator: a geometric mark + wordmark, OKLCH colour ramps with WCAG contrast checks, a type scale,
   applications (business card, app icon, social card), usage rules and token export — all from the CONFIG below.
   Edit CONFIG (or use the side panel). Everything on the page is generated, so it stays consistent. */
const CONFIG = {
  name: "Northwind", tagline: "Logistics that keeps its promises.",
  hue: 168, chroma: 0.11, accentOffset: 230,   // OKLCH hue in degrees; accent = brand hue + offset
  mark: "arc",                                  // arc | facet | stack | monogram
  pair: 0,                                      // index into PAIRS
  contact: { person: "Lina Haddad", role: "Operations Lead", email: "lina@northwind.example", phone: "+962 6 000 0000", web: "northwind.example" },
};
const PAIRS = [   // system-safe stacks first; swap in a licensed/Google font in production
  { name: "Grotesk + Grotesk", display: '"Inter Tight", "Helvetica Neue", Arial, sans-serif', text: 'Inter, "Segoe UI", system-ui, sans-serif' },
  { name: "Serif display + Sans", display: 'Fraunces, "Iowan Old Style", Georgia, serif', text: 'Inter, "Segoe UI", system-ui, sans-serif' },
  { name: "Mono accent + Sans", display: '"IBM Plex Mono", "Cascadia Code", Consolas, monospace', text: '"IBM Plex Sans", "Segoe UI", system-ui, sans-serif' },
  { name: "Arabic + Latin", display: '"IBM Plex Sans Arabic", "Readex Pro", Tahoma, sans-serif', text: '"IBM Plex Sans Arabic", "Segoe UI", Tahoma, sans-serif' },
];

/* ---------- colour: OKLCH → sRGB with gamut mapping (reduce chroma until it fits) ---------- */
function oklchToRgb(L, C, h) {
  const a = C * Math.cos((h * Math.PI) / 180), b = C * Math.sin((h * Math.PI) / 180);
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3, m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3, s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  const lin = [4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s, -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s, -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s];
  return lin.map((x) => (x <= 0.0031308 ? 12.92 * x : 1.055 * Math.pow(Math.max(x, 0), 1 / 2.4) - 0.055));
}
function oklch(L, C, h) {
  let lo = 0, hi = C, rgb = oklchToRgb(L, C, h);
  const inGamut = (c) => c.every((v) => v >= -0.0005 && v <= 1.0005);
  if (!inGamut(rgb)) { for (let i = 0; i < 24; i++) { const mid = (lo + hi) / 2, t = oklchToRgb(L, mid, h); if (inGamut(t)) lo = mid; else hi = mid; } rgb = oklchToRgb(L, lo, h); }
  return "#" + rgb.map((v) => Math.round(Math.min(1, Math.max(0, v)) * 255).toString(16).padStart(2, "0")).join("");
}
const STEPS = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950];
const LIGHT = [0.975, 0.94, 0.88, 0.8, 0.71, 0.62, 0.53, 0.45, 0.37, 0.28, 0.21];
// chroma peaks in the middle of the ramp and falls off toward white and black; a small hue drift keeps darks rich
const ramp = (h, cmax, drift = 0) => Object.fromEntries(STEPS.map((s, i) => { const L = LIGHT[i], k = Math.max(0.12, 1 - Math.abs(L - 0.6) / 0.42) ** 1.1; return [s, oklch(L, cmax * k, h + drift * (0.6 - L))]; }));
const lum = (hex) => { const v = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)); return 0.2126 * v[0] + 0.7152 * v[1] + 0.0722 * v[2]; };
const contrast = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };

/* ---------- marks: built on a 48-unit grid from simple primitives (so they survive 16 px and one colour) ---------- */
const MARKS = {
  // a square with a quarter-circle bite and a dot: movement + destination
  arc: (c1, c2) => `<path d="M6 6h22a14 14 0 0 1 14 14v22H20A14 14 0 0 1 6 28z" fill="${c1}"/><path d="M42 42H24a18 18 0 0 1 18-18z" fill="${c2}"/>`,
  // an isometric cube from three rhombi in three values of one colour
  facet: (c1, c2, c3) => `<path d="M24 4l18 10.4L24 24.8 6 14.4z" fill="${c3}"/><path d="M6 14.4l18 10.4V45L6 34.6z" fill="${c1}"/><path d="M42 14.4V34.6L24 45V24.8z" fill="${c2}"/>`,
  // three stepped bars: layers, data, momentum
  stack: (c1, c2) => `<rect x="6" y="8" width="36" height="8" rx="4" fill="${c1}"/><rect x="12" y="20" width="30" height="8" rx="4" fill="${c2}"/><rect x="18" y="32" width="24" height="8" rx="4" fill="${c1}"/>`,
  // the initial reversed out of a rounded square
  monogram: (c1, c2, c3, name, font) => `<rect x="4" y="4" width="40" height="40" rx="11" fill="${c1}"/><text x="24" y="33.5" text-anchor="middle" font-family='${font}' font-weight="700" font-size="27" fill="#fff">${(name[0] || "A").toUpperCase()}</text>`,
};
const markSVG = (t, size, mono) => {
  const c1 = mono || t.brand[600], c2 = mono || t.accent[400], c3 = mono || t.brand[300];
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" width="${size}" height="${size}">${MARKS[CONFIG.mark](c1, c2, c3, CONFIG.name, PAIRS[CONFIG.pair].display)}</svg>`;
};
const logoSVG = (t, h, color, mono) => {
  const font = PAIRS[CONFIG.pair].display, w = Math.round(h * (1.25 + CONFIG.name.length * 0.62));
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" role="img" aria-label="${CONFIG.name}"><g transform="scale(${h / 48})">${MARKS[CONFIG.mark](mono || t.brand[600], mono || t.accent[400], mono || t.brand[300], CONFIG.name, font)}</g><text x="${h * 1.22}" y="${h * 0.7}" font-family='${font}' font-weight="700" font-size="${h * 0.62}" letter-spacing="-0.02em" fill="${color}">${esc(CONFIG.name)}</text></svg>`;
};
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

function tokens() {
  const brand = ramp(CONFIG.hue, CONFIG.chroma, 12), accent = ramp((CONFIG.hue + CONFIG.accentOffset) % 360, Math.min(0.17, CONFIG.chroma * 1.25), 8), neutral = ramp(CONFIG.hue, 0.012, 0);
  const semantic = { success: oklch(0.55, 0.13, 150), warning: oklch(0.72, 0.15, 75), danger: oklch(0.55, 0.17, 28), info: oklch(0.56, 0.12, 245) };
  return { brand, accent, neutral, semantic };
}

/* ---------- the document ---------- */
const $ = (id) => document.getElementById(id);
function render() {
  const t = tokens(), P0 = PAIRS[CONFIG.pair], P = { ...P0, display: P0.display.replace(/"/g, "'"), text: P0.text.replace(/"/g, "'") }, root = document.documentElement.style;
  for (const s of STEPS) root.setProperty("--b-" + s, t.brand[s]);
  root.setProperty("--b-display", P.display); root.setProperty("--b-text", P.text);
  const pattern = `<svg class="pattern" viewBox="0 0 240 240">${[0, 1, 2, 3, 4].map((r) => [0, 1, 2, 3, 4].map((c) => `<g transform="translate(${c * 48} ${r * 48})">${MARKS[CONFIG.mark]("#fff", "#fff", "#fff", CONFIG.name, P.display)}</g>`).join("")).join("")}</svg>`;
  const rampRow = (name, r) => `<div class="rname">${name}</div><div class="ramp">${STEPS.map((s) => `<div style="background:${r[s]};color:${contrast(r[s], "#ffffff") > 4.5 ? "#fff" : "#111"}"><b>${s}</b>${r[s]}</div>`).join("")}</div>`;
  const pairs = [["Body text", t.neutral[900], t.neutral[50]], ["Primary button", "#ffffff", t.brand[600]], ["Link on paper", t.brand[700], t.neutral[50]], ["Accent label", t.accent[800], t.accent[100]], ["Muted text", t.neutral[600], "#ffffff"], ["On dark", t.brand[200], t.brand[900]]];
  const scale = [["Display", 56, 700, -0.03], ["H1", 40, 700, -0.02], ["H2", 30, 650, -0.015], ["H3", 22, 650, -0.01], ["Body", 16, 400, 0], ["Small", 13.5, 400, 0], ["Label", 12, 600, 0.06]];
  const sec = (n, title, lead, body) => `<section><div class="eyebrow"><span>${n}</span><span>${title}</span></div><h2>${title}</h2><p class="lead">${lead}</p>${body}</section>`;
  const c = CONFIG.contact;
  $("doc").innerHTML =
    `<div class="cover">${pattern}<div class="meta"><span>Brand guidelines</span><span>v1.0 · ${new Date().getFullYear()}</span></div><div><div style="margin-bottom:28px">${logoSVG(t, 44, t.brand[50], t.brand[50])}</div><p class="big">${esc(CONFIG.name)}</p><p class="tag">${esc(CONFIG.tagline)}</p></div><div class="meta"><span>${esc(c.web)}</span><span>Internal · do not distribute</span></div></div>` +
    sec("01", "Logo", "The mark is built from simple geometry on a 48-unit grid so it stays legible at 16 px and in one colour. Never redraw, stretch or recolour it outside these versions.",
      `<div class="grid2"><div class="tile">${logoSVG(t, 56, t.neutral[900])}<small>Primary — on light</small></div><div class="tile dark">${logoSVG(t, 56, t.brand[50], t.brand[50])}<small>Reversed — on brand dark</small></div><div class="tile brand">${logoSVG(t, 56, "#ffffff", "#ffffff")}<small>One colour</small></div><div class="tile construct">${markSVG(t, 168)}<small>Construction — 48 × 48 grid</small></div></div>
      <div class="tile" style="margin-top:16px;min-height:0;padding:28px 32px;place-items:start"><div class="sizes">${[96, 48, 32, 24, 16].map((s) => `<div>${markSVG(t, s)}<span>${s}px</span></div>`).join("")}</div><small>Minimum size 16 px · clear space = ¼ of the mark's height on every side</small></div>`) +
    sec("02", "Colour", "Ramps are generated in OKLCH so every step is perceptually even. Use brand 600 for primary actions, neutrals for 90% of the interface, and the accent sparingly for emphasis.",
      rampRow("brand", t.brand) + rampRow("accent", t.accent) + rampRow("neutral", t.neutral) +
      `<div class="rname">semantic</div><div class="ramp" style="grid-template-columns:repeat(4,1fr)">${Object.entries(t.semantic).map(([k, v]) => `<div style="background:${v};color:#fff"><b>${k}</b>${v}</div>`).join("")}</div>
      <table style="margin-top:22px"><tr><th>Pairing</th><th>Sample</th><th>Contrast</th><th>WCAG</th></tr>${pairs.map(([n, fg, bg]) => { const r = contrast(fg, bg); return `<tr><td>${n}</td><td><span class="sample" style="color:${fg};background:${bg}">Aa ${esc(CONFIG.name)}</span></td><td style="font-family:var(--mono)">${r.toFixed(2)}:1</td><td>${r >= 7 ? '<span class="ok">AAA</span>' : r >= 4.5 ? '<span class="ok">AA</span>' : r >= 3 ? '<span class="no">AA large only</span>' : '<span class="no">Fail</span>'}</td></tr>`; }).join("")}</table>`) +
    sec("03", "Typography", `${P.name}. Display for headlines and the wordmark, text face for everything else. Scale ratio ≈ 1.33; tighten tracking as size grows.`,
      scale.map(([n, s, w, tr]) => `<div class="type-row"><code>${n} · ${s}/${Math.round(s * (s > 24 ? 1.1 : 1.5))} · ${w}</code><div style="font-family:${s > 20 ? P.display : P.text};font-size:${s}px;font-weight:${w};letter-spacing:${tr}em;line-height:${s > 24 ? 1.1 : 1.5};${n === "Label" ? "text-transform:uppercase;" : ""}">${n === "Body" || n === "Small" ? esc(CONFIG.tagline) + " Every shipment tracked, every promise kept — from the first mile to the last." : esc(CONFIG.tagline)}</div></div>`).join("")) +
    sec("04", "Applications", "The identity applied to the touchpoints people see first. Brand dark carries the logo; white space does the rest.",
      `<div class="mock"><div class="card-front">${logoSVG(t, 30, t.brand[50], t.brand[50])}<div style="font:11px var(--mono);color:${t.brand[300]}">${esc(c.web)}</div></div><div class="card-back"><div><b>${esc(c.person)}</b><br><span>${esc(c.role)}</span></div><div class="c">${esc(c.email)}<br>${esc(c.phone)}</div></div>
      <div class="tile"><div class="appicon">${[120, 76, 48].map((s) => `<div class="squircle" style="width:${s}px;height:${s}px">${markSVG(t, s * 0.62, "#ffffff")}</div>`).join("")}</div><small>App icon · 1024 master, safe zone 62%</small></div>
      <div class="social"><div>${markSVG(t, 40)}</div><h3>${esc(CONFIG.tagline)}</h3><div style="font:12px var(--mono);color:${t.neutral[600]}">${esc(c.web)}</div></div></div>`) +
    sec("05", "Usage", "A few rules keep the identity recognisable everywhere it appears.",
      `<div class="rules">${[["do", "Use the reversed logo on brand 900", `<div style="background:${t.brand[900]};width:100%;height:100%;display:grid;place-items:center">${logoSVG(t, 34, t.brand[50], t.brand[50])}</div>`],
        ["dont", "Don't place the colour logo on busy or mid-tone backgrounds", `<div style="background:linear-gradient(90deg,${t.accent[400]},${t.brand[400]});width:100%;height:100%;display:grid;place-items:center">${logoSVG(t, 34, t.neutral[900])}</div>`],
        ["dont", "Don't stretch, rotate or add effects", `<div style="transform:scaleX(1.5) rotate(-8deg);filter:drop-shadow(0 6px 4px rgba(0,0,0,.4))">${logoSVG(t, 30, t.neutral[900])}</div>`],
        ["dont", "Don't recolour the mark outside the palette", `${logoSVG(t, 34, "#c0392b", "#27ae60")}`]].map(([k, txt, v]) => `<div class="rule ${k}"><div class="v">${v}</div><p><b>${k === "do" ? "DO" : "DON'T"}</b>${txt}</p></div>`).join("")}</div>`) +
    sec("06", "Tokens", "Design tokens generated from this page. Paste the CSS into any project, or import the JSON into Figma Tokens / Style Dictionary.", `<pre id="css"></pre>`);
  $("css").textContent = cssTokens(t);
}
function cssTokens(t) {
  const lines = [":root {"];
  for (const [g, r] of Object.entries({ brand: t.brand, accent: t.accent, neutral: t.neutral })) for (const s of STEPS) lines.push(`  --${g}-${s}: ${r[s]};`);
  for (const [k, v] of Object.entries(t.semantic)) lines.push(`  --${k}: ${v};`);
  lines.push(`  --font-display: ${PAIRS[CONFIG.pair].display};`, `  --font-text: ${PAIRS[CONFIG.pair].text};`, "  --radius-sm: 4px; --radius-md: 8px; --radius-lg: 14px;", "  --space-1: 4px; --space-2: 8px; --space-3: 12px; --space-4: 16px; --space-6: 24px; --space-8: 32px; --space-12: 48px;", "}");
  return lines.join("\n");
}
const download = (name, text, type) => { const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([text], { type })); a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000); };

/* ---------- panel ---------- */
for (const m of Object.keys(MARKS)) { const b = document.createElement("button"); b.textContent = m; b.className = m === CONFIG.mark ? "on" : ""; b.onclick = () => { CONFIG.mark = m; [...$("marks").children].forEach((x) => x.classList.toggle("on", x === b)); render(); }; $("marks").append(b); }
PAIRS.forEach((p, i) => $("pair").add(new Option(p.name, i)));
const bind = (id, key, num) => $(id).addEventListener("input", (e) => { CONFIG[key] = num ? +e.target.value : e.target.value; render(); });
bind("name", "name"); bind("tagline", "tagline"); bind("hue", "hue", 1); bind("chroma", "chroma", 1); bind("acc", "accentOffset", 1); bind("pair", "pair", 1);
$("dlLogo").onclick = () => { const t = tokens(); download(CONFIG.name.toLowerCase() + "-logo.svg", logoSVG(t, 96, t.neutral[900]), "image/svg+xml"); download(CONFIG.name.toLowerCase() + "-mark.svg", markSVG(t, 512), "image/svg+xml"); };
$("dlTokens").onclick = () => { const t = tokens(); download("tokens.css", cssTokens(t), "text/css"); download("tokens.json", JSON.stringify({ color: t, font: PAIRS[CONFIG.pair] }, null, 2), "application/json"); };
render();
window.brand = { CONFIG, tokens, render, contrast, oklch };
