import type { Metadata } from 'next'

import { AssociationMarketplace } from '@/components/landing/association-marketplace'
import { DemoCta } from '@/components/landing/demo-cta'
import { Faq } from '@/components/landing/faq'
import { FarmTypes } from '@/components/landing/farm-types'
import { Hero } from '@/components/landing/hero'
import { HowItWorks } from '@/components/landing/how-it-works'
import { LandingFooter } from '@/components/landing/landing-footer'
import { LandingHeader } from '@/components/landing/landing-header'
import { Problems } from '@/components/landing/problems'
import { PwaInstall } from '@/components/landing/pwa-install'
import { Solution } from '@/components/landing/solution'
import { Story } from '@/components/landing/story'
import { Testimonials } from '@/components/landing/testimonials'
import { ValueProps } from '@/components/landing/value-props'

export const metadata: Metadata = {
  metadataBase: new URL('https://www.zmeurel.ro'),
  title: 'Zmeurel OS — Aplicație gratuită pentru fermieri | Evidență parcele, recolte, vânzări',
  description:
    'Zmeurel OS te ajută să ții evidența fermei direct de pe telefon. Notezi recoltele, lucrările, vânzările și cheltuielile în 30 de secunde. Gratuit în beta. Făcut de un fermier din Suceava.',
  keywords:
    'aplicație fermieri, evidență fermă, gestiune agricolă, recoltare, vânzări fermă, cheltuieli fermă, aplicație agricolă România, software agricol, magazin asociație producători',
  openGraph: {
    title: 'Zmeurel OS — Nu mai pierde bani din fermă',
    description:
      'Vezi cât produci, cât vinzi și cât câștigi real — direct de pe telefon. Aplicație gratuită pentru fermieri.',
    url: 'https://www.zmeurel.ro',
    siteName: 'Zmeurel OS',
    locale: 'ro_RO',
    type: 'website',
    images: [
      {
        url: '/og-image.jpg',
        width: 1200,
        height: 630,
        alt: 'Zmeurel OS — aplicație pentru fermieri',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Zmeurel OS — Nu mai pierde bani din fermă',
    description: 'Evidență fermă simplă, direct de pe telefon. Gratuit în beta.',
    images: ['/og-image.jpg'],
  },
  alternates: {
    canonical: 'https://www.zmeurel.ro',
  },
  robots: {
    index: true,
    follow: true,
  },
  other: {
    'theme-color': '#2D6A4F',
  },
}

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-[#FAFAF6] text-slate-800">
      <a
        href="#main-content"
        className="sr-only fixed left-4 top-4 z-[60] rounded-xl bg-white px-4 py-3 text-sm font-semibold text-slate-900 shadow-lg focus:not-sr-only focus:outline-none focus:ring-2 focus:ring-[#2D6A4F] focus:ring-offset-2"
      >
        Sari la conținut
      </a>
      <LandingHeader />
      <main id="main-content">
        <Hero />
        <ValueProps />
        <Problems />
        <Solution />
        <HowItWorks />
        <Testimonials />
        <AssociationMarketplace />
        <Story />
        <FarmTypes />
        <PwaInstall />
        <Faq />
        <DemoCta />
      </main>
      <LandingFooter />
    </div>
  )
}
