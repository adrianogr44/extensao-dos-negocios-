const path = require('path');
const fs = require('fs');
const os = require('os');
const { chromium } = require('playwright');

const REELS_VIDEO_DIR = process.env.VIDEOS_DIR || path.join(os.homedir(), 'Downloads', 'FabricaReels');
const QUEUE_FILE = path.join(__dirname, 'posts-queue.json');
const TIKTOK_DAILY_LIMIT = parseInt(process.env.TIKTOK_DAILY_LIMIT) || 5;

function loadQueue() {
  if (!fs.existsSync(QUEUE_FILE)) {
    const files = fs.readdirSync(REELS_VIDEO_DIR).filter(f => f.endsWith('.mp4')).sort(naturalSort);
    const videos = files.map(f => ({
      path: path.join(REELS_VIDEO_DIR, f),
      filename: f,
      postedInstagram: false,
      postedTikTok: false,
      instagramDate: null,
      tiktokDate: null,
      error: null,
    }));
    const queue = { videos, currentIndex: 0, dailyCount: 0, lastPostDate: '' };
    saveQueue(queue);
    return queue;
  }
  return JSON.parse(fs.readFileSync(QUEUE_FILE, 'utf-8'));
}

function saveQueue(queue) {
  fs.writeFileSync(QUEUE_FILE, JSON.stringify(queue, null, 2));
}

function naturalSort(a, b) {
  const na = parseInt(a.match(/_(\d+)\.mp4$/)?.[1] || '0', 10);
  const nb = parseInt(b.match(/_(\d+)\.mp4$/)?.[1] || '0', 10);
  return na - nb;
}

function getDailyLimit() {
  return parseInt(process.env.TIKTOK_DAILY_LIMIT, 10) || TIKTOK_DAILY_LIMIT;
}

function getNextVideos(queue) {
  const today = new Date().toISOString().split('T')[0];
  if (queue.lastPostDate !== today) {
    queue.dailyCount = 0;
    queue.lastPostDate = today;
  }
  const remaining = getDailyLimit() - queue.dailyCount;
  if (remaining <= 0) return [];
  const pending = queue.videos.filter(v => !v.postedTikTok && fs.existsSync(v.path));
  return pending.slice(0, remaining);
}

async function deleteVideoFile(videoPath) {
  try {
    fs.unlinkSync(videoPath);
    console.log(`  [Delete] Arquivo removido: ${path.basename(videoPath)}`);
  } catch (err) {
    console.error(`  [Delete] Erro ao remover ${path.basename(videoPath)}: ${err.message}`);
  }
}

function getDefaultCaption() {
  return process.env.TIKTOK_CAPTION || '#futebol #football #lamineyamal #fcbarcelona #messi #neymar';
}

async function postToTikTok(page, videoPath, caption) {
  console.log(`  [TikTok] Postando: ${path.basename(videoPath)}`);

  await page.goto('https://www.tiktok.com/upload', { waitUntil: 'networkidle', timeout: 60000 });
  await page.waitForTimeout(3000);

  const fileInput = page.locator('input[type="file"]').first();
  await fileInput.setInputFiles(videoPath);
  console.log('  [TikTok] Video enviado, aguardando processamento...');

  await page.waitForTimeout(5000);

  await page.waitForSelector('div[contenteditable="true"]', { timeout: 30000 }).catch(() => {});
  await page.waitForTimeout(2000);

  const captionBox = page.locator('div[contenteditable="true"]').first();
  if (await captionBox.isVisible({ timeout: 15000 }).catch(() => false)) {
    await captionBox.click();
    await page.waitForTimeout(500);
    await captionBox.fill('');
    await page.waitForTimeout(300);
    await captionBox.fill(caption || getDefaultCaption());
    console.log('  [TikTok] Legenda inserida');
    await page.waitForTimeout(1000);
  }

  const postBtn = page.locator('button:has-text("Post"), button:has-text("Publicar")').first();
  if (await postBtn.isVisible({ timeout: 60000 }).catch(() => false)) {
    await postBtn.click();
    console.log('  [TikTok] Publicado com sucesso!');
    await page.waitForTimeout(5000);
    return true;
  }

  throw new Error('Não foi possível encontrar o botão de publicar no TikTok');
}

async function main({ caption } = {}) {
  console.log('=== Iniciando Postagem no TikTok ===\n');

  const queue = loadQueue();
  const today = new Date().toISOString().split('T')[0];

  if (queue.lastPostDate === today && queue.dailyCount >= getDailyLimit()) {
    console.log(`Limite de ${getDailyLimit()} vídeos de hoje já foi atingido.`);
    return;
  }

  const toPost = getNextVideos(queue);
  if (toPost.length === 0) {
    console.log('Nenhum vídeo pendente para postar no TikTok.');
    return;
  }

  console.log(`Vídeos para postar hoje no TikTok: ${toPost.length}`);
  toPost.forEach(v => console.log(`  - ${v.filename}`));

  console.log('\nConectando ao Chrome (porta 9222)...');
  const browser = await chromium.connectOverCDP(`http://localhost:${9222}`);
  const contexts = browser.contexts();
  const context = contexts[0] || await browser.newContext();
  const page = await context.newPage();

  console.log('Chrome conectado com sucesso!\n');

  for (let i = 0; i < toPost.length; i++) {
    const video = toPost[i];
    console.log(`\n--- [${i + 1}/${toPost.length}] ${video.filename} ---`);

    try {
      await postToTikTok(page, video.path, caption);
      video.postedTikTok = true;
      video.tiktokDate = new Date().toISOString();
      deleteVideoFile(video.path);
      queue.dailyCount++;
    } catch (err) {
      console.error(`  [TikTok] ERRO: ${err.message}`);
      video.error = `TikTok: ${err.message}`;
    }

    queue.lastPostDate = today;
    saveQueue(queue);

    const postedCount = queue.videos.filter(v => v.postedTikTok).length;
    console.log(`Progresso: ${postedCount}/${queue.videos.length} videos postados no TikTok`);
  }

  await page.close();
  await browser.close();

  const totalPosted = queue.videos.filter(v => v.postedTikTok).length;
  console.log(`\n=== Concluido! ${totalPosted}/${queue.videos.length} videos postados no TikTok ===`);
}

if (require.main === module) {
  main().catch(err => {
    console.error('Erro fatal:', err);
    process.exit(1);
  });
}

module.exports = { main, loadQueue, saveQueue, getNextVideos, postToTikTok };
