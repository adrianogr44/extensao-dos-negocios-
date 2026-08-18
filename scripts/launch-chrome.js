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

function runHidden(command, args, waitMs = 0) {
  return new Promise((resolve) => {
    try {
      const child = spawn(command, args, { windowsHide: true, stdio: 'ignore', detached: waitMs === 0 });
      if (waitMs > 0) {
        const timer = setTimeout(() => resolve(true), waitMs);
        child.on('exit', () => { clearTimeout(timer); resolve(true); });
        child.on('error', () => { clearTimeout(timer); resolve(false); });
      } else {
        child.unref();
        resolve(true);
      }
    } catch {
      resolve(false);
    }
  });
}

const FORCE = process.argv.includes('--force');

async function main() {
  if (!FORCE && await isPortOpen(PORT)) {
    console.log(`[launch-chrome] Porta ${PORT} ja ativa (${PROFILE}) - nada a fazer.`);
    process.exit(0);
  }

  // Mata apenas processos do perfil correspondente (sem matar o Chrome pessoal nem o outro perfil)
  if (IS_MOTIVACAO) {
    const ps = `
$procs = Get-CimInstance Win32_Process -Filter "Name='chrome.exe'"
$procs | Where-Object { $_.CommandLine -like '*chrome-debug-profile-motivacao*' -or $_.CommandLine -like '*--remote-debugging-port=9223*' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }`;
    const encoded = Buffer.from(ps, 'utf-16le').toString('base64');
    await runHidden('powershell', ['-NoProfile', '-EncodedCommand', encoded], 10000);
  } else {
    const ps = `
$procs = Get-CimInstance Win32_Process -Filter "Name='chrome.exe'"
$procs | Where-Object {
  (($_.CommandLine -like '*chrome-debug-profile*') -and ($_.CommandLine -notlike '*chrome-debug-profile-motivacao*')) -or
  ($_.CommandLine -like '*--remote-debugging-port=9222*')
} | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }`;
    const encoded = Buffer.from(ps, 'utf-16le').toString('base64');
    await runHidden('powershell', ['-NoProfile', '-EncodedCommand', encoded], 10000);
  }

  if (!fs.existsSync(CHROME_EXE)) {
    console.error(`[launch-chrome] Chrome nao encontrado em: ${CHROME_EXE}`);
    process.exit(1);
  }

  const args = [
    `--remote-debugging-port=${PORT}`,
    '--remote-allow-origins=http://127.0.0.1',
    `--user-data-dir=${PROFILE_DIR}`,
    '--no-first-run',
  ];

  // CHROME_MODE=headless (padrao) | windowed
  // Headless = nenhuma janela abre (nao rouba o foco de jogos/videos).
  // Prioridade: scripts/chrome-mode.json (toggle do dashboard) > .env
  function readModeFromFile() {
    try {
      const f = path.join(__dirname, 'chrome-mode.json');
      if (fs.existsSync(f)) {
        const data = JSON.parse(fs.readFileSync(f, 'utf-8').replace(/^\uFEFF/, ''));
        if (data[PROFILE] === 'headless' || data[PROFILE] === 'windowed') return data[PROFILE];
      }
    } catch {}
    return null;
  }
  const mode = readModeFromFile() || (process.env.CHROME_MODE || 'headless').toLowerCase();
  if (mode === 'headless') {
    args.push(
      '--headless=new',
      '--window-size=390,844',
      '--mute-audio',
      '--disable-blink-features=AutomationControlled',
      '--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    );
  } else {
    args.push('--start-minimized');
  }
  const ok = await runHidden(CHROME_EXE, args);
  if (!ok) {
    console.error(`[launch-chrome] Falha ao iniciar Chrome (${PROFILE})`);
    process.exit(1);
  }
  console.log(`[launch-chrome] Chrome ${PROFILE} iniciando na porta ${PORT} (modo ${mode}, sem janela)`);

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