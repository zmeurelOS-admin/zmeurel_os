'use client'

import { useEffect } from 'react'
import { format, parseISO } from 'date-fns'
import { ro } from 'date-fns/locale'
import { Bug } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { AppCard } from '@/components/ui/app-card'
import type { SelectorCapcanaActivaItem } from '@/components/tratamente/SelectorCapcaneActiveSheet'
import { cn } from '@/lib/utils'

type ParcelaTratamenteCapcaneCompactProps = {
  capcane: SelectorCapcanaActivaItem[]
  error: string | null
  loading: boolean
  onMountCapcana: () => void
  onRetry: () => void
  onVerifyCapcana: () => void
}

function formatCapcanaDate(value: string | null | undefined): string {
  if (!value) return '—'
  try {
    return format(parseISO(value), 'd MMM', { locale: ro })
  } catch {
    return value.slice(0, 10)
  }
}

export function ParcelaTratamenteCapcaneCompact({
  capcane,
  error,
  loading,
  onMountCapcana,
  onRetry,
  onVerifyCapcana,
}: ParcelaTratamenteCapcaneCompactProps) {
  useEffect(() => {
    onRetry()
  }, [onRetry])

  return (
    <section className="space-y-2" aria-labelledby="capcane-monitor-label">
      <div className="flex items-center justify-between gap-2">
        <p
          id="capcane-monitor-label"
          className="text-[11px] font-bold uppercase tracking-[0.06em] text-[var(--text-secondary)]"
        >
          Capcane montate
        </p>
        <Button type="button" variant="ghost" size="sm" className="h-8 text-xs" onClick={onMountCapcana}>
          Montare
        </Button>
      </div>

      <AppCard className="rounded-2xl p-3">
        {loading ? (
          <p className="text-sm text-[var(--text-secondary)]">Se încarcă capcanele…</p>
        ) : error ? (
          <div className="space-y-2">
            <p className="text-sm text-[var(--status-danger-text)]">{error}</p>
            <Button type="button" variant="outline" size="sm" onClick={onRetry}>
              Reîncearcă
            </Button>
          </div>
        ) : capcane.length === 0 ? (
          <div className="flex items-start gap-2.5">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[var(--surface-card-muted)] text-[var(--text-secondary)]">
              <Bug className="h-4 w-4" aria-hidden />
            </div>
            <p className="text-sm text-[var(--text-secondary)]">
              Nu ai capcane active pe această parcelă. Poți monta capcane noi din acțiunile de mai sus.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {capcane.slice(0, 4).map((capcana) => (
              <div
                key={capcana.id}
                className={cn(
                  'flex items-center justify-between gap-2 rounded-xl border border-[var(--border-default)] bg-[var(--surface-card-muted)] px-3 py-2'
                )}
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-[var(--text-primary)]">{capcana.tipCapcana}</p>
                  <p className="text-xs text-[var(--text-secondary)]">
                    {capcana.nrBucati} buc. · montată {formatCapcanaDate(capcana.dataMontare)}
                  </p>
                </div>
                <p className="shrink-0 text-[11px] font-medium text-[var(--text-secondary)]">
                  Verificare {formatCapcanaDate(capcana.dataUrmatoareaVerificare)}
                </p>
              </div>
            ))}
            {capcane.length > 4 ? (
              <p className="text-xs text-[var(--text-secondary)]">+{capcane.length - 4} capcane active</p>
            ) : null}
          </div>
        )}

      </AppCard>
    </section>
  )
}
