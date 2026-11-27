import type { ReactNode } from 'react'

import { cn } from '@/lib/utils'

import { kitText } from './text'

export type StatTileTone = 'neutral' | 'warning' | 'inverse'

export interface StatTileProps {
  value: ReactNode
  label: ReactNode
  /** Unitate scrisă mic după valoare (ex. „kg”). */
  unit?: ReactNode
  tone?: StatTileTone
  className?: string
}

/** O cifră cu eticheta ei. `inverse` = placă plină, pentru cifra principală a rândului. */
export function StatTile({ value, label, unit, tone = 'neutral', className }: StatTileProps) {
  return (
    <div
      className={cn(
        'flex min-h-[78px] min-w-0 flex-col justify-center gap-0.5 rounded-box p-3',
        tone === 'inverse' ? 'bg-primary text-primary-contrast' : 'border border-border bg-surface',
        className,
      )}
    >
      <span
        className={cn(
          'break-words font-extrabold',
          kitText.section,
          'leading-none',
          tone === 'neutral' && 'text-fg',
          tone === 'warning' && 'text-warning-text',
        )}
      >
        {value}
        {unit ? <span className={cn('ml-1 font-bold', kitText.secondary)}>{unit}</span> : null}
      </span>
      <span
        className={cn(kitText.helper, 'font-medium leading-tight', tone === 'inverse' ? 'opacity-85' : 'text-fg-muted')}
      >
        {label}
      </span>
    </div>
  )
}

export interface StatHeroItem {
  label: ReactNode
  value: ReactNode
}

export interface StatHeroProps {
  label: ReactNode
  value: ReactNode
  unit?: ReactNode
  /** Cifrele secundare, pe două coloane (ex. lei de plată, calitatea 1, calitatea 2, culegători). */
  items?: ReadonlyArray<StatHeroItem>
  footer?: ReactNode
  className?: string
}

/** Cardul principal, plin, al unei pagini (ex. totalul zilei la Recoltări). */
export function StatHero({ label, value, unit, items, footer, className }: StatHeroProps) {
  return (
    <div className={cn('rounded-card bg-primary p-5 text-primary-contrast shadow-2', className)}>
      <p className={cn('font-semibold opacity-85', kitText.secondary)}>{label}</p>
      <p className="mt-1 flex items-baseline gap-2">
        <span className={cn('font-extrabold', kitText.figure)}>{value}</span>
        {unit ? <span className={cn('font-bold opacity-85', kitText.section)}>{unit}</span> : null}
      </p>
      {items?.length ? (
        <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 border-t border-primary-contrast/20 pt-4">
          {items.map((item, index) => (
            <div key={index} className="flex min-w-0 flex-col-reverse gap-0.5">
              <dt className={cn('font-medium opacity-85', kitText.helper)}>{item.label}</dt>
              <dd className={cn('break-words font-extrabold', kitText.card)}>{item.value}</dd>
            </div>
          ))}
        </dl>
      ) : null}
      {footer ? <div className="mt-4">{footer}</div> : null}
    </div>
  )
}
