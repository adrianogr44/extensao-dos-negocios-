import { execa } from 'execa'

function rgbToHsv(r: number, g: number, b: number): [number, number, number] {
  const mr = r / 255, mg = g / 255, mb = b / 255
  const max = Math.max(mr, mg, mb), min = Math.min(mr, mg, mb)
  const d = max - min
  let h = 0
  if (d !== 0) {
    if (max === mr) h = ((mg - mb) / d + (mg < mb ? 6 : 0)) * 60
    else if (max === mg) h = ((mb - mr) / d + 2) * 60
    else h = ((mr - mg) / d + 4) * 60
  }
  const s = max === 0 ? 0 : d / max
  const v = max
  return [h, s, v]
}

function isWhitePixel(r: number, g: number, b: number): boolean {
  const [, s, v] = rgbToHsv(r, g, b)
  return s < 0.15 && v > 0.78
}

export async function detectOverlayHeight(videoPath: string): Promise<number> {
  const { stdout: info } = await execa('ffprobe', [
    '-v', 'error',
    '-select_streams', 'v:0',
    '-show_entries', 'stream=width,height',
    '-of', 'csv=p=0',
    videoPath,
  ])
  const [width, height] = info.trim().split(',').map(Number)
  if (!width || !height) return 0

  const { stdout: buf } = await execa('ffmpeg', [
    '-ss', '0',
    '-i', videoPath,
    '-vframes', '1',
    '-f', 'rawvideo',
    '-pix_fmt', 'rgb24',
    '-',
  ], { encoding: 'buffer' })
  const rowBytes = width * 3
  const maxScan = Math.min(height, Math.floor(height * 0.45))

  const ROW_WHITE_RATIO = 0.65
  const SAMPLE_STEP = Math.max(1, Math.floor(width / 150))

  for (let y = 0; y < maxScan; y++) {
    const rowStart = y * rowBytes
    let whitePixels = 0
    let sampled = 0

    for (let x = 0; x < width; x += SAMPLE_STEP) {
      const idx = rowStart + x * 3
      if (isWhitePixel(buf[idx], buf[idx + 1], buf[idx + 2])) whitePixels++
      sampled++
    }

    if (whitePixels / sampled < ROW_WHITE_RATIO) {
      if (y < 10) return 0
      return y
    }
  }

  return 0
}
