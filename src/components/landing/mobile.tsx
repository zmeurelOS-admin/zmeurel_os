'use client'

import Image from 'next/image'
import { motion } from 'framer-motion'
import { CheckCircle2 } from 'lucide-react'

import Reveal from '@/components/landing/reveal'

const quickSteps = [
  'Deschizi telefonul direct în câmp.',
  'Adaugi recoltarea sau lucrarea în câteva secunde.',
  'Datele apar imediat în aplicație.',
]

export default function Mobile() {
  return (
    <section className="bg-[linear-gradient(180deg,rgba(241,107,107,0.05),transparent_35%)]">
      <div className="mx-auto grid max-w-7xl items-center gap-10 px-4 py-16 sm:px-6 lg:grid-cols-[minmax(0,1fr)_minmax(360px,460px)] lg:gap-16 lg:px-8 lg:py-24">
        <Reveal className="space-y-5">
          <p className="text-sm font-semibold tracking-[0.18em] text-[var(--landing-raspberry)] uppercase">
            Direct pe telefon
          </p>
          <h2 className="text-3xl font-bold tracking-tight text-[var(--landing-dark)] sm:text-4xl">
            Notezi repede ce faci în fermă
          </h2>
          <p className="max-w-2xl text-base leading-7 text-[color:var(--agri-text-muted)]">
            Aplicația este făcută pentru telefon, ca să poți introduce datele direct din câmp, din solar sau din livadă.
          </p>
          <div className="space-y-3">
            {quickSteps.map((step, index) => (
              <Reveal
                key={step}
                delayMs={index * 70}
                className="flex items-start gap-3 rounded-2xl border border-[color:rgba(47,111,78,0.08)] bg-white px-4 py-3 text-sm text-[var(--landing-dark)] shadow-sm transition-transform duration-300 hover:-translate-y-1 hover:scale-[1.02] hover:shadow-[0_18px_40px_rgba(49,46,63,0.08)]"
              >
                <CheckCircle2 className="mt-0.5 size-5 text-[var(--landing-leaf)]" />
                <span>{step}</span>
              </Reveal>
            ))}
          </div>
        </Reveal>
        <Reveal delayMs={120} className="mx-auto w-full max-w-[380px]">
          <motion.div
            animate={{ y: [0, -10, 0] }}
            transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut' }}
            className="will-change-transform"
          >
            <div className="rounded-[38px] border border-[color:rgba(49,46,63,0.08)] bg-white p-4 shadow-[0_24px_80px_rgba(49,46,63,0.14)]">
              <Image
                src="/landing/mobile-mockup.svg"
                alt="Telefon cu aplicația Zmeurel OS."
                width={760}
                height={1280}
                className="h-auto w-full rounded-[28px]"
              />
            </div>
          </motion.div>
        </Reveal>
      </div>
    </section>
  )
}
