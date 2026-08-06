# Publicação via Scraping (Facebook)

Fluxo alternativo de publicação que usa **Playwright + navegador headless** para publicar vídeos no Facebook, contornando as limitações da API oficial (que exige App Review).

---

## Visão Geral

```
Usuário agenda publicação com method=SCRAPE
        │
        ▼
Worker (instrumentation.ts) verifica a cada 60s
        │
        ▼
Busca publications WHERE method='SCRAPE' AND status='SCHEDULED' AND scheduledFor <= now
        │
        ▼
Publisher busca cookies da sessão salva no banco
        │
        ▼
Playwright abre facebook.com, restaura cookies, navega até o formulário de postagem
        │
        ▼
Faz upload do vídeo, preenche descrição/hashtags, agenda ou publica
        │
        ▼
Salva resultado (postId, status) no banco
```

---

## Estrutura de Arquivos

```
apps/dashboard/src/lib/facebook-publisher/
├── types.ts         # Tipos e interfaces
├── browser.ts       # Setup Playwright (stealth, proxy, cookies)
├── session.ts       # Login via QR Code + gerenciamento de sessão
├── composer.ts      # Automação do formulário de post do Facebook
└── worker.ts        # Worker que publica publicações agendadas

apps/dashboard/src/app/api/facebook/session/
├── init/route.ts        # POST - inicia login via QR Code
├── poll/route.ts        # POST - polling até usuário escanear QR
├── status/route.ts      # GET  - status da sessão
└── [sessionId]/route.ts # DELETE - desconecta sessão

apps/dashboard/src/instrumentation.ts  # Registra o worker na inicialização
```

---

## Fluxo de Autenticação (QR Code)

1. **Usuário acessa** Configurações > Contas Meta > "Conectar via Navegador"
2. **Frontend chama** `POST /api/facebook/session/init` com `metaAccountId`
3. **Backend inicia** Playwright, abre `facebook.com`, captura QR code da tela de login
4. **Retorna** QR code em base64 + sessionId
5. **Frontend exibe** QR code e faz polling via `POST /api/facebook/session/poll`
6. **Usuário escaneia** QR com o app do Facebook
7. **Polling detecta** cookies `c_user` + `xs`, criptografa e salva no banco
8. **Sessão ativa** — a partir daqui o worker consegue publicar

### Tratamento de sessão existente

Se o Playwright abrir o Facebook e já existir uma sessão ativa (cookies salvos anteriormente), ele restaura os cookies automaticamente — não precisa escanear QR novamente.

---

## Fluxo de Publicação (Worker)

O worker roda em `src/instrumentation.ts` via `startFacebookScrapeWorker()`:

```typescript
const WORKER_INTERVAL = 60_000 // 60s

async function workerLoop() {
  const pending = await prisma.publication.findMany({
    where: {
      method: 'SCRAPE',
      status: 'SCHEDULED',
      scheduledFor: { lte: new Date() },
    },
    include: { video: true, metaAccount: true },
  })

  for (const pub of pending) {
    const cookies = await getSessionCookies(pub.metaAccountId)
    if (!cookies.length) {
      await markFailed(pub, 'Sessão expirada')
      continue
    }
    await publishVideo({ cookies, pageId, videoPath, description, ... })
  }
}
```

### Etapas da publicação (composer.ts)

1. Abre `facebook.com` com cookies restaurados
2. Navega para a página (`/{pageUrl}/posts/`)
3. Clica em "Fazer uma publicação" / "Criar publicação"
4. Faz upload do vídeo (input type=file)
5. Aguarda processamento do vídeo
6. Preenche descrição + hashtags no editor (`[contenteditable]`)
7. Se `scheduledFor`: clica em "Agendar" e seleciona data/hora
8. Clica "Publicar" / "Agendar"
9. Aguarda confirmação e captura URL da postagem
10. Atualiza `Publication` no banco com status + postId

### Debug

Ative `FB_SCRAPE_DEBUG=true` nas variáveis de ambiente para:
- Executar o navegador em modo **visível** (`headless: false`)
- Salvar **screenshots** em cada etapa (pasta `tmp/fb-scrape-{timestamp}/`)
- Logs detalhados no console

---

## Modelos do Banco

### FacebookSession

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `id` | String | Cuid, gerado automaticamente |
| `metaAccountId` | String? | Relação com MetaAccount (único) |
| `encryptedCookies` | String | Cookies criptografados (AES-256-GCM) |
| `status` | String | `active`, `expired`, `requires_login` |
| `loggedInAs` | String? | Nome da conta logada |
| `fbUserId` | String? | ID numérico do Facebook |
| `lastUsedAt` | DateTime? | Último uso |
| `expiresAt` | DateTime? | Expiração da sessão |

### Publication (campo adicionado)

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `method` | String | `API` ou `SCRAPE` (default: `API`) |

---

## Variáveis de Ambiente

| Variável | Obrigatório | Descrição |
|----------|-------------|-----------|
| `FB_SCRAPE_PROXY` | Recomendado | Proxy HTTP para evitar bloqueio (ex: `http://user:pass@host:port`) |
| `FB_SCRAPE_DEBUG` | Opcional | `true` para modo debug com navegador visível |
| `TOKEN_ENCRYPTION_KEY` | Sim | Chave AES-256-GCM para criptografar cookies (min 16 caracteres) |

---

## Possíveis Problemas

### "Sessão expirada" ao publicar

Os cookies do Facebook expiram após alguns dias. O usuário precisa reconectar via QR Code na página de configurações.

### Facebook bloqueia o login

- Use **proxy residencial** (datacenter proxies são bloqueados)
- O navegador já usa stealth patches (`navigator.webdriver`, `navigator.plugins`, etc.)
- Se o bloqueio persistir, reduza a frequência do worker ou aumente os delays no composer

### Vídeo não aparece no formulário

O upload usa um `input[type=file]` diretamente. Se o seletor falhar, o composer tenta arrastar o arquivo via eventos drag-and-drop. Verifique os screenshots de debug.

---

## Testando Manualmente

```bash
# 1. Iniciar login QR
curl -X POST http://localhost:3000/api/facebook/session/init \
  -H 'Content-Type: application/json' \
  -d '{"metaAccountId":"SEU_META_ACCOUNT_ID"}'

# 2. Fazer polling
curl -X POST http://localhost:3000/api/facebook/session/poll \
  -H 'Content-Type: application/json' \
  -d '{"metaAccountId":"SEU_META_ACCOUNT_ID"}'

# 3. Verificar status da sessão
curl http://localhost:3000/api/facebook/session/status?metaAccountId=SEU_META_ACCOUNT_ID

# 4. Desconectar
curl -X DELETE http://localhost:3000/api/facebook/session/SESSION_ID
```
