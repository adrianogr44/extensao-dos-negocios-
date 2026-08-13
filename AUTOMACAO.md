# Automação Fábrica de Reels — Como Funciona

> Documento explicativo do pipeline de publicação automática de vídeos
> (Instagram / TikTok / YouTube Shorts / Facebook / Kwai).

---

## 1. Visão geral

O sistema baixa vídeos (via **extensão do Chrome** para `Downloads/FabricaReels/`)
e publica automaticamente cada vídeo nas plataformas, **usando o próprio Chrome
já logado** como se uma pessoa estivesse clicando.

**Nenhuma API oficial é usada para postar.** Os scripts dirigem o navegador real
(automação de UI): clicam em botões, selecionam os arquivos de vídeo e digitam as
legendas — exatamente como uma pessoa faria.

---

## 2. O perfil do Chrome (a peça-chave)

A automação **não faz login**. Ela reutiliza um perfil do Chrome isolado onde
**você já fez login nas suas contas** (Instagram, TikTok, YouTube, Facebook, Kwai).

### Como o Chrome da automação abre

`scripts/launch-chrome.ps1` / `scripts/launch-chrome.cmd`:

1. **Fecha qualquer Chrome aberto** (`taskkill /f /im chrome.exe`)
2. Abre um Chrome separado com:
   - `--user-data-dir="%USERPROFILE%\chrome-debug-profile"` → perfil dedicado
   - `--remote-debugging-port=9222` → porta que os scripts usam para controlar
   - `--remote-allow-origins=*` → permite a conexão do Playwright
   - `--no-first-run`

> ⚠️ **Regra de ouro:** as contas (Instagram, TikTok, YouTube, Facebook e Kwai)
> **devem estar logadas nesse perfil** (`C:\Users\adria\chrome-debug-profile\`).
> A extensão de download precisa estar rodando **neste mesmo Chrome** — se a
> extensão estiver em outro perfil sem login, o Instagram nem devolve o ID do
> usuário.

### Por que ele é essencial

- Os scripts se conectam ao Chrome via **CDP (Chrome DevTools Protocol)**:
  ```js
  const browser = await chromium.connectOverCDP('http://127.0.0.1:9222')
  ```
- Se o Chrome não estiver aberto nessa configuração, o agendador o inicia
  sozinho (`postar-agendado.js` testa a porta 9222 e chama `launch-chrome.cmd`).
- **⚠️ Nunca feche essa janela do Chrome** enquanto o agendador estiver ativo:
  as postagens dependem dela.

---

## 3. De onde vêm os vídeos

1. **Extensão do Chrome** (`chrome-extension/`) baixa Reels / Shorts / TikTok
   direto para `C:\Users\<usuário>\Downloads\FabricaReels\` (configurável via
   `VIDEOS_DIR` no `.env`).
2. Também funciona copiando `*.mp4` manualmente para essa pasta.
3. O script varre a pasta, ordena os arquivos (`_1.mp4`, `_2.mp4`, …) e monta a
   **fila de postagem**.

---

## 4. Fila de postagem (`scripts/posts-queue.json`)

Arquivo de estado que vai sendo atualizado a cada publicação:

```json
{
  "videos": [
    {
      "path": "C:/Users/adria/Downloads/FabricaReels/reel_1.mp4",
      "filename": "reel_1.mp4",
      "postedInstagram": false,
      "postedTikTok": false,
      "postedFacebook": false,
      "postedShorts": false,
      "postedKwai": false,
      "instagramDate": null,
      "error": null
    }
  ],
  "currentIndex": 0,
  "dailyCount": 0,
  "dailyCountTikTok": 0,
  "dailyCountFacebook": 0,
  "dailyCountShorts": 0,
  "dailyCountKwai": 0,
  "lastPostDate": ""
}
```

- Cada vídeo tem um **status por plataforma**.
- Quando todos os destinos publicam o vídeo, o `mp4` é **apagado da pasta**.

---

## 5. Fluxo de uma postagem (`scripts/postar-completo.js`)

```
getNextVideos()
  → postToInstagram()
  → postToTikTok()
  → postToFacebook()
  → postToShorts()
  → postToKwai()
  → marca no posts-queue.json → apaga mp4 → notifica Telegram
```

Exemplo — Instagram:

1. Vai para `https://www.instagram.com` (aguarda carregar)
2. Fecha pop-ups ("Agora não" / "Not now")
3. Clica em **Novo post**
4. Envia o vídeo via `input[type=file].setInputFiles(videoPath)`
5. Clica **Avançar** (2x: capa/editar e legenda)
6. Digita a legenda com hashtags
7. Clica **Compartilhar**
8. Confere a mensagem de sucesso na tela

O mesmo padrão se repete no YouTube Studio (Criar → shorts → título →
descrição → Publicar), TikTok, Facebook e Instagram.

---

## 6. Limites diários

Controlados por variáveis no `.env`:

| Variável | Padrão | Descrição |
|---|---|---|
| `INSTAGRAM_DAILY_LIMIT` | 5 | Máximo de posts/dia no Instagram |
| `TIKTOK_DAILY_LIMIT` | 5 | Máximo de posts/dia no TikTok |
| `SHORTS_DAILY_LIMIT` | 5 | Máximo de posts/dia nos Shorts |
| `FACEBOOK_DAILY_LIMIT` | 5 | Máximo de posts/dia no Facebook |
| `KWAI_DAILY_LIMIT` | 0 | Kwai é 0 no `.env` atual (desligado) |
| `POST_INTERVAL_MINUTES` | 60 | Intervalo entre publicações |
| `POST_INTERVAL_RANDOM_MINUTES` | 15 | Variação aleatória do intervalo |

- A contagem diária zera quando muda o dia (`lastPostDate`).
- Há um lock (`scripts/.posting.lock`) para evitar rodadas duplicadas.

---

## 7. Agendador (`scripts/postar-agendado.js`)

- Usa **node-cron** com horários em `scripts/schedule-config.json`:

```json
{
  "times": ["11:30", "18:30"],
  "timezone": "America/Sao_Paulo",
  "enabled": true
}
```

- A cada horário: publica **1 vídeo** (das plataformas com limite livre).
- Se o agendador rodar 2x por engano, use `scripts/matar-agendadores-duplicados.cmd`.

---

## 8. Notificações Telegram

`scripts/notify.js` envia avisos para o Telegram (variáveis `TELEGRAM_BOT_TOKEN`
e `TELEGRAM_CHAT_ID` no `.env`):
- `notifyVideoPosted` → vídeo publicado
- `notifyRunSummary` → resumo da rodada
- `notifyError` → erros

---

## 9. Principais variáveis do `.env`

| Variável | Uso |
|---|---|
| `VIDEOS_DIR` | Pasta dos vídeos (padrão `Downloads/FabricaReels`) |
| `CHROME_DEBUG_PORT` | Porta CDP (padrão `9222`) |
| `CHROME_PATH` | Caminho do Chrome |
| `INSTAGRAM_CAPTION`, `TIKTOK_CAPTION`, `FACEBOOK_CAPTION`, `YOUTUBE_CAPTION`, `SHORTS_CAPTION`, `KWAI_CAPTION` | Legendas/hashtags padrão de cada rede |
| `INSTAGRAM_DAILY_LIMIT`, `TIKTOK_DAILY_LIMIT`, `FACEBOOK_DAILY_LIMIT`, `SHORTS_DAILY_LIMIT`, `KWAI_DAILY_LIMIT` | Limites diários |
| `POST_INTERVAL_MINUTES`, `POST_INTERVAL_RANDOM_MINUTES` | Ritmo entre posts |
| `FACEBOOK_PAGE_URL` | Página/Perfil do Facebook usado |
| `INSTAGRAM_PROFILE`, `TIKTOK_PROFILE`, `YOUTUBE_HANDLE` | Identificadores de debug/análises |
| `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID` | Notificações |

---

## 10. Fluxo completo (diagrama)

```
Extensão do Chrome baixa vídeos
   │
   ▼
Downloads/FabricaReels/*.mp4
   │   ┌──────────────────────────────────────┐
   ├──►│ Chrome debug (porta 9222)            │
   │   │ perfil: chrome-debug-profile         │
   │   │ contas LOGADAS ficam aqui            │
   │   └──────────────────────────────────────┘
   │            ▲ conecta via CDP
   ▼            │
node-cron (11:30, 18:30) → postar-completo.js
   │
   ▼
retorna → Instagram → TikTok → Facebook → Shorts → Kwai (opcional)
   │
   ▼
marca na fila → apaga mp4 → notifica Telegram
```

---

## 11. Problemas comuns

| Sintoma | Causa provável | Solução |
|---|---|---|
| Postagem não avança | Janela do Chrome debug fechada | Rode `scripts/launch-chrome.cmd` e mantenha aberta |
| Instagram da retorno "login necessário" | Perfil `chrome-debug-profile` sem login | Acesse `instagram.com` nesse Chrome e faça login |
| Extensão não acha o ID do usuário | Extensão rodando em outro perfil Chrome | Use o mesmo Chrome `chrome-debug-profile` |
| Posts duplicados no mesmo horário | Dois agendadores abertos | Rode `matar-agendadores-duplicados.cmd` |

---

## Caminhos úteis

| O que | Onde |
|---|---|
| Chrome controlado | `%USERPROFILE%\chrome-debug-profile\` + porta `9222` |
| Vídeos baixados | `C:\Users\<usuário>\Downloads\FabricaReels\` |
| Fila de postagem | `scripts/posts-queue.json` |
| Horários | `scripts/schedule-config.json` |
| Log de postagem | `scripts/postar-log.txt` |
| Logs do scheduler | `scripts/scheduler.out.log` / `scheduler.err.log` |
| Screenshots de debug | `scripts/fb_debug/` |
| Segredos/API | `.env` (não versionado) |