# Antillusion full installer (runs from Antillusion-Setup.exe after install.cmd has unpacked the app).
# Per-user: no admin rights. Downloads whatever is missing (Node.js LTS, Git, OmniRoute), then creates shortcuts and starts the app.
$ErrorActionPreference = "Stop"
$ProgressPreference = "SilentlyContinue"
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

$dir = Join-Path $env:LOCALAPPDATA "Programs\Antillusion"
$rt  = Join-Path $dir "runtime"
$exe = Join-Path $dir "Antillusion.exe"
$log = Join-Path $env:TEMP "antillusion-setup.log"
Start-Transcript -Path $log -Force | Out-Null
$Host.UI.RawUI.WindowTitle = "Antillusion Setup"

function Step($n, $total, $text) { Write-Host ""; Write-Host "[$n/$total] $text" -ForegroundColor Cyan }
function Ok($text)   { Write-Host "  + $text" -ForegroundColor Green }
function Warn($text) { Write-Host "  ! $text" -ForegroundColor Yellow }

function Download($url, $out) {
  for ($i = 1; $i -le 3; $i++) {
    try { Write-Host "  downloading $url"; Invoke-WebRequest -Uri $url -OutFile $out -UseBasicParsing -Headers @{ "User-Agent" = "Antillusion-Setup" }; return }
    catch { if ($i -eq 3) { throw "download failed: $url ($($_.Exception.Message))" }; Warn "attempt $i failed, retrying..."; Start-Sleep -Seconds (2 * $i) }
  }
}
function Sha256($file) { (Get-FileHash -Algorithm SHA256 -Path $file).Hash.ToLower() }
function AddUserPath($p) {
  $cur = [Environment]::GetEnvironmentVariable("Path", "User"); if (-not $cur) { $cur = "" }
  if (($cur -split ";") -notcontains $p) { [Environment]::SetEnvironmentVariable("Path", ($p + ";" + $cur).TrimEnd(";"), "User") }
  if (($env:Path -split ";") -notcontains $p) { $env:Path = $p + ";" + $env:Path }
}
function HasCmd($name) { [bool](Get-Command $name -ErrorAction SilentlyContinue) }
function NodeOk {
  if (-not (HasCmd "node")) { return $false }
  try { return ([int](((& node -v) -replace "^v", "") -split "\.")[0]) -ge 18 } catch { return $false }
}

try {
  $total = 5
  New-Item -ItemType Directory -Force -Path $rt | Out-Null
  # a runtime we installed earlier counts even if the user PATH has not reached this process yet
  foreach ($p in @((Join-Path $rt "node"), (Join-Path $rt "git\cmd"))) { if (Test-Path $p) { $env:Path = $p + ";" + $env:Path } }

  Step 1 $total "Node.js (needed by OmniRoute)"
  if (NodeOk) { Ok "found Node.js $(& node -v)" }
  else {
    $idx = Invoke-RestMethod -Uri "https://nodejs.org/dist/index.json" -UseBasicParsing
    $rel = $idx | Where-Object { $_.lts -and ($_.files -contains "win-x64-zip") } | Select-Object -First 1
    if (-not $rel) { throw "could not find a Node.js LTS release" }
    $v = $rel.version; $zipName = "node-$v-win-x64.zip"; $zip = Join-Path $env:TEMP $zipName
    Download "https://nodejs.org/dist/$v/$zipName" $zip
    $sums = (Invoke-WebRequest -Uri "https://nodejs.org/dist/$v/SHASUMS256.txt" -UseBasicParsing).Content
    $want = ($sums -split "`n" | Where-Object { $_ -match [regex]::Escape($zipName) } | Select-Object -First 1) -split "\s+" | Select-Object -First 1
    if ($want -and (Sha256 $zip) -ne $want.ToLower()) { throw "Node.js download is corrupt (checksum mismatch)" }
    $nodeDir = Join-Path $rt "node"; if (Test-Path $nodeDir) { Remove-Item -Recurse -Force $nodeDir }
    Expand-Archive -Path $zip -DestinationPath $rt -Force
    Rename-Item -Path (Join-Path $rt "node-$v-win-x64") -NewName "node"
    Remove-Item $zip -Force
    AddUserPath $nodeDir
    Ok "installed Node.js $v"
  }

  Step 2 $total "Git (used by the agent and the updater)"
  if (HasCmd "git") { Ok "found $(& git --version)" }
  else {
    try {
      $api = Invoke-RestMethod -Uri "https://api.github.com/repos/git-for-windows/git/releases/latest" -UseBasicParsing -Headers @{ "User-Agent" = "Antillusion-Setup" }
      $asset = $api.assets | Where-Object { $_.name -match "^PortableGit-.*-64-bit\.7z\.exe$" } | Select-Object -First 1
      if (-not $asset) { throw "no PortableGit asset in the latest release" }
      $pg = Join-Path $env:TEMP $asset.name
      Download $asset.browser_download_url $pg
      if ($asset.digest -and $asset.digest -like "sha256:*" -and (Sha256 $pg) -ne $asset.digest.Substring(7).ToLower()) { throw "Git download is corrupt (checksum mismatch)" }
      $gitDir = Join-Path $rt "git"; if (Test-Path $gitDir) { Remove-Item -Recurse -Force $gitDir }
      Start-Process -FilePath $pg -ArgumentList @("-o", "`"$gitDir`"", "-y") -Wait -NoNewWindow
      Remove-Item $pg -Force
      AddUserPath (Join-Path $gitDir "cmd")
      Ok "installed $(& git --version)"
    } catch { Warn "Git was not installed: $($_.Exception.Message). Antillusion works without it, but git features and in-app git updates will not."; }
  }

  Step 3 $total "Antillusion"
  if (-not (Test-Path $exe)) { throw "Antillusion.exe was not unpacked ($exe)" }
  Ok "app files are in $dir"

  Step 4 $total "OmniRoute (local model router on port 20128)"
  $omni = Join-Path $env:APPDATA "npm\node_modules\omniroute\bin\omniroute.mjs"
  if (Test-Path $omni) { Ok "OmniRoute already installed" }
  else {
    try {
      & npm install -g omniroute --no-audit --no-fund 2>&1 | ForEach-Object { Write-Host "  $_" }
      if ($LASTEXITCODE -ne 0 -or -not (Test-Path $omni)) { throw "npm install -g omniroute failed (exit $LASTEXITCODE)" }
      Ok "installed OmniRoute"
    } catch { Warn "OmniRoute was not installed: $($_.Exception.Message). You can run 'npm install -g omniroute' later, or point Antillusion at OpenRouter in Settings." }
  }

  Step 5 $total "Shortcuts and uninstall entry"
  $ws = New-Object -ComObject WScript.Shell
  foreach ($p in @([Environment]::GetFolderPath("Desktop"), [Environment]::GetFolderPath("Programs"))) {
    $lnk = $ws.CreateShortcut((Join-Path $p "Antillusion.lnk")); $lnk.TargetPath = $exe; $lnk.WorkingDirectory = $dir; $lnk.IconLocation = "$exe,0"; $lnk.Description = "Antillusion - AI coding agent"; $lnk.Save()
  }
  $un = Join-Path $dir "Uninstall-Antillusion.cmd"
  @"
@echo off
taskkill /IM Antillusion.exe /F >nul 2>&1
del "%USERPROFILE%\Desktop\Antillusion.lnk" >nul 2>&1
del "%APPDATA%\Microsoft\Windows\Start Menu\Programs\Antillusion.lnk" >nul 2>&1
reg delete "HKCU\Software\Microsoft\Windows\CurrentVersion\Uninstall\Antillusion" /f >nul 2>&1
start "" cmd /c "ping -n 3 127.0.0.1 >nul & rmdir /s /q ""$dir"""
"@ | Set-Content -Path $un -Encoding ASCII
  $ver = "1.0.0"; try { $ver = (Get-Content (Join-Path $dir "resources\app\package.json") -Raw | ConvertFrom-Json).version } catch {}
  $k = "HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall\Antillusion"
  New-Item -Path $k -Force | Out-Null
  Set-ItemProperty $k DisplayName "Antillusion"; Set-ItemProperty $k DisplayIcon $exe; Set-ItemProperty $k Publisher "Antillusion"; Set-ItemProperty $k DisplayVersion $ver
  Set-ItemProperty $k InstallLocation $dir; Set-ItemProperty $k UninstallString "`"$un`""; Set-ItemProperty $k NoModify 1 -Type DWord; Set-ItemProperty $k NoRepair 1 -Type DWord
  Ok "done (version $ver)"

  Write-Host ""; Write-Host "Starting Antillusion..." -ForegroundColor Green
  Remove-Item Env:ELECTRON_RUN_AS_NODE -ErrorAction SilentlyContinue
  Start-Process -FilePath $exe -WorkingDirectory $dir
  Start-Sleep -Seconds 2
  Stop-Transcript | Out-Null
}
catch {
  Write-Host ""; Write-Host "Setup failed: $($_.Exception.Message)" -ForegroundColor Red
  Write-Host "Log: $log"
  Stop-Transcript | Out-Null
  Read-Host "Press Enter to close"
  exit 1
}
