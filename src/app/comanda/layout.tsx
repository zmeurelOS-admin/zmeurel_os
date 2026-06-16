import type { Metadata, Viewport } from 'next'
import { Fraunces, Hanken_Grotesk } from 'next/font/google'
import { headers } from 'next/headers'

import { PWAInstallPromptMount } from '@/components/pwa/PWAInstallPromptMount'
import styles from './comanda.module.css'

const fraunces = Fraunces({
  subsets: ['latin', 'latin-ext'],
  weight: ['500', '600', '700'],
  variable: '--font-comanda-display',
  display: 'swap',
})

const hanken = Hanken_Grotesk({
  subsets: ['latin', 'latin-ext'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-comanda-body',
  display: 'swap',
})

export const metadata: Metadata = {
  metadataBase: new URL('https://comanda.zmeurel.ro'),
  title: 'Zmeurel — Zmeură proaspătă | Văratec, Suceava',
  description:
    'Zmeură proaspătă din Văratec, culeasă în ziua livrării. Livrare locală în Suceava și împrejurimi.',
  manifest: '/comanda/manifest.webmanifest',
  icons: {
    icon: [
      { url: '/shop-icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/shop-icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: [{ url: '/shop-icon-192.png', sizes: '192x192', type: 'image/png' }],
  },
  openGraph: {
    title: 'Zmeurel — Zmeură Proaspătă 2026',
    description:
      'Comandă zmeură proaspătă din Văratec, Suceava. Livrări active din recolta 2026.',
    url: 'https://comanda.zmeurel.ro',
    siteName: 'Zmeurel',
    locale: 'ro_RO',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Zmeurel — Zmeură Proaspătă 2026',
    description: 'Comandă zmeură proaspătă din Văratec, Suceava.',
  },
  appleWebApp: {
    capable: true,
    title: 'Zmeurel',
    statusBarStyle: 'default',
  },
  robots: { index: true, follow: true },
}

export const viewport: Viewport = {
  themeColor: '#F16B6B',
}

const DEFAULT_SHOP_DOMAIN = 'comanda.zmeurel.ro'
const SHOP_DOMAIN = (process.env.SHOP_DOMAIN?.trim() || DEFAULT_SHOP_DOMAIN).toLowerCase()

function normalizeHost(host: string | null): string {
  return (host ?? '').split(':')[0]?.toLowerCase() ?? ''
}

export default async function ComandaLayout({ children }: { children: React.ReactNode }) {
  const isShopDomain = normalizeHost((await headers()).get('host')) === SHOP_DOMAIN

  return (
    <div
      className={`${fraunces.variable} ${hanken.variable} ${styles.root} ${styles.fontBody}`}
      style={{
        minHeight: '100vh',
        background: '#FFF6F3',
      }}
    >
      <div className="mx-auto w-full max-w-[540px] md:py-8 lg:max-w-[1240px]">
        <div
          className="w-full"
          style={{
            background: '#FFF6F3',
            boxShadow: '0 0 0 1px rgba(49,46,63,.06)',
          }}
        >
          {children}
        </div>
      </div>
      {isShopDomain ? (
        <PWAInstallPromptMount
          allowPublicPaths
          iconSrc="/shop-icon-192.png"
          title="Fructe proaspete la o atingere"
          subtitle="Salvează magazinul pe ecran pentru când ai poftă."
          iconAlt="Zmeurel"
        />
      ) : null}
    </div>
  )
}
