'use client'

import Link from 'next/link'

import { AppCard } from '@/components/ui/app-card'
import type { ConformitateMetrici } from '@/lib/tratamente/conformitate'

interface ConformitateParcelaCardProps {
  an: number
  metrici: ConformitateMetrici
  parcela: {
    id: string
    id_parcela: string | null
    nume_parcela: string | null
    suprafata_m2: number | null
  }
}

function surfaceHa(value: number | null): string {
  if (typeof value !== 'number' || value <= 0) return 'N/A'
  return new Intl.NumberFormat('ro-RO', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(value / 10000)
}

function pillTone(metrici: ConformitateMetrici['cupruAlertLevel']): string {
  if (metrici === 'exceeded') return 'bg-[var(--status-danger-bg)] text-[var(--status-danger-text)]'
  if (metrici === 'warning') return 'bg-[var(--status-warning-bg)] text-[var(--status-warning-text)]'
  return 'bg-[var(--status-success-bg)] text-[var(--status-success-text)]'
}

export function ConformitateParcelaCard({ an, metrici, parcela }: ConformitateParcelaCardProps) {
  return (
    <AppCard className="rounded-2xl">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-base text-[var(--text-primary)] [font-weight:650]">{parcela.nume_parcela ?? 'Parcelă'}</h3>
          <p className="mt-1 text-sm text-[var(--text-secondary)]">
            {parcela.id_parcela ?? 'Fără cod'} · {surfaceHa(parcela.suprafata_m2)} ha
          </p>
        </div>
        <Link
          href={`/parcele/${parcela.id}/tratamente/calendar?an=${an}`}
          className="text-sm text-[var(--agri-primary)] underline-offset-4 hover:underline"
        >
          Detalii calendar
        </Link>
      </div>

      <div className="mt-4 flex flex-wrap gap-2 text-xs">
        <span className={`inline-flex items-center rounded-full px-2.5 py-1 [font-weight:650] ${pillTone(metrici.cupruAlertLevel)}`}>
          Cupru {metrici.cupruKgHa} kg/ha
        </span>
        <span className="inline-flex items-center rounded-full bg-[var(--surface-card-muted)] px-2.5 py-1 text-[var(--text-secondary)] [font-weight:650]">
          Violări FRAC: {metrici.fracViolatii}
        </span>
        <span className="inline-flex items-center rounded-full bg-[var(--surface-card-muted)] px-2.5 py-1 text-[var(--text-secondary)] [font-weight:650]">
          Total aplicări: {metrici.totalAplicari}
        </span>
      </div>
    </AppCard>
  )
}

