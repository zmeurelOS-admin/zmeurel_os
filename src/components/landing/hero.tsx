import Link from 'next/link'

import { SectionShell } from '@/components/landing/landing-shared'

const stats = [
  { value: '30 sec', label: 'să notezi o recoltare' },
  { value: '1 loc', label: 'pentru toate datele fermei' },
  { value: '100%', label: 'gratuit în beta' },
]

export function Hero() {
  return (
    <SectionShell label="Hero Zmeurel OS" className="overflow-hidden bg-[#FAFAF6] py-16 md:py-24">
      <div
        className="rounded-[28px]"
        style={{
          backgroundImage:
            'radial-gradient(circle at top, rgba(45,106,79,0.10), transparent 42%), radial-gradient(circle at 85% 30%, rgba(183,223,201,0.28), transparent 26%)',
        }}
      >
        <div className="mx-auto max-w-3xl text-center">
          <span className="inline-flex items-center rounded-full border border-[#B7DFC9] bg-[#E8F5EE] px-4 py-1.5 text-xs font-semibold tracking-wide text-[#2D6A4F]">
            🔓 Beta deschis — locuri limitate
          </span>
          <h1 className="mt-6 text-4xl font-black tracking-tight text-slate-800 md:text-5xl lg:text-6xl">
            Nu mai pierde bani din fermă.
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-sm leading-7 text-slate-500 md:text-base">
            Vezi cât produci, cât vinzi și cât câștigi real — direct de pe telefon. Aplicație gratuită,
            făcută de un fermier din Suceava.
          </p>

          <div className="mt-8 flex flex-col items-stretch justify-center gap-3 sm:flex-row">
            <Link
              href="/start"
              className="rounded-xl bg-[#2D6A4F] px-6 py-3 text-center text-sm font-semibold text-white transition hover:bg-[#1f4a37] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2D6A4F] focus-visible:ring-offset-2"
            >
              Încearcă gratuit
            </Link>
            <a
              href="https://wa.me/40752953048"
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-xl bg-[#25D366] px-6 py-3 text-center text-sm font-semibold text-white transition hover:bg-[#1ebc5a] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2D6A4F] focus-visible:ring-offset-2"
            >
              Scrie-mi pe WhatsApp
            </a>
          </div>
        </div>

        <div className="mt-10 grid grid-cols-2 gap-4 md:grid-cols-3">
          {stats.map((stat) => (
            <article
              key={stat.value}
              className="rounded-2xl border border-slate-200 bg-white p-5 text-left shadow-sm last:col-span-2 md:last:col-span-1"
            >
              <p className="text-2xl font-black text-[#2D6A4F] md:text-3xl">{stat.value}</p>
              <p className="mt-2 text-sm leading-6 text-slate-500">{stat.label}</p>
            </article>
          ))}
        </div>
      </div>
    </SectionShell>
  )
}
