'use client'

import { BaseCard } from '@/components/app/BaseCard'

function formatKg(value: number) {
  return `${value.toFixed(1)} kg`
}

interface ProductieAziCardProps {
  cal1Kg: number
  cal2Kg: number
  totalKg: number
}

export function ProductieAziCard({ cal1Kg, cal2Kg, totalKg }: ProductieAziCardProps) {
  const rows = [
    { key: 'cal1', label: 'Cal1', value: formatKg(cal1Kg) },
    { key: 'cal2', label: 'Cal2', value: formatKg(cal2Kg) },
    { key: 'total', label: 'Total kg', value: formatKg(totalKg) },
  ]

  return (
    <BaseCard className="min-h-[196px]">
      <div className="space-y-3">
        <h3 className="text-base font-semibold text-[var(--agri-text)]">Producție azi</h3>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4">
          {rows.map((row) => (
            <div
              key={row.key}
              className="rounded-xl border border-[var(--agri-border)] bg-[var(--agri-surface-muted)] px-3 py-2.5"
            >
              <p className="text-xs text-[var(--agri-text-muted)]">{row.label}</p>
              <p className="mt-1 text-sm font-semibold text-[var(--agri-text)]">
                <span className="value-kg">{row.value}</span>
              </p>
            </div>
          ))}
        </div>
      </div>
    </BaseCard>
  )
}
