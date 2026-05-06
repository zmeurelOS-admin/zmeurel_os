'use client'

import { useEffect, useMemo, useState, useTransition } from 'react'
import { Plus } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useSearchParams } from 'next/navigation'

import {
  addLinieAction,
  deleteLinieAction,
  reorderLiniiAction,
  updateLinieAction,
  type LinieInput,
} from '@/app/(dashboard)/tratamente/planuri/[planId]/actions'
import { AdaugaInterventieManualDialog } from '@/components/tratamente/AdaugaInterventieManualDialog'
import { LinieDeleteDialog } from '@/components/tratamente/LinieDeleteDialog'
import { LinieEditDialog, type LinieEditValue } from '@/components/tratamente/LinieEditDialog'
import { LinieRow } from '@/components/tratamente/LinieRow'
import { AppCard } from '@/components/ui/app-card'
import { Button } from '@/components/ui/button'
import type { PlanTratamentLinieCuProdus, ProdusFitosanitar } from '@/lib/supabase/queries/tratamente'
import { toast } from '@/lib/ui/toast'

import {
  getGrupBiologicDinCultura,
  getStadiuMeta,
} from '@/components/tratamente/plan-wizard/helpers'
import type { PlanWizardLinieProdusDraft } from '@/components/tratamente/plan-wizard/types'
import type { GrupBiologic } from '@/lib/tratamente/stadii-canonic'

function normalizeCohorta(value: string | null | undefined): 'floricane' | 'primocane' | null {
  return value === 'floricane' || value === 'primocane' ? value : null
}

function normalizeTipInterventie(value: string | null | undefined): LinieEditValue['tip_interventie'] {
  return value === 'protectie' ||
    value === 'nutritie' ||
    value === 'biostimulare' ||
    value === 'erbicidare' ||
    value === 'igiena' ||
    value === 'monitorizare' ||
    value === 'altul'
    ? value
    : 'protectie'
}

function normalizeRegulaRepetare(value: string | null | undefined): LinieEditValue['regula_repetare'] {
  return value === 'interval' ? 'interval' : 'fara_repetare'
}

interface PlanLiniiListProps {
  allowCohortTrigger?: boolean
  culturaTip: string
  linii: PlanTratamentLinieCuProdus[]
  onMarkAplicata?: (linieId: string) => void
  planId: string
  produse: ProdusFitosanitar[]
}

function sortLinii(linii: PlanTratamentLinieCuProdus[]) {
  return [...linii].sort((first, second) => first.ordine - second.ordine)
}

function normalizeStageLabel(value: string | null | undefined): string {
  return value
    ?.trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim() ?? ''
}

type StageBucket =
  | 'vegetativ'
  | 'inflorire'
  | 'fructificare'
  | 'recoltare'
  | 'post_recolta'
  | 'repaus'
  | 'fallback'

type StageTheme = { bucket: StageBucket; accent: string; bg: string; emoji: string; order: number }

const STAGE_THEME: Record<Exclude<StageBucket, 'fallback'>, StageTheme> = {
  vegetativ: { bucket: 'vegetativ', accent: '#3D7A5F', bg: '#E8F3EE', emoji: '🌿', order: 0 },
  inflorire: { bucket: 'inflorire', accent: '#BE185D', bg: '#FCE7F3', emoji: '🌸', order: 1 },
  fructificare: { bucket: 'fructificare', accent: '#7C3AED', bg: '#EDE9FE', emoji: '🫐', order: 2 },
  recoltare: { bucket: 'recoltare', accent: '#B45309', bg: '#FEF3C7', emoji: '🍓', order: 3 },
  post_recolta: { bucket: 'post_recolta', accent: '#0369A1', bg: '#E0F2FE', emoji: '🍂', order: 4 },
  repaus: { bucket: 'repaus', accent: '#6B7280', bg: '#F3F4F6', emoji: '❄️', order: 5 },
}

const STAGE_FALLBACK: StageTheme = {
  bucket: 'fallback',
  accent: '#3D7A5F',
  bg: '#E8F3EE',
  emoji: '🌱',
  order: 6,
}

const STAGE_CONFIG: Record<string, StageTheme> = (() => {
  const map: Record<string, StageTheme> = {}
  const assign = (bucket: Exclude<StageBucket, 'fallback'>, aliases: string[]) => {
    for (const alias of aliases) {
      map[normalizeStageLabel(alias)] = STAGE_THEME[bucket]
    }
  }

  assign('vegetativ', [
    'rasad',
    'răsad',
    'semanat',
    'semănat',
    'semanat rasarire',
    'semănat răsărire',
    'rasarire',
    'răsărire',
    'transplant',
    'transplant prindere',
    'prindere',
    'umflare_muguri',
    'umflare muguri',
    'dezmugurire',
    'crestere_vegetativa',
    'creștere vegetativă',
    'crestere vegetativa',
    'vegetativ',
    'formare_rozeta',
    'formare rozeta',
    'formare rozetă',
    'rozeta',
    'rozetă',
    'buton_verde',
    'buton verde',
  ])

  assign('inflorire', [
    'etaj_floral',
    'etaj floral',
    'aparitie_etaj_floral',
    'aparitie etaj floral',
    'apariție etaj floral',
    'inflorescente pe floricane',
    'inflorescențe pe floricane',
    'buton_roz',
    'buton roz',
    'prefloral',
    'inflorit',
    'înflorit',
    'inflorire',
    'înflorire',
    'inflorit pe floricane',
    'înflorit pe floricane',
    'inflorit pe primocane',
    'înflorit pe primocane',
    'scuturare_petale',
    'scuturare petale',
    'cadere_petale',
    'cadere petale',
    'cădere petale',
    'sfarsit de inflorit',
    'sfârșit de înflorit',
  ])

  assign('fructificare', [
    'legare_fruct',
    'legare fruct',
    'fruct_verde',
    'fruct verde',
    'fructe verzi in crestere',
    'fructe verzi în creștere',
    'formare_capatana',
    'formare capatana',
    'formare căpățână',
    'capatana',
    'căpățână',
    'bulbificare',
    'umplere_pastaie',
    'umplere pastaie',
    'umplere păstaie',
    'ingrosare_radacina',
    'ingrosare radacina',
    'îngroșare rădăcină',
    'radacina',
    'rădăcină',
    'parga',
    'pârgă',
    'parguire',
    'pârguire',
    'inceput de coacere',
    'început de coacere',
    'primele fructe colorate',
  ])

  assign('recoltare', [
    'maturitate',
    'maturare',
    'recoltare',
    'recoltare fruct copt',
    'recoltare pe floricane',
    'recoltare pe primocane',
  ])

  assign('post_recolta', [
    'post_recoltare',
    'post recoltare',
    'post-recoltare',
    'dupa recoltare',
    'după recoltare',
    'dupa recoltare floricane',
    'după recoltare floricane',
    'dupa recoltare primocane',
    'după recoltare primocane',
    'bolting',
    'inspicuire',
    'înspicuire',
  ])

  assign('repaus', [
    'repaus',
    'repaus_vegetativ',
    'repaus vegetativ',
    'repausul tufei',
    'floricane in repaus',
    'floricane în repaus',
    'primocane in repaus',
    'primocane în repaus',
    'dormant',
    'iarna',
    'iarnă',
  ])

  return map
})()

function resolveStageTheme(label: string) {
  return STAGE_CONFIG[normalizeStageLabel(label)] ?? STAGE_FALLBACK
}

function resolveGroupTitle(linie: PlanTratamentLinieCuProdus, grupBiologic?: GrupBiologic | null): string {
  return getStadiuMeta(linie.stadiu_trigger, grupBiologic, linie.cohort_trigger).label
}

function buildStageFilterQuery(currentSearch: string, stage: string): string {
  const params = new URLSearchParams(currentSearch)
  params.delete('stadiu')
  if (stage !== 'all') params.set('stadiu', stage)
  return params.toString()
}

function arrayMove<T>(items: T[], from: number, to: number): T[] {
  const next = [...items]
  const [item] = next.splice(from, 1)
  next.splice(to, 0, item)
  return next
}

function withConsecutiveOrder(linii: PlanTratamentLinieCuProdus[]): PlanTratamentLinieCuProdus[] {
  return linii.map((linie, index) => ({ ...linie, ordine: index + 1 }))
}

function toEditValue(linie?: PlanTratamentLinieCuProdus | null): LinieEditValue {
  if (!linie) {
    return {
      stadiu_trigger: '',
      cohort_trigger: null,
      tip_interventie: 'protectie',
      scop: null,
      regula_repetare: 'fara_repetare',
      interval_repetare_zile: null,
      numar_repetari_max: null,
      produs_id: null,
      produs_nume_manual: null,
      doza_ml_per_hl: null,
      doza_l_per_ha: null,
      observatii: null,
      produse: [
        {
          id: crypto.randomUUID(),
          ordine: 1,
          produs_id: null,
          produs_nume_manual: '',
          produs_nume_snapshot: null,
          substanta_activa_snapshot: '',
          tip_snapshot: '',
          frac_irac_snapshot: '',
          phi_zile_snapshot: null,
          doza_ml_per_hl: null,
          doza_l_per_ha: null,
          observatii: '',
        },
      ],
    }
  }

  const produse: PlanWizardLinieProdusDraft[] = linie.produse?.length
    ? linie.produse.map((produs, index) => ({
        id: produs.id || `${linie.id}-produs-${index + 1}`,
        ordine: produs.ordine ?? index + 1,
        produs_id: produs.produs_id ?? null,
        produs_nume_manual: produs.produs_nume_manual ?? '',
        produs_nume_snapshot: produs.produs_nume_snapshot ?? produs.produs?.nume_comercial ?? null,
        substanta_activa_snapshot: produs.substanta_activa_snapshot ?? produs.produs?.substanta_activa ?? '',
        tip_snapshot: produs.tip_snapshot ?? produs.produs?.tip ?? '',
        frac_irac_snapshot: produs.frac_irac_snapshot ?? produs.produs?.frac_irac ?? '',
        phi_zile_snapshot: produs.phi_zile_snapshot ?? produs.produs?.phi_zile ?? null,
        doza_ml_per_hl: produs.doza_ml_per_hl ?? null,
        doza_l_per_ha: produs.doza_l_per_ha ?? null,
        observatii: produs.observatii ?? '',
      }))
    : [
        {
          id: `${linie.id}-produs-1`,
          ordine: 1,
          produs_id: linie.produs_id ?? null,
          produs_nume_manual: linie.produs_nume_manual ?? '',
          produs_nume_snapshot: linie.produs?.nume_comercial ?? null,
          substanta_activa_snapshot: linie.produs?.substanta_activa ?? '',
          tip_snapshot: linie.produs?.tip ?? '',
          frac_irac_snapshot: linie.produs?.frac_irac ?? '',
          phi_zile_snapshot: linie.produs?.phi_zile ?? null,
          doza_ml_per_hl: linie.doza_ml_per_hl ?? null,
          doza_l_per_ha: linie.doza_l_per_ha ?? null,
          observatii: '',
        },
      ]

  return {
    stadiu_trigger: linie.stadiu_trigger,
    cohort_trigger: normalizeCohorta(linie.cohort_trigger),
    tip_interventie: normalizeTipInterventie(linie.tip_interventie),
    scop: linie.scop ?? null,
    regula_repetare: normalizeRegulaRepetare(linie.regula_repetare),
    interval_repetare_zile: linie.interval_repetare_zile ?? null,
    numar_repetari_max: linie.numar_repetari_max ?? null,
    produs_id: produse[0]?.produs_id ?? null,
    produs_nume_manual: produse[0]?.produs_nume_manual ?? null,
    doza_ml_per_hl: produse[0]?.doza_ml_per_hl ?? null,
    doza_l_per_ha: produse[0]?.doza_l_per_ha ?? null,
    observatii: linie.observatii,
    produse,
  }
}

export function PlanLiniiList({
  allowCohortTrigger = false,
  culturaTip,
  linii,
  onMarkAplicata,
  planId,
  produse,
}: PlanLiniiListProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [localLinii, setLocalLinii] = useState<PlanTratamentLinieCuProdus[]>(sortLinii(linii))
  const [editorOpen, setEditorOpen] = useState(false)
  const [manualEditorOpen, setManualEditorOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [editingLinie, setEditingLinie] = useState<PlanTratamentLinieCuProdus | null>(null)
  const [pendingDeleteLinie, setPendingDeleteLinie] = useState<PlanTratamentLinieCuProdus | null>(null)
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({})
  const [isPending, startTransition] = useTransition()
  const grupBiologic = useMemo(() => getGrupBiologicDinCultura(culturaTip), [culturaTip])

  useEffect(() => {
    setLocalLinii(sortLinii(linii))
  }, [linii])

  const orderedLinii = useMemo(() => sortLinii(localLinii), [localLinii])
  const activeStageFilter = searchParams.get('stadiu') ?? 'all'

  const stageOptions = useMemo(() => {
    const seen = new Map<string, { label: string; theme: ReturnType<typeof resolveStageTheme> }>()
    for (const linie of orderedLinii) {
      const label = resolveGroupTitle(linie, grupBiologic)
      if (!seen.has(linie.stadiu_trigger)) {
        seen.set(linie.stadiu_trigger, { label, theme: resolveStageTheme(label) })
      }
    }

    return Array.from(seen.entries())
      .sort((first, second) => {
        const firstTheme = first[1].theme
        const secondTheme = second[1].theme
        const orderDiff = firstTheme.order - secondTheme.order
        if (orderDiff !== 0) return orderDiff
        return first[1].label.localeCompare(second[1].label, 'ro')
      })
      .map(([value, item]) => ({ value, label: item.label, theme: item.theme }))
  }, [grupBiologic, orderedLinii])

  const filteredLinii = useMemo(() => {
    if (activeStageFilter === 'all') return orderedLinii
    return orderedLinii.filter((linie) => linie.stadiu_trigger === activeStageFilter)
  }, [activeStageFilter, orderedLinii])

  const groupedLinii = useMemo(() => {
    const groups = new Map<
      string,
      {
        label: string
        theme: ReturnType<typeof resolveStageTheme>
        items: Array<{ index: number; linie: PlanTratamentLinieCuProdus }>
      }
    >()

    filteredLinii.forEach((linie) => {
      const label = resolveGroupTitle(linie, grupBiologic)
      const current = groups.get(linie.stadiu_trigger) ?? {
        label,
        theme: resolveStageTheme(label),
        items: [],
      }
      current.items.push({ index: orderedLinii.findIndex((item) => item.id === linie.id), linie })
      groups.set(linie.stadiu_trigger, current)
    })

    return Array.from(groups.entries())
      .sort((first, second) => {
        const orderDiff = first[1].theme.order - second[1].theme.order
        if (orderDiff !== 0) return orderDiff
        return first[1].label.localeCompare(second[1].label, 'ro')
      })
      .map(([value, item]) => ({ value, ...item }))
  }, [filteredLinii, grupBiologic, orderedLinii])

  function openAddDialog() {
    setEditingLinie(null)
    setEditorOpen(true)
  }

  function setStageFilter(stage: string) {
    const query = buildStageFilterQuery(typeof window === 'undefined' ? '' : window.location.search, stage)
    const nextUrl = query ? `${window.location.pathname}?${query}` : window.location.pathname
    router.replace(nextUrl, { scroll: false })
  }

  function handleReorder(from: number, to: number) {
    if (to < 0 || to >= orderedLinii.length) return

    const previous = orderedLinii
    const reordered = withConsecutiveOrder(arrayMove(previous, from, to))
    setLocalLinii(reordered)

    startTransition(async () => {
      const result = await reorderLiniiAction(planId, reordered.map((linie) => linie.id))
      if (!result.ok) {
        setLocalLinii(previous)
        toast.error(result.error)
        return
      }

      toast.success('Ordinea liniilor a fost actualizată.')
    })
  }

  async function handleSaveLinie(data: LinieEditValue) {
    const payload: LinieInput = {
      stadiu_trigger: data.stadiu_trigger,
      cohort_trigger: data.cohort_trigger,
      tip_interventie: data.tip_interventie,
      scop: data.scop,
      regula_repetare: data.regula_repetare,
      interval_repetare_zile: data.interval_repetare_zile,
      numar_repetari_max: data.numar_repetari_max,
      produs_id: data.produs_id,
      produs_nume_manual: data.produs_nume_manual,
      doza_ml_per_hl: data.doza_ml_per_hl,
      doza_l_per_ha: data.doza_l_per_ha,
      observatii: data.observatii,
      produse: data.produse.map((produs, index) => ({
        ordine: index + 1,
        produs_id: produs.produs_id,
        produs_nume_manual: produs.produs_nume_manual,
        produs_nume_snapshot: produs.produs_nume_snapshot,
        substanta_activa_snapshot: produs.substanta_activa_snapshot,
        tip_snapshot: produs.tip_snapshot,
        frac_irac_snapshot: produs.frac_irac_snapshot,
        phi_zile_snapshot: produs.phi_zile_snapshot,
        doza_ml_per_hl: produs.doza_ml_per_hl,
        doza_l_per_ha: produs.doza_l_per_ha,
        observatii: produs.observatii,
      })),
    }

    const result = editingLinie
      ? await updateLinieAction(editingLinie.id, payload)
      : await addLinieAction(planId, payload)

    if (!result.ok) {
      toast.error(result.error)
      return
    }

    toast.success(editingLinie ? 'Intervenția a fost actualizată.' : 'Intervenția a fost adăugată.')
    setEditorOpen(false)
    setEditingLinie(null)
    router.refresh()
  }

  async function handleDeleteLinie() {
    if (!pendingDeleteLinie) return

    const result = await deleteLinieAction(pendingDeleteLinie.id)
    if (!result.ok) {
      toast.error(result.error)
      return
    }

    toast.success('Intervenția a fost ștearsă.')
    setDeleteOpen(false)
    setPendingDeleteLinie(null)
    router.refresh()
  }

  return (
    <section className="space-y-4">
      {/* --- SECTION: header --- */}
      <AppCard className="rounded-[22px] p-4 sm:p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-1">
            <h2 className="text-lg tracking-[-0.02em] text-[var(--text-primary)] [font-weight:650]">
              Intervenții planificate ({orderedLinii.length})
            </h2>
            <p className="text-sm leading-relaxed text-[var(--text-secondary)]">
              Editează, reordonează sau adaugă intervenții direct din detaliul planului.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" className="bg-[var(--agri-primary)] text-white" onClick={openAddDialog}>
              <Plus className="h-4 w-4" aria-label="Adaugă intervenție" />
              <span className="hidden sm:inline">Adaugă intervenție</span>
            </Button>
            <Button type="button" variant="outline" onClick={() => setManualEditorOpen(true)}>
              <Plus className="h-4 w-4" />
              Intervenție manuală
            </Button>
          </div>
        </div>
      </AppCard>

      {/* --- SECTION: stage filters --- */}
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setStageFilter('all')}
          className={`rounded-full px-3 py-2 text-xs font-semibold transition ${
            activeStageFilter === 'all'
              ? 'bg-[#3D7A5F] text-white'
              : 'bg-[#F3F4F6] text-[#374151]'
          }`}
        >
          Toate
        </button>
        {stageOptions.map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => setStageFilter(option.value)}
            className={`rounded-full px-3 py-2 text-xs font-semibold transition ${
              activeStageFilter === option.value
                ? 'bg-[#3D7A5F] text-white'
                : 'bg-[#F3F4F6] text-[#374151]'
            }`}
          >
            {option.theme.emoji} {option.label}
          </button>
        ))}
      </div>

      {/* --- SECTION: grouped lines --- */}
      {orderedLinii.length === 0 ? (
        <AppCard className="rounded-[22px] border-dashed p-6 text-center">
          <p className="text-sm text-[var(--text-secondary)]">
            Nu există încă intervenții în acest plan.
          </p>
          <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:justify-center">
            <Button type="button" variant="outline" onClick={openAddDialog}>
              + Adaugă intervenție
            </Button>
            <Button type="button" variant="outline" onClick={() => setManualEditorOpen(true)}>
              <Plus className="h-4 w-4" />
              Adaugă intervenție manuală
            </Button>
          </div>
        </AppCard>
      ) : groupedLinii.length === 0 ? (
        <AppCard className="rounded-[22px] p-6 text-center">
          <p className="text-sm text-[var(--text-secondary)]">Nicio intervenție nu se potrivește filtrului de stadiu.</p>
        </AppCard>
      ) : (
        <div className="space-y-4">
          {groupedLinii.map((group) => {
            const collapsed = collapsedGroups[group.value] ?? false
            const total = group.items.length
            const done = 0
            const percent = total > 0 ? Math.round((done / total) * 100) : 0

            return (
              <section key={group.value} className="space-y-3">
                <button
                  type="button"
                  className="flex w-full items-center gap-3 text-left"
                  onClick={() =>
                    setCollapsedGroups((current) => ({
                      ...current,
                      [group.value]: !collapsed,
                    }))
                  }
                >
                  <span className="text-sm" aria-hidden>
                    {group.theme.emoji}
                  </span>
                  <p className="text-xs font-bold uppercase tracking-widest" style={{ color: group.theme.accent }}>
                    {group.label}
                  </p>
                  <div className="h-px flex-1 bg-gray-200" />
                  <p className="text-xs text-gray-400">{done}/{total}</p>
                </button>
                <div className="h-[3px] w-full overflow-hidden rounded-full bg-gray-100">
                  <div
                    className="h-full rounded-full transition-all duration-200"
                    style={{ width: `${percent}%`, backgroundColor: group.theme.accent }}
                  />
                </div>

                {!collapsed ? (
                  <div className="space-y-0">
                    {group.items.map(({ index, linie }) => (
                      <LinieRow
                        key={linie.id}
                        grupBiologic={grupBiologic}
                        index={index}
                        linie={linie}
                        total={orderedLinii.length}
                        // --- FIX 2: propagare callback mark aplicată când există în părinte ---
                        onMarkAplicata={onMarkAplicata}
                        onMoveUp={() => handleReorder(index, index - 1)}
                        onMoveDown={() => handleReorder(index, index + 1)}
                        onEdit={() => {
                          setEditingLinie(linie)
                          setEditorOpen(true)
                        }}
                        onDelete={() => {
                          setPendingDeleteLinie(linie)
                          setDeleteOpen(true)
                        }}
                      />
                    ))}
                  </div>
                ) : null}
              </section>
            )
          })}
        </div>
      )}

      <LinieEditDialog
        allowCohortTrigger={allowCohortTrigger}
        culturaTip={culturaTip}
        grupBiologic={grupBiologic}
        initialValue={toEditValue(editingLinie)}
        onOpenChange={(nextOpen) => {
          setEditorOpen(nextOpen)
          if (!nextOpen) {
            setEditingLinie(null)
          }
        }}
        onSubmit={handleSaveLinie}
        open={editorOpen}
        pending={isPending}
        produse={produse}
        title={editingLinie ? 'Editează intervenția' : 'Adaugă intervenție'}
      />

      <LinieDeleteDialog
        open={deleteOpen}
        onOpenChange={(nextOpen) => {
          setDeleteOpen(nextOpen)
          if (!nextOpen) {
            setPendingDeleteLinie(null)
          }
        }}
        onConfirm={handleDeleteLinie}
        pending={isPending}
        stadiuLabel={pendingDeleteLinie ? getStadiuMeta(pendingDeleteLinie.stadiu_trigger, grupBiologic, pendingDeleteLinie.cohort_trigger).label : 'selectat'}
      />

      <AdaugaInterventieManualDialog
        cultura={culturaTip}
        grupBiologic={grupBiologic}
        onOpenChange={setManualEditorOpen}
        onSuccess={() => {
          setManualEditorOpen(false)
          router.refresh()
        }}
        open={manualEditorOpen}
        planId={planId}
        produse={produse}
      />
    </section>
  )
}
