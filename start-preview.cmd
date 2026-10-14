@echo off
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Node is unavailable. Open index.html directly in your browser instead.
  pause
  exit /b 1
)
echo Open http://127.0.0.1:5187 in your browser.
echo Press Ctrl+C in this window to stop the preview.
node server.js
