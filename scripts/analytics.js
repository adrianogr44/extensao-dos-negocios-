const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

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

const DATA_FILE = path.join(__dirname, 'analytics-data.json');
const DEBUG_PORT = parseInt(process.env.CHROME_DEBUG_PORT) || 9222;

function parseNum(str) {
  if (!str || str === '?') return 0;
  const s = String(str).replace(',', '.').toUpperCase();
  if (s.includes('M')) return parseFloat(s) * 1000000;
  if (s.includes('K')) return parseFloat(s) * 1000;
  if (s.includes('MIL')) return parseFloat(s) * 1000;
  return parseFloat(s) || 0;
}

async function scrapeInstagram(page) {
  console.log('[IG] Scraping...');
  const profile = process.env.INSTAGRAM_PROFILE || 'meu_perfil';
  try {
    await page.goto(`https://www.instagram.com/${profile}/`, { waitUntil: 'networkidle', timeout: 60000 });
    await page.waitForTimeout(4000);

    const stats = await page.evaluate(() => {
      const text = document.body.innerText;
      const get = (patterns) => {
        for (const p of patterns) {
          const m = text.match(p);
          if (m) return m[1];
        }
        return '?';
      };
      return {
        posts: get([/([\d,.KM]+)\s*posts/i, /([\d,.KM]+)\s*publica[cç][oõ]es/i]),
        seguidores: get([/([\d,.KM]+)\s*seguidores/i, /([\d,.KM]+)\s*followers/i]),
        seguindo: get([/([\d,.KM]+)\s*seguindo/i, /([\d,.KM]+)\s*following/i]),
      };
    });

    return {
      platform: 'instagram',
      username: profile,
      stats: {
        posts: stats.posts,
        seguidores: stats.seguidores,
        seguindo: stats.seguindo,
        postsNum: parseNum(stats.posts),
        seguidoresNum: parseNum(stats.seguidores),
        seguindoNum: parseNum(stats.seguindo),
      },
      status: 'ok',
      error: null,
    };
  } catch (err) {
    return { platform: 'instagram', username: profile, stats: {}, status: 'error', error: err.message.substring(0, 150) };
  }
}

async function scrapeTikTok(page) {
  console.log('[TT] Scraping...');
  const profile = process.env.TIKTOK_PROFILE || 'meu_perfil';
  try {
    await page.goto(`https://www.tiktok.com/@${profile}`, { waitUntil: 'load', timeout: 60000 });
    await page.waitForTimeout(6000);

    const stats = await page.evaluate(() => {
      const text = document.body.innerText;
      const get = (patterns) => {
        for (const p of patterns) {
          const m = text.match(p);
          if (m) return m[1];
        }
        return '?';
      };
      return {
        seguidores: get([/([\d,.KM]+)\s*seguidores/i, /([\d,.KM]+)\s*followers/i, /seguidores?\s*([\d,.KM]+)/i]),
        curtidas: get([/([\d,.KM]+)\s*curtidas/i, /([\d,.KM]+)\s*likes/i, /curtidas?\s*([\d,.KM]+)/i]),
        seguindo: get([/([\d,.KM]+)\s*seguindo/i, /([\d,.KM]+)\s*following/i]),
        videos: get([/([\d,.KM]+)\s*v[ií]deos/i, /([\d,.KM]+)\s*videos/i]),
      };
    });

    return {
      platform: 'tiktok',
      username: profile,
      stats: {
        seguidores: stats.seguidores,
        curtidas: stats.curtidas,
        seguindo: stats.seguindo,
        videos: stats.videos,
        seguidoresNum: parseNum(stats.seguidores),
        curtidasNum: parseNum(stats.curtidas),
        seguindoNum: parseNum(stats.seguindo),
        videosNum: parseNum(stats.videos),
      },
      status: 'ok',
      error: null,
    };
  } catch (err) {
    return { platform: 'tiktok', username: profile, stats: {}, status: 'error', error: err.message.substring(0, 150) };
  }
}

async function scrapeFacebook(page) {
  console.log('[FB] Scraping...');
  const pageUrl = process.env.FACEBOOK_PAGE_URL || 'https://www.facebook.com/profile.php?id=61592685539474';
  try {
    await page.goto(pageUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(7000);

    const stats = await page.evaluate(() => {
      const text = document.body.innerText;
      const get = (patterns) => {
        for (const p of patterns) {
          const m = text.match(p);
          if (m) return m[1] || m[2];
        }
        return '?';
      };
      const seguidores = get([
        /(\d[\d,.]*)\s*seguidores?/i,
        /seguidores?\s*(\d[\d,.]*)/i,
        /(\d[\d,.]*)\s*follower/i,
        /(\d[\d,.]*)\s*pessoa curtiu/i,
      ]);
      const curtidas = get([
        /(\d[\d,.]*)\s*curtidas?/i,
        /curtidas?\s*(\d[\d,.]*)/i,
        /(\d[\d,.]*)\s*likes/i,
      ]);
      return { seguidores, curtidas };
    });

    return {
      platform: 'facebook',
      username: pageUrl,
      stats: {
        seguidores: stats.seguidores,
        curtidas: stats.curtidas,
        seguidoresNum: parseNum(stats.seguidores),
        curtidasNum: parseNum(stats.curtidas),
      },
      status: 'ok',
      error: null,
    };
  } catch (err) {
    return { platform: 'facebook', username: pageUrl, stats: {}, status: 'error', error: err.message.substring(0, 150) };
  }
}

async function scrapeYouTube(page) {
  const handle = process.env.YOUTUBE_HANDLE || 'efootballbr-e8l';
  console.log(`[YT] Scraping @${handle}...`);
  try {
    await page.goto(`https://www.youtube.com/@${handle}`, { waitUntil: 'load', timeout: 60000 });
    await page.waitForTimeout(6000);

    const stats = await page.evaluate(() => {
      const text = document.body.innerText;
      const get = (patterns) => {
        for (const p of patterns) {
          const m = text.match(p);
          if (m) return m[1];
        }
        return '?';
      };
      return {
        inscritos: get([/([\d,.KM]+)\s*inscritos/i, /([\d,.KM]+)\s*subscribers/i]),
        videos: get([/([\d,.KM]+)\s*v[ií]deos/i, /([\d,.KM]+)\s*videos/i]),
        visualizacoes: get([/([\d,.KM]+)\s*visualiza[cç][oõ]es/i, /([\d,.KM]+)\s*views/i]),
      };
    });

    return {
      platform: 'youtube',
      username: `@${handle}`,
      stats: {
        inscritos: stats.inscritos,
        videos: stats.videos,
        visualizacoes: stats.visualizacoes,
        inscritosNum: parseNum(stats.inscritos),
        videosNum: parseNum(stats.videos),
        visualizacoesNum: parseNum(stats.visualizacoes),
      },
      status: 'ok',
      error: null,
    };
  } catch (err) {
    return { platform: 'youtube', username: handle, stats: {}, status: 'error', error: err.message.substring(0, 150) };
  }
}

async function scrapeAll() {
  console.log('Conectando ao Chrome...');
  const browser = await chromium.connectOverCDP(`http://127.0.0.1:${DEBUG_PORT}`);
  const contexts = browser.contexts();
  const ctx = contexts && contexts.length > 0 ? contexts[0] : await browser.newContext();

  const results = {};
  const platforms = [
    { name: 'instagram', fn: scrapeInstagram },
    { name: 'tiktok', fn: scrapeTikTok },
    { name: 'facebook', fn: scrapeFacebook },
    { name: 'youtube', fn: scrapeYouTube },
  ];

  for (const p of platforms) {
    let page;
    try {
      page = await ctx.newPage();
      results[p.name] = await p.fn(page);
    } catch (err) {
      results[p.name] = { platform: p.name, username: '?', stats: {}, status: 'error', error: err.message.substring(0, 150) };
    }
    if (page) await page.close().catch(() => {});
    // Pequena pausa entre plataformas
    await new Promise(r => setTimeout(r, 1000));
  }

  const output = {
    scrapedAt: new Date().toISOString(),
    platforms: results,
  };

  fs.writeFileSync(DATA_FILE, JSON.stringify(output, null, 2));
  console.log(`\nSalvo em ${DATA_FILE}`);

  for (const [name, data] of Object.entries(results)) {
    const s = data.status === 'ok' ? 'OK' : `ERRO: ${data.error}`;
    console.log(`  ${name.padEnd(10)} ${s}`);
  }

  await browser.close();
  return output;
}

if (require.main === module) {
  scrapeAll().catch(err => { console.error('Erro:', err.message); process.exit(1); });
}

module.exports = { scrapeAll };
