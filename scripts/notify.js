const https = require('https');

const BOT_TOKEN = () => process.env.TELEGRAM_BOT_TOKEN;
const CHAT_ID = () => process.env.TELEGRAM_CHAT_ID;

function sendMessage(text) {
  const token = BOT_TOKEN();
  const chatId = CHAT_ID();
  if (!token || !chatId) return Promise.resolve(false);
  const tag = process.env.NOTIFICATION_TAG;
  const fullText = tag ? `[${tag}] ${text}` : text;
  return new Promise((resolve) => {
    const data = JSON.stringify({ chat_id: chatId, text: fullText, parse_mode: 'HTML', disable_web_page_preview: true });
    const req = https.request(
      { hostname: 'api.telegram.org', path: `/bot${token}/sendMessage`, method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) } },
      (res) => { let b = ''; res.on('data', c => b += c); res.on('end', () => resolve(true)); }
    );
    req.on('error', () => resolve(false));
    req.write(data);
    req.end();
  });
}

function formatResults(video, results) {
  let msg = `🎬 <b>${video.filename}</b>\n`;
  const emojis = { instagram: '📸', tiktok: '🎵', facebook: '👍', shorts: '▶️' };
  const labels = { instagram: 'Instagram', tiktok: 'TikTok', facebook: 'Facebook', shorts: 'Shorts' };
  for (const [key, label] of Object.entries(labels)) {
    const r = results[key];
    if (r === true) msg += `${emojis[key]} ${label}: ✅\n`;
    else if (r === false) msg += `${emojis[key]} ${label}: ⏭️ (ja postado)\n`;
    else if (r) msg += `${emojis[key]} ${label}: 🔴 ${r}\n`;
  }
  return msg;
}

async function notifyVideoPosted(video, results) {
  const msg = formatResults(video, results);
  await sendMessage(msg);
}

async function notifyRunSummary(total, errors, platformCounts) {
  let msg = `📊 <b>Resumo da rodada</b>\n`;
  msg += `Videos processados: ${total}\n`;
  if (errors > 0) msg += `Erros: ${errors}\n`;
  for (const [platform, count] of Object.entries(platformCounts)) {
    msg += `${platform}: ${count}\n`;
  }
  await sendMessage(msg);
}

async function notifyError(errorMsg) {
  await sendMessage(`🚨 <b>ERRO na postagem</b>\n${errorMsg}`);
}

module.exports = { notifyVideoPosted, notifyRunSummary, notifyError };
