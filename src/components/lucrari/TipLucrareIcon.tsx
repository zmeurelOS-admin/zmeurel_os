'use client'

import type { ReactNode } from 'react'
import { Droplets, Ellipsis, Fence, Layers, Link2, Scissors, Shovel, Sprout } from 'lucide-react'

import type { TipLucrare } from '@/lib/lucrari/tipuri'
import { cn } from '@/lib/utils'

export const ICON_LUCRARE: Record<TipLucrare, ReactNode> = {
  taiere: <Scissors aria-hidden />,
  palisare: <Fence aria-hidden />,
  prasit: <Shovel aria-hidden />,
  irigatie: <Droplets aria-hidden />,
  mulcire: <Layers aria-hidden />,
  copilit: <Sprout aria-hidden />,
  legat: <Link2 aria-hidden />,
  altele: <Ellipsis aria-hidden />,
}

/** Iconița lucrării, într-un cerc de 44 px (rândurile din jurnal). */
export function TipLucrareIcon({ tip, className }: { tip: TipLucrare; className?: string }) {
  return (
    <span
      className={cn(
        'flex size-11 shrink-0 items-center justify-center rounded-full [&_svg]:size-5',
        tip === 'irigatie' ? 'bg-info-bg text-info-text' : 'bg-surface-muted text-fg',
        className,
      )}
      aria-hidden
    >
      {ICON_LUCRARE[tip]}
    </span>
  )
}
