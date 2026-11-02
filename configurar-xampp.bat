@echo off
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File scripts\install-xampp.ps1
if errorlevel 1 (
  echo A configuracao nao foi instalada. Veja os erros acima.
  pause
  exit /b 1
)
pause
