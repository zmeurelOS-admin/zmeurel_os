import Link from 'next/link'

import { SectionShell } from '@/components/landing/landing-shared'

export function DemoCta() {
  return (
    <SectionShell id="demo" label="Call to action demo" className="bg-white py-16 md:py-24">
      <div
        className="rounded-3xl px-8 py-8 shadow-xl md:px-12 md:py-12 lg:px-16 lg:py-16"
        style={{ backgroundImage: 'linear-gradient(135deg, #2D6A4F 0%, #40916C 100%)' }}
      >
        <span className="inline-flex items-center rounded-full bg-white/15 px-3 py-1 text-xs font-semibold tracking-wide text-white">
          Demo ghidat
        </span>
        <h2 className="mt-4 text-2xl font-extrabold tracking-tight text-white md:text-4xl">
          Începe azi — e gratuit.
        </h2>
        <p className="mt-4 max-w-2xl text-sm leading-7 text-white/85 md:text-base">
          Introdu primele date în fermă în mai puțin de 2 minute. Intră rapid într-o fermă demo și vezi cum arată.
        </p>

        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <Link
            href="/start"
            className="rounded-xl bg-white px-6 py-3 text-center text-sm font-semibold text-[#2D6A4F] transition hover:bg-[#F5F5F5] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-[#2D6A4F]"
          >
            Încearcă gratuit
          </Link>
          <a
            href="https://wa.me/40752953048"
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-xl border border-white/30 bg-white/15 px-6 py-3 text-center text-sm font-semibold text-white transition hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-[#2D6A4F]"
          >
            WhatsApp
          </a>
        </div>
      </div>
    </SectionShell>
  )
}
