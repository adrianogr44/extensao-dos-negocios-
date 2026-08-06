/** @type {import('next').NextConfig} */
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const nextConfig = {
  reactStrictMode: true,
  experimental: {
    instrumentationHook: true,
    serverExternalPackages: ['tesseract.js'],
  },
  images: {
    remotePatterns: [
      { protocol: 'http', hostname: 'localhost', port: '9000' },
    ],
  },
  webpack: (config, { isServer }) => {
    if (isServer) {
      const generatedClientAbs = path.resolve(__dirname, 'prisma/generated')

      // O cliente customizado (apps/dashboard/prisma/generated) contém a engine
      // nativa e o schema atual (FacebookSession). Deixamos de fora do bundle
      // para que o Next a carregue do disco em runtime, evitando
      // "Prisma Client could not locate the Query Engine".
      config.externals = config.externals || []
      config.externals.push((ctx, callback) => {
        const request = ctx?.request
        if (typeof request !== 'string') return callback()
        const resourcePath = path.resolve(ctx.context || '', request)
        if (
          resourcePath === generatedClientAbs ||
          resourcePath.startsWith(generatedClientAbs + path.sep)
        ) {
          return callback(null, `commonjs ${generatedClientAbs}`)
        }
        return callback()
      })
    }
    return config
  },
}

export default nextConfig