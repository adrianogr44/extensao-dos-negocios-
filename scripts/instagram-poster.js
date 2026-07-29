const path = require('path');
const os = require('os');
const fs = require('fs');

const REELS_VIDEO_DIR = process.env.VIDEOS_DIR || path.join(os.homedir(), 'Downloads', 'FabricaReels');
const QUEUE_FILE = path.join(__dirname, 'posts-queue.json');
const DEBUG_PORT = parseInt(process.env.CHROME_DEBUG_PORT) || 9222;
const CHROME_PATH = process.env.CHROME_PATH || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const DAILY_LIMIT = parseInt(process.env.INSTAGRAM_DAILY_LIMIT) || 5;
const { chromium } = require('playwright');

function naturalSort(a, b) {
  const na = parseInt(a.match(/_(\d+)\.mp4$/)?.[1] || '0', 10);
  const nb = parseInt(b.match(/_(\d+)\.mp4$/)?.[1] || '0', 10);
  return na - nb;
}

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

function getNextVideos(queue) {
  const today = new Date().toISOString().split('T')[0];
  if (queue.lastPostDate !== today) {
    queue.dailyCount = 0;
    queue.lastPostDate = today;
  }
  const remaining = DAILY_LIMIT - queue.dailyCount;
  if (remaining <= 0) return [];
  const pending = queue.videos.filter(v => !v.postedInstagram && fs.existsSync(v.path));
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

async function postToInstagram(page, videoPath) {
  console.log(`  [Instagram] Postando: ${path.basename(videoPath)}`);

  await page.goto('https://www.instagram.com', { waitUntil: 'networkidle' });
  await page.waitForTimeout(3000);

  await page.locator('svg[aria-label="Novo post"]').first().click();
  await page.waitForTimeout(2000);

  await page.locator('input[type="file"]').first().setInputFiles(videoPath);
  console.log('  [Instagram] Video enviado, aguardando processamento...');
  await page.waitForTimeout(10000);

  await page.locator('div[role="button"]:has-text("Avançar"), div[role="button"]:has-text("Next")').first().click({ timeout: 30000 });
  console.log('  [Instagram] Avancou para capa/edicao');
  await page.waitForTimeout(4000);

  await page.locator('div[role="button"]:has-text("Avançar"), div[role="button"]:has-text("Next")').first().click({ timeout: 30000 });
  console.log('  [Instagram] Avancou para legenda');
  await page.waitForTimeout(4000);

  const captionArea = page.locator('div[role="dialog"] div[role="textbox"]').first();
  if (await captionArea.isVisible({ timeout: 10000 }).catch(() => false)) {
    await captionArea.click();
    await page.waitForTimeout(500);
    await page.keyboard.type('TVアニメ『BLEACH 千年血戦篇』 最新情報を発表＆最新PV公開！ 新たな戦いの幕開け！ オープニング主題歌＆エンディング主題歌、さらに千年血戦篇の重要キャラクターたちの最新情報を公開しました！！', { delay: 30 });
    await page.waitForTimeout(1000);
  }

  await page.locator('div[role="dialog"] div[role="button"]:has-text("Compartilhar")').first().click({ force: true });
  console.log('  [Instagram] Clicou em Compartilhar');

  await page.waitForTimeout(10000);
  console.log('  [Instagram] Video postado com sucesso!');
  return true;
}

async function postToTikTok(page, videoPath) {
  console.log(`  [TikTok] Postando: ${path.basename(videoPath)}`);
  await page.goto('https://www.tiktok.com/upload', { waitUntil: 'networkidle' });
  await page.waitForTimeout(3000);

  const fileInput = page.locator('input[type="file"]').first();
  await fileInput.setInputFiles(videoPath);
  console.log('  [TikTok] Video enviado, aguardando processamento...');
  await page.waitForTimeout(10000);

  const captionBox = page.locator('div[contenteditable="true"]').first();
  if (await captionBox.isVisible({ timeout: 15000 }).catch(() => false)) {
    await captionBox.fill('');
    await captionBox.fill('TVアニメ『BLEACH 千年血戦篇』 最新情報を発表＆最新PV公開！ 新たな戦いの幕開け！ オープニング主題歌＆エンディング主題歌、さらに千年血戦篇の重要キャラクターたちの最新情報を公開しました！！');
    await page.waitForTimeout(1000);
  }

  const postBtn = page.locator('button:has-text("Post"), button:has-text("Publicar")').first();
  if (await postBtn.isVisible({ timeout: 30000 }).catch(() => false)) {
    await postBtn.click();
    console.log('  [TikTok] Postado com sucesso!');
    await page.waitForTimeout(5000);
    return true;
  }

  throw new Error('Não foi possível encontrar o botão de publicar no TikTok');
}

async function main() {
  console.log('=== Iniciando Postagem Automática ===\n');

  const queue = loadQueue();
  const today = new Date().toISOString().split('T')[0];

  if (queue.lastPostDate === today && queue.dailyCount >= DAILY_LIMIT) {
    console.log(`Limite de ${DAILY_LIMIT} vídeos de hoje já foi atingido.`);
    return;
  }

  const toPost = getNextVideos(queue);
  if (toPost.length === 0) {
    console.log('Nenhum vídeo pendente para postar.');
    return;
  }

  console.log(`Vídeos para postar hoje: ${toPost.length}`);
  toPost.forEach(v => console.log(`  - ${v.filename}`));

  console.log('\nConectando ao Chrome (porta 9222)...');
  const browser = await chromium.connectOverCDP(`http://localhost:${DEBUG_PORT}`);
  const contexts = browser.contexts();
  const context = contexts[0] || await browser.newContext();
  const page = await context.newPage();

  console.log('Chrome conectado com sucesso!\n');

  for (let i = 0; i < toPost.length; i++) {
    const video = toPost[i];
    console.log(`\n--- [${i + 1}/${toPost.length}] ${video.filename} ---`);

    try {
      if (!video.postedInstagram) {
        const igPage = await context.newPage();
        await postToInstagram(igPage, video.path);
        video.postedInstagram = true;
        video.instagramDate = new Date().toISOString();
        await igPage.close();
        deleteVideoFile(video.path);
        queue.dailyCount++;
      } else {
        console.log('  [Instagram] Ja postado, pulando...');
      }
    } catch (err) {
      console.error(`  [Instagram] ERRO: ${err.message}`);
      video.error = `Instagram: ${err.message}`;
    }

    await page.waitForTimeout(3000);

    queue.lastPostDate = today;
    saveQueue(queue);

    const postedCount = queue.videos.filter(v => v.postedInstagram).length;
    console.log(`\nProgresso: ${postedCount}/${queue.videos.length} videos processados`);
  }

  await page.close();
  await browser.close();

  const totalPosted = queue.videos.filter(v => v.postedInstagram).length;
  console.log(`\n=== Concluido! ${totalPosted}/${queue.videos.length} videos postados ===`);
}

if (require.main === module) {
  main().catch(err => {
    console.error('Erro fatal:', err);
    process.exit(1);
  });
}

module.exports = { main, loadQueue, saveQueue, getNextVideos, postToInstagram };
