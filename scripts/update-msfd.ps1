param([string]$Branch, [string]$Url = 'http://localhost/2025/M.S.F.D/')
$ErrorActionPreference = 'Stop'
$root = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
Set-Location -LiteralPath $root
$work = Join-Path $root 'deployment\msfd-work'
$startupFile = Join-Path ([Environment]::GetFolderPath('Startup')) 'JogoDeLuta-LAN.vbs'
$launcher = Join-Path $root 'deployment\run\lan-iniciar-oculto.cmd'
$lanScript = Join-Path $root 'scripts\start-lan.mjs'
$lanPort = 3001
$backendPid = $null
$launchTask = $null
$lock = $null

function Invoke-Checked([string]$File, [string[]]$Arguments) {
    & $File @Arguments
    if ($LASTEXITCODE -ne 0) { throw "$File $($Arguments -join ' ') falhou ($LASTEXITCODE)." }
}

function Get-BackendListener {
    $lines = netstat.exe -ano -p TCP
    foreach ($line in $lines) {
        if ($line -match "^\s*TCP\s+\S+:${lanPort}\s+(?:0\.0\.0\.0|\[::\]):0\s+\S+\s+(\d+)\s*$") {
            return [int]$Matches[1]
        }
    }
}

function Get-LanHealth([string]$Address) {
    try { Invoke-RestMethod -Uri $Address -TimeoutSec 3 }
    catch { $null }
}

function Start-ExistingBackend {
    if ($launchTask) {
        Start-ScheduledTask -TaskName $launchTask.TaskName -TaskPath $launchTask.TaskPath
    } elseif ((Test-Path -LiteralPath $startupFile) -and
        ([IO.File]::ReadAllText($startupFile).IndexOf($launcher, [StringComparison]::OrdinalIgnoreCase) -ge 0)) {
        Start-Process -FilePath wscript.exe -ArgumentList ('"' + $startupFile + '"') -WindowStyle Hidden
    } else {
        $node = (Get-Command node.exe).Source
        Start-Process -FilePath $node -ArgumentList ('"' + $lanScript + '"') -WorkingDirectory $root -WindowStyle Hidden `
            -RedirectStandardOutput (Join-Path $work 'backend-output.log') `
            -RedirectStandardError (Join-Path $work 'backend-error.log')
    }
    for ($attempt = 0; $attempt -lt 20; $attempt++) {
        if ((Get-LanHealth "http://127.0.0.1:$lanPort/health").service -eq 'jogo-luta-lan') { return }
        Start-Sleep -Milliseconds 500
    }
    throw "O backend LAN nao respondeu na porta $lanPort. Confira deployment\run\lan-automatico.log e deployment\msfd-work\backend-error.log."
}

try {
    if (-not (Test-Path -LiteralPath 'package-lock.json')) { throw "Projeto M.S.F.D. ausente em $root." }
    [IO.Directory]::CreateDirectory($work) | Out-Null
    try { $lock = [IO.File]::Open((Join-Path $work 'update.lock'), 'OpenOrCreate', 'ReadWrite', 'None') }
    catch { throw 'Ja existe uma atualizacao M.S.F.D. em andamento.' }

    $current = Invoke-Checked git @('branch', '--show-current')
    if (-not $current) { throw 'Escolha uma branch local antes de atualizar.' }
    if ($Branch -and $Branch -ne $current) { throw "Selecione a branch $Branch com git switch antes de executar. Branch atual: $current." }
    $dirty = @(Invoke-Checked git @('status', '--porcelain=v1'))
    if ($dirty.Count) { throw "Existem alteracoes locais. Preserve-as em commit ou stash antes de atualizar:`n$($dirty -join "`n")" }
    Invoke-Checked git @('fetch', 'origin')
    $remote = "refs/remotes/origin/$current"
    $remoteCommit = Invoke-Checked git @('rev-parse', '--verify', $remote)
    Invoke-Checked git @('merge', '--ff-only', $remote)
    $commit = Invoke-Checked git @('rev-parse', 'HEAD')
    if ($commit -ne $remoteCommit) { throw "A branch local possui commits ainda nao publicados. HEAD: $commit." }
    Write-Host "Publicando $current em $commit."

    $fingerprintFile = Join-Path $work 'package-lock.sha256'
    $sha256 = [Security.Cryptography.SHA256]::Create()
    try {
        $fingerprint = [BitConverter]::ToString($sha256.ComputeHash(
            [IO.File]::ReadAllBytes((Join-Path $root 'package-lock.json')))).Replace('-', '')
    } finally {
        $sha256.Dispose()
    }
    $installed = (Test-Path -LiteralPath 'node_modules\.package-lock.json') -and
        (Test-Path -LiteralPath 'node_modules\vite\bin\vite.js')
    if ($installed -and (Test-Path -LiteralPath $fingerprintFile)) {
        $installed = [IO.File]::ReadAllText($fingerprintFile) -eq $fingerprint
    } elseif ($installed) {
        # An existing npm ci can predate this updater. Reuse it if its inventory matches.
        & node.exe -e "const a=require('./package-lock.json').packages,b=require('./node_modules/.package-lock.json').packages,f=require('fs');process.exit(Object.entries(a).every(([p,v])=>!p||(!b[p]?v.optional:b[p].version===v.version&&b[p].integrity===v.integrity&&f.existsSync(p+'/package.json'))?0:1)"
        $installed = $LASTEXITCODE -eq 0
    }
    if (-not $installed) { Invoke-Checked npm.cmd @('ci', '--no-audit', '--no-fund') }
    [IO.File]::WriteAllText($fingerprintFile, $fingerprint)
    Invoke-Checked node.exe @('scripts/net_version.mjs')
    Invoke-Checked node.exe @('node_modules/vitest/vitest.mjs', 'run', '--maxWorkers=1',
        'tests/ben-omnitrix.test.ts', 'tests/ben-final.test.ts', 'tests/ben-stage6.test.ts', 'tests/ben-stage7.test.ts')

    try {
        $null = Invoke-WebRequest -Uri $Url -TimeoutSec 5 -UseBasicParsing
    } catch {
        throw "Apache nao respondeu em $Url. Inicie-o no XAMPP e confira o alias M.S.F.D. com configurar-xampp.bat."
    }

    $tasks = if (Get-Command Get-ScheduledTask -ErrorAction SilentlyContinue) {
        Get-ScheduledTask -ErrorAction SilentlyContinue
    }
    $launchTask = $tasks | Where-Object {
        $_.Actions | Where-Object {
            ($_.WorkingDirectory -eq $root -and $_.Arguments -match 'scripts[\\/]start-lan\.mjs') -or
            ($_.Arguments -and ($_.Arguments.IndexOf($launcher, [StringComparison]::OrdinalIgnoreCase) -ge 0 -or
                $_.Arguments.IndexOf($lanScript, [StringComparison]::OrdinalIgnoreCase) -ge 0)) -or
            $_.Execute -eq $launcher
        }
    } | Select-Object -First 1

    $backendPid = Get-BackendListener
    if ($backendPid) {
        $health = Get-LanHealth "http://127.0.0.1:$lanPort/health"
        $process = Get-CimInstance Win32_Process -Filter "ProcessId=$backendPid"
        $parent = Get-CimInstance Win32_Process -Filter "ProcessId=$($process.ParentProcessId)"
        $metadataPath = Join-Path $root 'deployment\run\msfd-backend.json'
        $metadata = if (Test-Path -LiteralPath $metadataPath) {
            Get-Content -LiteralPath $metadataPath -Raw | ConvertFrom-Json
        }
        $ownsListener = ($metadata.pid -eq $backendPid -and $metadata.project -eq $root) -or
            ($parent.CommandLine -and $parent.CommandLine.IndexOf($launcher, [StringComparison]::OrdinalIgnoreCase) -ge 0) -or
            ($process.CommandLine -and $process.CommandLine.IndexOf($lanScript, [StringComparison]::OrdinalIgnoreCase) -ge 0)
        if ($health.service -ne 'jogo-luta-lan' -or $process.Name -ne 'node.exe' -or
            $process.CommandLine -notmatch 'scripts[\\/]start-lan\.mjs' -or -not $ownsListener) {
            throw "A porta $lanPort pertence a um processo que nao foi identificado como o backend deste projeto. PID $backendPid preservado."
        }
        Write-Host "Pausando o backend LAN do M.S.F.D. (PID $backendPid)."
        if ($launchTask -and $launchTask.State -eq 'Running') {
            Stop-ScheduledTask -TaskName $launchTask.TaskName -TaskPath $launchTask.TaskPath
        }
        if ((Get-BackendListener) -eq $backendPid) { Stop-Process -Id $backendPid }
    }
    try {
        for ($attempt = 0; $attempt -lt 15 -and (Get-BackendListener); $attempt++) {
            Start-Sleep -Milliseconds 300
        }
        if (Get-BackendListener) { throw "A porta $lanPort continua ocupada. Nenhuma build foi publicada." }
        Invoke-Checked npm.cmd @('run', 'build:lan')
    } finally {
        if (-not (Get-BackendListener) -and (Test-Path -LiteralPath 'server-dist\server-core.mjs')) {
            Start-ExistingBackend
        }
    }
    Invoke-Checked node.exe @('scripts/check-msfd-publication.mjs', $Url, $commit)
} catch {
    [Console]::Error.WriteLine("Atualizacao do M.S.F.D. interrompida. " + $_.Exception.Message)
    exit 1
} finally {
    if ($lock) { $lock.Dispose() }
}

