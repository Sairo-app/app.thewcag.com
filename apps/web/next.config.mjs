import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Docker/Coolify: emit a minimal standalone server bundle. Trace from the
  // monorepo root so node_modules + packages land at the standalone root
  // (server ends up at standalone/apps/web/server.js — see Dockerfile).
  output: 'standalone',
  outputFileTracingRoot: path.join(__dirname, '../../'),
  reactStrictMode: true,
  poweredByHeader: false,
  async headers() {
    return [
      {
        // The desktop updater must always see the freshest manifest.
        source: '/downloads/desktop/latest.json',
        headers: [{ key: 'Cache-Control', value: 'no-cache, no-store, must-revalidate' }],
      },
    ]
  },
}

export default nextConfig
