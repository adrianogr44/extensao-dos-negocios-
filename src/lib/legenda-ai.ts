import ffmpeg from 'fluent-ffmpeg'
import OpenAI from 'openai'
import fs from 'fs'
import path from 'path'
import os from 'os'
import { getVideoDuration } from '@/lib/video-processor'

export interface LegendaAiResult {
  topic: string
  caption: string
  hashtags: string[]
  fullText: string
  frames: number
  transcript: string | null
}

const SYSTEM_PROMPT = `Você é um especialista em legendas virais para Reels de futebol e motivação, escrevendo em português brasileiro.

Você vai RECEBER FRAMES de um vídeo (imagens do que acontece) e a TRANSCRIÇÃO do áudio (se houver). Com base nisso, identifique EXATAMENTE sobre o que é o vídeo (time, jogador, tema, momento, texto falado/escrito).

Gere uma legenda no seguinte FORMATO EXATO (use o modelo como referência de estilo):

Quando o Neymar entrava em campo no modo Champions League, a defesa adversária já sabia que a noite ia ser longa! ☠️🔥

O vídeo de hoje relembra o dia em que o craque brasileiro simplesmente engoliu o Istanbul Basaksehir com uma das atuações mais absurdas da sua carreira pelo PSG. Foram canetas desconcertantes, arrancadas imparáveis, finalizações de fora da área e um hat-trick de respeito que colocou a Europa inteira aos seus pés. O camisa 10 estava solto, com a bola colada na chuteira e distribuindo aquela ousadia letal que a gente tanto ama. Um verdadeiro show de mágica e frieza sob as luzes do Parc des Princes! 🥶🪄

Aperte o play, sinta a nostalgia e desfrute desse verdadeiro espetáculo do nosso craque.

REGRAS:
1. PRIMEIRA LINHA: um gancho curto e forte sobre o conteúdo do vídeo, com 1-2 emojis no final.
2. SEGUNDO PARÁGRAFO (2-4 frases): detalhe o que ACONTECE de verdade no vídeo (nome do jogador/time, jogadas, momento histórico, texto exibido falado). Nunca invente fatos que não estão nos frames ou na transcrição.
3. TERCEIRA LINHA: chamada para ação do tipo "Aperte o play...", relacionada ao conteúdo.
4. HASHTAGS: exatamente 5, no MESMO padrao do exemplo: cada tag e uma palavra ou palavras compostas SEM espaços, com PalavrasCapitalizadas (ex.: #Neymar #PSG #ChampionsLeague #FutebolArte #FutebolInternacional). Devem ser SEMPRE sobre o conteúdo real do vídeo (nome do jogador, time, tema). NAO use tags genéricas como #viral #fyp e NAO use acentos.
5. NUNCA mude o padrão do exemplo. NUNCA invente informações ausentes (se nao souber o nome de alguém, descreva o que vê).

Responda SOMENTE em JSON válido: {"topic": "resumo curto (10-15 palavras) sobre o que é o vídeo", "caption": "a legenda SEM as hashtags, com \n\n entre parágrafos", "hashtags": ["#Tag1", "#Tag2", "#Tag3", "#Tag4", "#Tag5"]}`

const DEFAULT_MODEL = 'gpt-4o-mini'

function getOpenAI(apiKey?: string): OpenAI | null {
  const key = apiKey || process.env.LEGENDA_AI_API_KEY || process.env.OPENAI_API_KEY
  if (!key) return null
  return new OpenAI({
    apiKey: key,
    baseURL: process.env.LEGENDA_AI_BASE_URL || undefined,
  })
}

function getModel(): string {
  return process.env.LEGENDA_AI_MODEL || DEFAULT_MODEL
}

async function extractFrames(videoPath: string, tmpDir: string, frameCount = 6): Promise<string[]> {
  const duration = await getVideoDuration(videoPath)
  if (duration <= 0) throw new Error('Não foi possível ler a duração do vídeo')

  const timestamps: string[] = []
  const step = Math.max(0.5, duration / (frameCount + 1))
  for (let i = 1; i <= frameCount; i++) {
    const t = Math.min(duration - 0.2, i * step)
    if (t > 0) timestamps.push(t.toFixed(2))
  }

  const frames: string[] = []
  for (let i = 0; i < timestamps.length; i++) {
    const out = path.join(tmpDir, `frame-${i}.jpg`)
    await new Promise<void>((resolve, reject) => {
      ffmpeg(videoPath)
        .outputOptions(['-ss', timestamps[i], '-frames:v', '1', '-vf', 'scale=480:-2', '-q:v', '5'])
        .output(out)
        .on('end', () => resolve())
        .on('error', reject)
        .run()
    })
    if (fs.existsSync(out)) frames.push(out)
  }
  return frames
}

async function transcribeAudio(videoPath: string, tmpDir: string, openai: OpenAI): Promise<string | null> {
  const audioPath = path.join(tmpDir, 'audio.mp3')
  try {
    await new Promise<void>((resolve, reject) => {
      ffmpeg(videoPath)
        .outputOptions(['-vn', '-ac', '1', '-ar', '16000', '-b:a', '64k'])
        .output(audioPath)
        .on('end', () => resolve())
        .on('error', reject)
        .run()
    })
    if (!fs.existsSync(audioPath)) return null
    const transcription = await openai.audio.transcriptions.create({
      file: fs.createReadStream(audioPath),
      model: 'whisper-1',
    })
    const text = transcription.text?.trim()
    return text && text.length > 4 ? text : null
  } catch {
    return null
  }
}

function cleanup(dir: string) {
  try {
    if (fs.existsSync(dir)) fs.rmSync(dir, { recursive: true, force: true })
  } catch {}
}

export async function generateCaptionFromVideo(
  videoPath: string,
  apiKey?: string
): Promise<LegendaAiResult> {
  const openai = getOpenAI(apiKey)
  if (!openai) throw new Error('OPENAI_API_KEY não configurada — adicione em Configurações ou no .env')

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'legenda-ai-'))
  try {
    const [frames, transcript] = await Promise.all([
      extractFrames(videoPath, tmpDir),
      transcribeAudio(videoPath, tmpDir, openai).catch(() => null),
    ])

    if (frames.length === 0) {
      throw new Error('Não foi possível extrair frames do vídeo (ffmpeg?)')
    }

    const content: OpenAI.Chat.Completions.ChatCompletionContentPart[] = [
      {
        type: 'text',
        text: transcript
          ? `Transcrição do áudio do vídeo:\n"""${transcript}"""\n\nAgora analise os frames abaixo e gere a legenda.`
          : 'Sem transcrição de áudio disponível. Analise apenas os frames abaixo e gere a legenda.',
      },
      ...frames.map(
        (f): OpenAI.Chat.Completions.ChatCompletionContentPart => ({
          type: 'image_url',
          image_url: {
            url: `data:image/jpeg;base64,${fs.readFileSync(f).toString('base64')}`,
          },
        })
      ),
    ]

    const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content },
    ]

    let response: OpenAI.Chat.Completions.ChatCompletion
    try {
      response = await openai.chat.completions.create({
        model: getModel(),
        response_format: { type: 'json_object' },
        messages,
        temperature: 0.9,
        max_tokens: 900,
      })
    } catch (firstErr) {
      try {
        response = await openai.chat.completions.create({
          model: getModel(),
          messages,
          temperature: 0.9,
          max_tokens: 900,
        })
      } catch {
        throw firstErr
      }
    }

    const text = response.choices[0]?.message?.content || ''
    let parsed: { topic?: string; caption?: string; hashtags?: string[] } = {}
    try {
      parsed = JSON.parse(text)
    } catch {
      const cap = text.split('\n').filter((l) => l.trim()).join('\n')
      parsed = { caption: cap, hashtags: [] }
    }

    const hashtags = (parsed.hashtags || [])
      .map((h) => String(h).trim().replace(/^#+/, ''))
      .filter((h) => /^[A-Za-zÀ-ÿ0-9]+$/.test(h))
      .slice(0, 5)
      .map((h) => '#' + h)

    const caption = (parsed.caption || '').trim().replace(/<br\s*\/?>/gi, '\n');
    const fullText = hashtags.length ? `${caption}\n\n${hashtags.join(' ')}` : caption

    return {
      topic: (parsed.topic || '').trim(),
      caption,
      hashtags,
      fullText,
      frames: frames.length,
      transcript,
    }
  } finally {
    cleanup(tmpDir)
  }
}