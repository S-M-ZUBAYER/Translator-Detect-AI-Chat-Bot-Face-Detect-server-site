#Requires -RunAsAdministrator
param(
  [Parameter(Mandatory = $true)]
  [string]$SiteName,

  [Parameter(Mandatory = $true)]
  [string]$AppPoolName
)

$ErrorActionPreference = 'Stop'
Import-Module WebAdministration

if (-not (Test-Path "IIS:\Sites\$SiteName")) {
  throw "IIS site '$SiteName' was not found."
}
if (-not (Test-Path "IIS:\AppPools\$AppPoolName")) {
  throw "IIS application pool '$AppPoolName' was not found."
}

$appcmd = Join-Path $env:SystemRoot 'System32\inetsrv\appcmd.exe'
& $appcmd set site "/site.name:$SiteName" /limits.connectionTimeout:00:15:00
if ($LASTEXITCODE -ne 0) {
  throw 'Could not update the IIS site connection timeout.'
}

Set-WebConfigurationProperty `
  -PSPath 'MACHINE/WEBROOT/APPHOST' `
  -Location $SiteName `
  -Filter 'system.webServer/webSocket' `
  -Name 'enabled' `
  -Value $true
Set-WebConfigurationProperty `
  -PSPath 'MACHINE/WEBROOT/APPHOST' `
  -Location $SiteName `
  -Filter 'system.webServer/webSocket' `
  -Name 'pingInterval' `
  -Value ([TimeSpan]::FromSeconds(20))

Set-ItemProperty "IIS:\AppPools\$AppPoolName" `
  -Name 'processModel.idleTimeout' `
  -Value ([TimeSpan]::Zero)
Set-ItemProperty "IIS:\AppPools\$AppPoolName" `
  -Name 'startMode' `
  -Value 'AlwaysRunning'

Write-Host "IIS site '$SiteName' now uses a 15-minute connection timeout and 20-second WebSocket pings."
Write-Host "Application pool '$AppPoolName' is configured for AlwaysRunning with idle shutdown disabled."
Write-Host 'Recycle the application pool once after deploying the updated files.'
