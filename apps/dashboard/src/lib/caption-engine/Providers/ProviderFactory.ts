import type { CaptionProvider } from '../types'
import { GeminiProvider } from './GeminiProvider'
import { OllamaProvider } from './OllamaProvider'

let geminiInstance: GeminiProvider | null = null
let ollamaInstance: OllamaProvider | null = null

function getGemini(): GeminiProvider {
  if (!geminiInstance) {
    const apiKey = process.env.GEMINI_API_KEY
    if (!apiKey) throw new Error('GEMINI_API_KEY not configured')
    geminiInstance = new GeminiProvider(apiKey)
  }
  return geminiInstance
}

function getOllama(): OllamaProvider {
  if (!ollamaInstance) {
    const baseUrl = process.env.OLLAMA_BASE_URL || 'http://ollama:11434'
    const model = process.env.CAPTION_OLLAMA_MODEL || 'qwen2.5:3b'
    ollamaInstance = new OllamaProvider(baseUrl, model)
  }
  return ollamaInstance
}

export async function getProvider(): Promise<CaptionProvider> {
  if (process.env.CAPTION_PROVIDER === 'ollama') {
    return getOllama()
  }
  return getGemini()
}

export async function transformWithFallback(
  caption: string,
  options: Parameters<CaptionProvider['transform']>[1],
): Promise<string> {
  const errors: Error[] = []

  try {
    const primary = await getProvider()
    return await primary.transform(caption, options)
  } catch (err) {
    errors.push(err as Error)
    console.warn('[CaptionEngine] Primary provider failed, trying fallback:', (err as Error).message)
  }

  try {
    const fallback = getOllama()
    return await fallback.transform(caption, options)
  } catch (err) {
    errors.push(err as Error)
    console.error('[CaptionEngine] Fallback provider also failed:', (err as Error).message)
  }

  throw new Error(`All providers failed: ${errors.map(e => e.message).join(' | ')}`)
}

export async function transformBatchWithFallback(
  captions: string[],
  options: Parameters<CaptionProvider['transform']>[1],
): Promise<string[]> {
  const errors: Error[] = []

  try {
    const primary = await getProvider()
    return await primary.transformBatch(captions, options)
  } catch (err) {
    errors.push(err as Error)
    console.warn('[CaptionEngine] Primary provider failed for batch, trying fallback:', (err as Error).message)
  }

  try {
    const fallback = getOllama()
    return await fallback.transformBatch(captions, options)
  } catch (err) {
    errors.push(err as Error)
    console.error('[CaptionEngine] Fallback provider also failed for batch:', (err as Error).message)
  }

  throw new Error(`All providers failed: ${errors.map(e => e.message).join(' | ')}`)
}
