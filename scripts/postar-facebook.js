const path = require('path');
const fs = require('fs');
const { chromium } = require('playwright');

const QUEUE_FILE = path.join(__dirname, 'posts-queue.json');
const DEBUG_PORT = parseInt(process.env.CHROME_DEBUG_PORT) || 9222;
const FACEBOOK_CAPTION = process.env.FACEBOOK_CAPTION || '#futebol #football #soccer #futebolbrasileiro #futboledit';

function loadQueue() {
  if (!fs.existsSync(QUEUE_FILE)) { console.log('Fila vazia.'); process.exit(0); }
  return JSON.parse(fs.readFileSync(QUEUE_FILE, 'utf-8'));
}
function saveQueue(queue) {
  fs.writeFileSync(QUEUE_FILE, JSON.stringify(queue, null, 2));
}

async function main() {
  const queue = loadQueue();
  const video = queue.videos.find(v => !v.postedFacebook && fs.existsSync(v.path));
  if (!video) { console.log('Nenhum video pendente.'); return; }
  console.log(`Postando: ${video.filename}`);

  const browser = await chromium.connectOverCDP(`http://127.0.0.1:${DEBUG_PORT}`);
  const page = browser.contexts()[0].pages().find(p => p.url().includes('facebook.com'));
  if (!page) { console.log('Nenhuma pagina Facebook encontrada.'); return; }

  try {
    await page.goto('https://www.facebook.com/profile.php?id=61592685539474&sk=reels_tab', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(6000);
    console.log('Pagina carregada');

    // 1. Clica "Criar reel"
    await page.locator('div[role="button"]:has-text("Criar reel")').first().click();
    console.log('Criar Reel clicado');
    await page.waitForTimeout(5000);

    // 2. Clica "Carregar" (Carregar video para reel)
    await page.locator('div[role="button"]:has-text("Carregar")').first().click();
    console.log('Carregar clicado');
    await page.waitForTimeout(3000);

    // 3. Encontra input file e envia o video
    const fileInput = page.locator('input[type="file"]').first();
    if (await fileInput.isVisible({ timeout: 5000 }).catch(() => false)) {
      await fileInput.setInputFiles(video.path);
      console.log('Video enviado!');
      await page.waitForTimeout(25000);
    } else {
      // Tenta usar filechooser event
      const [fileChooser] = await Promise.all([
        page.waitForEvent('filechooser', { timeout: 5000 }).catch(() => null),
        page.locator('div[role="button"]:has-text("Carregar")').first().click().catch(() => {})
      ]);
      if (fileChooser) {
        await fileChooser.setFiles(video.path);
        console.log('Video enviado via filechooser!');
        await page.waitForTimeout(25000);
      } else {
        console.log('Nao foi possivel enviar o video');
        video.error = 'Facebook: could not upload video';
        saveQueue(queue);
        return;
      }
    }

    // 4. Avancar (2x)
    for (let i = 0; i < 2; i++) {
      const btnNext = page.locator('[aria-label="Avançar"]:visible, [aria-label="Next"]:visible').first();
      if (await btnNext.isVisible({ timeout: 10000 }).catch(() => false)) {
        await btnNext.click();
        console.log(`Avançar ${i + 1}`);
        await page.waitForTimeout(5000);
      }
    }

    // 5. Legenda
    const captionBox = page.locator('div[contenteditable="true"]').first();
    if (await captionBox.isVisible({ timeout: 10000 }).catch(() => false)) {
      await captionBox.click();
      await page.waitForTimeout(300);
      await captionBox.fill(FACEBOOK_CAPTION);
      console.log('Legenda inserida');
      await page.waitForTimeout(2000);
    }

    // 6. Postar
    const btnPost = page.locator('[aria-label="Postar"]:visible, [aria-label="Publish"]:visible').first();
    if (await btnPost.isVisible({ timeout: 10000 }).catch(() => false)) {
      await btnPost.click();
      console.log('Postar clicado!');
    }

    console.log('Aguardando publicacao (30s)...');
    await page.waitForTimeout(30000);

    video.postedFacebook = true;
    video.facebookDate = new Date().toISOString();
    if (video.error && video.error.includes('Facebook')) delete video.error;
    saveQueue(queue);
    console.log('Video postado com sucesso!');

  } catch (err) {
    console.error('Erro:', err.message);
    video.error = video.error ? `${video.error} | Facebook: ${err.message}` : `Facebook: ${err.message}`;
    saveQueue(queue);
  }
}

main().catch(err => { console.error('Erro fatal:', err); process.exit(1); });
