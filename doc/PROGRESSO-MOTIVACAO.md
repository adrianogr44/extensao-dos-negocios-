# Ambiente Motivação — Status do Projeto

> Documento vivo. Atualizado em: 08/08/2026
> Status geral: **IMPLEMENTADO** — testes de isolamento executados com sucesso.

---

## 1. O que foi implementado

Criação do segundo ambiente de automação (`motivacao`) rodando **lado a lado** com o existente (`futebol`), **reutilizando** o mesmo `scripts/postar-completo.js` — sem duplicação de lógica.

### Arquivos modificados

| Arquivo | O que mudou |
|---|---|
| `scripts/postar-completo.js` | Detecção de perfil (`--profile=motivacao` / `PROFILE=motivacao`; default `futebol`). Sobrescrita de `process.env` com `MOTIVACAO_*` ANTES das constantes (porta CDP, vídeos, fila, lock, limites, legendas, FB/YT). `QUEUE_FILE` e `LOCK_FILE` viraram env-áveis. URL do Facebook e Shorts parametrizados. Log de conexão mostra a porta real. Banner `[FUTEBOL]`/`[Motivação]`. Export `describeAmbiente()` para diagnóstico. |
| `scripts/notify.js` | Prefixo `[🎬 Motivação]` nas mensagens Telegram quando `NOTIFICATION_TAG` estiver definido (futebol sem tag = comportamento anterior). |
| `scripts/postar-agendado.js` | Scheduler por perfil: `schedule-config-motivacao.json`, `postar-log-motivacao.txt`, porta 9223 e launcher `launch-chrome-motivacao.cmd` para motivacao; default continua futebol. |
| `.env` | Bloco `VIDEOS_DIR` (futebol → `videos editados fut`) + bloco `MOTIVACAO_*` completo (porta, vídeos, fila, lock, kwai, limites, legendas, placeholders vazios de página/canal). |

### Arquivos criados

| Arquivo | Função |
|---|---|
| `scripts/launch-chrome-motivacao.cmd` | Chrome exclusivo porta **9223**, perfil `chrome-debug-profile-motivacao`, **sem** `taskkill` (futebol 9222 continua aberto). |
| `scripts/schedule-config-motivacao.json` | Horários do Motivação: `12:00` e `19:00` (SP). |
| `doc/PROGRESSO-MOTIVACAO.md` | Este documento. |

---

## 2. Como usar

```cmd
:: Futebol (igual a antes)
node scripts\postar-completo.js
node scripts\postar-agendado.js

:: Chrome do Motivacao (perfil próprio, porta 9223)
scripts\launch-chrome-motivacao.cmd

:: Login manual das contas MOTIVACAO (IG, TikTok, Facebook, YouTube Studio)
:: Nessa janela, uma vez só.

:: Motivacao (teste manual de postagem)
node scripts\postar-completo.js --profile=motivacao

:: Motivacao (agendado)
node scripts\postar-agendado.js --profile=motivacao
```

---

## 3. Tabela final de isolamento

| Item           | Futebol                                   | Motivacao                                     |
| -------------- | ----------------------------------------- | ------------------------------------------ |
| CLI            | `node scripts\postar-completo.js`         | `node scripts\postar-completo.js --profile=motivacao` |
| Chrome profile | `%USERPROFILE%\chrome-debug-profile`      | `%USERPROFILE%\chrome-debug-profile-motivacao` |
| CDP            | `9222`                                    | `9223`                                     |
| Vídeos         | `Downloads\videos editados fut` (`VIDEOS_DIR` no `.env`) | `Downloads\videos editados motiv` |
| Queue          | `scripts\posts-queue.json`                | `scripts\posts-queue-motivacao.json`              |
| Lock           | `scripts\.posting.lock`                   | `scripts\.posting-motivacao.lock`            |
| Debug          | `videos\debug` (screenshots)              | `scripts\fb_debug-motivacao` (honra `DEBUG_DIR`) |
| Instagram      | Sim                                       | Sim                                    |
| TikTok         | Sim                                       | Sim                                     |
| Facebook       | Sim (URL do `.env`)                       | Sim (via `MOTIVACAO_FACEBOOK_PAGE_URL`)       |
| Shorts         | Sim (studio raiz)                         | Sim (canal via `MOTIVACAO_YOUTUBE_CHANNEL_ID`) |
| Kwai           | Não usado no fluxo atual                  | Desativado (`KWAI_ENABLED=false`)          |
| Scheduler      | `schedule-config.json` (11:30, 18:30)     | `schedule-config-motivacao.json` (12:00, 19:00) |
| Logs           | `postar-log.txt`                          | `postar-log-motivacao.txt`                  |
| Telegram      | Sem tag                                   | `[🎬 Motivação]`                             |

### Testes executados (resultado)

- `node --check` nos 3 arquivos → **OK**
- `describeAmbiente()` futebol → porta 9222, `posts-queue.json`, `videos editados fut` → **OK**
- `describeAmbiente()` motivacao → porta 9223, `posts-queue-motivacao.json`, `.posting-motivacao.lock`, Kwai false → **OK**
- Fila: criar vídeo dummy na pasta motivacao → tratado por `posts-queue-motivacao.json`; `posts-queue.json` **inalterada** (hash igual) → **OK**
- Lock: `.posting.lock` do futebol **não** bloqueia o motivacao; ./lock próprio bloqueia repetidos → **OK**
- CLI espertar em execução: `Conectando ao Chrome (porta 9223)` (sem Chrome Motivação aberto, falha por conexão — como esperado) → **OK**
- Scheduler Motivação: leu `schedule-config-motivacao.json`, logou `[Motivação]` em `postar-log-motivacao.txt` → **OK**

---

## 4. Pendências / avisos importantes

1. **Fila do Futebol aponta para pasta removida.** `scripts/posts-queue.json` contém 11 vídeos com caminho `Downloads\videos editados` que **não existe mais** → o futebol hoje reporta "Nenhum vídeo pendente". Para voltar a postar: apagar `posts-queue.json` (com backup) e rodar novamente (a fila é recriada a partir de `videos editados fut`). **Não fiz isso sem sua autorização.**
2. **`MOTIVACAO_FACEBOOK_PAGE_URL` e `MOTIVACAO_YOUTUBE_CHANNEL_ID` estão vazios no `.env`** — preencha antes de postar no motivacao. Sem isso, a postagem de Facebook/Youtube falha com erro explícito (sem cair na URL do futebol).
3. **Kwai**: o código atual não posta Kwai de nenhuma forma (só campos de fila) — `KWAI_ENABLED=false` é apenas formalidade.
4. **Lock órfão em saídas antecipadas** (bug pré-existente): quando `main()` sai cedo ("nenhum vídeo", "limite") o arquivo de lock fica para trás; a lógica remove sozinha após 20 min. Presente tanto no futebol quanto no motivacao (mesmo código).
5. Dashboard/`serve-studio.js`: continuam apontando para `posts-queue.json` (futebol). Motivacao sem dashboard — como acordado.