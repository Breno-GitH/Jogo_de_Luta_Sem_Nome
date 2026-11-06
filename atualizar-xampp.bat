@echo off
cd /d "%~dp0"
node scripts\build-lan.mjs
if errorlevel 1 (
  echo.
  echo Atualizacao interrompida. Veja o erro acima.
  pause
  exit /b 1
)
echo.
echo Build atualizado. Execute iniciar-multiplayer.bat e abra http://localhost/2025/Jogo_de_Luta_Sem_Nome/
pause
