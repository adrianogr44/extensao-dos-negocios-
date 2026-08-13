/**
 * COLETOR SEMANAL DE TENDENCIAS POR NICHOS (futebol | motivacao)
 * Fontes:
 *  - Google Trends BR (Chrome real porta 9222 via CDP)
 *  - TikTok Creative Center (headless) - hashtags populares BR com posts/views
 *  - YouTube Trending (Chrome real 9222, opcional - pode falhar)
 * Saida: scripts/tendencias-data.json (historico por semana)
 *
 * Uso: node scripts/coletar-tendencias.js [--niche=futebol,motivacao] [--quiet]
 */
const path = require('path');
const fs = require('fs');
const net = require('net');
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

const DATA_FILE = path.join(__dirname, 'tendencias-data.json');
const LOG_FILE = path.join(__dirname, 'tendencias-log.txt');
const QUET = process.argv.slice(2).join(' ').includes('--quiet');

function log(msg) {
  if (!QUET) console.log(msg);
  try {
    fs.appendFileSync(LOG_FILE, `[${new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}] ${msg}\n`);
  } catch {}
}
function logErr(msg) {
  console.error(msg);
}

function weekKey(date = new Date()) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + 4 - (d.getDay() || 7));
  const yearStart = new Date(d.getFullYear(), 0, 1);
  const weekNo = Math.ceil(((d - yearStart) / 86400000 + 1) / 7);
  return `${d.getFullYear()}-W${String(weekNo).padStart(2, '0')}`;
}

function isPortOpen(port) {
  return new Promise((resolve) => {
    const s = net.connect(port, '127.0.0.1');
    s.setTimeout(1500);
    s.once('connect', () => { s.destroy(); resolve(true); });
    s.once('timeout', () => { s.destroy(); resolve(false); });
    s.once('error', () => { s.destroy(); resolve(false); });
  });
}

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36';

// ---------------------------------------------------------------------------
// 1. GOOGLE TRENDS BR (via Chrome real)
// ---------------------------------------------------------------------------
async function coletaGoogleTrends(port) {
  log('  [1/4] Google Trends...');
  const browser = await chromium.connectOverCDP(`http://127.0.0.1:${port}`);
  const ctx = browser.contexts()[0];
  const page = await ctx.newPage();
  try {
    await page.goto('https://trends.google.com.br/trending?geo=BR', { waitUntil: 'domcontentloaded', timeout: 40000 });
    await page.waitForTimeout(5000);
    const raw = await page.evaluate(() => document.body.innerText);
    const trends = parseGoogleTrends(raw);
    log(`  [1/4] Google Trends: ${trends.length} tendencias`);
    return { ok: trends.length > 0, trends };
  } catch (err) {
    log(`  [1/4] Google Trends FALHOU: ${err.message.substring(0, 80)}`);
    return { ok: false, trends: [], error: err.message.substring(0, 120) };
  } finally {
    await page.close().catch(() => {});
    await browser.close().catch(() => {});
  }
}

function parseGoogleTrends(text) {
  const out = [];
  // Blocos: {titulo}\n{volume}\narrow_upward\n{cresc}%\n\n(há X ...)\ntrending_up\nAtiva\n\n...
  const parts = text.split('\n');
  let i = 0;
  while (i < parts.length) {
    const line = parts[i].trim();
    if (line && line.length > 2 && !/^(arrow_upward|trending_up|Ativa|info|search|Início|Explorar|Em alta)/i.test(line)) {
      const title = line;
      let volume = null;
      let pct = null;
      let when = null;
      for (let j = i + 1; j < Math.min(i + 8, parts.length); j++) {
        const v = parts[j].trim();
        if (!v) continue;
        if (/mil\+|mi\+|\d+\+\s*$|mil\b/.test(v) && !volume) {
          const n = parseFloat(v.replace(/[^\d.,]/g, '').replace(',', '.'));
          if (!Number.isNaN(n)) {
            volume = v.includes('mi+') || /m\/?\s*$/.test(v.replace('mil', 'M')) ? Math.round(n * 1000000) : Math.round(n * 1000);
          }
        }
        if (/%/.test(v) && !pct) pct = v;
        if (/^há|^Ha|^ha /.test(v) && !when) when = v;
        if (/trending_up/.test(v)) break;
      }
      out.push({ title, volume, pct: pct ? pct.replace('%', '').replace(/[^\d.,-]/g, '') : null, when });
      i += 4;
      continue;
    }
    i++;
  }
  return out.slice(0, 30);
}

// ---------------------------------------------------------------------------
// 2. TIKTOK CREATIVE CENTER (headless)
// ---------------------------------------------------------------------------
async function coletaTikTokHashtags() {
  log('  [2/4] TikTok Creative Center...');
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ userAgent: UA, locale: 'pt-BR' });
  const page = await ctx.newPage();
  try {
    await page.goto('https://ads.tiktok.com/business/creativecenter/inspiration/popular/hashtag/pc/en?from=creativecenter&period=7&page=1&limit=30&region=BR', {
      waitUntil: 'domcontentloaded', timeout: 40000,
    });
    await page.waitForTimeout(7000);
    for (let s = 0; s < 3; s++) {
      await page.evaluate(() => window.scrollBy(0, 1200));
      await page.waitForTimeout(800);
    }
    const text = await page.evaluate(() => document.body.innerText);
    const hashtags = parseTikTokHashtags(text);
    log(`  [2/4] TikTok CC: ${hashtags.length} hashtags`);
    return { ok: hashtags.length > 0, hashtags };
  } catch (err) {
    log(`  [2/4] TikTok CC FALHOU: ${err.message.substring(0, 80)}`);
    return { ok: false, hashtags: [], error: err.message.substring(0, 120) };
  } finally {
    await browser.close().catch(() => {});
  }
}

function parseTikTokHashtags(text) {
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
  const out = [];
  for (let i = 0; i < lines.length; i++) {
    const rankM = lines[i].match(/^(\d{1,3})$/);
    if (!rankM) continue;
    const tag = (lines[i + 1] || '').replace(/^#/, '');
    if (!/^[a-z0-9_]+$/i.test(tag)) continue;
    const postsRaw = lines[i + 3];
    const viewsRaw = lines[i + 5];
    out.push({
      rank: parseInt(rankM[1], 10),
      tag,
      category: lines[i + 2] || null,
      posts: parseCompact(postsRaw),
      views: parseCompact(viewsRaw),
    });
    i += 6;
  }
  return out.slice(0, 30);
}

function parseCompact(raw) {
  if (!raw) return null;
  const s = String(raw).replace(/\s+/g, '').toUpperCase();
  let mult = 1;
  if (s.includes('B')) mult = 1e9;
  else if (s.includes('M')) mult = 1e6;
  else if (s.includes('K')) mult = 1e3;
  const n = parseFloat(s.replace(/[^\d.,]/g, '').replace(',', '.'));
  return Number.isNaN(n) ? null : Math.round(n * mult);
}

// ---------------------------------------------------------------------------
// 3. YOUTUBE TRENDING (Chrome real, opcional)
// ---------------------------------------------------------------------------
async function coletaYouTubeTrends(port) {
  log('  [4/4] YouTube Trending...');
  try {
    const browser = await chromium.connectOverCDP(`http://127.0.0.1:${port}`);
    const ctx = browser.contexts()[0];
    const page = await ctx.newPage();
    try {
      await page.goto('https://www.youtube.com/feed/trending?gl=BR&hl=pt', { waitUntil: 'domcontentloaded', timeout: 40000 });
      await page.waitForTimeout(7000);
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight * 0.4));
      await page.waitForTimeout(2000);
      const items = await page.evaluate(() => {
        const win = window;
        const data = win.ytInitialData || null;
        const out = new Set();
        if (!data) return [];
        const walk = (o) => {
          if (!o || typeof o !== 'object') return;
          if (Array.isArray(o)) { o.forEach(walk); return; }
          if (o.videoTitle && typeof o.videoTitle === 'string') out.add(o.videoTitle.slice(0, 100));
          if (o.title && o.title.runs && Array.isArray(o.title.runs) && o.title.runs[0] && o.title.runs[0].text) {
            const t = o.title.runs.map((r) => r.text).join('').slice(0, 100);
            if (/^[A-Za-zÀ-ú0-9]/.test(t)) out.add(t);
          }
          for (const k of Object.keys(o)) walk(o[k]);
        };
        walk(data);
        return Array.from(out).slice(0, 20);
      });
      log(`  [4/4] YouTube: ${items.length} titulos`);
      return { ok: items.length > 0, items };
    } finally {
      await page.close().catch(() => {});
      await browser.close().catch(() => {});
    }
  } catch (err) {
    log(`  [4/4] YouTube FALHOU: ${err.message.substring(0, 80)}`);
    return { ok: false, items: [], error: err.message.substring(0, 120) };
  }
}

// ---------------------------------------------------------------------------
// 2b. TIKTOK TAGS DE NICHO (Chrome real - hashtags relacionadas por tag)
//      Ex.: pagina /tag/futebol mostra hashtags relacionadas do nicho
// ---------------------------------------------------------------------------
async function coletaTikTokTagsDeNicho(port, tagsPorNicho) {
  log('  [3/4] TikTok tags de nicho...');
  let browser;
  try {
    browser = await chromium.connectOverCDP(`http://127.0.0.1:${port}`);
  } catch (err) {
    return { ok: false, porNicho: {}, error: err.message.substring(0, 100) };
  }
  const ctx = browser.contexts()[0];
  const page = await ctx.newPage();
  const porNicho = {};
  try {
    for (const [niche, tags] of Object.entries(tagsPorNicho)) {
      const encontradas = [];
      for (const tag of tags) {
        try {
          await page.goto(`https://www.tiktok.com/tag/${encodeURIComponent(tag)}`, { waitUntil: 'domcontentloaded', timeout: 30000 });
          await page.waitForTimeout(3000);
          const hashtags = await page.evaluate(() => {
            const out = [];
            const rx = /#([a-zA-Z0-9_]{3,})/g;
            const seen = new Set();
            for (const el of document.querySelectorAll('a[href*="/tag/"], div[data-e2e="challenge-card"], div[class*="challenge"]')) {
              const mt = (el.textContent || '').match(rx);
              if (mt) {
                for (const m of mt) {
                  const t = m.slice(1).toLowerCase();
                  if (!seen.has(t) && !/^(viral|featured|foryou|fyp)$/i.test(t)) { seen.add(t); out.push(t); }
                }
              }
            }
            return out.slice(0, 14);
          });
          encontradas.push(...hashtags);
        } catch {}
        if (encontradas.length >= 20) break;
      }
      porNicho[niche] = Array.from(new Set(encontradas.map((t) => t.toLowerCase()))).slice(0, 20);
      log(`  [3/4] ${niche}: ${porNicho[niche].length} hashtags`);
    }
    const total = Object.values(porNicho).reduce((a, arr) => a + arr.length, 0);
    return { ok: total > 0, porNicho };
  } finally {
    await page.close().catch(() => {});
    await browser.close().catch(() => {});
  }
}

// ---------------------------------------------------------------------------
// CLASSIFICACAO POR NICHO
// ---------------------------------------------------------------------------
const NICHES = {
  futebol: {
    keywords: [
      'futebol', 'fluminense', 'são paulo', 'sao paulo', 'flamengo', 'vasco', 'corinthians', 'palmeiras',
      'botafogo', 'gremio', 'grêmio', 'internacional', 'cruzeiro', 'atlético', 'atletico', 'bahia', 'boca',
      'palermo', 'juventus', 'lyon', 'barcelona', 'real madrid', 'madrid', 'city', 'arsenal', 'chelsea',
      'liverpool', 'bayern', 'psg', 'neymar', 'ronaldo', 'messi', 'mbappe', 'jogo', 'gol', 'gols', 'copa',
      'campeonato', 'brasileirão', 'brasileirao', 'sul americana', 'sulamericana', 'libertadores', 'seleção',
      'selecao', 'eurocopa', 'champions', 'x (independiente', 'x são', 'x sao', 'x crb', 'x juventus',
      'x lyon', 'x sparta', 'x deportivo', 'futebol ao vivo', 'placar', 'classificação', 'classificacao',
      'escalação', 'escalacao', 'rodada', 'gols do dia', 'melhores momentos', 'memphis', 'depay', 'sorteio',
      'copa do brasil', 'sul-americana', 'recoleta', 'rivadavia', 'independiente', 'bolívar', 'bolivar',
    ],
    hashtagSeeds: ['futebol', 'football', 'soccer', 'futbol', 'brasileirao', 'copa', 'gol', 'gols', 'flamengo', 'fluminense', 'corinthians', 'palmeiras', 'neymar', 'ronaldo', 'foryou', 'futebolbrasileiro'],
  },
  motivacao: {
    keywords: [
      'motivação', 'motivacao', 'disciplina', 'foco', 'mentalidade', 'mente', 'mindset', 'superação', 'superacao',
      'hábito', 'habito', 'sucesso', 'autoestima', 'ansiedade', 'depressão', 'depressao', 'meditação', 'meditacao',
      'treino', 'academia', 'corpo', 'saúde', 'saude', 'bem-estar', 'bem estar', 'resiliência', 'resiliencia',
      'autoconfiança', 'autoconfianca', 'objetivos', 'produtividade', 'trabalho', 'estudo', 'fitness', 'gym',
      'transtorno', 'saúde mental', 'saude mental', 'psi', 'terapia', 'quotidiano', 'autoestima', 'força',
      'forca', 'coragem', 'fé', 'fe', 'esperança', 'esperanca', 'criatividade', 'evolução', 'evolucao',
    ],
    hashtagSeeds: ['motivacao', 'disciplina', 'foco', 'mentalidade', 'mindset', 'sucesso', 'superacao', 'autoestima', 'saude mental', 'bemestar', 'fitness', 'gym', 'treino', 'foryou'],
  },
};

function classifyByNiche(trends, hashtags, ytItems, tiktokTagsPorNicho) {
  const result = {};

  const tiktokTags = tiktokTagsPorNicho || {};
  let maxRank = 1000;
  for (const [niche, cfg] of Object.entries(NICHES)) {
    const kw = cfg.keywords.map((k) => k.toLowerCase());
    const kwRx = new RegExp(kw.map((k) => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|'), 'i');

    const matchingTrends = trends
      .filter((t) => kwRx.test(t.title) || (niche === 'futebol' && (t.title || '').includes(' x ')))
      .slice(0, 12);

    // hashtags do CC: exigem match forte (tag COMECA com seed do nicho)
    const matchingHashtags = hashtags
      .filter((h) => cfg.hashtagSeeds.some((s) => h.tag && h.tag.toLowerCase().startsWith(s.toLowerCase())) || kwRx.test(h.tag || ''))
      .slice(0, 12);

    const matchingYt = ytItems.filter((t) => kwRx.test(t)).slice(0, 8);

    // hashtags relacionadas do TikTok (pagina /tag/<nicho>)
    const ttNicheTags = (tiktokTags[niche] || [])
      .filter((t) => t && !cfg.hashtagSeeds.includes(t))
      .map((t, i) => ({
        rank: maxRank + i,
        tag: t,
        source: 'tiktok-tag',
        posts: null,
        views: null,
        category: null,
      }));

    const allMatching = [...matchingHashtags, ...ttNicheTags]
      .sort((a, b) => {
        // tags de nicho (tiktok-tag) primeiro, sempre
        const av = a.source === 'tiktok-tag' ? 0 : 1;
        const bv = b.source === 'tiktok-tag' ? 0 : 1;
        if (av !== bv) return av - bv;
        return (b.views || 0) - (a.views || 0);
      });
    const sugeridas = Array.from(new Set([
      ...cfg.hashtagSeeds.filter((s) => !s.includes(' ')),
      ...allMatching.map((h) => h.tag),
    ])).slice(0, 14);

    result[niche] = {
      trends: matchingTrends,
      hashtagsEmAlta: allMatching.slice(0, 14),
      youtube: matchingYt,
      hashtagsSugeridas: sugeridas,
      conteudoEmAlta: matchingTrends.map((t) => t.title).slice(0, 5),
    };
    maxRank += 50;
  }
  return result;
}

// ---------------------------------------------------------------------------
// PRINCIPAL
// ---------------------------------------------------------------------------
async function main() {
  const args = process.argv.slice(2).join(' ');
  const onlyNiche = (args.match(/--niche=([a-z,]+)/) || [])[1];

  log('=== Coletor Semanal de Tendencias ===');
  log(`Semana: ${weekKey()}\n`);

  if (!(await isPortOpen(9222))) {
    logErr('Chrome 9222 fechado. Inicie o Chrome do futebol antes (launch-chrome.js).');
    process.exit(1);
  }

  const [gt, tt, yt] = await Promise.all([
    coletaGoogleTrends(9222),
    coletaTikTokHashtags(),
    coletaYouTubeTrends(9222).catch(() => ({ ok: false, items: [], error: 'yt failed' })),
  ]);

  const tiktokTagsPorNicho = await coletaTikTokTagsDeNicho(9222, {
    futebol: ['futebol', 'football', 'gols', 'neymar', 'flamengo', 'brasileirao', 'ronaldo', 'futeboledits'],
    motivacao: ['motivacao', 'disciplina', 'mentalidade', 'mindset', 'sucesso', 'superacao', 'estoicismo', 'desenvolvimentopessoal'],
  });
  const totalTags = Object.values(tiktokTagsPorNicho.porNicho || {}).reduce((a, arr) => a + arr.length, 0);

  log(`Google Trends: ${gt.ok ? gt.trends.length + ' tendencias' : 'FALHOU ' + (gt.error || '')}`);
  log(`TikTok CC: ${tt.ok ? tt.hashtags.length + ' hashtags' : 'FALHOU ' + (tt.error || '')}`);
  log(`TikTok tags nicho: ${totalTags || 0} hashtags relacionadas`);
  log(`YouTube: ${yt.ok ? yt.items.length + ' titulos' : 'FALHOU ' + (yt.error || '')}`);

  const byNiche = classifyByNiche(gt.trends || [], tt.hashtags || [], yt.items || [], tiktokTagsPorNicho.porNicho || {});

  const week = weekKey();
  let data = {};
  try { data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8')); } catch {}
  data.updatedAt = new Date().toISOString();
  data.week = week;
  if (!data.history) data.history = {};
  data.history[week] = {
    collectedAt: new Date().toISOString(),
    sources: { googleTrends: gt.ok ? gt.trends : null, tiktok: tt.ok ? tt.hashtags : null, tiktokTagsNicho: tiktokTagsPorNicho.ok ? tiktokTagsPorNicho.porNicho : null, youtube: yt.ok ? yt.items : null },
    byNiche,
  };
  data.current = data.history[week];
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
  log(`\nSalvo em ${DATA_FILE}`);

  for (const [niche, r] of Object.entries(byNiche)) {
    log(`\n===== ${niche.toUpperCase()} =====`);
    log(`Temas em alta: ${(r.conteudoEmAlta || []).join(' | ') || 'nada relevante'}`);
    log(`Hashtags em alta: ${(r.hashtagsEmAlta || []).map((h) => '#' + h.tag).join(' ') || 'nada'}`);
    log(`Hashtags sugeridas proxima semana: ${r.hashtagsSugeridas.map((h) => '#' + h).join(' ')}`);
  }

  return data;
}

if (require.main === module) {
  main().catch((err) => { logErr('Erro fatal: ' + err.message); process.exit(1); });
}

module.exports = { main, weekKey, parseGoogleTrends, parseTikTokHashtags, classifyByNiche };