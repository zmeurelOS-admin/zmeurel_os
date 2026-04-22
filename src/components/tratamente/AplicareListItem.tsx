'use client'

import Link from 'next/link'
import { format, parseISO } from 'date-fns'
import { ro } from 'date-fns/locale'

import { getAplicareStatusLabel, getAplicareStatusTone } from '@/components/tratamente/aplicare-status'
import StatusBadge from '@/components/ui/StatusBadge'
import type { AplicareTratamentDetaliu } from '@/lib/supabase/queries/tratamente'
import type { ConfigurareSezon } from '@/lib/tratamente/configurare-sezon'
import { getCohortaLabel, getLabelStadiuContextual } from '@/lib/tratamente/configurare-sezon'
import { normalizeStadiu } from '@/lib/tratamente/stadii-canonic'

interface AplicareListItemProps {
  aplicare: AplicareTratamentDetaliu
  parcelaId: string
  configurareSezon?: ConfigurareSezon | null
}

const TIP_ACCENT: Record<string, string> = {
  fungicid: '#3B82F6',
  insecticid: '#F97316',
  acaricid: '#EAB308',
  ingrasamant_foliar: '#10B981',
  fertilizare_foliara: '#10B981',
  fertirigare: '#065F46',
}

function normalizeType(value: string | null | undefined): string {
  return value?.trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replaceAll(' ', '_') ?? ''
}

function getAccentColor(aplicare: AplicareTratamentDetaliu): string {
  const type = normalizeType(aplicare.produs?.tip)
  return TIP_ACCENT[type] ?? '#64748B'
}

function formatDoza(aplicare: AplicareTratamentDetaliu): string | null {
  if (typeof aplicare.doza_ml_per_hl === 'number') {
    return `${aplicare.doza_ml_per_hl} ml/hl`
  }

  if (typeof aplicare.doza_l_per_ha === 'number') {
    return `${aplicare.doza_l_per_ha} l/ha`
  }

  return null
}

function getProductName(aplicare: AplicareTratamentDetaliu): string {
  return aplicare.produs?.nume_comercial ?? aplicare.produs_nume_manual ?? 'Produs nespecificat'
}

function getTriggerLabel(aplicare: AplicareTratamentDetaliu, configurareSezon: ConfigurareSezon | null): string | null {
  const trigger = aplicare.linie?.stadiu_trigger ?? aplicare.stadiu_la_aplicare
  if (!trigger) return null
  const cod = normalizeStadiu(trigger)
  const cohort = aplicare.cohort_la_aplicare ?? aplicare.linie?.cohort_trigger ?? null
  return cod ? `la ${getLabelStadiuContextual(cod, configurareSezon, { cohort })}` : `la ${trigger}`
}

function getCohortLabel(aplicare: AplicareTratamentDetaliu): string | null {
  const cohorta = aplicare.cohort_la_aplicare
  return cohorta === 'floricane' || cohorta === 'primocane' ? `Pentru ${getCohortaLabel(cohorta)}` : null
}

export function AplicareListItem({
  aplicare,
  parcelaId,
  configurareSezon,
}: AplicareListItemProps) {
  const href = `/parcele/${parcelaId}/tratamente/aplicare/${aplicare.id}`
  const planificata = aplicare.data_planificata ?? aplicare.created_at
  const dateLabel = format(parseISO(planificata), 'EEEE, d MMM', { locale: ro })
  const doza = formatDoza(aplicare)
  const triggerLabel = getTriggerLabel(aplicare, configurareSezon ?? null)
  const cohortLabel = getCohortLabel(aplicare)
  const frac = aplicare.produs?.frac_irac?.trim() || null

  return (
    <Link
      href={href}
      className="block rounded-xl outline-none transition-transform duration-150 focus-visible:ring-[3px] focus-visible:ring-[color:color-mix(in_srgb,var(--agri-primary)_28%,transparent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--surface-page)] active:scale-[0.98]"
    >
      <article
        className="rounded-xl border border-[var(--border-default)] bg-[var(--surface-card)] p-4 shadow-[var(--shadow-soft)] transition-colors hover:bg-[var(--surface-card-elevated)]"
        style={{ borderLeftWidth: 4, borderLeftColor: getAccentColor(aplicare) }}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm font-medium capitalize text-[var(--text-primary)]">{dateLabel}</p>
          </div>
          <StatusBadge
            text={getAplicareStatusLabel(aplicare.status)}
            variant={getAplicareStatusTone(aplicare.status)}
          />
        </div>

        <div className="mt-2">
          <h3 className="text-base leading-tight text-[var(--text-primary)] [font-weight:650]">
            {getProductName(aplicare)}
          </h3>
          {doza ? <p className="mt-1 text-sm text-[var(--text-secondary)]">{doza}</p> : null}
        </div>

        {triggerLabel || cohortLabel || frac ? (
          <div className="mt-3 flex flex-wrap gap-2">
            {triggerLabel ? (
              <span className="inline-flex items-center rounded-full border border-[var(--border-default)] bg-[var(--surface-card-muted)] px-2.5 py-1 text-xs font-medium text-[var(--text-secondary)]">
                {triggerLabel}
              </span>
            ) : null}
            {cohortLabel ? (
              <span className="inline-flex items-center rounded-full border border-[var(--border-default)] bg-[var(--surface-card-muted)] px-2.5 py-1 text-xs font-medium text-[var(--text-secondary)]">
                {cohortLabel}
              </span>
            ) : null}
            {frac ? (
              <span className="inline-flex items-center rounded-full border border-[var(--border-default)] bg-[var(--surface-card-muted)] px-2.5 py-1 text-xs font-medium text-[var(--text-secondary)]">
                FRAC {frac}
              </span>
            ) : null}
          </div>
        ) : null}
      </article>
    </Link>
  )
}
