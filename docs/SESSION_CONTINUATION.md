# SESSION_CONTINUATION — Render não respeita edições (textos + scale/zoom)

## 1. Contexto / tarefas concluídas nesta sessão

- **Overlay por nicho**: `Overlay` ganhou `nicheId` + `isDefault`; upload/list/set-default/delete por nicho; seletor no editor; resolução `editor > perfil > default do nicho > global` (`src/lib/overlay.ts`).
- **Toggle "overlay atrás do vídeo"**: `EditConfig.overlayBehind`, ordem de camadas no `EditorCanvas` e no ffmpeg (`color` base + overlay + vídeo, sem `pad` opaco).
- **Anti-duplicidade (opcional)**: rotação sutil + recorte, `eq`, `noise`, `frameDrop`, `zoomBreathing` via `zoompan`. Campos no schema, zod, ffmpeg, render-worker e UI (`ControlsPanel`).
- Migrações aplicadas (`prisma db push`), client regenerado para `prisma/generated`.

## 2. Problema em investigação (bug corrigido)

O usuário reportou que o render final **não respeitava**:
1. Posição exata dos **textos** adicionados no editor.
2. **Scale/Zoom** do vídeo.

### Causa raiz (2 bugs):

**A) Scale/Zoom — clamp incorreto no ffmpeg**
- `src/lib/ffmpeg.ts` usava `scale=w=min(1080\,iw*${scale})` que **impedia** o vídeo de crescer além de 1080x1920, enquanto o preview do canvas cresce e corta (zoom-in). Resultado: zoom/scale > 1 era ignorado no render.
- **Fix aplicado**: `scale=w=trunc(iw*${scale}/2)*2:h=trunc(ih*${scale}/2)*2` — escala de verdade; o `pad`/`overlay` seguinte corta o excesso (igual ao canvas). Dimensões mantidas pares (codec-safe).

**B) Textos — fontes diferentes**
- O canvas usa `bold ... Roboto` (`EditorCanvas.tsx`), mas o ffmpeg usava **DejaVu Sans** (não-bold) → métricas (largura/ascent/line-height) diferentes → texto deslocado.
- **Fix aplicado**: Roboto Bold embarcado em `apps/dashboard/public/fonts/Roboto-Bold.ttf` e priorizado em `getDefaultFont()` (com fallback Noto/DejaVu). `line_spacing=0` do Roboto já produz line-height ≈ `1.3 * fontsize` (medido: 79px vs 78px), igual ao `lh = fs * 1.3` do canvas.

## 3. Arquivos modificados nesta sessão

- `apps/dashboard/prisma/schema.prisma` (+ `output` no generator, aponta p/ `prisma/generated`)
- Migrações: `20260805_add_overlay_niche`, `20260805_add_antidup_editconfig`
- `apps/dashboard/src/lib/ffmpeg.ts` — scale real + fonte Roboto Bold
- `apps/dashboard/src/lib/render-worker.ts` — `resolveOverlayForVideo`, `dropFrameCount`, `getVideoFps`, novos params
- `apps/dashboard/src/lib/overlay.ts` (novo)
- APIs: `overlay/upload`, `overlay/list`, `overlay/[id]`, `videos/[id]/edit-config`, `editor/replicate/[nichoId]`, `editor/replicate/perfil/[profileId]`, `debug/filter-complex/[videoId]`
- UI: `EditorCanvas.tsx`, `ControlsPanel.tsx`, `OverlaySelector.tsx`, `NicheOverlayManager.tsx`, páginas de editor/nicho/perfil
- `apps/dashboard/public/fonts/Roboto-Bold.ttf` (novo)

## 4. Verificações

- `pnpm --filter @postreels/dashboard run type-check` → **OK**
- Escala com `scale>1` + `pad` validado manualmente no ffmpeg (2160x1920 → cortado p/ 1080x1920)
- Roboto Bold: line-height 79px @ fontsize 60 ≈ canvas `1.3*60=78px` ✓

## 5. Bloqueios / dicas de ambiente

- **Prisma CLI**: `.bin` quebrado; rodar SEMPRE via `node apps/dashboard/node_modules/.pnpm/prisma@5.22.0/node_modules/prisma/build/index.js <cmd> --schema apps/dashboard/prisma/schema.prisma` a partir da raiz do repo.
- **Lint**: ESLint não instalado — `pnpm lint` falha. Usar apenas type-check.
- **Render de teste**: precisa dev server + worker BullMQ rodando (Redis/postgres/minio via docker-compose). Verificar se `startRenderWorker()` é chamado (provável em `instrumentation.ts`).
- Nenhum commit foi feito — mudanças estão uncommitted.

## 6. Próximos passos (se retomar)

1. Testar render real com `zoom/scale > 1` e textos multilinha; comparar frame com o preview.
2. Usar `GET /api/debug/filter-complex/:videoId` para inspecionar o filter_complex gerado.
3. Se o texto ainda desviar levemente, revisar `drawtext` (x/y já é topo — medido empiricamente) e ajustar `line_spacing`.
4. Conferir `cropTop/cropBottom` (ffmpeg multiplica por `scale`; canvas usa `vScale = scale*zoom` — conferir consistência quando zoom≠1).
