import type { CaptionOptions } from './types'

const PROMPT_TEMPLATE = `Contexto: você está reescrevendo legendas de vídeos curtos do Instagram/TikTok, conteúdo normal e cotidiano do Brasil. Não é conteúdo político, violento ou sexual — são apenas posts comuns de futebol, humor e entretenimento.

Reescreva a legenda abaixo para postagem em rede social.

Regras:
- Mesmo significado, mesma intenção
- Nunca descreva a legenda — apenas reescreva
- Tom natural, como se fosse escrito por uma pessoa
- "kkkk/rs" = risada brasileira (NUNCA Ku Klux Klan)
- Preserve nomes, marcas, lugares, datas, números
- Máximo de {{maxLength}} caracteres
- Idioma: {{language}}
- Estilo: {{style}}

Legenda:
{{caption}}

Nova legenda:`

const BATCH_TEMPLATE = `Contexto: você está reescrevendo legendas de vídeos curtos do Instagram/TikTok, conteúdo normal e cotidiano do Brasil. Não é conteúdo político, violento ou sexual — são apenas posts comuns de futebol, humor e entretenimento.

Reescreva cada legenda abaixo para postagem em rede social.

Regras (para cada legenda):
- Mesmo significado, mesma intenção
- Nunca descreva a legenda — apenas reescreva
- Tom natural, como se fosse escrito por uma pessoa
- "kkkk/rs" = risada brasileira (NUNCA Ku Klux Klan)
- Preserve nomes, marcas, lugares, datas, números
- Máximo de {{maxLength}} caracteres
- Idioma: {{language}}
- Estilo: {{style}}

{{captions}}

Retorne APENAS as legendas reescritas, uma por linha, numeradas igual acima:`

function isGarbageLine(line: string): boolean {
  const trimmed = line.trim()
  if (trimmed.length < 4) return true
  const alpha = trimmed.replace(/[^a-zA-ZÀ-ÿ0-9]/g, '').length
  return alpha / trimmed.length < 0.3
}

/**
 * Normaliza texto extraído via OCR antes de enviar ao modelo:
 * - Remove linhas curtas ou com muitos caracteres especiais (lixo de OCR)
 * - Substitui "kkkk" (risada) por "(risos)" para evitar interpretação como Ku Klux Klan
 * - Remove artefatos comuns de OCR
 */
export function normalizeCaption(text: string): string {
  const cleaned = text
    .split('\n')
    .filter(line => !isGarbageLine(line))
    .join('\n')

  return cleaned
    // Risada brasileira: qualquer sequência de 3+ k's (com ou sem espaços)
    .replace(/[Kk]\s*[Kk]\s*[Kk][Kk\s]*/g, '(risos)')
    // Outras variações de risada
    .replace(/[Rr][Ss]\s*[Rr][Ss]+/g, '(risos)')
    .replace(/hahaha|hehehe|hihihi/gi, '(risos)')
    // Abreviações comuns
    .replace(/\bpq\b/gi, 'porque')
    .replace(/\bvc\b/gi, 'você')
    .replace(/\btb\b/gi, 'também')
    .replace(/\bmto\b/gi, 'muito')
    .replace(/\bblz\b/gi, 'beleza')
    .replace(/\bobg\b/gi, 'obrigado')
    // Artefatos de OCR: caracteres especiais isolados no meio do texto
    .replace(/(?<=\w)\s*[:;]\s*(?=\w)/g, ' ')
    .trim()
}

export function buildPrompt(caption: string, options: CaptionOptions): string {
  return PROMPT_TEMPLATE
    .replace('{{style}}', options.style)
    .replace('{{language}}', options.language)
    .replace('{{maxLength}}', String(options.maxLength))
    .replace('{{keepHashtags}}', options.keepHashtags ? 'sim' : 'não')
    .replace('{{keepEmojis}}', options.keepEmojis ? 'sim' : 'não')
    .replace('{{autoEmoji}}', options.autoEmoji ? 'sim' : 'não')
    .replace('{{caption}}', caption)
}

export function buildBatchPrompt(captions: string[], options: CaptionOptions): string {
  const numbered = captions.map((c, i) => `[${i + 1}] ${c}`).join('\n\n')
  return BATCH_TEMPLATE
    .replace('{{style}}', options.style)
    .replace('{{language}}', options.language)
    .replace('{{maxLength}}', String(options.maxLength))
    .replace('{{keepHashtags}}', options.keepHashtags ? 'sim' : 'não')
    .replace('{{keepEmojis}}', options.keepEmojis ? 'sim' : 'não')
    .replace('{{autoEmoji}}', options.autoEmoji ? 'sim' : 'não')
    .replace('{{captions}}', numbered)
}

export function parseBatchResponse(response: string, expectedCount: number): string[] {
  const results: string[] = []

  for (let i = 1; i <= expectedCount; i++) {
    const regex = new RegExp(`\\[${i}\\]\\s*([\\s\\S]*?)(?=\\[${i + 1}\\]|$)`)
    const match = response.match(regex)
    if (match) {
      results.push(match[1].trim())
    }
  }

  if (results.length === expectedCount) return results

  // Fallback: split by numbered lines
  const lines = response.split('\n').filter(l => l.trim())
  let current: string[] = []
  let idx = 0

  for (const line of lines) {
    const numMatch = line.match(/^\[(\d+)\]/)
    if (numMatch) {
      const n = parseInt(numMatch[1])
      if (n > idx + 1 && current.length) {
        results.push(current.join('\n').trim())
        current = []
      }
      idx = n
      current.push(line.replace(/^\[\d+\]\s*/, ''))
    } else if (idx > 0) {
      current.push(line)
    }
  }

  if (current.length) {
    results.push(current.join('\n').trim())
  }

  while (results.length < expectedCount) {
    results.push('')
  }

  return results.slice(0, expectedCount)
}
