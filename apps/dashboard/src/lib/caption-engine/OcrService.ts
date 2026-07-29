import { fork } from 'node:child_process'
import { join } from 'node:path'

export function extractTextFromImage(imagePath: string): Promise<string> {
  return new Promise((resolve) => {
    const scriptPath = join(process.cwd(), 'scripts', 'ocr-worker.js')
    const child = fork(scriptPath, [], { stdio: 'pipe' })

    child.on('message', (msg: { type: string; text?: string; message?: string }) => {
      if (msg.type === 'result') {
        resolve(msg.text || '')
      } else if (msg.type === 'error') {
        console.error('[OcrService] Worker error:', msg.message)
        resolve('')
      }
      child.kill()
    })

    child.on('error', (err) => {
      console.error('[OcrService] Fork error:', err)
      resolve('')
    })

    child.on('exit', () => {
      resolve('')
    })

    child.send({ type: 'ocr', imagePath })
  })
}
