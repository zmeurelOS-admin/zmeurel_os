import { Leaf } from 'lucide-react'

import { cn } from '@/lib/utils'

const GREEN = '#0D6342'
const CREAM = '#FFF9E3'

export type AssociationLogoProps = {
  /** `light` = pe fundal crem (text verde); `dark` = pe fundal verde închis sau brand (text crem). */
  variant?: 'light' | 'dark'
  size?: 'sm' | 'md' | 'lg'
  showTagline?: boolean
  className?: string
}

/**
 * Logo „Gustă din Bucovina” — simbol vector + wordmark.
 * Fără gradient, fără umbră.
 */
export function AssociationLogo({
  variant = 'light',
  size = 'md',
  showTagline = false,
  className,
}: AssociationLogoProps) {
  const fg = variant === 'light' ? GREEN : CREAM

  const iconWrap = size === 'sm' ? 'h-8 w-8' : size === 'lg' ? 'h-14 w-14' : 'h-11 w-11'
  const line1 =
    size === 'sm' ? 'text-[0.6rem]' : size === 'lg' ? 'text-xs' : 'text-[0.65rem]'
  const line2 = size === 'sm' ? 'text-base' : size === 'lg' ? 'text-2xl sm:text-3xl' : 'text-lg sm:text-xl'

  return (
    <div className={cn('flex min-w-0 items-center gap-2.5 sm:gap-3', className)}>
      <span className={cn('flex shrink-0 items-center justify-center', iconWrap)} style={{ color: fg }}>
        <Leaf
          className={size === 'lg' ? 'h-9 w-9' : size === 'sm' ? 'h-5 w-5' : 'h-7 w-7 sm:h-8 sm:w-8'}
          strokeWidth={2.25}
          aria-hidden
        />
      </span>
      <div className="min-w-0">
        <p
          className={cn('assoc-heading font-bold uppercase leading-none tracking-[0.14em]', line1)}
          style={{ color: fg }}
        >
          Gustă din
        </p>
        <p
          className={cn('assoc-heading truncate font-extrabold leading-tight tracking-tight', line2)}
          style={{ color: fg }}
        >
          Bucovina
        </p>
        {showTagline ? (
          <p className="mt-0.5 truncate text-[0.7rem] font-medium opacity-70 sm:text-xs" style={{ color: fg }}>
            Magazin asociație
          </p>
        ) : null}
      </div>
    </div>
  )
}
