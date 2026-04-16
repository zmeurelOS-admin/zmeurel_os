function uniq(items) {
  return [...new Set(items.filter(Boolean))]
}

function joinSources(sources) {
  return uniq(sources).join(' ')
}

function parseUrlOrigin(urlLike) {
  if (!urlLike || typeof urlLike !== 'string') return null
  try {
    return new URL(urlLike).origin
  } catch {
    return null
  }
}

function toWsOrigin(httpOrigin) {
  if (!httpOrigin) return null
  if (httpOrigin.startsWith('https://')) {
    return `wss://${httpOrigin.slice('https://'.length)}`
  }
  if (httpOrigin.startsWith('http://')) {
    return `ws://${httpOrigin.slice('http://'.length)}`
  }
  return null
}

function buildContentSecurityPolicy(options = {}) {
  const isDevelopment = options.isDevelopment === true
  const env = options.env ?? process.env

  const supabaseOrigin = parseUrlOrigin(env.NEXT_PUBLIC_SUPABASE_URL)
  const supabaseWsOrigin = toWsOrigin(supabaseOrigin)
  const sentryDsnOrigin = parseUrlOrigin(env.NEXT_PUBLIC_SENTRY_DSN)

  const scriptSrc = ["'self'", "'unsafe-inline'"]
  if (isDevelopment) {
    scriptSrc.push("'unsafe-eval'")
  }

  const connectSrc = [
    "'self'",
    'https://*.supabase.co',
    'wss://*.supabase.co',
    'https://*.ingest.sentry.io',
    'https://*.sentry.io',
    'https://vitals.vercel-insights.com',
    supabaseOrigin,
    supabaseWsOrigin,
    sentryDsnOrigin,
  ]

  if (isDevelopment) {
    connectSrc.push('http://localhost:*', 'ws://localhost:*', 'http://127.0.0.1:*', 'ws://127.0.0.1:*')
  }

  const directives = [
    `default-src ${joinSources(["'self'"])}`,
    `base-uri ${joinSources(["'self'"])}`,
    `frame-ancestors ${joinSources(["'self'"])}`,
    `object-src ${joinSources(["'none'"])}`,
    `form-action ${joinSources(["'self'"])}`,
    `script-src ${joinSources(scriptSrc)}`,
    `style-src ${joinSources(["'self'", "'unsafe-inline'"])}`,
    `img-src ${joinSources([
      "'self'",
      'data:',
      'blob:',
      'https://images.unsplash.com',
      'https://*.supabase.co',
    ])}`,
    `font-src ${joinSources(["'self'", 'data:'])}`,
    `connect-src ${joinSources(connectSrc)}`,
    `worker-src ${joinSources(["'self'", 'blob:'])}`,
    `manifest-src ${joinSources(["'self'"])}`,
    `media-src ${joinSources(["'self'", 'data:', 'blob:'])}`,
  ]

  if (!isDevelopment) {
    directives.push('upgrade-insecure-requests')
  }

  return directives.join('; ')
}

function buildBaseSecurityHeaders(options = {}) {
  const isDevelopment = options.isDevelopment === true
  const env = options.env ?? process.env

  const headers = [
    {
      key: 'Content-Security-Policy',
      value: buildContentSecurityPolicy({ isDevelopment, env }),
    },
    {
      key: 'X-Frame-Options',
      value: 'SAMEORIGIN',
    },
    {
      key: 'X-Content-Type-Options',
      value: 'nosniff',
    },
    {
      key: 'Referrer-Policy',
      value: 'strict-origin-when-cross-origin',
    },
    {
      key: 'Permissions-Policy',
      value: 'camera=(), microphone=(self), geolocation=()',
    },
    {
      key: 'X-DNS-Prefetch-Control',
      value: 'off',
    },
    {
      key: 'X-Permitted-Cross-Domain-Policies',
      value: 'none',
    },
  ]

  if (!isDevelopment) {
    headers.push({
      key: 'Strict-Transport-Security',
      value: 'max-age=63072000; includeSubDomains; preload',
    })
  }

  return headers
}

module.exports = {
  buildBaseSecurityHeaders,
  buildContentSecurityPolicy,
}
