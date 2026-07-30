const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.connectOverCDP('http://127.0.0.1:9222');
  const ctx = browser.contexts()[0];

  // YouTube - get channel handle
  let p = await ctx.newPage();
  await p.goto('https://www.youtube.com/channel/UCX4phG5WmtLanHfgIMAkGyA', { waitUntil: 'load', timeout: 30000 }).catch(()=>{});
  await new Promise(r => setTimeout(r, 5000));
  const ytHandle = await p.evaluate(() => {
    const text = document.body.innerText;
    const m = text.match(/@([\w.-]+)/);
    if (m) return m[1];
    // Try from URL
    const url = window.location.href;
    const m2 = url.match(/@([\w.-]+)/);
    if (m2) return m2[1];
    return 'NOT FOUND - ' + text.substring(0, 400);
  });
  console.log('YT handle:', ytHandle);
  await p.close().catch(()=>{});

  // TikTok - try to find username via main page logged-in state
  p = await ctx.newPage();
  await p.goto('https://www.tiktok.com', { waitUntil: 'load', timeout: 30000 }).catch(()=>{});
  await new Promise(r => setTimeout(r, 5000));
  const tt = await p.evaluate(() => {
    const text = document.body.innerText;
    // Look for @username patterns
    const m = text.match(/@(\w[\w._-]+)/);
    if (m) return m[1];
    // Check all links for profile links
    const links = Array.from(document.querySelectorAll('a[href*="/@"]'));
    if (links.length) {
      const m2 = links[0].href.match(/@(\w[\w._-]+)/);
      if (m2) return m2[1];
    }
    return 'NOT FOUND - ' + text.substring(0, 400);
  });
  console.log('TT username:', tt);
  await p.close().catch(()=>{});

  await browser.close();
})();
