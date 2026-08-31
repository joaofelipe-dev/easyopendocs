<#
.SYNOPSIS
  Backup do conteudo (content/departamentos) do easyopendocs, com rotacao.

.DESCRIPTION
  Compacta a pasta de conteudo num .zip datado e aplica a mesma politica de
  retencao do backup-db.ps1 (janela diaria + 1 por mes). Rode este script
  logo apos (ou antes) do backup-db.ps1, no mesmo agendamento, para manter
  os dois num ponto no tempo proximo.

.EXAMPLE
  .\backup-content.ps1 -ContentDir "C:\apps\easyopendocs\content\departamentos" `
    -BackupDir "D:\backups\easyopendocs\content"
#>

param(
    [string]$ContentDir = "C:\apps\easyopendocs\content\departamentos",
    [string]$BackupDir = "D:\backups\easyopendocs\content",
    [int]$RetentionDays = 14,
    [int]$MonthlyRetentionMonths = 12
)

$ErrorActionPreference = "Stop"

if (-not (Test-Path $ContentDir)) {
    throw "Pasta de conteudo nao encontrada em '$ContentDir'. Ajuste -ContentDir."
}

New-Item -ItemType Directory -Force -Path $BackupDir | Out-Null

$timestamp = Get-Date -Format "yyyy-MM-dd_HHmm"
$zipFile = Join-Path $BackupDir "content_$timestamp.zip"

Write-Host "Compactando $ContentDir em $zipFile ..."
Compress-Archive -Path (Join-Path $ContentDir "*") -DestinationPath $zipFile -CompressionLevel Optimal

Write-Host "Backup de conteudo concluido: $((Get-Item $zipFile).Length / 1MB) MB"

# --- Retencao (mesma logica do backup-db.ps1) --------------------------

$allZips = Get-ChildItem -Path $BackupDir -Filter "content_*.zip" |
    Sort-Object LastWriteTime

$cutoffDaily = (Get-Date).AddDays(-$RetentionDays)
$cutoffMonthly = (Get-Date).AddMonths(-$MonthlyRetentionMonths)

$keptMonths = @{}

foreach ($zip in $allZips) {
    if ($zip.LastWriteTime -ge $cutoffDaily) {
        continue
    }

    if ($zip.LastWriteTime -lt $cutoffMonthly) {
        Write-Host "Removendo backup fora da retencao mensal: $($zip.Name)"
        Remove-Item $zip.FullName
        continue
    }

    $monthKey = $zip.LastWriteTime.ToString("yyyy-MM")
    if (-not $keptMonths.ContainsKey($monthKey)) {
        $keptMonths[$monthKey] = $true
    } else {
        Write-Host "Removendo backup diario expirado: $($zip.Name)"
        Remove-Item $zip.FullName
    }
}

Write-Host "Backup de conteudo concluido."
