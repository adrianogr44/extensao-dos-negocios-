# ============================================================
# INICIAR AGENDADORES - totalmente escondido (sem janelas)
# Futebol (9222) + Motivacao (9223) + Chrome oculto
# Usado pela Tarefa Agendada do Windows e por click duplo.
# Logs: scripts\postar-log.txt e scripts\postar-log-motivacao.txt
# ============================================================
$ErrorActionPreference = 'SilentlyContinue'

$root = 'C:\Users\adria\Documents\fabrica-reels'
$scripts = Join-Path $root 'scripts'
$nodeExe = 'C:\Program Files\nodejs\node.exe'

function Test-PidAlive([string]$pidFile) {
  if (-not (Test-Path -LiteralPath $pidFile)) { return $false }
  $text = (Get-Content -LiteralPath $pidFile -Raw).Trim()
  if ($text -notmatch '^\d+$') { return $false }
  return $null -ne (Get-Process -Id ([int]$text) -ErrorAction SilentlyContinue)
}

function Test-PortOpen([int]$port) {
  return $null -ne (Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue)
}

function Start-HiddenNode([string[]]$arguments) {
  $p = Start-Process -FilePath $nodeExe -ArgumentList $arguments -WorkingDirectory $root -WindowStyle Hidden -PassThru
  return $p.Id
}

# ---------- 1. Chrome (so se a porta estiver fechada) ----------
foreach ($profile in @('futebol', 'motivacao')) {
  $port = if ($profile -eq 'futebol') { 9222 } else { 9223 }
  if (-not (Test-PortOpen $port)) {
    $null = Start-HiddenNode @("$scripts\launch-chrome.js", "--profile=$profile")
  }
}

Start-Sleep -Seconds 12

# ---------- 2. Agendadores (so se o PID antigo estiver morto) ----------
$agendadores = @(
  @{ profile = 'futebol';   pidFile = '.agendador-futebol.pid';   cfgFile = 'schedule-config.json' },
  @{ profile = 'motivacao'; pidFile = '.agendador-motivacao.pid'; cfgFile = 'schedule-config-motivacao.json' }
)

foreach ($a in $agendadores) {
  $cfg = Join-Path $scripts $a.cfgFile
  $cfgObj = Get-Content -LiteralPath $cfg -Raw | ConvertFrom-Json
  if (-not $cfgObj.enabled) { continue }

  $pidFile = Join-Path $scripts $a.pidFile
  if (Test-PidAlive $pidFile) { continue }

  $pid = Start-HiddenNode @("$scripts\postar-agendado.js", "--profile=$($a.profile)")
  Set-Content -LiteralPath $pidFile -Value $pid
}

# ---------- 3. Agendador semanal de tendencias (domingo 10:00) ----------
$pidTrend = Join-Path $scripts '.agendador-tendencias.pid'
if (-not (Test-PidAlive $pidTrend)) {
  $pid = Start-HiddenNode @("$scripts\agendador-tendencias.js")
  Set-Content -LiteralPath $pidTrend -Value $pid
}