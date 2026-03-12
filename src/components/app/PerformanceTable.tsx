'use client'

import { Trophy } from 'lucide-react'

interface PerformanceRow {
  id: string
  name: string
  kgTotal: number
  kgPerDay: number
  kgPerHour?: number | null
}

interface PerformanceTableProps {
  title: string
  rows: PerformanceRow[]
}

function formatNumber(value: number) {
  return new Intl.NumberFormat('ro-RO', {
    maximumFractionDigits: 2,
  }).format(value)
}

export function PerformanceTable({ title, rows }: PerformanceTableProps) {
  const sortedRows = [...rows].sort((a, b) => b.kgTotal - a.kgTotal)

  return (
    <section className="agri-card space-y-3 p-4 sm:p-5">
      <h3 className="text-base font-semibold text-[var(--agri-text)]">{title}</h3>

      {sortedRows.length === 0 ? (
        <p className="text-sm font-medium text-[var(--agri-text-muted)]">Nu există date pentru perioada selectată.</p>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-[var(--agri-border)]">
          <table className="w-full text-sm">
            <thead className="bg-[var(--agri-surface-muted)]">
              <tr>
                <th className="px-3 py-2 text-left font-semibold text-[var(--agri-text-muted)]">Performer</th>
                <th className="px-3 py-2 text-right font-semibold text-[var(--agri-text-muted)]">Kg total</th>
                <th className="px-3 py-2 text-right font-semibold text-[var(--agri-text-muted)]">Kg / zi</th>
                <th className="px-3 py-2 text-right font-semibold text-[var(--agri-text-muted)]">Kg / ora</th>
              </tr>
            </thead>
            <tbody>
              {sortedRows.map((row, index) => (
                <tr
                  key={row.id}
                  className={index === 0 ? 'bg-amber-50' : 'border-t border-[var(--agri-border)]'}
                >
                  <td className="px-3 py-2 font-medium text-[var(--agri-text)]">
                    <div className="inline-flex items-center gap-1.5">
                      {index === 0 ? <Trophy className="h-4 w-4 text-amber-600" /> : null}
                      {row.name}
                    </div>
                  </td>
                  <td className="px-3 py-2 text-right font-semibold text-[var(--agri-text)]">{formatNumber(row.kgTotal)}</td>
                  <td className="px-3 py-2 text-right text-[var(--agri-text)]">{formatNumber(row.kgPerDay)}</td>
                  <td className="px-3 py-2 text-right text-[var(--agri-text)]">
                    {row.kgPerHour && Number.isFinite(row.kgPerHour) ? formatNumber(row.kgPerHour) : '-'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}

export type { PerformanceRow }
