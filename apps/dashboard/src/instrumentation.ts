export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { startRenderWorker } = await import('./lib/render-worker')
    startRenderWorker()
    console.log('✅ Render worker iniciado')

    const { startPublicationScheduler } = await import('./lib/meta/publication-scheduler')
    startPublicationScheduler(60000)
    console.log('✅ Publication scheduler (API) iniciado')

    const { startFacebookScrapeWorker } = await import('./lib/facebook-publisher/worker')
    startFacebookScrapeWorker()
    console.log('✅ Facebook scrape publisher worker iniciado')

    const { startTikTokScrapeWorker } = await import('./lib/tiktok-publisher/worker')
    startTikTokScrapeWorker()
    console.log('✅ TikTok scrape publisher worker iniciado')

    const { startYouTubeScrapeWorker } = await import('./lib/youtube-publisher/worker')
    startYouTubeScrapeWorker()
    console.log('✅ YouTube scrape publisher worker iniciado')
  }
}
