import type { CaptionOptions, Style } from './types'
import { transformWithFallback, transformBatchWithFallback } from './Providers/ProviderFactory'
import { normalizeCaption } from './PromptBuilder'

export { type CaptionOptions, type Style }
export { normalizeCaption }

const DEFAULT_OPTIONS: CaptionOptions = {
  style: 'viral',
  language: 'pt-BR',
  maxLength: 220,
  keepHashtags: true,
  keepEmojis: true,
  autoEmoji: true,
}

const BATCH_SIZE = Number(process.env.CAPTION_BATCH_SIZE) || 10

export function getDefaultOptions(): CaptionOptions {
  return {
    ...DEFAULT_OPTIONS,
    style: (process.env.CAPTION_STYLE as Style) || DEFAULT_OPTIONS.style,
    language: process.env.CAPTION_LANGUAGE || DEFAULT_OPTIONS.language,
    maxLength: Number(process.env.CAPTION_MAX_LENGTH) || DEFAULT_OPTIONS.maxLength,
    keepHashtags: process.env.CAPTION_KEEP_HASHTAGS !== 'false',
    keepEmojis: process.env.CAPTION_KEEP_EMOJIS !== 'false',
    autoEmoji: process.env.CAPTION_AUTO_EMOJI !== 'false',
  }
}

export async function transformCaption(
  original: string,
  overrides?: Partial<CaptionOptions>,
): Promise<string> {
  if (!original || !original.trim()) {
    return original
  }

  const inputLen = original.length
  const dynamicMax = inputLen > 200
    ? Math.min(Math.round(inputLen * 0.85), 300)
    : inputLen > 100
      ? Math.round(inputLen * 1.1)
      : Math.round(inputLen * 1.5)

  const options = { ...getDefaultOptions(), maxLength: Math.max(dynamicMax, 30), ...overrides }

  const normalized = normalizeCaption(original)

  try {
    const result = await transformWithFallback(normalized, options)
    if (result && result !== normalized) return result
    console.warn('[CaptionEngine] Model returned same or empty text, saving normalized as fallback')
    return normalized
  } catch (err) {
    console.error('[CaptionEngine] All providers failed:', (err as Error).message)
    return normalized
  }
}

export async function transformCaptionBatch(
  originals: string[],
  overrides?: Partial<CaptionOptions>,
): Promise<string[]> {
  const valid = originals.map((c, i) => ({ caption: c, index: i }))
  const results: string[] = [...originals]
  const options = { ...getDefaultOptions(), ...overrides }

  for (let i = 0; i < valid.length; i += BATCH_SIZE) {
    const batch = valid.slice(i, i + BATCH_SIZE)
    const captions = batch.map(b => b.caption).filter(c => c && c.trim())

    if (captions.length === 0) continue

    try {
      const generated = await transformBatchWithFallback(captions, options)
      for (let j = 0; j < generated.length; j++) {
        const origIdx = batch[j]?.index
        if (origIdx !== undefined && generated[j]) {
          results[origIdx] = generated[j]
        }
      }
      console.log(`[CaptionEngine] Batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(valid.length / BATCH_SIZE)} done (${captions.length} captions)`)
    } catch (err) {
      console.error(`[CaptionEngine] Batch ${Math.floor(i / BATCH_SIZE) + 1} failed, keeping originals:`, (err as Error).message)
    }
  }

  return results
}
