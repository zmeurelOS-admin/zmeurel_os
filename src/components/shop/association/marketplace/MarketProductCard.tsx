import { Plus } from 'lucide-react'

import { AssociationProductImage } from '@/components/shop/association/AssociationProductImage'
import { labelForCategory, resolveAssociationCategory } from '@/components/shop/association/tokens'
import type { AssociationProduct } from '@/lib/shop/load-association-catalog'

import { M } from './marketTokens'

type Props = {
  product: AssociationProduct
  formatPrice: (p: AssociationProduct) => string
  onOpenDetail: () => void
  onAddQuick: () => void
}

/**
 * Card produs comercial — imagine mare, badge categorie, fermă, preț, CTA portocaliu.
 */
export function MarketProductCard({ product: p, formatPrice, onOpenDetail, onAddQuick }: Props) {
  const farmName = p.farmName?.trim() || 'Fermă locală'
  const categoryKey = resolveAssociationCategory(p.association_category, p.categorie)

  return (
    <article
      className="group flex flex-col overflow-hidden rounded-2xl border bg-white shadow-[0_8px_28px_rgba(61,69,67,0.08)] transition hover:shadow-[0_14px_40px_rgba(61,69,67,0.12)]"
      style={{ borderColor: M.border }}
    >
      <button
        type="button"
        onClick={onOpenDetail}
        className="relative block w-full text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
        style={{ ['--tw-ring-color' as string]: M.green }}
      >
        <div className="relative aspect-[4/5] w-full overflow-hidden bg-[#F0EBDC]">
          <AssociationProductImage
            src={p.poza_1_url}
            alt={p.nume}
            sizes="(max-width: 640px) 50vw, 25vw"
            className="transition duration-300 group-hover:scale-[1.03]"
          />
          <span
            className="assoc-body absolute left-2 top-2 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide shadow-sm sm:text-[11px]"
            style={{ backgroundColor: M.cream, color: M.green, boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}
          >
            {labelForCategory(categoryKey)}
          </span>
        </div>
        <div className="flex flex-1 flex-col p-3 sm:p-4">
          <h3 className="assoc-heading line-clamp-2 min-h-[2.5rem] text-sm font-bold leading-snug sm:text-base" style={{ color: M.text }}>
            {p.nume}
          </h3>
          <p className="assoc-body mt-1 line-clamp-1 text-xs font-medium sm:text-sm" style={{ color: M.muted }}>
            de la {farmName}
            {p.farmRegion ? ` · ${p.farmRegion}` : ''}
          </p>
          <p className="assoc-heading mt-3 text-lg font-extrabold tabular-nums sm:text-xl" style={{ color: M.green }}>
            {formatPrice(p)}{' '}
            <span className="text-sm font-semibold opacity-90">{p.moneda}</span>
          </p>
          <p className="assoc-body text-[11px] font-medium" style={{ color: M.muted }}>
            / {p.unitate_vanzare}
          </p>
        </div>
      </button>
      <div className="mt-auto px-3 pb-3 sm:px-4 sm:pb-4">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            onAddQuick()
          }}
          className="assoc-body flex h-11 w-full items-center justify-center gap-2 rounded-xl text-sm font-bold text-[#3D4543] shadow-md transition hover:brightness-95 active:scale-[0.98] sm:h-12 sm:text-base"
          style={{ backgroundColor: M.orange, boxShadow: '0 4px 16px rgba(255, 158, 27, 0.35)' }}
        >
          <Plus className="h-5 w-5" strokeWidth={2.5} />
          Adaugă
        </button>
      </div>
    </article>
  )
}
