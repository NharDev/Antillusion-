@echo off
rem Pulls the latest Antillusion update from the dev branch, installs dependencies if needed, and starts the app.
setlocal
set BRANCH=claude/tender-edison-9jjurs
cd /d "%~dp0"
echo == Updating from %BRANCH% ==
git fetch origin %BRANCH% || goto :fail
git checkout %BRANCH% || goto :fail
git pull --ff-only origin %BRANCH% || goto :fail
cd antillusion
if not exist node_modules (
  echo == Installing dependencies ==
  call npm install || goto :fail
)
echo == Starting Antillusion ==
start "" cmd /c npm start
exit /b 0
:fail
echo.
echo Update failed. Check the messages above.
pause
exit /b 1
