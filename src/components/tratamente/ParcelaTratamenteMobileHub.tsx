'use client'

import Link from 'next/link'
import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { addDays, format, formatISO, parseISO } from 'date-fns'
import { ro } from 'date-fns/locale'

import { planificaInterventieRelevantaAction } from '@/app/(dashboard)/parcele/[id]/tratamente/actions'
import { reprogrameazaAction } from '@/app/(dashboard)/parcele/[id]/tratamente/aplicare/[aplicareId]/actions'
import { getInterventieKey } from '@/components/tratamente/InterventiiRelevanteCard'
import { InterventieRapidApplySheet } from '@/components/tratamente/InterventieRapidApplySheet'
import type { StageState } from '@/components/tratamente/StadiuCurentCard'
import { AppCard } from '@/components/ui/app-card'
import { Button } from '@/components/ui/button'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { colors } from '@/lib/design-tokens'
import type { AplicareTratamentDetaliu, InterventieRelevantaV2, PlanActivParcela, StadiuFenologicParcela } from '@/lib/supabase/queries/tratamente'
import type { Cohorta, ConfigurareSezon } from '@/lib/tratamente/configurare-sezon'
import { getCohortaLabel, getLabelStadiuContextual } from '@/lib/tratamente/configurare-sezon'
import { listStadiiPentruGrup, normalizeStadiu, type GrupBiologic } from '@/lib/tratamente/stadii-canonic'
import { cn } from '@/lib/utils'
import { toast } from '@/lib/ui/toast'

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

interface ParcelaTratamenteMobileHubProps {
  an: number
  aplicariCount: number
  configurareSezon: ConfigurareSezon | null
  createPlanHref: string
  detailsHref: string | null
  dualStageState: { floricane: StageState; primocane: StageState } | null
  editPlanHref: string | null
  grupBiologic?: GrupBiologic | null
  interventiiRelevante: InterventieRelevantaV2[]
  isRubusMixt: boolean
  onAssignPlan: () => void
  onPlanificaInterventie: (interventie: InterventieRelevantaV2) => void
  onRecordStadiu: (cohort?: Cohorta) => void
  parcelaId: string
  pendingInterventieId: string | null
  planActiv: PlanActivParcela | null
  singleStageState: StageState | null
  urmatoareleAplicari: AplicareTratamentDetaliu[]
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
  const labelColor = isFloricane ? '#3D7A5F' : '#2563EB'
  const barColor = isFloricane ? '#3D7A5F' : '#2563EB'
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
            ? 'border-[#3D7A5F] bg-[color:color-mix(in_srgb,#3D7A5F_10%,var(--surface-card))]'
            : 'border-[#2563EB] bg-[color:color-mix(in_srgb,#2563EB_10%,var(--surface-card))]'
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
          <p className="mt-0.5 text-[10px] text-gray-400">{bbchDisplay ? `BBCH ${bbchDisplay} · ${dataObs}` : dataObs}</p>
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
      <p className="text-[10px] font-bold uppercase tracking-wide text-[#3D7A5F]">Fenofază curentă</p>
      <p className="mt-0.5 text-sm font-bold text-[var(--text-primary)]">{numeFaza}</p>
      <p className="mt-0.5 text-[10px] text-gray-400">{bbchDisplay ? `BBCH ${bbchDisplay} · ${dataObs}` : dataObs}</p>
      <div className="mt-1.5 h-1 w-full overflow-hidden rounded-full bg-[var(--surface-card-muted)]">
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${stage.stadiuProgress}%`, background: '#3D7A5F' }}
        />
      </div>
      <p className="mt-1 text-[10px] text-[var(--text-secondary)]">
        Urmează: <span className="font-medium text-[var(--text-primary)]">{urmatorLabel}</span>
      </p>
    </div>
  )
}

export function ParcelaTratamenteMobileHub({
  an,
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
  pendingInterventieId,
  planActiv,
  singleStageState,
  urmatoareleAplicari,
}: ParcelaTratamenteMobileHubProps) {
  const router = useRouter()
  const [cohortFilter, setCohortFilter] = useState<Cohorta | null>(null)
  const [expandedKey, setExpandedKey] = useState<string | null>(null)
  const [rapidInterventie, setRapidInterventie] = useState<InterventieRelevantaV2 | null>(null)
  const [rapidOpen, setRapidOpen] = useState(false)
  const [isAmanaPending, startAmana] = useTransition()

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
    <div className="mx-auto w-full max-w-[min(96vw,94rem)] space-y-3 px-3 py-3">
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="inline-flex items-center rounded-full bg-red-100 px-2 py-0.5 text-[11px] font-semibold text-red-600">
          ⚠ {summary.intarziate} întârziate
        </span>
        <span className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-700">
          ● {summary.azi} azi
        </span>
        <span
          className="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold"
          style={{ background: colors.greenLight, color: colors.primary }}
        >
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
          className="w-full flex-1 rounded-[10px] bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200"
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
              ? 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              : 'bg-[color:color-mix(in_srgb,var(--agri-primary)_12%,white)] text-[var(--agri-primary)] hover:bg-[color:color-mix(in_srgb,var(--agri-primary)_18%,white)]',
          )}
          onClick={onAssignPlan}
        >
          Asociază plan
        </Button>
      </div>

      <div className="space-y-2">
        <p className="text-xs font-bold uppercase tracking-wide text-[var(--text-secondary)]">Intervenții</p>
        {filteredInterventii.length === 0 ? (
          <AppCard className="rounded-xl border border-dashed border-[var(--border-default)] p-3 text-sm text-[var(--text-secondary)]">
            {interventiiRelevante.length === 0
              ? 'Nu există intervenții relevante acum.'
              : 'Nicio intervenție pentru cohorta selectată.'}
          </AppCard>
        ) : (
          <div className="flex flex-col gap-2">
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
                status === 'intarziata' ? 'border-l-4 border-l-red-500' : status === 'de_facut_azi' ? 'border-l-4 border-l-amber-500' : 'border-l-4 border-l-transparent'

              const statusBadge =
                status === 'intarziata' ? (
                  <span className="inline-flex rounded-full bg-red-100 px-1.5 py-0.5 text-[10px] font-semibold text-red-600">
                    ⚠ Întârziată
                  </span>
                ) : status === 'de_facut_azi' ? (
                  <span className="inline-flex rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700">
                    ● Azi
                  </span>
                ) : (
                  <span className="inline-flex rounded-full bg-gray-100 px-1.5 py-0.5 text-[10px] font-semibold text-gray-600">
                    Urmează
                  </span>
                )

              const cohortBadge =
                cohort === 'floricane' ? (
                  <span className="inline-flex items-center rounded-full border border-green-200 bg-green-50 px-1.5 py-0.5 text-[10px] font-semibold text-green-700">
                    🌸 floricane
                  </span>
                ) : cohort === 'primocane' ? (
                  <span className="inline-flex items-center rounded-full border border-blue-200 bg-blue-50 px-1.5 py-0.5 text-[10px] font-semibold text-blue-600">
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
                      'overflow-hidden rounded-xl border border-[var(--border-default)] bg-[var(--surface-card)] shadow-[var(--shadow-soft)]',
                      leftBorder,
                    )}
                  >
                    <CollapsibleTrigger asChild>
                      <button
                        type="button"
                        className="flex max-h-[70px] min-h-[64px] w-full items-start gap-2 px-2.5 py-2 text-left"
                      >
                        <div className="min-w-0 flex-1 space-y-1">
                          <div className="flex flex-wrap items-center gap-1">
                            {statusBadge}
                            {cohortBadge}
                            <span className="inline-flex rounded-full bg-gray-100 px-1.5 py-0.5 text-[10px] font-medium text-gray-500">
                              {tipMeta.emoji} {tipMeta.label}
                            </span>
                          </div>
                          <p className="line-clamp-1 text-sm font-bold text-[var(--text-primary)]">{getInterventieTitle(inv)}</p>
                          <p className="line-clamp-1 text-xs text-gray-500">
                            📦 {getProductLine(inv)}
                          </p>
                          <p className="text-[10px] text-gray-400">
                            Scadență {due} · {inv.aplicari_efectuate_count} aplicări
                          </p>
                        </div>
                      </button>
                    </CollapsibleTrigger>
                    <CollapsibleContent className="border-t border-[var(--border-default)] px-2.5 pb-2.5 pt-2">
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
                          className="bg-gray-100 text-[var(--text-primary)] hover:bg-gray-200"
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
                        <Button type="button" variant="ghost" size="sm" className="mt-1 w-full" asChild>
                          <Link href={`/parcele/${parcelaId}/tratamente/aplicare/${inv.aplicare_planificata.id}`}>
                            Detaliu aplicare
                          </Link>
                        </Button>
                      ) : null}
                    </CollapsibleContent>
                  </div>
                </Collapsible>
              )
            })}
          </div>
        )}
      </div>

      <section className="space-y-2">
        <p className="text-xs font-bold uppercase tracking-wide text-[var(--text-secondary)]">Plan asociat</p>
        <AppCard className="rounded-2xl">
          {planActiv?.plan ? (
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
                  className="rounded-lg bg-gray-100 p-2 text-center text-xs font-medium text-gray-700"
                >
                  Bibliotecă produse
                </Link>
                <Link
                  href="/tratamente/planuri"
                  className="rounded-lg bg-gray-100 p-2 text-center text-xs font-medium text-gray-700"
                >
                  Toate planurile
                </Link>
                <Link
                  href="/tratamente"
                  className="rounded-lg bg-gray-100 p-2 text-center text-xs font-medium text-gray-700"
                >
                  Hub tratamente
                </Link>
                {detailsHref ? (
                  <Link
                    href={detailsHref}
                    className="rounded-lg bg-gray-100 p-2 text-center text-xs font-medium text-gray-700"
                  >
                    Vezi detalii
                  </Link>
                ) : (
                  <button
                    type="button"
                    className="rounded-lg bg-gray-100 p-2 text-center text-xs font-medium text-gray-400"
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
                className="w-full rounded-[10px] bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200"
                onClick={onAssignPlan}
              >
                Schimbă plan
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-[var(--text-secondary)]">Nu există încă un plan asociat pentru această parcelă.</p>
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
                  <Button type="button" size="sm" variant="secondary" className="w-full rounded-[10px] bg-gray-100 text-gray-700" asChild>
                    <Link href={createPlanHref}>Creează plan</Link>
                  </Button>
                ) : (
                  <Button type="button" size="sm" variant="secondary" className="w-full rounded-[10px] bg-gray-100 text-gray-400" disabled>
                    Creează plan
                  </Button>
                )}
              </div>
            </div>
          )}
        </AppCard>
      </section>

      <section className="space-y-2">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-bold text-[var(--text-primary)]">Următoarele aplicări</h2>
          <span className="inline-flex rounded-full border border-[var(--border-default)] bg-[var(--surface-card-muted)] px-2 py-0.5 text-[11px] font-semibold text-[var(--text-secondary)]">
            {aplicariCount}
          </span>
        </div>
        {urmatoareleAplicari.length === 0 ? (
          <AppCard className="rounded-xl border border-dashed p-3 text-sm text-[var(--text-secondary)]">
            Nu există încă aplicări planificate pentru această parcelă în anul curent.
          </AppCard>
        ) : (
          <div className="space-y-2">
            {urmatoareleAplicari.map((aplicare) => {
              const dateText = formatAplicareDateShort(aplicare.data_planificata ?? aplicare.data_aplicata ?? null)
              const fromPlan = Boolean(aplicare.plan_linie_id)
              const headerBadge = fromPlan ? 'Din plan' : 'Planificată'
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
                <Link
                  key={aplicare.id}
                  href={`/parcele/${parcelaId}/tratamente/aplicare/${aplicare.id}`}
                  className="block"
                >
                  <div className="rounded-xl border border-[var(--border-default)] bg-[var(--surface-card)] p-3 shadow-[var(--shadow-soft)]">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-medium text-[var(--text-primary)]">{dateText}</p>
                      <span className="inline-flex rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-semibold text-gray-600">
                        {headerBadge}
                      </span>
                    </div>
                    <div className="mt-2">
                      <p className="line-clamp-1 text-sm text-[var(--text-primary)] [font-weight:700]">{produs}</p>
                      {tipInterventie ? (
                        <p className="mt-0.5 line-clamp-1 text-xs text-gray-500">{tipInterventie}</p>
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
                  </div>
                </Link>
              )
            })}
            <Button type="button" variant="outline" size="sm" asChild>
              <Link href={`/parcele/${parcelaId}/tratamente/toate`}>Vezi toate ({aplicariCount})</Link>
            </Button>
          </div>
        )}
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
    </div>
  )
}
