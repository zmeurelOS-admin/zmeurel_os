import Link from 'next/link'

import Reveal from '@/components/landing/reveal'
import { Button } from '@/components/ui/button'

export default function Beta() {
  return (
    <section className="bg-[linear-gradient(135deg,rgba(241,107,107,0.12)_0%,rgba(255,255,255,0.85)_30%,rgba(47,111,78,0.12)_100%)]">
      <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8 lg:py-24">
        <Reveal className="rounded-[36px] border border-[color:rgba(47,111,78,0.12)] bg-white/75 p-8 shadow-[0_20px_60px_rgba(47,111,78,0.08)] backdrop-blur sm:p-10 lg:p-12">
          <div className="mx-auto max-w-3xl text-center">
            <p className="text-sm font-semibold tracking-[0.18em] text-[var(--landing-leaf)] uppercase">
              Încearcă și tu
            </p>
            <h2 className="mt-3 text-3xl font-bold tracking-tight text-[var(--landing-dark)] sm:text-4xl">
              Încearcă aplicația în ferma ta
            </h2>
            <p className="mt-4 text-base leading-7 text-[color:var(--agri-text-muted)]">
              Dacă vrei să vezi cum te ajută în fermă, începe gratuit și introdu primele date chiar azi.
            </p>
            <Button
              asChild
              size="lg"
              className="mt-8 h-[54px] rounded-full bg-[linear-gradient(135deg,#2f6f4e_0%,#3f8c62_100%)] px-8 text-white shadow-[0_18px_48px_rgba(47,111,78,0.22)] transition-all hover:scale-[1.02] hover:shadow-[0_24px_58px_rgba(47,111,78,0.3)]"
            >
              <Link href="/start">Încearcă gratuit</Link>
            </Button>
          </div>
        </Reveal>
      </div>
    </section>
  )
}
