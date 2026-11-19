'use client'

import { ArrowDown, ArrowUp, Check, Route } from 'lucide-react'

import { Button, Notice, kitFocus, kitText } from '@/components/kit'
import { localitateScurta } from '@/lib/comenzi/day-view'
import { formatKg } from '@/lib/format-ro'
import { cn } from '@/lib/utils'

import type { RouteStop } from './StopSheet'

export interface AranjeazaTraseuProps {
  stops: readonly RouteStop[]
  onMove: (comandaId: string, direction: -1 | 1) => void
  onDone: () => void
  /** `null` = optimizarea nu se poate porni; textul spune de ce. */
  optimizeBlockedReason: string | null
  optimizing: boolean
  onOptimize: () => void
  /** Rezultatul ultimei optimizări (reușită sau nu). */
  optimizeMessage: { tone: 'success' | 'warning' | 'danger'; title: string; text?: string } | null
}

/**
 * Aranjarea traseului: săgeți mari sus / jos pe fiecare oprire (nu doar tragere) și optimizarea pe străzi reale.
 * Ordinea se salvează în `comenzi.ordine_livrare`, deci e aceeași pe orice telefon.
 */
export function AranjeazaTraseu({
  stops,
  onMove,
  onDone,
  optimizeBlockedReason,
  optimizing,
  onOptimize,
  optimizeMessage,
}: AranjeazaTraseuProps) {
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Button
          type="button"
          variant="neutral"
          size="touch-lg"
          className="w-full"
          disabled={optimizeBlockedReason !== null}
          loading={optimizing}
          aria-describedby={optimizeBlockedReason ? 'optimizare-blocata' : undefined}
          onClick={onOptimize}
        >
          <Route aria-hidden />
          {optimizing ? 'Se calculează traseul…' : 'Optimizează traseul'}
        </Button>
        <p id="optimizare-blocata" className={cn('px-1 text-fg-muted', kitText.helper)}>
          {optimizeBlockedReason ?? 'Pornește de unde ești acum. Clienții fără locație rămân la final.'}
        </p>
      </div>

      {optimizeMessage ? (
        <Notice tone={optimizeMessage.tone} title={optimizeMessage.title}>
          {optimizeMessage.text}
        </Notice>
      ) : null}

      <ol className="space-y-2" aria-label="Ordinea opririlor">
        {stops.map((stop, index) => (
          <li
            key={stop.comanda.id}
            className="flex min-h-[68px] items-center gap-3 rounded-box border border-border bg-surface px-3 py-2"
          >
            <span
              className={cn(
                'flex size-11 shrink-0 items-center justify-center rounded-full bg-primary font-extrabold text-primary-contrast',
                kitText.base,
              )}
              aria-hidden
            >
              {index + 1}
            </span>
            <span className="flex min-w-0 flex-1 flex-col">
              <span className={cn('truncate font-bold text-fg', kitText.base)}>{stop.name}</span>
              <span className={cn('truncate text-fg-muted', kitText.secondary)}>
                {[localitateScurta(stop.comanda.locatie_livrare), formatKg(stop.comanda.cantitate_kg), stop.location ? null : 'fără locație']
                  .filter(Boolean)
                  .join(' · ')}
              </span>
            </span>
            <span className="flex shrink-0 gap-1.5">
              <ArrowButton
                label={`Mută mai sus: ${stop.name}`}
                disabled={index === 0}
                onClick={() => onMove(stop.comanda.id, -1)}
              >
                <ArrowUp aria-hidden />
              </ArrowButton>
              <ArrowButton
                label={`Mută mai jos: ${stop.name}`}
                disabled={index === stops.length - 1}
                onClick={() => onMove(stop.comanda.id, 1)}
              >
                <ArrowDown aria-hidden />
              </ArrowButton>
            </span>
          </li>
        ))}
      </ol>

      <Button type="button" variant="primary" size="touch-lg" className="w-full" onClick={onDone}>
        <Check aria-hidden />
        Gata
      </Button>
    </div>
  )
}

function ArrowButton({
  label,
  disabled,
  onClick,
  children,
}: {
  label: string
  disabled: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        'flex size-12 items-center justify-center rounded-control border-2 border-border-strong bg-surface text-fg transition-transform active:scale-95 disabled:cursor-not-allowed disabled:opacity-35 disabled:active:scale-100 [&_svg]:size-6',
        kitFocus,
      )}
    >
      {children}
    </button>
  )
}
