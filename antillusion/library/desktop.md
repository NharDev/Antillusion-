# Desktop apps (Electron, Tauri)
tags: electron tauri desktop app window ipc preload native installer exe packaging tray menu تطبيق سطح المكتب برنامج ويندوز exe

Electron structure: `main.js` (main process: windows, menus, file system, child processes), `preload.js` (the only bridge), `renderer/` (a normal web app). Security baseline: `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true` where possible; expose a narrow API with `contextBridge.exposeInMainWorld("api", { openFile: () => ipcRenderer.invoke("file:open") })`; validate every IPC argument in main; never load remote content with Node access; open external links with `shell.openExternal` after checking the scheme.

IPC: request/response = `ipcMain.handle(channel, async (event, args) => result)` ↔ `ipcRenderer.invoke`; push from main = `win.webContents.send(channel, data)` ↔ `ipcRenderer.on`. Keep heavy work off the UI thread (main process async APIs, `utilityProcess`, worker threads).

Lifecycle: `app.whenReady().then(createWindow)`; `app.on("window-all-closed", () => process.platform !== "darwin" && app.quit())`; single instance with `app.requestSingleInstanceLock()`; persist window bounds; user data in `app.getPath("userData")`; secrets with `safeStorage.encryptString`.

Dev: `npx electron .`; reload renderer with Ctrl+R; debug main with `--inspect`. Package: electron-builder (`"build": { "appId", "win": { "target": "nsis" } }` → `npx electron-builder --win`) or `@electron/packager`. Auto-update via electron-updater; code signing needed to avoid SmartScreen warnings.

Native modules must match Electron's ABI (`electron-rebuild`); prefer pure-JS or N-API prebuilt packages.

Tauri: Rust core + system webview (tiny binaries). Commands: `#[tauri::command] fn greet(name: &str) -> String` registered in `invoke_handler`, called with `invoke("greet", { name })`. Capabilities/permissions are declared per window in `src-tauri/capabilities`. Needs the Rust toolchain and, on Windows, WebView2 + MSVC build tools.

Other routes: Python → PySide6 or pywebview + PyInstaller; .NET → WPF/WinUI/Avalonia (`dotnet publish -r win-x64 --self-contained`); Go → Wails; Flutter desktop.
