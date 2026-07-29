# Feature: Caption Engine (Reescrita Inteligente de Legendas)

## Objetivo

Implementar um módulo chamado **Caption Engine**, responsável por reescrever automaticamente as legendas dos vídeos utilizando Inteligência Artificial.

Lembrando que as legendas que eu estou referindo, é a parte escrita do vídeo, que fica abaixo da foto de perfil, nome e username.
Sendo assim, precisa identificar a descrição, gerar uma nova e adicionar na área do vídeo onde está a legenda original.

O Caption Engine será executado durante o processo de **"Replicar para todos"**, gerando uma nova legenda para cada vídeo individualmente.

Cada legenda deverá manter o significado da original, porém utilizando uma estrutura completamente diferente, tornando o conteúdo mais natural e único.

A solução deverá funcionar para **qualquer nicho**, como futebol, marketing, humor, tecnologia, culinária, viagens, política, saúde, pets, negócios, entre outros.

---

# Estratégia de IA

O sistema deverá utilizar dois provedores de IA.

## Provider Primário

**Google Gemini API**

Será o provider padrão da aplicação.

Utilizar a API oficial do Gemini.

---

## Provider Secundário (Fallback)

**Ollama**

Caso o Gemini esteja indisponível por qualquer motivo, o sistema deverá utilizar automaticamente um modelo local via Ollama.

Exemplos de modelos suportados:

- qwen2.5:3b
- gemma3:4b
- llama3.2
- phi4-mini

O fallback deve acontecer automaticamente, sem intervenção do usuário.

---

# Fluxo

```
Legenda Original

↓

Gemini Provider

↓

Sucesso?

├── Sim
│      ↓
│  Nova legenda
│
└── Não
       ↓
 Ollama Provider
       ↓
 Nova legenda
```

Caso ambos falhem:

- Registrar erro em log.
- Utilizar a legenda original.
- Continuar normalmente o processamento.

Nunca interromper o lote de vídeos.

---

# Fluxo do botão "Replicar para todos"

Ao clicar em **Replicar para todos**, o sistema **não deve copiar a legenda do vídeo base**.

Ao invés disso:

```
Para cada vídeo

↓

Legenda original

↓

Caption Engine

↓

Nova legenda

↓

Salvar resultado
```

Cada vídeo deve possuir sua própria legenda reescrita.

---

# Download dos vídeos

Durante o download do Reel, salvar também todos os metadados disponíveis.

Exemplo:

```json
{
    "video": "...",
    "caption": "...",
    "metadata": {
        "author": "...",
        "username": "...",
        "hashtags": [],
        "mentions": [],
        "publishDate": "...",
        "audio": "..."
    }
}
```

Esses metadados poderão ser utilizados futuramente por outros módulos.

---

# Prompt enviado para a IA

Utilizar um prompt semelhante ao abaixo.

```
Você é um especialista em criação de conteúdo para redes sociais.

Sua tarefa é reescrever a legenda abaixo.

Antes de escrever, identifique automaticamente:

- O nicho da publicação
- O contexto
- O assunto principal
- A intenção da mensagem

Depois disso, gere uma nova legenda seguindo as regras abaixo.

REGRAS

- Preserve exatamente o significado da legenda.
- Preserve o contexto.
- Preserve a intenção da publicação.
- Preserve o assunto principal.
- Detecte automaticamente o nicho.
- Adapte naturalmente o estilo ao nicho identificado.
- Nunca copie frases literalmente.
- Reestruture completamente o texto.
- Utilize sinônimos sempre que possível.
- Escreva de forma natural.
- O resultado deve parecer escrito por uma pessoa.
- Preserve nomes próprios.
- Preserve pessoas.
- Preserve marcas.
- Preserve empresas.
- Preserve locais.
- Preserve datas.
- Preserve números importantes.
- Preserve hashtags quando solicitado.
- Preserve emojis quando solicitado.
- Caso permitido, adicione emojis de forma natural.
- Nunca invente fatos.
- Nunca altere informações importantes.
- Nunca acrescente informações inexistentes.
- Caso exista uma chamada para ação (CTA), mantenha sua intenção utilizando uma redação diferente.

Configurações

Estilo:
{{style}}

Idioma:
{{language}}

Máximo de caracteres:
{{maxLength}}

Manter hashtags:
{{keepHashtags}}

Manter emojis:
{{keepEmojis}}

Adicionar emojis automaticamente:
{{autoEmoji}}

Legenda original:

{{caption}}

Retorne apenas a nova legenda.
```

---

# Arquitetura

Criar um módulo independente.

```
CaptionEngine/

├── CaptionService.ts
├── PromptBuilder.ts
├── CaptionTransformer.ts
├── Providers/
│   ├── GeminiProvider.ts
│   ├── OllamaProvider.ts
│   └── ProviderFactory.ts
├── Models/
├── Interfaces/
└── Types/
```

---

# Interface

```ts
export interface CaptionProvider {
    transform(
        caption: string,
        options: CaptionOptions
    ): Promise<string>;
}
```

Todos os providers devem implementar essa interface.

---

# Provider Factory

Criar uma factory responsável por selecionar o provider.

Fluxo:

```
Gemini

↓

Funcionou?

├── Sim
│
└── Não
     ↓
  Ollama
```

A aplicação nunca deve depender diretamente dos providers.

Sempre utilizar a factory.

---

# Configuração

Adicionar configurações globais.

```json
{
    "captionEngine": {
        "enabled": true,
        "provider": "gemini",
        "fallbackProvider": "ollama",

        "gemini": {
            "apiKey": "${GEMINI_API_KEY}",
            "model": "gemini-2.5-flash"
        },

        "ollama": {
            "baseUrl": "http://ollama:11434",
            "model": "qwen2.5:3b"
        },

        "temperature": 0.8,
        "maxTokens": 300,
        "language": "pt-BR",
        "style": "viral",
        "keepHashtags": true,
        "keepEmojis": true,
        "autoEmoji": true,
        "maxLength": 220
    }
}
```

---

# Estilos suportados

O usuário escolhe apenas o estilo da escrita.

O nicho será identificado automaticamente pela IA.

Exemplos:

- original
- viral
- casual
- professional
- informative
- persuasive
- storytelling
- minimal

O estilo modifica apenas a forma de escrever.

Nunca altera o conteúdo.

---

# Infraestrutura

## Gemini

A chave da API deverá ser lida através de variável de ambiente.

Exemplo:

```
GEMINI_API_KEY=
```

Nunca armazenar a chave diretamente no código.

---

## Ollama

Toda a infraestrutura do Ollama deverá utilizar Docker Compose.

Não instalar o Ollama diretamente na máquina.

Adicionar um serviço semelhante a:

```yaml
services:

  ollama:
    image: ollama/ollama:latest
    container_name: postreels-ollama
    restart: unless-stopped

    ports:
      - "11434:11434"

    volumes:
      - ollama:/root/.ollama

volumes:
  ollama:
```

---

# Bootstrap do Ollama

Durante a inicialização:

1. Verificar se o container está disponível.
2. Verificar se o modelo configurado já existe.
3. Caso não exista:

```
ollama pull qwen2.5:3b
```

4. Aguardar o download.
5. Validar a instalação.
6. Deixar o provider pronto para uso como fallback.

Esse processo deve ser automático.

---

# Tratamento de erros

## Gemini

Caso ocorra:

- limite de requisições;
- timeout;
- indisponibilidade;
- erro de autenticação;
- erro interno;

O sistema deve alternar automaticamente para o Ollama.

---

## Ollama

Caso também falhe:

- Registrar o erro.
- Utilizar a legenda original.
- Continuar processando os demais vídeos.

Nunca interromper um lote por falha de IA.

---

# Performance

O processamento deverá suportar centenas de vídeos.

Requisitos:

- processamento em lote;
- filas;
- concorrência;
- timeout configurável;
- retry automático para falhas temporárias;
- fallback automático entre providers.

---

# Requisitos de Arquitetura

- Código desacoplado.
- SOLID.
- Fácil manutenção.
- Fácil substituição de providers.
- Preparado para múltiplos modelos.
- Compatível com processamento em lote.
- Fácil expansão para novos providers no futuro (OpenAI, Claude, DeepSeek, etc.).
- Toda a comunicação com IA deve passar pelo Caption Engine.
- O restante da aplicação nunca deve conhecer diretamente os providers.

---

# Resultado Esperado

Ao clicar em **"Replicar para todos"**, o fluxo deverá ser:

```
Legenda Original
        │
        ▼
Caption Engine
        │
        ▼
Prompt Builder
        │
        ▼
Gemini Provider
        │
        ├──────────────► Sucesso
        │                     │
        │                     ▼
        │              Nova legenda
        │
        ▼
Falhou?
        │
        ▼
Ollama Provider
        │
        ├──────────────► Sucesso
        │                     │
        │                     ▼
        │              Nova legenda
        │
        ▼
Falhou?
        │
        ▼
Utilizar legenda original
```

O Caption Engine deve produzir legendas únicas, naturais e humanizadas para cada vídeo, preservando o contexto e o significado da publicação original, identificando automaticamente o nicho e adaptando o estilo de escrita conforme a configuração escolhida pelo usuário. A arquitetura deve priorizar o uso da API do Gemini, utilizando o Ollama como mecanismo de fallback automático para garantir alta disponibilidade e robustez do processamento.