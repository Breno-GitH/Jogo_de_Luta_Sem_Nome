$ErrorActionPreference = "Stop"
$vbs = Join-Path ([Environment]::GetFolderPath("Startup")) "JogoDeLuta-LAN.vbs"
if (Test-Path -LiteralPath $vbs) {
  Remove-Item -LiteralPath $vbs -Force
  Write-Host "Inicializacao automatica desativada." -ForegroundColor Green
} else {
  Write-Host "Nenhuma inicializacao automatica encontrada."
}
Write-Host "O processo que ja estiver rodando continua ate ser encerrado/reiniciar o Windows."
Write-Host "Nenhum arquivo do jogo, servidor ou XAMPP foi removido."
