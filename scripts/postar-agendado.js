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
console.log('Horario: 06:00 (horario de Sao Paulo)');
console.log('Intervalo de 1h entre cada video (5 videos/dia)');
console.log('Logs salvos em: postar-log.txt\n');

async function executarPostagem() {
  launchChromeIfNeeded();
  await new Promise(r => setTimeout(r, 5000));
  log('Iniciando postagem diaria...');
  try {
    await postarCompleto();
    log('Postagem concluida com sucesso.');
  } catch (err) {
    log(`ERRO na postagem: ${err.message}`);
  }
}

cron.schedule('0 6 * * *', executarPostagem, {
  timezone: 'America/Sao_Paulo',
});

log('Agendador iniciado. Aguardando 06:00...');
console.log('Pressione Ctrl+C para parar.\n');

process.on('SIGINT', () => {
  log('Agendador encerrado pelo usuario.');
  process.exit(0);
});
