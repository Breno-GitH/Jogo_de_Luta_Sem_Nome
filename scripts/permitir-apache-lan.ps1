param([string]$XamppRoot='C:\xampp')
$ErrorActionPreference='Stop'
$program=Join-Path $XamppRoot 'apache\bin\httpd.exe'
if(-not(Test-Path -LiteralPath $program)){throw 'Apache nao encontrado.'}
$name='Jogo de Luta - Apache LAN privada'
if(Get-NetFirewallRule -DisplayName $name -ErrorAction SilentlyContinue){Write-Host 'A regra especifica ja existe.';exit 0}
New-NetFirewallRule -DisplayName $name -Direction Inbound -Action Allow -Protocol TCP -LocalPort 80 -Program $program -Profile Private -RemoteAddress LocalSubnet
Write-Host 'Somente Apache TCP 80, rede privada e sub-rede local. O firewall nao foi desativado.'
