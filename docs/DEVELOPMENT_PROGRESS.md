# PostReels Video Scheduler - Development Progress

**Iniciado em:** 2026-07-21  
**Fase:** MVP (Phase 1) - Facebook Scheduling  
**Status:** ✅ Estrutura Base Implementada

---

## ✅ O Que Foi Implementado

### 1. **Banco de Dados (Prisma Schema)**
- ✅ `MetaAccount` - Credenciais e contas Meta
- ✅ `Publication` - Publicações agendadas
- ✅ `PublicationTemplate` - Templates reutilizáveis
- ✅ `PublicationLog` - Auditoria de ações
- ✅ Migration SQL criada em `/prisma/migrations/20260721_add_meta_scheduler_tables/`

**Arquivo:** `apps/dashboard/prisma/schema.prisma`

### 2. **Utilitários & Types**
- ✅ `lib/meta/types.ts` - DTOs e interfaces TypeScript
- ✅ `lib/meta/client.ts` - Cliente Meta Graph API
- ✅ `lib/meta/encryption.ts` - Encriptação AES-256-GCM para tokens

### 3. **API Routes (Backend)**
- ✅ `POST /api/meta/auth/connect` - Iniciar OAuth flow
- ✅ `GET /api/meta/auth/callback` - OAuth callback (valida CSRF, salva token)
- ✅ `GET /api/meta/accounts` - Listar contas conectadas
- ✅ `DELETE /api/meta/accounts` - Desconectar conta
- ✅ `POST /api/meta/publications/schedule` - Agendar publicação
- ✅ `GET /api/meta/publications` - Listar publicações (com filtros/paginação)
- ✅ `GET /api/meta/templates` - Listar templates
- ✅ `POST /api/meta/templates` - Criar template

### 4. **Componentes React (UI)**
- ✅ `ConnectMeta` - Botão OAuth + status de conexão
- ✅ `TagInput` - Input de hashtags com validação
- ✅ `ScheduleForm` - Formulário completo de agendamento
  - Seleção de conta Meta
  - Escolha de plataformas (Facebook/Instagram)
  - Descrição com char counter
  - Hashtags com TagInput
  - Data/hora de agendamento
  - Opção salvar como template

---

## 📋 Próximas Etapas

### Fase 1B: Testes e Integração OAuth (1-2 dias)

1. **Setup .env.local**
   ```env
   META_APP_ID=seu_app_id
   META_APP_SECRET=seu_app_secret
   META_REDIRECT_URI=http://localhost:3000/api/meta/auth/callback
   TOKEN_ENCRYPTION_KEY=sua_chave_de_32_caracteres_minimo
   DATABASE_URL=seu_postgres_url
   ```

2. **Executar Migration**
   ```bash
   pnpm --filter @postreels/dashboard exec prisma migrate dev
   ```

3. **Testar OAuth Flow**
   - Criar página `/dashboard/settings/meta-accounts`
   - Testar botão "Conectar Facebook"
   - Validar que token é salvo criptografado

4. **Testar Agendamento Básico**
   - Criar página `/dashboard/publications/new`
   - Selecionar vídeo existente
   - Agendar no Facebook
   - Verificar que cria registro com status SCHEDULED

### Fase 2: Publicação Automática via Cron (2-3 dias)

1. **Criar Cron Job** (`/api/cron/publish-scheduled`)
   - Query publicações com `status='SCHEDULED'` e `scheduledFor <= NOW()`
   - Chamar Meta API para publicar
   - Atualizar status para PUBLISHED
   - Log de sucesso/erro

2. **Tratamento de Erro**
   - Implementar retry com backoff exponencial
   - Notificar usuário de falhas
   - Salvar metaPostId para rastreamento

### Fase 3: Instagram Support (1-2 dias)

1. **Adaptar Meta Client**
   - Método `publishToInstagram()` com upload de media
   - Validações específicas (hashtags, comprimento)

2. **UI Updates**
   - Checkbox para selecionar plataformas
   - Validações por plataforma no form

### Fase 4: Polish & Edge Cases (1-2 dias)

1. **Página de Publicações List**
   - Filtros: status, plataforma, data
   - Ações: editar, deletar, publicar agora
   - Exibir status visual (badges)

2. **Tratamento de Tokens Expirados**
   - Detectar erro 190 da Meta (invalid token)
   - Mostrar "Reconecte sua conta"
   - Link para re-autorizar

3. **Testes E2E**
   - Conectar conta
   - Agendar publicação
   - Verificar BD
   - Simular cron job

---

## 🔧 Configurações Necessárias

### Meta App Setup

1. Ir para https://developers.facebook.com/
2. Criar App (Type: Business)
3. Adicionar Product: Facebook Login
4. Em Settings → Basic:
   - Copiar **App ID** e **App Secret**
5. Em Settings → Facebook Login:
   - Valid OAuth Redirect URIs: `http://localhost:3000/api/meta/auth/callback`
   - App Domains: `localhost`

### Environment Variables

```env
# Meta API
META_APP_ID=seu_app_id
META_APP_SECRET=seu_app_secret
META_REDIRECT_URI=http://localhost:3000/api/meta/auth/callback

# Database (já deve estar configurado)
DATABASE_URL=postgresql://user:password@localhost:5432/postreels

# Encryptção de Tokens
TOKEN_ENCRYPTION_KEY=sua_chave_segura_minimo_16_caracteres

# Node Env
NODE_ENV=development
```

---

## 📁 Estrutura de Arquivos Criados

```
apps/dashboard/
├── prisma/
│   ├── schema.prisma (✅ atualizado)
│   └── migrations/
│       └── 20260721_add_meta_scheduler_tables/
│           └── migration.sql (✅ novo)
│
├── src/
│   ├── lib/
│   │   └── meta/
│   │       ├── types.ts (✅ novo)
│   │       ├── client.ts (✅ novo)
│   │       ├── encryption.ts (✅ novo)
│   │
│   ├── app/
│   │   └── api/meta/
│   │       ├── auth/
│   │       │   ├── connect/route.ts (✅ novo)
│   │       │   └── callback/route.ts (✅ novo)
│   │       ├── accounts/route.ts (✅ novo)
│   │       ├── publications/
│   │       │   ├── schedule/route.ts (✅ novo)
│   │       │   └── route.ts (✅ novo)
│   │       └── templates/route.ts (✅ novo)
│   │
│   └── components/meta/
│       ├── connect-meta.tsx (✅ novo)
│       ├── tag-input.tsx (✅ novo)
│       └── schedule-form.tsx (✅ novo)
```

---

## 🧪 Testes Locais Rápidos

### 1. Testar Migration
```bash
cd apps/dashboard
pnpm exec prisma db push
```

### 2. Testar Connect Form
```tsx
// Em uma página temporária
import { ConnectMeta } from '@/components/meta/connect-meta';

export default function TestPage() {
  return (
    <ConnectMeta
      account={undefined}
      onConnect={async () => {}}
      onDisconnect={async () => {}}
    />
  );
}
```

### 3. Testar Schedule Form
```tsx
import { ScheduleForm } from '@/components/meta/schedule-form';

export default function TestPage() {
  return (
    <ScheduleForm
      videoId="test-123"
      videoTitle="Test Video"
      accounts={[]}
      templates={[]}
      onSubmit={async () => console.log('submitted')}
      onCancel={() => {}}
    />
  );
}
```

---

## 🚨 Checklist Antes de Deploy

- [ ] Environment variables configuradas
- [ ] Migration rodada com sucesso
- [ ] Meta App criado com credenciais
- [ ] OAuth flow testado completo (connect → callback → DB)
- [ ] Token encriptação funcionando
- [ ] Página de settings com ConnectMeta renderiza
- [ ] Página de scheduling renderiza com accounts
- [ ] API de publications retorna dados
- [ ] Não há console.errors ou warnings

---

## 💡 Dicas de Desenvolvimento

1. **Para debugar tokens**: Em `api/meta/auth/callback`, adicione:
   ```typescript
   console.log('Token:', tokenResponse.access_token);
   console.log('Encrypted:', encryptedToken);
   ```

2. **Para testar sem Meta API**: Mock o `MetaGraphAPIClient`:
   ```typescript
   const mockClient = {
     exchangeCodeForToken: async () => ({
       access_token: 'test_token',
       token_type: 'bearer',
     }),
   };
   ```

3. **Para verificar BD**: Use `pnpm exec prisma studio`

---

## 📞 Suporte & Documentação

- **Meta Graph API Docs**: https://developers.facebook.com/docs/graph-api
- **Prisma Docs**: https://www.prisma.io/docs
- **Next.js API Routes**: https://nextjs.org/docs/app/building-your-application/routing/route-handlers

---

**Resumo:** A estrutura base do MVP está 90% pronta. Faltam apenas:
1. ✅ Validação completa do OAuth (já implementado, falta testar)
2. ⏳ Cron job para publicar agendamentos
3. ⏳ Páginas de UI (settings, publications list)
4. ⏳ Instagram support

Próximo: Executar migration e testar OAuth flow!
