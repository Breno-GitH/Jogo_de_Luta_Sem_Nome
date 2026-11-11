@echo off
setlocal
cd /d "%~dp0"
echo === M.S.F.D - Anti-infinito de J ===
if not exist "src\engine\combat.ts" (
  echo ERRO: coloque estes arquivos na raiz do projeto, ao lado do package.json.
  pause
  exit /b 1
)
where git >nul 2>nul
if errorlevel 1 (
  echo ERRO: Git nao encontrado no PATH.
  pause
  exit /b 1
)
git apply --check -- "anti_combo_goku_samurai.patch"
if errorlevel 1 (
  echo.
  echo ATENCAO: Esta versao do jogo difere do codigo analisado.
  echo NENHUM ARQUIVO FOI MODIFICADO. Envie o ZIP atualizado para adaptar a correcao.
  pause
  exit /b 1
)
git apply -- "anti_combo_goku_samurai.patch"
if errorlevel 1 (
  echo ERRO ao aplicar a atualizacao.
  pause
  exit /b 1
)
echo.
echo SUCESSO: Anti-combo de socos fracos instalado.
echo Execute: npm.cmd run build:lan
pause
