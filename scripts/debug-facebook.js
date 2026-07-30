const { chromium } = require('playwright');
const DEBUG_PORT = parseInt(process.env.CHROME_DEBUG_PORT) || 9222;

(async () => {
  const browser = await chromium.connectOverCDP(`http://127.0.0.1:${DEBUG_PORT}`);
  const page = browser.contexts()[0].pages().find(p => p.url().includes('facebook.com'));
  if (!page) { console.log('Sem pagina'); return; }

  await page.goto('https://www.facebook.com/profile.php?id=61592685539474&sk=reels_tab', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(6000);

  // Clica Criar Reel
  const btn = page.locator('div[role="button"]:has-text("Criar reel")').first();
  await btn.click();
  await page.waitForTimeout(8000);

  // Agora inspeciona a pagina apos clicar
  const elements = await page.evaluate(() => {
    const all = document.querySelectorAll('div[role="button"], button, a, input, span[role="button"]');
    return Array.from(all).map(el => ({
      tag: el.tagName,
      text: el.textContent?.trim().substring(0, 60),
      aria: el.getAttribute('aria-label'),
      role: el.getAttribute('role'),
      type: el.getAttribute('type'),
      class: el.className?.substring(0, 40)
    })).filter(el => el.text || el.aria);
  });

  console.log('Elementos apos clicar Criar Reel:');
  const relevant = elements.filter(e => {
    const t = ((e.text || '') + ' ' + (e.aria || '')).toLowerCase();
    return t.includes('carreg') || t.includes('upload') || t.includes('video') || t.includes('reel') || t.includes('criar') || t.includes('create') || t.includes('adicion') || t.includes('add') || t.includes('file') || t.includes('avan') || t.includes('next') || t.includes('post') || t.includes('public') || t.includes('foto');
  });
  relevant.forEach(e => console.log(`  <${e.tag}> text="${e.text}" aria="${e.aria}" role="${e.role}" type=${e.type} class=${e.class}`));

  console.log('\nInputs type=file:');
  const files = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('input[type="file"]')).map(el => ({
      id: el.id, class: el.className?.substring(0, 60)
    }));
  });
  console.log(files.length ? files : 'nenhum');

  await browser.close().catch(() => {});
})();
