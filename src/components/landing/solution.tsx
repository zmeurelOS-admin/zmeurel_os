import {
  ClipboardList,
  FileBarChart2,
  HandCoins,
  PackageCheck,
  Sprout,
  Tractor,
} from 'lucide-react'

import Reveal from '@/components/landing/reveal'

const items = [
  { icon: Sprout, label: 'parcele' },
  { icon: Sprout, label: 'solarii' },
  { icon: Sprout, label: 'livezi' },
  { icon: Tractor, label: 'lucrări' },
  { icon: FileBarChart2, label: 'recolte' },
  { icon: HandCoins, label: 'vânzări' },
  { icon: ClipboardList, label: 'cheltuieli' },
  { icon: PackageCheck, label: 'comenzi' },
]

export default function Solution() {
  return (
    <section id="solutie" className="bg-[linear-gradient(180deg,transparent_0%,rgba(47,111,78,0.04)_100%)]">
      <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8 lg:py-24">
        <Reveal className="mx-auto max-w-3xl text-center">
          <p className="text-sm font-semibold tracking-[0.18em] text-[var(--landing-leaf)] uppercase">
            Soluția
          </p>
          <h2 className="mt-3 text-3xl font-bold tracking-tight text-[var(--landing-dark)] sm:text-4xl">
            Ai toate datele fermei într-un singur loc.
          </h2>
          <p className="mt-4 text-base leading-7 text-[color:var(--agri-text-muted)]">
            Introduci datele în 30 de secunde, direct din câmp.
          </p>
        </Reveal>

        <div className="mt-10 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {items.map((item, index) => {
            const Icon = item.icon
            return (
              <Reveal
                key={item.label}
                delayMs={index * 60}
                className="rounded-[28px] bg-[linear-gradient(135deg,rgba(47,111,78,0.18),rgba(241,107,107,0.14),rgba(255,255,255,0.9))] p-px shadow-[0_14px_36px_rgba(47,111,78,0.08)] transition-transform duration-300 hover:-translate-y-1 hover:scale-[1.02] hover:shadow-[0_24px_52px_rgba(49,46,63,0.12)]"
              >
                <div className="flex items-center gap-4 rounded-[27px] bg-white p-5">
                  <div className="inline-flex size-12 items-center justify-center rounded-full bg-[linear-gradient(135deg,rgba(47,111,78,0.12),rgba(47,111,78,0.04))] text-[var(--landing-leaf)] shadow-inner">
                    <Icon className="size-5" />
                  </div>
                  <p className="text-base font-semibold capitalize text-[var(--landing-dark)]">{item.label}</p>
                </div>
              </Reveal>
            )
          })}
        </div>
      </div>
    </section>
  )
}
