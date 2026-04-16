import { Leaf } from 'lucide-react'

import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { AssociationProduct } from '@/lib/shop/load-association-catalog'

import { AssociationProductImage } from './AssociationProductImage'
import { ASSOC, labelForCategory, resolveAssociationCategory } from './tokens'

type Props = {
  product: AssociationProduct
  formatPrice: (p: AssociationProduct) => string
  qtyDraft: string
  onQtyChange: (v: string) => void
  onAddToCart: () => void
}

/**
 * Doar câmpuri din modelul real (`public.produse` / PublicShopProduct); fără ambalare/valabilitate dacă nu există în DB.
 */
export function AssociationProductDetailContent({
  product: p,
  formatPrice,
  qtyDraft,
  onQtyChange,
  onAddToCart,
}: Props) {
  const catLabel = labelForCategory(resolveAssociationCategory(p.association_category, p.categorie))

  return (
    <div className="flex max-h-[min(92dvh,720px)] flex-col overflow-hidden sm:max-h-[min(88vh,680px)]">
      <div className="relative w-full shrink-0 overflow-hidden bg-[#F5EDCA]">
        <div className="relative aspect-[16/10] w-full">
          <AssociationProductImage
            src={p.poza_1_url}
            alt={p.nume}
            sizes="(max-width: 768px) 100vw, 32rem"
            priority
          />
        </div>
        {p.poza_2_url ? (
          <div className="relative aspect-[2/1] w-full border-t" style={{ borderColor: ASSOC.border }}>
            <AssociationProductImage
              src={p.poza_2_url}
              alt={`${p.nume} — imagine suplimentară`}
              sizes="(max-width: 768px) 100vw, 32rem"
            />
          </div>
        ) : null}
      </div>
      <div className="assoc-body min-h-0 flex-1 space-y-4 overflow-y-auto px-5 pb-6 pt-4 sm:px-6" style={{ color: ASSOC.text }}>
        <div>
          <p className="text-[11px] font-bold uppercase tracking-wide" style={{ color: ASSOC.textMuted }}>
            {catLabel}
          </p>
          <h2 className="assoc-heading mt-1 text-xl font-bold leading-tight sm:text-2xl" style={{ color: ASSOC.green }}>
            {p.nume}
          </h2>
        </div>
        <p className="flex items-start gap-2 text-sm font-semibold">
          <Leaf className="mt-0.5 h-4 w-4 shrink-0" style={{ color: ASSOC.green }} aria-hidden />
          <span>
            de la: {p.farmName}
            {p.farmRegion ? <span className="font-normal opacity-80"> · {p.farmRegion}</span> : null}
          </span>
        </p>
        {p.descriere ? (
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wide" style={{ color: ASSOC.textMuted }}>
              Descriere
            </p>
            <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed" style={{ color: ASSOC.textMuted }}>
              {p.descriere}
            </p>
          </div>
        ) : null}
        <div className="flex flex-wrap gap-2 text-sm">
          <span
            className="rounded-xl px-3 py-1.5 font-bold"
            style={{ backgroundColor: ASSOC.creamMid, color: ASSOC.green }}
          >
            {formatPrice(p)} {p.moneda} / {p.unitate_vanzare}
          </span>
          {p.gramaj_per_unitate != null ? (
            <span
              className="rounded-xl border px-3 py-1.5 text-[13px] font-medium"
              style={{ borderColor: ASSOC.border, color: ASSOC.text }}
            >
              {Number(p.gramaj_per_unitate)} g / unitate
            </span>
          ) : null}
        </div>
        <div className="space-y-2">
          <Label htmlFor="assoc_qty_detail" className="font-semibold">
            Cantitate ({p.unitate_vanzare})
          </Label>
          <Input
            id="assoc_qty_detail"
            inputMode="numeric"
            className="h-12 rounded-xl border text-base"
            style={{ borderColor: ASSOC.border, color: ASSOC.text }}
            value={qtyDraft}
            onChange={(e) => onQtyChange(e.target.value)}
            min="1"
            step="1"
          />
        </div>
        <button
          type="button"
          className="assoc-body h-12 w-full rounded-xl text-base font-bold text-[#3D4543] transition hover:opacity-95"
          style={{ backgroundColor: ASSOC.orange }}
          onClick={onAddToCart}
        >
          Adaugă în coș
        </button>
      </div>
    </div>
  )
}
