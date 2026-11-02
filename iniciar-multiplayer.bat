@echo off
cd /d "%~dp0"
node scripts/start-lan.mjs
if errorlevel 1 (
  echo.
  echo O multiplayer nao iniciou. Veja o erro acima.
  pause
  exit /b 1
)
