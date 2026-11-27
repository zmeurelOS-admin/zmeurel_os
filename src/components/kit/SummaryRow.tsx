import type { ReactNode } from 'react'

import { cn } from '@/lib/utils'

import { kitFocus, kitText } from './text'

export interface SummaryRowProps {
  label: ReactNode
  value: ReactNode
  /** Sumă sau cantitate în dreapta. */
  amount?: ReactNode
  /** Deschide pasul în care se schimbă valoarea. Fără el, rândul nu e apăsabil. */
  onChange?: () => void
  changeLabel?: string
  className?: string
}

/** Rând de recapitulare: etichetă, valoare și „Schimbă”. Tot rândul e ținta. */
export function SummaryRow({ label, value, amount, onChange, changeLabel = 'Schimbă', className }: SummaryRowProps) {
  const content = (
    <>
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className={cn('font-medium text-fg-muted', kitText.secondary)}>{label}</span>
        <span className={cn('break-words font-bold text-fg', kitText.base)}>{value}</span>
      </span>
      {amount ? <span className={cn('shrink-0 whitespace-nowrap font-bold text-fg', kitText.base)}>{amount}</span> : null}
      {onChange ? <span className={cn('shrink-0 font-semibold text-primary', kitText.secondary)}>{changeLabel}</span> : null}
    </>
  )

  const rowClass = cn(
    'flex min-h-16 w-full items-center gap-3 border-b border-border-subtle bg-surface px-4 py-3 text-left last:border-b-0',
    className,
  )

  if (!onChange) return <div className={rowClass}>{content}</div>

  return (
    <button type="button" onClick={onChange} className={cn(rowClass, kitFocus, 'active:bg-surface-muted')}>
      {content}
    </button>
  )
}

/** Grupul de rânduri de recapitulare, într-un singur chenar. */
export function SummaryList({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('overflow-hidden rounded-box border-2 border-border', className)}>{children}</div>
}
