export interface CaptionOptions {
  style: Style
  language: string
  maxLength: number
  keepHashtags: boolean
  keepEmojis: boolean
  autoEmoji: boolean
}

export type Style =
  | 'original'
  | 'viral'
  | 'casual'
  | 'professional'
  | 'informative'
  | 'persuasive'
  | 'storytelling'
  | 'minimal'

export interface CaptionProvider {
  transform(caption: string, options: CaptionOptions): Promise<string>
  transformBatch(captions: string[], options: CaptionOptions): Promise<string[]>
}

export interface CaptionConfig {
  enabled: boolean
  provider: 'gemini' | 'ollama'
  fallbackProvider: 'gemini' | 'ollama'
  gemini: {
    apiKey: string
    model: string
  }
  ollama: {
    baseUrl: string
    model: string
  }
  temperature: number
  maxTokens: number
  language: string
  style: Style
  keepHashtags: boolean
  keepEmojis: boolean
  autoEmoji: boolean
  maxLength: number
}
