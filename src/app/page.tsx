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
import Story from '@/components/landing/story'

export const metadata: Metadata = {
  title: 'Zmeurel OS | Ține evidența fermei tale direct pe telefon',
  description:
    'Ține evidența parcelelor, lucrărilor, recoltelor, vânzărilor și cheltuielilor într-un singur loc. Pentru fructe de pădure, solarii și livezi.',
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
      <Story />
      <Problems />
      <Solution />
      <FarmTypes />
      <HowItWorks />
      <Modules />
      <Demo />
      <Mobile />
      <Install />
      <Faq />
      <Beta />
      <Footer />
    </main>
  )
}
