@echo off
rem Antillusion launcher: uses a local Electron if installed, otherwise the one already in ..\desktop, otherwise installs it once.
cd /d "%~dp0"
set ELECTRON_RUN_AS_NODE=
if exist "node_modules\electron\dist\electron.exe" ( start "" "node_modules\electron\dist\electron.exe" . & exit /b )
if exist "..\desktop\node_modules\electron\dist\electron.exe" ( start "" "..\desktop\node_modules\electron\dist\electron.exe" . & exit /b )
echo Installing Electron (first run only)...
call npm install
start "" "node_modules\electron\dist\electron.exe" .
