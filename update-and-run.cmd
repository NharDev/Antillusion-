@echo off
rem Updates Antillusion from GitHub and starts it. Works from anywhere: if this file is not inside a git checkout,
rem the project is cloned once into %USERPROFILE%\Antillusion and used from there.
setlocal
set "REPO=https://github.com/NharDev/Antillusion-.git"
set "BRANCH=claude/tender-edison-9jjurs"

where git >nul 2>&1 || ( echo Git is not installed. Get it from https://git-scm.com/download/win & goto :fail )
where node >nul 2>&1 || ( echo Node.js is not installed. Get it from https://nodejs.org & goto :fail )

git -C "%~dp0." rev-parse --is-inside-work-tree >nul 2>&1
if errorlevel 1 goto :clone
set "DIR=%~dp0"
goto :update

:clone
set "DIR=%USERPROFILE%\Antillusion\"
if exist "%DIR%.git" goto :update
echo == First run: cloning into %DIR% ==
git clone --branch %BRANCH% %REPO% "%DIR%" || goto :fail

:update
cd /d "%DIR%"
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
