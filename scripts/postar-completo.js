const path = require('path');
const fs = require('fs');
const os = require('os');
const net = require('net');
const { spawn } = require('child_process');
const { chromium } = require('playwright');
const notify = require('./notify');

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

// ============================================================
// MULTI-AMBIENTE: futebol (padrao) | motivacao (--profile=motivacao)
// Deve rodar ANTES das constantes de configuracao abaixo.
// ============================================================
const argProfile = (process.argv.slice(2).join(' ') || '').match(/--profile=([A-Za-z0-9_-]+)/);
const PROFILE = (argProfile ? argProfile[1] : (process.env.PROFILE || 'futebol')).toLowerCase();
const IS_MOTIVACAO = PROFILE === 'motivacao';

if (IS_MOTIVACAO) {
  const CIN = (key, fallback) => process.env['MOTIVACAO_' + key] || fallback;
  process.env.CHROME_DEBUG_PORT = CIN('CHROME_DEBUG_PORT', '9223');
  process.env.VIDEOS_DIR = CIN('VIDEOS_DIR', path.join(os.homedir(), 'Downloads', 'videos editados motiv'));
  process.env.QUEUE_FILE = CIN('QUEUE_FILE', 'posts-queue-motivacao.json');
  process.env.LOCK_FILE = CIN('LOCK_FILE', '.posting-motivacao.lock');
  process.env.DEBUG_DIR = CIN('DEBUG_DIR', 'fb_debug-motivacao');
  process.env.KWAI_ENABLED = 'false';
  process.env.INSTAGRAM_DAILY_LIMIT = CIN('INSTAGRAM_DAILY_LIMIT', '5');
  process.env.TIKTOK_DAILY_LIMIT = CIN('TIKTOK_DAILY_LIMIT', '5');
  process.env.FACEBOOK_DAILY_LIMIT = CIN('FACEBOOK_DAILY_LIMIT', '5');
  process.env.SHORTS_DAILY_LIMIT = CIN('SHORTS_DAILY_LIMIT', '5');
  process.env.INSTAGRAM_CAPTION = CIN('INSTAGRAM_CAPTION', '#motivacao #disciplina #foco #mentalidade #desenvolvimentopessoal');
  process.env.TIKTOK_CAPTION = CIN('TIKTOK_CAPTION', '#motivacao #disciplina #foco #mentalidade #desenvolvimentopessoal');
  process.env.FACEBOOK_CAPTION = CIN('FACEBOOK_CAPTION', '#motivacao #disciplina #foco #mentalidade #desenvolvimentopessoal');
  const shortsDefault = '#motivacao #disciplina #foco #mentalidade #desenvolvimentopessoal';
  process.env.YOUTUBE_CAPTION = CIN('YOUTUBE_CAPTION', CIN('SHORTS_CAPTION', shortsDefault));
  process.env.SHORTS_CAPTION = process.env.YOUTUBE_CAPTION;
  process.env.FACEBOOK_PAGE_URL = CIN('FACEBOOK_PAGE_URL', '');
  process.env.YOUTUBE_CHANNEL_ID = CIN('YOUTUBE_CHANNEL_ID', '');
  process.env.INSTAGRAM_ENABLED = CIN('INSTAGRAM_ENABLED', 'false');
  process.env.SHORTS_ENABLED = CIN('SHORTS_ENABLED', 'false');
  process.env.NOTIFICATION_TAG = '💪 MOTIVACAO';
}

function resolveFacebookPageUrl() {
  if (IS_MOTIVACAO && !process.env.MOTIVACAO_FACEBOOK_PAGE_URL) return null;
  return process.env.FACEBOOK_PAGE_URL || 'https://www.facebook.com/profile.php?id=61592685539474';
}

const REELS_VIDEO_DIR = process.env.VIDEOS_DIR || path.join(os.homedir(), 'Downloads', 'FabricaReels');
const QUEUE_FILE = path.join(__dirname, process.env.QUEUE_FILE || 'posts-queue.json');
const DEBUG_PORT = parseInt(process.env.CHROME_DEBUG_PORT) || 9222;
const DAILY_LIMIT_INSTAGRAM = process.env.INSTAGRAM_DAILY_LIMIT !== undefined ? parseInt(process.env.INSTAGRAM_DAILY_LIMIT) : 5;
const DAILY_LIMIT_TIKTOK = process.env.TIKTOK_DAILY_LIMIT !== undefined ? parseInt(process.env.TIKTOK_DAILY_LIMIT) : 5;
const DAILY_LIMIT_FACEBOOK = process.env.FACEBOOK_DAILY_LIMIT !== undefined ? parseInt(process.env.FACEBOOK_DAILY_LIMIT) : 5;

const DAILY_LIMIT_SHORTS = process.env.SHORTS_DAILY_LIMIT !== undefined ? parseInt(process.env.SHORTS_DAILY_LIMIT) : 5;
const POST_INTERVAL_MS = (parseInt(process.env.POST_INTERVAL_MINUTES) || 60) * 60 * 1000;
const POST_INTERVAL_RANDOM_MS = (parseInt(process.env.POST_INTERVAL_RANDOM_MINUTES) || 15) * 60 * 1000;
const FACEBOOK_PAGE_URL = resolveFacebookPageUrl();

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

function getInstagramCaption() {
  return process.env.INSTAGRAM_CAPTION || '#futebol #football #soccer #futboledit #futebolbrasileiro #futebolmundial #reelsfutebol';
}

function loaderTendencias() {
  try {
    const f = path.join(__dirname, 'tendencias-data.json');
    if (!fs.existsSync(f)) return null;
    const data = JSON.parse(fs.readFileSync(f, 'utf-8'));
    return data.current && data.current.byNiche ? data.current : null;
  } catch { return null; }
}

function trendingHashtags(profile, extra) {
  const current = loaderTendencias();
  if (!current || !current.byNiche) return '';
  const r = current.byNiche[profile];
  if (!r || !Array.isArray(r.hashtagsEmAlta) || r.hashtagsEmAlta.length === 0) return '';
  const base = (extra || '').toLowerCase().split(/\s+/).filter((t) => t.startsWith('#'));
  const tags = r.hashtagsEmAlta
    .map((h) => h.tag || '')
    .filter((t) => t && !base.some((b) => b === '#' + t.toLowerCase()) && !/^\d+$/.test(t))
    .slice(0, 3);
  return tags.map((t) => '#' + t).join(' ');
}

function getTikTokCaption() {
  let base = process.env.TIKTOK_CAPTION || '#futebol #football #soccer #futboledit #futebolbrasileiro #footballtiktok #foryou';
  const extra = base.split(/\s+/).slice(0, 5).join(' ');
  const trends = trendingHashtags(PROFILE, extra);
  return trends ? `${extra} ${trends}` : base;
}

function getFacebookCaption() {
  let base = process.env.FACEBOOK_CAPTION || '#futebol #football #soccer #futebolbrasileiro #futboledit';
  const trends = trendingHashtags(PROFILE, base);
  return trends ? `${base} ${trends}` : base;
}

function getShortsCaption() {
  return process.env.YOUTUBE_CAPTION || process.env.SHORTS_CAPTION || '#futebol #football #soccer #futboledit #shorts';
}

const TIKTOK_BLOCK_PATTERNS = [
  /bloquead/i, /blocked/i, /copyright/i, /direitos autorais/i, /viola\w+ (das|de) regras/i,
  /não é possível publicar/i, /upload failed/i, /falha no envio/i, /media upload failed/i,
  /conteúdo não pode ser/i, /this video.*(can't|cannot|not be published)/i, /removido/i,
];

function isTikTokBlockError(message) {
  return TIKTOK_BLOCK_PATTERNS.some((rx) => rx.test(message));
}

function marcarVideobloqueadoTikTok(video, errMessage) {
  if (isTikTokBlockError(errMessage)) {
    video.blockedTikTok = true;
    video.tiktokBlockReason = errMessage;
    console.log('  [TikTok] Video marcado como BLOQUEADO pela plataforma. Sera pulado nas proximas execucoes.');
    return true;
  }
  video.tiktokRetries = (video.tiktokRetries || 0) + 1;
  if (video.tiktokRetries >= 2) {
    video.blockedTikTok = true;
    video.tiktokBlockReason = `Falhou ${video.tiktokRetries}x seguidas: ${errMessage}`;
    console.log('  [TikTok] Video falhou 2x seguidas. Marcado como bloqueado para nao travar a fila.');
    return true;
  }
  console.log(`  [TikTok] Falha ${video.tiktokRetries}/2, sera retentado na proxima execucao.`);
  return false;
}

async function screenshot(page, label) {
  try {
    const dir = process.env.DEBUG_DIR
      ? path.join(__dirname, process.env.DEBUG_DIR)
      : path.join(REELS_VIDEO_DIR, 'debug');
    try { require('fs').mkdirSync(dir, { recursive: true }); } catch {}
    await page.screenshot({ path: `${dir}\\${label}.png`, fullPage: false, timeout: 8000 });
    console.log(`  [Debug] Screenshot salvo: ${label}.png`);
  } catch (e) {
    console.log(`  [Debug] Screenshot ignorado (${label}): ${e.message}`);
  }
}

async function fecharPopupsInstagram(page) {
  for (let i = 0; i < 3; i++) {
    try {
      const btn = page.locator('div[role="dialog"] div[role="button"]:has-text("Agora não"), div[role="dialog"] div[role="button"]:has-text("Not now"), div[role="dialog"] button:has-text("Agora não"), div[role="dialog"] button:has-text("Not now")').first();
      if (await btn.isVisible({ timeout: 3000 }).catch(() => false)) {
        await btn.click({ force: true }).catch(() => btn.evaluate(el => el.click()));
        console.log('  [Instagram] Popup fechado');
        await page.waitForTimeout(1500);
        continue;
      }
    } catch {}
    try {
      const closeBtn = page.locator('div[role="dialog"] svg[aria-label="Fechar"], div[role="dialog"] svg[aria-label="Close"]').first();
      if (await closeBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
        await closeBtn.click({ force: true }).catch(() => closeBtn.evaluate(el => el.click()));
        console.log('  [Instagram] Dialog fechado');
        await page.waitForTimeout(1500);
        continue;
      }
    } catch {}
    break;
  }
}

async function postToInstagram(page, videoPath) {
  console.log(`  [Instagram] Postando: ${path.basename(videoPath)}`);

  await page.goto('https://www.instagram.com', { waitUntil: 'networkidle', timeout: 60000 });
  await page.waitForTimeout(3000);

  await fecharPopupsInstagram(page);

  await page.locator('svg[aria-label="Novo post"], svg[aria-label="New post"]').first().click({ force: true }).catch(() => page.locator('svg[aria-label="Novo post"], svg[aria-label="New post"]').first().evaluate(el => el.click()));
  await page.waitForTimeout(2000);

  const fileInput = page.locator('input[type="file"]').first();
  try {
    await fileInput.waitFor({ state: 'attached', timeout: 15000 });
  } catch {
    console.log('  [Instagram] Input de arquivo nao apareceu, tentando clicar em "Selecionar do computador"...');
    await page.locator('div[role="button"]:has-text("Selecionar do computador"), div[role="button"]:has-text("Select from computer"), span:has-text("Selecionar do computador")').first().click({ force: true }).catch(() => {});
    await fileInput.waitFor({ state: 'attached', timeout: 15000 });
  }
  await fileInput.setInputFiles(videoPath);
  console.log('  [Instagram] Video enviado, aguardando processamento...');
  await page.waitForTimeout(15000);

  await page.locator('div[role="button"]:has-text("Avançar"), div[role="button"]:has-text("Next")').first().click({ timeout: 30000, force: true }).catch(() => page.locator('div[role="button"]:has-text("Avançar"), div[role="button"]:has-text("Next")').first().evaluate(el => el.click()));
  console.log('  [Instagram] Avancou para capa/edicao');
  await page.waitForTimeout(4000);

  await page.locator('div[role="button"]:has-text("Avançar"), div[role="button"]:has-text("Next")').first().click({ timeout: 30000, force: true }).catch(() => page.locator('div[role="button"]:has-text("Avançar"), div[role="button"]:has-text("Next")').first().evaluate(el => el.click()));
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
      const text = (document.body.innerText || '').replace(/\s+/g, ' ').toLowerCase();
      return text.includes('seu reel foi compartilhado') || text.includes('seu reels foi compartilhado') || text.includes('reel compartilhado com sucesso') || text.includes('reel foi compartilhado');
    }, { timeout: 180000 });
    console.log('  [Instagram] Reel compartilhado com sucesso!');

    const concluir = page.locator('button:has-text("Concluir"), a:has-text("Concluir"), div[role="button"]:has-text("Concluir"), span:has-text("Concluir")').first();
    if (await concluir.isVisible({ timeout: 5000 }).catch(() => false)) {
      await concluir.click();
      console.log('  [Instagram] Clicou em Concluir');
      await page.waitForTimeout(2000);
    }
  } catch {
    await screenshot(page, 'ig-confirmacao-falha');
    await page.waitForTimeout(10000);
    throw new Error('Instagram: confirmação "Seu reel foi compartilhado" não apareceu. Video NAO confirmado como postado.');
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

async function digitarLegendaTikTok(page, captionBox, caption) {
  // Digita CADA hashtag uma por uma e clica na sugestao que aparece logo abaixo do campo
  // (dropdown .hashtag-suggestion-item / .mention-list-popover). Clicar na sugestao faz a
  // hashtag virar chip/link real (span.mention) -> indexada nas hashtags -> views.
  // Digitar tudo de uma vez deixa apenas texto plano, que o TikTok NAO conta como hashtag.
  const tokens = caption.split(/\s+/).filter(Boolean);
  for (const token of tokens) {
    if (token.startsWith('#')) {
      await page.keyboard.type(token, { delay: 50 });
      let picked = false;
      for (let attempt = 0; attempt < 8; attempt++) {
        const item = page.locator('div[role="option"][class*="hashtag-suggestion-item"]').first();
        if ((await item.count().catch(() => 0)) > 0) {
          await item.click({ timeout: 4000 }).catch(() => item.evaluate((el) => el.click()));
          picked = true;
          break;
        }
        await page.waitForTimeout(500);
      }
      if (!picked) await page.keyboard.type(' ', { delay: 50 });
      await page.waitForTimeout(400);
    } else {
      await page.keyboard.type(token, { delay: 50 });
      await page.keyboard.type(' ', { delay: 50 });
    }
  }
  await page.waitForTimeout(1500);
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
  await captionBox.waitFor({ state: 'visible', timeout: 30000 });
  await captionBox.click();
  await page.waitForTimeout(800);
  await page.keyboard.press('Control+A');
  await page.waitForTimeout(300);
  await page.keyboard.press('Backspace');
  await page.waitForTimeout(600);
  await digitarLegendaTikTok(page, captionBox, getTikTokCaption());
  await screenshot(page, '3b-tiktok-legenda-digitada');

  const textoCampo = (await captionBox.innerText().catch(() => '')).replace(/\s+/g, ' ');
  const esperado = getTikTokCaption().replace(/\s+/g, ' ').slice(0, 40);
  if (!textoCampo.includes(esperado)) {
    console.log(`  [TikTok] Campo: "${textoCampo.slice(0, 120)}"`);
    throw new Error(`TikTok: legenda NAO registrada no editor ("${textoCampo.slice(0, 60)}") - pulando video para nao publicar sem legenda`);
  }
  const chips = await captionBox.evaluate((el) => Array.from(el.querySelectorAll('span[class*="mention"], a[href*="tag"]')).length).catch(() => 0);
  if (chips === 0) {
    throw new Error('TikTok: nenhuma hashtag virou chip/link (span.mention) - legenda nao "selecionada", pulando para nao postar sem hashtags');
  }
  console.log(`  [TikTok] Legenda digitada e CONFIRMADA: ${chips} hashtag(s) viraram chip/link`);
  await page.waitForTimeout(1000);

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
    if (!FACEBOOK_PAGE_URL) throw new Error('Facebook: configure MOTIVACAO_FACEBOOK_PAGE_URL no .env antes de postar (perfil motivacao)');
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
  if (!FACEBOOK_PAGE_URL) throw new Error('Facebook: configure MOTIVACAO_FACEBOOK_PAGE_URL no .env antes de postar (perfil motivacao)');
  await page.goto(FACEBOOK_PAGE_URL + '&sk=reels_tab', { waitUntil: 'domcontentloaded', timeout: 30000 });
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
      await btnNext.click({ force: true }).catch(() => btnNext.evaluate(el => el.click()));
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
    await btnPost.click({ force: true }).catch(() => btnPost.evaluate(el => el.click()));
    console.log('  [Facebook] Postar clicado!');
  } else {
    throw new Error('Facebook: botao Postar nao encontrado. Video NAO postado.');
  }

  console.log('  [Facebook] Aguardando publicacao (30s)...');
  await page.waitForTimeout(30000);

  const dialogFechado = await page.evaluate(() => {
    const txt = document.body.innerText;
    return txt.includes('Criar reel') || txt.includes('Publicado com sucesso');
  }).catch(() => false);

  if (!dialogFechado) {
    console.log('  [Facebook] Aviso: nao foi possivel confirmar o dialogo fechado');
  }

  try { await page.goto(origUrl, { waitUntil: 'domcontentloaded', timeout: 15000 }).catch(() => {}); } catch {}

  console.log('  [Facebook] Reel postado com sucesso!');
  return true;
}

async function postToShorts(page, videoPath) {
  console.log(`  [Shorts] Postando: ${path.basename(videoPath)}`);

  const studioUrl = process.env.YOUTUBE_CHANNEL_ID
    ? `https://studio.youtube.com/channel/${process.env.YOUTUBE_CHANNEL_ID}/videos`
    : 'https://studio.youtube.com';
  await page.goto(studioUrl, { waitUntil: 'load', timeout: 60000 });
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

// ============================================================
// CONEXAO RESILIENTE AO CHROME (anti-travamento)
// connectOverCDP sem timeout trava a rodada para sempre quando o
// Chrome morre ou nao responde. Aqui: espera a porta, abre o Chrome
// pelo launcher se preciso, e limita a conexao em 45s por tentativa.
// ============================================================
function isPortOpen(port, timeoutMs = 1500) {
  return new Promise((resolve) => {
    const s = net.connect(port, '127.0.0.1');
    s.setTimeout(timeoutMs);
    s.once('connect', () => { s.destroy(); resolve(true); });
    s.once('timeout', () => { s.destroy(); resolve(false); });
    s.once('error', () => { s.destroy(); resolve(false); });
  });
}

async function ensureChromeUp(port) {
  if (await isPortOpen(port)) return true;
  console.log(`  [Chrome] Porta ${port} fechada, iniciando Chrome (${
    IS_MOTIVACAO ? 'perfil motivacao' : 'perfil futebol'})...`);
  try {
    // Lanca SEM janela de terminal (launch-chrome.js mata o perfil antigo e sobe oculto)
    const launcher = path.join(__dirname, 'launch-chrome.js');
    spawn('node', [launcher, `--profile=${PROFILE}`], {
      cwd: __dirname,
      windowsHide: true,
      stdio: 'ignore',
      detached: true,
    }).unref();
  } catch (e) {
    console.log(`  [Chrome] Falha ao iniciar launcher: ${e.message}`);
  }
  for (let i = 0; i < 12; i++) {
    await new Promise((r) => setTimeout(r, 2500));
    if (await isPortOpen(port)) return true;
  }
  return false;
}

async function connectChrome(port) {
  let lastErr = null;
  for (let attempt = 1; attempt <= 3; attempt++) {
    if (!(await ensureChromeUp(port))) {
      lastErr = new Error(`Chrome nao abriu na porta ${port} apos 30s de espera (tentativa ${attempt}/3)`);
      console.log(`  [Chrome] ${lastErr.message}`);
      await new Promise((r) => setTimeout(r, 8000));
      continue;
    }
    try {
      let timer;
      const timeout = new Promise((_, rej) => {
        timer = setTimeout(() => rej(new Error(`Timeout (45s) conectando ao Chrome na porta ${port}`)), 45000);
      });
      timer.unref();
      const browser = await Promise.race([
        chromium.connectOverCDP(`http://127.0.0.1:${port}`),
        timeout,
      ]);
      return browser;
    } catch (err) {
      lastErr = err;
      console.log(`  [Chrome] Tentativa ${attempt}/3 falhou: ${err.message}`);
      await new Promise((r) => setTimeout(r, 8000));
    }
  }
  throw lastErr || new Error('Nao foi possivel conectar ao Chrome');
}

async function main(maxVideos) {
  console.log(`=== Iniciando Postagem Completa [${PROFILE.toUpperCase()}] (TikTok + Facebook + Shorts) ===\n`);

  const LOCK_FILE = path.join(__dirname, process.env.LOCK_FILE || '.posting.lock');

  // Watchdog: nunca deixa uma rodada travar o agendador para sempre.
  const RUN_WATCHDOG_MS = 4 * 60 * 60 * 1000;
  const watchdog = setTimeout(() => {
    console.log(`Timeout total da rodada (${RUN_WATCHDOG_MS / 60000}min) atingido. Encerrando para nao travar o agendador.`);
    process.exit(1);
  }, RUN_WATCHDOG_MS);
  watchdog.unref();

  function removeLock() {
    try { if (fs.existsSync(LOCK_FILE)) fs.unlinkSync(LOCK_FILE); } catch {}
  }

  function pidAlive(pid) {
    try { process.kill(pid, 0); return true; } catch { return false; }
  }

  function tryAcquireLock() {
    try {
      const fd = fs.openSync(LOCK_FILE, 'wx');
      fs.writeSync(fd, String(process.pid));
      fs.closeSync(fd);
      return true;
    } catch (err) {
      if (err.code !== 'EEXIST') return true;
      const lockAge = Date.now() - fs.statSync(LOCK_FILE).mtimeMs;
      let stalePid = false;
      try {
        const lockPid = parseInt(fs.readFileSync(LOCK_FILE, 'utf-8').trim(), 10);
        if (lockPid && !pidAlive(lockPid)) stalePid = true;
      } catch {}
      if (lockAge >= 300000 || stalePid) {
        try { fs.unlinkSync(LOCK_FILE); } catch {}
        try {
          const fd = fs.openSync(LOCK_FILE, 'wx');
          fs.writeSync(fd, String(process.pid));
          fs.closeSync(fd);
          return true;
        } catch (err2) {
          if (err2.code === 'EEXIST') return false;
          return true;
        }
      }
      return false;
    }
  }

  process.on('exit', removeLock);
  process.on('SIGINT', () => { removeLock(); process.exit(0); });
  process.on('SIGTERM', () => { removeLock(); process.exit(0); });

  if (!tryAcquireLock()) {
    console.log('Ja existe uma execucao em andamento (lock), pulando.');
    return;
  }

  const queue = loadQueue();
  if (queue.dailyCountShorts === undefined) queue.dailyCountShorts = 0;
  const today = hoje();

  const IG_ENABLED = process.env.INSTAGRAM_ENABLED === 'true';
  const SH_ENABLED = process.env.SHORTS_ENABLED !== 'false';

  if (queue.lastPostDate === today) {
    if ((IG_ENABLED ? queue.dailyCount >= DAILY_LIMIT_INSTAGRAM : true) && queue.dailyCountTikTok >= DAILY_LIMIT_TIKTOK && queue.dailyCountFacebook >= DAILY_LIMIT_FACEBOOK && (SH_ENABLED ? queue.dailyCountShorts >= DAILY_LIMIT_SHORTS : true)) {
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
    (v.attemptDate || '') !== today2 &&
    ((IG_ENABLED && !v.postedInstagram) || !v.postedTikTok || !v.postedFacebook || (SH_ENABLED && !v.postedShorts)) &&
    !v.blockedTikTok && fs.existsSync(v.path)
  );
  const remainingIG = IG_ENABLED ? DAILY_LIMIT_INSTAGRAM - queue.dailyCount : 0;
  const remainingTT = DAILY_LIMIT_TIKTOK - queue.dailyCountTikTok;
  const remainingFB = DAILY_LIMIT_FACEBOOK - queue.dailyCountFacebook;
  const remainingSH = SH_ENABLED ? DAILY_LIMIT_SHORTS - queue.dailyCountShorts : 0;

  const maxVideosAgendado = maxVideos || Math.max(remainingIG, remainingTT, remainingFB, remainingSH);

  let selIG = 0, selTT = 0, selFB = 0, selSH = 0;
  for (const v of pending) {
    const precisaIG = IG_ENABLED && !v.postedInstagram && selIG < DAILY_LIMIT_INSTAGRAM;
    const precisaTT = !v.postedTikTok && selTT < DAILY_LIMIT_TIKTOK;
    const precisaFB = !v.postedFacebook && selFB < DAILY_LIMIT_FACEBOOK;
    const precisaSH = SH_ENABLED && !v.postedShorts && selSH < DAILY_LIMIT_SHORTS;
    if (precisaIG || precisaTT || precisaFB || precisaSH) {
      toPost.push(v);
      if (precisaIG) selIG++;
      if (precisaTT) selTT++;
      if (precisaFB) selFB++;
      if (precisaSH) selSH++;
    }
    if (toPost.length >= maxVideosAgendado) break;
    if ((IG_ENABLED ? selIG >= DAILY_LIMIT_INSTAGRAM : true) && selTT >= DAILY_LIMIT_TIKTOK && selFB >= DAILY_LIMIT_FACEBOOK && (SH_ENABLED ? selSH >= DAILY_LIMIT_SHORTS : true)) break;
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

  console.log(`\nConectando ao Chrome (porta ${DEBUG_PORT})...`);
  const browser = await connectChrome(DEBUG_PORT);
  const contexts = browser.contexts();
  const context = contexts[0] || await browser.newContext();
  const page = await context.newPage();

  console.log('Chrome conectado com sucesso!\n');

  let totalErrors = 0;

  for (let i = 0; i < toPost.length; i++) {
    const video = toPost[i];
    console.log(`\n--- [${i + 1}/${toPost.length}] ${video.filename} ---`);

    const results = {};

    if (IG_ENABLED && !video.postedInstagram) {
      try {
        const igPage = await context.newPage();
        await postToInstagram(igPage, video.path);
        video.postedInstagram = true;
        video.instagramDate = new Date().toISOString();
        queue.dailyCount++;
        await igPage.close();
        results.instagram = true;
      } catch (err) {
        console.error(`  [Instagram] ERRO: ${err.message}`);
        video.error = video.error ? `${video.error} | Instagram: ${err.message}` : `Instagram: ${err.message}`;
        results.instagram = err.message;
        totalErrors++;
      }
    } else {
      results.instagram = false;
    }

    await page.waitForTimeout(3000);

    if (!video.postedTikTok) {
      try {
        await postToTikTok(page, video.path);
        video.postedTikTok = true;
        video.tiktokDate = new Date().toISOString();
        queue.dailyCountTikTok++;
        results.tiktok = true;
      } catch (err) {
        console.error(`  [TikTok] ERRO: ${err.message}`);
        video.error = video.error ? `${video.error} | TikTok: ${err.message}` : `TikTok: ${err.message}`;
        results.tiktok = err.message;
        totalErrors++;
        marcarVideobloqueadoTikTok(video, err.message);
      }
    } else {
      results.tiktok = false;
    }

    await page.waitForTimeout(3000);

    if (!video.postedFacebook) {
      try {
        await postToFacebook(browser, video.path);
        video.postedFacebook = true;
        video.facebookDate = new Date().toISOString();
        queue.dailyCountFacebook++;
        results.facebook = true;
      } catch (err) {
        console.error(`  [Facebook] ERRO: ${err.message}`);
        video.error = video.error ? `${video.error} | Facebook: ${err.message}` : `Facebook: ${err.message}`;
        results.facebook = err.message;
        totalErrors++;
      }
    } else {
      results.facebook = false;
    }

    await page.waitForTimeout(3000);

    if (SH_ENABLED && !video.postedShorts) {
      try {
        const shortsPage = await context.newPage();
        await postToShorts(shortsPage, video.path);
        video.postedShorts = true;
        video.shortsDate = new Date().toISOString();
        queue.dailyCountShorts++;
        await shortsPage.close();
        results.shorts = true;
      } catch (err) {
        console.error(`  [Shorts] ERRO: ${err.message}`);
        video.error = video.error ? `${video.error} | Shorts: ${err.message}` : `Shorts: ${err.message}`;
        results.shorts = err.message;
        totalErrors++;
      }
    } else {
      results.shorts = false;
    }

    video.attemptDate = today;

    queue.lastPostDate = today;
    saveQueue(queue);

    await notify.notifyVideoPosted(video, results);

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

  await page.close().catch(() => {});

  const totalIG = queue.videos.filter(v => v.postedInstagram).length;
  const totalTT = queue.videos.filter(v => v.postedTikTok).length;
  const totalFB = queue.videos.filter(v => v.postedFacebook).length;
  const totalSH = queue.videos.filter(v => v.postedShorts).length;
  console.log(`\n=== Concluido! IG: ${totalIG} | TT: ${totalTT} | FB: ${totalFB} | SH: ${totalSH} / ${queue.videos.length} videos ===`);

  await notify.notifyRunSummary(toPost.length, totalErrors, { Instagram: totalIG, TikTok: totalTT, Facebook: totalFB, Shorts: totalSH });

  try { fs.unlinkSync(LOCK_FILE); } catch {}
}

if (require.main === module) {
  const maxVideos = process.argv[2] ? parseInt(process.argv[2], 10) : undefined; // eslint-disable-line no-unused-vars
  main(maxVideos).catch(async (err) => {
    console.error('Erro fatal:', err);
    await notify.notifyError(err.message);
    process.exit(1);
  });
}

function describeAmbiente() {
  return {
    profile: PROFILE,
    motivacao: IS_MOTIVACAO,
    debugPort: DEBUG_PORT,
    videosDir: REELS_VIDEO_DIR,
    queueFile: QUEUE_FILE,
    lockFile: path.join(__dirname, process.env.LOCK_FILE || '.posting.lock'),
    kwaiEnabled: process.env.KWAI_ENABLED !== 'false',
    facebookPageUrl: FACEBOOK_PAGE_URL,
    youtubeChannelId: process.env.YOUTUBE_CHANNEL_ID || ''
  };
}

module.exports = { main, loadQueue, saveQueue, postToInstagram, postToTikTok, postToFacebook, postToShorts, describeAmbiente, PROFILE, IS_MOTIVACAO };
