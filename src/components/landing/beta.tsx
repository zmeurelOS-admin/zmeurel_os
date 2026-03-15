import Link from 'next/link'

import Reveal from '@/components/landing/reveal'
import { Button } from '@/components/ui/button'

export default function Beta() {
  return (
    <section className="bg-[linear-gradient(135deg,rgba(241,107,107,0.12)_0%,rgba(255,255,255,0.85)_30%,rgba(47,111,78,0.12)_100%)]">
      <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8 lg:py-24">
        <Reveal className="rounded-[36px] border border-[color:rgba(47,111,78,0.12)] bg-white/75 p-6 shadow-[0_20px_60px_rgba(47,111,78,0.08)] backdrop-blur sm:p-10 lg:p-12">
          <div className="mx-auto max-w-3xl text-center">
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[var(--landing-leaf)]">
              Fă primul pas
            </p>
            <h2 className="mt-3 text-3xl font-bold tracking-tight text-[var(--landing-dark)] sm:text-4xl">
              Începe azi — e gratuit.
            </h2>
            <p className="mt-4 text-base leading-7 text-[color:var(--agri-text-muted)]">
              Introdu primele date în fermă în mai puțin de 2 minute.
            </p>
            <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
              <Button
                asChild
                size="lg"
                className="h-12 w-full rounded-full bg-[linear-gradient(135deg,#2f6f4e_0%,#3f8c62_100%)] px-8 text-white shadow-[0_18px_48px_rgba(47,111,78,0.22)] transition-all hover:scale-[1.02] hover:shadow-[0_24px_58px_rgba(47,111,78,0.3)] sm:w-auto"
              >
                <Link href="/start">Încearcă gratuit</Link>
              </Button>
              <Button
                asChild
                size="lg"
                variant="outline"
                className="h-12 w-full rounded-full border-[color:rgba(49,46,63,0.16)] bg-white px-8 text-[var(--landing-dark)] shadow-sm transition-colors hover:border-[color:rgba(49,46,63,0.28)] hover:bg-[var(--landing-dark)] hover:text-white sm:w-auto"
              >
                <a href="https://wa.me/40752953048" target="_blank" rel="noopener noreferrer">
                  Scrie-mi pe WhatsApp
                </a>
              </Button>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  )
}
