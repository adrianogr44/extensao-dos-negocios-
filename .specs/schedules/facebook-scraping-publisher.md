---
tags: [spec, facebook, scraping, playwright, scheduler, alternative-to-meta-api]
date: 2026-07-29
status: draft
---

# Facebook Scraping Publisher

Alternativa via scraping para agendar e publicar vídeos no Facebook, substituindo a dependência do App Review da Meta Graph API.

---

## 1. Contexto

### Problema

A Meta Graph API exige **App Review** para as permissões `pages_manage_posts` e `pages_read_engagement`. O processo leva de 2 a 4 semanas por permissão, exige vídeo screencast demonstrando o uso, e pode ser rejeitado sem garantia de aprovação. Enquanto o App Review não é aprovado, o fluxo de publicação via API oficial não funciona.

### Objetivo

Criar um mecanismo alternativo de publicação via **scraping com Playwright** que:

- Publique vídeos no Feed da página do Facebook
- Suporte agendamento (data/hora futura)
- Mantenha compatibilidade com o modelo `Publication` e `PublicationLog` existentes
- Funcione em paralelo com a API oficial (híbrido, escolhido por publicação)
- Tenha resiliência contra bloqueios do Facebook

### Não escopo

- Publicação no Instagram (apenas Facebook Feed)
- Curtidas, comentários, mensagens
- Extração de dados / analytics
- Múltiplas contas simultâneas (uma sessão por vez)

---

## 2. Arquitetura

### 2.1 Visão Geral

```
┌─────────────────────────────────────────────────────────┐
│                   Dashboard (Next.js)                    │
│                                                         │
│  ┌──────────┐   ┌────────────────┐   ┌───────────────┐  │
│  │ Agendar   │   │ Settings       │   │ Status        │  │
│  │ (UI atual)│   │ Conectar FB    │   │ (UI atual)    │  │
│  └────┬─────┘   └───────┬────────┘   └───────┬───────┘  │
│       │                 │                    │          │
│       ▼                 ▼                    ▼          │
│  ┌─────────────────────────────────────────────────┐    │
│  │              API Routes                          │    │
│  │  /api/meta/publications/*  (existente)           │    │
│  │  /api/facebook/session/*   (novo)               │    │
│  └─────────────────────┬───────────────────────────┘    │
└────────────────────────┼────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────┐
│              instrumentation.ts                          │
│                                                         │
│  startPublicationScheduler(API) ← existente             │
│  + startFacebookScrapeWorker(SCRAPE)  ← novo            │
└────────────────────────┬────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────┐
│           lib/facebook-publisher/                        │
│                                                         │
│  worker.ts     → Loop principal (setInterval 60s)       │
│  session.ts    → Login via QR Code + cookie mgmt        │
│  browser.ts    → Playwright setup (stealth, proxy)      │
│  composer.ts   → Automação do formulário de post        │
│  types.ts      → Tipos compartilhados                   │
└─────────────────────────────────────────────────────────┘
```

### 2.2 Dependências

```json
{
  "dependencies": {
    "playwright": "^1.49.0"
  },
  "devDependencies": {
    "@playwright/browser-chromium": "^1.49.0"
  }
}
```

O Chromium é incluído via `@playwright/browser-chromium` (~300MB em produção). Alternativa futura: [`playwright-core`](https://playwright.dev/docs/browsers) com Chromium system-installado.

Pacotes dispensados (já existentes no projeto e reutilizados):

- `@aws-sdk/client-s3` — download do vídeo do MinIO
- `nanoid` — IDs temporários
- `execa` — se necessário para spawn do browser
- `zod` — validação nos endpoints

### 2.3 Proxy Residencial

Playwright aceita proxy via `browser.newContext({ proxy: ... })`. Configurável via env:

```env
FB_SCRAPE_PROXY=http://user:pass@residential-proxy:port
FB_SCRAPE_PROXY_LIST=                # opcional: lista de proxies para rodízio
```

Proxy é obrigatório para produção. Sem proxy, o Facebook detecta headless e bloqueia em poucas requisições.

---

## 3. Modelos de Dados

### 3.1 Novo Modelo: FacebookSession

```prisma
model FacebookSession {
  id            String         @id @default(cuid())
  // Relacionamento opcional com MetaAccount
  metaAccountId String?        @unique
  metaAccount   MetaAccount?   @relation(fields: [metaAccountId], references: [id])

  // Cookies criptografados (AES-256-GCM, mesma lib de encryption.ts)
  encryptedCookies String      @db.Text

  // Status da sessão
  status         SessionStatus @default(active)

  // Informação da conta logada
  loggedInAs     String?       // nome do perfil logado
  fbUserId       String?       // user_id do Facebook

  // Metadata
  lastUsedAt     DateTime?
  expiresAt      DateTime?
  createdAt      DateTime      @default(now())
  updatedAt      DateTime      @updatedAt
}

enum SessionStatus {
  active
  expired
  requires_login
}
```

### 3.2 Campo novo em Publication

```prisma
model Publication {
  // ... campos existentes ...

  method         String        @default("API")   // "API" | "SCRAPE"

  // ... resto dos campos ...
}
```

O campo `method` define qual worker publica o vídeo:

- `API`: worker atual da Meta Graph API (`publication-scheduler.ts`)
- `SCRAPE`: novo worker do Playwright (`facebook-publisher/worker.ts`)

### 3.3 Migração necessária

```bash
npx prisma migrate dev --name add_facebook_session_and_publication_method
```

---

## 4. Gerenciamento de Sessão

### 4.1 Fluxo de Login via QR Code

```
Usuário                          Dashboard                        Server (Playwright)
──────                          ─────────                        ──────────────────
   │                                │                                   │
   │  Clica "Conectar Facebook"     │                                   │
   │───────────────────────────────>│                                   │
   │                                │  POST /api/facebook/session/init  │
   │                                │──────────────────────────────────>│
   │                                │                                   │── Inicia
   │                                │                                   │── browser
   │                                │                                   │── Abre
   │                                │                                   │   facebook.com
   │                                │                                   │── Gera QR code
   │                                │                                   │   (login via
   │                                │                                   │    dispositivo)
   │                                │  { qrCode: "base64..." }         │
   │                                │<──────────────────────────────────│
   │  Exibe QR code na tela        │                                   │
   │<───────────────────────────────│                                   │
   │                                │                                   │
   │  Usuário escaneia com          │                                   │
   │  o celular                     │                                   │
   │──────────────────────────────────────────────────────────────────>│
   │                                │                                   │── Detecta
   │                                │                                   │   navegação
   │                                │                                   │── Captura
   │                                │                                   │   cookies
   │                                │                                   │── Encripta
   │                                │                                   │── Salva no DB
   │                                │                                   │── Fecha
   │                                │                                   │   browser
   │                                │                                   │
   │                                │  POST /api/facebook/session/poll  │
   │  (polling a cada 2s)          │──────────────────────────────────>│
   │<───────────────────────────────│  { status: "active",              │
   │                                │    loggedInAs: "Minha Página" }   │
   │                                │<──────────────────────────────────│
   │  "Conectado!" ✅              │                                   │
```

### 4.2 Endpoints

#### `POST /api/facebook/session/init`

Inicia o Playwright server-side, abre `https://facebook.com`, retorna o QR code em base64 para o dashboard exibir.

**Request:**
```json
{
  "metaAccountId": "ckl..."
}
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "sessionId": "cks...",
    "qrCode": "data:image/png;base64,iVBOR...",
    "expiresIn": 120
  }
}
```

**Comportamento:**
- Cria um registro `FacebookSession` com `status: requires_login`
- Abre navegador Playwright com stealth + proxy
- Navega para `https://facebook.com`
- Salva screenshot do QR code em buffer
- Retorna imagem em base64
- Mantém página aberta, com timeout de 120s
- Se passar do timeout sem login, retorna erro e fecha browser

#### `POST /api/facebook/session/poll`

Verifica se o usuário já completou o login escaneando o QR code.

**Request:**
```json
{
  "sessionId": "cks..."
}
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "status": "active",
    "loggedInAs": "Minha Pagina",
    "fbUserId": "1000123456789"
  }
}
```

**Comportamento:**
- Verifica se a página já navegou para o feed principal
- Se sim: captura todos cookies, encrypta com `encryptToken()`, salva no `FacebookSession`, atualiza status para `active`
- Se não: retorna `status: requires_login`
- Se timeout: retorna `status: expired`, fecha browser

#### `DELETE /api/facebook/session/:id`

Remove a sessão (desconectar).

#### `GET /api/facebook/session/:id/status`

Retorna status atual da sessão (ativo, expirado, etc).

### 4.3 Renovação de Sessão

Cookies do Facebook expiram (geralmente em dias ou semanas). O worker detecta falha de autenticação:

- Se `composer.ts` detectar que não está logado (URL redirecionou para login, ou elemento de login visível)
- Worker atualiza `FacebookSession.status` para `expired`
- Dashboard exibe alerta: "Sessão do Facebook expirada. Reconecte-se."
- Publicações com `method: SCRAPE` e status `SCHEDULED` não são processadas até sessão ser renovada

---

## 5. Worker de Publicação

### 5.1 `worker.ts`

Inspirado no `publication-scheduler.ts` existente, roda em `setInterval`:

```typescript
// src/lib/facebook-publisher/worker.ts

const INTERVAL_MS = 60_000  // 60 segundos

let intervalId: NodeJS.Timeout | null = null

export function startFacebookScrapeWorker() {
  if (intervalId) return
  console.log('[FB Publisher] Worker iniciado')
  processDuePublications()
  intervalId = setInterval(processDuePublications, INTERVAL_MS)
}

export function stopFacebookScrapeWorker() {
  if (!intervalId) return
  clearInterval(intervalId)
  intervalId = null
}

async function processDuePublications() {
  const publications = await prisma.publication.findMany({
    where: {
      method: 'SCRAPE',
      status: 'SCHEDULED',
      scheduledFor: { lte: new Date() },
      metaAccount: { isActive: true },
    },
    include: {
      metaAccount: true,
    },
  })

  for (const pub of publications) {
    try {
      await publishViaScrape(pub)
    } catch (err) {
      console.error(`[FB Publisher] Falha na publicação ${pub.id}:`, err)
    }
  }
}
```

### 5.2 Função `publishViaScrape()`

```typescript
async function publishViaScrape(publication: Publication & { metaAccount: MetaAccount }) {
  // 1. Busca sessão ativa para a metaAccount
  const session = await prisma.facebookSession.findUnique({
    where: { metaAccountId: publication.metaAccountId },
  })
  if (!session || session.status !== 'active') {
    throw new Error('Sessão Facebook inativa para esta conta')
  }

  // 2. Busca o vídeo
  const video = await prisma.video.findUnique({
    where: { id: publication.videoId },
  })
  if (!video) throw new Error('Vídeo não encontrado')

  // 3. Download do vídeo do MinIO para /tmp
  const tmpDir = await mkdtemp(join(tmpdir(), 'fb-pub-'))
  const videoPath = join(tmpDir, video.filename)
  await downloadFile(video.minioBucket, video.minioKey, videoPath)

  // 4. Decrypt cookies
  const cookies = decryptToken(session.encryptedCookies, process.env.TOKEN_ENCRYPTION_KEY!)

  // 5. Publica via Playwright
  const result = await publishToFacebook({
    cookies: JSON.parse(cookies),
    pageId: publication.metaAccount.facebookPageId,
    videoPath,
    description: publication.description,
    hashtags: JSON.parse(publication.hashtags),
    scheduledFor: publication.scheduledFor > new Date()
      ? publication.scheduledFor
      : undefined,
    proxy: process.env.FB_SCRAPE_PROXY,
  })

  // 6. Atualiza publicação
  await prisma.publication.update({
    where: { id: publication.id },
    data: {
      status: result.status === 'scheduled' ? 'SCHEDULED' : 'PUBLISHED',
      metaPostId: result.postId,
      publishedAt: result.status === 'published' ? new Date() : null,
    },
  })

  // 7. Log
  await prisma.publicationLog.create({
    data: {
      publicationId: publication.id,
      action: result.status === 'scheduled' ? 'SCHEDULED' : 'PUBLISHED',
      metaResponse: JSON.stringify(result),
    },
  })

  // 8. Cleanup
  await rm(tmpDir, { recursive: true, force: true })
}
```

### 5.3 Registro no `instrumentation.ts`

```typescript
// instrumentation.ts (existente)
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { startRenderWorker } = await import('./lib/render-worker')
    startRenderWorker()

    const { startPublicationScheduler } = await import('./lib/meta/publication-scheduler')
    startPublicationScheduler(60000)

    // NOVO: worker de scraping do Facebook
    const { startFacebookScrapeWorker } = await import('./lib/facebook-publisher/worker')
    startFacebookScrapeWorker()
  }
}
```

---

## 6. Automação do Formulário (composer.ts)

### 6.1 Estrutura da Página

O Facebook tem diferentes fluxos de postagem dependendo do tipo de conteúdo. Para **vídeo no Feed da Página**:

Opção A — **Página de Vídeos** (recomendada):
`https://www.facebook.com/{page_username}/videos/?ref=page_internal`
Botão "Adicionar vídeo" → Upload → Preencher descrição → Agendar/Publicar

Opção B — **Composer universal**:
Clique no "Escreva algo..." → Abre o modal de criação → upload de vídeo

### 6.2 Fluxo Passo a Passo

```typescript
// src/lib/facebook-publisher/composer.ts

export async function publishToFacebook(params: {
  cookies: any[]
  pageId: string          // formato: "100123456789"
  pageName?: string
  videoPath: string
  description: string
  hashtags: string[]
  scheduledFor?: Date
  proxy?: string
}): Promise<{ status: 'published' | 'scheduled'; postId: string; postUrl?: string }> {

  const browser = await chromium.launch({
    headless: true,
    proxy: params.proxy ? { server: params.proxy } : undefined,
    args: ['--no-sandbox', '--disable-blink-features=AutomationControlled'],
  })

  const context = await browser.newContext({
    viewport: { width: 1366, height: 768 },
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ...',
    locale: 'pt-BR',
  })

  // Restaura cookies da sessão
  await context.addCookies(params.cookies)

  const page = await context.newPage()

  try {
    // Navega para a página
    await page.goto(`https://www.facebook.com/${params.pageId}/videos/`, {
      waitUntil: 'networkidle',
      timeout: 30000,
    })

    // Verifica se está logado (seletores aproximados)
    const isLoggedIn = await page.$('[aria-label="Publicar"]')
    if (!isLoggedIn) throw new SessionExpiredError()

    // Clica "Adicionar vídeo"
    await page.click('text=Adicionar vídeo')
    await page.waitForSelector('input[type="file"]', { timeout: 10000 })

    // Upload do vídeo
    const fileInput = await page.$('input[type="file"]')
    await fileInput!.setInputFiles(params.videoPath)

    // Aguarda upload concluir (barra de progresso some)
    await page.waitForSelector('[role="progressbar"]', { state: 'detached', timeout: 120000 })

    // Preenche descrição
    const fullDescription = [...params.hashtags, params.description].join('\n')
    await page.fill('[contenteditable="true"]', fullDescription)

    // Se agendado
    if (params.scheduledFor) {
      // Clica no menu de agendamento
      await page.click('text=Agendar')
      // Preenche data/hora no date picker (seletores a definir)
      await page.fill('input[type="datetime-local"]',
        formatDateTimeLocal(params.scheduledFor))
    }

    // Clica Publicar / Agendar
    await page.click('text=Publicar')

    // Aguarda confirmação
    await page.waitForTimeout(3000)

    // Captura URL do post (da notificação de sucesso ou da URL atual)
    const postUrl = page.url()
    const postId = extractPostId(postUrl)

    return {
      status: params.scheduledFor ? 'scheduled' : 'published',
      postId,
      postUrl,
    }

  } finally {
    await browser.close()
  }
}
```

### 6.3 Seletores

**⚠️ ATENÇÃO:** O Facebook usa classes CSS ofuscadas (ex: `x1lliihq x1n2onr6 xh8yej3`) que mudam a cada deploy. A estratégia de seletores deve priorizar:

1. **Text matching**: `text=Publicar`, `text=Adicionar vídeo`, `text=Agendar`
2. **ARIA labels**: `[aria-label="Publicar"]`, `[aria-label="Adicionar vídeo"]`
3. **Role selectors**: `[role="button"]`, `[role="dialog"]`, `[role="progressbar"]`
4. **Placeholder**: `input[placeholder="Escreva algo..."]`

A seção **6.5 Manutenção de seletores** detalha como monitorar e atualizar.

### 6.4 Tratamento de Erros

| Condição | Ação |
|----------|------|
| Sessão expirada (redirecionou para login) | Lança `SessionExpiredError`, atualiza `FacebookSession.status = expired` |
| Upload falhou (timeout > 120s) | Retry 1x com browser novo; se falhar de novo, marca `FAILED` |
| Elemento não encontrado | Screenshot + HTML snapshot salvos em `/tmp/fb-debug-{id}.png` |
| CAPTCHA aparece | Pausa worker, notifica admin, marca `requires_login` |
| Post publicado mas URL não capturada | Salva URL atual do navegador como fallback |

### 6.5 Manutenção de Seletores

Quando o Facebook atualizar a interface e os seletores quebrarem:

1. **Ativar modo debug**: `FB_SCRAPE_DEBUG=true` faz o worker salvar screenshots + HTML de cada passo
2. **Analisar HTML**: Os snapshots ficam em `/tmp/fb-debug-*.html`
3. **Atualizar composer.ts**: Ajustar os seletores no arquivo
4. **Testar**: Rodar manualmente com `FB_SCRAPE_DEBUG=true` e verificar

Espera-se manutenção a cada 2-4 meses. O risco é aceitável versus esperar App Review da Meta.

---

## 7. Integração com a UI Existente

### 7.1 Settings — Conectar Facebook via Navegador

Nova seção na página `settings/meta-accounts/page.tsx`:

```
┌─────────────────────────────────────────┐
│  Contas Conectadas                      │
│                                         │
│  ┌─────────────────────────────────┐    │
│  │ Minha Página                    │    │
│  │ 📷 avatar                       │    │
│  │ @minhapagina                    │    │
│  │                                  │    │
│  │ [API] [SCRAPE]                  │    │  ← seletor de método padrão
│  │                                  │    │
│  │ Sessão Scraping: 🟢 Ativa       │    │  ← status da sessão
│  │ [🔄 Reconectar via Navegador]   │    │  ← botão QR code
│  │                                  │    │
│  │ [Desconectar]                    │    │
│  └─────────────────────────────────┘    │
└─────────────────────────────────────────┘
```

### 7.2 Agendamento — Seletor de Método

No formulário de agendamento (`schedule-form.tsx`) e no batch schedule:

```
┌──────────────────────────────────┐
│ Método de publicação             │
│                                  │
│ ● API oficial (Meta)            │
│ ○ Scraping (navegador)          │
│                                  │
│ ⚠ Scraping: requer sessão       │
│   ativa do Facebook.             │
│   [Verificar sessão]             │
└──────────────────────────────────┘
```

### 7.3 Worker Status no Dashboard

Componente ou seção na página de status:

```
🤖 Facebook Scrape Worker
─────────────────────────
Status: 🟢 Rodando (a cada 60s)
Sessão: 🟢 Ativa (Minha Página)
Última execução: 29/07 14:32:05
Próxima execução: 29/07 14:33:05
Publicações na fila: 3
```

---

## 8. Riscos e Mitigação

| Risco | Probabilidade | Impacto | Mitigação |
|-------|:-----------:|:-------:|-----------|
| Facebook atualizar UI e quebrar seletores | Alta | Médio | Screenshots de debug, manutenção periódica, modularização do composer.ts |
| Sessão expirar | Alta | Alto | Monitoramento de status, notificação no dashboard, re-login via QR em < 2 min |
| Bloqueio de IP por scraping | Média | Alto | Proxy residencial obrigatório, delay entre publicações, rate limiting |
| CAPTCHA no login ou postagem | Média | Médio | Notificação e pausa do worker, fallback para login manual |
| Playwright detectado como bot | Média | Alto | Stealth patches, `--disable-blink-features=AutomationControlled`, user-agent real |
| 2FA na conta do Facebook | Baixa | Alto | QR Code login contorna 2FA (já que você escaneia com o celular autenticado) |
| Violação de ToS do Facebook | — | Alto | Uso interno/ferramenta própria sem redistribuição. Risco inerente ao scraping. |

---

## 9. Plano de Implementação

### Fase 1 — Fundação (3-5 dias)

1. Adicionar dependências: `playwright`, `@playwright/browser-chromium`
2. Criar migração Prisma: `FacebookSession` + `Publication.method`
3. Criar `types.ts` com interfaces do publisher
4. Criar `session.ts`: login via QR Code com Playwright
5. Criar endpoints:
   - `POST /api/facebook/session/init`
   - `POST /api/facebook/session/poll`
   - `GET /api/facebook/session/:id/status`
   - `DELETE /api/facebook/session/:id`

### Fase 2 — Publisher (3-5 dias)

6. Criar `browser.ts`: setup do Playwright com stealth + proxy + cookie restore
7. Criar `composer.ts`: fluxo de publicação (upload, descrição, agendamento)
8. Criar `worker.ts`: loop de verificação de publications vencidas
9. Registrar worker no `instrumentation.ts`

### Fase 3 — UI (2-3 dias)

10. Atualizar settings para exibir status da sessão e botão reconectar
11. Adicionar seletor de método no formulário de agendamento
12. Adicionar indicador de worker na página de status

### Fase 4 — Testes e Debug (2-3 dias)

13. Testar com conta real e página real
14. Ajustar seletores do composer (se necessário)
15. Adicionar modo debug com screenshots
16. Testar renovação de sessão (expirar cookies forçadamente)

---

## 10. Referências

- [Playwright Docs — Browser Context](https://playwright.dev/docs/api/class-browsercontext)
- [Playwright Docs — Network](https://playwright.dev/docs/network#handle-browser-cookies)
- [puppeteer-extra-plugin-stealth](https://github.com/berstend/puppeteer-extra/tree/master/packages/puppeteer-extra-plugin-stealth) (referência de técnicas anti-detecção)
- [playwright-stealth](https://www.npmjs.com/package/playwright-stealth) (port do stealth para Playwright)
- [how-to-scrape-facebook](https://mantisapi.com/blog/how-to-scrape-facebook-data-2026) — Pesquisa sobre anti-bot do Facebook
- [Facebook Graph API — App Review docs](https://developers.facebook.com/docs/app-review) (oficial)

---

## Apêndice A — Debug Mode

Quando `FB_SCRAPE_DEBUG=true`, o `composer.ts` salva:

```
/tmp/fb-debug-{timestamp}/
├── 01-initial.png           # Screenshot ao abrir a página
├── 02-upload-dialog.png     # Screenshot do diálogo de upload
├── 03-after-upload.png      # Screenshot após upload
├── 04-filled-description.png
├── 05-before-publish.png
├── 06-after-publish.png
├── page.html                # HTML completo da página (último estado)
└── cookies.json             # Cookies no momento do erro
```

## Apêndice B — Exemplo de Uso Manual (CLI)

Para testes durante desenvolvimento:

```bash
# Login via QR Code
curl -X POST http://localhost:3000/api/facebook/session/init \
  -H "Content-Type: application/json" \
  -d '{"metaAccountId": "ckl..."}'
# → retorna QR code em base64

# Poll até logar
curl -X POST http://localhost:3000/api/facebook/session/poll \
  -H "Content-Type: application/json" \
  -d '{"sessionId": "cks..."}'
# → retorna status

# Publicar um vídeo manualmente
npx tsx src/scripts/fb-publish.ts \
  --publicationId "ckm..." \
  --debug
```
