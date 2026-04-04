import { Package, ShoppingCart, Truck } from 'lucide-react'

import { M, PX } from './marketTokens'

const STEPS = [
  { icon: Package, title: 'Alegi produsele', desc: 'Parcurgi catalogul și adaugi în coș ce îți place.' },
  { icon: ShoppingCart, title: 'Completezi comanda', desc: 'Îți lași datele de contact și confirmi.' },
  { icon: Truck, title: 'Livrare & plată', desc: 'Te contactăm pentru detalii de livrare și plată.' },
] as const

export function MarketHowItWorks() {
  return (
    <section className="border-t py-12 md:py-16" style={{ backgroundColor: M.creamMid, borderColor: M.border }}>
      <div className={PX}>
        <h2 className="assoc-heading text-center text-2xl font-extrabold sm:text-3xl" style={{ color: M.green }}>
          Cum funcționează
        </h2>
        <p className="assoc-body mx-auto mt-2 max-w-xl text-center text-sm font-medium sm:text-base" style={{ color: M.text }}>
          Trei pași simpli până la produsele tale locale.
        </p>
        <div className="mt-10 grid gap-6 sm:grid-cols-3">
          {STEPS.map((s, i) => (
            <div
              key={s.title}
              className="flex flex-col items-center rounded-2xl border bg-white p-6 text-center shadow-sm"
              style={{ borderColor: M.border }}
            >
              <div
                className="flex h-14 w-14 items-center justify-center rounded-2xl text-white shadow-md"
                style={{ backgroundColor: M.green }}
              >
                <s.icon className="h-7 w-7" strokeWidth={2} />
              </div>
              <span className="assoc-body mt-3 text-xs font-bold uppercase tracking-wide" style={{ color: M.muted }}>
                Pas {i + 1}
              </span>
              <h3 className="assoc-heading mt-1 text-lg font-bold" style={{ color: M.text }}>
                {s.title}
              </h3>
              <p className="assoc-body mt-2 text-sm leading-relaxed" style={{ color: M.muted }}>
                {s.desc}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
