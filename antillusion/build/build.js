/* Full Windows build:  node build/build.js
   icon → packaged app (../antillusion-build) → app.zip → self-extracting installer (../antillusion-setup/Antillusion-Setup.exe).
   Uses the Electron + packager already installed in ../desktop/node_modules and Windows' own IExpress; nothing is downloaded
   when the Electron zip is in the local cache. The API key file (.env) is never packaged. */
"use strict";

const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

const app = path.join(__dirname, ".."), root = path.join(app, "..");
// prefer the project's own dev dependencies; fall back to the older sibling ../desktop install
const tools = [path.join(app, "node_modules"), path.join(root, "desktop", "node_modules")].find((d) => fs.existsSync(path.join(d, "@electron", "packager"))) || path.join(app, "node_modules");
const electron = path.join(tools, "electron", "dist", "electron.exe");
const version = require(path.join(tools, "electron", "package.json")).version;
const outDir = path.join(root, "antillusion-build"), setupDir = path.join(root, "antillusion-setup"), packed = path.join(outDir, "Antillusion-win32-x64");
const run = (file, args, opts = {}) => execFileSync(file, args, { stdio: "inherit", ...opts });
const step = (s) => console.log("\n== " + s);

(async () => {
  step("icon");
  run(electron, [path.join(__dirname, "make-icon.js")], { env: Object.fromEntries(Object.entries(process.env).filter(([k]) => k !== "ELECTRON_RUN_AS_NODE")) });

  step(`package (Electron ${version})`);
  const { packager } = await import(require("url").pathToFileURL(path.join(tools, "@electron", "packager", "dist", "index.js")).href);   // ESM-only package
  await packager({
    dir: app, name: "Antillusion", platform: "win32", arch: "x64", electronVersion: version, out: outDir, overwrite: true, asar: false, prune: false,
    icon: path.join(app, "icon.ico"), appCopyright: "Antillusion", win32metadata: { CompanyName: "Antillusion", FileDescription: "Antillusion", ProductName: "Antillusion" },
    ignore: [/^\/test($|\/)/, /^\/build($|\/)/, /^\/installer($|\/)/, /^\/model($|\/)/,/^\/node_modules($|\/)/, /^\/\.env/, /\.bat$/, /^\/package-lock\.json$/],
  });

  step("zip");
  fs.mkdirSync(setupDir, { recursive: true });
  const zip = path.join(setupDir, "app.zip");
  fs.rmSync(zip, { force: true });
  const sys32 = path.join(process.env.SystemRoot || "C:\\Windows", "System32");   // Windows' own bsdtar: the Git one cannot write zip
  run(path.join(sys32, "tar.exe"), ["-a", "-cf", zip, "-C", packed, "."]);
  for (const f of ["install.cmd", "setup.ps1"]) fs.copyFileSync(path.join(app, "installer", f), path.join(setupDir, f));

  step("installer (IExpress)");
  const exe = path.join(setupDir, "Antillusion-Setup.exe"), sed = path.join(setupDir, "setup.sed");
  fs.rmSync(exe, { force: true });
  fs.writeFileSync(sed, ["[Version]", "Class=IEXPRESS", "SEDVersion=3", "[Options]", "PackagePurpose=InstallApp", "ShowInstallProgramWindow=1", "HideExtractAnimation=0", "UseLongFileName=1", "InsideCompressed=0", "CAB_FixedSize=0",
    "CAB_ResvCodeSigning=0", "RebootMode=N", "InstallPrompt=", "DisplayLicense=", "FinishMessage=", `TargetName=${exe}`, "FriendlyName=Antillusion Setup", "AppLaunched=cmd /c .\\install.cmd", "PostInstallCmd=<None>",
    "AdminQuietInstCmd=", "UserQuietInstCmd=", "SourceFiles=SourceFiles", "[Strings]", 'FILE0="app.zip"', 'FILE1="install.cmd"', 'FILE2="setup.ps1"', "[SourceFiles]", `SourceFiles0=${setupDir}\\`, "[SourceFiles0]", "%FILE0%=", "%FILE1%=", "%FILE2%=", ""].join("\r\n"));
  // a relative .sed run from its own folder: IExpress fails on an absolute path that contains spaces
  try { run(path.join(sys32, "iexpress.exe"), ["/N", "/Q", "setup.sed"], { cwd: setupDir }); } catch (e) { console.log("iexpress exit status", e.status, "— checking for the output file"); }
  for (let i = 0; i < 120 && !fs.existsSync(exe); i++) await new Promise((r) => setTimeout(r, 1000));   // iexpress returns before the file is closed
  if (!fs.existsSync(exe)) throw new Error("IExpress did not produce the installer");
  console.log(`\nDone: ${exe} (${(fs.statSync(exe).size / 1048576).toFixed(0)} MB)`);
})().catch((e) => { console.error(e); process.exit(1); });
