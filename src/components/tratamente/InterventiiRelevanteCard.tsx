'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import { CalendarClock, CheckCircle2, Clock3, Sprout, TriangleAlert } from 'lucide-react'
import { format, parseISO } from 'date-fns'
import { ro } from 'date-fns/locale'

import { AppCard } from '@/components/ui/app-card'
import { Button } from '@/components/ui/button'
import type {
  InterventieRelevantaV2,
  InterventieStatusOperational,
} from '@/lib/supabase/queries/tratamente'
import type { ConfigurareSezon } from '@/lib/tratamente/configurare-sezon'
import { getCohortaLabel, getLabelStadiuContextual } from '@/lib/tratamente/configurare-sezon'
import { normalizeStadiu } from '@/lib/tratamente/stadii-canonic'
import { cn } from '@/lib/utils'

interface InterventiiRelevanteCardProps {
  configurareSezon?: ConfigurareSezon | null
  description?: string
  interventii: InterventieRelevantaV2[]
  onPlanifica?: (interventie: InterventieRelevantaV2) => void
  pendingInterventieId?: string | null
  showParcela?: boolean
  showFilters?: boolean
  title?: string
}

const STATUS_META: Record<InterventieStatusOperational, {
  label: string
  className: string
  icon: typeof Clock3
}> = {
  de_facut_azi: {
    label: 'De făcut acum',
    className: 'border-[var(--status-success-border)] bg-[var(--status-success-bg)] text-[var(--status-success-text)]',
    icon: CheckCircle2,
  },
  intarziata: {
    label: 'Întârziată',
    className: 'border-[var(--status-danger-border)] bg-[var(--status-danger-bg)] text-[var(--status-danger-text)]',
    icon: TriangleAlert,
  },
  urmeaza: {
    label: 'Urmează',
    className: 'border-[var(--status-warning-border)] bg-[var(--status-warning-bg)] text-[var(--status-warning-text)]',
    icon: CalendarClock,
  },
  completata_pentru_moment: {
    label: 'Completată momentan',
    className: 'border-[var(--border-default)] bg-[var(--surface-card-muted)] text-[var(--text-secondary)]',
    icon: CheckCircle2,
  },
  neaplicabila_fara_stadiu: {
    label: 'Lipsește fenofaza',
    className: 'border-[var(--border-default)] bg-[var(--surface-card-muted)] text-[var(--text-secondary)]',
    icon: Sprout,
  },
}

function formatDate(value: string | null): string | null {
  if (!value) return null
  try {
    return format(parseISO(value), 'd MMM yyyy', { locale: ro })
  } catch {
    return value
  }
}

function getStageLabel(
  interventie: InterventieRelevantaV2,
  configurareSezon: ConfigurareSezon | null
): string {
  const stadiu = interventie.fenofaza_curenta?.stadiu ?? normalizeStadiu(interventie.interventie.stadiu_trigger)
  if (!stadiu) return 'Fără fenofază'
  return getLabelStadiuContextual(stadiu, configurareSezon, {
    cohort: interventie.fenofaza_curenta?.cohort ?? interventie.interventie.cohort_trigger ?? null,
  })
}

function getProductLabel(interventie: InterventieRelevantaV2): string {
  const first = interventie.produse_planificate[0]
  const name = first?.produs?.nume_comercial ?? first?.produs_nume_snapshot ?? first?.produs_nume_manual
  if (!name) return 'Intervenție fără produs'
  return interventie.produse_planificate.length > 1 ? `${name} +${interventie.produse_planificate.length - 1}` : name
}

function getInterventieKey(interventie: InterventieRelevantaV2): string {
  return `${interventie.parcela_id}:${interventie.interventie.id}:${interventie.fenofaza_curenta?.cohort ?? 'single'}`
}

export function InterventiiRelevanteCard({
  configurareSezon,
  description = 'Intervențiile din plan care se potrivesc cu fenofaza observată pe parcelă.',
  interventii,
  onPlanifica,
  pendingInterventieId,
  showParcela = false,
  showFilters = false,
  title = 'Intervenții relevante',
}: InterventiiRelevanteCardProps) {
  const [statusFilter, setStatusFilter] = useState<InterventieStatusOperational | 'all'>('all')
  const [stageFilter, setStageFilter] = useState('all')
  const [tipFilter, setTipFilter] = useState('all')

  const stageOptions = useMemo(() => {
    const values = new Map<string, string>()
    for (const interventie of interventii) {
      const key = interventie.fenofaza_curenta?.stadiu ?? normalizeStadiu(interventie.interventie.stadiu_trigger)
      if (!key) continue
      values.set(key, getStageLabel(interventie, configurareSezon ?? null))
    }
    return Array.from(values.entries()).sort((first, second) => first[1].localeCompare(second[1], 'ro'))
  }, [configurareSezon, interventii])

  const tipOptions = useMemo(() => {
    const values = new Set<string>()
    for (const interventie of interventii) {
      const value = interventie.interventie.tip_interventie?.trim()
      if (value) values.add(value)
    }
    return Array.from(values).sort((first, second) => first.localeCompare(second, 'ro'))
  }, [interventii])

  const visibleInterventii = useMemo(() => {
    return interventii.filter((interventie) => {
      if (statusFilter !== 'all' && interventie.status_operational !== statusFilter) return false
      const stadiu = interventie.fenofaza_curenta?.stadiu ?? normalizeStadiu(interventie.interventie.stadiu_trigger)
      if (stageFilter !== 'all' && stadiu !== stageFilter) return false
      if (tipFilter !== 'all' && interventie.interventie.tip_interventie !== tipFilter) return false
      return true
    })
  }, [interventii, stageFilter, statusFilter, tipFilter])

  return (
    <AppCard className="rounded-2xl bg-[var(--surface-card)] p-4 shadow-[var(--shadow-soft)]">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="text-xs uppercase tracking-[0.08em] text-[var(--text-secondary)]">Fenofază și plan</p>
          <h2 className="mt-1 text-base text-[var(--text-primary)] [font-weight:700]">{title}</h2>
          <p className="mt-1 text-sm text-[var(--text-secondary)]">{description}</p>
        </div>
        <span className="inline-flex w-fit rounded-full border border-[var(--border-default)] bg-[var(--surface-card-muted)] px-2.5 py-1 text-xs font-semibold text-[var(--text-secondary)]">
          {visibleInterventii.length}/{interventii.length}
        </span>
      </div>

      {showFilters && interventii.length > 0 ? (
        <div className="mt-4 grid gap-2 md:grid-cols-3">
          <select
            className="agri-control h-10 rounded-xl text-sm"
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value as InterventieStatusOperational | 'all')}
          >
            <option value="all">Toate statusurile</option>
            {Object.entries(STATUS_META).map(([value, meta]) => (
              <option key={value} value={value}>
                {meta.label}
              </option>
            ))}
          </select>
          <select
            className="agri-control h-10 rounded-xl text-sm"
            value={stageFilter}
            onChange={(event) => setStageFilter(event.target.value)}
          >
            <option value="all">Toate fenofazele</option>
            {stageOptions.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
          <select
            className="agri-control h-10 rounded-xl text-sm"
            value={tipFilter}
            onChange={(event) => setTipFilter(event.target.value)}
          >
            <option value="all">Toate tipurile</option>
            {tipOptions.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        </div>
      ) : null}

      {visibleInterventii.length === 0 ? (
        <div className="mt-4 rounded-2xl border border-dashed border-[var(--border-default)] bg-[var(--surface-card-muted)] p-4 text-sm text-[var(--text-secondary)]">
          {interventii.length === 0
            ? 'Nu există intervenții relevante pentru fenofaza curentă sau lipsește contextul fenologic.'
            : 'Nicio intervenție nu se potrivește filtrelor selectate.'}
        </div>
      ) : (
        <div className="mt-4 space-y-3">
          {visibleInterventii.map((interventie) => {
            const status = STATUS_META[interventie.status_operational]
            const StatusIcon = status.icon
            const key = getInterventieKey(interventie)
            const dueLabel = formatDate(interventie.urmatoarea_data_estimata)
            const lastLabel = formatDate(interventie.ultima_aplicare?.data_aplicata ?? interventie.ultima_aplicare?.data_planificata ?? null)
            const cohort = interventie.fenofaza_curenta?.cohort
            const canPlanifica = Boolean(
              onPlanifica &&
                !interventie.aplicare_planificata &&
                interventie.status_operational !== 'completata_pentru_moment' &&
                interventie.status_operational !== 'neaplicabila_fara_stadiu'
            )

            return (
              <article
                key={key}
                className="rounded-2xl border border-[var(--border-default)] bg-[var(--surface-card-muted)] p-3"
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={cn('inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold', status.className)}>
                        <StatusIcon className="mr-1 h-3.5 w-3.5" aria-hidden />
                        {status.label}
                      </span>
                      {showParcela ? (
                        <span className="text-xs font-semibold text-[var(--text-secondary)]">
                          {interventie.parcela_nume ?? interventie.parcela_cod ?? 'Parcelă'}
                        </span>
                      ) : null}
                    </div>
                    <h3 className="mt-2 text-base leading-tight text-[var(--text-primary)] [font-weight:700]">
                      {interventie.interventie.scop?.trim() || getProductLabel(interventie)}
                    </h3>
                    <p className="mt-1 text-sm text-[var(--text-secondary)]">
                      {getProductLabel(interventie)} · {getStageLabel(interventie, configurareSezon ?? null)}
                      {cohort ? ` · ${getCohortaLabel(cohort)}` : ''}
                    </p>
                    <p className="mt-2 text-sm text-[var(--text-secondary)]">{interventie.motiv}</p>
                    <div className="mt-2 flex flex-wrap gap-2 text-xs text-[var(--text-secondary)]">
                        {interventie.interventie.tip_interventie ? <span>Tip intervenție: {interventie.interventie.tip_interventie}</span> : null}
                      {dueLabel ? <span>Scadență: {dueLabel}</span> : null}
                      {lastLabel ? <span>Ultima aplicare: {lastLabel}</span> : null}
                      <span>Aplicări efectuate: {interventie.aplicari_efectuate_count}</span>
                      {interventie.regula_repetare === 'interval' && interventie.interval_repetare_zile ? (
                        <span>Interval: {interventie.interval_repetare_zile} zile</span>
                      ) : null}
                    </div>
                  </div>

                  <div className="flex shrink-0 flex-wrap gap-2 sm:justify-end">
                    {interventie.aplicare_planificata ? (
                      <Button type="button" size="sm" variant="outline" asChild>
                          <Link href={`/parcele/${interventie.parcela_id}/tratamente/aplicare/${interventie.aplicare_planificata.id}`}>
                          Vezi aplicarea
                        </Link>
                      </Button>
                    ) : null}
                    {canPlanifica ? (
                      <Button
                        type="button"
                        size="sm"
                        className="bg-[var(--agri-primary)] text-white"
                        disabled={pendingInterventieId === key}
                        onClick={() => onPlanifica?.(interventie)}
                      >
                        {pendingInterventieId === key ? 'Se pregătește...' : 'Pregătește aplicare'}
                      </Button>
                    ) : null}
                  </div>
                </div>
              </article>
            )
          })}
        </div>
      )}
    </AppCard>
  )
}

export { getInterventieKey }
