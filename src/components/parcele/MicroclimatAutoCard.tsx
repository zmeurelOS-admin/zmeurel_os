'use client'

import { CloudRain, CloudSun, Wind } from 'lucide-react'

import type { MeteoAutoSummary } from '@/components/parcele/ParcelePageClient'
import { cn } from '@/lib/utils'

interface MicroclimatAutoCardProps {
  summary: MeteoAutoSummary
  compact?: boolean
}

export function MicroclimatAutoCard({ summary, compact = false }: MicroclimatAutoCardProps) {
  return (
    <div
      className={cn(
        'rounded-xl border border-[var(--surface-divider)] bg-[var(--agri-surface-muted)]',
        compact ? 'p-2.5' : 'p-3'
      )}
    >
      <div className="flex items-center gap-2">
        <CloudSun className="h-3.5 w-3.5 text-[var(--agri-text-muted)]" aria-hidden />
        <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--agri-text-muted)]">
          Date automate
        </p>
      </div>
      {summary.state === 'ready' ? (
        <div className="mt-2 space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <div className="min-w-0 rounded-lg border border-[var(--surface-divider)] bg-[var(--agri-surface)] px-2.5 py-2">
              <p className="text-[11px] text-[var(--agri-text-muted)]">Temperatură</p>
              <p className="mt-0.5 text-sm font-semibold text-[var(--agri-text)] tabular-nums">
                {typeof summary.temperature === 'number' ? `${summary.temperature.toFixed(1)}°C` : '—'}
              </p>
            </div>
            <div className="min-w-0 rounded-lg border border-[var(--surface-divider)] bg-[var(--agri-surface)] px-2.5 py-2">
              <p className="text-[11px] text-[var(--agri-text-muted)]">Umiditate</p>
              <p className="mt-0.5 text-sm font-semibold text-[var(--agri-text)] tabular-nums">
                {typeof summary.humidity === 'number' ? `${Math.round(summary.humidity)}%` : '—'}
              </p>
            </div>
            <div className="min-w-0 rounded-lg border border-[var(--surface-divider)] bg-[var(--agri-surface)] px-2.5 py-2">
              <p className="flex items-center gap-1 text-[11px] text-[var(--agri-text-muted)]">
                <CloudRain className="h-3 w-3" aria-hidden />
                Ploaie (mâine)
              </p>
              <p className="mt-0.5 text-sm font-semibold text-[var(--agri-text)] tabular-nums">
                {typeof summary.rainChance === 'number' ? `${Math.round(summary.rainChance * 100)}%` : '—'}
              </p>
            </div>
            <div className="min-w-0 rounded-lg border border-[var(--surface-divider)] bg-[var(--agri-surface)] px-2.5 py-2">
              <p className="flex items-center gap-1 text-[11px] text-[var(--agri-text-muted)]">
                <Wind className="h-3 w-3" aria-hidden />
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
        <div className="mt-2 rounded-lg border border-[var(--surface-divider)] bg-[var(--agri-surface)] px-3 py-2 text-sm text-[var(--agri-text-muted)]">
          {summary.reason}
        </div>
      )}
    </div>
  )
}
