const http = require('http');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const cron = require('node-cron');

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

const PORT = 3940;
const QUEUE_FILE = path.join(__dirname, 'posts-queue.json');
const HTML_FILE = path.join(__dirname, 'posting-studio.html');
const SCHEDULE_CONFIG_FILE = path.join(__dirname, 'schedule-config.json');
const ANALYTICS_DATA_FILE = path.join(__dirname, 'analytics-data.json');
const VIDEOS_DIR_FILE = path.join(__dirname, 'videos-dir.json');
const DEFAULT_VIDEOS_DIR = process.env.VIDEOS_DIR || path.join(require('os').homedir(), 'Downloads', 'FabricaReels');
const STUDIO_SCHEDULER_DISABLED = process.env.STUDIO_SCHEDULER_DISABLED === 'true';

function loadVideosDir() {
  try {
    const data = JSON.parse(fs.readFileSync(VIDEOS_DIR_FILE, 'utf-8'));
    if (data.dir && fs.existsSync(data.dir) && fs.statSync(data.dir).isDirectory()) return data.dir;
  } catch {}
  return DEFAULT_VIDEOS_DIR;
}

function saveVideosDir(dir) {
  fs.writeFileSync(VIDEOS_DIR_FILE, JSON.stringify({ dir }, null, 2));
}

let REELS_VIDEO_DIR = loadVideosDir();

function naturalSortVideo(a, b) {
  const na = parseInt(a.match(/_(\d+)\.mp4$/)?.[1] || '0', 10);
  const nb = parseInt(b.match(/_(\d+)\.mp4$/)?.[1] || '0', 10);
  return na - nb;
}

function rebuildQueueFromDir() {
  const files = fs.readdirSync(REELS_VIDEO_DIR).filter(f => f.endsWith('.mp4')).sort(naturalSortVideo);
  let old = { videos: [], lastPostDate: '' };
  try {
    if (fs.existsSync(QUEUE_FILE)) old = JSON.parse(fs.readFileSync(QUEUE_FILE, 'utf-8'));
  } catch {}
  const byName = {};
  (old.videos || []).forEach(v => { byName[v.filename] = v; });
  const videos = files.map(f => {
    const prev = byName[f];
    return {
      path: path.join(REELS_VIDEO_DIR, f),
      filename: f,
      postedInstagram: prev ? !!prev.postedInstagram : false,
      postedTikTok: prev ? !!prev.postedTikTok : false,
      postedFacebook: prev ? !!prev.postedFacebook : false,
      postedKwai: prev ? !!prev.postedKwai : false,
      postedShorts: prev ? !!prev.postedShorts : false,
      instagramDate: prev ? prev.instagramDate : null,
      tiktokDate: prev ? prev.tiktokDate : null,
      facebookDate: prev ? prev.facebookDate : null,
      kwaiDate: prev ? prev.kwaiDate : null,
      shortsDate: prev ? prev.shortsDate : null,
      error: prev ? prev.error : null,
    };
  });
  const queue = {
    videos,
    currentIndex: 0,
    dailyCount: 0,
    dailyCountTikTok: 0,
    dailyCountFacebook: 0,
    dailyCountKwai: 0,
    dailyCountShorts: 0,
    lastPostDate: old.lastPostDate || '',
  };
  fs.writeFileSync(QUEUE_FILE, JSON.stringify(queue, null, 2));
  return queue;
}

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.css': 'text/css',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
};

let runningProcess = null;
let logBuffer = [];

function serveFile(res, filePath) {
  const ext = path.extname(filePath);
  res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
  fs.createReadStream(filePath).pipe(res);
}

function sendJson(res, data, status = 200) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(data));
}

function getQueue() {
  if (!fs.existsSync(QUEUE_FILE)) return { videos: [], currentIndex: 0, dailyCount: 0, dailyCountTikTok: 0, lastPostDate: '' };
  return JSON.parse(fs.readFileSync(QUEUE_FILE, 'utf-8'));
}

function getStats() {
  const q = getQueue();
  const total = q.videos.length;
  const igPosted = q.videos.filter(v => v.postedInstagram).length;
  const ttPosted = q.videos.filter(v => v.postedTikTok).length;
  const fbPosted = q.videos.filter(v => v.postedFacebook).length;
  const kwPosted = q.videos.filter(v => v.postedKwai).length;
  const shPosted = q.videos.filter(v => v.postedShorts).length;
  const allPosted = q.videos.filter(v => v.postedInstagram && v.postedTikTok && v.postedFacebook && v.postedKwai && v.postedShorts).length;
  const pending = q.videos.filter(v => !v.postedInstagram || !v.postedTikTok || !v.postedFacebook || !v.postedKwai || !v.postedShorts).length;
  const withErrors = q.videos.filter(v => v.error).length;
  const today = new Date().toISOString().slice(0, 10);
  const isToday = q.lastPostDate === today;
  return {
    total,
    igPosted, ttPosted, fbPosted, kwPosted, shPosted, allPosted, pending, withErrors,
    dailyCount: q.dailyCount,
    dailyCountTikTok: q.dailyCountTikTok,
    dailyCountFacebook: q.dailyCountFacebook || 0,
    dailyCountKwai: q.dailyCountKwai || 0,
    dailyCountShorts: q.dailyCountShorts || 0,
    dailyLimit: 5,
    isActive: isToday,
    lastPostDate: q.lastPostDate,
    currentIndex: q.currentIndex,
  };
}

let sseClients = [];

function broadcastLog(line) {
  logBuffer.push(line);
  if (logBuffer.length > 500) logBuffer.splice(0, logBuffer.length - 500);
  const data = `data: ${JSON.stringify(line)}\n\n`;
  sseClients = sseClients.filter(c => {
    try { c.write(data); return true; } catch { return false; }
  });
}

function launchChromeIfNeeded() {
  // Chrome lancado manualmente pelo usuario via botao no Studio
}

function runScript() {
  if (runningProcess) return { ok: false, error: 'Ja existe uma execucao em andamento' };

  const scriptPath = path.join(__dirname, 'postar-completo.js');
  if (!fs.existsSync(scriptPath)) return { ok: false, error: 'Script postar-completo.js nao encontrado' };

  logBuffer = [];
  launchChromeIfNeeded();
  broadcastLog({ type: 'system', text: '=== Iniciando postagem ===', ts: new Date().toISOString() });

  runningProcess = spawn('node', [scriptPath], { cwd: __dirname, shell: true });

  runningProcess.stdout.on('data', (data) => {
    const lines = data.toString().split('\n').filter(Boolean);
    lines.forEach(line => broadcastLog({ type: 'stdout', text: line, ts: new Date().toISOString() }));
  });

  runningProcess.stderr.on('data', (data) => {
    const lines = data.toString().split('\n').filter(Boolean);
    lines.forEach(line => broadcastLog({ type: 'stderr', text: line, ts: new Date().toISOString() }));
  });

  runningProcess.on('close', (code) => {
    broadcastLog({ type: 'system', text: `=== Processo encerrado (codigo: ${code}) ===`, ts: new Date().toISOString() });
    runningProcess = null;
  });

  runningProcess.on('error', (err) => {
    broadcastLog({ type: 'error', text: `Erro ao iniciar: ${err.message}`, ts: new Date().toISOString() });
    runningProcess = null;
  });

  return { ok: true };
}

const TZ = 'America/Sao_Paulo';

function getDefaultScheduleConfig() {
  return {
    enabled: true,
    times: ['06:00', '08:00', '10:00', '12:00', '14:00'],
    timezone: TZ,
  };
}

function loadScheduleConfig() {
  try {
    if (fs.existsSync(SCHEDULE_CONFIG_FILE)) {
      const data = JSON.parse(fs.readFileSync(SCHEDULE_CONFIG_FILE, 'utf-8'));
      if (data.times && data.times.length > 0) return data;
    }
  } catch {}
  const def = getDefaultScheduleConfig();
  saveScheduleConfig(def);
  return def;
}

function saveScheduleConfig(config) {
  fs.writeFileSync(SCHEDULE_CONFIG_FILE, JSON.stringify(config, null, 2));
}

function getNextRun(timeStr, tz) {
  const now = new Date();
  const nowLoc = new Date(now.toLocaleString('en-US', { timeZone: tz }));
  const [h, m] = timeStr.split(':').map(Number);
  const d = new Date(nowLoc);
  d.setHours(h, m, 0, 0);
  if (d <= nowLoc) d.setDate(d.getDate() + 1);
  return d.toLocaleString('pt-BR', { timeZone: tz });
}

function getSchedule() {
  const cfg = loadScheduleConfig();
  const now = new Date();
  const nowLoc = new Date(now.toLocaleString('en-US', { timeZone: cfg.timezone }));
  const nextRuns = cfg.times.map(t => {
    const [h, m] = t.split(':').map(Number);
    const d = new Date(nowLoc);
    d.setHours(h, m, 0, 0);
    if (d <= nowLoc) d.setDate(d.getDate() + 1);
    return { time: t, videos: 1, next: d.toLocaleString('pt-BR', { timeZone: cfg.timezone }) };
  });
  return { times: cfg.times, nextRuns, timezone: cfg.timezone, config: cfg };
}

let schedulerJobs = [];

function startScheduler() {
  schedulerJobs.forEach(j => j.stop());
  schedulerJobs = [];

  if (STUDIO_SCHEDULER_DISABLED) {
    console.log('Scheduler do Studio desabilitado (STUDIO_SCHEDULER_DISABLED=true). Usar postar-agendado.js');
    return;
  }

  const cfg = loadScheduleConfig();
  if (!cfg.enabled) {
    console.log('Agendador desabilitado.');
    return;
  }

  cfg.times.forEach(t => {
    const [h, m] = t.split(':').map(Number);
    const cronExpr = `${m} ${h} * * *`;
    const job = cron.schedule(cronExpr, () => {
      broadcastLog({ type: 'system', text: `=== Postagem agendada (${t}) ===`, ts: new Date().toISOString() });
      launchChromeIfNeeded();
      setTimeout(() => {
        const scriptPath = path.join(__dirname, 'postar-completo.js');
        if (runningProcess) return;
        logBuffer = [];
        runningProcess = spawn('node', [scriptPath, '1'], { cwd: __dirname, shell: true });
        runningProcess.stdout.on('data', (data) => {
          const lines = data.toString().split('\n').filter(Boolean);
          lines.forEach(line => broadcastLog({ type: 'stdout', text: line, ts: new Date().toISOString() }));
        });
        runningProcess.stderr.on('data', (data) => {
          const lines = data.toString().split('\n').filter(Boolean);
          lines.forEach(line => broadcastLog({ type: 'stderr', text: line, ts: new Date().toISOString() }));
        });
        runningProcess.on('close', (code) => {
          broadcastLog({ type: 'system', text: `=== Processo encerrado (codigo: ${code}) ===`, ts: new Date().toISOString() });
          runningProcess = null;
        });
        runningProcess.on('error', (err) => {
          broadcastLog({ type: 'error', text: `Erro ao iniciar: ${err.message}`, ts: new Date().toISOString() });
          runningProcess = null;
        });
      }, 5000);
    }, { timezone: cfg.timezone });
    schedulerJobs.push(job);
  });

  console.log(`Agendado: ${cfg.times.join(', ')} (${cfg.timezone})`);
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  const pathname = url.pathname;

  if (pathname === '/' || pathname === '/index.html') {
    if (fs.existsSync(HTML_FILE)) return serveFile(res, HTML_FILE);
    res.writeHead(404).end('posting-studio.html not found');
    return;
  }

  if (pathname === '/api/queue') {
    return sendJson(res, getQueue());
  }

  if (pathname === '/api/stats') {
    return sendJson(res, getStats());
  }

  if (pathname === '/api/run' && req.method === 'POST') {
    const result = runScript();
    return sendJson(res, result, result.ok ? 200 : 409);
  }

  if (pathname === '/api/stop' && req.method === 'POST') {
    if (runningProcess) {
      try {
        spawn('taskkill', ['/F', '/T', '/PID', runningProcess.pid.toString()]);
      } catch {}
      runningProcess = null;
      broadcastLog({ type: 'system', text: '=== Processo interrompido pelo usuario ===', ts: new Date().toISOString() });
      return sendJson(res, { ok: true });
    }
    return sendJson(res, { ok: false, error: 'Nenhum processo em execucao' });
  }

  if (pathname === '/api/log') {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
    });
    res.write(`data: ${JSON.stringify({ type: 'connected', text: 'Conectado' })}\n\n`);
    logBuffer.forEach(line => {
      res.write(`data: ${JSON.stringify(line)}\n\n`);
    });
    sseClients.push(res);
    req.on('close', () => {
      sseClients = sseClients.filter(c => c !== res);
    });
    return;
  }

  if (pathname === '/api/queue/reset' && req.method === 'POST') {
    const q = getQueue();
    q.videos.forEach(v => { v.postedInstagram = false; v.postedTikTok = false; v.postedFacebook = false; v.postedKwai = false; v.postedShorts = false; v.error = null; });
    q.dailyCount = 0;
    q.dailyCountTikTok = 0;
    q.dailyCountFacebook = 0;
    q.dailyCountKwai = 0;
    q.dailyCountShorts = 0;
    q.lastPostDate = '';
    fs.writeFileSync(QUEUE_FILE, JSON.stringify(q, null, 2));
    return sendJson(res, { ok: true });
  }

  if (pathname === '/api/queue/reset-posted' && req.method === 'POST') {
    const q = getQueue();
    q.videos.forEach(v => { v.postedInstagram = false; v.postedTikTok = false; v.postedFacebook = false; v.postedKwai = false; v.postedShorts = false; });
    q.dailyCount = 0;
    q.dailyCountTikTok = 0;
    q.dailyCountFacebook = 0;
    q.dailyCountKwai = 0;
    q.dailyCountShorts = 0;
    q.lastPostDate = '';
    fs.writeFileSync(QUEUE_FILE, JSON.stringify(q, null, 2));
    return sendJson(res, { ok: true });
  }

  if (pathname === '/api/queue/reset-errors' && req.method === 'POST') {
    const q = getQueue();
    q.videos.forEach(v => { v.error = null; });
    fs.writeFileSync(QUEUE_FILE, JSON.stringify(q, null, 2));
    return sendJson(res, { ok: true });
  }

  if (pathname === '/api/queue/reset-daily' && req.method === 'POST') {
    const q = getQueue();
    q.dailyCount = 0;
    q.dailyCountTikTok = 0;
    q.dailyCountFacebook = 0;
    q.dailyCountKwai = 0;
    q.dailyCountShorts = 0;
    q.lastPostDate = '';
    fs.writeFileSync(QUEUE_FILE, JSON.stringify(q, null, 2));
    return sendJson(res, { ok: true });
  }

  if (pathname === '/api/chrome' && req.method === 'POST') {
    const url = new URL(req.url, `http://localhost:${PORT}`);
    const profile = url.searchParams.get('profile') || 'futebol';
    const chromeLauncher = path.join(__dirname, 'launch-chrome.js');
    if (fs.existsSync(chromeLauncher)) {
      spawn('node', [chromeLauncher, `--profile=${profile}`], {
        cwd: __dirname,
        windowsHide: true,
        stdio: 'ignore',
        detached: true,
      }).unref();
      return sendJson(res, { ok: true, profile });
    }
    return sendJson(res, { ok: false, error: 'launch-chrome.js nao encontrado' });
  }

  if (pathname === '/api/schedule') {
    return sendJson(res, getSchedule());
  }

  if (pathname === '/api/schedule-config' && req.method === 'GET') {
    return sendJson(res, loadScheduleConfig());
  }

  if (pathname === '/api/schedule-config' && req.method === 'POST') {
    let body = '';
    req.on('data', c => body += c);
    req.on('end', () => {
      try {
        const cfg = JSON.parse(body);
        cfg.times = cfg.times.filter(t => /^\d{2}:\d{2}$/.test(t));
        saveScheduleConfig(cfg);
        startScheduler();
        return sendJson(res, { ok: true, config: cfg });
      } catch (e) {
        return sendJson(res, { ok: false, error: e.message }, 400);
      }
    });
    return;
  }

  if (pathname === '/api/videos-dir' && req.method === 'GET') {
    return sendJson(res, { dir: REELS_VIDEO_DIR });
  }

  if (pathname === '/api/videos-dir' && req.method === 'POST') {
    let body = '';
    req.on('data', c => body += c);
    req.on('end', () => {
      try {
        const { dir } = JSON.parse(body);
        if (!dir || typeof dir !== 'string' || !dir.trim()) {
          return sendJson(res, { ok: false, error: 'Caminho invalido' }, 400);
        }
        const resolved = path.resolve(dir.trim());
        if (!fs.existsSync(resolved) || !fs.statSync(resolved).isDirectory()) {
          return sendJson(res, { ok: false, error: 'Pasta nao encontrada ou nao e um diretorio' }, 400);
        }
        REELS_VIDEO_DIR = resolved;
        saveVideosDir(resolved);
        const queue = rebuildQueueFromDir();
        broadcastLog({ type: 'system', text: `Pasta de videos alterada para: ${resolved} (${queue.videos.length} videos)`, ts: new Date().toISOString() });
        return sendJson(res, { ok: true, dir: resolved, count: queue.videos.length });
      } catch (e) {
        return sendJson(res, { ok: false, error: e.message }, 400);
      }
    });
    return;
  }

  if (pathname === '/api/video' && req.method === 'GET') {
    const filename = url.searchParams.get('file');
    if (!filename) return sendJson(res, { error: 'file param required' }, 400);
    const videoPath = path.join(REELS_VIDEO_DIR, filename);
    if (!fs.existsSync(videoPath)) return sendJson(res, { error: 'not found' }, 404);

    const stat = fs.statSync(videoPath);
    const fileSize = stat.size;
    const range = req.headers.range;

    if (range) {
      const parts = range.replace(/bytes=/, '').split('-');
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
      const chunksize = end - start + 1;
      const stream = fs.createReadStream(videoPath, { start, end });
      res.writeHead(206, {
        'Content-Range': `bytes ${start}-${end}/${fileSize}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': chunksize,
        'Content-Type': 'video/mp4',
      });
      stream.pipe(res);
    } else {
      res.writeHead(200, {
        'Content-Length': fileSize,
        'Content-Type': 'video/mp4',
        'Accept-Ranges': 'bytes',
      });
      fs.createReadStream(videoPath).pipe(res);
    }
    return;
  }

  if (pathname === '/api/analytics' && req.method === 'GET') {
    if (!fs.existsSync(ANALYTICS_DATA_FILE)) return sendJson(res, { scrapedAt: null, platforms: {} });
    return serveFile(res, ANALYTICS_DATA_FILE);
  }

  if (pathname === '/api/analytics/refresh' && req.method === 'POST') {
    const { scrapeAll } = require('./analytics.js');
    scrapeAll().then(result => sendJson(res, result)).catch(err => sendJson(res, { ok: false, error: err.message }, 500));
    return;
  }

  if (pathname.startsWith('/api/')) {
    return sendJson(res, { error: 'Not found' }, 404);
  }

  if (fs.existsSync(path.join(__dirname, pathname))) {
    return serveFile(res, path.join(__dirname, pathname));
  }

  if (fs.existsSync(HTML_FILE)) return serveFile(res, HTML_FILE);
  res.writeHead(404).end('Not found');
});

startScheduler();

server.listen(PORT, () => {
  console.log(`Studio Interface rodando em http://localhost:${PORT}`);
  console.log(`Pressione Ctrl+C para parar`);
});
