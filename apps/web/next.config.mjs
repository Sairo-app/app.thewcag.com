import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const standaloneOutput = process.platform !== 'win32'

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Docker/Coolify: emit a minimal standalone server bundle. Trace from the
  // monorepo root so node_modules + packages land at the standalone root
  // (server ends up at standalone/apps/web/server.js; see Dockerfile).
  // Next's standalone copier creates package symlinks. A normal Windows
  // account cannot create those unless Developer Mode or elevation happens to
  // be enabled, so keep local Windows verification on the regular build
  // output. Linux production and Docker builds still emit standalone/apps/web.
  output: standaloneOutput ? 'standalone' : undefined,
  outputFileTracingRoot: path.join(__dirname, '../../'),
  // migrate.mjs runs before the standalone server and is not part of Next's
  // route graph, so its database driver must be included explicitly.
  outputFileTracingIncludes: {
    '/*': ['node_modules/postgres/**/*'],
  },
  transpilePackages: ['@accessibility-build/audit-contracts'],
  reactStrictMode: true,
  poweredByHeader: false,
  // Never publish a bundle that failed TypeScript validation.
  typescript: { ignoreBuildErrors: false },
  async headers() {
    const contentSecurityPolicy = [
      "default-src 'self'",
      "base-uri 'self'",
      "frame-ancestors 'none'",
      "object-src 'none'",
      "form-action 'self'",
      "img-src 'self' data: blob: https:",
      "font-src 'self' data:",
      "style-src 'self' 'unsafe-inline'",
      "script-src 'self' 'unsafe-inline'",
      "connect-src 'self' https:",
      "frame-src 'none'",
      ...(process.env.NODE_ENV === 'production' ? ['upgrade-insecure-requests'] : []),
    ].join('; ')
    const securityHeaders = [
      { key: 'Content-Security-Policy', value: contentSecurityPolicy },
      { key: 'X-Frame-Options', value: 'DENY' },
      { key: 'X-Content-Type-Options', value: 'nosniff' },
      { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
      { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
      { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
      { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' },
    ]
    return [
      {
        source: '/(.*)',
        headers: securityHeaders,
      },
      {
        // The desktop updater must always see the freshest manifest.
        source: '/downloads/desktop/latest.json',
        headers: [{ key: 'Cache-Control', value: 'no-cache, no-store, must-revalidate' }],
      },
    ]
  },
}

export default nextConfig
