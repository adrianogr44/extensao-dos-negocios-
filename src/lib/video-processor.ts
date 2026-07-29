import ffmpeg from 'fluent-ffmpeg'
import path from 'path'
import fs from 'fs/promises'

const VIDEOS_DIR = path.join(process.cwd(), 'videos')

export async function getVideoDuration(filepath: string): Promise<number> {
  return new Promise<number>((resolve, reject) => {
    ffmpeg.ffprobe(filepath, (err, metadata) => {
      if (err) reject(err)
      else resolve(metadata.format.duration || 0)
    })
  })
}

export async function addOverlayToVideo(
  inputPath: string,
  outputPath: string,
  overlayText: string,
  position: 'top' | 'bottom' | 'center' = 'bottom'
): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    const y = position === 'top' ? '10' : position === 'bottom' ? 'main_h-th-10' : '(main_h-th)/2'

    ffmpeg(inputPath)
      .videoFilter([
        {
          filter: 'drawtext',
          options: {
            text: overlayText,
            fontfile: 'C:\\Windows\\Fonts\\arial.ttf',
            fontsize: 24,
            fontcolor: 'white',
            box: 1,
            boxcolor: 'black@0.5',
            boxborderw: 5,
            x: '(w-text_w)/2',
            y,
          },
        },
      ])
      .output(outputPath)
      .on('end', () => resolve())
      .on('error', reject)
      .run()
  })
}

export async function ensureVideosDir() {
  try {
    await fs.mkdir(VIDEOS_DIR, { recursive: true })
  } catch { }
}

export { VIDEOS_DIR }
