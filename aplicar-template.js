const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const args = process.argv.slice(2);
if (args.length < 1) {
  console.error('Uso: node aplicar-template.js <video.mp4> [legenda]');
  process.exit(1);
}

const inputVideo = args[0];
const customCaption = args[1] || '';

const TEMPLATE = path.join(process.env.USERPROFILE, 'Downloads', 'template-novo.png');
const OUTPUT_DIR = path.join(process.env.USERPROFILE, 'Downloads', 'FabricaReels');

const TEMPLATE_W = 1080;
const TEMPLATE_H = 1350;
const OUTPUT_W = 1080;
const OUTPUT_H = 1920;
const TEMPLATE_PAD_TOP = Math.round((OUTPUT_H - TEMPLATE_H) / 2); // 285

let VIDEO_X = 0;
let VIDEO_Y = TEMPLATE_PAD_TOP + 290;
let VIDEO_W = 1080;
let VIDEO_H = 960;
let CAPTION_Y = VIDEO_Y + VIDEO_H + 40;
let RADIUS = 0;
let CAPTION_COLOR = '#D4A574';
let CUSTOM_CAPTION = '';

const inName = path.basename(inputVideo, path.extname(inputVideo));
const outFile = path.join(OUTPUT_DIR, inName + '_final.mp4');

// Extract username from filename
const nameMatch = inName.match(/reel_(.+?)_\d+$/);
const username = nameMatch ? nameMatch[1] : '';

// Generate caption
let caption = customCaption;
if (!caption) {
  const captions = [
    `${username} | momentos que inspiram`,
    `autocuidado \u00e9 prioridade  @${username}`,
    `${username}  cada dia um novo recome\u00e7o`,
    `seja luz  @${username}`,
    `${username}  cuidado que transforma`,
    `respira confia segue  @${username}`,
    `${username}  sua paz n\u00e3o tem pre\u00e7o`,
    `autocuidado n\u00e3o \u00e9 ego\u00edsmo  @${username}`,
    `${username}  brilhe do seu jeito`,
    `${username}  ess\u00eancia que acolhe`,
  ];
  caption = captions[Math.floor(Math.random() * captions.length)];
}

console.log(`\uD83C\uDFAC Aplicando template em: ${inputVideo}`);
console.log(`\uD83D\uDCDD Legenda: ${caption}`);

// Build filter
const escapedCaption = caption
  .replace(/\\/g, '\\\\')
  .replace(/'/g, "'\\\\''")
  .replace(/:/g, '\\:')
  .replace(/%/g, '%%')
  .replace(/\[/g, '\\[')
  .replace(/\]/g, '\\]');
let drawtextFilter = '';
const escColor = CAPTION_COLOR.replace('#', '');
drawtextFilter = `,drawtext=text='${escapedCaption}':fontsize=36:fontcolor=${escColor}:x=(w-text_w)/2:y=${CAPTION_Y}:font=Arial:box=1:boxcolor=black@0.35:boxborderw=10`;

const filterContent = [
  `[0:v]scale=${TEMPLATE_W}:${TEMPLATE_H}:force_original_aspect_ratio=decrease,setsar=1,pad=${OUTPUT_W}:${OUTPUT_H}:(ow-iw)/2:(oh-ih)/2:black[bg];`,
  `[1:v]scale=w=${VIDEO_W}:h=${VIDEO_H}:force_original_aspect_ratio=increase,crop=${VIDEO_W}:${VIDEO_H}:(iw-${VIDEO_W})/2:(ih-${VIDEO_H})/2[video];`,
  `[bg][video]overlay=${VIDEO_X}:${VIDEO_Y}:shortest=1${drawtextFilter}`
].join('\n');

// Setup fontconfig for Windows
const fontconfDir = path.join(require('os').tmpdir(), 'fontconfig');
if (!fs.existsSync(fontconfDir)) {
  fs.mkdirSync(fontconfDir, { recursive: true });
}
const fontconfFile = path.join(fontconfDir, 'fonts.conf');
const windir = process.env.WINDIR || 'C:\\Windows';
fs.writeFileSync(fontconfFile,
  '<?xml version="1.0"?>\n' +
  '<!DOCTYPE fontconfig SYSTEM "fonts.dtd">\n' +
  '<fontconfig>\n' +
  `  <dir>${windir}\\Fonts</dir>\n` +
  `  <cachedir>${fontconfDir}</cachedir>\n` +
  '</fontconfig>',
  'ascii'
);

const filterFile = path.join(require('os').tmpdir(), `ffmpeg_filter_${Date.now()}.txt`);
fs.writeFileSync(filterFile, filterContent, 'ascii');

const ff = spawnSync('ffmpeg', [
  '-y', '-loglevel', 'error', '-stats',
  '-loop', '1', '-i', TEMPLATE,
  '-i', inputVideo,
  '-filter_complex_script', filterFile,
  '-r', '30',
  '-b:v', '15M',
  '-maxrate', '15M',
  '-bufsize', '30M',
  '-c:a', 'aac', '-b:a', '192k',
  '-pix_fmt', 'yuv420p',
  '-shortest', outFile
], {
  stdio: 'inherit',
  env: {
    ...process.env,
    FONTCONFIG_FILE: fontconfFile,
    FONTCONFIG_PATH: fontconfDir,
  }
});

fs.unlinkSync(filterFile);

if (ff.status === 0) {
  console.log(`\u2705 Salvo: ${outFile}`);
} else {
  console.error(`\u274c Erro ao processar (c\u00f3digo ${ff.status})`);
  process.exit(1);
}
