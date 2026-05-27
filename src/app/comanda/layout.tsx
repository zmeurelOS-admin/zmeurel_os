import type { Metadata } from 'next'
import { Fraunces, Hanken_Grotesk } from 'next/font/google'

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
  title: 'Zmeurel — Afine siberiene | Văratec, Suceava',
  description:
    'Afine siberiene proaspete din Văratec. Culese dimineața, livrate în aceeași zi în Suceava și împrejurimi. Comandă direct de la fermă.',
  robots: { index: true, follow: true },
}

export default function ComandaLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={`${fraunces.variable} ${hanken.variable} ${styles.root} ${styles.fontBody}`}>
      {children}
    </div>
  )
}
