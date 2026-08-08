import { defineConfig } from 'wxt'

export default defineConfig({
  browser: 'chrome',
  manifestVersion: 3,
  modules: ['@wxt-dev/module-react'],
  dev: {
    server: {
      port: 3001,
    },
  },
  manifest: {
    name: 'PostReels Downloader',
    version: '0.1.0',
    description: 'Baixe todos os Reels de um perfil do Instagram',
    permissions: [
      'storage',
      'downloads',
      'scripting',
      'tabs',
    ],
    host_permissions: [
      'https://www.instagram.com/*',
      'https://*.cdninstagram.com/*',
      'https://www.facebook.com/*',
      'https://*.facebook.com/*',
      'https://www.youtube.com/*',
      'http://localhost/*',
    ],
    action: {
      default_title: 'PostReels',
    },
    content_security_policy: {
      extension_pages: "script-src 'self' 'wasm-unsafe-eval' http://localhost:*; object-src 'self'",
    },
  },
})
