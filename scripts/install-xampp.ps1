param([string]$XamppRoot='C:\xampp',[switch]$ValidateOnly)
$ErrorActionPreference='Stop'
$gameRoot=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$conf=Join-Path $XamppRoot 'apache\conf\httpd.conf'
$extra=Join-Path $XamppRoot 'apache\conf\extra\httpd-jogo-luta.conf'
$httpd=Join-Path $XamppRoot 'apache\bin\httpd.exe'
$stage=Join-Path $gameRoot 'deployment\run'
New-Item -ItemType Directory -Force -Path $stage | Out-Null
$version=& $httpd -v
if (($version -join ' ') -notmatch 'Apache/2\.4\.(\d+)' -or [int]$Matches[1] -lt 47) {throw 'Este instalador requer Apache 2.4.47 ou superior para upgrade WebSocket por mod_proxy_http.'}
$gameConf=[IO.File]::ReadAllText((Join-Path $gameRoot 'deployment\apache-game.conf.in')).Replace('@@PROJECT@@',$gameRoot.Replace('\','/')).Replace('@@HTDOCS@@',(Join-Path $XamppRoot 'htdocs').Replace('\','/'))
$original=[IO.File]::ReadAllText($conf)
$candidate=$original
foreach($module in @('proxy_http','proxy_wstunnel')) {
 $candidate=$candidate -replace "(?m)^#(LoadModule ${module}_module modules/mod_${module}\.so)\s*`$",'$1'
 if($candidate -notmatch "(?m)^LoadModule ${module}_module "){throw "Modulo $module nao foi encontrado no httpd.conf. Nenhum arquivo global foi alterado."}
}
$include='Include "conf/extra/httpd-jogo-luta.conf"'
if(-not $candidate.Contains($include)){$candidate+="`r`n# Jogo de luta LAN`r`n$include`r`n"}
$stagedExtra=Join-Path $stage 'httpd-jogo-luta.conf'
$stagedMain=Join-Path $stage 'httpd-validation.conf'
[IO.File]::WriteAllText($stagedExtra,$gameConf)
[IO.File]::WriteAllText($stagedMain,$candidate.Replace($include,('Include "'+$stagedExtra.Replace('\','/')+'"')))
& $httpd -t -f $stagedMain
if($LASTEXITCODE -ne 0){throw 'A validacao previa do Apache falhou. Nenhum arquivo global foi alterado.'}
if($ValidateOnly){Write-Host 'Configuracao preparada e sintaxe validada. Nenhum arquivo global foi alterado.';exit 0}
$backup=Join-Path $gameRoot ('deployment\backups\apache-'+(Get-Date -Format 'yyyyMMdd-HHmmss')+'-'+[Guid]::NewGuid().ToString('N').Substring(0,6))
New-Item -ItemType Directory -Path $backup | Out-Null
Copy-Item -LiteralPath $conf -Destination (Join-Path $backup 'httpd.conf')
$hadExtra=Test-Path -LiteralPath $extra
if($hadExtra){Copy-Item -LiteralPath $extra -Destination (Join-Path $backup 'httpd-jogo-luta.conf')}
try{
 [IO.File]::WriteAllText($extra,$gameConf)
 [IO.File]::WriteAllText($conf,$candidate)
 & $httpd -t -f $conf
 if($LASTEXITCODE -ne 0){throw 'A configuracao instalada falhou na validacao.'}
}catch{
 Copy-Item -LiteralPath (Join-Path $backup 'httpd.conf') -Destination $conf -Force
 if($hadExtra){Copy-Item -LiteralPath (Join-Path $backup 'httpd-jogo-luta.conf') -Destination $extra -Force}else{Remove-Item -LiteralPath $extra -ErrorAction SilentlyContinue}
 throw
}
@{version=$version;backup=$backup;installed=$extra;date=(Get-Date).ToString('o')}|ConvertTo-Json|Set-Content -Encoding UTF8 (Join-Path $gameRoot 'deployment\audit\apache-install.json')
Write-Host "Configuracao instalada. Backup: $backup"
Write-Host 'Inicie o Apache pelo XAMPP. Se ja estiver ativo, pare e inicie-o novamente.'
