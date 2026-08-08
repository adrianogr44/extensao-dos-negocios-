import { execa } from 'execa'
import { existsSync } from 'node:fs'

const FFMPEG_PATH = process.env.FFMPEG_PATH || 'ffmpeg'
const FFPROBE_PATH = process.env.FFPROBE_PATH || 'ffprobe'

// drawtext usa libfreetype, que só suporta fontes outline (TrueType/OpenType com contornos).
// NotoColorEmoji.ttf é uma fonte bitmap colorida (CBDT/CBLC) — NÃO funciona com drawtext.
// Priorizamos a MESMA fonte que o preview do editor usa (Roboto Bold via next/font),
// para que a posição/tamanho dos textos no render fique idêntica ao canvas.
function getDefaultFont() {
  const cwd = process.cwd()
  const candidates = [
    // Roboto Bold embarcado na app — deve casar com `bold ... Roboto` do EditorCanvas
    `${cwd}/public/fonts/Roboto-Bold.ttf`,
    `${cwd}/apps/dashboard/public/fonts/Roboto-Bold.ttf`,
    `/usr/share/fonts/truetype/noto/NotoSans-Bold.ttf`,
    `/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf`,
    `/usr/share/fonts/truetype/noto/NotoSans-Regular.ttf`,
    `/usr/share/fonts/opentype/noto/NotoSans-Regular.ttf`,
    `/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf`,
    `/usr/share/fonts/truetype/noto/NotoSansMono-Regular.ttf`,
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

// drawtext no Windows: o ':' do drive (C:) e as barras invertidas precisam
// de escape no filter_complex, senão o ffmpeg interpreta como separador de opção.
// Testado: somente `C\\:/path` (barra dupla) é aceito pelo parser do filtergraph.
const FONT_PATH_ESCAPED = FONT_PATH.replace(/\\/g, '/').replace(/:/g, '\\\\:')

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

export async function getVideoDurationSeconds(filePath: string) {
  try {
    const info = await getVideoInfo(filePath)
    const d = parseFloat(info?.format?.duration || '0')
    return Number.isFinite(d) ? d : 0
  } catch {
    return 0
  }
}

export async function getVideoFps(filePath: string) {
  try {
    const info = await getVideoInfo(filePath)
    const stream = info?.streams?.find((s: any) => s.codec_type === 'video')
    if (!stream?.avg_frame_rate) return 0
    const [num, den] = String(stream.avg_frame_rate).split('/').map(Number)
    const fps = den ? num / den : num
    return Number.isFinite(fps) && fps > 0 ? fps : 0
  } catch {
    return 0
  }
}

export async function buildOverlayFilter(params: {
  inputVideo: string
  inputOverlay: string
  outputPath: string
  video: { posX: number; posY: number; scale: number; zoom: number; rotation?: number }
  overlay: { posX: number; posY: number; cropTop: number; cropBottom: number; opacity: number }
  overlayBehind?: boolean
  videoDurationMs?: number | null
  volume: number
  speed?: number
  mirror?: boolean
  cropTop?: number
  cropBottom?: number
  bgColor?: string
  cropColor?: string
  cropOpacity?: number
  eq?: { brightness?: number; contrast?: number; saturation?: number }
  grain?: { amount?: number }
  frameDrop?: { frames?: number }
  zoomBreathing?: { amount?: number }
  inputFps?: number
  texts?: Array<{ content: string; x: number; y: number; fontSize: number; color: string }>
}) {
  const { video, overlay, overlayBehind, videoDurationMs, volume, speed, mirror, cropTop, cropBottom, bgColor, cropColor, cropOpacity, eq, grain, frameDrop, zoomBreathing, inputFps, texts } = params

  // Escala = produto `zoom * scale`, IGUAL ao preview do editor (EditorCanvas usa
  // `config.scale * config.zoom` sem clamp). Removemos os clamps 0.5..3 para que o
  // render respeite exatamente o valor mostrado no canvas (ex.: scale 0.45 × zoom
  // 0.65 = 0.29 NÃO deve ser elevado a 0.5).
  const scale = (video.zoom || 1) * (video.scale || 1)
  const speedVal = Math.max(0.5, Math.min(2, speed ?? 1))
  const overlayX = Math.round(overlay.posX || 0)
  const overlayY = Math.round(overlay.posY || 0)
  const posX = Math.round(video.posX || 0)
  const posY = Math.round(video.posY || 0)

  const filters: string[] = []

  // VIDEO CHAIN
  // 1. Espelha (se necessário)
  // 2. Scale: mantém aspect ratio, limita ao máximo
  // 3. Crop bars: barras coloridas top/bottom sobre o vídeo (nunca tocam a overlay)
  // 4. Ajusta velocidade (se necessário)
  // 5. Quando overlay ficar ATRÁS: o vídeo mantém suas dimensões (sem pad opaco),
  //    e é posicionado via overlay filter. Caso contrário: pad centraliza em 1080x1920.
  let videoChain = '[0:v]'

  if (mirror) {
    videoChain += 'hflip,'
  }

  // Scale real: multiplica ambos os eixos pelo mesmo fator (igual ao preview do
  // editor). O `pad`/`overlay` abaixo corta o excesso além de 1080x1920,
  // reproduzindo o zoom-in/crop que o preview mostra.
  videoChain += `scale=w=trunc(iw*${scale}/2)*2:h=trunc(ih*${scale}/2)*2`

  // Ajuste de cor sutil (eq): quebra o fingerprint de cor sem mudar o visual
  if (eq) {
    const parts: string[] = []
    if (Math.abs((eq.brightness ?? 1) - 1) > 0.001) parts.push(`brightness=${eq.brightness}`)
    if (Math.abs((eq.contrast ?? 1) - 1) > 0.001) parts.push(`contrast=${eq.contrast}`)
    if (Math.abs((eq.saturation ?? 1) - 1) > 0.001) parts.push(`saturation=${eq.saturation}`)
    if (parts.length) videoChain += `,eq=${parts.join(':')}`
  }

  // Rotação sutil + recorte automático das bordas (remove triângulos pretos)
  const rotDeg = Math.max(-6, Math.min(6, params.video.rotation || 0))
  if (Math.abs(rotDeg) > 0.001) {
    const rotRad = (rotDeg * Math.PI) / 180
    videoChain += `,rotate=${rotRad.toFixed(6)}:fillcolor=black:c=black`
    videoChain += `,crop=w=trunc(iw*cos(${rotRad.toFixed(6)})-ih*sin(${rotRad.toFixed(6)})):h=trunc(ih*cos(${rotRad.toFixed(6)})-iw*sin(${rotRad.toFixed(6)}))`
  }

  // Crop bars: drawbox no topo e/ou base do vídeo escalado
  const cropT = Math.round((cropTop || 0) * scale)
  const cropB = Math.round((cropBottom || 0) * scale)
  if (cropT > 0) {
    videoChain += `,drawbox=x=0:y=0:w=iw:h=${cropT}:color=${cropColor || '#000000'}@${cropOpacity ?? 1}:t=fill`
  }
  if (cropB > 0) {
    videoChain += `,drawbox=x=0:y=ih-${cropB}:w=iw:h=${cropB}:color=${cropColor || '#000000'}@${cropOpacity ?? 1}:t=fill`
  }

  // Micro-corte de frames: descarta N frames no início e reajusta o PTS
  const dropFrames = Math.max(0, Math.floor(frameDrop?.frames || 0))
  if (dropFrames > 0) {
    videoChain += `,trim=start_frame=${dropFrames},setpts=PTS-STARTPTS`
  }

  if (Math.abs(speedVal - 1) > 0.001) {
    videoChain += `,setpts=PTS/${speedVal}`
  }

  if (overlayBehind) {
    // Sem pad opaco: o vídeo mantém as dimensões escaladas; posicionamento via overlay.
    videoChain += '[v]'
  } else {
    const padX = posX >= 0 ? `(ow-iw)/2+${posX}` : `(ow-iw)/2${posX}`
    const padY = posY >= 0 ? `(oh-ih)/2+${posY}` : `(oh-ih)/2${posY}`
    videoChain += `,pad=w=1080:h=1920:x=${padX}:y=${padY}:color=${bgColor || 'black'}[v]`
  }
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
  // overlay por cima (padrão): [v][ov]overlay -> overlay sobre o vídeo
  // overlay atrás (vídeo por cima): base color + overlay, depois vídeo por cima
  // O corte (drawbox) é aplicado somente na cadeia do vídeo, então nunca corta a overlay.
  if (overlayBehind) {
    // Duração do canvas de fundo deve acompanhar o vídeo (considerando speed).
    let durSec = videoDurationMs ? videoDurationMs / 1000 / speedVal : 0
    if (durSec <= 0) {
      durSec = await getVideoDurationSeconds(params.inputVideo) / speedVal
    }
    filters.push(`color=c=${bgColor || 'black'}:s=1080x1920:d=${durSec.toFixed(3)}[base]`)
    filters.push(`[base][ov]overlay=x=${overlayX}+(W-w)/2:y=${overlayY}+(H-h)/2:format=auto[bg]`)
    filters.push(`[bg][v]overlay=x=(W-w)/2+${posX}:y=(H-h)/2+${posY}:format=auto[comp]`)
  } else {
    filters.push(`[v][ov]overlay=x=${overlayX}+(W-w)/2:y=${overlayY}+(H-h)/2:format=auto[comp]`)
  }

  // TEXT RENDERING via drawtext
  let currentLabel = 'comp'

  if (texts && texts.length > 0) {
    // drawtext não renderiza quebra de linha (\n) — o caracter U+000A vira um
    // glifo .notdef (a "caixa" com o caractere). Cada linha vira um drawtext
    // próprio com offset de y, igual ao preview do canvas (lineHeight = 1.3x).
    let textChain = `[${currentLabel}]`
    let drewAny = false
    for (const t of texts) {
      if (!t.content) continue

      const lineHeight = Math.round(t.fontSize * 1.3)
      const lines = t.content.split('\n')
      lines.forEach((line, li) => {
        const escaped = line
          .replace(/\\/g, '\\\\')
          .replace(/:/g, '\\:')
          .replace(/,/g, '\\,')
          .replace(/\[/g, '\\[')
          .replace(/\]/g, '\\]')
          .replace(/=/g, '\\=')
        textChain += `drawtext=text='${escaped}':x=${t.x}:y=${t.y + li * lineHeight}:fontsize=${t.fontSize}:fontcolor=${t.color}:fontfile=${FONT_PATH_ESCAPED},`
        drewAny = true
      })
    }
    if (drewAny) {
      textChain = textChain.slice(0, -1) + '[texted]'
      filters.push(textChain)
      currentLabel = 'texted'
    }
  }

  // OUTPUT CHAIN
  // 1. Zoom breathing (Ken Burns sutil) aplicado ao canvas final 1080x1920
  // 2. Grain/ruído leve sobre o frame composto
  // 3. Formata para yuv420p (compatível com h.264)
  const outParts: string[] = []

  const zoomAmount = zoomBreathing?.amount || 0
  if (zoomAmount > 0.001) {
    const fps = Math.max(1, Math.round(inputFps || 30))
    // zoom incremental até 1+amount ao longo do vídeo
    const zMax = (1 + Math.min(0.06, zoomAmount)).toFixed(4)
    const zInc = Math.max(0.00005, zoomAmount / Math.max(1, (videoDurationMs || 30000) / 1000 * fps)).toFixed(7)
    outParts.push(`zoompan=z='min(zoom+${zInc}\\,${zMax})':d=1:x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':s=1080x1920:fps=${fps}`)
  }

  const grainAmount = grain?.amount || 0
  if (grainAmount > 0.001) {
    const noise = Math.max(1, Math.round(Math.min(0.5, grainAmount) * 10))
    outParts.push(`noise=alls=${noise}`)
  }

  outParts.push('format=yuv420p')
  filters.push(`[${currentLabel}]${outParts.join(',')}[out]`)

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
    const { tmpdir } = await import('os')
    const { join } = await import('path')
    writeFileSync(join(tmpdir(), 'filter_complex_debug.txt'), fc, 'utf-8')
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
