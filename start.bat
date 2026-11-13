@echo off
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Please install Node.js 22.13 or later.
  pause
  exit /b 1
)
echo Starting the photography portfolio in the background.
echo Website: http://127.0.0.1:4173
echo Admin:   http://127.0.0.1:4173/admin
node scripts/start-local.mjs
pause
