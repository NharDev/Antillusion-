@echo off
setlocal
title Antillusion Setup
set "D=%LOCALAPPDATA%\Programs\Antillusion"
echo Installing Antillusion to %D% ...
taskkill /IM Antillusion.exe /F >nul 2>&1
rem give Windows a moment to release the files of a running copy
ping -n 3 127.0.0.1 >nul
if exist "%D%" rmdir /s /q "%D%"
mkdir "%D%"
"%SystemRoot%\System32\tar.exe" -xf "%~dp0app.zip" -C "%D%"
if errorlevel 1 ( echo Install failed while extracting. & pause & exit /b 1 )
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0setup.ps1"
endlocal
