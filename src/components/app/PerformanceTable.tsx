'use client'

import { Trophy } from 'lucide-react'

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { cn } from '@/lib/utils'

export interface PerformanceRow {
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
        <div className="overflow-x-auto rounded-2xl border border-[var(--agri-border)] bg-[var(--agri-surface)] shadow-sm">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>Performer</TableHead>
                <TableHead className="text-right tabular-nums">Kg total</TableHead>
                <TableHead className="text-right tabular-nums">Kg / zi</TableHead>
                <TableHead className="text-right tabular-nums">Kg / ora</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedRows.map((row, index) => (
                <TableRow
                  key={row.id}
                  className={cn(
                    index === 0 &&
                      'bg-[var(--soft-warning-bg)] hover:bg-[var(--soft-warning-bg)]',
                  )}
                >
                  <TableCell>
                    <div className="inline-flex items-center gap-1.5 font-medium">
                      {index === 0 ? <Trophy className="h-4 w-4 text-[var(--soft-warning-text)]" aria-hidden /> : null}
                      {row.name}
                    </div>
                  </TableCell>
                  <TableCell className="text-right font-semibold tabular-nums">{formatNumber(row.kgTotal)}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatNumber(row.kgPerDay)}</TableCell>
                  <TableCell className="text-right tabular-nums text-[var(--agri-text-muted)]">
                    {row.kgPerHour && Number.isFinite(row.kgPerHour) ? formatNumber(row.kgPerHour) : '-'}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </section>
  )
}
