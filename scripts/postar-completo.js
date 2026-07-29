const path = require('path');
const fs = require('fs');
const os = require('os');
const { chromium } = require('playwright');

const REELS_VIDEO_DIR = process.env.VIDEOS_DIR || path.join(os.homedir(), 'Downloads', 'FabricaReels');
const QUEUE_FILE = path.join(__dirname, 'posts-queue.json');
const DEBUG_PORT = parseInt(process.env.CHROME_DEBUG_PORT) || 9222;
const DAILY_LIMIT_INSTAGRAM = parseInt(process.env.INSTAGRAM_DAILY_LIMIT) || 5;
const DAILY_LIMIT_TIKTOK = parseInt(process.env.TIKTOK_DAILY_LIMIT) || 5;

function hoje() {
  return new Date().toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' }).split('/').reverse().join('-');
}

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
    const queue = { videos, currentIndex: 0, dailyCount: 0, dailyCountTikTok: 0, lastPostDate: '' };
    saveQueue(queue);
    return queue;
  }
  return JSON.parse(fs.readFileSync(QUEUE_FILE, 'utf-8'));
}

function saveQueue(queue) {
  fs.writeFileSync(QUEUE_FILE, JSON.stringify(queue, null, 2));
}

function getNextVideos(queue) {
  const today = hoje();
  if (queue.lastPostDate !== today) {
    queue.dailyCount = 0;
    queue.dailyCountTikTok = 0;
    queue.lastPostDate = today;
  }
  const remaining = Math.min(
    DAILY_LIMIT_INSTAGRAM - queue.dailyCount,
    DAILY_LIMIT_TIKTOK - queue.dailyCountTikTok
  );
  if (remaining <= 0) return [];
  const pending = queue.videos.filter(v =>
    (!v.postedInstagram || !v.postedTikTok) && fs.existsSync(v.path)
  );
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

function getInstagramCaption() {
  return process.env.INSTAGRAM_CAPTION || '#futebol #football #lamineyamal #fcbarcelona';
}

function getTikTokCaption() {
  return process.env.TIKTOK_CAPTION || '#futebol #football #lamineyamal #fcbarcelona #messi #neymar';
}

async function screenshot(page, label) {
  const dir = path.join(REELS_VIDEO_DIR, 'debug');
  try { require('fs').mkdirSync(dir, { recursive: true }); } catch {}
  await page.screenshot({ path: `${dir}\\${label}.png`, fullPage: false });
  console.log(`  [Debug] Screenshot salvo: ${label}.png`);
}

async function postToInstagram(page, videoPath) {
  console.log(`  [Instagram] Postando: ${path.basename(videoPath)}`);

  await page.goto('https://www.instagram.com', { waitUntil: 'networkidle', timeout: 60000 });
  await page.waitForTimeout(3000);

  await page.locator('svg[aria-label="Novo post"], svg[aria-label="New post"]').first().click();
  await page.waitForTimeout(2000);

  await page.locator('input[type="file"]').first().setInputFiles(videoPath);
  console.log('  [Instagram] Video enviado, aguardando processamento...');
  await page.waitForTimeout(15000);

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
    await page.keyboard.type(getInstagramCaption(), { delay: 30 });
    await page.waitForTimeout(1000);
  }

  await page.locator('div[role="dialog"] div[role="button"]:has-text("Compartilhar")').first().click({ force: true });
  console.log('  [Instagram] Clicou em Compartilhar');

  await page.waitForTimeout(3000);

  try {
    await page.waitForFunction(() => {
      return document.body.innerText.includes('Seu reel foi compartilhado');
    }, { timeout: 180000 });
    console.log('  [Instagram] Reel compartilhado com sucesso!');

    const concluir = page.locator('button:has-text("Concluir"), a:has-text("Concluir"), div[role="button"]:has-text("Concluir"), span:has-text("Concluir")').first();
    if (await concluir.isVisible({ timeout: 5000 }).catch(() => false)) {
      await concluir.click();
      console.log('  [Instagram] Clicou em Concluir');
      await page.waitForTimeout(2000);
    }
  } catch {
    await page.waitForTimeout(10000);
    console.log('  [Instagram] Continuando apos compartilhar');
  }

  await page.waitForTimeout(2000);
  return true;
}

async function fecharPopupTikTok(page) {
  try {
    const btn = page.locator('button:has-text("Recusar"), button:has-text("Cancelar"), button:has-text("Decline"), button:has-text("Close")').first();
    if (await btn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await btn.click();
      console.log('  [TikTok] Popup fechado');
      await page.waitForTimeout(1000);
      return true;
    }
  } catch {}
  return false;
}

async function postToTikTok(page, videoPath) {
  console.log(`  [TikTok] Postando: ${path.basename(videoPath)}`);

  await page.goto('https://www.tiktok.com/upload', { waitUntil: 'load', timeout: 120000 });
  await page.waitForTimeout(8000);
  await screenshot(page, '1-tiktok-inicio');

  await fecharPopupTikTok(page);

  const fileInput = page.locator('input[type="file"]').first();
  await fileInput.waitFor({ state: 'attached', timeout: 30000 });
  await page.waitForTimeout(1000);
  await fileInput.setInputFiles(videoPath);
  console.log('  [TikTok] Video enviado, aguardando processamento...');
  await page.waitForTimeout(15000);
  await screenshot(page, '2-tiktok-pos-upload');

  await fecharPopupTikTok(page);

  try {
    await page.waitForSelector('div[contenteditable="true"]', { timeout: 90000 });
    console.log('  [TikTok] Editor de legenda apareceu');
  } catch {
    await screenshot(page, '2b-tiktok-sem-legenda');
    throw new Error('Editor de legenda do TikTok nao apareceu apos upload');
  }

  await page.waitForTimeout(3000);
  await screenshot(page, '3-tiktok-legenda');

  const captionBox = page.locator('div[contenteditable="true"]').first();
  await captionBox.focus();
  await page.waitForTimeout(500);
  await captionBox.fill('');
  await page.waitForTimeout(300);
  await captionBox.fill(getTikTokCaption());
  console.log('  [TikTok] Legenda inserida');
  await page.waitForTimeout(2000);

  await fecharPopupTikTok(page);

  try {
    const joyrideClose = page.locator('div[data-test-id="close"], button[aria-label="Close"], .react-joyride__close');
    if (await joyrideClose.isVisible({ timeout: 2000 }).catch(() => false)) {
      await joyrideClose.click();
      console.log('  [TikTok] Tour guiado fechado');
      await page.waitForTimeout(1000);
    }
  } catch {}

  await screenshot(page, '4-tiktok-antes-publicar');

  const postBtn = page.locator('button:has-text("Post"), button:has-text("Publicar")').first();
  await postBtn.waitFor({ timeout: 60000 });
  await page.waitForTimeout(2000);

  try {
    const overlay = page.locator('.react-joyride__overlay');
    if (await overlay.isVisible({ timeout: 2000 }).catch(() => false)) {
      await overlay.evaluate(el => el.remove());
      console.log('  [TikTok] Overlay removido via JS');
      await page.waitForTimeout(500);
    }
  } catch {}

  await postBtn.click();
  console.log('  [TikTok] Clicou em Publicar, aguardando publicacao...');

  await page.waitForTimeout(8000);
  await screenshot(page, '5-tiktok-pos-publicar');

  try {
    await page.waitForFunction(() => {
      const text = document.body.innerText;
      return /visualizaç[ãa]o|curtidas|comentários|público|privacidade/i.test(text);
    }, { timeout: 60000 });
    console.log('  [TikTok] Video publicado com sucesso!');
  } catch {
    await screenshot(page, '5b-tiktok-falha');
    const texto = await page.evaluate(() => document.body.innerText.substring(0, 1000));
    console.log(`  [TikTok] Texto na pagina: ${texto.replace(/\n/g, ' ').substring(0, 400)}`);
    throw new Error('Nao foi possivel confirmar publicacao no TikTok Studio');
  }

  await page.waitForTimeout(3000);
  return true;
}

async function main(maxVideos) {
  console.log('=== Iniciando Postagem Completa (Instagram + TikTok) ===\n');

  const LOCK_FILE = path.join(__dirname, '.posting.lock');
  if (fs.existsSync(LOCK_FILE)) {
    const lockAge = Date.now() - fs.statSync(LOCK_FILE).mtimeMs;
    if (lockAge < 1200000) {
      console.log('Ja existe uma execucao em andamento (lock), pulando.');
      return;
    }
    fs.unlinkSync(LOCK_FILE);
  }
  fs.writeFileSync(LOCK_FILE, String(process.pid));

  const queue = loadQueue();
  const today = hoje();

  if (queue.lastPostDate === today) {
    if (queue.dailyCount >= DAILY_LIMIT_INSTAGRAM && queue.dailyCountTikTok >= DAILY_LIMIT_TIKTOK) {
      console.log('Limite diário de ambas plataformas já foi atingido.');
      return;
    }
  }

  const toPost = [];
  const today2 = hoje();
  if (queue.lastPostDate !== today2) {
    queue.dailyCount = 0;
    queue.dailyCountTikTok = 0;
    queue.lastPostDate = today2;
  }
  const pending = queue.videos.filter(v =>
    (!v.postedInstagram || !v.postedTikTok) && fs.existsSync(v.path)
  );
  const remainingIG = DAILY_LIMIT_INSTAGRAM - queue.dailyCount;
  const remainingTT = DAILY_LIMIT_TIKTOK - queue.dailyCountTikTok;

  const maxVideosAgendado = maxVideos || Math.max(remainingIG, remainingTT);

  for (const v of pending) {
    const precisaIG = !v.postedInstagram && queue.dailyCount < DAILY_LIMIT_INSTAGRAM;
    const precisaTT = !v.postedTikTok && queue.dailyCountTikTok < DAILY_LIMIT_TIKTOK;
    if (precisaIG || precisaTT) {
      toPost.push(v);
      if (precisaIG) queue.dailyCount++;
      if (precisaTT) queue.dailyCountTikTok++;
    }
    if (toPost.length >= maxVideosAgendado) break;
    if (queue.dailyCount >= DAILY_LIMIT_INSTAGRAM && queue.dailyCountTikTok >= DAILY_LIMIT_TIKTOK) break;
  }

  if (toPost.length === 0) {
    console.log('Nenhum vídeo pendente para postar.');
    return;
  }

  console.log(`Vídeos para postar hoje: ${toPost.length}`);
  toPost.forEach(v => {
    const status = [];
    if (!v.postedInstagram) status.push('IG');
    if (!v.postedTikTok) status.push('TT');
    console.log(`  - ${v.filename} (faltam: ${status.join(' + ')})`);
  });

  console.log('\nConectando ao Chrome (porta 9222)...');
  const browser = await chromium.connectOverCDP(`http://127.0.0.1:${DEBUG_PORT}`);
  const contexts = browser.contexts();
  const context = contexts[0] || await browser.newContext();
  const page = await context.newPage();

  console.log('Chrome conectado com sucesso!\n');

  for (let i = 0; i < toPost.length; i++) {
    const video = toPost[i];
    console.log(`\n--- [${i + 1}/${toPost.length}] ${video.filename} ---`);

    if (!video.postedInstagram) {
      try {
        const igPage = await context.newPage();
        await postToInstagram(igPage, video.path);
        video.postedInstagram = true;
        video.instagramDate = new Date().toISOString();
        await igPage.close();
      } catch (err) {
        console.error(`  [Instagram] ERRO: ${err.message}`);
        video.error = video.error ? `${video.error} | Instagram: ${err.message}` : `Instagram: ${err.message}`;
      }
    } else {
      console.log('  [Instagram] Ja postado, pulando...');
    }

    await page.waitForTimeout(3000);

    if (!video.postedTikTok) {
      try {
        await postToTikTok(page, video.path);
        video.postedTikTok = true;
        video.tiktokDate = new Date().toISOString();
      } catch (err) {
        console.error(`  [TikTok] ERRO: ${err.message}`);
        video.error = video.error ? `${video.error} | TikTok: ${err.message}` : `TikTok: ${err.message}`;
      }
    } else {
      console.log('  [TikTok] Ja postado, pulando...');
    }

    if (video.postedInstagram && video.postedTikTok) {
      deleteVideoFile(video.path);
    }

    queue.lastPostDate = today;
    saveQueue(queue);

    const postedIG = queue.videos.filter(v => v.postedInstagram).length;
    const postedTT = queue.videos.filter(v => v.postedTikTok).length;
    console.log(`\nProgresso: IG ${postedIG}/${queue.videos.length} | TT ${postedTT}/${queue.videos.length}`);
  }

  await page.close();
  await browser.close();

  const totalIG = queue.videos.filter(v => v.postedInstagram).length;
  const totalTT = queue.videos.filter(v => v.postedTikTok).length;
  console.log(`\n=== Concluido! IG: ${totalIG} | TT: ${totalTT} / ${queue.videos.length} videos ===`);

  try { fs.unlinkSync(LOCK_FILE); } catch {}
}

if (require.main === module) {
  const maxVideos = process.argv[2] ? parseInt(process.argv[2], 10) : undefined;
  main(maxVideos).catch(err => {
    console.error('Erro fatal:', err);
    process.exit(1);
  });
}

module.exports = { main, loadQueue, saveQueue, postToInstagram, postToTikTok };
