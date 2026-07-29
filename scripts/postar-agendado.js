const cron = require('node-cron');
const path = require('path');
const { spawn } = require('child_process');
const { main: postarCompleto } = require('./postar-completo');

const LOG_FILE = path.join(__dirname, 'postar-log.txt');

function log(msg) {
  const line = `[${new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}] ${msg}`;
  console.log(line);
  require('fs').appendFileSync(LOG_FILE, line + '\n');
}

function launchChromeIfNeeded() {
  const chromeLauncher = path.join(__dirname, 'launch-chrome.cmd');
  if (!require('fs').existsSync(chromeLauncher)) return;
  try {
    const net = require('net');
    const s = net.connect(9222);
    s.on('connect', () => s.destroy());
    s.on('error', () => {
      log('Chrome nao encontrado na porta 9222, iniciando...');
      spawn('cmd', ['/c', 'start', '', chromeLauncher], { shell: true, detached: true }).unref();
    });
  } catch {}
}

console.log('=== Agendador de Postagem Iniciado ===');
console.log('Horarios: 06:30 e 11:30 (horario de Sao Paulo)');
console.log('Logs salvos em: postar-log.txt\n');

const VIDEOS_POR_HORARIO = { '06:30': 2, '11:30': 3 };

async function executarPostagem() {
  launchChromeIfNeeded();
  await new Promise(r => setTimeout(r, 5000));
  const h = new Date().toLocaleString('en-US', { timeZone: 'America/Sao_Paulo', hour: '2-digit', hour12: false });
  const m = new Date().toLocaleString('en-US', { timeZone: 'America/Sao_Paulo', minute: '2-digit' });
  const key = `${h}:${m}`;
  const maxVideos = VIDEOS_POR_HORARIO[key] || 2;
  log(`Iniciando postagem (${key}, ${maxVideos} videos)...`);
  try {
    await postarCompleto(maxVideos);
    log('Postagem concluida com sucesso.');
  } catch (err) {
    log(`ERRO na postagem: ${err.message}`);
  }
}

cron.schedule('30 6,11 * * *', executarPostagem, {
  timezone: 'America/Sao_Paulo',
});

log('Agendador iniciado. Aguardando horarios: 06:30 e 11:30');
console.log('Pressione Ctrl+C para parar.\n');

process.on('SIGINT', () => {
  log('Agendador encerrado pelo usuario.');
  process.exit(0);
});
