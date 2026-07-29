/** @type {import('next').NextConfig} */
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
}

export default nextConfig
