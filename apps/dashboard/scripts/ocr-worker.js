const { createWorker } = require('tesseract.js')

process.on('message', async (msg) => {
  if (msg.type === 'ocr') {
    try {
      const worker = await createWorker('por')
      const { data } = await worker.recognize(msg.imagePath)
      await worker.terminate()
      process.send({ type: 'result', text: data.text.trim() })
    } catch (err) {
      process.send({ type: 'error', message: err.message })
    }
  }
})
