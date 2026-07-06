/** @type {import('next').NextConfig} */
const nextConfig = {
  // Docker/Coolify: emit a minimal standalone server bundle.
  output: 'standalone',
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
