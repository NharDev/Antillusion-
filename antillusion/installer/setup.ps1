# Antillusion Setup (tiny bootstrapper). The .exe only contains this script and the window code (AntiSetup.cs); it downloads the app
# and whatever is missing (Node.js, Git, OmniRoute), installs per-user (no admin rights), creates shortcuts and starts Antillusion.
#   -Silent       no window (console output only)      -NoLaunch      do not start the app at the end
#   -Payload X    app zip: a local path or URL         -ForceRuntime  download Node/Git even if already installed (CI uses it)
#   -Preview DIR  render PNG frames of the window into DIR and exit (design check, used by CI)
#   -RuntimeOnly -Part node|git   (internal) background finisher: Setup shows the window only for the app itself, Node/Git/OmniRoute continue here
param([switch]$Silent, [switch]$NoLaunch, [switch]$ForceRuntime, [string]$Payload = "", [string]$Preview = "", [switch]$RuntimeOnly, [string]$Part = "")
$ErrorActionPreference = "Stop"
$ProgressPreference = "SilentlyContinue"
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

$here = if ($PSScriptRoot) { $PSScriptRoot } else { Split-Path -Parent $MyInvocation.MyCommand.Path }
$cfg = @{
  Repo = "NharDev/Antillusion-"; PayloadName = "Antillusion-app-win-x64.zip"
  Dir = (Join-Path $env:LOCALAPPDATA "Programs\Antillusion"); Log = (Join-Path $env:TEMP "antillusion-setup.log")
  Payload = $Payload; NoLaunch = [bool]$NoLaunch; ForceRuntime = [bool]$ForceRuntime; Here = $here
}

function LoadWindow {
  if ("AntiSetupWindow" -as [type]) { return }
  Add-Type -TypeDefinition (Get-Content (Join-Path $here "AntiSetup.cs") -Raw -Encoding UTF8) -ReferencedAssemblies System.Windows.Forms, System.Drawing
}

# ---------- design preview (no installation) ----------
if ($Preview) {
  LoadWindow; New-Item -ItemType Directory -Force -Path $Preview | Out-Null
  $w = New-Object AntiSetupWindow; $w.Opacity = 1
  $w.AddLog("Looking up the latest Antillusion build"); $w.SetStatus("Preparing"); $w.Simulate(0.7); $w.SaveFrame((Join-Path $Preview "setup-1-intro.png"))
  $w.AddLog("Downloading Antillusion (158 MB)"); $w.SetStatus("Downloading Antillusion"); $w.SetProgress(18); $w.Simulate(1.4)
  $w.AddLog("Node.js v22 found"); $w.AddLog("Installing Git"); $w.SetStatus("Installing Git"); $w.SetProgress(47); $w.Simulate(2.2); $w.SaveFrame((Join-Path $Preview "setup-2-installing.png"))
  $w.AddLog("Creating shortcuts"); $w.SetStatus("Creating shortcuts"); $w.SetProgress(96); $w.Simulate(1.5)
  $w.Complete($true, ""); $w.SetStatus("Done"); $w.Simulate(0.35); $w.SaveFrame((Join-Path $Preview "setup-3-done.png"))
  $f = New-Object AntiSetupWindow
  $f.AddLog("Downloading Antillusion"); $f.SetProgress(32); $f.Simulate(2.5); $f.Complete($false, "Could not download Antillusion. Check your internet connection and try again."); $f.Simulate(0.5); $f.SaveFrame((Join-Path $Preview "setup-4-failed.png"))
  Write-Host "preview frames written to $Preview"; exit 0
}


# ---------- helpers shared by the window install and the background finishers ----------
$lib = {
  $ErrorActionPreference = "Stop"
  $ProgressPreference = "SilentlyContinue"
  [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
  $dir = $cfg.Dir; $rt = Join-Path $dir "runtime"; $exe = Join-Path $dir "Antillusion.exe"; $Repo = $cfg.Repo; $PayloadName = $cfg.PayloadName

  function Log($m) { $ui.AddLog($m); try { Add-Content -Path $cfg.Log -Value $m } catch {} }
  function Step($pct, $text, $line) { $ui.SetProgress($pct); $ui.SetStatus($text); if ($line) { Log $line } }
  function Check { if ($ui.Cancelled) { throw "Setup was cancelled." } }
  function Download($url, $out, $from, $to, $label) {
    for ($try = 1; $try -le 3; $try++) {
      try {
        Check; Log ("Downloading " + ([IO.Path]::GetFileName(([Uri]$url).AbsolutePath)))
        $wc = New-Object System.Net.WebClient; $wc.Headers["User-Agent"] = "Antillusion-Setup"
        $global:AntiDone = $false; $global:AntiErr = $null; $global:AntiPct = 0
        $null = Register-ObjectEvent -InputObject $wc -EventName DownloadProgressChanged -SourceIdentifier "dl.p" -Action { $global:AntiPct = $EventArgs.ProgressPercentage }
        $null = Register-ObjectEvent -InputObject $wc -EventName DownloadFileCompleted -SourceIdentifier "dl.c" -Action { $global:AntiDone = $true; $global:AntiErr = $EventArgs.Error }
        $wc.DownloadFileAsync([Uri]$url, $out)
        while (-not $global:AntiDone) { Check; $ui.SetProgress($from + ($to - $from) * $global:AntiPct / 100); $ui.SetStatus("$label ($($global:AntiPct)%)"); Start-Sleep -Milliseconds 60 }
        Unregister-Event -SourceIdentifier "dl.p" -ErrorAction SilentlyContinue; Unregister-Event -SourceIdentifier "dl.c" -ErrorAction SilentlyContinue
        if ($global:AntiErr) { throw $global:AntiErr }
        return
      } catch {
        Unregister-Event -SourceIdentifier "dl.p" -ErrorAction SilentlyContinue; Unregister-Event -SourceIdentifier "dl.c" -ErrorAction SilentlyContinue
        $permanent = $_.Exception.Message -match "\((404|403|401|410)\)"   # retrying a missing file only wastes time
        if ($try -eq 3 -or $permanent) { throw "download failed ($([IO.Path]::GetFileName(([Uri]$url).AbsolutePath))): $($_.Exception.Message)" }
        Log "attempt $try failed, retrying"; Start-Sleep -Seconds (2 * $try)
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

  function InstallNode {
    if (-not $cfg.ForceRuntime -and (NodeOk)) { Log "Node.js $(& node -v) found"; return }
    Step 5 "Looking up Node.js" "Looking up the latest Node.js LTS"
    $idx = Invoke-RestMethod -Uri "https://nodejs.org/dist/index.json" -UseBasicParsing
    $rel = $idx | Where-Object { $_.lts -and ($_.files -contains "win-x64-zip") } | Select-Object -First 1
    if (-not $rel) { throw "could not find a Node.js LTS release" }
    $v = $rel.version; $zipName = "node-$v-win-x64.zip"; $nzip = Join-Path $env:TEMP $zipName
    Download "https://nodejs.org/dist/$v/$zipName" $nzip 5 60 "Downloading Node.js $v"
    $sums = (Invoke-WebRequest -Uri "https://nodejs.org/dist/$v/SHASUMS256.txt" -UseBasicParsing).Content
    $want = ($sums -split "`n" | Where-Object { $_ -match [regex]::Escape($zipName) } | Select-Object -First 1) -split "\s+" | Select-Object -First 1
    if ($want -and (Sha256 $nzip) -ne $want.ToLower()) { throw "Node.js download is corrupt (checksum mismatch)" }
    $nodeDir = Join-Path $rt "node"; if (Test-Path $nodeDir) { Remove-Item -Recurse -Force $nodeDir }
    Step 65 "Installing Node.js" "Checksum OK, unpacking Node.js $v"
    Unzip $nzip $rt
    Rename-Item -Path (Join-Path $rt "node-$v-win-x64") -NewName "node"
    Remove-Item $nzip -Force -ErrorAction SilentlyContinue
    AddUserPath $nodeDir
  }
  function InstallGit {
    if (-not $cfg.ForceRuntime -and (HasCmd "git")) { Log "Git found"; return }
    # No API call (unauthenticated API requests are rate-limited per IP and answer 403): read the redirect of /releases/latest instead
    $tag = $null
    try {
      $req = [Net.HttpWebRequest]::Create("https://github.com/git-for-windows/git/releases/latest"); $req.AllowAutoRedirect = $false; $req.UserAgent = "Antillusion-Setup"; $req.Timeout = 15000
      $res = $req.GetResponse(); $loc = $res.Headers["Location"]; $res.Close()
      if ($loc -match "/tag/(v[0-9][^/]*)$") { $tag = $Matches[1] }
    } catch { Log "Could not look up the latest Git release: $($_.Exception.Message)" }
    if (-not $tag) { $tag = "v2.47.1.windows.1"; Log "Using Git $tag" }
    $num = ($tag -replace "^v", "") -replace "\.windows\.1$", "" -replace "\.windows\.", "."   # v2.56.0.windows.2 -> 2.56.0.2, v2.47.1.windows.1 -> 2.47.1
    $name = "PortableGit-$num-64-bit.7z.exe"; $pg = Join-Path $env:TEMP $name
    Download "https://github.com/git-for-windows/git/releases/download/$tag/$name" $pg 5 70 "Downloading Git"
    $gitDir = Join-Path $rt "git"; if (Test-Path $gitDir) { Remove-Item -Recurse -Force $gitDir }
    Step 75 "Installing Git" "Unpacking Git"
    $p = Start-Process -FilePath $pg -ArgumentList @("-o", "`"$gitDir`"", "-y") -PassThru -WindowStyle Hidden
    while (-not $p.HasExited) { Check; Start-Sleep -Milliseconds 150 }
    Remove-Item $pg -Force -ErrorAction SilentlyContinue   # may stay locked for a moment (antivirus scan); the temp file is harmless
    if (-not (Test-Path (Join-Path $gitDir "cmd\git.exe"))) { throw "Git did not unpack correctly" }
    AddUserPath (Join-Path $gitDir "cmd")
  }
  function InstallOmni {
    $omni = Join-Path $env:APPDATA "npm\node_modules\omniroute\bin\omniroute.mjs"
    if (Test-Path $omni) { Log "OmniRoute found"; return }
    Log "Installing OmniRoute (a few hundred MB, this takes a while)"
    $npmLog = Join-Path $dir "omniroute-install.log"
    Start-Process -FilePath "cmd.exe" -ArgumentList "/c", "npm install -g omniroute --no-audit --no-fund > `"$npmLog`" 2>&1" -WindowStyle Hidden -Wait | Out-Null
    if (-not (Test-Path $omni)) { Log "OmniRoute did not install; see $npmLog" } else { Log "OmniRoute installed" }
  }
  # background finisher: flags tell the app that something is still being installed
  function RunPart($part) {
    $flag = Join-Path $rt "$part.installing"
    try { if ($part -eq "git") { InstallGit } else { InstallNode; InstallOmni } }
    catch { Log "FAILED ($part): $($_.Exception.Message)" }
    finally { Remove-Item $flag -Force -ErrorAction SilentlyContinue }
  }
}

# ---------- the window install: only the app itself, so it is quick ----------
$fg = {
  try {
    Step 2 "Preparing" "Looking up the latest Antillusion build"
    $zip = Join-Path $env:TEMP $PayloadName; $local = $cfg.Payload -and (Test-Path $cfg.Payload)
    if ($local) { $zip = (Resolve-Path $cfg.Payload).Path; Log "Using local payload $zip" }
    else {
      $urls = @(); if ($cfg.Payload) { $urls += $cfg.Payload }
      $urls += "https://github.com/$Repo/releases/latest/download/$PayloadName", "https://github.com/$Repo/releases/download/dev-build/$PayloadName"
      $ok = $false
      foreach ($u in $urls) { try { Download $u $zip 3 68 "Downloading Antillusion"; $ok = $true; break } catch { Log "not available here, trying the next source" } }
      if (-not $ok) { throw "Could not download Antillusion. Check your internet connection and try again." }
    }
    Step 69 "Installing Antillusion" "Unpacking the app"
    $running = Get-Process -Name "Antillusion" -ErrorAction SilentlyContinue
    if ($running) { $running | Stop-Process -Force -ErrorAction SilentlyContinue; Start-Sleep -Seconds 1 }
    New-Item -ItemType Directory -Force -Path $dir | Out-Null
    Get-ChildItem -Path $dir -Force | Where-Object { $_.Name -ne "runtime" } | Remove-Item -Recurse -Force -ErrorAction Stop   # keep Node/Git from a previous install
    Unzip $zip $dir
    if (-not $local) { Remove-Item $zip -Force -ErrorAction SilentlyContinue }
    if (-not (Test-Path $exe)) { throw "Antillusion.exe was not unpacked ($exe)" }
    New-Item -ItemType Directory -Force -Path $rt | Out-Null

    Step 92 "Creating shortcuts" "Creating shortcuts and the uninstall entry"
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

    # Node.js + OmniRoute and Git finish in two parallel hidden processes while the app is already usable
    Step 96 "Finishing" "Node.js, Git and OmniRoute continue in the background"
    $script = Join-Path $dir "runtime-setup.ps1"
    Copy-Item -Path (Join-Path $cfg.Here "setup.ps1") -Destination $script -Force
    foreach ($part in @("node", "git")) {
      Set-Content -Path (Join-Path $rt "$part.installing") -Value (Get-Date).ToString("o")
      $psArgs = @("-NoProfile", "-ExecutionPolicy", "Bypass", "-WindowStyle", "Hidden", "-File", "`"$script`"", "-RuntimeOnly", "-Part", $part)
      if ($cfg.ForceRuntime) { $psArgs += "-ForceRuntime" }
      Start-Process -FilePath "powershell.exe" -ArgumentList $psArgs -WindowStyle Hidden | Out-Null
    }

    Step 100 "Done" "Antillusion $ver is installed"
    if (-not $cfg.NoLaunch) {
      Remove-Item Env:ELECTRON_RUN_AS_NODE -ErrorAction SilentlyContinue
      Start-Process -FilePath $exe -WorkingDirectory $dir
    }
    $ui.Complete($true, "")
  }
  catch {
    $msg = $_.Exception.Message; Log "FAILED: $msg"
    $ui.Complete($false, "$msg  (log: %TEMP%\antillusion-setup.log)")
  }
}

function NewSilentUi {
  $u = New-Object PSObject -Property @{ Cancelled = $false; Success = $false }
  Add-Member -InputObject $u -MemberType ScriptMethod -Name SetStatus -Value { param($t) Write-Host "  [status] $t" }
  Add-Member -InputObject $u -MemberType ScriptMethod -Name SetProgress -Value { param($p) }
  Add-Member -InputObject $u -MemberType ScriptMethod -Name AddLog -Value { param($t) Write-Host "  > $t" }
  Add-Member -InputObject $u -MemberType ScriptMethod -Name Complete -Value { param($ok, $m) $this.Success = $ok; if (-not $ok) { Write-Host "FAILED: $m" -ForegroundColor Red } }
  return $u
}

if ($RuntimeOnly) {   # hidden background finisher (see the foreground install above)
  $cfg.Log = Join-Path $cfg.Dir "runtime\setup-$Part.log"; $ui = NewSilentUi
  . $lib
  RunPart $Part
  exit 0
}

Start-Transcript -Path $cfg.Log -Force | Out-Null

if ($Silent) {
  $ui = NewSilentUi
  . $lib
  & $fg
  Stop-Transcript | Out-Null
  if (-not $ui.Success) { exit 1 }
  exit 0
}

try {
  LoadWindow
  [System.Windows.Forms.Application]::EnableVisualStyles()
  $ui = New-Object AntiSetupWindow
  $rs = [runspacefactory]::CreateRunspace(); $rs.Open()
  $rs.SessionStateProxy.SetVariable("ui", $ui); $rs.SessionStateProxy.SetVariable("cfg", $cfg)
  $ps = [powershell]::Create(); $ps.Runspace = $rs; [void]$ps.AddScript($lib.ToString() + "`n" + $fg.ToString())
  $async = $ps.BeginInvoke()
  [void]$ui.ShowDialog()
  if (-not $async.IsCompleted) { $ps.Stop() }
  $ok = $ui.Success
  Stop-Transcript | Out-Null
  if (-not $ok) { exit 1 }
  exit 0
}
catch {
  Write-Host "Setup could not start its window: $($_.Exception.Message)" -ForegroundColor Red
  Stop-Transcript | Out-Null
  exit 1
}
