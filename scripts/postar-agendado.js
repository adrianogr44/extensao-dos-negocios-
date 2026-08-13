const cron = require('node-cron');
const path = require('path');
const fs = require('fs');

const argProfile = (process.argv.slice(2).join(' ') || '').match(/--profile=([A-Za-z0-9_-]+)/);
const PROFILE = (argProfile ? argProfile[1] : (process.env.PROFILE || 'futebol')).toLowerCase();
process.env.PROFILE = PROFILE;

const { main: postarCompleto } = require('./postar-completo');

const IS_MOTIVACAO = PROFILE === 'motivacao';
const TAG = IS_MOTIVACAO ? '💪 MOTIVACAO' : '⚽ FUTEBOL';
const LOG_FILE = path.join(__dirname, IS_MOTIVACAO ? 'postar-log-motivacao.txt' : 'postar-log.txt');
const CONFIG_FILE = path.join(__dirname, IS_MOTIVACAO ? 'schedule-config-motivacao.json' : 'schedule-config.json');
const CDP_PORT = IS_MOTIVACAO ? 9223 : 9222;
const PID_FILE = path.join(__dirname, IS_MOTIVACAO ? '.agendador-motivacao.pid' : '.agendador-futebol.pid');

function log(msg) {
  const line = `[${new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}] [${TAG}] ${msg}`;
  console.log(line);
  fs.appendFileSync(LOG_FILE, line + '\n');
}

process.on('uncaughtException', (err) => {
  log(`ERRO NAO CAPTURADO: ${err.stack || err.message}`);
});
process.on('unhandledRejection', (reason) => {
  log(`PROMISE REJEITADA NAO TRATADA: ${reason && reason.stack ? reason.stack : String(reason)}`);
});

function writePidFile() {
  try {
    fs.writeFileSync(PID_FILE, String(process.pid));
  } catch {}
}

function removePidFile() {
  try { if (fs.existsSync(PID_FILE)) fs.unlinkSync(PID_FILE); } catch {}
}

function launchChromeIfNeeded() {
  try {
    const net = require('net');
    const s = net.connect(CDP_PORT);
    s.on('connect', () => s.destroy());
    s.on('error', () => {
      log(`Chrome nao encontrado na porta ${CDP_PORT}, iniciando...`);
      // Lanca SEM janela de terminal
      const launcher = path.join(__dirname, 'launch-chrome.js');
      require('child_process').spawn('node', [launcher, `--profile=${PROFILE}`], {
        cwd: __dirname,
        windowsHide: true,
        stdio: 'ignore',
        detached: true,
      }).unref();
    });
  } catch {}
}

async function executarPostagem() {
  launchChromeIfNeeded();
  await new Promise(r => setTimeout(r, 5000));
  log(`Iniciando postagem (${VIDEOS_PER_RUN} videos)...`);
  const watchdog = setTimeout(() => {
    log('ERRO: rodada excedeu 4h e foi encerrada para nao travar o agendador.');
    process.exit(1);
  }, 4 * 60 * 60 * 1000);
  watchdog.unref();
  try {
    await postarCompleto(VIDEOS_PER_RUN);
    clearTimeout(watchdog);
    log('Postagem concluida.');
  } catch (err) {
    clearTimeout(watchdog);
    log(`ERRO: ${err.message}`);
  }
}

const config = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf-8'));
if (!config.enabled) {
  log('Agendador desabilitado em schedule-config.json');
  process.exit(0);
}

const VIDEOS_PER_RUN = Math.max(1, parseInt(config.videosPerRun, 10) || 1);

console.log(`=== Agendador de Postagem [${TAG}] ===`);
console.log(`Horarios: ${config.times.join(', ')}`);
console.log(`Fuso: ${config.timezone}`);
console.log(`Perfil: ${PROFILE} (porta ${CDP_PORT})`);
console.log(`${VIDEOS_PER_RUN} video(s) por execucao`);
console.log(`Total: ${config.times.length * VIDEOS_PER_RUN} publicacoes/dia\n`);

for (const time of config.times) {
  const [h, m] = time.split(':');
  const cronExpr = `${m} ${h} * * *`;
  cron.schedule(cronExpr, executarPostagem, { timezone: config.timezone });
  log(`Agendado: ${time} (cron: ${cronExpr})`);
}

log(`Agendador iniciado. ${config.times.length} horarios cadastrados.`);
writePidFile();

process.on('SIGINT', () => {
  removePidFile();
  log('Agendador encerrado pelo usuario.');
  process.exit(0);
});
process.on('exit', removePidFile);