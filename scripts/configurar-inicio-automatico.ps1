param([switch]$Desactivar)
$ErrorActionPreference = 'Stop'
$projectDir = Split-Path -Parent $PSScriptRoot
$runtimeDir = Join-Path $projectDir '.runtime'
$disabledFile = Join-Path $runtimeDir 'legajo-disabled'
$startupDir = [Environment]::GetFolderPath('Startup')
$shortcutPath = Join-Path $startupDir 'Legajo Digital.lnk'
New-Item -ItemType Directory -Force -Path $runtimeDir | Out-Null
if ($Desactivar) {
    Set-Content -LiteralPath $disabledFile -Value 'Inicio automatico desactivado.'
    if (Test-Path -LiteralPath $shortcutPath) {
        Remove-Item -LiteralPath $shortcutPath
    }
    Write-Output 'Inicio automatico desactivado. El servidor se detendra en unos segundos.'
    exit 0
}
$firewallRuleName = 'Legajo Digital (TCP 3000)'
try {
    if (-not (Get-NetFirewallRule -DisplayName $firewallRuleName -ErrorAction SilentlyContinue)) {
        New-NetFirewallRule -DisplayName $firewallRuleName -Direction Inbound -Protocol TCP -LocalPort 3000 -Action Allow -Profile Private | Out-Null
    }
} catch {
    Write-Warning "No se pudo crear la regla de firewall. Ejecuta PowerShell como administrador y permite TCP 3000 en el perfil Private."
}
$pnpmPath = (Get-Command pnpm.cmd -ErrorAction Stop).Source
if (-not (Test-Path -LiteralPath (Join-Path $projectDir 'node_modules'))) {
    throw 'Primero instala las dependencias del proyecto.'
}
$launcher = Join-Path $PSScriptRoot 'iniciar-legajo-automatico.ps1'
$powershell = Join-Path $env:SystemRoot 'System32\WindowsPowerShell\v1.0\powershell.exe'
$launchArguments = '-NoLogo -NoProfile -NonInteractive -ExecutionPolicy Bypass -WindowStyle Hidden -File "{0}" -PnpmPath "{1}"' -f $launcher, $pnpmPath
if (Test-Path -LiteralPath $disabledFile) {
    Remove-Item -LiteralPath $disabledFile
}
New-Item -ItemType Directory -Force -Path $startupDir | Out-Null
$shell = New-Object -ComObject WScript.Shell
$shortcut = $shell.CreateShortcut($shortcutPath)
$shortcut.TargetPath = $powershell
$shortcut.Arguments = $launchArguments
$shortcut.WorkingDirectory = $projectDir
$shortcut.WindowStyle = 7
$shortcut.Description = 'Inicia Legajo Digital en segundo plano y lo reinicia si se cierra.'
$shortcut.Save()
Start-Process -FilePath $powershell -ArgumentList $launchArguments -WorkingDirectory $projectDir -WindowStyle Hidden
Write-Output "Inicio automatico activado para $([Security.Principal.WindowsIdentity]::GetCurrent().Name)."
$lanAddresses = Get-NetIPAddress -AddressFamily IPv4 -ErrorAction SilentlyContinue |
    Where-Object { $_.IPAddress -notlike '127.*' -and $_.IPAddress -notlike '169.254.*' } |
    Select-Object -ExpandProperty IPAddress -Unique
Write-Output "Acceso local: http://localhost:3000"
foreach ($address in $lanAddresses) {
    Write-Output "Acceso desde la red: http://${address}:3000"
}
Write-Output "Inicio de Windows: $shortcutPath"
Write-Output "Registros: $runtimeDir"

