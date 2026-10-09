import { withPayload } from '@payloadcms/next/withPayload'
import type { NextConfig } from 'next'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(__filename)

// CONTRACT.md §5.1: host pages on other sites load the loader and the bundle.
const EMBED = [
  { key: 'Access-Control-Allow-Origin', value: '*' },
  { key: 'Cross-Origin-Resource-Policy', value: 'cross-origin' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Content-Type', value: 'text/javascript; charset=utf-8' },
]

const nextConfig: NextConfig = {
  // The Playwright tests run their own `next dev` with `.next-e2e`, so a running
  // development server in `.next` does not block them.
  distDir: process.env.NEXT_DIST_DIR || '.next',
  // Story container IRIs end in a slash. Keep the slash; do not redirect.
  skipTrailingSlashRedirect: true,
  async headers() {
    return [
      {
        source: '/embed/v1.js',
        headers: [
          ...EMBED,
          { key: 'Cache-Control', value: 'public, max-age=300, stale-while-revalidate=3600' },
        ],
      },
      {
        // Only the hashed bundle folders. `/embed/v1/themes/…` is a route with its own headers.
        source: '/embed/v1/:hash([0-9a-f]{12})/:file',
        headers: [...EMBED, { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' }],
      },
    ]
  },
  webpack: (webpackConfig) => {
    webpackConfig.resolve.extensionAlias = {
      '.cjs': ['.cts', '.cjs'],
      '.js': ['.ts', '.tsx', '.js', '.jsx'],
      '.mjs': ['.mts', '.mjs'],
    }

    return webpackConfig
  },
  turbopack: {
    root: path.resolve(dirname),
  },
}

const withPayloadConfig = withPayload(nextConfig, { devBundleServerPackages: false })

export default {
  ...withPayloadConfig,
  // Payload adds `Accept-CH`, `Critical-CH` and `Vary: Sec-CH-Prefers-Color-Scheme` to every
  // path. Only the admin reads that hint (its colour theme). On the public routes the extra
  // `Vary` value splits shared cache keys, so keep the rule on the admin paths only.
  async headers() {
    const rules = (await withPayloadConfig.headers?.()) ?? []
    return rules.map((rule) =>
      rule.source === '/:path*' && rule.headers.some((header) => header.key === 'Critical-CH')
        ? { ...rule, source: '/admin/:path*' }
        : rule,
    )
  },
} satisfies NextConfig
