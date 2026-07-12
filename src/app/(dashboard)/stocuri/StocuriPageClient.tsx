'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'

import { AppShell } from '@/components/app/AppShell'
import { DashboardContentShell } from '@/components/app/DashboardContentShell'
import { ErrorState } from '@/components/app/ErrorState'
import { LoadingState } from '@/components/app/LoadingState'
import { PageHeader } from '@/components/app/PageHeader'
import { AjustareStocDialog } from '@/components/stocuri/AjustareStocDialog'
import { Button } from '@/components/ui/button'
import StatusBadge from '@/components/ui/StatusBadge'
import {
  STOCK_AUDIT_CRITICAL_STOCK_THRESHOLD_KG,
  STOCK_AUDIT_LOW_STOCK_THRESHOLD_KG,
} from '@/lib/calculations/stock-audit-thresholds'
import { queryKeys } from '@/lib/query-keys'
import {
  AJUSTARE_STOC_TIP_LABELS,
  getAjustariStoc,
  type AjustareStocTip,
} from '@/lib/supabase/queries/ajustari-stoc'
import { getSellableCal1StockSummary } from '@/lib/supabase/queries/miscari-stoc'

function formatKg(value: number): string {
  return new Intl.NumberFormat('ro-RO', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(Number(value || 0))
}

function formatDeltaKg(value: number): string {
  const formatted = new Intl.NumberFormat('ro-RO', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Math.abs(Number(value || 0)))
  return `${value >= 0 ? '+' : '−'}${formatted} kg`
}

function formatDataRo(value: string): string {
  const parsed = new Date(`${value.slice(0, 10)}T12:00:00`)
  return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleDateString('ro-RO')
}

function tipLabel(tip: string): string {
  return AJUSTARE_STOC_TIP_LABELS[tip as AjustareStocTip] ?? tip
}

function stockStatus(totalKg: number): { label: string; tone: 'success' | 'warning' | 'danger' } {
  if (totalKg <= 0) return { label: 'Gol', tone: 'danger' }
  if (totalKg < STOCK_AUDIT_CRITICAL_STOCK_THRESHOLD_KG) return { label: 'Critic', tone: 'danger' }
  if (totalKg < STOCK_AUDIT_LOW_STOCK_THRESHOLD_KG) return { label: 'Atenție', tone: 'warning' }
  return { label: 'OK', tone: 'success' }
}

function StockMetric({
  label,
  value,
  tone = 'default',
}: {
  label: string
  value: number
  tone?: 'default' | 'success' | 'warning'
}) {
  const toneClass =
    tone === 'success'
      ? 'text-[var(--status-success-text)]'
      : tone === 'warning'
        ? 'text-[var(--status-warning-text)]'
        : 'text-[var(--text-primary)]'

  return (
    <div className="rounded-[18px] bg-[var(--surface-card)] p-4 shadow-[var(--shadow-soft)]">
      <p className="text-sm font-semibold text-[var(--text-secondary)]">{label}</p>
      <p className={`mt-2 text-2xl tabular-nums [font-weight:750] ${toneClass}`}>
        {formatKg(value)} kg
      </p>
    </div>
  )
}

export function StocuriPageClient() {
  const [ajustareOpen, setAjustareOpen] = useState(false)

  const {
    data: summary,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: queryKeys.stocGlobalCal1,
    queryFn: getSellableCal1StockSummary,
  })

  const ajustariQuery = useQuery({
    queryKey: queryKeys.ajustariStoc,
    queryFn: getAjustariStoc,
    staleTime: 30000,
    refetchOnWindowFocus: false,
  })
  const ajustari = ajustariQuery.data ?? []

  const disponibil = summary?.disponibilCal1Kg ?? 0
  const status = stockStatus(disponibil)

  return (
    <AppShell header={<PageHeader title="Stocuri" subtitle="Pool vandabil cal. I" />}>
      <DashboardContentShell variant="centered">
        {isLoading ? <LoadingState label="Încărcăm stocul..." /> : null}

        {isError ? (
          <ErrorState
            title="Nu am putut încărca stocul"
            message={error instanceof Error ? error.message : 'Încearcă din nou.'}
            onRetry={() => void refetch()}
          />
        ) : null}

        {!isLoading && !isError && summary ? (
          <div className="space-y-5 pb-[calc(env(safe-area-inset-bottom)+24px)]">
            <section className="rounded-[22px] bg-[var(--surface-card)] p-5 shadow-[var(--shadow-soft)]">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-[var(--text-secondary)]">Zmeură cal. I</p>
                  <h2 className="mt-2 text-4xl leading-none text-[var(--text-primary)] [font-weight:750]">
                    {formatKg(disponibil)} kg
                  </h2>
                  <p className="mt-2 text-sm text-[var(--text-secondary)]">
                    Disponibil pentru comenzi, calculat din recoltări, comenzi și ajustări.
                  </p>
                </div>
                <StatusBadge text={status.label} variant={status.tone} />
              </div>
              <div className="mt-4">
                <Button type="button" onClick={() => setAjustareOpen(true)}>
                  Ajustează stocul
                </Button>
              </div>
            </section>

            <section className="grid gap-3 md:grid-cols-3">
              <StockMetric label="Recoltat cal. I" value={summary.recoltatCal1Kg} tone="success" />
              <StockMetric label="Livrat" value={summary.consumatDefinitivCal1Kg} />
              <StockMetric label="În livrare" value={summary.rezervatActivCal1Kg} tone="warning" />
            </section>

            <section className="rounded-[22px] bg-[var(--surface-card)] p-5 shadow-[var(--shadow-soft)]">
              <h3 className="text-sm font-semibold text-[var(--text-secondary)]">Istoric ajustări</h3>
              {ajustariQuery.isError ? (
                <p className="mt-3 text-sm text-[var(--status-danger-text)]">
                  Nu am putut încărca istoricul ajustărilor.
                </p>
              ) : null}
              {!ajustariQuery.isError && ajustari.length === 0 ? (
                <p className="mt-3 text-sm text-[var(--text-secondary)]">
                  Nicio ajustare încă. Folosește „Ajustează stocul” pentru congelat, procesat, pierderi sau consum
                  propriu.
                </p>
              ) : null}
              {ajustari.length > 0 ? (
                <ul className="mt-3 divide-y divide-[var(--surface-divider)]">
                  {ajustari.map((ajustare) => (
                    <li key={ajustare.id} className="flex items-start justify-between gap-3 py-3">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-[var(--text-primary)]">
                          {tipLabel(ajustare.tip)}
                        </p>
                        <p className="text-xs text-[var(--text-secondary)]">
                          {formatDataRo(ajustare.data)}
                          {ajustare.motiv ? ` • ${ajustare.motiv}` : ''}
                        </p>
                      </div>
                      <span
                        className={`shrink-0 text-sm font-semibold tabular-nums ${
                          ajustare.delta_kg >= 0
                            ? 'text-[var(--status-success-text)]'
                            : 'text-[var(--status-danger-text)]'
                        }`}
                      >
                        {formatDeltaKg(ajustare.delta_kg)}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : null}
            </section>

            <section className="rounded-[18px] bg-[var(--surface-card-muted)] p-4 text-sm leading-relaxed text-[var(--text-secondary)]">
              Stocul este afișat ca total pe fermă. Detalierea pe parcelă sau pe mișcări istorice nu mai este sursa de
              adevăr pentru disponibilul vandabil.
            </section>
          </div>
        ) : null}
      </DashboardContentShell>

      <AjustareStocDialog open={ajustareOpen} onOpenChange={setAjustareOpen} disponibilKg={disponibil} />
    </AppShell>
  )
}
