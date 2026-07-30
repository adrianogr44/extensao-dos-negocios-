const { chromium } = require('playwright');
(async () => {
  const b = await chromium.connectOverCDP('http://127.0.0.1:9222');
  const page = b.contexts()[0].pages().find(p => p.url().includes('studio.youtube'));
  if (!page) { console.log('Sem YouTube Studio'); return; }
  console.log('URL:', page.url().substring(0, 80));
  const els = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('[contenteditable],[role="textbox"],input,textarea,#title-textarea,#textbox')).map(el => ({
      tag: el.tagName, id: el.id, role: el.getAttribute('role'),
      ce: el.getAttribute('contenteditable'), cls: el.className?.substring(0, 40)
    }));
  });
  console.log(JSON.stringify(els, null, 2));
  await b.close();
})();
