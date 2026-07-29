---
tags: [research, meta-api, social-media-scheduling, graph-api]
date: 2026-07-21
---

# Agendamento de Posts Facebook e Instagram: Opções Técnicas

## 1. Meta Business API / Graph API

### O que é
API oficial do Meta para gerenciamento de posts. Oferece endpoints para criar, agendar e recup>

**Endpoints principais:**
- `POST /{page-id}/feed` - Criar/agendar posts
- `GET /{page-id}/scheduled_posts` - Recuperar posts agendados
- Requer Page Access Token e permissões específicas

### Custo
- **Gratuito**: Uso da API não tem taxa direta
- **Custos indiretos**: App Review obrigatório (pode levar 2-4 semanas por permissão, sem cust>

### Complexidade de Implementação
- **Média**: SDK disponível (PHP, JavaScript, Java, Objective-C)
- Fluxo: Criar app → Registrar permissões → Passar em App Review → Gerar Page Access Token → I>
- Integração técnica é simples (REST API + SDKs)
- **Bloqueador principal**: App Review - precisa de vídeo screencast demonstrando o uso

### Permissões Necessárias
- `pages_manage_posts` - Criar e agendar posts
- `pages_show_list` - Listar páginas gerenciadas
- `pages_read_engagement` - Ler analytics (opcional)
- Cada permissão requer App Review separado

### Limitações
- **App Review obrigatório** para qualquer uso além do seu próprio app
- **Rate limits**: 200 chamadas/hora × número de usuários ativos
- **Instagram**: Agendamento limitado para contas profissionais
- **Não funciona** para contas pessoais do Facebook via API
- **Restrições de conteúdo**: Meta pode rejeitar posts que violem políticas

### Vantagens
- Solução oficial, confiável e mantida pelo Meta
- Acesso a métricas e dados de engajamento
- Suporte técnico disponível
- Integração nativa com Business Suite

### Recomendação
**Use se**: Você precisa de solução officially supported, planeja escalar com múltiplas página>

**Evite se**: Precisa launch rápido ou não quer passar por processo de App Review.

---

## 2. Projetos Open Source

### A. Postiz (gitroomhq/postiz-app)

**O que é**: Plataforma self-hosted completa de agendamento com IA integrada. Suporta X, Blues>

- **Repositório**: https://github.com/gitroomhq/postiz-app
- **Stack**: Node.js, React, Docker
- **Custo**: Gratuito (código aberto)
- **Complexidade**: Alta (requer self-hosting, banco de dados, deploy)
- **Limitações**:
  - Requer hospedagem própria (servidor/VPS)
  - Suporte a Facebook/Instagram via API - verificar versão atual
  - Manutenção contínua necessária
- **Vantagens**:
  - Sem limite de posts/contas
  - IA de geração de conteúdo integrada
  - Customizável
  - Comunidade ativa

---

### B. Social-Post-Scheduler (xCONFLiCTiONx/Social-Post-Scheduler)

**O que é**: Scheduler simples para Facebook, Instagram e Twitter com agendamento semanal.

- **Repositório**: https://github.com/xCONFLiCTiONx/Social-Post-Scheduler
- **Custo**: Gratuito
- **C