'use client'

import { Truck } from 'lucide-react'

import { cn } from '@/lib/utils'

type Props = {
  text: string
  className?: string
  compact?: boolean
}

export function AssociationDeliveryNotice({ text, className, compact = false }: Props) {
  return (
    <div
      className={cn(
        'flex items-start gap-3 rounded-2xl border bg-[#FFF9E3] text-[#3D4543] shadow-[0_10px_28px_rgba(61,69,67,0.08)]',
        compact ? 'px-3.5 py-3' : 'px-4 py-3.5',
        className,
      )}
      style={{ borderColor: 'rgba(255, 158, 27, 0.24)' }}
    >
      <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#FF9E1B]/12 text-[#0D6342]">
        <Truck className="h-4 w-4" aria-hidden />
      </span>
      <p className={cn('assoc-body leading-relaxed', compact ? 'text-[13px]' : 'text-sm')}>
        {text}
      </p>
    </div>
  )
}
