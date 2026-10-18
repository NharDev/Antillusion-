# Cross-platform release: shipping one game to web, PC, Steam Deck, mobile and consoles
tags: release ship publish cross platform port porting steam steamworks steam deck verified itch web windows macos linux notarization code signing android ios app store google play xbox gdk id@xbox playstation nintendo switch console certification trc lotcheck age rating iarc esrb pegi performance budget electron tauri capacitor godot unity unreal لعبه العاب نشر اصدار منصات متجر ستيم كونسول بلايستيشن اكس بوكس نينتندو جوال توقيع شهاده اداء

## Engine vs platform matrix
| Target | Godot 4 | Unity | Unreal 5 | Web stack (three.js / Phaser / Canvas) |
|---|---|---|---|---|
| Web (browser) | yes (WebAssembly; threads need COOP/COEP headers; C# web export limited) | yes (WebGL / WebGPU builds, large downloads) | no official modern web export | native home |
| Windows / Linux | yes | yes | yes | Electron (≈100+ MB, easiest), Tauri (small, uses system WebView — test WebGL/WebGPU per OS), NW.js |
| macOS | yes (sign + notarize) | yes | yes | Electron / Tauri (sign + notarize) |
| Steam Deck | Linux or Windows build via Proton | yes | yes | Electron Windows build under Proton or native Linux build |
| Android / iOS | yes | yes (strongest) | yes (heavy) | Capacitor (WebView wrapper), or PWA |
| Xbox | via third-party porting | console module after approval | console support after approval | not natively; Edge browser / UWP-style app for hobby use |
| PlayStation | via third-party porting | console module after approval | after approval | not possible without a full port |
| Switch / Switch 2 | via third-party porting | module after approval | after approval | not possible without a full port |
If consoles are a serious goal, choose Unity or Unreal early, or Godot with a porting partner budgeted. A web game going to consoles means a rewrite or a porting house with its own runtime.

## Web release
- Hosts: itch.io (zip with `index.html`), Newgrounds, GitHub Pages / Cloudflare Pages, portals (Poki, CrazyGames) which require their SDK, ad/pause hooks and small initial loads.
- Budget: first playable in < 5–10 MB, stream the rest; compress textures (KTX2/Basis), Brotli/gzip, audio as Opus/AAC.
- Unlock audio on first gesture; handle `visibilitychange` (pause + mute); fullscreen button; WebGL context loss; test Safari iOS (memory limits, no Pointer Lock on iOS).
- `SharedArrayBuffer` / threads need `Cross-Origin-Opener-Policy: same-origin` + `Cross-Origin-Embedder-Policy: require-corp`.

## Steam (PC + Deck)
- Steamworks partner account + Steam Direct fee per app (US$100, recoupable after the game earns US$1,000). Tax/bank info, store page review, build review; set "Coming Soon" early (wishlists) — Valve requires the page to be live a while before launch.
- Upload builds with SteamPipe (depots per OS, branches for beta). Use `steam_appid.txt` next to the exe only in development.
- Electron/Node: `steamworks.js` (npm) — `const client = require('steamworks.js').init(APP_ID)`; achievements `client.achievement.activate('ACH_WIN')`; call its `electronEnableSteamOverlay()` for the overlay. Godot: GodotSteam. Unity: Steamworks.NET / Facepunch.Steamworks. Unreal: Online Subsystem Steam.
- Achievements: define in Steamworks admin (API name, icons, hidden flag), unlock by API, test with a dev account then reset. Stats for progress achievements.
- Cloud saves: **Steam Auto-Cloud** (configure save paths per OS in the admin panel — no code) or the remote-storage API. Keep saves small, one file per slot.
- **Steam Deck Verified checklist**: full controller support with a sensible default layout; controller glyphs (no keyboard/mouse prompts while using the pad; ideally Deck/Xbox-style A B X Y); default resolution works at 1280×800 (16:10) or 1280×720 with letterbox; text legible on a 7" screen (Valve cites a minimum around 9 px at 1280×800 — aim for ≥ 12 px); on-screen keyboard for text entry (via Steam's API); no unsupported launcher/required external sign-in; works under Proton (or native Linux); anti-cheat must be Proton-compatible. Deck hardware: 4-core Zen 2 APU, 16 GB shared memory — aim 30–60 fps, offer a 30/40 fps cap and a battery-saving preset.

## Windows / macOS / Linux packaging
- Windows: code-sign (OV/EV certificate or a cloud signing service) to reduce SmartScreen warnings; installer (NSIS/MSIX) or plain zip for Steam/itch.
- macOS: Apple Developer Program (US$99/yr) → "Developer ID Application" cert → hardened runtime + entitlements → notarize (`xcrun notarytool submit app.zip --keychain-profile <profile> --wait`) → `xcrun stapler staple App.app`. electron-builder / electron-forge and Godot/Unity exports can automate this. Ship universal (arm64 + x64) or arm64. Mac App Store is a separate sandboxed path.
- Linux: Steam (Proton or native with Steam Runtime), AppImage / Flatpak for itch. Test on Deck's SteamOS.

## Mobile stores
| | Google Play | Apple App Store |
|---|---|---|
| Account | one-time US$25 fee; new personal accounts must run a closed test with a minimum number of testers for ~2 weeks before production | Apple Developer Program US$99/yr |
| Package | Android App Bundle (`.aab`), signed via Play App Signing; target API level must meet the yearly requirement | Xcode archive, TestFlight beta, App Review |
| Gotchas | 64-bit libs, permissions declaration, data safety form, IARC rating questionnaire | privacy labels + required-reason APIs, Sign in with Apple if you offer other social logins, no "quit" button |
Wrapper path for web games: Capacitor (+ native plugins for IAP, Game Center / Play Games, haptics). Handle notches/safe areas, 60/90/120 Hz displays (use delta time), thermal throttling, app backgrounding = pause + save.

## Consoles — the honest version
- **You cannot just export to a console.** All three require registering as a developer, approval, NDAs, private SDKs and devkits (dev hardware loaned or bought), and passing certification before release.
  - Xbox: apply to **ID@Xbox**; development uses the **Microsoft GDK** and devkits. Hobby route: **Xbox Dev Mode** turns a retail console into a dev box for UWP apps (Partner Center developer account) — fine for testing/sideloading, not a store release; resources for UWP apps are limited.
  - PlayStation: apply through **PlayStation Partners**; SDK and devkits/testkits after approval.
  - Nintendo: register on the **Nintendo Developer Portal** and apply for Switch / Switch 2 development; SDK and devkits after approval.
- **Engines**: Unity and Unreal provide console platform modules/support only to approved developers. **Godot** has no public console exports (console SDK code can't be open source) — use porting companies such as **W4 Games**, **Lone Wolf Technology** or **Pineapple Works**, or do it yourself with your own approved SDK access.
- **Web stack**: no WebView/browser runtime is available to third-party games on PlayStation or Switch. Ship there via an engine port or a porting house that maintains its own JS runtime. Xbox has Edge and WebView-based app models but store release still goes through ID@Xbox.
- Publishers/porting partners often handle cert, ratings and submission for a revenue share — usual path for small teams.

## Certification themes (Sony TRC / Xbox XR / Nintendo Lotcheck — exact rules are under NDA)
| Theme | What to build now so porting is cheap |
|---|---|
| Controller disconnect | pause + reconnect prompt, re-pairing to the right user |
| Suspend / resume | survive being suspended for hours; re-validate network sessions; save on suspend signals |
| Save data | never corrupt (write temp → verify → rename), handle full storage, save indicator ("don't turn off"), no saving during that state change |
| Users / profiles | game tied to the signed-in user; handle sign-out, user switch, guest accounts; parental controls / restricted online play |
| Safe area | keep HUD and text inside the system safe area (classic: title-safe 90 %, action-safe 93 % of the screen) |
| Terminology & glyphs | platform's exact names ("Wireless Controller", "PS button", "Joy-Con", "Xbox Wireless Controller"), correct glyphs, correct confirm button (Nintendo A) |
| Stability | no crashes, hangs, progression blockers or memory leaks over long sessions |
| Loading | show activity during loads; keep loads short (platforms have time limits for unresponsive screens) |
| Online | handle network loss gracefully, respect platform privacy/communication settings, platform friends/presence |
| Trophies / achievements | all unlockable, correct timing, no unlocks in debug |
| Ratings | age rating before release |

## Age ratings
**IARC**: free questionnaire, gives ratings for participating digital stores (Google Play, Microsoft Store, Nintendo eShop, PlayStation Store, others) in many regions at once. Physical/retail and some console releases need **ESRB** (North America), **PEGI** (Europe), **USK** (Germany), **CERO** (Japan), plus others (GRAC Korea, ClassInd Brazil, ACB Australia). Steam uses its own content survey. Declare loot boxes, in-app purchases, user interaction, violence, language honestly.

## Performance budgets by platform class (starting points — profile on real hardware)
| Class | Target | Draw calls / frame | Texture memory | Notes |
|---|---|---|---|---|
| Low-end mobile / mobile web | 30 fps (60 for simple 2D) | ≤ 100–150 | ≤ 150–300 MB | ASTC/ETC2, mediump, minimal overdraw, half-res post |
| High-end mobile | 60 fps | ≤ 300–500 | ≤ 500 MB–1 GB | thermal throttle after minutes — test 20-min sessions |
| Switch (original) | 30 fps 3D / 60 fps 2D, 720p handheld / up to 1080p docked | ≤ 500–1000 | total game memory ≈ 3 GB of the 4 GB | ASTC, dynamic resolution |
| Steam Deck | 30–60 fps at 800p | ≤ 1000–2000 | share of 16 GB unified | FSR/upscaling fine; test battery draw |
| Desktop browser | 60 fps | ≤ 300–1000 (WebGL overhead per call) | ≤ 1 GB | instancing, atlases, one WebGL context |
| Mid PC / Series S / PS4-class | 60 fps 1080p (Series S often 1080–1440p) | 2000–5000 | 4–8 GB | Series S has noticeably less memory than Series X/PS5 — the usual bottleneck |
| Series X / PS5 / high PC | 60 fps (30 for fidelity mode) | 5000+ | 8–12 GB | offer performance/quality modes |
Frame time = 16.6 ms @60 / 33.3 ms @30. Budget roughly: gameplay+AI 3–4 ms, physics 2 ms, rendering 8–10 ms, audio/UI the rest. Memory headroom ≥ 15 %. Measure on the weakest target first.

## Architecture rules for portability
1. **Platform abstraction layer** — the game never calls a platform SDK directly:
```js
// platform/index.js — one implementation per target (web, steam, mobile, console)
export const Platform = {
  input:        { onDeviceChanged(cb) {}, glyph(action) {} },
  saves:        { async read(slot) {}, async write(slot, bytes) {}, async list() {} },
  achievements: { unlock(id) {}, setStat(id, v) {} },
  store:        { async purchase(sku) {}, async owned() {} },
  presence:     { set(textKey, args) {} },     // rich presence / activity
  user:         { id() {}, displayName() {}, onSignOut(cb) {} },
  lifecycle:    { onSuspend(cb) {}, onResume(cb) {}, onQuitRequest(cb) {} },
  quitAllowed:  true,                          // false on iOS / consoles → hide "Quit to Desktop"
};
```
2. **Input**: action map (see `game-input-platforms` card); prompts from the platform glyph provider; never hard-code "Press E".
3. **Saves**: versioned schema (`{ v: 3, … }` + migrations), checksum, atomic write, backup slot, small binary/JSON blobs, cloud-friendly (one file per slot, no absolute paths).
4. **Resolution independence**: design at a reference (1920×1080), scale UI by `min(w/1920, h/1080)`, anchor to edges/safe area, support 16:9, 16:10 (Deck), 21:9, 4:3-ish tablets and portrait if mobile; render resolution separate from UI resolution (dynamic resolution).
5. **Localisation**: all text from string tables by key (`ui.pause.resume`), ICU-style plurals/gender, allow 30–40 % text expansion (German/French), CJK + Arabic fonts with fallback, RTL layout mirroring, no text baked into textures, locale-aware numbers/dates.
6. **Content**: per-platform asset variants (texture compression: BC7/BC* desktop and Xbox/PS, ASTC mobile/Switch, ETC2 Android fallback, KTX2/Basis for web), quality presets as data.
7. **Build pipeline**: CI building every target from one commit, per-platform feature flags, automated smoke test (boot → menu → load level → save → quit), crash reporting, build number visible in the main menu.
8. **Terminology**: platform-specific strings (`"Press {pause}"`, "Wireless Controller" vs "Xbox Wireless Controller") come from the platform layer.

## Electron / Tauri / Capacitor specifics for web games
- Electron: `BrowserWindow({ backgroundColor: '#000', show: false })` then show on `ready-to-show` (no white flash); `webPreferences: { backgroundThrottling: false }` so the loop doesn't stall when unfocused (but still pause the game on blur); enable fullscreen toggle (F11 / Alt+Enter); disable the default menu bar; package with electron-builder (`win: nsis/zip`, `mac: dmg + notarize`, `linux: AppImage`).
- Save files in the per-user app data directory (`app.getPath('userData')`), never next to the exe (Program Files is read-only).
- Steam overlay in Electron needs the steamworks.js overlay helper and may need GPU flags; test early.
- Tauri: smaller builds but each OS uses a different WebView (WebView2 / WKWebView / WebKitGTK) — check WebGL2, WebGPU, gamepad and audio on all three.
- Capacitor: keep the game in a single canvas, lock orientation, disable WebView bounce/zoom, use native plugins for haptics, IAP and leaderboards.

## Store page and launch assets (all platforms)
| Asset | Notes |
|---|---|
| Capsule / key art | readable at thumbnail size; logo + one strong image; no review quotes in capsules on Steam |
| Screenshots | 5–10 real gameplay, at native res (16:9 1920×1080; phone portrait/landscape for mobile) |
| Trailer | 30–90 s, gameplay in the first 5 s, no long logo intro |
| Short description | genre + hook + what the player does, one or two sentences |
| Tags / categories | accurate genre tags; controller support flags; Deck compatibility |
| Localised page | translate store text for your top markets even if the game is English-only (say so) |

## Release checklist (per platform)
- [ ] Builds from CI with the version number shown in the main menu; symbols kept for crash reports.
- [ ] First-boot flow: language, brightness/safe-area calibration (console/TV), controls hint, no unskippable splash > 5 s.
- [ ] Settings persist; saves survive update from previous version (migration tested).
- [ ] Controller disconnect, alt-tab/backgrounding, suspend/resume, low storage, offline start all tested.
- [ ] All achievements obtainable; stats reset for test accounts.
- [ ] Performance on the weakest target meets the budget for 30+ minutes (thermals, leaks).
- [ ] Age rating, privacy policy URL, EULA/credits and third-party licences screen.
- [ ] Day-one patch path: how you ship hotfixes on each store (Steam branch, store review times on mobile/console — plan for days, not hours).
