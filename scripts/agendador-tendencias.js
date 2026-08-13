/**
 * AGENDADOR SEMANAL DE TENDENCIAS
 * Roda a coleta de tendencias 1x por semana (domingo 10:00 America/Sao_Paulo)
 * e envia resumo no Telegram.
 * Uso: node scripts/agendador-tendencias.js
 */
const cron = require('node-cron');
const path = require('path');
const fs = require('fs');
const { main: coletar } = require('./coletar-tendencias');
const notify = require('./notify');

const LOG_FILE = path.join(__dirname, 'tendencias-log.txt');
const PID_FILE = path.join(__dirname, '.agendador-tendencias.pid');
const DAY = 0; // domingo
const TIME = '10:00';

function log(msg) {
  const line = `[${new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}] [TENDENCIAS] ${msg}`;
  console.log(line);
  fs.appendFileSync(LOG_FILE, line + '\n');
}

function writePid() {
  try { fs.writeFileSync(PID_FILE, String(process.pid)); } catch {}
}
function removePid() {
  try { if (fs.existsSync(PID_FILE)) fs.unlinkSync(PID_FILE); } catch {}
}

async function executarColeta() {
  log('Iniciando coleta semanal de tendencias (logs de progresso em tendencias-log.txt)...');
  const watchdog = setTimeout(() => {
    log('ERRO: coleta excedeu 30min e foi encerrada.');
    process.exit(1);
  }, 30 * 60 * 1000);
  watchdog.unref();
  try {
    const data = await coletar('--quiet');
    const resumo = resumoParaTelegram(data);
    log('Coleta concluida.');
    await notify.notifyRunSummary('TENDENCIAS', 0, { ok: resumo });
    return data;
  } catch (err) {
    log(`ERRO: ${err.message}`);
    await notify.notifyError('Tendencias: ' + err.message).catch(() => {});
  } finally {
    clearTimeout(watchdog);
  }
}

function resumoParaTelegram(data) {
  if (!data || !data.current || !data.current.byNiche) return 'sem dados';
  const linhas = [];
  for (const [niche, r] of Object.entries(data.current.byNiche)) {
    linhas.push(`\n${niche.toUpperCase()}:`);
    linhas.push(`  Temas: ${(r.conteudoEmAlta || []).join(', ') || 'nada'}`);
    linhas.push(`  Hashtags: ${(r.hashtagsEmAlta || []).slice(0, 8).map((h) => '#' + h.tag).join(' ')}`);
  }
  return linhas.join('\n');
}

const [h, m] = TIME.split(':');
const cronExpr = `${m} ${h} * * ${DAY}`;
cron.schedule(cronExpr, executarColeta, { timezone: 'America/Sao_Paulo' });

log(`Agendador de tendencias ativo. Proxima coleta: domingo ${TIME} (cron: ${cronExpr})`);
writePid();

process.on('SIGINT', () => { removePid(); log('Encerrado.'); process.exit(0); });
process.on('exit', removePid);

module.exports = { executarColeta, resumoParaTelegram };