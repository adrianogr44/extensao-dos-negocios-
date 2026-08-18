# Fábrica de Reels — Automação de Postagem

Sistema automatizado de postagem de vídeos no **Instagram** e **TikTok** usando Playwright + Chrome.

## Estrutura

```
scripts/
  postar-completo.js    # Posta em todas as plataformas (IG + TT + FB + Shorts)
  tiktok-poster.js      # Posta apenas no TikTok
  instagram-poster.js   # Posta apenas no Instagram
  postar-agendado.js    # Agendador cron (horários em schedule-config.json)
  launch-chrome.cmd     # Inicia Chrome com debug remoto
  launch-chrome.ps1     # Versão PowerShell
  dashboard.js          # Scraper de perfil Instagram

src/                    # Painel web "Reel Machine" (Next.js, localhost:3939)
```

## Pré-requisitos

- Node.js 18+
- Google Chrome instalado
- Playwright (`npm install`)
- Contas logadas no Chrome (Instagram + TikTok)

## Setup

```bash
# Instalar dependências
npm install

# Copiar e configurar variáveis de ambiente
cp .env.example .env
# Edite .env com suas configurações

# Iniciar Chrome com debug remoto
.\scripts\launch-chrome.ps1
# ou
scripts\launch-chrome.cmd
```

## Como usar

### Postagem manual
```bash
node scripts\postar-completo.js     # Posta em IG + TT
node scripts\tiktok-poster.js       # Só TikTok
node scripts\instagram-poster.js    # Só Instagram
```

### Postagem agendada
```bash
node scripts\postar-agendado.js
```

### Painel web (Reel Machine Studio)
```bash
npm run dev
# Abra http://localhost:3939
```

### Dashboard Instagram
```bash
node scripts\dashboard.js
# Abra dashboard.html
```

## Colocando vídeos

Coloque os arquivos `.mp4` na pasta definida em `VIDEOS_DIR` (padrão: `~/Downloads/FabricaReels`).

Os vídeos são nomeados em ordem (ex: `reel_1.mp4`, `reel_2.mp4`) e postados sequencialmente.

## Formato padrão

| Plataforma | Resolução | Aspect Ratio |
|-----------|-----------|-------------|
| Instagram Reels | 1080x1920 | 9:16 |
| TikTok | 1080x1920 | 9:16 |
| YouTube Shorts | 1080x1920 | 9:16 |

Vídeos devem estar em **MP4**, codec **H.264**, 30fps, 1080x1920 (portrait).
