# Antillusion Setup (tiny bootstrapper). The .exe only contains this script; it downloads the app and whatever is missing
# (Node.js, Git, OmniRoute), installs per-user (no admin rights), creates shortcuts and starts Antillusion.
#   -Silent       no window (console output only)      -NoLaunch      do not start the app at the end
#   -Payload X    app zip: a local path or URL         -ForceRuntime  download Node/Git even if already installed (CI uses it)
param([switch]$Silent, [switch]$NoLaunch, [switch]$ForceRuntime, [string]$Payload = "")
$ErrorActionPreference = "Stop"
$ProgressPreference = "SilentlyContinue"
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

$Repo = "NharDev/Antillusion-"
$PayloadName = "Antillusion-app-win-x64.zip"
$dir = Join-Path $env:LOCALAPPDATA "Programs\Antillusion"
$rt  = Join-Path $dir "runtime"
$exe = Join-Path $dir "Antillusion.exe"
$log = Join-Path $env:TEMP "antillusion-setup.log"
Start-Transcript -Path $log -Force | Out-Null

# ---------- window ----------
$gui = -not $Silent
if ($gui) {
  try {
    Add-Type -AssemblyName System.Windows.Forms, System.Drawing
    [System.Windows.Forms.Application]::EnableVisualStyles()
    $form = New-Object System.Windows.Forms.Form
    $form.Text = "Antillusion Setup"; $form.ClientSize = New-Object System.Drawing.Size(460, 170); $form.StartPosition = "CenterScreen"
    $form.FormBorderStyle = "FixedDialog"; $form.MaximizeBox = $false; $form.MinimizeBox = $true; $form.BackColor = [System.Drawing.Color]::FromArgb(18, 19, 22); $form.TopMost = $false
    $title = New-Object System.Windows.Forms.Label; $title.Text = "Antillusion"; $title.ForeColor = [System.Drawing.Color]::White
    $title.Font = New-Object System.Drawing.Font("Segoe UI", 20, [System.Drawing.FontStyle]::Bold); $title.Location = New-Object System.Drawing.Point(24, 18); $title.AutoSize = $true
    $status = New-Object System.Windows.Forms.Label; $status.Text = "Starting..."; $status.ForeColor = [System.Drawing.Color]::FromArgb(170, 174, 184)
    $status.Font = New-Object System.Drawing.Font("Segoe UI", 10); $status.Location = New-Object System.Drawing.Point(26, 72); $status.Size = New-Object System.Drawing.Size(410, 22)
    $bar = New-Object System.Windows.Forms.ProgressBar; $bar.Location = New-Object System.Drawing.Point(26, 104); $bar.Size = New-Object System.Drawing.Size(408, 12); $bar.Minimum = 0; $bar.Maximum = 100
    $hint = New-Object System.Windows.Forms.Label; $hint.Text = "This only takes a minute. Nothing needs administrator rights."; $hint.ForeColor = [System.Drawing.Color]::FromArgb(110, 115, 125)
    $hint.Font = New-Object System.Drawing.Font("Segoe UI", 8.5); $hint.Location = New-Object System.Drawing.Point(26, 128); $hint.Size = New-Object System.Drawing.Size(410, 20)
    $form.Controls.AddRange(@($title, $status, $bar, $hint)); $form.Show(); [System.Windows.Forms.Application]::DoEvents()
  } catch { $gui = $false }
}
function Pump { if ($gui) { [System.Windows.Forms.Application]::DoEvents() } }
function Progress($pct, $text) {
  Write-Host "[$pct%] $text"
  if ($gui) { $status.Text = $text; $bar.Value = [Math]::Max(0, [Math]::Min(100, [int]$pct)); Pump }
}
function Warn($text) { Write-Host "  ! $text" -ForegroundColor Yellow }

# ---------- helpers ----------
function Download($url, $out, $from, $to, $label) {
  for ($try = 1; $try -le 3; $try++) {
    try {
      Write-Host "  GET $url"
      $wc = New-Object System.Net.WebClient; $wc.Headers["User-Agent"] = "Antillusion-Setup"
      $done = $false; $err = $null
      $null = Register-ObjectEvent -InputObject $wc -EventName DownloadProgressChanged -SourceIdentifier "dl.p" -Action { $global:AntiPct = $EventArgs.ProgressPercentage }
      $null = Register-ObjectEvent -InputObject $wc -EventName DownloadFileCompleted -SourceIdentifier "dl.c" -Action { $global:AntiDone = $true; $global:AntiErr = $EventArgs.Error }
      $global:AntiDone = $false; $global:AntiErr = $null; $global:AntiPct = 0
      $wc.DownloadFileAsync([Uri]$url, $out)
      while (-not $global:AntiDone) { Progress ($from + ($to - $from) * $global:AntiPct / 100) "$label ($($global:AntiPct)%)"; Start-Sleep -Milliseconds 120 }
      Unregister-Event -SourceIdentifier "dl.p" -ErrorAction SilentlyContinue; Unregister-Event -SourceIdentifier "dl.c" -ErrorAction SilentlyContinue
      if ($global:AntiErr) { throw $global:AntiErr }
      return
    } catch {
      Unregister-Event -SourceIdentifier "dl.p" -ErrorAction SilentlyContinue; Unregister-Event -SourceIdentifier "dl.c" -ErrorAction SilentlyContinue
      if ($try -eq 3) { throw "download failed: $url ($($_.Exception.Message))" }
      Warn "attempt $try failed, retrying..."; Start-Sleep -Seconds (2 * $try)
    }
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
function Unzip($zip, $dest) {
  $tar = Join-Path $env:SystemRoot "System32\tar.exe"
  if (Test-Path $tar) { & $tar -xf $zip -C $dest; if ($LASTEXITCODE -eq 0) { return } }
  Expand-Archive -Path $zip -DestinationPath $dest -Force
}

try {
  # ---------- 1. the app ----------
  Progress 2 "Preparing..."
  $zip = Join-Path $env:TEMP $PayloadName
  if ($Payload -and (Test-Path $Payload)) { $zip = (Resolve-Path $Payload).Path }
  else {
    $urls = @(); if ($Payload) { $urls += $Payload }
    $urls += "https://github.com/$Repo/releases/latest/download/$PayloadName", "https://github.com/$Repo/releases/download/dev-build/$PayloadName"
    $ok = $false
    foreach ($u in $urls) { try { Download $u $zip 3 55 "Downloading Antillusion"; $ok = $true; break } catch { Warn $_.Exception.Message } }
    if (-not $ok) { throw "Could not download Antillusion. Check your internet connection and try again." }
  }
  Progress 56 "Installing Antillusion..."
  Get-Process -Name "Antillusion" -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
  Start-Sleep -Seconds 1
  New-Item -ItemType Directory -Force -Path $dir | Out-Null
  Get-ChildItem -Path $dir -Force | Where-Object { $_.Name -ne "runtime" } | Remove-Item -Recurse -Force -ErrorAction Stop   # keep Node/Git from a previous install
  Unzip $zip $dir
  if (-not $Payload -or -not (Test-Path $Payload)) { Remove-Item $zip -Force -ErrorAction SilentlyContinue }
  if (-not (Test-Path $exe)) { throw "Antillusion.exe was not unpacked ($exe)" }
  New-Item -ItemType Directory -Force -Path $rt | Out-Null
  foreach ($p in @((Join-Path $rt "node"), (Join-Path $rt "git\cmd"))) { if (Test-Path $p) { $env:Path = $p + ";" + $env:Path } }

  # ---------- 2. Node.js ----------
  if (-not $ForceRuntime -and (NodeOk)) { Progress 66 "Node.js found" }
  else {
    Progress 62 "Looking up Node.js..."
    $idx = Invoke-RestMethod -Uri "https://nodejs.org/dist/index.json" -UseBasicParsing
    $rel = $idx | Where-Object { $_.lts -and ($_.files -contains "win-x64-zip") } | Select-Object -First 1
    if (-not $rel) { throw "could not find a Node.js LTS release" }
    $v = $rel.version; $zipName = "node-$v-win-x64.zip"; $nzip = Join-Path $env:TEMP $zipName
    Download "https://nodejs.org/dist/$v/$zipName" $nzip 62 72 "Downloading Node.js $v"
    $sums = (Invoke-WebRequest -Uri "https://nodejs.org/dist/$v/SHASUMS256.txt" -UseBasicParsing).Content
    $want = ($sums -split "`n" | Where-Object { $_ -match [regex]::Escape($zipName) } | Select-Object -First 1) -split "\s+" | Select-Object -First 1
    if ($want -and (Sha256 $nzip) -ne $want.ToLower()) { throw "Node.js download is corrupt (checksum mismatch)" }
    $nodeDir = Join-Path $rt "node"; if (Test-Path $nodeDir) { Remove-Item -Recurse -Force $nodeDir }
    Progress 73 "Installing Node.js..."
    Unzip $nzip $rt
    Rename-Item -Path (Join-Path $rt "node-$v-win-x64") -NewName "node"
    Remove-Item $nzip -Force
    AddUserPath $nodeDir
  }

  # ---------- 3. Git ----------
  if (-not $ForceRuntime -and (HasCmd "git")) { Progress 80 "Git found" }
  else {
    try {
      Progress 75 "Looking up Git..."
      $api = Invoke-RestMethod -Uri "https://api.github.com/repos/git-for-windows/git/releases/latest" -UseBasicParsing -Headers @{ "User-Agent" = "Antillusion-Setup" }
      $asset = $api.assets | Where-Object { $_.name -match "^PortableGit-.*-64-bit\.7z\.exe$" } | Select-Object -First 1
      if (-not $asset) { throw "no PortableGit asset in the latest release" }
      $pg = Join-Path $env:TEMP $asset.name
      Download $asset.browser_download_url $pg 75 82 "Downloading Git"
      if ($asset.digest -and $asset.digest -like "sha256:*" -and (Sha256 $pg) -ne $asset.digest.Substring(7).ToLower()) { throw "Git download is corrupt (checksum mismatch)" }
      $gitDir = Join-Path $rt "git"; if (Test-Path $gitDir) { Remove-Item -Recurse -Force $gitDir }
      Progress 83 "Installing Git..."
      $p = Start-Process -FilePath $pg -ArgumentList @("-o", "`"$gitDir`"", "-y") -PassThru -WindowStyle Hidden
      while (-not $p.HasExited) { Pump; Start-Sleep -Milliseconds 150 }
      Remove-Item $pg -Force
      AddUserPath (Join-Path $gitDir "cmd")
    } catch { Warn "Git was not installed: $($_.Exception.Message). Antillusion works without it; git features and in-app git updates will not." }
  }

  # ---------- 4. OmniRoute ----------
  $omni = Join-Path $env:APPDATA "npm\node_modules\omniroute\bin\omniroute.mjs"
  if (Test-Path $omni) { Progress 94 "OmniRoute found" }
  else {
    try {
      Progress 86 "Installing OmniRoute (model router)..."
      $npm = Start-Process -FilePath "cmd.exe" -ArgumentList "/c", "npm install -g omniroute --no-audit --no-fund" -PassThru -WindowStyle Hidden -RedirectStandardOutput (Join-Path $env:TEMP "antillusion-npm.log") -RedirectStandardError (Join-Path $env:TEMP "antillusion-npm.err.log")
      while (-not $npm.HasExited) { Pump; Start-Sleep -Milliseconds 200 }
      if ($npm.ExitCode -ne 0 -or -not (Test-Path $omni)) { throw "npm install -g omniroute failed (exit $($npm.ExitCode)); see %TEMP%\antillusion-npm.err.log" }
    } catch { Warn "OmniRoute was not installed: $($_.Exception.Message). Run 'npm install -g omniroute' later, or use OpenRouter in Settings." }
  }

  # ---------- 5. shortcuts + uninstall entry ----------
  Progress 96 "Creating shortcuts..."
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

  Progress 100 "Done"
  if (-not $NoLaunch) {
    Remove-Item Env:ELECTRON_RUN_AS_NODE -ErrorAction SilentlyContinue
    Start-Process -FilePath $exe -WorkingDirectory $dir
    Start-Sleep -Seconds 1
  }
  if ($gui) { $form.Close() }
  Stop-Transcript | Out-Null
}
catch {
  $msg = $_.Exception.Message
  Write-Host "Setup failed: $msg" -ForegroundColor Red
  Stop-Transcript | Out-Null
  if ($gui) { try { $form.Close() } catch {}; [void][System.Windows.Forms.MessageBox]::Show("Setup failed:`n`n$msg`n`nLog: $log", "Antillusion Setup", "OK", "Error") }
  exit 1
}
