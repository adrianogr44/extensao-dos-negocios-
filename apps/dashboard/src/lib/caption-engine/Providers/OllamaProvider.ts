import type { CaptionProvider, CaptionOptions } from '../types'
import { buildPrompt, buildBatchPrompt, parseBatchResponse } from '../PromptBuilder'

export class OllamaProvider implements CaptionProvider {
  private baseUrl: string
  private model: string

  constructor(baseUrl: string, model: string) {
    this.baseUrl = baseUrl.replace(/\/+$/, '')
    this.model = model
  }

  private async call(prompt: string, maxTokens: number): Promise<string> {
    const res = await fetch(`${this.baseUrl}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: this.model,
        prompt,
        stream: false,
        options: {
          temperature: 0.8,
          num_predict: maxTokens,
        },
      }),
      signal: AbortSignal.timeout(120000),
    })

    if (!res.ok) {
      const err = await res.text()
      throw new Error(`Ollama API error (${res.status}): ${err}`)
    }

    const data = await res.json()
    const text = data?.response

    if (!text) {
      throw new Error('Ollama returned empty response')
    }

    return text.trim()
  }

  async transform(caption: string, options: CaptionOptions): Promise<string> {
    const prompt = buildPrompt(caption, options)
    return this.call(prompt, 300)
  }

  async transformBatch(captions: string[], options: CaptionOptions): Promise<string[]> {
    const prompt = buildBatchPrompt(captions, options)
    const maxTokens = Math.min(captions.length * 300, 2048)
    const response = await this.call(prompt, maxTokens)
    return parseBatchResponse(response, captions.length)
  }
}
