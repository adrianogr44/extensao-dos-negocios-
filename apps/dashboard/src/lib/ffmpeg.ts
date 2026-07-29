import { execa } from 'execa'
import { existsSync } from 'node:fs'

const FFMPEG_PATH = process.env.FFMPEG_PATH || 'ffmpeg'
const FFPROBE_PATH = process.env.FFPROBE_PATH || 'ffprobe'

// drawtext usa libfreetype, que só suporta fontes outline (TrueType/OpenType com contornos).
// NotoColorEmoji.ttf é uma fonte bitmap colorida (CBDT/CBLC) — NÃO funciona com drawtext.
// Priorizamos fontes outline com boa cobertura Unicode.
function getDefaultFont() {
  const candidates = [
    '/usr/share/fonts/truetype/noto/NotoSans-Regular.ttf',
    '/usr/share/fonts/opentype/noto/NotoSans-Regular.ttf',
    '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',
    '/usr/share/fonts/truetype/noto/NotoSansMono-Regular.ttf',
  ]

  for (const candidate of candidates) {
    if (existsSync(candidate)) {
      console.log(`[ffmpeg] Usando fonte: ${candidate}`)
      return candidate
    }
  }

  console.log(`[ffmpeg] Nenhuma fonte encontrada. Usando DejaVu Sans (fallback)`)
  return '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf'
}

const FONT_PATH = process.env.FFMPEG_FONT_PATH || getDefaultFont()

export interface FfmpegProgress {
  percent: number
  fps: number
  speed: string
  time: string
}

export async function getVideoInfo(filePath: string) {
  const { stdout } = await execa(FFPROBE_PATH, [
    '-v', 'quiet',
    '-print_format', 'json',
    '-show_format',
    '-show_streams',
    filePath,
  ])
  return JSON.parse(stdout)
}

export function buildOverlayFilter(params: {
  inputVideo: string
  inputOverlay: string
  outputPath: string
  video: { posX: number; posY: number; scale: number; zoom: number }
  overlay: { posX: number; posY: number; cropTop: number; cropBottom: number; opacity: number }
  volume: number
  speed?: number
  mirror?: boolean
  cropTop?: number
  cropBottom?: number
  bgColor?: string
  cropColor?: string
  cropOpacity?: number
  texts?: Array<{ content: string; x: number; y: number; fontSize: number; color: string }>
}) {
  const { video, overlay, volume, speed, mirror, cropTop, cropBottom, bgColor, cropColor, cropOpacity, texts } = params

  const scale = Math.max(0.5, Math.min(3, (video.zoom || 1) * (video.scale || 1)))
  const speedVal = Math.max(0.5, Math.min(2, speed ?? 1))
  const overlayX = Math.round(overlay.posX || 0)
  const overlayY = Math.round(overlay.posY || 0)
  const posX = Math.round(video.posX || 0)
  const posY = Math.round(video.posY || 0)

  const filters: string[] = []

  // VIDEO CHAIN
  // 1. Espelha (se necessário)
  // 2. Scale: mantém aspect ratio, limita ao máximo
  // 3. Crop bars: barras coloridas top/bottom sobre o vídeo
  // 4. Ajusta velocidade (se necessário)
  // 5. Pad: centra no canvas 1080x1920 com fundo preto
  let videoChain = '[0:v]'

  if (mirror) {
    videoChain += 'hflip,'
  }

  // Scale com safe bounds: nunca deixa maior que 1080x1920
  videoChain += `scale=w=min(1080\\,iw*${scale}):h=min(1920\\,ih*${scale}):force_original_aspect_ratio=decrease`

  // Crop bars: drawbox no topo e/ou base do vídeo escalado
  const cropT = Math.round((cropTop || 0) * scale)
  const cropB = Math.round((cropBottom || 0) * scale)
  if (cropT > 0) {
    videoChain += `,drawbox=x=0:y=0:w=iw:h=${cropT}:color=${cropColor || '#000000'}@${cropOpacity ?? 1}:t=fill`
  }
  if (cropB > 0) {
    videoChain += `,drawbox=x=0:y=ih-${cropB}:w=iw:h=${cropB}:color=${cropColor || '#000000'}@${cropOpacity ?? 1}:t=fill`
  }

  if (Math.abs(speedVal - 1) > 0.001) {
    videoChain += `,setpts=PTS/${speedVal}`
  }

  // Pad: centraliza em 1080x1920 com offset posX/posY do editor
  const padX = posX >= 0 ? `(ow-iw)/2+${posX}` : `(ow-iw)/2${posX}`
  const padY = posY >= 0 ? `(oh-ih)/2+${posY}` : `(oh-ih)/2${posY}`
  videoChain += `,pad=w=1080:h=1920:x=${padX}:y=${padY}:color=${bgColor || 'black'}[v]`
  filters.push(videoChain)

  // OVERLAY CHAIN
  // 1. Crop overlay (top/bottom)
  // 2. Converte para RGBA
  // 3. Aplica opacidade via alpha channel
  let overlayChain = '[1:v]'

  const ocT = overlay.cropTop || 0
  const ocB = overlay.cropBottom || 0
  if (ocT > 0 || ocB > 0) {
    overlayChain += `crop=w=iw:h=ih-${ocT + ocB}:x=0:y=${ocT},`
  }

  overlayChain += 'format=rgba'

  const overlayOpacity = overlay.opacity ?? 1
  if (Math.abs(overlayOpacity - 1) > 0.001) {
    overlayChain += `,colorchannelmixer=aa=${overlayOpacity}`
  }

  overlayChain += '[ov]'
  filters.push(overlayChain)

  // COMPOSITE
  // Sobrepõe overlay na posição especificada
  filters.push(`[v][ov]overlay=x=${overlayX}+(W-w)/2:y=${overlayY}+(H-h)/2:format=auto[comp]`)

  // TEXT RENDERING via drawtext
  let currentLabel = 'comp'

  if (texts && texts.length > 0) {
    let textChain = `[${currentLabel}]`
    for (const t of texts) {
      if (!t.content) continue

      const escaped = t.content
        .replace(/\\/g, '\\\\')
        .replace(/:/g, '\\:')
        .replace(/,/g, '\\,')
        .replace(/\[/g, '\\[')
        .replace(/\]/g, '\\]')
        .replace(/=/g, '\\=')
      textChain += `drawtext=text='${escaped}':x=${t.x}:y=${t.y}:fontsize=${t.fontSize}:fontcolor=${t.color}:fontfile=${FONT_PATH},`
    }
    textChain = textChain.slice(0, -1) + '[texted]'
    filters.push(textChain)
    currentLabel = 'texted'
  }

  // OUTPUT CHAIN
  // Formata para yuv420p (compatível com h.264)
  filters.push(`[${currentLabel}]format=yuv420p[out]`)

  const filterComplex = filters.join(';')

  console.log(`[buildOverlayFilter] Filter complex string:
${filterComplex}`)
  console.log(`[buildOverlayFilter] Config:
  - Scale: ${scale}x
  - Speed: ${speedVal}
  - Video pos: (${posX}, ${posY})
  - BG Color: ${bgColor || 'black'}
  - Crop bars: top=${cropT}px bottom=${cropB}px color=${cropColor || '#000000'}@${cropOpacity ?? 1}
  - Overlay pos: (${overlayX}, ${overlayY})
  - Overlay crop: top=${ocT}px bottom=${ocB}px
  - Overlay opacity: ${overlayOpacity}
  - Texts: ${texts?.length || 0}
  - Filter chain: ${filterComplex}`)

  const args = [
    '-i', params.inputVideo,
    '-i', params.inputOverlay,
    '-filter_complex', filterComplex,
    '-map', '[out]',
    '-map', '0:a?',
  ]

  // Audio processing
  const audioFilters: string[] = []
  if (Math.abs(volume - 1) > 0.001) {
    audioFilters.push(`volume=${volume}`)
  }
  if (Math.abs(speedVal - 1) > 0.001) {
    audioFilters.push(`atempo=${speedVal}`)
  }
  if (audioFilters.length > 0) {
    args.push('-af', audioFilters.join(','))
  }

  // Video codec settings
  args.push(
    '-c:v', 'libx264',
    '-preset', 'medium',
    '-crf', '23',
    '-c:a', 'aac',
    '-b:a', '128k',
    '-y',
    params.outputPath
  )

  return args
}

export async function renderVideoWithProgress(args: string[], bullJob: any) {
  let lastUpdate = 0
  return renderVideo(args, (progress) => {
    if (bullJob) {
      const now = Date.now()
      // Atualiza progresso a cada 5 segundos no máximo
      if (now - lastUpdate > 5000) {
        bullJob.updateProgress(50)
        lastUpdate = now
      }
    }
  })
}

export async function renderVideo(args: string[], onProgress?: (p: FfmpegProgress) => void) {
  const filterComplexIdx = args.indexOf('-filter_complex')
  if (filterComplexIdx >= 0) {
    const fc = args[filterComplexIdx + 1]
    console.log(`[renderVideo] Filter complex (first 200 chars):
${fc.substring(0, 200)}`)
    // Escrever em arquivo para debug
    const { writeFileSync } = await import('fs')
    writeFileSync('/tmp/filter_complex_debug.txt', fc, 'utf-8')
  }
  console.log(`[renderVideo] Iniciando FFmpeg com comando:
ffmpeg ${args.join(' ')}`)

  let stderrBuffer = ''
  let stdoutBuffer = ''

  try {
    const proc = execa(FFMPEG_PATH, args, {
      buffer: false,
      stdio: ['pipe', 'pipe', 'pipe'],
    })

    // Capturar STDERR
    if (proc.stderr) {
      proc.stderr.on('data', (chunk: Buffer) => {
        const output = chunk.toString()
        stderrBuffer += output

        // Log das linhas
        const lines = output.split('\n')
        for (const line of lines) {
          if (!line.trim()) continue

          // Log de progresso
          if (line.includes('frame=') || line.includes('time=')) {
            console.log(`[ffmpeg-progress] ${line}`)
          }
          // Log de warnings/erros
          else if (line.includes('Warning') || line.includes('Error') || line.includes('error')) {
            console.warn(`[ffmpeg-warning] ${line}`)
          }

          // Parser de progresso
          if (onProgress) {
            const timeMatch = line.match(/time=(\d+:\d+:\d+\.?\d*)/)
            const fpsMatch = line.match(/fps=\s*(\d+(?:\.\d+)?)/)
            const speedMatch = line.match(/speed=\s*([\d.]+)x/)

            if (timeMatch || fpsMatch || speedMatch) {
              onProgress({
                time: timeMatch ? timeMatch[1] : '00:00:00.00',
                fps: fpsMatch ? parseFloat(fpsMatch[1]) : 0,
                speed: speedMatch ? `${speedMatch[1]}x` : '0x',
                percent: 0,
              })
            }
          }
        }
      })
    }

    // Capturar STDOUT
    if (proc.stdout) {
      proc.stdout.on('data', (chunk: Buffer) => {
        stdoutBuffer += chunk.toString()
      })
    }

    // Aguardar conclusão
    await proc

    console.log(`[renderVideo] ✅ FFmpeg concluído com sucesso`)
  } catch (error) {
    const err = error as any

    console.error(`[renderVideo] ❌ FFmpeg FALHOU`)
    console.error(`[renderVideo] Código de saída: ${err.exitCode || 1}`)
    console.error(`[renderVideo] STDERR output (${stderrBuffer.length} bytes):`)
    console.error(stderrBuffer)
    console.error(`[renderVideo] STDOUT output (${stdoutBuffer.length} bytes):`)
    console.error(stdoutBuffer)
    console.error(`[renderVideo] Comando: ffmpeg ${args.join(' ')}`)

    // Extrair mensagem de erro significativa
    const errorLines = stderrBuffer.split('\n').filter(l => l.includes('Error') || l.includes('Invalid') || l.includes('Unrecognized'))
    const errorMsg = errorLines.length > 0 ? errorLines[0] : stderrBuffer.split('\n').pop() || 'Unknown error'

    throw new Error(`FFmpeg render failed (exit code ${err.exitCode}): ${errorMsg}`)
  }
}
