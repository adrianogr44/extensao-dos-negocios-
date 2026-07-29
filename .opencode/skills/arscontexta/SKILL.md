---
name: arscontexta
description: "Ars Contexta — conhecimento em arquitetura cognitiva para agentes de IA. Use quando o usuario mencionar arscontexta, second brain, vault, knowledge system, /ars:setup, /ars:ask, ou sistema de nota."
---

# Ars Contexta — Skill de Arquitetura Cognitiva

Skill que adapta o plugin Ars Contexta (agenticnotetaking/arscontexta) para o opencode. Provê acesso à metodologia, pesquisa e geração de sistemas de conhecimento.

## Referências

As referências completas estão em `.opencode/references/arscontexta/`:
- `reference/kernel.yaml` — 15 primitivas centrais
- `reference/three-spaces.md` — Arquitetura self/notes/ops
- `reference/failure-modes.md` — 10 modos de falha
- `reference/interaction-constraints.md` — Regras de acoplamento
- `reference/vocabulary-transforms.md` — Mapeamento de vocabulário
- `reference/personality-layer.md` — Derivação de personalidade
- `reference/use-case-presets.md` — 3 presets validados
- `methodology/` — 200+ claims de pesquisa em ciência cognitiva

## Comandos Disponíveis

| Comando | Descrição |
|---------|-----------|
| `/ars:setup` | Iniciar configuração de um vault de conhecimento |
| `/ars:ask` | Perguntar sobre a metodologia |
| `/ars:help` | Mostrar ajuda contextual |

## Como Usar

Ao receber um pedido relacionado a arscontexta:
1. Leia os arquivos de referência relevantes em `.opencode/references/arscontexta/reference/`
2. Use a metodologia para fundamentar decisões
3. Siga as primitivas do kernel.yaml

Para criar um vault, execute uma conversa de derivação com o usuário para entender:
- Domínio de trabalho
- Preferências de processamento
- Necessidades de navegação
- Estilo de personalidade
