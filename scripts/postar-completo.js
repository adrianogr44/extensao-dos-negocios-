const path = require('path');
const fs = require('fs');
const os = require('os');
const { chromium } = require('playwright');

// Carrega variaveis do .env manualmente (sem dependencia externa)
try {
  const envFile = path.join(__dirname, '..', '.env');
  if (fs.existsSync(envFile)) {
    const lines = fs.readFileSync(envFile, 'utf-8').split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#') || !trimmed.includes('=')) continue;
      const eqIdx = trimmed.indexOf('=');
      const key = trimmed.substring(0, eqIdx).trim();
      const val = trimmed.substring(eqIdx + 1).trim();
      if (key && !process.env[key]) {
        process.env[key] = val;
      }
    }
  }
} catch (e) {
  console.error('Aviso: nao foi possivel carregar .env:', e.message);
}

const REELS_VIDEO_DIR = process.env.VIDEOS_DIR || path.join(os.homedir(), 'Downloads', 'FabricaReels');
const QUEUE_FILE = path.join(__dirname, 'posts-queue.json');
const DEBUG_PORT = parseInt(process.env.CHROME_DEBUG_PORT) || 9222;
const DAILY_LIMIT_INSTAGRAM = process.env.INSTAGRAM_DAILY_LIMIT !== undefined ? parseInt(process.env.INSTAGRAM_DAILY_LIMIT) : 5;
const DAILY_LIMIT_TIKTOK = process.env.TIKTOK_DAILY_LIMIT !== undefined ? parseInt(process.env.TIKTOK_DAILY_LIMIT) : 5;
const DAILY_LIMIT_FACEBOOK = process.env.FACEBOOK_DAILY_LIMIT !== undefined ? parseInt(process.env.FACEBOOK_DAILY_LIMIT) : 5;

const DAILY_LIMIT_SHORTS = process.env.SHORTS_DAILY_LIMIT !== undefined ? parseInt(process.env.SHORTS_DAILY_LIMIT) : 5;
const POST_INTERVAL_MS = (parseInt(process.env.POST_INTERVAL_MINUTES) || 60) * 60 * 1000;
const POST_INTERVAL_RANDOM_MS = (parseInt(process.env.POST_INTERVAL_RANDOM_MINUTES) || 15) * 60 * 1000;
const FACEBOOK_PAGE_URL = process.env.FACEBOOK_PAGE_URL || 'https://www.facebook.com/profile.php?id=61592685539474';

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
      postedFacebook: false,
      postedKwai: false,
      postedShorts: false,
      instagramDate: null,
      tiktokDate: null,
      facebookDate: null,
      kwaiDate: null,
      shortsDate: null,
      error: null,
    }));
    const queue = { videos, currentIndex: 0, dailyCount: 0, dailyCountTikTok: 0, dailyCountFacebook: 0, dailyCountKwai: 0, dailyCountShorts: 0, lastPostDate: '' };
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
    queue.dailyCountFacebook = 0;
    queue.lastPostDate = today;
  }
  const remaining = Math.max(
    DAILY_LIMIT_INSTAGRAM - queue.dailyCount,
    DAILY_LIMIT_TIKTOK - queue.dailyCountTikTok,
    DAILY_LIMIT_FACEBOOK - queue.dailyCountFacebook
  );
  if (remaining <= 0) return [];
  const pending = queue.videos.filter(v =>
    (!v.postedInstagram || !v.postedTikTok || !v.postedFacebook) && fs.existsSync(v.path)
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
  return process.env.INSTAGRAM_CAPTION || '#futebol #football #futebolbrasileiro #futebolarte #gol #jogada #ronaldo';
}

function getTikTokCaption() {
  return process.env.TIKTOK_CAPTION || '#futebol #football #futebolbrasileiro #fyp #foryou #gol #jogada #ronaldo';
}

function getFacebookCaption() {
  return process.env.FACEBOOK_CAPTION || '#futebol #football #futebolbrasileiro #futebolarte #gol #jogada';
}

function getShortsCaption() {
  return process.env.YOUTUBE_CAPTION || process.env.SHORTS_CAPTION || '#futebol #football #futebolbrasileiro #Shorts #gol #jogada';
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

async function postToFacebook(browser, videoPath) {
  console.log(`  [Facebook] Postando: ${path.basename(videoPath)}`);

  const fbPage = browser.contexts()[0].pages().find(p => p.url().includes('facebook.com'));
  if (!fbPage) {
    console.log('  [Facebook] Nenhuma pagina do Facebook aberta. Abrindo nova...');
    const page = await browser.contexts()[0].newPage();
    await page.goto(FACEBOOK_PAGE_URL + '&sk=reels_tab', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(6000);
    return await postToFacebookOnPage(page, videoPath);
  }

  console.log('  [Facebook] Usando pagina existente');
  return await postToFacebookOnPage(fbPage, videoPath);
}

async function postToFacebookOnPage(page, videoPath) {
  const origUrl = page.url();
  await page.goto('https://www.facebook.com/profile.php?id=61592685539474&sk=reels_tab', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(6000);

  const criarReel = page.locator('div[role="button"]:has-text("Criar reel")').first();
  if (!(await criarReel.isVisible({ timeout: 8000 }).catch(() => false))) {
    throw new Error('Botao Criar Reel nao encontrado');
  }
  await criarReel.click();
  console.log('  [Facebook] Criar Reel clicado');
  await page.waitForTimeout(5000);

  const carregar = page.locator('div[role="button"]:has-text("Carregar")').first();
  if (!(await carregar.isVisible({ timeout: 8000 }).catch(() => false))) {
    throw new Error('Botao Carregar nao encontrado');
  }

  const [fileChooser] = await Promise.all([
    page.waitForEvent('filechooser', { timeout: 10000 }).catch(() => null),
    carregar.click()
  ]);

  if (!fileChooser) {
    const fileInput = page.locator('input[type="file"]').first();
    if (await fileInput.isVisible({ timeout: 3000 }).catch(() => false)) {
      await fileInput.setInputFiles(videoPath);
    } else {
      throw new Error('Nao foi possivel abrir seletor de arquivos');
    }
  } else {
    await fileChooser.setFiles(videoPath);
  }

  console.log('  [Facebook] Video enviado!');
  await page.waitForTimeout(25000);

  for (let i = 0; i < 2; i++) {
    const btnNext = page.locator('[aria-label="Avançar"]:visible, [aria-label="Next"]:visible').first();
    if (await btnNext.isVisible({ timeout: 10000 }).catch(() => false)) {
      await btnNext.click();
      console.log(`  [Facebook] Avançar ${i + 1}`);
      await page.waitForTimeout(5000);
    }
  }

  const captionBox = page.locator('div[contenteditable="true"]').first();
  if (await captionBox.isVisible({ timeout: 10000 }).catch(() => false)) {
    await captionBox.click();
    await page.waitForTimeout(300);
    await captionBox.fill(getFacebookCaption());
    console.log('  [Facebook] Legenda inserida');
    await page.waitForTimeout(2000);
  }

  const btnPost = page.locator('[aria-label="Postar"]:visible, [aria-label="Publish"]:visible').first();
  if (await btnPost.isVisible({ timeout: 10000 }).catch(() => false)) {
    await btnPost.click();
    console.log('  [Facebook] Postar clicado!');
  }

  console.log('  [Facebook] Aguardando publicacao (30s)...');
  await page.waitForTimeout(30000);

  try { await page.goto(origUrl, { waitUntil: 'domcontentloaded', timeout: 15000 }).catch(() => {}); } catch {}

  console.log('  [Facebook] Reel postado com sucesso!');
  return true;
}

async function postToShorts(page, videoPath) {
  console.log(`  [Shorts] Postando: ${path.basename(videoPath)}`);

  await page.goto('https://studio.youtube.com', { waitUntil: 'load', timeout: 60000 });
  await page.waitForTimeout(8000);
  console.log('  [Shorts] YouTube Studio carregado');

  const createBtn = page.locator('ytcp-button#create-icon, ytcp-button:has-text("Criar"), ytcp-button:has-text("Create")').first();
  if (await createBtn.isVisible({ timeout: 10000 }).catch(() => false)) {
    await createBtn.click();
    await page.waitForTimeout(3000);
  }

  const uploadOption = page.locator('ytcp-ve:has-text("Enviar vídeos"), ytcp-ve:has-text("Upload videos"), tp-yt-paper-item:has-text("Upload")').first();
  if (await uploadOption.isVisible({ timeout: 5000 }).catch(() => false)) {
    await uploadOption.click();
    await page.waitForTimeout(3000);
  }

  const fileInput = page.locator('input[type="file"]').first();
  await fileInput.waitFor({ state: 'attached', timeout: 30000 }).catch(() => {});
  await page.waitForTimeout(1000);
  await fileInput.setInputFiles(videoPath);
  console.log('  [Shorts] Video enviado!');
  await page.waitForTimeout(25000);

  await page.waitForTimeout(3000);
  const titleEl = page.locator('#title-textarea').first();
  await titleEl.waitFor({ state: 'visible', timeout: 60000 }).catch(() => {});
  if (await titleEl.isVisible({ timeout: 3000 }).catch(() => false)) {
    const caption = getShortsCaption();
    await page.evaluate((text) => {
      const host = document.querySelector('#title-textarea');
      if (!host) return;
      const editable = host.querySelector('#textbox') || host.querySelector('[contenteditable]');
      if (editable) {
        editable.textContent = '';
        editable.textContent = text;
        editable.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
        editable.dispatchEvent(new Event('change', { bubbles: true }));
      }
    }, caption);
    console.log(`  [Shorts] Titulo: ${caption.substring(0, 40)}...`);
    await page.waitForTimeout(2000);
  }

  await page.locator('tp-yt-paper-radio-button[name="VIDEO_MADE_FOR_KIDS_NOT_MFK"], [name="VIDEO_MADE_FOR_KIDS_NOT_MFK"]').first().click().catch(() => {});
  console.log('  [Shorts] Nao feito para criancas');
  await page.waitForTimeout(1000);

  for (let step = 0; step < 3; step++) {
    const nextSelectors = ['#next-button', 'ytcp-button#next-button', 'ytcp-button:has-text("Próxima")', 'ytcp-button:has-text("Next")'];
    let found = false;
    for (const sel of nextSelectors) {
      const btn = page.locator(sel).first();
      if (await btn.isVisible({ timeout: 5000 }).catch(() => false)) {
        await btn.click();
        console.log(`  [Shorts] Proximo ${step + 1}`);
        await page.waitForTimeout(3000);
        found = true;
        break;
      }
    }
    if (!found) break;
  }

  await page.locator('[name="PUBLIC"], tp-yt-paper-radio-button[name="PUBLIC"]').first().click().catch(() => {});
  await page.waitForTimeout(1000);

  const publishSelectors = ['#done-button', 'ytcp-button#done-button', 'ytcp-button:has-text("Publicar")', 'ytcp-button:has-text("Publish")'];
  let published = false;
  for (const sel of publishSelectors) {
    const btn = page.locator(sel).first();
    if (await btn.isVisible({ timeout: 5000 }).catch(() => false)) {
      await btn.click();
      published = true;
      break;
    }
  }

  if (!published) {
    throw new Error('Botao Publicar nao encontrado');
  }

  console.log('  [Shorts] Publicar clicado!');
  await page.waitForTimeout(30000);
  console.log('  [Shorts] Video publicado com sucesso!');
  return true;
}

async function main(maxVideos) {
  console.log('=== Iniciando Postagem Completa (Instagram + TikTok + Facebook + Shorts) ===\n');

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
  if (queue.dailyCountShorts === undefined) queue.dailyCountShorts = 0;
  const today = hoje();

  if (queue.lastPostDate === today) {
    if (queue.dailyCount >= DAILY_LIMIT_INSTAGRAM && queue.dailyCountTikTok >= DAILY_LIMIT_TIKTOK && queue.dailyCountFacebook >= DAILY_LIMIT_FACEBOOK && queue.dailyCountShorts >= DAILY_LIMIT_SHORTS) {
      console.log('Limite diário de todas as plataformas já foi atingido.');
      return;
    }
  }

  const toPost = [];
  const today2 = hoje();
  if (queue.lastPostDate !== today2) {
    queue.dailyCount = 0;
    queue.dailyCountTikTok = 0;
    queue.dailyCountFacebook = 0;
    queue.dailyCountShorts = 0;
    queue.lastPostDate = today2;
  }
  const pending = queue.videos.filter(v =>
    (!v.postedInstagram || !v.postedTikTok || !v.postedFacebook || !v.postedShorts) && fs.existsSync(v.path)
  );
  const remainingIG = DAILY_LIMIT_INSTAGRAM - queue.dailyCount;
  const remainingTT = DAILY_LIMIT_TIKTOK - queue.dailyCountTikTok;
  const remainingFB = DAILY_LIMIT_FACEBOOK - queue.dailyCountFacebook;
  const remainingSH = DAILY_LIMIT_SHORTS - queue.dailyCountShorts;

  const maxVideosAgendado = maxVideos || Math.max(remainingIG, remainingTT, remainingFB, remainingSH);

  for (const v of pending) {
    const precisaIG = !v.postedInstagram && queue.dailyCount < DAILY_LIMIT_INSTAGRAM;
    const precisaTT = !v.postedTikTok && queue.dailyCountTikTok < DAILY_LIMIT_TIKTOK;
    const precisaFB = !v.postedFacebook && queue.dailyCountFacebook < DAILY_LIMIT_FACEBOOK;
    const precisaSH = !v.postedShorts && (queue.dailyCountShorts || 0) < DAILY_LIMIT_SHORTS;
    if (precisaIG || precisaTT || precisaFB || precisaSH) {
      toPost.push(v);
      if (precisaIG) queue.dailyCount++;
      if (precisaTT) queue.dailyCountTikTok++;
      if (precisaFB) queue.dailyCountFacebook++;
      if (precisaSH) queue.dailyCountShorts++;
    }
    if (toPost.length >= maxVideosAgendado) break;
    if (queue.dailyCount >= DAILY_LIMIT_INSTAGRAM && queue.dailyCountTikTok >= DAILY_LIMIT_TIKTOK && queue.dailyCountFacebook >= DAILY_LIMIT_FACEBOOK && queue.dailyCountShorts >= DAILY_LIMIT_SHORTS) break;
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
    if (!v.postedFacebook) status.push('FB');
    if (!v.postedShorts) status.push('SH');
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

    await page.waitForTimeout(3000);

    if (!video.postedFacebook) {
      try {
        await postToFacebook(browser, video.path);
        video.postedFacebook = true;
        video.facebookDate = new Date().toISOString();
      } catch (err) {
        console.error(`  [Facebook] ERRO: ${err.message}`);
        video.error = video.error ? `${video.error} | Facebook: ${err.message}` : `Facebook: ${err.message}`;
      }
    } else {
      console.log('  [Facebook] Ja postado, pulando...');
    }

    await page.waitForTimeout(3000);

    if (!video.postedShorts) {
      try {
        const shortsPage = await context.newPage();
        await postToShorts(shortsPage, video.path);
        video.postedShorts = true;
        video.shortsDate = new Date().toISOString();
        await shortsPage.close();
      } catch (err) {
        console.error(`  [Shorts] ERRO: ${err.message}`);
        video.error = video.error ? `${video.error} | Shorts: ${err.message}` : `Shorts: ${err.message}`;
      }
    } else {
      console.log('  [Shorts] Ja postado, pulando...');
    }

    if (video.postedInstagram && video.postedTikTok && video.postedFacebook && video.postedShorts) {
      deleteVideoFile(video.path);
    }

    queue.lastPostDate = today;
    saveQueue(queue);

    const postedIG = queue.videos.filter(v => v.postedInstagram).length;
    const postedTT = queue.videos.filter(v => v.postedTikTok).length;
    const postedFB = queue.videos.filter(v => v.postedFacebook).length;
    const postedSH = queue.videos.filter(v => v.postedShorts).length;
    console.log(`\nProgresso: IG ${postedIG}/${queue.videos.length} | TT ${postedTT}/${queue.videos.length} | FB ${postedFB}/${queue.videos.length} | SH ${postedSH}/${queue.videos.length}`);

    if (i < toPost.length - 1) {
      const delay = POST_INTERVAL_MS + Math.round(Math.random() * POST_INTERVAL_RANDOM_MS)
      const delayMin = Math.round(delay / 60000)
      console.log(`\nAguardando ${delayMin} min ate o proximo video...`)
      await new Promise(r => setTimeout(r, delay))
    }
  }

  await page.close();
  await browser.close();

  const totalIG = queue.videos.filter(v => v.postedInstagram).length;
  const totalTT = queue.videos.filter(v => v.postedTikTok).length;
  const totalFB = queue.videos.filter(v => v.postedFacebook).length;
  const totalSH = queue.videos.filter(v => v.postedShorts).length;
  console.log(`\n=== Concluido! IG: ${totalIG} | TT: ${totalTT} | FB: ${totalFB} | SH: ${totalSH} / ${queue.videos.length} videos ===`);

  try { fs.unlinkSync(LOCK_FILE); } catch {}
}

if (require.main === module) {
  const maxVideos = process.argv[2] ? parseInt(process.argv[2], 10) : undefined;
  main(maxVideos).catch(err => {
    console.error('Erro fatal:', err);
    process.exit(1);
  });
}

module.exports = { main, loadQueue, saveQueue, postToInstagram, postToTikTok, postToFacebook, postToShorts };
