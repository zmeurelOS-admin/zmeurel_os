import { Check } from 'lucide-react'

import { AssociationHeroVisual } from '@/components/shop/AssociationHeroVisual'
import { cn } from '@/lib/utils'

import { M, PX } from './marketTokens'

const BADGES = ['Produse locale', 'Direct de la fermieri', 'Fără intermediari'] as const

type Props = {
  onCta: () => void
}

/**
 * Hero comercial nou — layout split desktop, stacked mobil; imagine vizibilă (nu placeholder gol).
 */
export function MarketHero({ onCta }: Props) {
  return (
    <section className="border-b" style={{ backgroundColor: M.cream, borderColor: M.border }}>
      <div className={cn('py-8 md:py-12 lg:py-16', PX)}>
        <div className="grid items-stretch gap-8 lg:grid-cols-2 lg:gap-12 lg:items-center">
          <div className="flex flex-col items-center text-center lg:items-start lg:text-left">
            <span
              className="assoc-heading inline-flex rounded-full border px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.12em] sm:text-[11px]"
              style={{ borderColor: M.border, color: M.green, backgroundColor: 'rgba(255,255,255,0.95)' }}
            >
              Direct de la fermieri locali
            </span>
            <h1
              className="assoc-heading mt-4 max-w-xl text-[2rem] font-extrabold leading-[1.05] tracking-tight sm:text-5xl lg:text-[3.25rem]"
              style={{ color: M.green }}
            >
              Gustă din Bucovina
            </h1>
            <p
              className="assoc-body mt-4 max-w-md text-base font-medium leading-relaxed sm:text-lg"
              style={{ color: M.text }}
            >
              Magazinul asociației — alegi produse, comanzi fără cont.
            </p>
            <button
              type="button"
              onClick={onCta}
              className="assoc-body mt-8 min-h-[52px] min-w-[220px] rounded-full px-10 py-3.5 text-base font-bold text-[#3D4543] shadow-lg transition hover:brightness-95 active:scale-[0.98] sm:text-lg"
              style={{ backgroundColor: M.orange, boxShadow: '0 6px 24px rgba(255, 158, 27, 0.45)' }}
            >
              Vezi produsele
            </button>
            <div className="mt-8 flex flex-wrap justify-center gap-2 lg:justify-start">
              {BADGES.map((b) => (
                <span
                  key={b}
                  className="assoc-body inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold sm:text-sm"
                  style={{ borderColor: M.border, backgroundColor: M.creamMid, color: M.text }}
                >
                  <Check className="h-3.5 w-3.5 shrink-0" style={{ color: M.green }} strokeWidth={2.5} />
                  {b}
                </span>
              ))}
            </div>
          </div>
          <div className="relative w-full lg:min-h-[min(420px,50vh)]">
            <AssociationHeroVisual className="h-full min-h-[260px] w-full max-w-none rounded-3xl shadow-[0_20px_60px_rgba(61,69,67,0.12)] md:min-h-[360px]" />
          </div>
        </div>
      </div>
    </section>
  )
}
