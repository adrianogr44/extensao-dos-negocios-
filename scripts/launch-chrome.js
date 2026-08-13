// Lançador de Chrome SEM janela de terminal (substitui o launch-chrome.cmd).
// Uso: node launch-chrome.js [--profile=futebol|motivacao]
// Abre o Chrome com debug remoto na porta certa, sem abrir janelas visíveis.
const { spawn } = require('child_process');
const net = require('net');
const path = require('path');
const fs = require('fs');

const argProfile = (process.argv.slice(2).join(' ') || '').match(/--profile=([A-Za-z0-9_-]+)/);
const PROFILE = (argProfile ? argProfile[1] : (process.env.PROFILE || 'futebol')).toLowerCase();
const IS_MOTIVACAO = PROFILE === 'motivacao';

const CHROME_EXE = process.env.CHROME_EXE || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const PORT = IS_MOTIVACAO ? 9223 : 9222;
const PROFILE_DIR = path.join(
  process.env.USERPROFILE || 'C:\\Users\\adria',
  IS_MOTIVACAO ? 'chrome-debug-profile-motivacao' : 'chrome-debug-profile'
);
const KILL_PS1 = path.join(__dirname, IS_MOTIVACAO ? 'kill-motivacao.ps1' : 'kill-futebol.ps1');

function isPortOpen(port, timeoutMs = 1500) {
  return new Promise((resolve) => {
    const s = net.connect(port, '127.0.0.1');
    s.setTimeout(timeoutMs);
    s.once('connect', () => { s.destroy(); resolve(true); });
    s.once('timeout', () => { s.destroy(); resolve(false); });
    s.once('error', () => { s.destroy(); resolve(false); });
  });
}

function runHidden(command, args) {
  return new Promise((resolve) => {
    try {
      const child = spawn(command, args, { windowsHide: true, stdio: 'ignore', detached: true });
      child.unref();
      resolve(true);
    } catch {
      resolve(false);
    }
  });
}

async function main() {
  if (await isPortOpen(PORT)) {
    console.log(`[launch-chrome] Porta ${PORT} ja ativa (${PROFILE}) - nada a fazer.`);
    process.exit(0);
  }

  // Mata apenas processos do perfil correspondente (sem matar o Chrome pessoal nem o outro perfil)
  if (IS_MOTIVACAO) {
    const ps = `
$procs = Get-CimInstance Win32_Process -Filter "Name='chrome.exe'"
$procs | Where-Object { $_.CommandLine -like '*chrome-debug-profile-motivacao*' -or $_.CommandLine -like '*--remote-debugging-port=9223*' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }`;
    const encoded = Buffer.from(ps, 'utf-16le').toString('base64');
    await runHidden('powershell', ['-NoProfile', '-EncodedCommand', encoded]);
  } else {
    const ps = `
$procs = Get-CimInstance Win32_Process -Filter "Name='chrome.exe'"
$procs | Where-Object {
  (($_.CommandLine -like '*chrome-debug-profile*') -and ($_.CommandLine -notlike '*chrome-debug-profile-motivacao*')) -or
  ($_.CommandLine -like '*--remote-debugging-port=9222*')
} | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }`;
    const encoded = Buffer.from(ps, 'utf-16le').toString('base64');
    await runHidden('powershell', ['-NoProfile', '-EncodedCommand', encoded]);
  }

  if (!fs.existsSync(CHROME_EXE)) {
    console.error(`[launch-chrome] Chrome nao encontrado em: ${CHROME_EXE}`);
    process.exit(1);
  }

  const args = [
    `--remote-debugging-port=${PORT}`,
    '--remote-allow-origins=*',
    `--user-data-dir=${PROFILE_DIR}`,
    '--no-first-run',
    '--start-minimized',
  ];
  const ok = await runHidden(CHROME_EXE, args);
  if (!ok) {
    console.error(`[launch-chrome] Falha ao iniciar Chrome (${PROFILE})`);
    process.exit(1);
  }
  console.log(`[launch-chrome] Chrome ${PROFILE} iniciando na porta ${PORT} (sem janela)`);

  // Aguarda a porta abrir (ate ~30s) e informa o resultado
  for (let i = 0; i < 12; i++) {
    await new Promise((r) => setTimeout(r, 2500));
    if (await isPortOpen(PORT)) {
      console.log(`[launch-chrome] Porta ${PORT} ativa. Chrome ${PROFILE} OK.`);
      process.exit(0);
    }
  }
  console.error(`[launch-chrome] Chrome ${PROFILE} nao abriu a porta ${PORT} em 30s.`);
  process.exit(1);
}

main();