@echo off
powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\update-msfd.ps1" %*
exit /b %ERRORLEVEL%
