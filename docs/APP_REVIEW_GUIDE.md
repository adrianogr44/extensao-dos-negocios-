# 📝 Guia Completo - Meta App Review para PostReels

## 📋 Visão Geral

Este guia te orientará passo a passo no processo de aprovação da aplicação PostReels no Meta App Review. O processo permite que sua aplicação possa publicar conteúdo nas páginas do Facebook e Instagram dos usuários.

**Tempo estimado:** 2-7 dias para revisão após submissão

---

## 🔑 Permissões Necessárias

Você precisará solicitar aprovação para estas permissões:

| Permissão | Propósito | Obrigatória |
|-----------|----------|-----------|
| `pages_manage_posts` | Publicar conteúdo nas páginas | ✅ Sim |
| `pages_read_engagement` | Ler dados de engajamento | ✅ Sim |
| `pages_read_user_content` | Ler conteúdo das páginas | ✅ Sim |
| `pages_manage_engagement` | Gerenciar comentários | ✅ Sim |
| `business_management` | Acessar Business Manager | ✅ Sim |
| `pages_show_list` | Listar páginas do usuário | ✅ Sim |
| `public_profile` | Dados públicos da conta | ✅ Sim |

---

## 📝 Passo 1: Preparar Política de Privacidade

### Opção A: Arquivo Local (Desenvolvimento)

1. Crie o arquivo `public/privacy-policy.html`:

```html
<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Política de Privacidade - PostReels</title>
    <style>
        body {
            font-family: Arial, sans-serif;
            line-height: 1.6;
            max-width: 900px;
            margin: 0 auto;
            padding: 20px;
            color: #333;
        }
        h1 { color: #0066cc; }
        h2 { color: #0066cc; margin-top: 30px; }
    </style>
</head>
<body>
    <h1>Política de Privacidade - PostReels</h1>
    <p><strong>Data de Vigência:</strong> 2026</p>
    <p><strong>Última Atualização:</strong> 22 de Julho de 2026</p>

    <h2>1. Introdução</h2>
    <p>PostReels ("nós", "nosso" ou "nossa") opera o aplicativo PostReels (o "Serviço"). Esta página informa você de nossas políticas quanto à coleta, uso e divulgação de dados pessoais quando você utiliza nosso Serviço e as escolhas que você tem associadas a esses dados.</p>

    <h2>2. Dados que Coletamos</h2>
    <p>Coletamos dados limitados necessários para operar o serviço:</p>
    <ul>
        <li><strong>Token de Acesso do Facebook:</strong> Armazenado criptografado com AES-256-GCM</li>
        <li><strong>Informações da Página:</strong> ID, nome, categoria, foto de perfil</li>
        <li><strong>Dados de Publicação:</strong> Vídeos, descrições, hashtags, cronograma</li>
        <li><strong>Informações da Conta:</strong> ID, nome público (apenas conforme autorizado)</li>
    </ul>

    <h2>3. Como Usamos Seus Dados</h2>
    <p>Usamos os dados coletados exclusivamente para:</p>
    <ul>
        <li>Publicar conteúdo nas suas páginas do Facebook conforme solicitado</li>
        <li>Agendar publicações para datas/horários específicos</li>
        <li>Exibir informações sobre suas páginas conectadas</li>
        <li>Melhorar a experiência do usuário</li>
    </ul>

    <h2>4. Segurança dos Dados</h2>
    <p>Implementamos medidas de segurança robustas:</p>
    <ul>
        <li>Encriptação AES-256-GCM para tokens armazenados</li>
        <li>Conexões HTTPS para todas as comunicações</li>
        <li>Tokens nunca são registrados em logs</li>
        <li>Acesso ao banco de dados restrito e auditado</li>
    </ul>

    <h2>5. Compartilhamento de Dados</h2>
    <p>Não compartilhamos seus dados com terceiros, exceto conforme necessário para:</p>
    <ul>
        <li>Cumprir obrigações legais</li>
        <li>Proteger direitos e segurança</li>
        <li>Meta Platforms (apenas para publicação autorizada)</li>
    </ul>

    <h2>6. Seu Controle</h2>
    <p>Você pode:</p>
    <ul>
        <li>Desconectar sua conta a qualquer momento</li>
        <li>Solicitar exclusão de seus dados</li>
        <li>Gerenciar permissões da aplicação nas configurações do Facebook</li>
    </ul>

    <h2>7. Contato</h2>
    <p><strong>Email:</strong> oldsgabriel@gmail.com</p>
    <p>Se tiver dúvidas sobre esta política, entre em contato conosco.</p>

    <h2>8. Alterações nesta Política</h2>
    <p>Podemos atualizar esta Política de Privacidade de tempos em tempos. Notificaremos você sobre qualquer alteração publicando a nova Política de Privacidade nesta página.</p>
</body>
</html>
```

2. A URL será: `http://localhost:3000/privacy-policy.html`

### Opção B: Domínio Real (Produção)

Para o App Review final, você precisará de um domínio real. Hospede a página em um servidor e use a URL permanente.

---

## 🔍 Passo 2: Acessar o Meta App Review

1. Vá para [developers.facebook.com](https://developers.facebook.com)
2. Clique em **"Meus Aplicativos"**
3. Selecione sua aplicação **"PostReels"**
4. No menu lateral esquerdo, clique em **"App Review"**

---

## ✅ Passo 3: Iniciar Submissão

1. Clique em **"Iniciar Submissão"** ou **"Add Items for Review"**
2. Uma lista de permissões aparecerá
3. Selecione as seguintes permissões:
   - ✅ `pages_manage_posts`
   - ✅ `pages_read_engagement`
   - ✅ `pages_read_user_content`
   - ✅ `pages_manage_engagement`
   - ✅ `business_management`
   - ✅ `pages_show_list`

---

## 📋 Passo 4: Preencher Descrição de Uso

Para **cada permissão**, o Meta pedirá uma explicação. Use o template abaixo:

### Para `pages_manage_posts`
**Pergunta:** "Como você usa esta permissão?"

**Resposta:**
```
A aplicação PostReels permite que usuários agendem e publiquem vídeos em suas 
páginas do Facebook. A permissão pages_manage_posts é usada exclusivamente 
para publicar conteúdo de vídeo nas páginas que o usuário é administrador, 
conforme solicitado pelo próprio usuário através da interface da aplicação.

Fluxo:
1. Usuário conecta sua conta do Facebook
2. Aplicação lista suas páginas
3. Usuário seleciona qual página deseja publicar
4. Usuário faz upload de vídeo e agenda publicação
5. Aplicação publica o vídeo na página no horário agendado

O token de acesso é armazenado criptografado e nunca é compartilhado com terceiros.
```

### Para `pages_read_engagement`
**Resposta:**
```
A permissão pages_read_engagement é necessária para obter informações sobre 
as páginas conectadas, como dados de engajamento e informações da página.

Esta informação é exibida na aplicação para ajudar o usuário a gerenciar 
suas publicações de forma mais efetiva.
```

### Para `pages_read_user_content`
**Resposta:**
```
A permissão pages_read_user_content permite que a aplicação leia conteúdo 
da página para validação e gerenciamento de publicações.

É usada para:
- Validar que o conteúdo foi publicado com sucesso
- Exibir histórico de publicações
- Gerenciar publicações agendadas
```

### Para `pages_manage_engagement`
**Resposta:**
```
A permissão pages_manage_engagement permite que a aplicação gerencie 
comentários e respostas nas publicações.

Futuras versões da aplicação usarão esta permissão para:
- Responder automaticamente a comentários
- Gerenciar mensagens privadas relacionadas a publicações
- Moderar comentários conforme configurado pelo usuário
```

### Para `business_management`
**Resposta:**
```
A permissão business_management é necessária para acessar páginas vinculadas 
ao Business Manager dos usuários.

Muitos usuários gerenciam suas páginas através do Facebook Business Manager, 
então esta permissão garante que a aplicação possa listar e acessar todas 
as páginas do usuário, independentemente de estarem no Business Manager ou não.
```

### Para `pages_show_list`
**Resposta:**
```
A permissão pages_show_list permite que a aplicação liste todas as páginas 
que o usuário gerencia.

Esta é a permissão fundamental para mostrar ao usuário quais de suas páginas 
podem ser usadas na aplicação PostReels.
```

---

## 🎯 Passo 5: Informações da Aplicação

Você também precisará preencher informações gerais:

**Nome da Aplicação:**
```
PostReels
```

**Categoria da Aplicação:**
```
Produtividade
```

**Descrição:**
```
PostReels é uma aplicação de agendamento de conteúdo que permite que 
criadores digitais agendem e publiquem vídeos em suas páginas do Facebook 
e Instagram de forma automática e em horários otimizados para melhor 
engajamento.
```

**URL da Política de Privacidade:**
```
http://localhost:3000/privacy-policy.html (desenvolvimento)
https://seu-dominio.com/privacy-policy.html (produção)
```

**URL dos Termos de Serviço:** (opcional)
```
Deixe em branco ou crie uma similar à política de privacidade
```

---

## 🧪 Passo 6: Testes de API

O Meta exigirá evidência de que você está usando as APIs. Você deve ter:

### Chamadas de API Necessárias

| Permissão | Chamadas Necessárias | Como Testar |
|-----------|-------------------|-------------|
| `pages_show_list` | 1+ | Conectar sua conta e listar páginas |
| `pages_read_engagement` | 1+ | Publicar um vídeo (a API valida a permissão) |
| `pages_manage_posts` | 1+ | Publicar um vídeo com sucesso |
| `pages_manage_engagement` | 1+ | Responder a um comentário (se implementado) |
| `business_management` | 1+ | Conectar conta com Business Manager |
| `public_profile` | 1+ | Login com Facebook |

### Como Gerar Evidência

1. **Conecte sua conta** do Facebook na aplicação
2. **Publique um vídeo** em uma de suas páginas
3. **Verifique os logs** do servidor - o Meta usa isso como prova

---

## 📤 Passo 7: Submeter para Revisão

1. Preencha todos os campos obrigatórios
2. Revise as informações
3. Clique em **"Enviar para Revisão"** ou **"Submit for Review"**
4. O Meta enviará um email confirmando a submissão

---

## ⏳ Passo 8: Aguardar Revisão

**Tempo estimado:** 2-7 dias

### Possíveis Resultados

✅ **Aprovado:** Você receberá email confirmando. As permissões agora estarão disponíveis em produção.

❌ **Rejeitado:** O Meta enviará um email explicando o motivo. Você pode:
- Corrigir as informações
- Reenviar para revisão
- Contatar o suporte do Meta se houver dúvidas

⏸️ **Necessita Mais Informações:** O Meta pedirá esclarecimentos. Responda com detalhes.

---

## 🔧 Troubleshooting

### "Preciso de mais testes de API"
Se o Meta disser que você não fez testes suficientes:
1. Use a aplicação normalmente
2. Conecte sua conta
3. Publique alguns vídeos
4. Reenvie para revisão

### "URL da Política de Privacidade inválida"
Verifique que:
- A URL é acessível (teste no navegador)
- Não tem redirecionamentos
- Está em HTTPS (para produção)
- Contém informações claras sobre dados coletados

### "Descrição de uso não é específica"
Seja mais detalhado:
- Explique O QUE você faz com a permissão
- Explique POR QUE você precisa
- Dê exemplos de uso real
- Não seja genérico

---

## 💡 Dicas Importantes

✅ **Faça:**
- Ser honesto e específico nas descrições
- Testar a aplicação completamente antes de submeter
- Responder rapidamente aos emails do Meta
- Manter a política de privacidade atualizada

❌ **Não Faça:**
- Copiar descrições genéricas
- Pedir permissões que não usa
- Armazenar dados sem consentimento
- Compartilhar tokens com terceiros

---

## 📞 Contato e Suporte

Se tiver dúvidas durante o processo:

1. **Meta Developer Community:** https://developers.facebook.com/community
2. **Meta Support:** https://developers.facebook.com/support
3. **Documentação:** https://developers.facebook.com/docs/

---

## ✅ Checklist Final

Antes de submeter, confirme que:

- [ ] Arquivo `privacy-policy.html` criado e acessível
- [ ] URL da política está funcionando
- [ ] Todas as 7 permissões foram listadas
- [ ] Descrições de uso são específicas e detalhadas
- [ ] Informações da aplicação estão corretas
- [ ] Você testou publicar pelo menos um vídeo
- [ ] Informações de contato estão corretas
- [ ] Você está pronto para responder emails do Meta

---

## 📝 Próximos Passos

1. ✅ Crie a política de privacidade
2. ✅ Preencha todas as informações no App Review
3. ✅ Submeta para revisão
4. ⏳ Aguarde 2-7 dias
5. ✅ Após aprovação, as permissões estarão ativas em produção

Boa sorte! 🚀
