<#
.SYNOPSIS
  Backup logico do Postgres do easyopendocs (pg_dump) com rotacao de retencao.

.DESCRIPTION
  Gera um dump em formato custom (-Fc), restauravel com pg_restore, e apaga
  dumps diarios mais antigos que -RetentionDays. Preserva um dump por mes
  (o mais proximo do dia 1) por -MonthlyRetentionMonths meses.

  Credenciais: nao passe a senha na linha de comando. Configure um arquivo
  %APPDATA%\postgresql\pgpass.conf (Windows) com a linha:
    hostname:porta:database:usuario:senha
  ou defina a variavel de ambiente PGPASSWORD antes de chamar o script
  (menos recomendado, fica no historico do processo).

.EXAMPLE
  .\backup-db.ps1 -PgDumpPath "C:\Program Files\PostgreSQL\17\bin\pg_dump.exe" `
    -DbName easyopendocs -DbUser easyopendocs -DbHost localhost -DbPort 5432 `
    -BackupDir "D:\backups\easyopendocs\db"
#>

param(
    [string]$PgDumpPath = "C:\Program Files\PostgreSQL\17\bin\pg_dump.exe",
    [string]$DbName = "easyopendocs",
    [string]$DbUser = "easyopendocs",
    [string]$DbHost = "localhost",
    [int]$DbPort = 5432,
    [string]$BackupDir = "D:\backups\easyopendocs\db",
    [int]$RetentionDays = 14,
    [int]$MonthlyRetentionMonths = 12
)

$ErrorActionPreference = "Stop"

if (-not (Test-Path $PgDumpPath)) {
    throw "pg_dump nao encontrado em '$PgDumpPath'. Ajuste -PgDumpPath."
}

New-Item -ItemType Directory -Force -Path $BackupDir | Out-Null

$timestamp = Get-Date -Format "yyyy-MM-dd_HHmm"
$dumpFile = Join-Path $BackupDir "easyopendocs_$timestamp.dump"

Write-Host "Gerando dump em $dumpFile ..."
& $PgDumpPath -Fc -h $DbHost -p $DbPort -U $DbUser -f $dumpFile $DbName

if ($LASTEXITCODE -ne 0) {
    throw "pg_dump falhou com codigo $LASTEXITCODE"
}

Write-Host "Dump concluido: $((Get-Item $dumpFile).Length / 1MB) MB"

# --- Retencao ---------------------------------------------------------
# Mantem todos os dumps dos ultimos $RetentionDays dias.
# Dos mais antigos, mantem so o primeiro dump de cada mes (proxy de
# "backup mensal"), pelos ultimos $MonthlyRetentionMonths meses, e apaga
# o resto.

$allDumps = Get-ChildItem -Path $BackupDir -Filter "easyopendocs_*.dump" |
    Sort-Object LastWriteTime

$cutoffDaily = (Get-Date).AddDays(-$RetentionDays)
$cutoffMonthly = (Get-Date).AddMonths(-$MonthlyRetentionMonths)

$keptMonths = @{}

foreach ($dump in $allDumps) {
    if ($dump.LastWriteTime -ge $cutoffDaily) {
        continue # dentro da janela diaria, mantem
    }

    if ($dump.LastWriteTime -lt $cutoffMonthly) {
        Write-Host "Removendo dump fora da retencao mensal: $($dump.Name)"
        Remove-Item $dump.FullName
        continue
    }

    $monthKey = $dump.LastWriteTime.ToString("yyyy-MM")
    if (-not $keptMonths.ContainsKey($monthKey)) {
        # primeiro dump encontrado desse mes (lista ja ordenada por data) -> mantem
        $keptMonths[$monthKey] = $true
    } else {
        Write-Host "Removendo dump diario expirado: $($dump.Name)"
        Remove-Item $dump.FullName
    }
}

Write-Host "Backup do banco concluido."
