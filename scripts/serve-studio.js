const http = require('http');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const cron = require('node-cron');

const PORT = 3939;
const QUEUE_FILE = path.join(__dirname, 'posts-queue.json');
const HTML_FILE = path.join(__dirname, 'posting-studio.html');

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
  const bothPosted = q.videos.filter(v => v.postedInstagram && v.postedTikTok).length;
  const pending = q.videos.filter(v => !v.postedInstagram || !v.postedTikTok).length;
  const withErrors = q.videos.filter(v => v.error).length;
  const today = new Date().toISOString().slice(0, 10);
  const isToday = q.lastPostDate === today;
  return {
    total,
    igPosted, ttPosted, bothPosted, pending, withErrors,
    dailyCount: q.dailyCount,
    dailyCountTikTok: q.dailyCountTikTok,
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
  const chromeLauncher = path.join(__dirname, 'launch-chrome.cmd');
  if (fs.existsSync(chromeLauncher)) {
    try {
      require('net').createConnection(9222).on('connect', function() { this.destroy(); }).on('error', function() {
        spawn('cmd', ['/c', 'start', '', chromeLauncher], { shell: true, detached: true }).unref();
      }).end();
    } catch {}
  }
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

const SCHEDULE_TIMES = ['06:00'];
const SCHEDULE_CRON = '0 6 * * *';
const SCHEDULE_VIDEOS = { '06:00': 5 };
const TZ = 'America/Sao_Paulo';

function getSchedule() {
  const now = new Date();
  const nowBR = new Date(now.toLocaleString('en-US', { timeZone: TZ }));
  const nextRuns = SCHEDULE_TIMES.map(t => {
    const [h, m] = t.split(':').map(Number);
    const d = new Date(nowBR);
    d.setHours(h, m, 0, 0);
    if (d <= nowBR) d.setDate(d.getDate() + 1);
    return { time: t, videos: SCHEDULE_VIDEOS[t], next: d.toLocaleString('pt-BR', { timeZone: TZ }) };
  });
  return { times: SCHEDULE_TIMES, nextRuns, timezone: TZ };
}

function startScheduler() {
  cron.schedule(SCHEDULE_CRON, () => {
    broadcastLog({ type: 'system', text: `=== Postagem agendada (06:00, 5 videos com 1h de intervalo) ===`, ts: new Date().toISOString() });
    launchChromeIfNeeded();
    setTimeout(() => {
      const scriptPath = path.join(__dirname, 'postar-completo.js');
      if (runningProcess) return;
      logBuffer = [];
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
    }, 5000);
  }, { timezone: TZ });
  console.log(`Agendado: ${SCHEDULE_TIMES.join(', ')} (${TZ})`);
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
    q.videos.forEach(v => { v.postedInstagram = false; v.postedTikTok = false; v.error = null; });
    q.dailyCount = 0;
    q.dailyCountTikTok = 0;
    q.lastPostDate = '';
    fs.writeFileSync(QUEUE_FILE, JSON.stringify(q, null, 2));
    return sendJson(res, { ok: true });
  }

  if (pathname === '/api/queue/reset-posted' && req.method === 'POST') {
    const q = getQueue();
    q.videos.forEach(v => { v.postedInstagram = false; v.postedTikTok = false; });
    q.dailyCount = 0;
    q.dailyCountTikTok = 0;
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
    q.lastPostDate = '';
    fs.writeFileSync(QUEUE_FILE, JSON.stringify(q, null, 2));
    return sendJson(res, { ok: true });
  }

  if (pathname === '/api/chrome' && req.method === 'POST') {
    const chromeLauncher = path.join(__dirname, 'launch-chrome.cmd');
    if (fs.existsSync(chromeLauncher)) {
      spawn('cmd', ['/c', 'start', '', chromeLauncher], { shell: true, detached: true }).unref();
      return sendJson(res, { ok: true });
    }
    return sendJson(res, { ok: false, error: 'launch-chrome.cmd nao encontrado' });
  }

  if (pathname === '/api/schedule') {
    return sendJson(res, getSchedule());
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
