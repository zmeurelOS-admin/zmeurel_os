'use client'

import type { ReactNode } from 'react'

import { cn } from '@/lib/utils'

import { kitText } from './text'

export interface AntetFisaProps {
  /** Numele elementului (clientul comenzii, parcela). */
  titlu: ReactNode
  /** Rândul de context (ex. „Comanda nr. 1041 · 0744 112 233 · Str. Universității 21”). */
  context?: ReactNode
  /** Starea, lângă titlu (ex. `StatusPill`). */
  stare?: ReactNode
  /** Acțiunile fișei, butoane în cap („Pune în livrare”, „Încasează”, „Editează”). */
  actiuni?: ReactNode
  className?: string
}

/**
 * Capul fișei din dreapta în listă + detaliu (promptul 35, §4): titlul, contextul și acțiunile ca butoane. Titlul e
 * `h2` (antetul paginii are `h1`).
 */
export function AntetFisa({ titlu, context, stare, actiuni, className }: AntetFisaProps) {
  return (
    <div className={cn('space-y-3 border-b border-border-subtle pb-4', className)}>
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className={cn('min-w-0 break-words font-extrabold text-fg', kitText.section)}>{titlu}</h2>
            {stare}
          </div>
          {context ? <p className={cn('break-words text-fg-muted', kitText.secondary)}>{context}</p> : null}
        </div>
      </div>
      {actiuni ? <div className="flex flex-wrap items-center gap-2">{actiuni}</div> : null}
    </div>
  )
}

/** Cardul fișei din dreapta (o secțiune cu titlu). */
export function SectiuneFisa({ titlu, dreapta, children, className }: { titlu?: ReactNode; dreapta?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={cn('space-y-3 rounded-box border border-border bg-surface p-4', className)}>
      {titlu || dreapta ? (
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          {titlu ? <h3 className={cn('font-bold text-fg', kitText.card)}>{titlu}</h3> : <span />}
          {dreapta}
        </div>
      ) : null}
      {children}
    </section>
  )
}

/** Comutatorul „Listă / Tabel” din antetul de desktop. */
export const OPTIUNI_VEDERE = [
  { value: 'lista' as const, label: 'Listă' },
  { value: 'tabel' as const, label: 'Tabel' },
]
