'use client'

import { format, parseISO } from 'date-fns'
import { ro } from 'date-fns/locale'

import StatusBadge from '@/components/ui/StatusBadge'
import { AppCard } from '@/components/ui/app-card'
import type { AplicareTratamentDetaliu } from '@/lib/supabase/queries/tratamente'

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

function getProductName(aplicare: AplicareTratamentDetaliu): string {
  return aplicare.produs?.nume_comercial ?? aplicare.produs_nume_manual ?? 'Produs nespecificat'
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

function getTriggerLabel(aplicare: AplicareTratamentDetaliu): string {
  const trigger = aplicare.linie?.stadiu_trigger ?? aplicare.stadiu_la_aplicare
  return trigger ? `la ${trigger.replaceAll('_', ' ')}` : '—'
}

export interface AplicareHeroProps {
  aplicare: AplicareTratamentDetaliu
}

export function AplicareHero({ aplicare }: AplicareHeroProps) {
  const frac = aplicare.produs?.frac_irac?.trim()
  const appliedMeta =
    aplicare.status === 'aplicata' && aplicare.data_aplicata
      ? `Aplicată ${format(parseISO(aplicare.data_aplicata), 'd MMM yyyy, HH:mm', { locale: ro })}${aplicare.operator ? ` · ${aplicare.operator}` : ''}`
      : null

  return (
    <AppCard className="rounded-2xl bg-[var(--surface-card)]">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm text-[var(--text-secondary)] [font-weight:650]">Produs</p>
          <h2 className="mt-1 text-[1.45rem] leading-tight text-[var(--text-primary)] [font-weight:750]">
            {getProductName(aplicare)}
          </h2>
          <p className="mt-2 text-sm text-[var(--text-secondary)]">
            {getTypeLabel(aplicare)}
            {frac ? ` · FRAC ${frac}` : ''}
          </p>
          {appliedMeta ? (
            <p className="mt-2 text-sm text-[var(--text-secondary)]">{appliedMeta}</p>
          ) : null}
        </div>
        <StatusBadge text={getStatusLabel(aplicare.status)} variant={getStatusTone(aplicare.status)} />
      </div>

      <div className="mt-5 grid grid-cols-3 gap-3">
        <div className="rounded-xl bg-[var(--surface-card-muted)] px-3 py-3">
          <p className="text-xs uppercase tracking-[0.03em] text-[var(--text-secondary)]">Doză</p>
          <p className="mt-2 text-sm text-[var(--text-primary)] [font-weight:650]">{getDozaLabel(aplicare)}</p>
        </div>
        <div className="rounded-xl bg-[var(--surface-card-muted)] px-3 py-3">
          <p className="text-xs uppercase tracking-[0.03em] text-[var(--text-secondary)]">PHI</p>
          <p className="mt-2 text-sm text-[var(--text-primary)] [font-weight:650]">{getPhiLabel(aplicare)}</p>
        </div>
        <div className="rounded-xl bg-[var(--surface-card-muted)] px-3 py-3">
          <p className="text-xs uppercase tracking-[0.03em] text-[var(--text-secondary)]">Stadiu</p>
          <p className="mt-2 text-sm text-[var(--text-primary)] [font-weight:650]">{getTriggerLabel(aplicare)}</p>
        </div>
      </div>
    </AppCard>
  )
}
