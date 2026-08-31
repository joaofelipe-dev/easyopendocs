<#
.SYNOPSIS
  Copia os backups locais (banco + conteudo) para um destino fora do servidor.

.DESCRIPTION
  Espelha -LocalBackupRoot (que deve conter as subpastas db/ e content/
  geradas por backup-db.ps1 e backup-content.ps1) para -RemoteDestination,
  usando robocopy em modo mirror (/MIR). Rode depois dos dois scripts acima,
  no mesmo agendamento.

  -RemoteDestination pode ser um caminho UNC (\\outromaquina\backups\easyopendocs)
  ou qualquer pasta montada (ex. um drive de rede, NAS, ou pasta sincronizada
  por um cliente de nuvem).

.EXAMPLE
  .\backup-offsite.ps1 -LocalBackupRoot "D:\backups\easyopendocs" `
    -RemoteDestination "\\nas01\backups\easyopendocs"
#>

param(
    [string]$LocalBackupRoot = "D:\backups\easyopendocs",
    [string]$RemoteDestination = "\\nas01\backups\easyopendocs"
)

$ErrorActionPreference = "Stop"

if (-not (Test-Path $LocalBackupRoot)) {
    throw "Pasta local de backups nao encontrada em '$LocalBackupRoot'."
}

Write-Host "Espelhando $LocalBackupRoot -> $RemoteDestination ..."

# /MIR: espelha (copia novos/alterados, remove no destino o que sumiu na origem)
# /R:3 /W:10: tenta 3 vezes, espera 10s entre tentativas (rede instavel)
# /NFL /NDL: nao lista cada arquivo/pasta no output, so o resumo
robocopy $LocalBackupRoot $RemoteDestination /MIR /R:3 /W:10 /NFL /NDL

# robocopy usa codigos de saida 0-7 como sucesso (8+ = erro real)
if ($LASTEXITCODE -ge 8) {
    throw "robocopy falhou com codigo $LASTEXITCODE"
}

Write-Host "Copia offsite concluida."
