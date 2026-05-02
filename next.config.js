const runtimeCaching = [
  {
    urlPattern: ({ request, url }) =>
      request.mode === 'navigate' &&
      self.origin === url.origin &&
      [
        '/',
        '/login',
        '/register',
        '/termeni',
        '/confidentialitate',
        '/reset-password',
        '/reset-password-request',
        '/update-password',
      ].some((pathname) => url.pathname === pathname || url.pathname.startsWith(`${pathname}/`)),
    handler: 'NetworkFirst',
    method: 'GET',
    options: {
      cacheName: 'public-navigation-pages',
      networkTimeoutSeconds: 3,
      expiration: {
        maxEntries: 24,
        maxAgeSeconds: 24 * 60 * 60,
      },
    },
  },
  {
    urlPattern: ({ url }) => self.origin === url.origin && url.pathname.startsWith('/api/'),
    handler: 'NetworkOnly',
    method: 'GET',
  },
  {
    urlPattern: ({ request, url }) => request.mode === 'navigate' && self.origin === url.origin,
    handler: 'NetworkOnly',
    method: 'GET',
  },
  {
    urlPattern: ({ url }) => self.origin === url.origin && url.pathname.startsWith('/_next/static/'),
    handler: 'StaleWhileRevalidate',
    method: 'GET',
    options: {
      cacheName: 'next-static-assets',
      expiration: {
        maxEntries: 128,
        maxAgeSeconds: 24 * 60 * 60,
      },
    },
  },
  {
    urlPattern: /\/_next\/image\?url=.+$/i,
    handler: 'CacheFirst',
    method: 'GET',
    options: {
      cacheName: 'next-image-assets',
      expiration: {
        maxEntries: 128,
        maxAgeSeconds: 24 * 60 * 60,
      },
    },
  },
  {
    urlPattern: /\.(?:png|jpg|jpeg|gif|webp|svg|ico)$/i,
    handler: 'CacheFirst',
    method: 'GET',
    options: {
      cacheName: 'static-image-assets',
      expiration: {
        maxEntries: 128,
        maxAgeSeconds: 24 * 60 * 60,
      },
    },
  },
]

// eslint-disable-next-line @typescript-eslint/no-require-imports
const withPWA = require('next-pwa')({
  dest: 'public',
  register: true,
  skipWaiting: true,
  inlineWorkboxRuntime: true,
  disable: process.env.NODE_ENV === 'development',
  cacheStartUrl: false,
  dynamicStartUrl: false,
  runtimeCaching,
  buildExcludes: [
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
    '!**/*',
    'icons/**/*',
    'icon-*.png',
    'apple-icon.png',
  ],
  additionalManifestEntries: [
    { url: '/icon-192.png', revision: null },
    { url: '/icon-512.png', revision: null },
    { url: '/manifest.webmanifest', revision: null },
  ],
  manifestTransforms: [
    async (entries) => {
      const allowedNonStatic = new Set([
        '/icon-192.png',
        '/icon-512.png',
        '/manifest.webmanifest',
      ])

      const manifest = entries.filter((entry) => {
        return entry.url.startsWith('/_next/static/') || allowedNonStatic.has(entry.url)
      })

      return { manifest, warnings: [] }
    },
  ],
})
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { withSentryConfig } = require('@sentry/nextjs')
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

// Sentry: la build, `SENTRY_AUTH_TOKEN` (și org/proiect din env sau sentry.properties) permit upload source maps.
module.exports = withSentryConfig(withPWA(nextConfig), {
  silent: true,
  webpack: {
    reactComponentAnnotation: {
      enabled: true,
    },
  },
})
