const fs = require('fs')
const path = require('path')

const EXTENSION_DIR = path.join(__dirname, '..', 'chrome-extension')
const watchers = new Set()

function watch(dir) {
  fs.readdirSync(dir, { withFileTypes: true }).forEach(entry => {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory() && !entry.name.startsWith('.')) {
      watch(full)
    }
  })

  const watcher = fs.watch(dir, (event, filename) => {
    if (!filename) return
    const now = new Date().toLocaleTimeString('pt-BR')
    console.log(`[${now}] ${path.relative(EXTENSION_DIR, path.join(dir, filename))} (${event})`)
  })
  watchers.add(watcher)
}

watch(EXTENSION_DIR)

console.log('👀 Observando chrome-extension/ para mudancas...')
console.log('Va ate chrome://extensions/ e recarregue a extensao manualmente.')
console.log('Pressione Ctrl+C para parar.\n')

process.on('SIGINT', () => {
  watchers.forEach(w => w.close())
  process.exit(0)
})
