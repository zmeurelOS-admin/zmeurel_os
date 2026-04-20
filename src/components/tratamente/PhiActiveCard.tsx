'use client'

import { AppCard } from '@/components/ui/app-card'

interface PhiActiveItem {
  aplicareId: string
  dataAplicata: string
  dataSigura: string
  phiZile: number
  produs: string
  zileTrecute: number
}

interface PhiActiveCardProps {
  items: PhiActiveItem[]
}

function clamp(value: number): number {
  return Math.max(0, Math.min(value, 100))
}

export function PhiActiveCard({ items }: PhiActiveCardProps) {
  return (
    <AppCard className="rounded-2xl">
      <h3 className="text-base text-[var(--text-primary)] [font-weight:650]">Perioade PHI active</h3>

      {items.length === 0 ? (
        <p className="mt-4 text-sm text-[var(--text-secondary)]">Nicio restricție PHI activă.</p>
      ) : (
        <div className="mt-4 space-y-4">
          {items.map((item) => {
            const percent = clamp((item.zileTrecute / item.phiZile) * 100)

            return (
              <div key={item.aplicareId} className="space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                  <p className="text-[var(--text-primary)] [font-weight:650]">{item.produs}</p>
                  <p className="text-[var(--text-secondary)]">{item.dataAplicata}</p>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-[var(--surface-card-muted)]">
                  <div className="h-full bg-[var(--status-warning-text)]" style={{ width: `${percent}%` }} />
                </div>
                <p className="text-xs text-[var(--text-secondary)]">
                  Ziua {Math.max(item.zileTrecute, 0)}/{item.phiZile} · sigur pentru recoltare din {item.dataSigura}
                </p>
              </div>
            )
          })}
        </div>
      )}
    </AppCard>
  )
}

