'use client'

import { AppCard } from '@/components/ui/app-card'
import type { ConformitateMetrici } from '@/lib/tratamente/conformitate'

interface CupruAplicareItem {
  data: string
  id: string
  produs: string
}

interface CupruCumulatCardProps {
  aplicariCuCupru: CupruAplicareItem[]
  metrici: ConformitateMetrici
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat('ro-RO', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(value)
}

function getToneClasses(level: ConformitateMetrici['cupruAlertLevel']): string {
  if (level === 'exceeded') return 'bg-[var(--status-danger-text)]'
  if (level === 'warning') return 'bg-[var(--status-warning-text)]'
  return 'bg-[var(--status-success-text)]'
}

export function CupruCumulatCard({ aplicariCuCupru, metrici }: CupruCumulatCardProps) {
  const progress = Math.max(0, Math.min((metrici.cupruKgHa / 4) * 100, 100))
  const visibleRows = aplicariCuCupru.slice(0, 3)
  const hiddenCount = Math.max(aplicariCuCupru.length - visibleRows.length, 0)

  return (
    <AppCard className="rounded-2xl">
      <h3 className="text-base text-[var(--text-primary)] [font-weight:650]">Cupru metalic cumulat</h3>
      <p className="mt-3 text-3xl text-[var(--text-primary)] [font-weight:750]">{formatNumber(metrici.cupruKgHa)} kg/ha</p>

      <div className="mt-4 h-3 overflow-hidden rounded-full bg-[var(--surface-card-muted)]" aria-label="Progres cupru din limita UE">
        <div data-testid="cupru-progress" className={`h-full ${getToneClasses(metrici.cupruAlertLevel)}`} style={{ width: `${progress}%` }} />
      </div>

      <p className="mt-2 text-sm text-[var(--text-secondary)]">
        Limita UE: 4 kg/ha · Procent: {formatNumber(progress)}%
      </p>

      {metrici.cupruAlertLevel === 'exceeded' ? (
        <p className="mt-3 text-sm text-[var(--status-danger-text)]">Limită anuală de cupru depășită.</p>
      ) : null}

      <div className="mt-4 space-y-2 text-sm text-[var(--text-secondary)]">
        {visibleRows.length === 0 ? (
          <p>Nu există aplicări cu cupru în anul selectat.</p>
        ) : (
          visibleRows.map((item) => (
            <p key={item.id}>
              {item.produs} · {item.data}
            </p>
          ))
        )}
        {hiddenCount > 0 ? <p>{`+ ${hiddenCount} more`}</p> : null}
      </div>
    </AppCard>
  )
}

