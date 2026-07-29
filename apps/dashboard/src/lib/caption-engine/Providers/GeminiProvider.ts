import type { CaptionProvider, CaptionOptions } from '../types'
import { buildPrompt, buildBatchPrompt, parseBatchResponse } from '../PromptBuilder'

export class GeminiProvider implements CaptionProvider {
  private apiKey: string
  private model: string

  constructor(apiKey: string, model = 'gemini-2.0-flash') {
    this.apiKey = apiKey
    this.model = model
  }

  private async call(prompt: string, maxTokens: number): Promise<string> {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent?key=${this.apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.8,
            maxOutputTokens: maxTokens,
          },
        }),
        signal: AbortSignal.timeout(60000),
      },
    )

    if (!res.ok) {
      const err = await res.text()
      throw new Error(`Gemini API error (${res.status}): ${err}`)
    }

    const data = await res.json()
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text

    if (!text) {
      throw new Error('Gemini returned empty response')
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
