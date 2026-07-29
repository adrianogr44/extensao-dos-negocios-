export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { startRenderWorker } = await import('./lib/render-worker')
    startRenderWorker()
    console.log('✅ Render worker iniciado')

    const { startPublicationScheduler } = await import('./lib/meta/publication-scheduler')
    startPublicationScheduler(60000) // Executar a cada 60 segundos
    console.log('✅ Publication scheduler iniciado')
  }
}
