# Meta Permissions Strategy

## 🎯 Estratégia para MVP (Sem App Review)

### Problema
Permissões de negócio (`pages_manage_posts`, `instagram_business_content_publish`) precisam de **App Review** do Meta, que leva 3-7 dias.

### Solução: OAuth Simples + App Token no Servidor

```
┌─ Cliente (Browser) ──────────────────────────────────────────┐
│                                                              │
│  1. Usuário clica "Conectar"                                │
│     → OAuth com scope: "pages_show_list"                    │
│     → Retorna: User Access Token + Page IDs                │
│     → Salva no BD (criptografado)                          │
│                                                              │
└──────────────────────────────────────────────────────────────┘

┌─ Servidor (Backend) ─────────────────────────────────────────┐
│                                                              │
│  2. Quando publicar, usar:                                 │
│     → App Access Token (configurado no .env)              │
│     → POST /me/feed (não precisa de permission)           │
│     → Funciona imediatamente (sem App Review)             │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

---

## 🔑 Como Obter App Access Token

1. Ir para **Configurações > Básico**
2. Em "Chave Secreta do Aplicativo", clicar em "Mostrar"
3. Usar:
   ```
   App ID: 123456789
   App Secret: abcdef123456
   ```

4. No servidor, gerar token:
   ```bash
   curl "https://graph.facebook.com/v20.0/oauth/access_token?client_id=123456789&client_secret=abcdef123456&grant_type=client_credentials"
   ```

5. Copia o `access_token` e coloca em `.env`:
   ```env
   META_APP_ACCESS_TOKEN=seu_app_token_aqui
   ```

---

## 📋 O que Funciona Agora (MVP)

✅ **Implementado:**
- OAuth com `pages_show_list` (autorização do usuário)
- Salvar contas conectadas
- Listar páginas do usuário

⏳ **Fase 2 (Com App Token):**
- Publicar vídeos no Facebook (via App Token)
- Agendar publicações
- Publicar no Instagram

---

## 🧪 Testar Agora

1. **Permissão simplificada** - clique em "Conectar"
2. **Autorizar no Meta** - apenas `pages_show_list`
3. **Conta aparece** - significa que funcionou!

---

## ⚠️ Limitações do MVP

- Sem publicação de verdade (Fase 2)
- Sem Instagram (Fase 2)
- Sem agendamento (Fase 2)

---

## 🚀 Fase 2: Implementar Publicação Real

Quando implementar:

```typescript
// Usar App Access Token (não User Token)
const appToken = process.env.META_APP_ACCESS_TOKEN;

// Publicar no Facebook
POST /me/feed?access_token=${appToken}
  - video: <video_url>
  - description: <user_description>
  - scheduled_publish_time: <timestamp>

// Não precisa de permission review!
```

---

## 📚 Referência Meta

- [Permissions Guide](https://developers.facebook.com/docs/facebook-login/permissions)
- [App Access Tokens](https://developers.facebook.com/docs/facebook-login/access-tokens/app-access-tokens)
- [Publishing to Feed](https://developers.facebook.com/docs/graph-api/reference/page/feed)

---

**Status:** ✅ MVP funcionando com permissão simples  
**Próximo:** Implementar publicação com App Token em Fase 2
