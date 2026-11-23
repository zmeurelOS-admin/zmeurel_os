import type { Metadata } from 'next'

import { kitFocus, kitText } from '@/components/kit'
import { Beta } from '@/components/landing/beta'
import { Capturi } from '@/components/landing/capturi'
import { CeTii } from '@/components/landing/ce-tii'
import { Contact } from '@/components/landing/contact'
import { Faq } from '@/components/landing/faq'
import { Hero } from '@/components/landing/hero'
import { LandingFooter } from '@/components/landing/landing-footer'
import { LandingHeader } from '@/components/landing/landing-header'
import { Story } from '@/components/landing/story'
import { APP_NAME } from '@/lib/brand'
import { cn } from '@/lib/utils'

const TITLU = 'Ferma ta, pe telefon. Fără hârtii.'
const DESCRIERE =
  'Notezi recoltele, comenzile, livrările și tratamentele în câteva secunde. Vezi cât produci, cât vinzi și cât câștigi. Gratuit cât e în beta.'

export const metadata: Metadata = {
  metadataBase: new URL('https://www.zmeurel.ro'),
  title: `${APP_NAME} — ${TITLU}`,
  description: DESCRIERE,
  keywords:
    'aplicație fermieri, evidență fermă, recoltări, comenzi, livrări, tratamente, stoc, aplicație agricolă România',
  openGraph: {
    title: `${APP_NAME} — ${TITLU}`,
    description: DESCRIERE,
    url: 'https://www.zmeurel.ro',
    siteName: APP_NAME,
    locale: 'ro_RO',
    type: 'website',
    images: [{ url: '/og-image.jpg', width: 1200, height: 630, alt: `${APP_NAME} — aplicație pentru fermieri` }],
  },
  twitter: {
    card: 'summary_large_image',
    title: `${APP_NAME} — ${TITLU}`,
    description: DESCRIERE,
    images: ['/og-image.jpg'],
  },
  alternates: { canonical: 'https://www.zmeurel.ro' },
  robots: { index: true, follow: true },
}

/**
 * Prima pagină (promptul 31): titlul cu „Încearcă fără cont” / „Am deja cont”, capturi reale, ce ții în aplicație,
 * povestea, „Gratuit cât e în beta”, întrebări, contact. Fără testimoniale și fără „locuri limitate”.
 */
export default function LandingPage() {
  return (
    <div className="min-h-screen bg-page text-fg">
      <a
        href="#continut"
        className={cn(kitText.secondary, 'sr-only rounded-box bg-surface px-4 py-3 font-bold text-fg focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-toast', kitFocus)}
      >
        Sari la conținut
      </a>
      <LandingHeader />
      <main id="continut">
        <Hero />
        <Capturi />
        <CeTii />
        <Story />
        <Beta />
        <Faq />
        <Contact />
      </main>
      <LandingFooter />
    </div>
  )
}
