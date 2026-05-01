'use client'

import { CloudRain, CloudSun, Wind } from 'lucide-react'

import type { MeteoAutoSummary } from '@/components/parcele/ParcelePageClient'
import { cn } from '@/lib/utils'

interface MicroclimatAutoCardProps {
  summary: MeteoAutoSummary
  compact?: boolean
  /** `clean` = fundal alb / mini-carduri albe (ex. desktop inspector); implicit păstrează stilul existent. */
  surfaceTone?: 'muted' | 'clean'
}

export function MicroclimatAutoCard({ summary, compact = false, surfaceTone = 'muted' }: MicroclimatAutoCardProps) {
  const clean = surfaceTone === 'clean'
  return (
    <div
      className={cn(
        'rounded-lg border border-[var(--surface-divider)]',
        clean ? 'bg-white' : 'bg-[var(--agri-surface-muted)]',
        compact ? 'p-2.5' : 'p-3',
      )}
    >
      <div className="flex items-center gap-2">
        <CloudSun className={cn('h-3.5 w-3.5', clean ? 'text-[var(--pill-active-border)]' : 'text-[var(--agri-text-muted)]')} aria-hidden />
        <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--agri-text-muted)]">
          Date automate
        </p>
      </div>
      {summary.state === 'ready' ? (
        <div className="mt-2 space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <div
              className={cn(
                'min-w-0 rounded-md border border-[var(--surface-divider)] px-2.5 py-1.5',
                clean ? 'bg-white shadow-[0_1px_2px_rgba(12,15,19,0.04)]' : 'bg-[var(--agri-surface)]',
              )}
            >
              <p className="text-[11px] text-[var(--agri-text-muted)]">Temperatură</p>
              <p className="mt-0.5 text-sm font-semibold text-[var(--agri-text)] tabular-nums">
                {typeof summary.temperature === 'number' ? `${summary.temperature.toFixed(1)}°C` : '—'}
              </p>
            </div>
            <div
              className={cn(
                'min-w-0 rounded-md border border-[var(--surface-divider)] px-2.5 py-1.5',
                clean ? 'bg-white shadow-[0_1px_2px_rgba(12,15,19,0.04)]' : 'bg-[var(--agri-surface)]',
              )}
            >
              <p className="text-[11px] text-[var(--agri-text-muted)]">Umiditate</p>
              <p className="mt-0.5 text-sm font-semibold text-[var(--agri-text)] tabular-nums">
                {typeof summary.humidity === 'number' ? `${Math.round(summary.humidity)}%` : '—'}
              </p>
            </div>
            <div
              className={cn(
                'min-w-0 rounded-md border border-[var(--surface-divider)] px-2.5 py-1.5',
                clean ? 'bg-white shadow-[0_1px_2px_rgba(12,15,19,0.04)]' : 'bg-[var(--agri-surface)]',
              )}
            >
              <p className="flex items-center gap-1 text-[11px] text-[var(--agri-text-muted)]">
                <CloudRain className={cn('h-3 w-3', clean && 'text-[var(--pill-active-border)]')} aria-hidden />
                Ploaie (mâine)
              </p>
              <p className="mt-0.5 text-sm font-semibold text-[var(--agri-text)] tabular-nums">
                {typeof summary.rainChance === 'number' ? `${Math.round(summary.rainChance * 100)}%` : '—'}
              </p>
            </div>
            <div
              className={cn(
                'min-w-0 rounded-md border border-[var(--surface-divider)] px-2.5 py-1.5',
                clean ? 'bg-white shadow-[0_1px_2px_rgba(12,15,19,0.04)]' : 'bg-[var(--agri-surface)]',
              )}
            >
              <p className="flex items-center gap-1 text-[11px] text-[var(--agri-text-muted)]">
                <Wind className={cn('h-3 w-3', clean && 'text-[var(--pill-active-border)]')} aria-hidden />
                Vânt
              </p>
              <p className="mt-0.5 text-sm font-semibold text-[var(--agri-text)] tabular-nums">
                {typeof summary.wind === 'number' ? `${summary.wind.toFixed(1)} km/h` : '—'}
              </p>
            </div>
          </div>
          <p className="text-[11px] leading-snug text-[var(--agri-text-muted)]">
            Sursă: OpenWeather{summary.source ? ` (${summary.source})` : ''} · Sursă locație:{' '}
            {summary.locationSource === 'parcela' ? 'parcelă selectată' : 'fermă (fallback)'}
            {summary.locationLabel ? ` (${summary.locationLabel})` : ''} ·{' '}
            {summary.fetchedAt
              ? `actualizat la ${new Date(summary.fetchedAt).toLocaleString('ro-RO', {
                  day: '2-digit',
                  month: 'short',
                  hour: '2-digit',
                  minute: '2-digit',
                })}`
              : 'actualizare indisponibilă'}
          </p>
          {!compact ? (
            <p className="text-[11px] leading-snug text-[var(--agri-text-muted)]">
              Date automate estimative la nivel de locație; observațiile din solar rămân în `Date manuale`.
            </p>
          ) : null}
        </div>
      ) : (
        <div
          className={cn(
            'mt-2 rounded-lg border border-[var(--surface-divider)] px-3 py-2 text-sm text-[var(--agri-text-muted)]',
            clean ? 'bg-white' : 'bg-[var(--agri-surface)]',
          )}
        >
          {summary.reason}
        </div>
      )}
    </div>
  )
}
