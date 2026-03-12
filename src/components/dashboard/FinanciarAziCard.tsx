'use client'

import { BaseCard } from '@/components/app/BaseCard'

function formatCurrency(value: number) {
  return new Intl.NumberFormat('ro-RO', {
    style: 'currency',
    currency: 'RON',
    maximumFractionDigits: 0,
  }).format(value)
}

interface FinanciarAziCardProps {
  venit: number
  cheltuieli: number
  profit: number
}

export function FinanciarAziCard({ venit, cheltuieli, profit }: FinanciarAziCardProps) {
  const rows = [
    { key: 'venit', label: 'Venit', value: formatCurrency(venit), className: 'value-money-positive' },
    { key: 'cheltuieli', label: 'Cheltuieli', value: formatCurrency(cheltuieli), className: 'value-money-negative' },
    {
      key: 'profit',
      label: 'Profit',
      value: formatCurrency(profit),
      className: profit >= 0 ? 'value-money-positive' : 'value-money-negative',
    },
  ]

  return (
    <BaseCard className="min-h-[196px]">
      <div className="space-y-3">
        <h3 className="text-base font-semibold text-[var(--agri-text)]">Financiar azi</h3>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4">
          {rows.map((row) => (
            <div
              key={row.key}
              className="rounded-xl border border-[var(--agri-border)] bg-[var(--agri-surface-muted)] px-3 py-2.5"
            >
              <p className="text-xs text-[var(--agri-text-muted)]">{row.label}</p>
              <p className={`mt-1 text-sm font-semibold ${row.className}`}>{row.value}</p>
            </div>
          ))}
        </div>
      </div>
    </BaseCard>
  )
}
