@echo off
cd /d "C:\xampp\htdocs\2025\Jogo_de_Luta_Sem_Nome"
if not exist "deployment\run" mkdir "deployment\run"
"C:\Program Files\nodejs\node.exe" "scripts\start-lan.mjs" >> "deployment\run\lan-automatico.log" 2>&1
