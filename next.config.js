const runtimeCaching = [
  {
    // Never cache non-GET mutations, regardless of endpoint.
    urlPattern: ({ request }) =>
      ['POST', 'PUT', 'PATCH', 'DELETE'].includes((request?.method ?? '').toUpperCase()),
    handler: 'NetworkOnly',
    options: {},
  },
  {
    // Sensitive auth/chat/push flows must always hit network.
    urlPattern: ({ url }) =>
      self.origin === url.origin &&
      (url.pathname.startsWith('/api/auth/') ||
        url.pathname.startsWith('/api/chat') ||
        url.pathname.startsWith('/api/notifications/') ||
        url.pathname.startsWith('/api/push/')),
    handler: 'NetworkOnly',
    method: 'GET',
    options: {},
  },
  {
    // Supabase auth endpoints should never be cached.
    urlPattern: /^https:\/\/[^/]+\.supabase\.co\/auth\/v1\/.*$/i,
    handler: 'NetworkOnly',
    method: 'GET',
    options: {},
  },
  {
    // Supabase functions may execute mutations; avoid caching.
    urlPattern: /^https:\/\/[^/]+\.supabase\.co\/functions\/v1\/.*$/i,
    handler: 'NetworkOnly',
    method: 'GET',
    options: {},
  },
  {
    // Keep app shell navigations resilient with quick network timeout + cache fallback.
    urlPattern: ({ request, url }) =>
      request.mode === 'navigate' && self.origin === url.origin && !url.pathname.startsWith('/api/'),
    handler: 'NetworkFirst',
    method: 'GET',
    options: {
      cacheName: 'pages-cache',
      networkTimeoutSeconds: 3,
      expiration: {
        maxEntries: 50,
        maxAgeSeconds: 7 * 24 * 60 * 60,
      },
    },
  },
  {
    // App GET APIs: online-first, short-lived cache for read endpoints.
    urlPattern: ({ url }) => self.origin === url.origin && url.pathname.startsWith('/api/'),
    handler: 'NetworkFirst',
    method: 'GET',
    options: {
      cacheName: 'api-cache',
      networkTimeoutSeconds: 5,
      expiration: {
        maxEntries: 50,
        maxAgeSeconds: 30 * 60,
      },
    },
  },
  {
    // Supabase REST reads: online-first with brief offline resilience.
    urlPattern: /^https:\/\/[^/]+\.supabase\.co\/rest\/v1\/.*$/i,
    handler: 'NetworkFirst',
    method: 'GET',
    options: {
      cacheName: 'supabase-rest',
      networkTimeoutSeconds: 5,
      expiration: {
        maxEntries: 100,
        maxAgeSeconds: 60 * 60,
      },
    },
  },
  {
    urlPattern: ({ url }) => self.origin === url.origin && url.pathname.startsWith('/_next/static/'),
    handler: 'StaleWhileRevalidate',
    method: 'GET',
    options: {
      cacheName: 'next-static',
      expiration: {
        maxEntries: 200,
        maxAgeSeconds: 30 * 24 * 60 * 60,
      },
    },
  },
  {
    urlPattern: /\.css$/i,
    handler: 'StaleWhileRevalidate',
    method: 'GET',
    options: {
      cacheName: 'styles',
      expiration: {
        maxEntries: 120,
        maxAgeSeconds: 30 * 24 * 60 * 60,
      },
    },
  },
  {
    urlPattern: /\/_next\/image\?url=.+$/i,
    handler: 'StaleWhileRevalidate',
    method: 'GET',
    options: {
      cacheName: 'next-image',
      expiration: {
        maxEntries: 100,
        maxAgeSeconds: 30 * 24 * 60 * 60,
      },
    },
  },
  {
    // Public images and remote image URLs (including Supabase Storage signed/public assets).
    urlPattern: /\.(?:png|jpg|jpeg|gif|webp|svg|ico)(\?.*)?$/i,
    handler: 'StaleWhileRevalidate',
    method: 'GET',
    options: {
      cacheName: 'images',
      expiration: {
        maxEntries: 100,
        maxAgeSeconds: 30 * 24 * 60 * 60,
      },
    },
  },
  {
    urlPattern: /\.(?:woff2?|ttf|eot)$/i,
    handler: 'CacheFirst',
    method: 'GET',
    options: {
      cacheName: 'fonts',
      expiration: {
        maxEntries: 30,
        maxAgeSeconds: 365 * 24 * 60 * 60,
      },
    },
  },
]

// eslint-disable-next-line @typescript-eslint/no-require-imports
const withBundleAnalyzer = require('@next/bundle-analyzer')({
  enabled: process.env.ANALYZE === 'true',
})
// eslint-disable-next-line @typescript-eslint/no-require-imports
const withPWA = require('next-pwa')({
  dest: 'public',
  register: true,
  // Keep updates non-disruptive: user decides when to activate waiting SW.
  skipWaiting: false,
  clientsClaim: false,
  inlineWorkboxRuntime: true,
  disable: process.env.NODE_ENV === 'development',
  cacheStartUrl: false,
  dynamicStartUrl: false,
  fallbacks: {
    document: '/offline',
  },
  runtimeCaching,
  buildExcludes: [
    /chunks\/images\/.*$/i,
    /_next\/static\/chunks\/.*$/i,
    /_next\/static\/css\/.*$/i,
    ({ asset }) => {
      const name = asset?.name ?? ''
      return (
        name.endsWith('.map') ||
        name.startsWith('server/') ||
        name === 'build-manifest.json' ||
        name === 'react-loadable-manifest.json' ||
        name === 'middleware-build-manifest.js' ||
        name === 'middleware-react-loadable-manifest.js' ||
        name === 'next-font-manifest.js' ||
        name === 'next-font-manifest.json'
      )
    },
  ],
  publicExcludes: [
    '**/*',
    '!icons/icon.svg',
    '!icon-192.png',
    '!icon-512.png',
    '!apple-icon.png',
  ],
  additionalManifestEntries: [
    { url: '/offline', revision: null },
    { url: '/icons/icon.svg', revision: null },
    { url: '/apple-icon.png', revision: null },
    { url: '/icon-192.png', revision: null },
    { url: '/icon-512.png', revision: null },
    { url: '/manifest.webmanifest', revision: null },
  ],
  manifestTransforms: [
    async (entries) => {
      const allowedNonStatic = new Set([
        '/offline',
        '/icons/icon.svg',
        '/icon-192.png',
        '/icon-512.png',
        '/apple-icon.png',
        '/manifest.webmanifest',
      ])

      // Keep the install-time precache intentionally tiny so the worker can
      // activate quickly on mobile. Runtime caching still covers Next static
      // assets after activation.
      const manifest = entries.filter((entry) => allowedNonStatic.has(entry.url))

      return { manifest, warnings: [] }
    },
  ],
})
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { buildBaseSecurityHeaders } = require('./src/lib/security/http-headers')

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  turbopack: {},
  images: {
    qualities: [75, 80],
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'ilybohhdeplwcrbpblqw.supabase.co',
        pathname: '/**',
      },
    ],
  },
  async headers() {
    const isDevelopment = process.env.NODE_ENV === 'development'

    return [
      {
        source: '/(.*)',
        headers: buildBaseSecurityHeaders({ isDevelopment }),
      },
      {
        source: '/sw.js',
        headers: [
          {
            key: 'Content-Type',
            value: 'application/javascript; charset=utf-8',
          },
          {
            key: 'Cache-Control',
            value: 'no-cache, no-store, must-revalidate',
          },
        ],
      },
      {
        source: '/manifest.webmanifest',
        headers: [
          {
            key: 'Content-Type',
            value: 'application/manifest+json; charset=utf-8',
          },
          {
            key: 'Cache-Control',
            value: 'no-cache, no-store, must-revalidate',
          },
        ],
      },
    ]
  },
}

module.exports = withBundleAnalyzer(withPWA(nextConfig))
