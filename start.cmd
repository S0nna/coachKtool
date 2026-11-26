@echo off
setlocal
cd /d "%~dp0"
where node >nul 2>&1
if errorlevel 1 (
  echo Node.js 20 or newer is required. Install Node.js, then run this again.
  pause
  exit /b 1
)
echo Starting CoachKtool. Keep this window open while drafting.
node server.mjs
pause
