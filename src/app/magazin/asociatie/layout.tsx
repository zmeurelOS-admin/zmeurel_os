import type { Metadata, Viewport } from 'next'
import { Baloo_2, Inter } from 'next/font/google'

import { AssociationMagazinRoot } from '@/components/shop/association/AssociationMagazinRoot'
import { CookieConsentBanner } from '@/components/shop/association/legal/CookieConsentBanner'
import { loadAssociationSettingsCached } from '@/lib/association/public-settings'
import { loadAssociationCatalogCached } from '@/lib/shop/load-association-catalog'

import '@/styles/association-shop.css'
import '@/styles/gusta-brand.css'

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://zmeurel.app'

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: { default: 'Gustă din Bucovina', template: '%s · Gustă din Bucovina' },
  description:
    'Magazin online al Asociației Gustă din Bucovina — produse locale din Suceava. Comandă prin platforma Zmeurel OS, fără cont obligatoriu.',
  openGraph: {
    siteName: 'Gustă din Bucovina',
    locale: 'ro_RO',
    type: 'website',
    description:
      'Magazin online al Asociației Gustă din Bucovina — produse locale din Suceava.',
    images: [{ url: '/images/gusta-logo.png', alt: 'Gustă din Bucovina' }],
  },
}

export const viewport: Viewport = {
  viewportFit: 'cover',
}

const baloo = Baloo_2({
  subsets: ['latin', 'latin-ext'],
  weight: ['400', '500', '600', '700', '800'],
  variable: '--font-assoc-display',
  display: 'swap',
})

const inter = Inter({
  subsets: ['latin', 'latin-ext'],
  variable: '--font-assoc-sans',
  display: 'swap',
})

export default async function AsociatieMagazinLayout({ children }: { children: React.ReactNode }) {
  const products = await loadAssociationCatalogCached()
  const publicSettings = await loadAssociationSettingsCached()
  return (
    <div
      className={`${baloo.className} ${baloo.variable} ${inter.variable} assoc-root assoc-body light`}
      data-theme="light"
    >
      <AssociationMagazinRoot products={products} publicSettings={publicSettings}>
        {children}
      </AssociationMagazinRoot>
      <CookieConsentBanner />
    </div>
  )
}
