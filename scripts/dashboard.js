const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const CDP_PORT = parseInt(process.env.CHROME_DEBUG_PORT) || 9222;
const PROFILE = process.env.INSTAGRAM_PROFILE || 'meu_perfil';
const DATA_FILE = path.join(__dirname, 'dashboard-data.json');
const HTML_FILE = path.join(__dirname, '..', 'dashboard.html');

function parseNum(str) {
  if (!str || str === '?') return 0;
  const s = String(str).replace(',', '.').toUpperCase();
  if (s.includes('K')) return parseFloat(s) * 1000;
  if (s.includes('M')) return parseFloat(s) * 1000000;
  return parseFloat(s) || 0;
}

function fmtNum(n) {
  if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
  if (n >= 1000) return (n / 1000).toFixed(1) + 'K';
  return String(Math.round(n));
}

function esc(str) {
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

async function scrapeProfile() {
  console.log(`Conectando ao Chrome (porta ${CDP_PORT})...`);
  const browser = await chromium.connectOverCDP(`http://localhost:${CDP_PORT}`);
  const ctx = browser.contexts()[0] || await browser.newContext();
  const page = await ctx.newPage();

  const profileUrl = `https://www.instagram.com/${PROFILE}/`;
  console.log(`Acessando ${profileUrl}...`);
  await page.goto(profileUrl, { waitUntil: 'networkidle', timeout: 60000 });
  await page.waitForTimeout(3000);

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
  console.log(`Perfil: ${stats.posts} posts, ${stats.seguidores} seguidores, ${stats.seguindo} seguindo`);

  const allLinks = [];
  let lastH = 0, fails = 0;

  while (fails < 8) {
    const links = await page.evaluate(() =>
      Array.from(document.querySelectorAll('a[href*="/p/"], a[href*="/reel/"]'))
        .map(a => ({ href: a.href.split('?')[0], thumb: a.querySelector('img')?.src || '' }))
    );
    for (const l of links) {
      if (!allLinks.find(x => x.href === l.href)) allLinks.push(l);
    }
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(1500);
    const h = await page.evaluate(() => document.body.scrollHeight);
    if (h === lastH) fails++; else fails = 0;
    lastH = h;
  }

  console.log(`Encontrados ${allLinks.length} posts.`);

  const posts = [];
  for (let i = 0; i < allLinks.length; i++) {
    const { href, thumb } = allLinks[i];
    const shortcode = href.split('/').slice(-2, -1)[0];
    console.log(`  [${i + 1}/${allLinks.length}] ${shortcode}`);

    try {
      await page.goto(href, { waitUntil: 'networkidle', timeout: 30000 });
      await page.waitForTimeout(3000);

      const data = await page.evaluate(() => {
        const text = document.body.innerText;

        let caption = '';
        const lines = text.split('\n').filter(l => l.length > 15 && l.length < 300);
        for (const l of lines) {
          if (/[a-z]{3,}/i.test(l) && !l.match(/^(Ver|Ainda|Inicie|há |Mais|Meta|Sobre|Blog|Ajuda|API|Termos)/i)) {
            caption = l;
            break;
          }
        }

        let likes = '?', views = '?', comments = '?';
        const likePatterns = [
          /(\d[\d,.KMkm]*(?:\.\d+)?)\s*(curtida|like)/i,
          /(curtida|like)\s*(\d[\d,.KMkm]*(?:\.\d+)?)/i,
        ];
        for (const p of likePatterns) {
          const m = text.match(p);
          if (m) { likes = m[1] || m[2]; break; }
        }

        const tsMatch = text.match(/h[áa]\s+(\d+)\s*(min|h|minuto|hora|dia|semana)/i);
        const timeAgo = tsMatch ? `há ${tsMatch[1]} ${tsMatch[2].replace('minuto','min').replace('hora','h')}` : '';

        return { caption: caption.slice(0, 200), likes, views, comments, timeAgo };
      });

      posts.push({ href, thumb, shortcode, ...data });
    } catch (err) {
      console.log(`    Erro: ${err.message.slice(0, 80)}`);
      posts.push({ href, thumb, shortcode, caption: '', likes: '?', views: '?', comments: '?', timeAgo: '' });
    }
  }

  await page.close();
  await browser.close();

  const result = {
    profile: profileUrl,
    username: PROFILE,
    stats,
    scrapedAt: new Date().toISOString(),
    posts,
  };

  fs.writeFileSync(DATA_FILE, JSON.stringify(result, null, 2));
  console.log(`\nSalvo em ${DATA_FILE} (${posts.length} posts)`);
  return result;
}

function generateHTML(data) {
  const cards = data.posts.map(p => {
    const likes = p.likes !== '?' ? `<span class="likes">&hearts; ${p.likes}</span>` : '';
    const views = p.views !== '?' ? `<span class="views">&#9654; ${p.views}</span>` : '';
    const caption = p.caption ? `<p class="caption">${esc(p.caption)}</p>` : '';
    return `
    <a class="card" href="${p.href}" target="_blank">
      <div class="thumb-wrap"><img src="${p.thumb}" alt="${p.shortcode}" loading="lazy"></div>
      <div class="info">
        <div class="metrics">${views}${likes}</div>
        ${caption}
        <div class="meta">${p.timeAgo || p.shortcode}</div>
      </div>
    </a>`;
  }).join('\n');

  const html = `<!DOCTYPE html>
<html lang="pt">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Dashboard - @${data.username}</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#0a0a0a;color:#f5f5f5}
.container{max-width:1200px;margin:0 auto;padding:32px 20px}
h1{font-size:26px}
.profile-link{color:#a8a8a8;text-decoration:none;font-size:14px}
.profile-link:hover{color:#ccc}
.stats{display:flex;gap:24px;margin:16px 0;padding:16px 24px;background:#151515;border-radius:12px}
.stat{text-align:center}
.stat-val{font-size:22px;font-weight:700}
.stat-lbl{font-size:12px;color:#777;margin-top:2px}
.sub{color:#555;font-size:13px;margin-bottom:16px}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:12px}
.card{background:#151515;border-radius:10px;overflow:hidden;text-decoration:none;color:inherit;transition:transform .12s}
.card:hover{transform:translateY(-2px)}
.thumb-wrap{width:100%;aspect-ratio:9/16;overflow:hidden;background:#111}
.thumb-wrap img{width:100%;height:100%;object-fit:cover}
.info{padding:10px 12px}
.metrics{display:flex;gap:14px;font-size:13px;margin-bottom:4px}
.views{color:#0095f6}
.likes{color:#ff3040}
.caption{color:#aaa;font-size:12px;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;margin-bottom:4px}
.meta{color:#555;font-size:11px}
.toolbar{margin-bottom:16px}
.btn{padding:8px 16px;border:none;border-radius:6px;font-size:13px;cursor:pointer;background:#151515;color:#f5f5f5;text-decoration:none;display:inline-block}
.btn-p{background:#0095f6;color:#fff}
.btn:hover{opacity:.85}
@media(max-width:600px){.stats{gap:16px;padding:12px 16px}.grid{grid-template-columns:repeat(2,1fr);gap:8px}}
</style>
</head>
<body>
<div class="container">
  <h1>@${data.username}</h1>
  <a class="profile-link" href="${data.profile}" target="_blank">${data.profile}</a>
  <div class="stats">
    <div class="stat"><div class="stat-val">${data.stats.posts}</div><div class="stat-lbl">Posts</div></div>
    <div class="stat"><div class="stat-val">${data.stats.seguidores}</div><div class="stat-lbl">Seguidores</div></div>
    <div class="stat"><div class="stat-val">${data.stats.seguindo}</div><div class="stat-lbl">Seguindo</div></div>
  </div>
  <div class="sub">Atualizado: ${new Date(data.scrapedAt).toLocaleString('pt-BR')} &middot; ${data.posts.length} posts</div>
  <div class="toolbar"><a href="javascript:location.reload()" class="btn btn-p">Atualizar</a></div>
  <div class="grid">${cards}</div>
</div>
</body>
</html>`;

  fs.writeFileSync(HTML_FILE, html, 'utf-8');
  console.log(`Dashboard: ${HTML_FILE}`);
}

async function main() {
  const data = await scrapeProfile();
  generateHTML(data);
}

if (require.main === module) {
  main().catch(err => { console.error(err.message); process.exit(1); });
}

module.exports = { scrapeProfile, generateHTML };