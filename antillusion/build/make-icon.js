/* Renders the app icon from SVG and writes ui/icon.png (256) + icon.ico (16–256, PNG-compressed entries).
   Run with Electron:  electron build/make-icon.js */
"use strict";

const { app, BrowserWindow, nativeImage } = require("electron");
const fs = require("fs");
const path = require("path");

const SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" width="256" height="256">
  <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#93abff"/><stop offset="1" stop-color="#5a78ee"/></linearGradient></defs>
  <rect x="8" y="8" width="240" height="240" rx="58" fill="url(#g)"/>
  <circle cx="128" cy="128" r="62" fill="none" stroke="#fff" stroke-width="15"/>
  <path d="M128 66a62 62 0 0 1 0 124z" fill="#fff"/>
</svg>`;

app.disableHardwareAcceleration();
app.whenReady().then(async () => {
  const win = new BrowserWindow({ width: 256, height: 256, show: false, frame: false, transparent: true, useContentSize: true, webPreferences: { offscreen: true } });
  await win.loadURL("data:text/html;charset=utf-8," + encodeURIComponent(`<body style="margin:0;background:transparent;overflow:hidden">${SVG}</body>`));
  await new Promise((r) => setTimeout(r, 400));
  const full = nativeImage.createFromBuffer((await win.webContents.capturePage()).resize({ width: 256, height: 256, quality: "best" }).toPNG());
  const root = path.join(__dirname, "..");
  fs.writeFileSync(path.join(root, "ui", "icon.png"), full.toPNG());

  const sizes = [16, 24, 32, 48, 64, 128, 256], pngs = sizes.map((s) => (s === 256 ? full : full.resize({ width: s, height: s, quality: "best" })).toPNG());
  const head = Buffer.alloc(6 + 16 * sizes.length); head.writeUInt16LE(0, 0); head.writeUInt16LE(1, 2); head.writeUInt16LE(sizes.length, 4);
  let offset = head.length;
  sizes.forEach((s, i) => {
    const o = 6 + 16 * i;
    head.writeUInt8(s === 256 ? 0 : s, o); head.writeUInt8(s === 256 ? 0 : s, o + 1); head.writeUInt8(0, o + 2); head.writeUInt8(0, o + 3);
    head.writeUInt16LE(1, o + 4); head.writeUInt16LE(32, o + 6); head.writeUInt32LE(pngs[i].length, o + 8); head.writeUInt32LE(offset, o + 12);
    offset += pngs[i].length;
  });
  fs.writeFileSync(path.join(root, "icon.ico"), Buffer.concat([head, ...pngs]));
  console.log("icon written:", sizes.join(", "));
  app.quit();
});
