const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const argv = process.argv.slice(2).join(' ');
const PROFILE = (argv.match(/--profile=([A-Za-z0-9_-]+)/) || [])[1] || 'futebol';
process.env.PROFILE = PROFILE;

const { postToTikTok, loadQueue, saveQueue, IS_MOTIVACAO } = require('./postar-completo');

const PORT = IS_MOTIVACAO ? 9223 : 9222;

(async () => {
  const queue = loadQueue();
  const pendingBlocked = queue.videos.filter((v) => !v.postedTikTok && v.blockedTikTok);
  if (pendingBlocked.length > 0) {
    console.log(`[TikTok-only] PULANDO ${pendingBlocked.length} video(s) bloqueado(s) pelo TikTok (blockedTikTok=true)`);
    pendingBlocked.slice(0, 5).forEach((v) => console.log(`  - ${v.filename}: ${(v.tiktokBlockReason || '').slice(0, 100)}`));
  }
  const pending = queue.videos.filter((v) => !v.postedTikTok && !v.blockedTikTok && fs.existsSync(v.path));
  if (pending.length === 0) {
    console.log('Nenhum video pendente de TikTok.');
    process.exit(0);
  }
  const video = pending[0];
  console.log(`[TikTok-only] Postando: ${video.filename}`);

  const browser = await chromium.connectOverCDP(`http://127.0.0.1:${PORT}`);
  const contexts = browser.contexts();
  const context = contexts[0] || await browser.newContext();
  const page = await context.newPage();

  try {
    await postToTikTok(page, video.path);
    video.postedTikTok = true;
    video.tiktokDate = new Date().toISOString();
    video.error = null;
    saveQueue(queue);
    console.log('  [TikTok-only] COMPLETO: video marcado postedTikTok=true');
  } catch (err) {
    video.error = `TikTok: ${err.message}`;
    video.tiktokRetries = (video.tiktokRetries || 0) + 1;
    if (video.tiktokRetries >= 2) {
      video.blockedTikTok = true;
      video.tiktokBlockReason = `Falhou ${video.tiktokRetries}x seguidas: ${err.message}`;
      console.log(`  [TikTok-only] Video marcado como bloqueado (2x falhas) e sera pulado nas proximas execucoes.`);
    }
    saveQueue(queue);
    console.error(`  [TikTok-only] ERRO: ${err.message}`);
    process.exitCode = 1;
  }

  await page.close().catch(() => {});
  await browser.close().catch(() => {});
})().catch((e) => { console.error('fatal:', e.message); process.exit(1); });