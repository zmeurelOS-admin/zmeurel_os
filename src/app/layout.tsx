import type { Metadata, Viewport } from 'next'
import { Inter } from 'next/font/google'
import { Analytics } from '@vercel/analytics/next'
import { SpeedInsights } from '@vercel/speed-insights/next'

import { HighVisibilityInit } from '@/components/app/HighVisibilityInit'
import { ServiceWorkerRegister } from '@/components/app/ServiceWorkerRegister'
import { ThemeProvider } from '@/components/app/ThemeProvider'
import { Toaster } from '@/components/Toaster'
import { APP_NAME, APP_SHORT_NAME, APP_TAGLINE, APP_URL } from '@/lib/brand'
import './globals.css'

const inter = Inter({
  subsets: ['latin', 'latin-ext'],
  display: 'swap',
  variable: '--font-inter',
})

export const metadata: Metadata = {
  metadataBase: new URL(APP_URL),
  title: APP_NAME,
  description: APP_TAGLINE,
  manifest: '/manifest.webmanifest',
  applicationName: APP_NAME,
  formatDetection: {
    telephone: false,
  },
  // Magazinul (`/comanda`) își pune iconițele lui în layout-ul lui: `icons` și `appleWebApp` de aici se înlocuiesc acolo.
  icons: {
    icon: [
      { url: '/favicon.ico', sizes: '48x48' },
      { url: '/icons/icon.svg', type: 'image/svg+xml' },
      { url: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: [{ url: '/icons/apple-touch-icon-180.png', sizes: '180x180', type: 'image/png' }],
  },
  appleWebApp: {
    capable: true,
    title: APP_SHORT_NAME,
    statusBarStyle: 'default',
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#3d7a5f',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ro" data-scroll-behavior="smooth" suppressHydrationWarning>
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
      </head>
      <body className={inter.variable}>
        <ThemeProvider>
          <HighVisibilityInit />
          <ServiceWorkerRegister />
          {children}
          <Toaster />
        </ThemeProvider>
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  )
}
