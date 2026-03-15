import type { Metadata } from 'next'

import Beta from '@/components/landing/beta'
import Demo from '@/components/landing/demo'
import FarmTypes from '@/components/landing/farm-types'
import Faq from '@/components/landing/faq'
import Footer from '@/components/landing/footer'
import Hero from '@/components/landing/hero'
import HowItWorks from '@/components/landing/how-it-works'
import Install from '@/components/landing/install'
import Mobile from '@/components/landing/mobile'
import Modules from '@/components/landing/modules'
import Problems from '@/components/landing/problems'
import Solution from '@/components/landing/solution'
import Testimonials from '@/components/landing/testimonials'
import About from '@/components/landing/about'
import Story from '@/components/landing/story'
import WhatsAppButton from '@/components/landing/whatsapp-button'

export const metadata: Metadata = {
  title: 'Zmeurel OS — Aplicație gratuită pentru fermieri | Evidență parcele, recolte, vânzări',
  description:
    'Ține evidența fermei direct de pe telefon. Parcele, recolte, vânzări și cheltuieli într-un singur loc. Făcută de un fermier din Suceava. Gratuit în beta.',
  openGraph: {
    type: 'website',
    url: 'https://zmeurel.ro',
    title: 'Zmeurel OS — Evidență simplă pentru fermă',
    description:
      'Ține evidența fermei direct de pe telefon. Parcele, recolte, vânzări și cheltuieli într-un singur loc. Gratuit în beta.',
    images: [
      {
        url: 'https://zmeurel.ro/landing/screenshot-dashboard.jpg',
        width: 430,
        height: 932,
        alt: 'Zmeurel OS — Dashboard fermă',
      },
    ],
    locale: 'ro_RO',
    siteName: 'Zmeurel OS',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Zmeurel OS — Evidență simplă pentru fermă',
    description:
      'Ține evidența fermei direct de pe telefon. Parcele, recolte, vânzări și cheltuieli într-un singur loc. Gratuit în beta.',
    images: ['https://zmeurel.ro/landing/screenshot-dashboard.jpg'],
  },
}

export default function Page() {
  return (
    <main
      className="min-h-screen bg-[linear-gradient(180deg,#fffaf7_0%,#ffffff_28%,#f7fbf8_100%)] text-[var(--agri-text)]"
      style={
        {
          '--landing-raspberry': '#F16B6B',
          '--landing-leaf': '#2F6F4E',
          '--landing-dark': '#312E3F',
        } as React.CSSProperties
      }
    >
      <Hero />
      <Problems />
      <Solution />
      <Testimonials />
      <HowItWorks />
      <Modules />
      <FarmTypes />
      <Story />
      <About />
      <Demo />
      <Mobile />
      <Install />
      <Faq />
      <Beta />
      <Footer />
      <WhatsAppButton />
    </main>
  )
}
