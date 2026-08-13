const path = require('path');
const fs = require('fs');
const { chromium } = require('playwright');

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
      if (key && !process.env[key]) process.env[key] = val;
    }
  }
} catch (e) {}

const QUEUE_FILE = path.join(__dirname, 'posts-queue.json');
const DEBUG_PORT = parseInt(process.env.CHROME_DEBUG_PORT) || 9222;
const YOUTUBE_CAPTION = process.env.YOUTUBE_CAPTION || process.env.SHORTS_CAPTION || '#futebol #football #soccer #futboledit #shorts';

function loadQueue() {
  if (!fs.existsSync(QUEUE_FILE)) { console.log('Fila vazia.'); process.exit(0); }
  return JSON.parse(fs.readFileSync(QUEUE_FILE, 'utf-8'));
}
function saveQueue(queue) {
  fs.writeFileSync(QUEUE_FILE, JSON.stringify(queue, null, 2));
}

async function screenshot(page, label) {
  try {
    const dir = path.join(__dirname, '..', 'videos', 'debug');
    fs.mkdirSync(dir, { recursive: true });
    await page.screenshot({ path: path.join(dir, `${label}.png`), fullPage: false });
  } catch {}
}

async function clickVisible(page, selectors, timeout = 3000) {
  for (const sel of selectors) {
    const el = page.locator(sel).first();
    if (await el.isVisible({ timeout }).catch(() => false)) {
      await el.click();
      return true;
    }
  }
  return false;
}

async function main() {
  const queue = loadQueue();
  const video = queue.videos.find(v => !v.postedShorts && fs.existsSync(v.path));
  if (!video) { console.log('Nenhum video pendente para YouTube.'); return; }
  console.log(`Postando: ${video.filename}`);

  const browser = await chromium.connectOverCDP(`http://127.0.0.1:${DEBUG_PORT}`);
  const context = browser.contexts()[0];
  let page = context.pages().find(p => p.url().includes('studio.youtube'));
  if (!page) {
    page = await context.newPage();
    await page.goto('https://studio.youtube.com', { waitUntil: 'load', timeout: 60000 });
    await page.waitForTimeout(5000);
  }
  await page.waitForTimeout(3000);
  console.log('YouTube Studio carregado');

  try {
    await clickVisible(page, ['ytcp-button#create-icon', 'ytcp-button:has-text("Criar")', 'ytcp-button:has-text("Create")'], 10000);
    await page.waitForTimeout(3000);
    console.log('Create clicado');

    await clickVisible(page, ['ytcp-ve:has-text("Enviar vídeos")', 'ytcp-ve:has-text("Upload videos")', 'tp-yt-paper-item:has-text("Upload")'], 5000);
    await page.waitForTimeout(3000);

    await screenshot(page, '1-antes-upload');

    const fileInput = page.locator('input[type="file"]').first();
    await fileInput.waitFor({ state: 'attached', timeout: 30000 }).catch(() => {});
    await page.waitForTimeout(1000);
    await fileInput.setInputFiles(video.path);
    console.log('Video enviado! Aguardando processamento...');
    await page.waitForTimeout(30000);

    await screenshot(page, '2-pos-upload');

    await page.waitForTimeout(3000);
    const titleEl = page.locator('#title-textarea').first();
    await titleEl.waitFor({ state: 'visible', timeout: 60000 }).catch(() => {});
    if (await titleEl.isVisible({ timeout: 3000 }).catch(() => false)) {
      const caption = YOUTUBE_CAPTION;
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
      console.log(`Titulo: ${caption.substring(0, 40)}...`);
      await page.waitForTimeout(2000);
    }

    await screenshot(page, '3-titulo');

    await clickVisible(page, [
      'tp-yt-paper-radio-button[name="VIDEO_MADE_FOR_KIDS_NOT_MFK"]',
      '[name="VIDEO_MADE_FOR_KIDS_NOT_MFK"]'
    ], 5000);
    console.log('Kids: Nao e conteudo para criancas');
    await page.waitForTimeout(1000);

    await screenshot(page, '4-kids');

    let nextStep = 1;
    while (nextStep <= 3) {
      const found = await clickVisible(page, [
        '#next-button',
        'ytcp-button#next-button',
        'ytcp-button:has-text("Próxima")',
        'ytcp-button:has-text("Next")'
      ], 5000);
      if (found) {
        console.log(`Proximo ${nextStep} clicado`);
        await page.waitForTimeout(4000);
        await screenshot(page, `5-next-${nextStep}`);
        nextStep++;
      } else {
        break;
      }
    }

    await screenshot(page, '6-visibilidade');

    await clickVisible(page, [
      'tp-yt-paper-radio-button[name="PUBLIC"]',
      '[name="PUBLIC"]',
      'tp-yt-paper-radio-button:has-text("Público")',
      'tp-yt-paper-radio-button:has-text("Public")'
    ], 3000);
    await page.waitForTimeout(1000);

    await screenshot(page, '7-antes-publicar');

    const published = await clickVisible(page, [
      '#done-button',
      'ytcp-button#done-button',
      'ytcp-button:has-text("Publicar")',
      'ytcp-button:has-text("Publish")'
    ], 5000);

    if (!published) {
      await screenshot(page, '8-sem-publicar');
      throw new Error('Botao Publicar nao encontrado');
    }

    console.log('Publicar clicado! Aguardando...');
    await page.waitForTimeout(30000);
    await screenshot(page, '9-pos-publicar');

    video.postedShorts = true;
    video.shortsDate = new Date().toISOString();
    if (video.error && (video.error.includes('Shorts') || video.error.includes('YouTube'))) delete video.error;
    saveQueue(queue);
    console.log('Video postado no YouTube!');

  } catch (err) {
    console.error('Erro:', err.message);
    await screenshot(page, 'erro').catch(() => {});
    video.error = video.error ? `${video.error} | YouTube: ${err.message}` : `YouTube: ${err.message}`;
    saveQueue(queue);
  }
}

main().catch(err => { console.error('Erro fatal:', err); process.exit(1); });
