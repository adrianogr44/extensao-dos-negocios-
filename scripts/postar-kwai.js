const path = require('path');
const fs = require('fs');
const { chromium } = require('playwright');

const QUEUE_FILE = path.join(__dirname, 'posts-queue.json');
const DEBUG_PORT = parseInt(process.env.CHROME_DEBUG_PORT) || 9222;
const KWAI_CAPTION = process.env.KWAI_CAPTION || '#futebol #football #futebolbrasileiro #gol #jogadas';

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
    console.log(`  [Debug] Screenshot: ${label}.png`);
  } catch {}
}

async function main() {
  const queue = loadQueue();
  const video = queue.videos.find(v => !v.postedKwai && fs.existsSync(v.path));
  if (!video) { console.log('Nenhum video pendente para Kwai.'); return; }
  console.log(`Postando: ${video.filename}`);

  const browser = await chromium.connectOverCDP(`http://127.0.0.1:${DEBUG_PORT}`);
  const context = browser.contexts()[0];
  const page = await context.newPage();

  try {
    await page.goto('https://www.kwai.com/creators/create', { waitUntil: 'load', timeout: 60000 }).catch(() => {});
    await page.waitForTimeout(8000);
    console.log(`Kwai carregado: ${page.url().substring(0, 80)}`);

    await screenshot(page, '01-kwai-inicio');

    const fileInput = page.locator('input[type="file"]').first();
    if (await fileInput.isVisible({ timeout: 10000 }).catch(() => false)) {
      await fileInput.setInputFiles(video.path);
      console.log('Video enviado!');
      await page.waitForTimeout(25000);
    } else {
      const uploadBtn = page.locator('div[role="button"]:has-text("Upload"), div[role="button"]:has-text("Carregar"), div[role="button"]:has-text("Enviar"), button:has-text("Upload"), button:has-text("Carregar")').first();
      if (await uploadBtn.isVisible({ timeout: 8000 }).catch(() => false)) {
        const [fc] = await Promise.all([
          page.waitForEvent('filechooser', { timeout: 10000 }).catch(() => null),
          uploadBtn.click()
        ]);
        if (fc) {
          await fc.setFiles(video.path);
          console.log('Video enviado via filechooser!');
          await page.waitForTimeout(25000);
        } else {
          throw new Error('Filechooser nao abriu');
        }
      } else {
        throw new Error('Nao foi possivel encontrar input file ou botao de upload');
      }
    }

    await screenshot(page, '02-kwai-pos-upload');

    const captionBox = page.locator('div[contenteditable="true"], textarea, input[type="text"]').first();
    if (await captionBox.isVisible({ timeout: 10000 }).catch(() => false)) {
      await captionBox.click();
      await page.waitForTimeout(500);
      await captionBox.fill(KWAI_CAPTION);
      console.log('Legenda inserida');
      await page.waitForTimeout(2000);
    }

    await screenshot(page, '03-kwai-legenda');

    const publishBtn = page.locator('button:has-text("Publicar"), button:has-text("Publish"), button:has-text("Compartilhar"), button:has-text("Share")').first();
    if (await publishBtn.isVisible({ timeout: 10000 }).catch(() => false)) {
      await publishBtn.click();
      console.log('Publicar clicado!');
    }

    console.log('Aguardando publicacao (30s)...');
    await page.waitForTimeout(30000);

    await screenshot(page, '04-kwai-pos-publicar');

    video.postedKwai = true;
    video.kwaiDate = new Date().toISOString();
    if (video.error && video.error.includes('Kwai')) delete video.error;
    saveQueue(queue);
    console.log('Video postado no Kwai!');

  } catch (err) {
    console.error('Erro:', err.message);
    await screenshot(page, 'erro-kwai').catch(() => {});
    video.error = video.error ? `${video.error} | Kwai: ${err.message}` : `Kwai: ${err.message}`;
    saveQueue(queue);
  } finally {
    await page.close().catch(() => {});
  }
}

main().catch(err => { console.error('Erro fatal:', err); process.exit(1); });
