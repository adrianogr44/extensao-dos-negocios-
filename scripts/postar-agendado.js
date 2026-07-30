const cron = require('node-cron');
const path = require('path');
const fs = require('fs');
const { main: postarCompleto } = require('./postar-completo');

const LOG_FILE = path.join(__dirname, 'postar-log.txt');
const CONFIG_FILE = path.join(__dirname, 'schedule-config.json');

function log(msg) {
  const line = `[${new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}] ${msg}`;
  console.log(line);
  fs.appendFileSync(LOG_FILE, line + '\n');
}

function launchChromeIfNeeded() {
  const chromeLauncher = path.join(__dirname, 'launch-chrome.cmd');
  if (!fs.existsSync(chromeLauncher)) return;
  try {
    const net = require('net');
    const s = net.connect(9222);
    s.on('connect', () => s.destroy());
    s.on('error', () => {
      log('Chrome nao encontrado na porta 9222, iniciando...');
      require('child_process').spawn('cmd', ['/c', 'start', '', chromeLauncher], { shell: true, detached: true }).unref();
    });
  } catch {}
}

async function executarPostagem() {
  launchChromeIfNeeded();
  await new Promise(r => setTimeout(r, 5000));
  log('Iniciando postagem (1 video)...');
  try {
    await postarCompleto(1);
    log('Postagem concluida.');
  } catch (err) {
    log(`ERRO: ${err.message}`);
  }
}

const config = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf-8'));
if (!config.enabled) {
  log('Agendador desabilitado em schedule-config.json');
  process.exit(0);
}

console.log('=== Agendador de Postagem ===');
console.log(`Horarios: ${config.times.join(', ')}`);
console.log(`Fuso: ${config.timezone}`);
console.log('1 video por execucao (4 plataformas)');
console.log(`Total: ${config.times.length} publicacoes/dia\n`);

for (const time of config.times) {
  const [h, m] = time.split(':');
  const cronExpr = `${m} ${h} * * *`;
  cron.schedule(cronExpr, executarPostagem, { timezone: config.timezone });
  log(`Agendado: ${time} (cron: ${cronExpr})`);
}

log(`Agendador iniciado. ${config.times.length} horarios cadastrados.`);

process.on('SIGINT', () => {
  log('Agendador encerrado pelo usuario.');
  process.exit(0);
});
