param(
    [Parameter(Mandatory = $true)]
    [string]$PnpmPath
)
$ErrorActionPreference = 'Stop'
$projectDir = Split-Path -Parent $PSScriptRoot
$runtimeDir = Join-Path $projectDir '.runtime'
$disabledFile = Join-Path $runtimeDir 'legajo-disabled'
New-Item -ItemType Directory -Force -Path $runtimeDir | Out-Null
# El bloqueo se libera automaticamente si Windows cierra el supervisor.
try {
    $instanceLock = [System.IO.File]::Open(
        (Join-Path $runtimeDir 'legajo-autostart.lock'),
        [System.IO.FileMode]::OpenOrCreate,
        [System.IO.FileAccess]::ReadWrite,
        [System.IO.FileShare]::None
    )
} catch [System.IO.IOException] {
    exit 0
}
function Write-StartupLog([string]$Message) {
    $logFile = Join-Path $runtimeDir 'inicio-automatico.log'
    if ((Test-Path -LiteralPath $logFile) -and (Get-Item -LiteralPath $logFile).Length -gt 1MB) {
        Move-Item -LiteralPath $logFile -Destination ($logFile + '.previous') -Force
    }
    Add-Content -LiteralPath $logFile -Value ('{0:s} {1}' -f (Get-Date), $Message)
}
$serverProcess = $null
try {
    Write-StartupLog "Supervisor iniciado (PID $PID)."
    while (-not (Test-Path -LiteralPath $disabledFile)) {
        try {
            # Puerto fijo: nunca levantar otra copia en 3001 ni detener procesos ajenos.
            $listener = Get-NetTCPConnection -State Listen -LocalPort 3000 -ErrorAction SilentlyContinue
            if ($listener) {
                Start-Sleep -Seconds 10
                continue
            }
            $stdout = Join-Path $runtimeDir 'legajo-stdout.log'
            $stderr = Join-Path $runtimeDir 'legajo-stderr.log'
            foreach ($logFile in @($stdout, $stderr)) {
                if (Test-Path -LiteralPath $logFile) {
                    Move-Item -LiteralPath $logFile -Destination ($logFile + '.previous') -Force
                }
            }
            $serverProcess = Start-Process -FilePath $PnpmPath -ArgumentList @(
                'run', 'dev'
            ) -WorkingDirectory $projectDir -WindowStyle Hidden -PassThru -RedirectStandardOutput $stdout -RedirectStandardError $stderr
            Write-StartupLog "Servidor iniciado con pnpm run dev (PID $($serverProcess.Id), puerto 3000, red local)."
            while (-not $serverProcess.HasExited -and -not (Test-Path -LiteralPath $disabledFile)) {
                Start-Sleep -Seconds 2
                $serverProcess.Refresh()
            }
            if (Test-Path -LiteralPath $disabledFile) { break }
            $serverProcess.WaitForExit()
            Write-StartupLog "Servidor cerrado (codigo $($serverProcess.ExitCode)); reintento en 10 segundos."
            $serverProcess.Dispose()
            $serverProcess = $null
        } catch {
            Write-StartupLog "No se pudo iniciar el servidor: $($_.Exception.Message)"
        }
        Start-Sleep -Seconds 10
    }
} finally {
    if ($null -ne $serverProcess) {
        $serverProcess.Refresh()
        if (-not $serverProcess.HasExited) {
            # Solo cerrar el arbol del proceso que inicio este supervisor.
            & "$env:SystemRoot\System32\taskkill.exe" /PID $serverProcess.Id /T /F 2>&1 | Out-Null
        }
        $serverProcess.Dispose()
    }
    Write-StartupLog 'Supervisor detenido.'
    $instanceLock.Dispose()
}

