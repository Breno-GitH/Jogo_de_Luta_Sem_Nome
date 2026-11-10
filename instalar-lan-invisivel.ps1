$ErrorActionPreference = "Stop"

try {
    $projeto = (Resolve-Path -LiteralPath $PSScriptRoot).Path
    $entrada = Join-Path $projeto "scripts\start-lan.mjs"
    $compilado = Join-Path $projeto "server-dist\server-core.mjs"
    $node = (Get-Command node.exe -ErrorAction Stop).Source

    if (-not (Test-Path -LiteralPath $entrada)) {
        throw "Nao encontrei scripts\start-lan.mjs. Extraia este kit na pasta raiz do projeto."
    }
    if (-not (Test-Path -LiteralPath $compilado)) {
        throw "Backend ainda nao compilado. Rode atualizar-xampp.bat antes de instalar."
    }

    $diretorio = Join-Path $projeto "deployment\run"
    New-Item -ItemType Directory -Path $diretorio -Force | Out-Null
    $iniciador = Join-Path $diretorio "lan-iniciar-oculto.cmd"
    $textoCmd = @"
@echo off
cd /d "$projeto"
if not exist "deployment\run" mkdir "deployment\run"
"$node" "scripts\start-lan.mjs" >> "deployment\run\lan-automatico.log" 2>&1
"@
    Set-Content -LiteralPath $iniciador -Value $textoCmd -Encoding ASCII

    $startup = [Environment]::GetFolderPath("Startup")
    if (-not $startup) { throw "Pasta Inicializar do Windows nao encontrada." }
    $vbs = Join-Path $startup "JogoDeLuta-LAN.vbs"
    $textoVbs = @'
Set shell = CreateObject("WScript.Shell")
shell.CurrentDirectory = "__PROJETO__"
shell.Run Chr(34) & "__INICIADOR__" & Chr(34), 0, False
'@
    $textoVbs = $textoVbs.Replace("__PROJETO__", $projeto).Replace("__INICIADOR__", $iniciador)
    Set-Content -LiteralPath $vbs -Value $textoVbs -Encoding ASCII

    Write-Host ""
    Write-Host "Configurado: o backend LAN existente iniciara oculto ao entrar no Windows." -ForegroundColor Green
    Write-Host "Atalho de inicializacao: $vbs"
    Write-Host "Log: $(Join-Path $diretorio 'lan-automatico.log')"
    Write-Host ""
    Write-Host "Tentando ligar agora, sem abrir terminal..."
    Start-Process -FilePath "$env:WINDIR\System32\wscript.exe" -ArgumentList @("//B", "//Nologo", ('"{0}"' -f $vbs)) -WindowStyle Hidden
    Start-Sleep -Seconds 2
    try {
        $resposta = Invoke-RestMethod -Uri "http://127.0.0.1:3001/health" -TimeoutSec 3
        if ($resposta.service -eq "jogo-luta-lan") {
            Write-Host "Backend atual acessivel na porta interna 3001." -ForegroundColor Green
        } else {
            Write-Warning "A porta 3001 responde, mas o servico nao e jogo-luta-lan. Verifique o log."
        }
    } catch {
        Write-Warning "Ainda nao respondeu em 3001. Confira o log e rode verificar-lan.cmd."
    }

    Write-Host ""
    Write-Host "USO DIARIO: inicie Apache no XAMPP; o colega abre seu IP local no navegador."
    Write-Host "O backend Node continua necessario, mas agora roda de modo invisivel."
} catch {
    Write-Host ""
    Write-Host "Falha na configuracao: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}
