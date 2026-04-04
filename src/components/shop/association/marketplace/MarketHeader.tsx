import { ShoppingBag } from 'lucide-react'

import { AssociationLogo } from '@/components/shop/AssociationLogo'
import { cn } from '@/lib/utils'

import { M, PX } from './marketTokens'

type Props = {
  cartLineCount: number
  onOpenCart: () => void
}

/**
 * Header marketplace — înlocuiește complet header-ul vechi: verde, logo stânga, coș rotund dreapta.
 */
export function MarketHeader({ cartLineCount, onOpenCart }: Props) {
  return (
    <header
      className="sticky top-0 z-[100] border-b shadow-[0_1px_0_rgba(255,249,227,0.12)]"
      style={{ backgroundColor: M.green, borderColor: 'rgba(255,249,227,0.15)' }}
    >
      <div
        className={cn(
          'flex h-[56px] min-h-[56px] items-center justify-between gap-3 sm:h-[60px] sm:min-h-[60px]',
          'pt-[max(0px,env(safe-area-inset-top))]',
          PX,
        )}
      >
        <div className="min-w-0 pb-2">
          <AssociationLogo variant="dark" size="md" showTagline className="scale-[0.92] sm:scale-100" />
        </div>
        <button
          type="button"
          onClick={onOpenCart}
          className="relative flex h-12 w-12 shrink-0 items-center justify-center rounded-full border-2 border-white/30 bg-white/10 text-[#FFF9E3] shadow-inner transition hover:bg-white/20 active:scale-95"
          aria-label="Deschide coșul"
        >
          <ShoppingBag className="h-5 w-5" strokeWidth={2.2} />
          {cartLineCount > 0 ? (
            <span
              className="absolute -right-0.5 -top-0.5 flex h-5 min-w-[1.25rem] items-center justify-center rounded-full px-1 text-[10px] font-bold leading-none text-[#3D4543]"
              style={{ backgroundColor: M.orange }}
            >
              {cartLineCount > 99 ? '99+' : cartLineCount}
            </span>
          ) : null}
        </button>
      </div>
    </header>
  )
}
