'use client'

import { AppCard } from '@/components/ui/app-card'
import { getLabelRo, normalizeStadiu } from '@/lib/tratamente/stadii-canonic'

interface SumarStatisticiCardProps {
  anulate: number
  aplicate: number
  planActiv: string | null
  planificate: number
  stadiuCurent: string | null
  totalAplicari: number
}

function formatStage(value: string | null): string {
  if (!value) return 'N/A'
  const cod = normalizeStadiu(value)
  return cod ? getLabelRo(cod) : value
}

export function SumarStatisticiCard({
  anulate,
  aplicate,
  planActiv,
  planificate,
  stadiuCurent,
  totalAplicari,
}: SumarStatisticiCardProps) {
  return (
    <AppCard className="rounded-2xl">
      <h3 className="text-base text-[var(--text-primary)] [font-weight:650]">Sumar statistici</h3>

      <div className="mt-4 space-y-2 text-sm text-[var(--text-secondary)]">
        <p>Total aplicări: <span className="text-[var(--text-primary)] [font-weight:650]">{totalAplicari}</span></p>
        <p>Aplicate: {aplicate} · Planificate: {planificate} · Anulate: {anulate}</p>
        <p>Plan activ: {planActiv ?? 'N/A'}</p>
        <p>Stadiu curent: {formatStage(stadiuCurent)}</p>
      </div>
    </AppCard>
  )
}
