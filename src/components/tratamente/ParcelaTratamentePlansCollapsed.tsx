'use client'

import Link from 'next/link'
import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { addDays, format, formatISO, parseISO } from 'date-fns'
import { ro } from 'date-fns/locale'
import { ChevronDown, ClipboardList } from 'lucide-react'

import { planificaInterventieRelevantaAction } from '@/app/(dashboard)/parcele/[id]/tratamente/actions'
import { reprogrameazaAction } from '@/app/(dashboard)/parcele/[id]/tratamente/aplicari-actions'
import { markAplicataAction } from '@/app/(dashboard)/parcele/[id]/tratamente/aplicari-actions'
import { getInterventieKey } from '@/components/tratamente/InterventiiRelevanteCard'
import { EditAplicareButton } from '@/components/tratamente/EditAplicareButton'
import { InterventieRapidApplySheet } from '@/components/tratamente/InterventieRapidApplySheet'
import { MarkAplicataSheet, type MarkAplicataFormValues } from '@/components/tratamente/MarkAplicataSheet'
import { ParcelaPlanLiniiExpandable } from '@/components/tratamente/ParcelaPlanLiniiExpandable'
import type { StageState } from '@/components/tratamente/StadiuCurentCard'
import { AppCard } from '@/components/ui/app-card'
import { Button } from '@/components/ui/button'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import type {
  AplicareTratamentDetaliu,
  InterventieRelevantaV2,
  PlanActivParcela,
  PlanTratamentLinieCuProdus,
  ProdusFitosanitar,
  StadiuFenologicParcela,
} from '@/lib/supabase/queries/tratamente'
import type { Cohorta, ConfigurareSezon } from '@/lib/tratamente/configurare-sezon'
import { getCohortaLabel, getLabelStadiuContextual } from '@/lib/tratamente/configurare-sezon'
import { listStadiiPentruGrup, normalizeStadiu, type GrupBiologic } from '@/lib/tratamente/stadii-canonic'
import { cn } from '@/lib/utils'
import { toast } from '@/lib/ui/toast'
import { getAplicareStatusLabel } from '@/components/tratamente/aplicare-status'
import type { ParcelaTratamentePlansCollapsedProps } from '@/components/tratamente/parcela-tratamente-mobile-types'

function formatObservedShort(stadiuCurent: StadiuFenologicParcela): string {
  try {
    return format(parseISO(stadiuCurent.data_observata), 'd MMM yyyy', { locale: ro })
  } catch {
    return stadiuCurent.data_observata
  }
}

function formatAplicareDateShort(value: string | null | undefined): string {
  if (!value) return '—'
  try {
    return format(parseISO(value), 'd MMM', { locale: ro })
  } catch {
    return value
  }
}

function getTipInterventieMeta(interventie: InterventieRelevantaV2): { emoji: string; label: string } {
  const tip = (interventie.interventie.tip_interventie ?? '').toLowerCase()
  const scop = (interventie.interventie.scop ?? '').toLowerCase()
  if (tip.includes('nutri') || scop.includes('nutri')) return { emoji: '💧', label: 'nutriție' }
  return { emoji: '🛡', label: 'protecție' }
}

function getProductLine(interventie: InterventieRelevantaV2): string {
  const first = interventie.produse_planificate[0]
  const name = first?.produs?.nume_comercial ?? first?.produs_nume_snapshot ?? first?.produs_nume_manual
  if (!name) return '—'
  return interventie.produse_planificate.length > 1 ? `${name} +${interventie.produse_planificate.length - 1}` : name
}

function getInterventieTitle(interventie: InterventieRelevantaV2): string {
  if (interventie.interventie.scop?.trim()) return interventie.interventie.scop.trim()
  return getProductLine(interventie)
}

function cohortOf(interventie: InterventieRelevantaV2): Cohorta | null {
  const c = interventie.fenofaza_curenta?.cohort ?? interventie.interventie.cohort_trigger
  return c === 'floricane' || c === 'primocane' ? c : null
}

function matchesCohortFilter(interventie: InterventieRelevantaV2, filter: Cohorta | null) {
  if (!filter) return true
  return cohortOf(interventie) === filter
}

function normalizeCohortaValue(value: string | null | undefined): Cohorta | null {
  return value === 'floricane' || value === 'primocane' ? value : null
}

function CohortMiniCard(props: {
  active: boolean
  cohort: Cohorta
  configurareSezon: ConfigurareSezon | null
  grupBiologic?: GrupBiologic | null
  onClick: () => void
  onRecordCohort: () => void
  stage: StageState
}) {
  const { active, cohort, configurareSezon, grupBiologic, onClick, onRecordCohort, stage } = props
  const isFloricane = cohort === 'floricane'
  const emoji = isFloricane ? '🌸' : '🌱'
  const labelColor = isFloricane ? 'var(--agri-primary)' : 'var(--status-info-text)'
  const barColor = isFloricane ? 'var(--agri-primary)' : 'var(--status-info-text)'
  const stadiuCod = stage.stadiuCurent?.stadiu ?? null
  const codNorm = stadiuCod ? normalizeStadiu(stadiuCod) : null
  const numeFaza = codNorm ? getLabelStadiuContextual(codNorm, configurareSezon, { grupBiologic, cohort }) : '—'
  const bbchDisplay = codNorm && /^\d/.test(codNorm) ? codNorm : null
  const dataObs = stage.stadiuCurent ? formatObservedShort(stage.stadiuCurent) : '—'
  const urmCod = stage.stadiuUrmator ? normalizeStadiu(stage.stadiuUrmator) : null
  const urmatorLabel = urmCod ? getLabelStadiuContextual(urmCod, configurareSezon, { grupBiologic, cohort }) : '—'

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onClick()
        }
      }}
      className={cn(
        'min-w-0 flex-1 cursor-pointer rounded-xl border-2 p-2.5 text-left transition active:scale-[0.99]',
        active
          ? isFloricane
            ? 'border-[var(--agri-primary)] bg-[color:color-mix(in_srgb,var(--agri-primary)_10%,var(--surface-card))]'
            : 'border-[var(--status-info-text)] bg-[color:color-mix(in_srgb,var(--status-info-text)_10%,var(--surface-card))]'
          : 'border-[var(--border-default)] bg-[var(--surface-card)]',
      )}
    >
      <div className="flex items-start gap-1.5">
        <span className="text-lg leading-none" aria-hidden>
          {emoji}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-bold uppercase tracking-wide" style={{ color: labelColor }}>
            {getCohortaLabel(cohort)}
          </p>
          <p className="mt-0.5 line-clamp-2 text-sm font-bold text-[var(--text-primary)]">{numeFaza}</p>
          <p className="mt-0.5 text-[10px] text-[var(--text-tertiary)]">{bbchDisplay ? `BBCH ${bbchDisplay} · ${dataObs}` : dataObs}</p>
          <div className="mt-1.5 h-1 w-full overflow-hidden rounded-full bg-[var(--surface-card-muted)]">
            <div className="h-full rounded-full transition-all" style={{ width: `${stage.stadiuProgress}%`, background: barColor }} />
          </div>
          <p className="mt-1 line-clamp-2 text-[10px] text-[var(--text-secondary)]">
            Urmează: <span className="font-medium text-[var(--text-primary)]">{urmatorLabel}</span>
          </p>
          <button
            type="button"
            className="mt-1 text-left text-[10px] font-semibold text-[var(--agri-primary)]"
            onClick={(e) => {
              e.stopPropagation()
              onRecordCohort()
            }}
          >
            Înregistrează fenofază
          </button>
        </div>
      </div>
    </div>
  )
}

function SingleStageMiniCard(props: {
  configurareSezon: ConfigurareSezon | null
  grupBiologic?: GrupBiologic | null
  onRecord: () => void
  stage: StageState
}) {
  const { configurareSezon, grupBiologic, onRecord, stage } = props
  const stadiuCod = stage.stadiuCurent?.stadiu ?? null
  const codNorm = stadiuCod ? normalizeStadiu(stadiuCod) : null
  const numeFaza = codNorm ? getLabelStadiuContextual(codNorm, configurareSezon, { grupBiologic }) : 'Fără fenofază'
  const bbchDisplay = codNorm && /^\d/.test(codNorm) ? codNorm : null
  const dataObs = stage.stadiuCurent ? formatObservedShort(stage.stadiuCurent) : '—'
  const urmCod = stage.stadiuUrmator ? normalizeStadiu(stage.stadiuUrmator) : null
  const urmatorLabel = urmCod ? getLabelStadiuContextual(urmCod, configurareSezon, { grupBiologic }) : '—'

  if (!stage.stadiuCurent) {
    const stadiiStart = listStadiiPentruGrup(grupBiologic).slice(0, 2)
    const primaryStart = stadiiStart[0] ?? 'repaus_vegetativ'
    return (
      <AppCard className="rounded-xl border border-[var(--border-default)] p-3">
        <p className="text-xs font-bold text-[var(--text-primary)]">Fenofază</p>
        <p className="mt-1 text-sm text-[var(--text-secondary)]">Nu ai înregistrat încă nicio fenofază anul acesta.</p>
        <p className="mt-2 text-xs text-[var(--text-secondary)]">
          Începe cu{' '}
          <span className="font-medium">{getLabelStadiuContextual(primaryStart, configurareSezon, { grupBiologic })}</span>.
        </p>
        <Button type="button" size="sm" className="mt-3 w-full bg-[var(--agri-primary)] text-white" onClick={onRecord}>
          Înregistrează prima fenofază
        </Button>
      </AppCard>
    )
  }

  return (
    <div className="w-full rounded-xl border-2 border-[var(--border-default)] bg-[var(--surface-card)] p-2.5">
      <p className="text-[10px] font-bold uppercase tracking-wide text-[var(--agri-primary)]">Fenofază curentă</p>
      <p className="mt-0.5 text-sm font-bold text-[var(--text-primary)]">{numeFaza}</p>
      <p className="mt-0.5 text-[10px] text-[var(--text-tertiary)]">{bbchDisplay ? `BBCH ${bbchDisplay} · ${dataObs}` : dataObs}</p>
      <div className="mt-1.5 h-1 w-full overflow-hidden rounded-full bg-[var(--surface-card-muted)]">
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${stage.stadiuProgress}%`, background: 'var(--agri-primary)' }}
        />
      </div>
      <p className="mt-1 text-[10px] text-[var(--text-secondary)]">
        Urmează: <span className="font-medium text-[var(--text-primary)]">{urmatorLabel}</span>
      </p>
    </div>
  )
}

function ParcelaTratamentePlansCollapsedBody({
  an,
  aplicateCount,
  aplicariCount,
  configurareSezon,
  createPlanHref,
  detailsHref,
  dualStageState,
  editPlanHref,
  grupBiologic,
  interventiiRelevante,
  isRubusMixt,
  onAssignPlan,
  onPlanificaInterventie,
  onRecordStadiu,
  parcelaId,
  planLinii,
  planName,
  pendingInterventieId,
  planActiv,
  produseFitosanitare,
  singleStageState,
  urmatoareleAplicari,
}: ParcelaTratamentePlansCollapsedProps) {
  const router = useRouter()
  const [cohortFilter, setCohortFilter] = useState<Cohorta | null>(null)
  const [expandedKey, setExpandedKey] = useState<string | null>(null)
  const [rapidInterventie, setRapidInterventie] = useState<InterventieRelevantaV2 | null>(null)
  const [rapidOpen, setRapidOpen] = useState(false)
  const [applyLinie, setApplyLinie] = useState<PlanTratamentLinieCuProdus | null>(null)
  const [applyAplicareId, setApplyAplicareId] = useState<string | null>(null)
  const [applyOpen, setApplyOpen] = useState(false)
  const [isAmanaPending, startAmana] = useTransition()
  const [isApplyPending, startApplyTransition] = useTransition()
  const lockedApplyCohort: Cohorta | null =
    applyLinie?.cohort_trigger === 'floricane' || applyLinie?.cohort_trigger === 'primocane'
      ? applyLinie.cohort_trigger
      : null

  const summary = useMemo(() => {
    const intarziate = interventiiRelevante.filter((i) => i.status_operational === 'intarziata').length
    const azi = interventiiRelevante.filter((i) => i.status_operational === 'de_facut_azi').length
    const cuPlan = interventiiRelevante.filter((i) => i.aplicare_planificata).length
    const total = interventiiRelevante.length
    return { intarziate, azi, cuPlan, total }
  }, [interventiiRelevante])

  const filteredInterventii = useMemo(() => {
    return interventiiRelevante.filter((i) => matchesCohortFilter(i, cohortFilter))
  }, [cohortFilter, interventiiRelevante])

  const relevantLinieIds = useMemo(
    () => new Set(interventiiRelevante.map((item) => item.interventie.id)),
    [interventiiRelevante]
  )

  const handleApplyNowFromPlanLinie = (linie: PlanTratamentLinieCuProdus) => {
    setApplyLinie(linie)
    setApplyAplicareId(null)
    startApplyTransition(async () => {
      const formData = new FormData()
      formData.set('parcelaId', parcelaId)
      formData.set('planLinieId', linie.id)
      formData.set('dataPlanificata', new Date().toISOString().slice(0, 10))
      const cohort = normalizeCohortaValue(linie.cohort_trigger)
      if (cohort) formData.set('cohortLaAplicare', cohort)

      const result = await planificaInterventieRelevantaAction(formData)
      if (!result.ok) {
        toast.error(result.error)
        setApplyLinie(null)
        return
      }

      setApplyAplicareId(result.aplicareId)
      setApplyOpen(true)
    })
  }

  const handleApplySubmit = async (values: MarkAplicataFormValues) => {
    if (!applyAplicareId) return
    startApplyTransition(async () => {
      const formData = new FormData()
      formData.set('parcelaId', parcelaId)
      formData.set('aplicareId', applyAplicareId)
      formData.set('data_aplicata', values.data_aplicata)
      formData.set('cantitate_totala_ml', values.cantitate_totala_ml ?? '')
      formData.set('operator', values.operator ?? '')
      formData.set('stadiu_la_aplicare', values.stadiu_la_aplicare ?? '')
      if (values.cohort_la_aplicare) {
        formData.set('cohort_la_aplicare', values.cohort_la_aplicare)
      }
      formData.set('observatii', values.observatii ?? '')
      if (values.meteoSnapshot) {
        formData.set('meteo_snapshot', JSON.stringify(values.meteoSnapshot))
      }
      formData.set('produse', JSON.stringify(values.produse))
      if (values.diferenteFataDePlan) {
        formData.set('diferente_fata_de_plan', JSON.stringify(values.diferenteFataDePlan))
      }

      const result = await markAplicataAction(formData)
      if (!result.ok) {
        toast.error(result.error)
        return
      }

      toast.success('Aplicarea a fost marcată ca efectuată.')
      setApplyOpen(false)
      setApplyLinie(null)
      setApplyAplicareId(null)
      router.refresh()
    })
  }

  const toggleCohort = (c: Cohorta) => {
    setCohortFilter((prev) => (prev === c ? null : c))
  }

  const handleAmana = (inv: InterventieRelevantaV2) => {
    if (inv.status_operational === 'neaplicabila_fara_stadiu' || inv.status_operational === 'completata_pentru_moment') {
      return
    }
    const in7 = formatISO(addDays(new Date(), 7), { representation: 'date' })
    startAmana(async () => {
      if (inv.aplicare_planificata?.id) {
        const fd = new FormData()
        fd.set('aplicareId', inv.aplicare_planificata.id)
        fd.set('parcelaId', parcelaId)
        fd.set('data_planificata', in7)
        fd.set('motiv', 'Amânare rapidă din hub')
        const r = await reprogrameazaAction(fd)
        if (!r.ok) {
          toast.error(r.error)
          return
        }
      } else {
        const fd = new FormData()
        fd.set('parcelaId', parcelaId)
        fd.set('planLinieId', inv.interventie.id)
        fd.set('dataPlanificata', in7)
        if (inv.fenofaza_curenta?.cohort) fd.set('cohortLaAplicare', inv.fenofaza_curenta.cohort)
        const r = await planificaInterventieRelevantaAction(fd)
        if (!r.ok) {
          toast.error(r.error)
          return
        }
      }
      toast.success('Amânare salvată.')
      setExpandedKey(null)
      router.refresh()
    })
  }

  const canQuickApply = (inv: InterventieRelevantaV2) =>
    inv.status_operational !== 'neaplicabila_fara_stadiu' && inv.status_operational !== 'completata_pentru_moment'

  const hasAssociatedPlan = Boolean(planActiv?.plan)

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--status-danger-bg)] px-3 py-1 text-xs font-medium text-[var(--status-danger-text)]">
          <span className="inline-block h-1.5 w-1.5 rounded-full bg-[var(--status-danger-text)]" />
          {summary.intarziate} întârziate
        </span>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--status-warning-bg)] px-3 py-1 text-xs font-medium text-[var(--status-warning-text)]">
          <span className="inline-block h-1.5 w-1.5 rounded-full bg-[var(--status-warning-text)]" />
          {summary.azi} azi
        </span>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--surface-card-muted)] px-3 py-1 text-xs font-medium text-[var(--text-secondary)]">
          <span className="inline-block h-1.5 w-1.5 rounded-full bg-[var(--text-secondary)]" />
          {summary.cuPlan}/{summary.total} planificate
        </span>
      </div>

      <div className="flex gap-2">
        {isRubusMixt && dualStageState ? (
          <>
            <CohortMiniCard
              active={cohortFilter === 'floricane'}
              cohort="floricane"
              configurareSezon={configurareSezon}
              grupBiologic={grupBiologic}
              onClick={() => toggleCohort('floricane')}
              onRecordCohort={() => onRecordStadiu('floricane')}
              stage={dualStageState.floricane}
            />
            <CohortMiniCard
              active={cohortFilter === 'primocane'}
              cohort="primocane"
              configurareSezon={configurareSezon}
              grupBiologic={grupBiologic}
              onClick={() => toggleCohort('primocane')}
              onRecordCohort={() => onRecordStadiu('primocane')}
              stage={dualStageState.primocane}
            />
          </>
        ) : singleStageState ? (
          <SingleStageMiniCard
            configurareSezon={configurareSezon}
            grupBiologic={grupBiologic}
            onRecord={() => onRecordStadiu(undefined)}
            stage={singleStageState}
          />
        ) : null}
      </div>

      {cohortFilter ? (
        <button
          type="button"
          className="text-xs font-semibold text-[var(--agri-primary)]"
          onClick={() => setCohortFilter(null)}
        >
          ← Toate cohortele
        </button>
      ) : null}

      <div className="flex flex-col gap-2 sm:flex-row">
        <Button
          type="button"
          variant="secondary"
          size="sm"
          className="w-full flex-1 rounded-[10px] bg-[var(--surface-card-muted)] px-4 py-2 text-sm font-medium text-[var(--text-primary)] hover:bg-[var(--surface-card-elevated)]"
          onClick={() => onRecordStadiu(undefined)}
        >
          Actualizează fenofaza
        </Button>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          className={cn(
            'w-full flex-1 rounded-[10px] px-4 py-2 text-sm font-medium',
            hasAssociatedPlan
              ? 'bg-[var(--surface-card-muted)] text-[var(--text-primary)] hover:bg-[var(--surface-card-elevated)]'
              : 'bg-[color:color-mix(in_srgb,var(--agri-primary)_12%,var(--surface-card))] text-[var(--agri-primary)] hover:opacity-90',
          )}
          onClick={onAssignPlan}
        >
          Asociază plan
        </Button>
      </div>

      <div className="space-y-2">
        <p className="mb-2 text-[11px] font-medium uppercase tracking-[0.06em] text-[var(--text-secondary)]">INTERVENȚII</p>
        {filteredInterventii.length === 0 ? (
          <div className="rounded-xl border border-dashed border-[var(--border-default)] bg-[var(--surface-card-muted)] px-4 py-3 text-[13px] text-[var(--text-secondary)]">
            {interventiiRelevante.length === 0
              ? 'Nu există intervenții relevante acum.'
              : 'Nicio intervenție pentru cohorta selectată.'}
          </div>
        ) : (
          <div className="flex flex-col gap-2.5">
            {filteredInterventii.map((inv) => {
              const key = getInterventieKey(inv)
              const open = expandedKey === key
              const status = inv.status_operational
              const cohort = cohortOf(inv)
              const tipMeta = getTipInterventieMeta(inv)
              const due = inv.urmatoarea_data_estimata
                ? format(parseISO(inv.urmatoarea_data_estimata), 'd MMM', { locale: ro })
                : '—'
              const leftBorder =
                status === 'intarziata'
                  ? "before:bg-[var(--status-danger-text)]"
                  : status === 'de_facut_azi'
                    ? "before:bg-[var(--status-warning-text)]"
                    : "before:bg-transparent"

              const statusBadge =
                status === 'intarziata' ? (
                  <span className="inline-flex rounded-full bg-[var(--status-danger-bg)] px-1.5 py-0.5 text-[10px] font-semibold text-[var(--status-danger-text)]">
                    ⚠ Întârziată
                  </span>
                ) : status === 'de_facut_azi' ? (
                  <span className="inline-flex rounded-full bg-[var(--status-warning-bg)] px-1.5 py-0.5 text-[10px] font-semibold text-[var(--status-warning-text)]">
                    ● Azi
                  </span>
                ) : (
                  <span className="inline-flex rounded-full bg-[var(--surface-card-muted)] px-1.5 py-0.5 text-[10px] font-semibold text-[var(--text-secondary)]">
                    Urmează
                  </span>
                )

              const cohortBadge =
                cohort === 'floricane' ? (
                  <span className="inline-flex items-center rounded-full border border-[var(--status-success-border)] bg-[var(--status-success-bg)] px-1.5 py-0.5 text-[10px] font-semibold text-[var(--status-success-text)]">
                    🌸 floricane
                  </span>
                ) : cohort === 'primocane' ? (
                  <span className="inline-flex items-center rounded-full border border-[var(--status-info-border)] bg-[var(--status-info-bg)] px-1.5 py-0.5 text-[10px] font-semibold text-[var(--status-info-text)]">
                    🌱 primocane
                  </span>
                ) : null

              const canPlan =
                !inv.aplicare_planificata &&
                inv.status_operational !== 'completata_pentru_moment' &&
                inv.status_operational !== 'neaplicabila_fara_stadiu'

              return (
                <Collapsible
                  key={key}
                  open={open}
                  onOpenChange={(next) => setExpandedKey(next ? key : null)}
                >
                  <div
                    className={cn(
                      "relative overflow-hidden rounded-xl border border-[var(--border-default)] bg-[var(--surface-card)] shadow-[var(--shadow-soft)] before:absolute before:inset-y-2 before:left-0 before:w-1 before:rounded-full before:content-['']",
                      leftBorder,
                    )}
                  >
                    <CollapsibleTrigger asChild>
                      <button
                        type="button"
                        className="flex w-full items-start gap-2 px-4 py-3 text-left"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="mb-1.5 flex flex-wrap items-center gap-1.5">
                            {statusBadge}
                            {cohortBadge}
                            <span className="inline-flex rounded-full bg-[var(--surface-card-muted)] px-1.5 py-0.5 text-[10px] font-medium text-[var(--text-secondary)]">
                              {tipMeta.emoji} {tipMeta.label}
                            </span>
                          </div>
                          <p className="line-clamp-1 text-[15px] font-semibold text-[var(--text-primary)]">
                            {getInterventieTitle(inv)}
                          </p>
                          <p className="mt-1 line-clamp-1 text-xs text-muted-foreground">
                            📦 {getProductLine(inv)}
                          </p>
                          <p className="text-[10px] text-[var(--text-tertiary)]">
                            Scadență {due} · {inv.aplicari_efectuate_count} aplicări
                          </p>
                        </div>
                      </button>
                    </CollapsibleTrigger>
                    <CollapsibleContent className="border-t border-[var(--border-default)] px-4 pb-3 pt-2.5">
                      <div className="grid grid-cols-2 gap-2">
                        <Button
                          type="button"
                          className="bg-[var(--agri-primary)] text-white hover:bg-[var(--agri-primary)]/90"
                          disabled={!canQuickApply(inv)}
                          onClick={(e) => {
                            e.stopPropagation()
                            setRapidInterventie(inv)
                            setRapidOpen(true)
                          }}
                        >
                          ✓ Aplică acum
                        </Button>
                        <Button
                          type="button"
                          variant="secondary"
                          className="bg-[var(--surface-card-muted)] text-[var(--text-primary)] hover:bg-[var(--surface-card-elevated)]"
                          disabled={isAmanaPending || !canQuickApply(inv)}
                          onClick={(e) => {
                            e.stopPropagation()
                            handleAmana(inv)
                          }}
                        >
                          Amână
                        </Button>
                      </div>
                      {canPlan ? (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="mt-2 w-full"
                          disabled={pendingInterventieId === key}
                          onClick={() => onPlanificaInterventie(inv)}
                        >
                          {pendingInterventieId === key ? 'Se pregătește…' : 'Pregătește aplicare din plan'}
                        </Button>
                      ) : null}
                      {inv.aplicare_planificata ? (
                        <EditAplicareButton
                          aplicareId={inv.aplicare_planificata.id}
                          className="mt-1 w-full"
                          variant="ghost"
                        >
                          Detaliu aplicare
                        </EditAplicareButton>
                      ) : null}
                    </CollapsibleContent>
                  </div>
                </Collapsible>
              )
            })}
          </div>
        )}
      </div>

      <ParcelaPlanLiniiExpandable
        className="pt-1"
        linii={planLinii}
        planName={planName}
        relevantLinieIds={relevantLinieIds}
        grupBiologic={grupBiologic}
        onApplyNow={handleApplyNowFromPlanLinie}
      />

      <section className="space-y-2">
        <p className="mb-2 text-[11px] font-medium uppercase tracking-[0.06em] text-[var(--text-secondary)]">PLAN ASOCIAT</p>
        {planActiv?.plan ? (
          <AppCard className="rounded-2xl">
            <div className="space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="line-clamp-2 text-base text-[var(--text-primary)] [font-weight:700]">{planActiv.plan.nume}</p>
                  <p className="mt-1 text-sm text-[var(--text-secondary)]">
                    {planActiv.plan.cultura_tip} · {planActiv.an}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <Link
                  href="/tratamente/produse-fitosanitare"
                  className="rounded-lg bg-[var(--surface-card-muted)] p-2 text-center text-xs font-medium text-[var(--text-primary)]"
                >
                  Bibliotecă produse
                </Link>
                <Link
                  href="/tratamente/planuri"
                  className="rounded-lg bg-[var(--surface-card-muted)] p-2 text-center text-xs font-medium text-[var(--text-primary)]"
                >
                  Toate planurile
                </Link>
                <Link
                  href="/tratamente"
                  className="rounded-lg bg-[var(--surface-card-muted)] p-2 text-center text-xs font-medium text-[var(--text-primary)]"
                >
                  Hub tratamente
                </Link>
                {detailsHref ? (
                  <Link
                    href={detailsHref}
                    className="rounded-lg bg-[var(--surface-card-muted)] p-2 text-center text-xs font-medium text-[var(--text-primary)]"
                  >
                    Vezi detalii
                  </Link>
                ) : (
                  <button
                    type="button"
                    className="rounded-lg bg-[var(--surface-card-muted)] p-2 text-center text-xs font-medium text-[var(--text-tertiary)]"
                    disabled
                  >
                    Vezi detalii
                  </button>
                )}
              </div>

              <Button
                type="button"
                variant="secondary"
                size="sm"
                className="w-full rounded-[10px] bg-[var(--surface-card-muted)] px-4 py-2 text-sm font-medium text-[var(--text-primary)] hover:bg-[var(--surface-card-elevated)]"
                onClick={onAssignPlan}
              >
                Schimbă plan
              </Button>
            </div>
          </AppCard>
        ) : (
          <div className="rounded-xl border border-[var(--border-default)] bg-[var(--surface-card)] p-4">
            <div className="mb-3 flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--surface-card-muted)] text-[var(--text-secondary)]">
                <ClipboardList className="h-4 w-4" />
              </div>
              <p className="text-[13px] text-[var(--text-secondary)]">Nu există încă un plan asociat pentru această parcelă.</p>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Button
                type="button"
                size="sm"
                className="w-full rounded-[10px] bg-[var(--agri-primary)] px-4 py-2 text-sm font-medium text-white"
                onClick={onAssignPlan}
              >
                Asociază plan
              </Button>
              {createPlanHref ? (
                <Button type="button" size="sm" variant="secondary" className="w-full rounded-[10px] bg-[var(--surface-card-muted)] text-[var(--text-primary)]" asChild>
                  <Link href={createPlanHref}>Creează plan</Link>
                </Button>
              ) : (
                <Button type="button" size="sm" variant="secondary" className="w-full rounded-[10px] bg-[var(--surface-card-muted)] text-[var(--text-tertiary)]" disabled>
                  Creează plan
                </Button>
              )}
            </div>
          </div>
        )}
      </section>

      <section className="space-y-2">
        <div className="mb-2.5 flex items-center justify-between">
          <p className="text-[11px] font-medium uppercase tracking-[0.06em] text-[var(--text-secondary)]">Următoarele aplicări</p>
          <span className="rounded-full border border-[var(--border-default)] bg-[var(--surface-card-muted)] px-2 py-0.5 text-[11px] font-medium text-[var(--text-secondary)]">
            {aplicariCount}
          </span>
        </div>
        {urmatoareleAplicari.length === 0 ? (
          <div className="rounded-xl border border-dashed border-[var(--border-default)] bg-[var(--surface-card-muted)] px-4 py-3 text-[13px] text-[var(--text-secondary)]">
            Nu există încă aplicări planificate pentru această parcelă în anul curent.
          </div>
        ) : (
          <div className="space-y-2">
            {urmatoareleAplicari.map((aplicare) => {
              const dateText = formatAplicareDateShort(aplicare.data_planificata ?? aplicare.data_aplicata ?? null)
              const fromPlan = Boolean(aplicare.plan_linie_id)
              const statusLabel = getAplicareStatusLabel(aplicare.status)
              const headerBadge = fromPlan ? `Din plan · ${statusLabel}` : statusLabel
              const produs =
                aplicare.produse_aplicare?.[0]?.produs?.nume_comercial ??
                aplicare.produse_aplicare?.[0]?.produs_nume_snapshot ??
                aplicare.produse_aplicare?.[0]?.produs_nume_manual ??
                aplicare.produs?.nume_comercial ??
                aplicare.produs_nume_manual ??
                'Produs'
              const tipInterventie = aplicare.linie?.tip_interventie ?? null

              const stadiuCod = aplicare.linie?.stadiu_trigger ?? aplicare.stadiu_la_aplicare ?? null
              const stadiuNorm = stadiuCod ? normalizeStadiu(stadiuCod) : null
              const stadiuLabel = stadiuNorm
                ? getLabelStadiuContextual(stadiuNorm, configurareSezon, { grupBiologic, cohort: null })
                : null

              const cohort = (aplicare.linie?.cohort_trigger ?? aplicare.cohort_la_aplicare) as Cohorta | null
              const cohortLabel = cohort === 'floricane' ? '🌸 Floricane' : cohort === 'primocane' ? '🌱 Primocane' : null

              return (
                <div key={aplicare.id} className="block">
                  <div className="rounded-xl border border-[var(--border-default)] bg-[var(--surface-card)] p-3 shadow-[var(--shadow-soft)]">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-medium text-[var(--text-primary)]">{dateText}</p>
                      <span className="inline-flex rounded-full bg-[var(--surface-card-muted)] px-2 py-0.5 text-[11px] font-semibold text-[var(--text-secondary)]">
                        {headerBadge}
                      </span>
                    </div>
                    <div className="mt-2">
                      <p className="line-clamp-1 text-sm text-[var(--text-primary)] [font-weight:700]">{produs}</p>
                      {tipInterventie ? (
                        <p className="mt-0.5 line-clamp-1 text-xs text-[var(--text-secondary)]">{tipInterventie}</p>
                      ) : null}
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-1.5">
                      {stadiuLabel ? (
                        <span className="inline-flex items-center rounded-full border border-[var(--border-default)] bg-[var(--surface-card-muted)] px-2 py-0.5 text-[11px] font-semibold text-[var(--text-secondary)]">
                          {stadiuLabel}
                        </span>
                      ) : null}
                      {cohortLabel ? (
                        <span className="inline-flex items-center rounded-full border border-[var(--border-default)] bg-[var(--surface-card-muted)] px-2 py-0.5 text-[11px] font-semibold text-[var(--text-secondary)]">
                          {cohortLabel}
                        </span>
                      ) : null}
                    </div>
                    <EditAplicareButton aplicareId={aplicare.id} className="mt-2 w-full" variant="ghost">
                      Vezi detalii
                    </EditAplicareButton>
                  </div>
                </div>
              )
            })}
            <Button type="button" variant="outline" size="sm" asChild>
              <Link href={`/parcele/${parcelaId}/tratamente/toate`}>Vezi toate ({aplicariCount})</Link>
            </Button>
          </div>
        )}
        {aplicateCount > 0 ? (
          <p className="mt-2.5 text-[12px] font-medium text-[var(--agri-primary)]">
            <Link
              href={`/parcele/${parcelaId}/tratamente/toate`}
              className="cursor-pointer underline-offset-2 hover:underline"
            >
              {aplicateCount} aplicări efectuate în {an} →
            </Link>
          </p>
        ) : null}
      </section>

      <InterventieRapidApplySheet
        interventie={rapidInterventie}
        open={rapidOpen}
        onOpenChange={(o) => {
          setRapidOpen(o)
          if (!o) setRapidInterventie(null)
        }}
        onSuccess={() => router.refresh()}
        parcelaId={parcelaId}
      />

      <MarkAplicataSheet
        mode="din_plan"
        cohortLaAplicareBlocata={normalizeCohortaValue(applyLinie?.cohort_trigger) ?? null}
        defaultCantitateMl={null}
        defaultCohortLaAplicare={normalizeCohortaValue(applyLinie?.cohort_trigger) ?? null}
        defaultOperator=""
        defaultStadiu={applyLinie?.stadiu_trigger ?? null}
        configurareSezon={configurareSezon}
        grupBiologic={grupBiologic}
        isRubusMixt={isRubusMixt}
        meteoSnapshot={null}
        onOpenChange={(open) => {
          setApplyOpen(open)
          if (!open) {
            setApplyLinie(null)
            setApplyAplicareId(null)
          }
        }}
        onSubmit={handleApplySubmit}
        open={applyOpen}
        pending={isApplyPending}
        produseEfective={[]}
        produseFitosanitare={produseFitosanitare}
        produsePlanificate={applyLinie?.produse ?? []}
      />
    </div>
  )
}

export function ParcelaTratamentePlansCollapsed(props: ParcelaTratamentePlansCollapsedProps) {
  const [open, setOpen] = useState(false)

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger asChild>
        <button
          type="button"
          className="flex w-full min-h-11 items-center justify-between gap-2 rounded-xl border border-dashed border-[var(--border-default)] bg-[var(--surface-card-muted)] px-3 py-2.5 text-left text-sm font-semibold text-[var(--text-secondary)] transition active:scale-[0.985]"
        >
          <span>Planuri și conformitate</span>
          <ChevronDown className={cn('h-4 w-4 shrink-0 transition-transform', open && 'rotate-180')} aria-hidden />
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent className="pt-3">
        <ParcelaTratamentePlansCollapsedBody {...props} />
      </CollapsibleContent>
    </Collapsible>
  )
}
