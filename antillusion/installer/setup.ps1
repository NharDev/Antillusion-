# Antillusion installer (runs from Antillusion-Setup.exe). Per-user install: no admin rights, nothing outside your profile.
$ErrorActionPreference = "Stop"
$dir = Join-Path $env:LOCALAPPDATA "Programs\Antillusion"
$exe = Join-Path $dir "Antillusion.exe"
$ws = New-Object -ComObject WScript.Shell
foreach ($p in @([Environment]::GetFolderPath("Desktop"), [Environment]::GetFolderPath("Programs"))) {
  $lnk = $ws.CreateShortcut((Join-Path $p "Antillusion.lnk")); $lnk.TargetPath = $exe; $lnk.Arguments = ""; $lnk.WorkingDirectory = $dir; $lnk.IconLocation = "$exe,0"; $lnk.Description = "Antillusion - AI coding agent"; $lnk.Save()
}
# uninstall entry (Settings > Apps). Your conversations and settings in %APPDATA%\Antillusion are kept.
$un = Join-Path $dir "Uninstall-Antillusion.cmd"
@"
@echo off
taskkill /IM Antillusion.exe /F >nul 2>&1
del "%USERPROFILE%\Desktop\Antillusion.lnk" >nul 2>&1
del "%APPDATA%\Microsoft\Windows\Start Menu\Programs\Antillusion.lnk" >nul 2>&1
reg delete "HKCU\Software\Microsoft\Windows\CurrentVersion\Uninstall\Antillusion" /f >nul 2>&1
start "" cmd /c "ping -n 3 127.0.0.1 >nul & rmdir /s /q ""$dir"""
"@ | Set-Content -Path $un -Encoding ASCII
$k = "HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall\Antillusion"
New-Item -Path $k -Force | Out-Null
Set-ItemProperty $k DisplayName "Antillusion"; Set-ItemProperty $k DisplayIcon $exe; Set-ItemProperty $k Publisher "Antillusion"; Set-ItemProperty $k DisplayVersion "1.0.0"
Set-ItemProperty $k InstallLocation $dir; Set-ItemProperty $k UninstallString "`"$un`""; Set-ItemProperty $k NoModify 1 -Type DWord; Set-ItemProperty $k NoRepair 1 -Type DWord
Start-Process $exe
