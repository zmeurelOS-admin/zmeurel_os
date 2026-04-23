'use client'

import { format, parseISO } from 'date-fns'
import { ro } from 'date-fns/locale'

import StatusBadge from '@/components/ui/StatusBadge'
import { AppCard } from '@/components/ui/app-card'
import { AplicareSourceBadge } from '@/components/tratamente/AplicareSourceBadge'
import {
  getAplicareContextLabel,
  getAplicareInterventieLabel,
  getAplicareProduseSummary,
} from '@/components/tratamente/aplicare-ui'
import type { AplicareTratamentDetaliu } from '@/lib/supabase/queries/tratamente'
import type { ConfigurareSezon } from '@/lib/tratamente/configurare-sezon'
import { getCohortaLabel, getLabelStadiuContextual } from '@/lib/tratamente/configurare-sezon'
import { normalizeStadiu } from '@/lib/tratamente/stadii-canonic'

function capitalizeLabel(value: string | null | undefined): string | null {
  if (!value) return null
  const normalized = value.replaceAll('_', ' ').trim()
  if (!normalized) return null
  return normalized.charAt(0).toUpperCase() + normalized.slice(1)
}

function getStatusTone(status: AplicareTratamentDetaliu['status']): 'success' | 'warning' | 'danger' | 'neutral' {
  if (status === 'aplicata') return 'success'
  if (status === 'reprogramata') return 'warning'
  if (status === 'anulata') return 'danger'
  return 'neutral'
}

function getStatusLabel(status: AplicareTratamentDetaliu['status']): string {
  if (status === 'aplicata') return 'Aplicată'
  if (status === 'reprogramata') return 'Reprogramată'
  if (status === 'anulata') return 'Anulată'
  return 'Planificată'
}

function getTypeLabel(aplicare: AplicareTratamentDetaliu): string {
  return capitalizeLabel(aplicare.produs?.tip) ?? 'Tip nespecificat'
}

function getDozaLabel(aplicare: AplicareTratamentDetaliu): string {
  if (typeof aplicare.doza_ml_per_hl === 'number') {
    return `${aplicare.doza_ml_per_hl} ml/hl`
  }

  if (typeof aplicare.doza_l_per_ha === 'number') {
    return `${aplicare.doza_l_per_ha} l/ha`
  }

  return '—'
}

function getPhiLabel(aplicare: AplicareTratamentDetaliu): string {
  if (typeof aplicare.produs?.phi_zile === 'number') {
    return `${aplicare.produs.phi_zile} zile`
  }

  return '—'
}

function getTriggerLabel(aplicare: AplicareTratamentDetaliu, configurareSezon: ConfigurareSezon | null): string {
  const trigger = aplicare.linie?.stadiu_trigger ?? aplicare.stadiu_la_aplicare
  if (!trigger) return '—'

  const cod = normalizeStadiu(trigger)
  const cohort = aplicare.cohort_la_aplicare ?? aplicare.linie?.cohort_trigger ?? null
  return cod ? `la ${getLabelStadiuContextual(cod, configurareSezon, { cohort })}` : `la ${trigger}`
}

function getCohortLabel(aplicare: AplicareTratamentDetaliu): string | null {
  const cohorta = aplicare.cohort_la_aplicare
  return cohorta === 'floricane' || cohorta === 'primocane' ? `Pentru ${getCohortaLabel(cohorta)}` : null
}

export interface AplicareHeroProps {
  aplicare: AplicareTratamentDetaliu
  configurareSezon?: ConfigurareSezon | null
}

export function AplicareHero({ aplicare, configurareSezon }: AplicareHeroProps) {
  const frac = aplicare.produs?.frac_irac?.trim()
  const cohortLabel = getCohortLabel(aplicare)
  const productsSummary = getAplicareProduseSummary(aplicare)
  const contextLabel = getAplicareContextLabel(aplicare)
  const appliedAt =
    aplicare.status === 'aplicata' && aplicare.data_aplicata
      ? format(parseISO(aplicare.data_aplicata), 'd MMM yyyy, HH:mm', { locale: ro })
      : null

  return (
    <AppCard className="rounded-2xl bg-[var(--surface-card)]">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm text-[var(--text-secondary)] [font-weight:650]">Intervenție</p>
          <h2 className="mt-1 text-[1.45rem] leading-tight text-[var(--text-primary)] [font-weight:750]">
            {productsSummary.title}
          </h2>
          {productsSummary.detail ? (
            <p className="mt-2 text-sm text-[var(--text-secondary)]">{productsSummary.detail}</p>
          ) : null}
          <p className="mt-2 text-sm text-[var(--text-secondary)]">{contextLabel}</p>
          <p className="mt-1 text-sm text-[var(--text-secondary)]">
            {getTypeLabel(aplicare)}
            {frac ? ` · FRAC ${frac}` : ''}
          </p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <StatusBadge text={getStatusLabel(aplicare.status)} variant={getStatusTone(aplicare.status)} />
          <AplicareSourceBadge source={aplicare.sursa ?? (aplicare.plan_linie_id ? 'din_plan' : 'manuala')} />
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-2 text-xs text-[var(--text-secondary)]">
        <span className="inline-flex items-center rounded-full border border-[var(--border-default)] bg-[var(--surface-card-muted)] px-2.5 py-1 font-medium">
          {getAplicareInterventieLabel(aplicare)}
        </span>
        <span className="inline-flex items-center rounded-full border border-[var(--border-default)] bg-[var(--surface-card-muted)] px-2.5 py-1 font-medium">
          {aplicare.parcela?.nume_parcela ?? 'Parcelă'}
        </span>
        {productsSummary.count > 1 ? (
          <span className="inline-flex items-center rounded-full border border-[var(--border-default)] bg-[var(--surface-card-muted)] px-2.5 py-1 font-medium">
            {productsSummary.count} produse
          </span>
        ) : null}
      </div>

      <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-4">
        <div className="rounded-xl bg-[var(--surface-card-muted)] px-3 py-3">
          <p className="text-xs uppercase tracking-[0.03em] text-[var(--text-secondary)]">Doză</p>
          <p className="mt-2 text-sm text-[var(--text-primary)] [font-weight:650]">{getDozaLabel(aplicare)}</p>
        </div>
        <div className="rounded-xl bg-[var(--surface-card-muted)] px-3 py-3">
          <p className="text-xs uppercase tracking-[0.03em] text-[var(--text-secondary)]">PHI</p>
          <p className="mt-2 text-sm text-[var(--text-primary)] [font-weight:650]">{getPhiLabel(aplicare)}</p>
        </div>
        <div className="rounded-xl bg-[var(--surface-card-muted)] px-3 py-3">
          <p className="text-xs uppercase tracking-[0.03em] text-[var(--text-secondary)]">Fenofază</p>
          <p className="mt-2 text-sm text-[var(--text-primary)] [font-weight:650]">
            {getTriggerLabel(aplicare, configurareSezon ?? null)}
          </p>
        </div>
        <div className="rounded-xl bg-[var(--surface-card-muted)] px-3 py-3">
          <p className="text-xs uppercase tracking-[0.03em] text-[var(--text-secondary)]">Produse efective</p>
          <p className="mt-2 text-sm text-[var(--text-primary)] [font-weight:650]">
            {productsSummary.count > 1 ? `${productsSummary.count} în listă` : '1 produs'}
          </p>
        </div>
      </div>

      {cohortLabel ? (
        <div className="mt-3 inline-flex items-center rounded-full border border-[var(--border-default)] bg-[var(--surface-card-muted)] px-3 py-1.5 text-xs font-medium text-[var(--text-secondary)]">
          {cohortLabel}
        </div>
      ) : null}

      {aplicare.status === 'aplicata' && appliedAt ? (
        <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-[var(--status-success-bg)] px-4 py-3">
          <p className="text-sm text-[var(--text-secondary)]">
            Aplicată pe {appliedAt}
            {aplicare.operator ? ` · ${aplicare.operator}` : ''}
          </p>
          <StatusBadge text="Aplicată" variant="success" />
        </div>
      ) : null}
    </AppCard>
  )
}
