# Publicação via Scraping (TikTok e YouTube)

Fluxo alternativo de publicação que usa **Playwright + navegador headless** para publicar vídeos no TikTok e no YouTube, contornando as limitações das APIs oficiais (que exigem App Review / verificação de parceiro).

> ⚠️ **Atenção:** este fluxo depende do layout dos sites. Se o TikTok ou o YouTube mudar a interface, os seletores dos compositors podem quebrar — use o modo debug para diagnosticar (ver [Debug](#debug)).

---

## Visão Geral

```
Usuário agenda publicação com method=SCRAPE e platforma TIKTOK/YOUTUBE
        │
        ▼
Worker (instrumentation.ts) verifica a cada 60s
        │
        ▼
Busca publications WHERE method='SCRAPE' AND status='SCHEDULED' AND scheduledFor <= now
  AND platforms has TIKTOK/YOUTUBE AND tiktokAccountId/youtubeAccountId NOT NULL
        │
        ▼
Publisher baixa o vídeo (render concluído ou original) do MinIO
        │
        ▼
Recupera cookies criptografados da sessão salva no banco
        │
        ▼
Playwright abre tiktok.com/upload (ou studio.youtube.com), restaura cookies,
faz upload, preenche legenda/título, agenda ou publica
        │
        ▼
Salva resultado (postId/videoId, URL, status) no banco
```

---

## Estrutura de Arquivos

```
apps/dashboard/src/lib/scrape-browser.ts      # Setup Playwright compartilhado (stealth, proxy, cookies)

apps/dashboard/src/lib/tiktok-publisher/
├── types.ts         # Tipos e interfaces (TikTokPublishParams/Result, SessionExpiredError)
├── session.ts       # Login via QR Code / formulário + gerenciamento de sessão
├── composer.ts      # Automação do upload no tiktok.com/upload
└── worker.ts        # Worker que publica publicações agendadas

apps/dashboard/src/app/api/tiktok/
├── accounts/route.ts        # GET/POST/DELETE - gerenciar contas TikTok
└── session/
    ├── init/route.ts        # POST - inicia login (QR code)
    ├── poll/route.ts        # POST - polling até usuário escanear QR / completar login
    ├── status/route.ts      # GET  - status da sessão
    └── [sessionId]/route.ts # DELETE - desconecta sessão

apps/dashboard/src/lib/youtube-publisher/   # mesma estrutura do TikTok
└── (types, session, composer, worker)

apps/dashboard/src/app/api/youtube/         # mesmas rotas do TikTok
└── (accounts, session/*)

apps/dashboard/src/instrumentation.ts       # Registra os workers na inicialização
```

---

## Configuração (passo a passo)

### 1. Variáveis de ambiente (`.env`)

Adicione ao seu `.env` (ver `.env.example`):

```bash
# TikTok
TIKTOK_SCRAPE_PROXY=            # opcional: proxy HTTP para evitar bloqueio (ex: http://user:pass@host:port)
TIKTOK_SCRAPE_USERNAME=         # opcional: e-mail/username para login automático
TIKTOK_SCRAPE_PASSWORD=         # opcional: senha para login automático
TIKTOK_SCRAPE_DEBUG=false       # true para navegador visível + screenshots

# YouTube
YOUTUBE_SCRAPE_PROXY=           # opcional
YOUTUBE_SCRAPE_USERNAME=        # opcional: e-mail Google para login automático
YOUTUBE_SCRAPE_PASSWORD=        # opcional: senha Google
YOUTUBE_SCRAPE_DEBUG=false

# Já existente (obrigatório para criptografar cookies)
TOKEN_ENCRYPTION_KEY=           # AES-256-GCM, mínimo 16 caracteres
```

### 2. Instalar dependência do Playwright

O projeto usa `playwright` como dependência. Garanta que o navegador Chromium esteja instalado:

```bash
cd apps/dashboard
npx playwright install chromium
```

### 3. Cadastrar a conta

Na UI: **Configurações → Contas Meta** (ou equivalente) → seção **TikTok** / **YouTube** → clique em **"Adicionar conta"**.

- **TikTok:** informe o `username` (e opcionalmente o display name). O username é usado como chave única (upsert).
- **YouTube:** informe o `channelName` (e opcionalmente o `channelId`).

Também é possível via API (ver [Testando Manualmente](#testando-manualmente)).

### 4. Conectar a sessão

Clique em **"Conectar via Navegador"** na conta recém-criada:

- **TikTok:**
  1. O backend abre `tiktok.com/login` e tenta capturar o **QR code** da tela de login.
  2. O QR é exibido na UI; **escaneie com o app do TikTok**.
  3. Alternativa: se `TIKTOK_SCRAPE_USERNAME`/`PASSWORD` estiverem configurados e o formulário de login aparecer, o login é feito automaticamente.
  4. O polling detecta o cookie `sessionid`, criptografa e salva no banco → sessão `active`.

- **YouTube:**
  1. O backend abre `studio.youtube.com`.
  2. Se ainda não houver sessão Google nos cookies, o Studio redireciona para `accounts.google.com`.
  3. Com `YOUTUBE_SCRAPE_USERNAME`/`PASSWORD` configurados, o login é feito automaticamente (e-mail → Próxima → senha → Entrar).
  4. **Sem credenciais:** o navegador fica aberto em background aguardando você concluir o login manualmente no Google; o polling verifica quando os cookies `SID`/`SAPISID` aparecem.
  5. Cookies salvos → sessão `active`.

> O YouTube exige **2FA/verificação** em muitas contas. Se ativado, o login automático não conclui sozinho — o fluxo cai no "aguardando login manual" (item 4). É o caminho recomendado para contas com 2FA.

### 5. Agendar publicações

Na UI: **Publicações → Nova** (ou **Lote**) → selecione a(s) plataforma(s) **TikTok/YouTube** e a conta correspondente → agende.

O método `SCRAPE` é o padrão para essas plataformas. O worker processa automaticamente quando `scheduledFor` chega.

---

## Fluxo de Publicação (Worker)

Cada plataforma tem seu worker registrado em `src/instrumentation.ts`:

- `startTikTokScrapeWorker()` → busca `platforms: { has: 'TIKTOK' }`
- `startYouTubeScrapeWorker()` → busca `platforms: { has: 'YOUTUBE' }`

Intervalo: **60 segundos**. Publicações com sessão inválida são marcadas como `FAILED` e a sessão vira `expired`.

### Etapas da publicação (TikTok - composer.ts)

1. Baixa o vídeo do MinIO (usa o **render concluído** se existir, senão o original)
2. Abre `tiktok.com/upload` com cookies restaurados
3. Se cair em `/login` ou `/auth` → `SessionExpiredError`
4. Faz upload via `input[type="file"]`
5. Preenche a **legenda** (`div[contenteditable="true"]`) com hashtags + descrição
6. Se `scheduledFor` no futuro: clica em "Agendar" e preenche data/hora (best-effort)
7. Clica **Publicar** / **Post**
8. Extrai o `postId` da URL e salva no banco

### Etapas da publicação (YouTube - composer.ts)

1. Baixa o vídeo do MinIO (render concluído ou original)
2. Abre `studio.youtube.com` com cookies restaurados
3. Se cair em `accounts.google.com` ou `/login` → `SessionExpiredError`
4. Abre o menu **Criar → Enviar vídeos**
5. Faz upload via `input[type="file"]`
6. Preenche o **título** (`#title-textarea`) com hashtags + descrição
7. Marca **"Não é conteúdo para crianças"**
8. Navega pelas etapas (Próxima/Next) até a tela de visibilidade
9. Seleciona **Público**
10. Clica **Publicar**
11. Extrai o `videoId` da URL (`studio.youtube.com/video/{id}`) e salva no banco

---

## Debug

Ative `TIKTOK_SCRAPE_DEBUG=true` e/ou `YOUTUBE_SCRAPE_DEBUG=true` para:
- Executar o navegador em modo **visível** (`headless: false`)
- Salvar **screenshots** a cada etapa
  - Login: `tmp/tt-login-*/` e `tmp/yt-login-*/`
  - Publicação: `tmp/tt-debug-*/` e `tmp/yt-debug-*/`
- Logs detalhados no console

Os screenshots ficam em `/tmp` (Linux). Use-os para diagnosticar seletores quebrados.

---

## Modelos do Banco

### TiktokAccount / YoutubeAccount

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `id` | String | Cuid, gerado automaticamente |
| `username` / `channelName` | String | Identificador único (TikTok: `@@unique`) |
| `displayName` / `channelId` | String? | Nome de exibição / ID do canal |
| `isActive` | Boolean | Se a conta está ativa |
| `connectedAt` / `lastSyncedAt` | DateTime? | Datas de conexão/última sincronia |

### TiktokSession / YoutubeSession

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `id` | String | Cuid |
| `tiktokAccountId` / `youtubeAccountId` | String? | Relação com a conta (`@unique`) |
| `encryptedCookies` | String | Cookies criptografados (AES-256-GCM) |
| `status` | String | `active`, `expired`, `requires_login` |
| `loggedInAs` | String? | Nome da conta logada |
| `ttUserId` / `googleUserId` | String? | ID do usuário |
| `lastUsedAt` / `expiresAt` | DateTime? | Último uso / expiração |

### Publication (campos relacionados)

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `tiktokAccountId` / `youtubeAccountId` | String? | Conta de destino da publicação |
| `platforms` | Platform[] | Inclui `TIKTOK` / `YOUTUBE` |

---

## Possíveis Problemas

### "Não foi possível obter QR code nem formulário de login do TikTok"

O TikTok mudou o layout da tela de login ou está bloqueando o acesso. Configure `TIKTOK_SCRAPE_USERNAME`/`PASSWORD` ou ative `TIKTOK_SCRAPE_DEBUG=true` e verifique os screenshots.

### Sessão Google com 2FA não completa o login

O login automático não consegue concluir a verificação em duas etapas. Sem credenciais configuradas, o navegador fica aberto para **login manual** — conclua no Google e o polling detectará os cookies. Alternativa: usar uma conta sem 2FA para automação.

### Sessão expirada ao publicar

Cookies do TikTok (`sessionid`) e do Google (`SID`/`SAPISID`) expiram. Reconecte a sessão pela página de configurações.

### Plataforma bloqueia o headless

- Use **proxy residencial** (`TIKTOK_SCRAPE_PROXY`/`YOUTUBE_SCRAPE_PROXY`); datacenter proxies costumam ser bloqueados.
- O navegador já usa stealth patches (`navigator.webdriver`, `navigator.plugins`, locale `pt-BR`, timezone `America/Sao_Paulo`).
- Se o bloqueio persistir, aumente os delays ou rode com `DEBUG=true` para investigar.

### "Não foi possível encontrar o botão de publicar" (YouTube)

O Studio mudou o seletor. Ative `YOUTUBE_SCRAPE_DEBUG=true` e verifique os screenshots de cada etapa para atualizar os seletores no `composer.ts`.

### Vídeo não aparece no formulário

O upload usa `input[type="file"]`. Se o seletor falhar, verifique os screenshots de debug. O compositor espera o processamento do vídeo (até 30s no YouTube).

---

## Testando Manualmente

```bash
BASE=http://localhost:3000

# 1. Criar conta TikTok
curl -X POST $BASE/api/tiktok/accounts \
  -H 'Content-Type: application/json' \
  -d '{"username":"meu_usuario"}'

# 2. Iniciar login TikTok (retorna QR em base64 + sessionId)
curl -X POST $BASE/api/tiktok/session/init \
  -H 'Content-Type: application/json' \
  -d '{"tiktokAccountId":"SEU_TT_ACCOUNT_ID"}'

# 3. Fazer polling até escanear o QR
curl -X POST $BASE/api/tiktok/session/poll \
  -H 'Content-Type: application/json' \
  -d '{"tiktokAccountId":"SEU_TT_ACCOUNT_ID"}'

# 4. Verificar status
curl "$BASE/api/tiktok/session/status?tiktokAccountId=SEU_TT_ACCOUNT_ID"

# 5. Desconectar
curl -X DELETE $BASE/api/tiktok/session/SESSION_ID

# YouTube (mesma estrutura)
curl -X POST $BASE/api/youtube/accounts \
  -H 'Content-Type: application/json' \
  -d '{"channelName":"Meu Canal"}'

curl -X POST $BASE/api/youtube/session/init \
  -H 'Content-Type: application/json' \
  -d '{"youtubeAccountId":"SEU_YT_ACCOUNT_ID"}'

curl -X POST $BASE/api/youtube/session/poll \
  -H 'Content-Type: application/json' \
  -d '{"youtubeAccountId":"SEU_YT_ACCOUNT_ID"}'

curl "$BASE/api/youtube/session/status?youtubeAccountId=SEU_YT_ACCOUNT_ID"
```

---

## Prerequisitos

- `playwright` instalado no `apps/dashboard` (`npx playwright install chromium`)
- MinIO acessível (para baixar os vídeos a publicar)
- `TOKEN_ENCRYPTION_KEY` definido no `.env`
- Banco migrado (`20260804_add_tiktok_youtube_publishers`)
