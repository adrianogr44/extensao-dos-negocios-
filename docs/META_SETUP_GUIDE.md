# 🔧 Meta App Setup Guide

Este guia mostra como configurar sua aplicação Meta (Facebook/Instagram) para usar o scheduler.

---

## 📋 Pré-requisitos

- ✅ Conta Facebook
- ✅ Página Facebook (ou criar uma)
- ✅ Acesso ao [Meta Developers](https://developers.facebook.com/)

---

## 🚀 Step-by-Step

### Passo 1: Criar App no Meta

1. Ir para https://developers.facebook.com/
2. Clicar em **"Meus Aplicativos"** (canto superior direito)
3. Clicar em **"Criar Aplicativo"**
4. Selecionar **"Business"** como tipo
5. Preencher dados:
   - **Nome do Aplicativo:** PostReels Scheduler
   - **Email:** seu@email.com
   - **Tipo de Aplicativo:** Business
6. Clicar **"Criar Aplicativo"**

---

### Passo 2: Adicionar Produto (Facebook Login)

1. Na página do aplicativo, clicar em **"Adicionar Produto"**
2. Procurar por **"Facebook Login"**
3. Clicar em **"Configurar"**
4. Escolher **"Web"**
5. Na próxima tela:
   - Colocar URL do site: `http://localhost:3000`
   - Clicar **"Salvar"** e **"Continuar"**

---

### Passo 3: Obter Credenciais

1. Ir para **Configurações > Básico** (menu esquerdo)
2. Você verá:
   - **ID do Aplicativo** (copiar)
   - **Chave Secreta do Aplicativo** (copiar)

**Copie esses valores!**

---

### Passo 4: Configurar OAuth Redirect URI

<!-- 1. Ainda em **Configurações > Básico** -->
1. Ir para **Login do Facebook Para Empresas > Configurações** (menu esquerdo)
2. Descer até **"URLs de Redirecionamento OAuth válidas"**
3. Adicionar:
   ```
   http://localhost:3000/api/meta/auth/callback
   ```
4. Clicar **"Salvar Mudanças"**

---

### Passo 5: Configurar App Domains

1. Na mesma página (**Configurações > Básico**)
2. Em **"Domínios do Aplicativo"**, adicionar:
   ```
   localhost
   ```
3. Salvar

---

### Passo 6: Gerar Chave de Encriptação

Você precisa gerar uma chave segura para encriptar tokens. Execute no terminal:

**Linux/Mac:**
```bash
openssl rand -hex 16
```

**Windows (PowerShell):**
```powershell
[System.Security.Cryptography.RandomNumberGenerator]::GetBytes(16) | ForEach-Object { "{0:X2}" -f $_ }
```

Exemplo de saída:
```
a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6
```

**Copie este valor!**

---

### Passo 7: Obter App Access Token

O App Access Token é usado no servidor para publicar conteúdo sem precisar de permissões do usuário.

#### Método 1: Via Graph API Explorer (Recomendado ✅)

1. Ir para: https://developers.facebook.com/tools/explorer
2. No dropdown superior esquerdo, trocar **"Graph API Explorer"** para **"Accounts"**
3. Selecionar sua aplicação **"PostReels Scheduler"**
4. Clicar no botão **"Get App Token"**
5. O token aparecerá automaticamente no campo de texto principal
6. **Copiar o token** (será algo como: `EAABsbCS1iHgBAJ7x8ZCw5nHQUPUgW...`)

✅ **Este é o método mais confiável!**

---

#### Método 2: Via Terminal (Alternativo)

Se preferir usar terminal:

**Linux/Mac:**
```bash
curl -X POST "https://graph.facebook.com/v20.0/oauth/access_token" \
  -d "client_id=SEU_APP_ID" \
  -d "client_secret=SUA_CHAVE_SECRETA" \
  -d "grant_type=client_credentials"
```

**Windows (PowerShell):**
```powershell
$appId = "SEU_APP_ID"
$appSecret = "SUA_CHAVE_SECRETA"
curl -X POST "https://graph.facebook.com/v20.0/oauth/access_token" `
  -d "client_id=$appId" `
  -d "client_secret=$appSecret" `
  -d "grant_type=client_credentials"
```

A resposta será:
```json
{
  "access_token": "EAABsbCS1iHgBAJ7x8ZCw5nHQUPUgW...",
  "token_type": "bearer"
}
```

✅ **Copie o valor de `access_token`!** (Será usado na Fase 2 para publicar)

---

## 📝 Preencher o .env

Editar `/home/gosantos/projects/postreels-v2/.env` e preencher:

```env
# Meta Graph API (Facebook/Instagram Scheduler)
META_APP_ID=SEU_ID_DO_APLICATIVO_AQUI
META_APP_SECRET=SUA_CHAVE_SECRETA_AQUI
META_REDIRECT_URI=http://localhost:3000/api/meta/auth/callback
TOKEN_ENCRYPTION_KEY=SUA_CHAVE_GERADA_AQUI
META_APP_ACCESS_TOKEN=SEU_APP_ACCESS_TOKEN_AQUI (para Fase 2)
```

**Exemplo preenchido:**
```env
# Meta Graph API (Facebook/Instagram Scheduler)
META_APP_ID=123456789012345
META_APP_SECRET=a1b2c3d4e5f6g7h8i9j0k1l2m3n4
META_REDIRECT_URI=http://localhost:3000/api/meta/auth/callback
TOKEN_ENCRYPTION_KEY=a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6
META_APP_ACCESS_TOKEN=EAABsbCS1iHgBAJ7x8ZCw5nHQUPUgW... (opcional, para Fase 2)
```

---

## ✅ Checklist

- [ ] Criar app em Meta Developers
- [ ] Adicionar produto "Facebook Login"
- [ ] Copiar ID do Aplicativo
- [ ] Copiar Chave Secreta
- [ ] Adicionar Redirect URI: `http://localhost:3000/api/meta/auth/callback`
- [ ] Adicionar App Domain: `localhost`
- [ ] Gerar chave de encriptação (16 bytes)
- [ ] Obter App Access Token (via Graph API Explorer ou curl)
- [ ] Preencher `.env` com as 5 variáveis (META_APP_ACCESS_TOKEN é opcional para Fase 2)
- [ ] ✅ Pronto para testar!

---

## 🧪 Testar Conexão

1. Iniciar servidor:
   ```bash
   pnpm dev
   ```

2. Ir para: http://localhost:3000/dashboard/settings/meta-accounts

3. Clicar em **"Conectar Facebook/Instagram"**

4. Você será redirecionado para autorizar no Meta

5. Autorizar e voltará com sua conta conectada!

---

## 🚨 Troubleshooting

### Erro: "Invalid OAuth redirect URI"
- ✅ Verificar se está exatamente igual em Meta Developers:
  ```
  http://localhost:3000/api/meta/auth/callback
  ```
- ✅ Não pode ter trailing slash `/`

### Erro: "App not set up"
- ✅ Certifique-se de ter adicionado o produto "Facebook Login"
- ✅ Verificar que o app está em modo "Development" (não production)

### Erro: "Invalid app domains"
- ✅ Adicionar `localhost` em "App Domains" em Configurações > Básico

### Erro: "Token invalid or expired"
- ✅ Tokens Meta expiram em 60 dias
- ✅ Você precisa reconectar em settings

### Erro ao obter App Access Token: "Invalid OAuth 2.0 Access Token"
- ✅ Use o **Método 1 (Graph API Explorer)** em vez do curl - é mais confiável
- ✅ Verifique se copiou a Chave Secreta corretamente (sem espaços)
- ✅ Se usar curl, tente com `-X POST` em vez de `-X GET`

---

## 📊 Próximos Passos

1. ✅ Configurar Meta App
2. ✅ Preencher `.env`
3. ⏭️ Executar migration: `pnpm exec prisma migrate dev`
4. ⏭️ Iniciar servidor: `pnpm dev`
5. ⏭️ Testar OAuth em `/dashboard/settings/meta-accounts`
6. ⏭️ Agendar publicação em `/dashboard/publications/new?videoId=test-123`

---

## 📚 Referências

- [Meta Developers](https://developers.facebook.com/)
- [Graph API Docs](https://developers.facebook.com/docs/graph-api)
- [Facebook Login Docs](https://developers.facebook.com/docs/facebook-login/web)

---

**Dúvidas?** Verifique se todas as variáveis foram adicionadas corretamente ao `.env` e se o servidor está rodando.
