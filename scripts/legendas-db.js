// Banco de legendas geradas pela OpenAI, persistido por vídeo.
// Reaproveita a MESMA legenda em todas as plataformas (IG, TT, FB, Shorts)
// sem chamar a OpenAI de novo. Nunca perde as hashtags.
const path = require('path');
const fs = require('fs');

const DB_FILE = path.join(__dirname, 'legendas-db.json');

function loadDb() {
  try {
    if (!fs.existsSync(DB_FILE)) return { profiles: {} };
    const raw = fs.readFileSync(DB_FILE, 'utf-8').replace(/^\uFEFF/, '');
    const data = JSON.parse(raw);
    if (!data.profiles) data.profiles = {};
    return data;
  } catch {
    return { profiles: {} };
  }
}

function saveDb(db) {
  fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
}

function profileKey(profile) {
  return (profile || 'futebol').toLowerCase();
}

// Retorna a legenda salva para um vídeo (ou null se não existe)
function getLegenda(filename, profile) {
  const db = loadDb();
  const prof = db.profiles[profileKey(profile)] || {};
  return prof[filename] || null;
}

// Salva (ou atualiza) a legenda de um vídeo
function saveLegenda(filename, profile, legenda) {
  if (!filename || !legenda || !legenda.fullText) return false;
  const db = loadDb();
  const key = profileKey(profile);
  if (!db.profiles[key]) db.profiles[key] = {};
  const antiga = db.profiles[key][filename] || {};
  db.profiles[key][filename] = {
    filename,
    caption: legenda.caption || antiga.caption || '',
    hashtags: Array.isArray(legenda.hashtags) ? legenda.hashtags : (antiga.hashtags || []),
    fullText: legenda.fullText,
    topic: legenda.topic || antiga.topic || '',
    geradaEm: antiga.geradaEm || new Date().toISOString(),
    atualizadaEm: new Date().toISOString(),
    usadaEm: antiga.usadaEm || {},
  };
  saveDb(db);
  return true;
}

// Marca que a legenda foi usada em uma plataforma (auditoria)
function marcarUso(filename, profile, plataforma) {
  if (!filename || !plataforma) return;
  const db = loadDb();
  const key = profileKey(profile);
  const registro = db.profiles[key] && db.profiles[key][filename];
  if (!registro) return;
  registro.usadaEm = registro.usadaEm || {};
  registro.usadaEm[plataforma] = new Date().toISOString();
  saveDb(db);
}

// Estatísticas para depuração
function stats(profile) {
  const db = loadDb();
  const prof = db.profiles[profileKey(profile)] || {};
  const filenames = Object.keys(prof);
  return {
    total: filenames.length,
    comHashtags: filenames.filter(f => /#/.test(prof[f].fullText || '')).length,
    filenames,
  };
}

module.exports = { getLegenda, saveLegenda, marcarUso, stats, DB_FILE };