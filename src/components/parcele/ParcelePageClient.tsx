'use client'

import dynamic from 'next/dynamic'
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { CalendarDays, ChevronDown, ChevronUp, Clock3, Droplets, ListChecks, Map as MapIcon, SprayCan, Sprout } from 'lucide-react'
import { useRouter, useSearchParams } from 'next/navigation'

import { AppShell } from '@/components/app/AppShell'
import { DashboardContentShell } from '@/components/app/DashboardContentShell'
import { ErrorState } from '@/components/app/ErrorState'
import { EntityListSkeleton } from '@/components/app/ListSkeleton'
import {
  ModuleEmptyCard,
  ModulePillFilterButton,
  ModulePillRow,
} from '@/components/app/module-list-chrome'
import { PageHeader } from '@/components/app/PageHeader'
import { useMobileScrollRestore } from '@/components/app/useMobileScrollRestore'
import { ResponsiveFormContainer } from '@/components/ui/ResponsiveFormContainer'
import { MobileEntityCard } from '@/components/ui/MobileEntityCard'
import { SearchField } from '@/components/ui/SearchField'
import { useAddAction } from '@/contexts/AddActionContext'
import { useTrackModuleView } from '@/lib/analytics/useTrackModuleView'
import { useMeteo } from '@/hooks/useMeteo'
import { MicroclimatAutoCard } from '@/components/parcele/MicroclimatAutoCard'
import type { CropCod } from '@/lib/crops/crop-codes'
import { normalizeCropCod } from '@/lib/crops/crop-codes'
import { getConditiiMediuLabel } from '@/lib/parcele/culturi'
import { normalizeUnitateTip, type UnitateTip } from '@/lib/parcele/unitate'
import { buildLatestActivityByParcela, getActivityDaysAgo, getActivityPauseRemainingDays } from '@/lib/activitati/timeline'
import { queryKeys } from '@/lib/query-keys'
import { cn } from '@/lib/utils'
import { getActivitatiAgricole, type ActivitateAgricola } from '@/lib/supabase/queries/activitati-agricole'
import {
  createParcelaStadiuCanonic,
  getConfigurareSezonParcela,
  getStadiiCanoniceParcela,
  type ConfigurareParcelaSezon,
  type ParcelaStadiuCanonic,
} from '@/lib/supabase/queries/parcela-stadii'
import { getSolarClimateLogs } from '@/lib/supabase/queries/solar-tracking'
import {
  getActiveCulturiCountsByParcela,
  getEtapeCulturaById,
  type Cultura,
  type EtapaCultura,
} from '@/lib/supabase/queries/culturi'
import { getCulturiForSolar } from '@/lib/supabase/queries/culturi'
import { deleteParcela, getParcele, type Parcela } from '@/lib/supabase/queries/parcele'
import { getRecoltari } from '@/lib/supabase/queries/recoltari'
import type { Cohorta } from '@/lib/tratamente/configurare-sezon'
import {
  getGrupBiologicForCropCod,
  getLabelPentruGrup,
  getOrdine,
  getOrdineInGrup,
  listAllStadiiCanonice,
  listStadiiPentruGrup,
  normalizeStadiu,
  type GrupBiologic,
  type StadiuCod,
} from '@/lib/tratamente/stadii-canonic'
import { buildParcelaDeleteLabel } from '@/lib/ui/delete-labels'
import { toast } from '@/lib/ui/toast'
import { getCurrentSezon } from '@/lib/utils/sezon'
import {
  coerceParcelaScopFromDb,
  coerceStatusOperationalFromDb,
  SCOP_LABELS,
  STATUS_OPERATIONAL_LABELS,
  type ParcelaScop,
  type StatusOperational,
} from '@/lib/parcele/dashboard-relevance'

const AddParcelDrawer = dynamic(
  () => import('@/components/parcele/AddParcelDrawer').then((mod) => mod.AddParcelDrawer),
  { ssr: false }
)
const EditParcelDialog = dynamic(
  () => import('@/components/parcele/EditParcelDialog').then((mod) => mod.EditParcelDialog),
  { ssr: false }
)
const ConfirmDeleteDialog = dynamic(
  () => import('@/components/app/ConfirmDeleteDialog').then((mod) => mod.ConfirmDeleteDialog),
  { ssr: false }
)
const AddActivitateAgricolaDialog = dynamic(
  () => import('@/components/activitati-agricole/AddActivitateAgricolaDialog').then((mod) => mod.AddActivitateAgricolaDialog),
  { ssr: false }
)
const AddCulturaDialog = dynamic(
  () => import('@/components/parcele/AddCulturaDialog').then((mod) => mod.AddCulturaDialog),
  { ssr: false }
)
const AddMicroclimatDialog = dynamic(
  () => import('@/components/parcele/AddMicroclimatDialog').then((mod) => mod.AddMicroclimatDialog),
  { ssr: false }
)
const DesfiinteazaCulturaDialog = dynamic(
  () => import('@/components/parcele/DesfiinteazaCulturaDialog').then((mod) => mod.DesfiinteazaCulturaDialog),
  { ssr: false }
)

interface ParcelePageClientProps {
  initialError?: string | null
}

type UnitFilter = 'toate' | UnitateTip
type JournalTypeFilter = 'all' | 'activitati' | 'tratamente' | 'recoltari' | 'stadii'
type JournalPeriodFilter = '7d' | '30d' | 'sezon' | 'tot'

export type MeteoAutoSummary =
  | { state: 'empty'; reason: string }
  | { state: 'loading'; reason: string }
  | {
      state: 'ready'
      temperature: number | null
      humidity: number | null
      rainChance: number | null
      wind: number | null
      fetchedAt: string | null
      source: 'cache' | 'fresh' | null
      locationSource: 'parcela' | 'fallback' | 'none'
      locationLabel: string | null
    }

const SOIURI_DISPONIBILE = ['Delniwa', 'Maravilla', 'Enrosadira', 'Husaria']

const PILL_FILTERS: Array<{ key: UnitFilter; label: string }> = [
  { key: 'toate', label: 'Toate' },
  { key: 'camp', label: 'Câmp' },
  { key: 'cultura_mare', label: 'Cultură mare' },
  { key: 'solar', label: 'Solarii' },
  { key: 'livada', label: 'Livadă' },
]

function resolveUnitFilterParam(searchParams: ReturnType<typeof useSearchParams>): UnitFilter {
  const nextFilter = searchParams.get('unitFilter') ?? searchParams.get('tip')
  if (nextFilter === 'camp' || nextFilter === 'cultura_mare' || nextFilter === 'solar' || nextFilter === 'livada') {
    return nextFilter
  }

  return 'toate'
}

function toIsoDate(value: Date): string {
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(
    value.getDate()
  ).padStart(2, '0')}`
}

function normalizeStr(value: string | null | undefined): string {
  return (value ?? '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
}

function unitIcon(tipUnitate: string | null | undefined): { emoji: string; bg: string } {
  const t = normalizeUnitateTip(tipUnitate)
  if (t === 'cultura_mare') return { emoji: '🚜', bg: 'linear-gradient(135deg, #f7f0dd, #ead7ad)' }
  if (t === 'solar') return { emoji: '🏡', bg: 'linear-gradient(135deg, #e8f5e9, #b9e6c0)' }
  if (t === 'livada') return { emoji: '🍎', bg: 'linear-gradient(135deg, #fef3e2, #fde6c4)' }
  return { emoji: '🌿', bg: 'linear-gradient(135deg, #e3f2e8, #c8e6cf)' }
}

function operationalBadge(statusOperational: StatusOperational): { text: string; color: string; bg: string } {
  const label = STATUS_OPERATIONAL_LABELS[statusOperational]
  if (statusOperational === 'activ') {
    return { text: label, color: 'var(--status-success-text)', bg: 'var(--status-success-bg)' }
  }
  if (statusOperational === 'in_pauza' || statusOperational === 'infiintare') {
    return { text: label, color: 'var(--status-warning-text)', bg: 'var(--status-warning-bg)' }
  }
  if (statusOperational === 'neproductiv' || statusOperational === 'arhivat') {
    return { text: label, color: 'var(--status-danger-text)', bg: 'var(--status-danger-bg)' }
  }
  return { text: label, color: 'var(--status-neutral-text)', bg: 'var(--status-neutral-bg)' }
}

function operationalToneForCard(statusOperational: StatusOperational): 'neutral' | 'success' | 'warning' | 'danger' {
  if (statusOperational === 'activ') return 'success'
  if (statusOperational === 'in_pauza' || statusOperational === 'infiintare') return 'warning'
  if (statusOperational === 'neproductiv' || statusOperational === 'arhivat') return 'danger'
  return 'neutral'
}

function etapaDotColor(etapa: string): string {
  const cod = normalizeStadiu(etapa)
  const e = (cod ?? etapa).toLowerCase()
  if (e.includes('plantare') || e.includes('flori') || e.includes('fructif') || e.includes('cules')) return '#3D7A5F'
  if (e.includes('seceta') || e.includes('daun') || e.includes('problem') || e.includes('desfiin')) return '#e85d5d'
  return '#95b8a0'
}

function formatEtapaLabel(
  value: string | null | undefined,
  grupBiologic?: GrupBiologic | null,
  cohort?: string | null
): string {
  const raw = (value ?? '').trim()
  if (!raw) return 'Stadiu nedefinit'
  const cod = normalizeStadiu(raw)
  if (cod) return getLabelPentruGrup(cod, grupBiologic, { cohort })
  const normalized = raw.replaceAll('_', ' ').trim()
  return normalized.charAt(0).toUpperCase() + normalized.slice(1)
}

function getStadiuOrder(cod: StadiuCod, grupBiologic: GrupBiologic | null): number {
  if (grupBiologic) {
    const indexInGroup = getOrdineInGrup(cod, grupBiologic)
    if (indexInGroup >= 0) return indexInGroup
  }
  return getOrdine(cod) + 100
}

function getCurrentCanonicalStage(
  stages: ParcelaStadiuCanonic[],
  grupBiologic: GrupBiologic | null
): ParcelaStadiuCanonic | null {
  if (stages.length === 0) return null

  return [...stages].sort((a, b) => {
    const codA = normalizeStadiu(a.stadiu)
    const codB = normalizeStadiu(b.stadiu)
    const orderA = codA ? getStadiuOrder(codA, grupBiologic) : Number.MIN_SAFE_INTEGER
    const orderB = codB ? getStadiuOrder(codB, grupBiologic) : Number.MIN_SAFE_INTEGER
    const orderDiff = orderB - orderA
    if (orderDiff !== 0) return orderDiff

    const observedDiff = new Date(b.data_observata).getTime() - new Date(a.data_observata).getTime()
    if (observedDiff !== 0) return observedDiff

    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  })[0] ?? null
}

function toErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) return error.message
  if (typeof error === 'string' && error.trim()) return error
  if (typeof error === 'object' && error !== null) {
    const maybeMessage = (error as { message?: unknown }).message
    if (typeof maybeMessage === 'string' && maybeMessage.trim()) return maybeMessage
  }
  return 'A apărut o eroare neașteptată.'
}

function activityRelativeTime(dateStr: string | null | undefined, today: Date): string {
  const days = getActivityDaysAgo({ data_aplicare: dateStr }, today)
  if (days === null) return 'Nicio activitate'
  if (days === 0) return 'azi'
  if (days === 1) return 'ieri'
  if (days < 0) return 'în viitor'
  return `acum ${days} zile`
}

function unitTypeLabel(tipUnitate: string | null | undefined): string {
  const normalized = normalizeUnitateTip(tipUnitate)
  if (normalized === 'cultura_mare') return 'Cultură mare'
  if (normalized === 'solar') return 'Solarii'
  if (normalized === 'livada') return 'Livadă'
  return 'Câmp'
}

function formatCampPlanteCount(parcela: Parcela): string | null {
  if (normalizeUnitateTip(parcela.tip_unitate) !== 'camp') return null
  const n = parcela.nr_plante
  if (n == null || n <= 0) return null
  return `${new Intl.NumberFormat('ro-RO').format(n)} pl.`
}

function formatSuprafata(suprafataMp: number | null | undefined): string | null {
  if (!suprafataMp || suprafataMp <= 0) return null

  if (suprafataMp < 10_000) {
    return `${new Intl.NumberFormat('ro-RO', {
      maximumFractionDigits: 0,
    }).format(Math.round(suprafataMp))} mp`
  }

  const hectares = suprafataMp / 10_000
  const formatter = new Intl.NumberFormat('ro-RO', {
    minimumFractionDigits: hectares < 1 ? 2 : 0,
    maximumFractionDigits: 2,
  })

  return `${formatter.format(hectares)} ha`
}

function formatActivityDateShort(dateStr: string | null | undefined): string | null {
  if (!dateStr) return null

  const parsed = new Date(dateStr)
  if (Number.isNaN(parsed.getTime())) return null

  return new Intl.DateTimeFormat('ro-RO', {
    day: 'numeric',
    month: 'short',
  }).format(parsed)
}

function asFiniteCoord(value: unknown): number | null {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function resolveParcelaMeteoCoords(parcela: Parcela | null | undefined): { lat: number; lon: number } | null {
  if (!parcela) return null
  const lat = asFiniteCoord(parcela.latitudine) ?? asFiniteCoord(parcela.gps_lat)
  const lon = asFiniteCoord(parcela.longitudine) ?? asFiniteCoord(parcela.gps_lng)
  if (lat === null || lon === null) return null
  return { lat, lon }
}

function buildParcelaDesktopMeta(parcela: Parcela): string {
  const scop: ParcelaScop = coerceParcelaScopFromDb(parcela.rol)
  const meta = [
    unitTypeLabel(parcela.tip_unitate),
    parcela.soi_plantat?.trim() || parcela.soi?.trim() || parcela.cultura?.trim() || parcela.tip_fruct?.trim(),
    formatSuprafata(parcela.suprafata_m2),
    SCOP_LABELS[scop],
  ].filter(Boolean)

  return meta.join(' · ')
}

function buildParcelaCulturaSoiLine(parcela: Parcela): string | null {
  const raw =
    parcela.soi_plantat?.trim() ||
    parcela.soi?.trim() ||
    parcela.cultura?.trim() ||
    parcela.tip_fruct?.trim() ||
    ''
  return raw || null
}

/** Subtitlu inspector: tip + suprafață + cultură/soi (fără query-uri noi). */
function buildParcelaInspectorSubtitle(parcela: Parcela): string {
  const culturaSoi = buildParcelaCulturaSoiLine(parcela)
  const parts = [
    unitTypeLabel(parcela.tip_unitate),
    formatSuprafata(parcela.suprafata_m2),
    culturaSoi,
    formatCampPlanteCount(parcela),
  ].filter(Boolean)
  return parts.join(' · ')
}

/** Linie secundară listă desktop: tip + cultură/soi + suprafață. */
function buildParcelaListSecondaryLine(parcela: Parcela): string {
  const culturaSoi = buildParcelaCulturaSoiLine(parcela)
  const parts = [
    unitTypeLabel(parcela.tip_unitate),
    culturaSoi,
    formatSuprafata(parcela.suprafata_m2),
    formatCampPlanteCount(parcela),
  ].filter(Boolean)
  return parts.join(' · ')
}

function journalEventCountLabel(total: number): string {
  if (total === 0) return 'Nicio înregistrare în jurnal'
  if (total === 1) return '1 eveniment în jurnal'
  return `${total} evenimente în jurnal`
}

function getCulturiCountLabel(count: number, withActiveSuffix = false): string {
  if (count === 1) return withActiveSuffix ? '1 cultură activă' : '1 cultură'
  return withActiveSuffix ? `${count} culturi active` : `${count} culturi`
}

function buildParcelaSummaryLine(parcela: Parcela, activeCulturiCount: number): string {
  const agronomicStatus = (parcela.status ?? '').trim()
  const summary = [
    parcela.soi_plantat?.trim() ||
      parcela.soi?.trim() ||
      parcela.cultura?.trim() ||
      parcela.tip_fruct?.trim() ||
      unitTypeLabel(parcela.tip_unitate),
    formatSuprafata(parcela.suprafata_m2),
    activeCulturiCount > 0 ? getCulturiCountLabel(activeCulturiCount) : null,
    agronomicStatus && agronomicStatus.toLowerCase() !== 'activ' ? `Status cultură: ${agronomicStatus}` : null,
  ].filter(Boolean)

  return summary.join(' · ')
}

function isTreatmentLikeActivity(activity: ActivitateAgricola): boolean {
  const tip = normalizeStr(activity.tip_activitate)
  return (
    Number(activity.timp_pauza_zile || 0) > 0 ||
    Boolean((activity.produs_utilizat ?? '').trim()) ||
    tip.includes('trat') ||
    tip.includes('strop') ||
    tip.includes('fitosan') ||
    tip.includes('erbicid') ||
    tip.includes('fungicid') ||
    tip.includes('insecticid')
  )
}

function getJournalTypeLabel(value: JournalTypeFilter): string {
  if (value === 'activitati') return 'Activități'
  if (value === 'tratamente') return 'Tratamente'
  if (value === 'recoltari') return 'Recoltări'
  if (value === 'stadii') return 'Stadii'
  return 'Toate'
}

function getJournalPeriodLabel(value: JournalPeriodFilter): string {
  if (value === '7d') return '7 zile'
  if (value === '30d') return '30 zile'
  if (value === 'sezon') return 'Sezon'
  return 'Tot'
}

function getJournalPeriodStart(period: JournalPeriodFilter, seasonYear: number): Date | null {
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  if (period === 'tot') return null
  if (period === 'sezon') return new Date(seasonYear, 0, 1)

  const days = period === '7d' ? 7 : 30
  const start = new Date(today)
  start.setDate(start.getDate() - (days - 1))
  return start
}

function getJournalEntryKind(entry: { id: string }): 'activitate' | 'tratament' | 'recoltare' | 'stadiu' {
  if (entry.id.startsWith('recoltare:')) return 'recoltare'
  if (entry.id.startsWith('stadiu:')) return 'stadiu'
  if (entry.id.startsWith('activitate:tratament:')) return 'tratament'
  if (entry.id.startsWith('activitate:')) return 'activitate'
  return 'activitate'
}

function getJournalKindMeta(kind: 'activitate' | 'tratament' | 'recoltare' | 'stadiu'): {
  icon: React.ReactNode
  label: string
  toneClass: string
} {
  if (kind === 'tratament') {
    return {
      icon: <SprayCan className="h-3.5 w-3.5" aria-hidden />,
      label: 'Tratament',
      toneClass: 'border-[var(--status-warning-border)] bg-[var(--status-warning-bg)] text-[var(--status-warning-text)]',
    }
  }
  if (kind === 'recoltare') {
    return {
      icon: <CalendarDays className="h-3.5 w-3.5" aria-hidden />,
      label: 'Recoltare',
      toneClass: 'border-[var(--status-success-border)] bg-[var(--status-success-bg)] text-[var(--status-success-text)]',
    }
  }
  if (kind === 'stadiu') {
    return {
      icon: <ListChecks className="h-3.5 w-3.5" aria-hidden />,
      label: 'Stadiu',
      toneClass: 'border-[var(--button-muted-border)] bg-[var(--button-muted-bg)] text-[var(--button-muted-text)]',
    }
  }

  return {
    icon: <Sprout className="h-3.5 w-3.5" aria-hidden />,
    label: 'Activitate',
    toneClass: 'border-[var(--status-info-border)] bg-[var(--status-info-bg)] text-[var(--status-info-text)]',
  }
}

function CulturaCard({
  cultura,
  parcelaId,
  parcelaCropCodHint,
  seasonConfig,
  canonicalStages,
  onDesfiintaCultura,
}: {
  cultura: Cultura
  parcelaId: string
  parcelaCropCodHint: CropCod | null
  seasonConfig: ConfigurareParcelaSezon | null
  canonicalStages: ParcelaStadiuCanonic[]
  onDesfiintaCultura: (c: Cultura) => void
}) {
  const queryClient = useQueryClient()
  const [expanded, setExpanded] = useState(false)
  const [showAddForm, setShowAddForm] = useState(false)
  const [selectedStadiu, setSelectedStadiu] = useState('')
  const [selectedCohort, setSelectedCohort] = useState<Cohorta | ''>('')
  const [observatii, setObservatii] = useState('')
  const [dataEtapa, setDataEtapa] = useState(new Date().toISOString().slice(0, 10))
  const currentSezon = getCurrentSezon()

  const fallbackStage = (() => {
    const normalized = normalizeStr(cultura.stadiu)
    if (!normalized || normalized === 'crestere' || normalized === 'creștere') return 'Stadiu nedefinit'
    return formatEtapaLabel(cultura.stadiu)
  })()
  const name = [cultura.tip_planta, cultura.soi].filter(Boolean).join(' · ')
  const isActive = cultura.activa !== false

  const { data: etapeLegacy = [], isLoading: etapeLegacyLoading } = useQuery({
    queryKey: queryKeys.etapeCultura(cultura.id),
    queryFn: () => getEtapeCulturaById(cultura.id),
    enabled: expanded,
    staleTime: 30000,
    refetchOnWindowFocus: false,
  })
  const culturaCropCod = useMemo(() => normalizeCropCod(cultura.tip_planta), [cultura.tip_planta])
  const grupBiologic = useMemo(
    () => getGrupBiologicForCropCod(culturaCropCod ?? parcelaCropCodHint),
    [culturaCropCod, parcelaCropCodHint]
  )
  const stageOptions = useMemo(() => {
    const values = grupBiologic ? listStadiiPentruGrup(grupBiologic) : listAllStadiiCanonice()
    return values.map((cod) => ({
      value: cod,
      label: getLabelPentruGrup(cod, grupBiologic, { cohort: selectedCohort || null }),
    }))
  }, [grupBiologic, selectedCohort])
  const firstStageValue = stageOptions[0]?.value ?? 'repaus_vegetativ'
  const hasCanonicalCohorts = useMemo(
    () => canonicalStages.some((entry) => entry.cohort === 'floricane' || entry.cohort === 'primocane'),
    [canonicalStages]
  )
  const isRubusMixt =
    grupBiologic === 'rubus' &&
    (
      seasonConfig?.sistem_conducere === 'mixt_floricane_primocane' ||
      hasCanonicalCohorts
    )
  const currentCanonicalStage = useMemo(
    () => getCurrentCanonicalStage(canonicalStages, grupBiologic),
    [canonicalStages, grupBiologic]
  )
  const latestLegacyStage = etapeLegacy[0]?.etapa ?? fallbackStage
  const latestStageLabel = currentCanonicalStage
    ? formatEtapaLabel(currentCanonicalStage.stadiu, grupBiologic, currentCanonicalStage.cohort)
    : formatEtapaLabel(latestLegacyStage)

  const addMutation = useMutation({
    mutationFn: () => {
      if (!selectedStadiu) throw new Error('Selectează un stadiu')
      if (isRubusMixt && !selectedCohort) throw new Error('Selectează cohorta')

      return createParcelaStadiuCanonic({
        parcela_id: parcelaId,
        an: currentSezon,
        stadiu: selectedStadiu,
        cohort: selectedCohort ? (selectedCohort as Cohorta) : null,
        data_observata: dataEtapa,
        observatii: observatii || undefined,
      })
    },
    onSuccess: () => {
      toast.success('Stadiu salvat')
      queryClient.invalidateQueries({ queryKey: queryKeys.parcelaCultureStages(parcelaId) })
      setShowAddForm(false)
      setSelectedStadiu(firstStageValue)
      setSelectedCohort('')
      setObservatii('')
      setDataEtapa(new Date().toISOString().slice(0, 10))
    },
    onError: (err: unknown) => toast.error(toErrorMessage(err)),
  })

  return (
    <div
      className="w-full"
      style={{
        background: isActive ? 'var(--agri-surface)' : 'var(--agri-surface-muted)',
        border: `1px solid ${isActive ? 'var(--agri-border)' : 'var(--surface-divider)'}`,
        borderRadius: 10,
        padding: '8px 10px',
        opacity: isActive ? 1 : 0.6,
      }}
    >
      {/* Card header — tap to expand */}
      <div
        role="button"
        tabIndex={0}
        onClick={() => setExpanded((v) => !v)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setExpanded((v) => !v) }
        }}
        style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}
      >
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--agri-text)', lineHeight: 1.3 }}>{name}</div>
          {!isActive && cultura.data_desfiintare ? (
            <div style={{ fontSize: 10, color: 'var(--text-hint)', marginTop: 1 }}>
              Desființată {cultura.data_desfiintare}
            </div>
          ) : null}
        </div>
        <span
          style={{
            fontSize: 9,
            fontWeight: 700,
            borderRadius: 20,
            padding: '2px 7px',
            background: 'var(--agri-surface-muted)',
            color: 'var(--agri-text)',
            border: '1px solid var(--agri-border)',
            flexShrink: 0,
          }}
        >
          {latestStageLabel}
        </span>
        <span style={{ fontSize: 10, color: 'var(--text-hint)', flexShrink: 0 }}>{expanded ? '▲' : '▼'}</span>
      </div>

      {/* Expanded: timeline + add form */}
      {expanded ? (
        <div style={{ marginTop: 10 }}>
          {/* Timeline */}
          {canonicalStages.length === 0 && etapeLegacyLoading ? (
            <div style={{ fontSize: 11, color: 'var(--text-hint)', marginBottom: 8 }}>Se încarcă...</div>
          ) : canonicalStages.length > 0 ? (
            <div style={{ marginBottom: 8 }}>
              {canonicalStages.map((etapa) => (
                <div
                  key={etapa.id}
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: 8,
                    paddingBottom: 8,
                    position: 'relative',
                  }}
                >
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0, paddingTop: 2 }}>
                    <div
                      style={{
                        width: 8,
                        height: 8,
                        borderRadius: '50%',
                        background: etapaDotColor(etapa.stadiu),
                        flexShrink: 0,
                      }}
                    />
                    <div style={{ width: 1, flex: 1, background: 'var(--surface-divider)', minHeight: 12, marginTop: 2 }} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--agri-text)', lineHeight: 1.3 }}>
                      {formatEtapaLabel(etapa.stadiu, grupBiologic, etapa.cohort)}
                      {isRubusMixt && etapa.cohort ? (
                        <span style={{ marginLeft: 6, fontSize: 10, color: 'var(--agri-text-muted)' }}>
                          · {etapa.cohort === 'floricane' ? 'Floricane' : 'Primocane'}
                        </span>
                      ) : null}
                    </div>
                    {etapa.observatii ? (
                      <div style={{ fontSize: 10, color: 'var(--agri-text-muted)', marginTop: 1 }}>{etapa.observatii}</div>
                    ) : null}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2, flexShrink: 0 }}>
                    <span style={{ fontSize: 10, color: 'var(--text-hint)' }}>{etapa.data_observata}</span>
                  </div>
                </div>
              ))}
              {etapeLegacy.length > 0 ? (
                <div style={{ marginTop: 6, fontSize: 10, color: 'var(--text-hint)' }}>
                  Istoric vechi disponibil ({etapeLegacy.length})
                </div>
              ) : null}
            </div>
          ) : etapeLegacy.length === 0 ? (
            <div
              style={{
                fontSize: 11,
                color: 'var(--text-hint)',
                marginBottom: 8,
                textAlign: 'center',
                padding: '4px 0',
              }}
            >
              Nicio etapă înregistrată
            </div>
          ) : (
            <div style={{ marginBottom: 8 }}>
              {etapeLegacy.map((etapa: EtapaCultura) => (
                <div
                  key={etapa.id}
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: 8,
                    paddingBottom: 8,
                    position: 'relative',
                  }}
                >
                  {/* Vertical line + dot */}
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0, paddingTop: 2 }}>
                    <div
                      style={{
                        width: 8,
                        height: 8,
                        borderRadius: '50%',
                        background: etapaDotColor(etapa.etapa),
                        flexShrink: 0,
                      }}
                    />
                    <div style={{ width: 1, flex: 1, background: 'var(--surface-divider)', minHeight: 12, marginTop: 2 }} />
                  </div>
                  {/* Content */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--agri-text)', lineHeight: 1.3 }}>
                      {formatEtapaLabel(etapa.etapa)}
                      <span style={{ marginLeft: 6, fontSize: 10, color: 'var(--text-hint)' }}>· Istoric vechi</span>
                    </div>
                    {etapa.observatii ? (
                      <div style={{ fontSize: 10, color: 'var(--agri-text-muted)', marginTop: 1 }}>{etapa.observatii}</div>
                    ) : null}
                  </div>
                  {/* Date + delete */}
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2, flexShrink: 0 }}>
                    <span style={{ fontSize: 10, color: 'var(--text-hint)' }}>{etapa.data_etapa}</span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Add etapa button */}
          {isActive && !showAddForm ? (
            <button
              type="button"
              onClick={() => {
                setSelectedStadiu(firstStageValue)
                setSelectedCohort('')
                setShowAddForm(true)
              }}
              style={{
                width: '100%',
                padding: '8px 0',
                fontSize: 11,
                fontWeight: 600,
                background: 'var(--pill-active-bg)',
                color: 'var(--pill-active-text)',
                border: '1px solid var(--pill-active-border)',
                borderRadius: 10,
                cursor: 'pointer',
                marginBottom: 8,
              }}
            >
              ＋ Actualizează stadiu
            </button>
          ) : null}

          {showAddForm ? (
            <ResponsiveFormContainer
              open={showAddForm}
              onOpenChange={(nextOpen) => {
                setShowAddForm(nextOpen)
                if (!nextOpen) {
                  setSelectedStadiu(firstStageValue)
                  setSelectedCohort('')
                  setObservatii('')
                }
              }}
              title="Actualizează stadiu"
              desktopClassName="max-w-xl"
            >
              <div
                style={{
                  background: 'var(--surface-elevated)',
                  border: '1px solid var(--agri-border)',
                  borderRadius: 10,
                  padding: 10,
                  marginBottom: 8,
                }}
              >
                <select
                  value={selectedStadiu}
                  onChange={(e) => setSelectedStadiu(e.target.value)}
                  style={{
                    width: '100%',
                    fontSize: 12,
                    padding: '6px 10px',
                    borderRadius: 8,
                    border: '1px solid var(--input)',
                    background: 'var(--agri-surface)',
                    color: 'var(--agri-text)',
                    marginBottom: 6,
                    boxSizing: 'border-box',
                  }}
                >
                  {stageOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                {isRubusMixt ? (
                  <select
                    value={selectedCohort}
                    onChange={(e) => setSelectedCohort((e.target.value as Cohorta | '') || '')}
                    style={{
                      width: '100%',
                      fontSize: 12,
                      padding: '6px 10px',
                      borderRadius: 8,
                      border: '1px solid var(--input)',
                      background: 'var(--agri-surface)',
                      color: 'var(--agri-text)',
                      marginBottom: 6,
                      boxSizing: 'border-box',
                    }}
                  >
                    <option value="">Selectează cohorta</option>
                    <option value="floricane">Floricane</option>
                    <option value="primocane">Primocane</option>
                  </select>
                ) : null}
                {/* Observatii */}
                <textarea
                  value={observatii}
                  onChange={(e) => setObservatii(e.target.value)}
                  placeholder="Observații (opțional)..."
                  rows={2}
                    style={{
                      width: '100%',
                      fontSize: 12,
                      padding: '6px 10px',
                      borderRadius: 8,
                      border: '1px solid var(--input)',
                      background: 'var(--agri-surface)',
                      color: 'var(--agri-text)',
                      resize: 'none',
                      marginBottom: 6,
                      boxSizing: 'border-box',
                  }}
                />
                {/* Data */}
                <input
                  type="date"
                  value={dataEtapa}
                  onChange={(e) => setDataEtapa(e.target.value)}
                    style={{
                      width: '100%',
                      fontSize: 12,
                      padding: '6px 10px',
                      borderRadius: 8,
                      border: '1px solid var(--input)',
                      background: 'var(--agri-surface)',
                      color: 'var(--agri-text)',
                      marginBottom: 8,
                      boxSizing: 'border-box',
                    }}
                />
                {/* Actions */}
                <div style={{ display: 'flex', gap: 6 }}>
                  <button
                    type="button"
                    onClick={() => {
                      setShowAddForm(false)
                      setSelectedStadiu(firstStageValue)
                      setSelectedCohort('')
                      setObservatii('')
                    }}
                    style={{
                      flex: 1,
                      padding: '7px 0',
                      fontSize: 11,
                      fontWeight: 600,
                      background: 'var(--button-muted-bg)',
                      color: 'var(--button-muted-text)',
                      border: '1px solid var(--button-muted-border)',
                      borderRadius: 8,
                      cursor: 'pointer',
                    }}
                  >
                    Anulează
                  </button>
                  <button
                    type="button"
                    onClick={() => addMutation.mutate()}
                    disabled={addMutation.isPending || !selectedStadiu || (isRubusMixt && !selectedCohort)}
                    style={{
                      flex: 1,
                      padding: '7px 0',
                      fontSize: 11,
                      fontWeight: 600,
                      background:
                        addMutation.isPending || !selectedStadiu || (isRubusMixt && !selectedCohort)
                          ? 'var(--agri-surface-muted)'
                          : 'var(--pill-active-bg)',
                      color:
                        addMutation.isPending || !selectedStadiu || (isRubusMixt && !selectedCohort)
                          ? 'var(--text-hint)'
                          : 'var(--pill-active-text)',
                      border: `1px solid ${
                        addMutation.isPending || !selectedStadiu || (isRubusMixt && !selectedCohort)
                          ? 'var(--agri-border)'
                          : 'var(--pill-active-border)'
                      }`,
                      borderRadius: 8,
                      cursor: addMutation.isPending || !selectedStadiu || (isRubusMixt && !selectedCohort) ? 'default' : 'pointer',
                    }}
                  >
                    {addMutation.isPending ? 'Se salvează...' : 'Salvează'}
                  </button>
                </div>
              </div>
            </ResponsiveFormContainer>
          ) : null}

          {/* Desființă button */}
  {isActive ? (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onDesfiintaCultura(cultura) }}
              style={{
                width: '100%',
                padding: '6px 0',
                fontSize: 10,
                fontWeight: 600,
                background: 'var(--status-danger-bg)',
                color: 'var(--status-danger-text)',
                border: '1px solid var(--status-danger-border)',
                borderRadius: 8,
                cursor: 'pointer',
              }}
            >
              Desființează cultura
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}

function SolarCulturiSection({
  parcela,
  solarId,
  tipUnitate,
  onAddCultura,
  onAddMicroclimat,
  onDesfiintaCultura,
  withTopBorder = true,
}: {
  parcela: Parcela
  solarId: string
  tipUnitate: string | null | undefined
  onAddCultura: () => void
  onAddMicroclimat: () => void
  onDesfiintaCultura: (c: Cultura) => void
  withTopBorder?: boolean
}) {
  const [showMicroHistory, setShowMicroHistory] = useState(false)
  const currentSezon = getCurrentSezon()
  const { data: culturi = [], isLoading } = useQuery({
    queryKey: queryKeys.culturi(solarId),
    queryFn: () => getCulturiForSolar(solarId),
    staleTime: 30000,
    refetchOnWindowFocus: false,
  })

  const { data: microclimatLogs = [], isLoading: microLoading } = useQuery({
    queryKey: ['solar_climate_logs', solarId],
    queryFn: () => getSolarClimateLogs(solarId, 5),
    staleTime: 60_000,
    refetchOnWindowFocus: false,
    enabled: Boolean(solarId),
  })
  const { data: canonicalStages = [] } = useQuery({
    queryKey: queryKeys.parcelaCultureStages(solarId),
    queryFn: () => getStadiiCanoniceParcela(solarId, currentSezon, 50),
    staleTime: 30000,
    refetchOnWindowFocus: false,
    enabled: Boolean(solarId),
  })
  const { data: seasonConfig = null } = useQuery({
    queryKey: queryKeys.parcelaSeasonConfig(solarId, currentSezon),
    queryFn: () => getConfigurareSezonParcela(solarId, currentSezon),
    staleTime: 30000,
    refetchOnWindowFocus: false,
    enabled: Boolean(solarId),
  })

  const activeCulturi = culturi.filter((c) => c.activa !== false)
  const inactiveCulturi = culturi.filter((c) => c.activa === false)
  const conditiiLabel = getConditiiMediuLabel(tipUnitate)
  const latestMicroclimat = microclimatLogs[0]
  const parcelaCropCodHint = useMemo(
    () => normalizeCropCod(parcela.cultura) ?? normalizeCropCod(parcela.tip_fruct),
    [parcela.cultura, parcela.tip_fruct]
  )

  return (
    <div style={withTopBorder ? { marginTop: 10, borderTop: '1px solid var(--surface-divider)', paddingTop: 10 } : undefined}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--button-muted-text)' }}>
          Culturi
          {activeCulturi.length > 0 ? (
            <span
              style={{
                marginLeft: 5,
                fontSize: 9,
                fontWeight: 700,
                background: 'var(--status-success-bg)',
                color: 'var(--status-success-text)',
                border: '1px solid var(--status-success-border)',
                borderRadius: 10,
                padding: '2px 6px',
              }}
            >
              {activeCulturi.length} activ{activeCulturi.length !== 1 ? 'e' : 'ă'}
            </span>
          ) : null}
        </span>
        <div style={{ display: 'flex', gap: 5 }}>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onAddMicroclimat() }}
            style={{
              padding: '4px 10px',
              fontSize: 10,
              fontWeight: 600,
              background: 'var(--status-info-bg)',
              color: 'var(--status-info-text)',
              border: '1px solid var(--status-info-border)',
              borderRadius: 8,
              cursor: 'pointer',
            }}
          >
            + {conditiiLabel}
          </button>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onAddCultura() }}
            style={{
              padding: '4px 10px',
              fontSize: 10,
              fontWeight: 600,
              background: 'var(--pill-active-bg)',
              color: 'var(--pill-active-text)',
              border: '1px solid var(--pill-active-border)',
              borderRadius: 8,
              cursor: 'pointer',
            }}
          >
            + Cultură
          </button>
        </div>
      </div>

      {isLoading ? (
        <div style={{ fontSize: 11, color: 'var(--text-hint)', padding: '4px 0' }}>Se încarcă culturile...</div>
      ) : culturi.length === 0 ? (
        <div
          style={{
            fontSize: 11,
            color: 'var(--text-hint)',
            background: 'var(--agri-surface-muted)',
            borderRadius: 8,
            padding: '8px 10px',
            textAlign: 'center',
          }}
        >
          Nicio cultură înregistrată
        </div>
      ) : (
        <>
        <div style={{ marginBottom: 8, borderRadius: 8, border: '1px solid var(--agri-border)', background: 'var(--agri-surface-muted)', padding: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--agri-text)' }}>🌡️ Microclimat</div>
            {microclimatLogs.length > 1 ? (
              <button
                type="button"
                onClick={() => setShowMicroHistory((v) => !v)}
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  color: 'var(--agri-primary)',
                  background: 'none',
                  border: 'none',
                  padding: 0,
                  cursor: 'pointer',
                }}
              >
                {showMicroHistory ? 'Ascunde istoric' : `Istoric microclimat (${microclimatLogs.length})`}
              </button>
            ) : null}
          </div>
          {microLoading ? (
            <div style={{ marginTop: 6, fontSize: 11, color: 'var(--text-hint)' }}>Se încarcă...</div>
          ) : latestMicroclimat ? (
            <div style={{ marginTop: 6, fontSize: 12, color: 'var(--agri-text-muted)' }}>
              Ultima înregistrare: {new Date(latestMicroclimat.created_at).toLocaleString('ro-RO')} · T: {latestMicroclimat.temperatura}°C · U: {latestMicroclimat.umiditate}%
            </div>
          ) : (
            <div style={{ marginTop: 6, fontSize: 11, color: 'var(--text-hint)' }}>Nu există încă înregistrări de microclimat.</div>
          )}
          {showMicroHistory && microclimatLogs.length > 1 ? (
            <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
              {microclimatLogs.slice(0, 8).map((log) => (
                <div key={log.id} style={{ fontSize: 11, color: 'var(--agri-text-muted)' }}>
                  {new Date(log.created_at).toLocaleString('ro-RO')} · {log.temperatura}°C · {log.umiditate}%
                </div>
              ))}
            </div>
          ) : null}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {activeCulturi.map((c) => (
            <CulturaCard
              key={c.id}
              cultura={c}
              parcelaId={solarId}
              parcelaCropCodHint={parcelaCropCodHint}
              seasonConfig={seasonConfig}
              canonicalStages={canonicalStages}
              onDesfiintaCultura={onDesfiintaCultura}
            />
          ))}
          {inactiveCulturi.length > 0 && activeCulturi.length > 0 ? (
            <div className="md:col-span-2 lg:col-span-3" style={{ fontSize: 10, color: 'var(--text-hint)', margin: '4px 0 2px', fontWeight: 600 }}>
              Istorice
            </div>
          ) : null}
          {inactiveCulturi.map((c) => (
            <CulturaCard
              key={c.id}
              cultura={c}
              parcelaId={solarId}
              parcelaCropCodHint={parcelaCropCodHint}
              seasonConfig={seasonConfig}
              canonicalStages={canonicalStages}
              onDesfiintaCultura={onDesfiintaCultura}
            />
          ))}
        </div>
        </>
      )}
    </div>
  )
}

/** Pastile compacte pentru bara desktop /parcele (fără fundal verde pe activ). */
function DesktopParcelToolbarPill({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'rounded-full border px-2.5 py-0.5 text-[10px] font-semibold transition-colors md:px-3 md:py-1',
        active
          ? 'border-[var(--pill-active-border)] bg-white text-[var(--pill-active-border)] shadow-[inset_0_0_0_1px_rgba(13,155,92,0.12)]'
          : 'border-[var(--surface-divider)] bg-white text-[var(--agri-text-muted)] hover:border-[var(--agri-border)] hover:text-[var(--agri-text)] dark:bg-[var(--agri-surface)]',
      )}
    >
      {children}
    </button>
  )
}

function DesktopParcelStripCard({
  parcela,
  isSelected,
  latestActivity,
  today,
  onSelect,
}: {
  parcela: Parcela
  isSelected: boolean
  latestActivity:
    | { date: string; type: string; product: string; pauseUntil?: string | null; tipDeprecat?: boolean }
    | undefined
  today: Date
  onSelect: () => void
}) {
  const operational = coerceStatusOperationalFromDb(parcela.status_operational)
  const badge = operationalBadge(operational)
  const isActivOperational = operational === 'activ'
  const activityText = latestActivity ? activityRelativeTime(latestActivity.date, today) : '—'
  const statusTitle = STATUS_OPERATIONAL_LABELS[operational]
  const shortActivity = latestActivity
    ? `${latestActivity.type}${latestActivity.product ? ` · ${latestActivity.product}` : ''}`
    : 'Nicio activitate'

  return (
    <button
      type="button"
      title={isActivOperational ? `${statusTitle}. ${shortActivity}` : statusTitle}
      aria-label={`${parcela.nume_parcela || 'Teren'}${isSelected ? ', selectată' : ''}${isActivOperational ? `, ${statusTitle}` : `, ${badge.text}`}`}
      onClick={onSelect}
      className={cn(
        'relative h-full min-h-[4rem] w-full rounded-lg border py-1.5 pl-2.5 pr-7 text-left transition-[box-shadow,border-color]',
        isSelected
          ? 'z-[1] border-2 border-[var(--pill-active-border)] bg-white shadow-[0_1px_4px_rgba(12,15,19,0.07),0_0_0_1px_rgba(13,155,92,0.14)] dark:bg-[var(--agri-surface)]'
          : 'border border-[var(--surface-divider)]/80 bg-white shadow-none hover:border-[var(--agri-border)]/35 dark:border-[var(--surface-divider)] dark:bg-[var(--agri-surface)]',
      )}
    >
      {isSelected ? (
        <span
          aria-hidden
          className="absolute bottom-1.5 left-0 top-1.5 w-1 rounded-sm bg-[var(--pill-active-border)]"
        />
      ) : null}
      <span className="absolute right-1.5 top-1.5">
        {isActivOperational ? (
          <span className="flex h-4 w-4 items-center justify-center" title={statusTitle}>
            <span
              className="h-1.5 w-1.5 rounded-full bg-[var(--status-success-text)] ring-1 ring-[var(--surface-divider)]"
              aria-hidden
            />
          </span>
        ) : (
          <span
            className="inline-flex max-w-[4.5rem] items-center justify-center rounded-full px-1.5 py-0.5 text-center text-[9px] font-bold leading-tight"
            style={{
              background: badge.bg,
              color: badge.color,
              border: `1px solid ${badge.color}`,
            }}
          >
            {badge.text}
          </span>
        )}
      </span>
      <div className={cn('min-w-0 pl-0.5', isSelected && 'pl-1.5')}>
        <p
          className={cn(
            'truncate text-[13px] leading-tight',
            isSelected ? 'font-extrabold text-[var(--agri-text)]' : 'font-semibold text-[var(--agri-text)]',
          )}
        >
          {parcela.nume_parcela || 'Teren'}
        </p>
        <p
          className={cn(
            'mt-0.5 truncate text-[10px]',
            isSelected ? 'text-[var(--agri-text-muted)]' : 'text-[var(--agri-text-muted)]/75',
          )}
        >
          {buildParcelaListSecondaryLine(parcela)}
        </p>
        <p
          className={cn('mt-0.5 truncate text-[10px]', isSelected ? 'text-[var(--agri-text-muted)]' : 'text-[var(--agri-text-muted)]/70')}
        >
          {latestActivity ? `${activityText} · ${latestActivity.type}` : 'Nicio activitate'}
        </p>
      </div>
    </button>
  )
}

function TerenCard({
  parcela,
  latestActivity,
  activeCulturiCount,
  isExpanded,
  onToggle,
  onAddActivity,
  onTratamente,
  onHistoric,
  onEdit,
  onDelete,
  onAddCultura,
  onAddMicroclimat,
  onDesfiintaCultura,
  meteoAutoSummary,
  hasManualMicroclimat,
  onOpenManualMicroclimat,
}: {
  parcela: Parcela
  latestActivity:
    | { date: string; type: string; product: string; pauseUntil?: string | null; tipDeprecat?: boolean }
    | undefined
  activeCulturiCount: number
  isExpanded: boolean
  onToggle: (id: string) => void
  onAddActivity: (id: string) => void
  onTratamente: (id: string) => void
  onHistoric: () => void
  onEdit: (parcela: Parcela) => void
  onDelete: (parcela: Parcela) => void
  onAddCultura: () => void
  onAddMicroclimat: () => void
  onDesfiintaCultura: (c: Cultura) => void
  meteoAutoSummary: MeteoAutoSummary
  hasManualMicroclimat: boolean
  onOpenManualMicroclimat: () => void
}) {
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const { emoji, bg } = unitIcon(parcela.tip_unitate)
  const operational = coerceStatusOperationalFromDb(parcela.status_operational)
  const badge = operationalBadge(operational)
  const hasPause = Boolean(latestActivity?.pauseUntil)
  const isSolar = normalizeUnitateTip(parcela.tip_unitate) === 'solar'
  const relTime = activityRelativeTime(latestActivity?.date, today)
  const activityDateLabel = formatActivityDateShort(latestActivity?.date)
  const metaLine = buildParcelaDesktopMeta(parcela)
  const summaryLine = buildParcelaSummaryLine(parcela, activeCulturiCount)
  const culturiLabel = activeCulturiCount > 0 ? getCulturiCountLabel(activeCulturiCount, true) : null
  const archivedActivityLabel = latestActivity?.tipDeprecat ? `${latestActivity.type} · Arhivat` : null
  const remainingDays = latestActivity?.pauseUntil
    ? Math.ceil((new Date(latestActivity.pauseUntil).getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
    : 0

  const mobileExpanded = (
    <>
      <div className="border-t border-[var(--surface-divider)] pt-3">
        <div className={hasPause ? 'mb-2' : 'mb-2.5'}>
          <div className="mb-1 text-[11px] text-[var(--agri-text-muted)]">Ultima activitate</div>
          <div
            className={cn(
              'rounded-lg px-2.5 py-1.5 text-xs font-medium',
              latestActivity ? 'bg-[var(--agri-surface-muted)] text-[var(--agri-text)]' : 'text-[var(--text-hint)]',
            )}
          >
            {latestActivity
              ? `${latestActivity.type}${latestActivity.product ? ` · ${latestActivity.product}` : ''} — ${relTime}`
              : 'Nicio activitate înregistrată'}
          </div>
          {archivedActivityLabel ? (
            <div
              className="mt-1 text-xs text-amber-700"
              title="Acest tip se înregistrează acum în modulul Protecție & Nutriție"
            >
              {archivedActivityLabel}
            </div>
          ) : null}
        </div>

        {hasPause ? (
          <div className="mb-2.5 rounded-lg border border-[var(--status-danger-border)] bg-[var(--status-danger-bg)] px-2.5 py-1.5 text-[11px] font-semibold text-[var(--status-danger-text)]">
            {remainingDays <= 1
              ? '⚠️ Pauză tratament expiră mâine'
              : `⚠️ Pauză activă: încă ${remainingDays} zile`}
          </div>
        ) : null}

        <div className="mb-2.5 grid grid-cols-2 gap-1.5">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              onAddActivity(parcela.id)
            }}
            className="min-h-9 w-full rounded-[10px] border border-[var(--pill-active-border)] bg-[var(--pill-active-bg)] px-2 text-[11px] font-semibold text-[var(--pill-active-text)]"
          >
            + Activitate
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              onHistoric()
            }}
            className="min-h-9 w-full rounded-[10px] border border-[var(--button-muted-border)] bg-[var(--button-muted-bg)] px-2 text-[11px] font-semibold text-[var(--button-muted-text)]"
          >
            Istoric
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              onTratamente(parcela.id)
            }}
            className="min-h-9 w-full rounded-[10px] border border-[var(--agri-border)] bg-[var(--agri-surface)] px-2 text-[11px] font-semibold text-[var(--agri-text)]"
            aria-label="Tratamente"
          >
            <span className="inline-flex items-center gap-1">
              <SprayCan className="h-3.5 w-3.5 shrink-0" aria-hidden />
              <span className="text-[11px] font-semibold">Tratamente</span>
            </span>
          </button>
        </div>

        <SolarCulturiSection
          parcela={parcela}
          solarId={parcela.id}
          tipUnitate={parcela.tip_unitate}
          onAddCultura={onAddCultura}
          onAddMicroclimat={onAddMicroclimat}
          onDesfiintaCultura={onDesfiintaCultura}
        />

        <div className="mt-3 border-t border-[var(--surface-divider)] pt-3">
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-[var(--agri-text-muted)]">
            Microclimat
          </p>
          <MicroclimatAutoCard summary={meteoAutoSummary} compact />
          {isSolar && hasManualMicroclimat ? (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                onOpenManualMicroclimat()
              }}
              className="mt-2 inline-flex min-h-9 w-full items-center justify-center rounded-lg border border-[var(--button-muted-border)] bg-[var(--button-muted-bg)] px-3 text-[11px] font-semibold text-[var(--button-muted-text)]"
            >
              Vezi microclimat manual →
            </button>
          ) : null}
        </div>

        <div className="mt-3 flex justify-center gap-2 border-t border-[var(--surface-divider)] pt-3">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              onEdit(parcela)
            }}
            className="min-h-9 rounded-lg border border-[var(--button-muted-border)] bg-[var(--button-muted-bg)] px-3 text-[11px] font-semibold text-[var(--button-muted-text)]"
          >
            ✏️ Editează
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              onDelete(parcela)
            }}
            className="min-h-9 rounded-lg border border-[var(--status-danger-border)] bg-[var(--status-danger-bg)] px-3 text-[11px] font-semibold text-[var(--status-danger-text)]"
          >
            🗑️ Șterge
          </button>
        </div>
      </div>
    </>
  )

  return (
    <>
      <div className="md:hidden">
        <MobileEntityCard
          variant={isExpanded ? 'highlight' : 'default'}
          icon={<span aria-hidden>{emoji}</span>}
          title={hasPause ? `${parcela.nume_parcela || 'Teren'} ⚠️` : parcela.nume_parcela || 'Teren'}
          subtitle={summaryLine || undefined}
          mainValue={latestActivity ? relTime : '—'}
          secondaryValue={
            latestActivity
              ? `${latestActivity.type}${latestActivity.product ? ` · ${latestActivity.product}` : ''}`
              : 'Nicio activitate'
          }
          statusLabel={badge.text}
          statusTone={operationalToneForCard(operational)}
          showChevron
          bottomSlotAlign="full"
          ariaLabel={`${parcela.nume_parcela || 'Teren'}${isExpanded ? ', detalii deschise' : ''}`}
          onClick={() => onToggle(parcela.id)}
          bottomSlot={
            archivedActivityLabel || isExpanded ? (
              <>
                {archivedActivityLabel && !isExpanded ? (
                  <div
                    className="mb-2 text-xs text-amber-700"
                    title="Acest tip se înregistrează acum în modulul Protecție & Nutriție"
                  >
                    {archivedActivityLabel}
                  </div>
                ) : null}
                {isExpanded ? mobileExpanded : null}
              </>
            ) : undefined
          }
        />
      </div>

      <div
        className="hidden w-full overflow-hidden rounded-2xl border border-[var(--agri-border)] bg-white shadow-[0_2px_8px_-2px_rgba(12,15,19,0.08)] transition-[box-shadow] duration-200 md:block md:hover:shadow-[0_4px_14px_-4px_rgba(12,15,19,0.12)] dark:bg-[var(--agri-surface)] dark:shadow-[var(--agri-shadow)]"
        role="button"
        tabIndex={0}
        aria-expanded={isExpanded}
        onClick={() => onToggle(parcela.id)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            onToggle(parcela.id)
          }
        }}
        style={{
          border: isExpanded ? '1.5px solid var(--soft-success-border)' : '1px solid var(--agri-border)',
          boxShadow: isExpanded ? 'var(--shadow-card-raised)' : 'var(--shadow-card-soft)',
          padding: '14px 18px',
          cursor: 'pointer',
        }}
      >
      <div className="hidden md:grid md:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_auto] md:items-center md:gap-6">
        <div className="flex min-w-0 items-center gap-4">
          <div
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-xl shadow-[inset_0_1px_0_rgba(255,255,255,0.45)]"
            style={{ background: bg }}
          >
            {emoji}
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="truncate text-base font-bold text-[var(--agri-text)]">
                {parcela.nume_parcela || 'Teren'}
              </span>
              {hasPause ? <span className="text-sm">⚠️</span> : null}
              <span
                className="inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-bold"
                style={{
                  background: badge.bg,
                  color: badge.color,
                  border: `1px solid ${badge.color}`,
                }}
              >
                {badge.text}
              </span>
            </div>
            {metaLine ? <div className="mt-1 truncate text-sm text-[var(--agri-text-muted)]">{metaLine}</div> : null}
          </div>
        </div>

        <div className="min-w-0">
          <div className="truncate text-sm font-semibold text-[var(--agri-text)]">
            {latestActivity ? `Ultima activitate: ${activityDateLabel ?? relTime}` : 'Nicio activitate'}
          </div>
          <div className="mt-1 truncate text-sm text-[var(--agri-text-muted)]">
            {latestActivity
              ? `${latestActivity.type}${latestActivity.product ? ` · ${latestActivity.product}` : ''}`
              : 'Nicio activitate înregistrată'}
          </div>
          {archivedActivityLabel ? (
            <div
              className="mt-1 text-xs text-amber-700"
              title="Acest tip se înregistrează acum în modulul Protecție & Nutriție"
            >
              {archivedActivityLabel}
            </div>
          ) : null}
          {culturiLabel ? <div className="mt-1 text-sm text-[var(--agri-text-muted)]">{culturiLabel}</div> : null}

        </div>

        <div className="flex h-10 w-10 items-center justify-center rounded-full border border-[var(--agri-border)] bg-[var(--agri-surface-muted)] text-[var(--agri-text-muted)]">
          {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </div>
      </div>

      {isExpanded ? (
          <div
            className="mt-4 hidden border-t border-[var(--surface-divider)] pt-4 md:block"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center gap-2 overflow-x-auto pb-1">
              <button
                type="button"
                onClick={() => onAddActivity(parcela.id)}
                className="inline-flex h-9 items-center justify-center rounded-lg border border-[var(--pill-active-border)] bg-[var(--pill-active-bg)] px-3 text-xs font-semibold text-[var(--pill-active-text)] transition-colors hover:opacity-90 dark:hover:opacity-100"
              >
                + Activitate
              </button>
              <button
                type="button"
                onClick={onHistoric}
                className="inline-flex h-9 items-center justify-center rounded-lg border border-[var(--button-muted-border)] bg-[var(--button-muted-bg)] px-3 text-xs font-semibold text-[var(--button-muted-text)] transition-colors hover:bg-[var(--button-muted-hover-bg)]"
              >
                Istoric
              </button>
              <button
                type="button"
                onClick={() => onTratamente(parcela.id)}
                className="inline-flex h-9 items-center justify-center rounded-lg border border-[var(--agri-border)] bg-white px-3 text-xs font-semibold text-[var(--agri-text)] shadow-[0_1px_2px_rgba(12,15,19,0.04)] transition-colors hover:bg-[var(--agri-surface-muted)] dark:bg-[var(--agri-surface)]"
              >
                <SprayCan className="mr-1.5 h-3.5 w-3.5 text-[var(--pill-active-border)]" aria-hidden />
                Tratamente
              </button>
              <button
                type="button"
                onClick={() => onEdit(parcela)}
                className="inline-flex h-9 items-center justify-center rounded-lg border border-[var(--button-muted-border)] bg-[var(--button-muted-bg)] px-3 text-xs font-semibold text-[var(--button-muted-text)] transition-colors hover:bg-[var(--button-muted-hover-bg)]"
              >
                Editează
              </button>
              <button
                type="button"
                onClick={() => onDelete(parcela)}
                className="inline-flex h-9 items-center justify-center rounded-lg border border-[var(--status-danger-border)] bg-[var(--status-danger-bg)] px-3 text-xs font-semibold text-[var(--status-danger-text)] transition-colors hover:opacity-90 dark:hover:opacity-100"
              >
                Șterge
              </button>
            </div>

            {hasPause ? (
              <div className="mb-4 rounded-xl border border-[var(--status-danger-border)] bg-[var(--status-danger-bg)] px-3 py-2 text-sm font-semibold text-[var(--status-danger-text)]">
                {remainingDays <= 1
                  ? '⚠️ Pauză tratament expiră mâine'
                  : `⚠️ Pauză activă: încă ${remainingDays} zile`}
              </div>
            ) : null}

            <SolarCulturiSection
              parcela={parcela}
              solarId={parcela.id}
              tipUnitate={parcela.tip_unitate}
              onAddCultura={onAddCultura}
              onAddMicroclimat={onAddMicroclimat}
              onDesfiintaCultura={onDesfiintaCultura}
              withTopBorder={false}
            />
          </div>
      ) : null}
    </div>
    </>
  )
}

export function ParcelePageClient({ initialError }: ParcelePageClientProps) {
  useTrackModuleView('parcele')
  const router = useRouter()
  const searchParams = useSearchParams()
  const queryClient = useQueryClient()
  const { registerAddAction } = useAddAction()
  const pendingDeleteTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({})
  const pendingDeletedItems = useRef<Record<string, { item: Parcela; index: number }>>({})
  const deleteMutateRef = useRef<(id: string) => void>(() => {})
  const lastUrlSelectedRef = useRef<string | null>(null)

  const [addOpen, setAddOpen] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [addActivityOpen, setAddActivityOpen] = useState(false)
  const [addActivityParcelaId, setAddActivityParcelaId] = useState<string | undefined>(undefined)
  const [selectedParcela, setSelectedParcela] = useState<Parcela | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [unitFilter, setUnitFilter] = useState<UnitFilter>(() => resolveUnitFilterParam(searchParams))
  const [isDesktop, setIsDesktop] = useState(false)
  const [desktopSelectedParcelaId, setDesktopSelectedParcelaId] = useState<string | null>(null)
  const [desktopInspectorTab, setDesktopInspectorTab] = useState<'prezentare' | 'jurnal' | 'tratamente' | 'microclimat'>(
    'prezentare'
  )
  const [desktopJournalTypeFilter, setDesktopJournalTypeFilter] = useState<JournalTypeFilter>('all')
  const [desktopJournalPeriodFilter, setDesktopJournalPeriodFilter] = useState<JournalPeriodFilter>('30d')
  const [desktopDockScrolled, setDesktopDockScrolled] = useState(false)

  const [addCulturaParcelaId, setAddCulturaParcelaId] = useState<string | null>(null)
  const [addMicroclimatParcelaId, setAddMicroclimatParcelaId] = useState<string | null>(null)
  const [desfiintaState, setDesfiintaState] = useState<{ cultura: Cultura; parcelaId: string } | null>(null)

  const {
    data: parcele = [],
    isLoading,
    isError,
    error,
  } = useQuery({
    queryKey: queryKeys.parcele,
    queryFn: getParcele,
    staleTime: 0,
    refetchOnWindowFocus: false,
    refetchOnMount: 'always',
  })

  const { data: activitati = [] } = useQuery({
    queryKey: queryKeys.activitati,
    queryFn: getActivitatiAgricole,
    staleTime: 30000,
    refetchOnWindowFocus: false,
  })
  const { data: recoltari = [] } = useQuery({
    queryKey: queryKeys.recoltari,
    queryFn: getRecoltari,
    staleTime: 30000,
    refetchOnWindowFocus: false,
  })

  const deleteMutation = useMutation({
    mutationFn: deleteParcela,
    onSuccess: () => {
      toast.success('Teren șters.')
      queryClient.invalidateQueries({ queryKey: queryKeys.parcele, exact: true })
    },
    onError: (err: Error) => {
      toast.error(err.message)
      queryClient.invalidateQueries({ queryKey: queryKeys.parcele, exact: true })
    },
  })

  useMobileScrollRestore({
    storageKey: 'scroll:parcele',
    ready: !isLoading,
  })

  const resolvedError = initialError || (isError ? (error as Error).message : null)

  useEffect(() => {
    deleteMutateRef.current = (id) => deleteMutation.mutate(id)
  }, [deleteMutation])
  useEffect(() => {
    const pendingTimersRef = pendingDeleteTimers
    const pendingItemsRef = pendingDeletedItems
    return () => {
      Object.keys(pendingTimersRef.current).forEach((id) => {
        clearTimeout(pendingTimersRef.current[id])
        if (pendingItemsRef.current[id]) {
          delete pendingItemsRef.current[id]
          deleteMutateRef.current(id)
        }
      })
      pendingTimersRef.current = {}
    }
  }, [])

  useEffect(() => {
    const unregister = registerAddAction(() => setAddOpen(true), 'Adaugă teren')
    return unregister
  }, [registerAddAction])

  const scheduleDelete = (parcela: Parcela) => {
    const parcelaId = parcela.id
    const currentItems = queryClient.getQueryData<Parcela[]>(queryKeys.parcele) ?? []
    const deleteIndex = currentItems.findIndex((item) => item.id === parcelaId)

    pendingDeletedItems.current[parcelaId] = { item: parcela, index: deleteIndex }
    queryClient.setQueryData<Parcela[]>(
      queryKeys.parcele,
      (current = []) => current.filter((item) => item.id !== parcelaId)
    )

    const timer = setTimeout(() => {
      delete pendingDeleteTimers.current[parcelaId]
      delete pendingDeletedItems.current[parcelaId]
      deleteMutation.mutate(parcelaId)
    }, 5000)

    pendingDeleteTimers.current[parcelaId] = timer

    toast('Element șters.', {
      duration: 5000,
      action: {
        label: 'Undo',
        onClick: () => {
          const pendingTimer = pendingDeleteTimers.current[parcelaId]
          if (!pendingTimer) return
          clearTimeout(pendingTimer)
          delete pendingDeleteTimers.current[parcelaId]
          const pendingItem = pendingDeletedItems.current[parcelaId]
          delete pendingDeletedItems.current[parcelaId]
          if (!pendingItem) return

          queryClient.setQueryData<Parcela[]>(queryKeys.parcele, (current = []) => {
            if (current.some((item) => item.id === parcelaId)) return current
            const next = [...current]
            const insertAt = pendingItem.index >= 0 ? Math.min(pendingItem.index, next.length) : next.length
            next.splice(insertAt, 0, pendingItem.item)
            return next
          })
        },
      },
    })
  }

  const today = useMemo(() => {
    const value = new Date()
    value.setHours(0, 0, 0, 0)
    return value
  }, [])

  const latestActivityByParcela = useMemo(() => {
    const map = new Map<string, { date: string; type: string; product: string; pauseUntil?: string | null; tipDeprecat?: boolean }>()
    const latestByParcela = buildLatestActivityByParcela(activitati)
    for (const [parcelaId, row] of latestByParcela.entries()) {
      const tip = row.tip_activitate || 'Activitate'
      const produs = row.produs_utilizat || ''
      const remaining = getActivityPauseRemainingDays(row, today)
      const pauseUntil =
        remaining > 0
          ? toIsoDate(new Date(today.getFullYear(), today.getMonth(), today.getDate() + remaining))
          : null
      map.set(parcelaId, {
        date: row.data_aplicare || '',
        type: tip,
        product: produs,
        pauseUntil,
        tipDeprecat: Boolean(row.tip_deprecat),
      })
    }
    return map
  }, [activitati, today])

  const tratamenteByParcela = useMemo(() => {
    const map = new Map<string, Array<{ date: string; type: string; product: string; dose: string }>>()
    const ordered = [...activitati]
      .filter((row) => Boolean(row.parcela_id) && isTreatmentLikeActivity(row))
      .sort((a, b) => {
        const left = new Date(b.data_aplicare || b.created_at || 0).getTime()
        const right = new Date(a.data_aplicare || a.created_at || 0).getTime()
        return left - right
      })

    for (const row of ordered) {
      if (!row.parcela_id) continue
      const current = map.get(row.parcela_id) ?? []
      current.push({
        date: row.data_aplicare || row.created_at || '',
        type: row.tip_activitate || 'Tratament',
        product: row.produs_utilizat || '',
        dose: row.doza || '',
      })
      map.set(row.parcela_id, current)
    }

    return map
  }, [activitati])
  const latestTreatmentByParcela = useMemo(() => {
    const map = new Map<string, { date: string; type: string; product: string; dose: string }>()
    for (const [parcelaId, rows] of tratamenteByParcela.entries()) {
      if (rows[0]) map.set(parcelaId, rows[0])
    }
    return map
  }, [tratamenteByParcela])
  const filteredParcele = useMemo(() => {
    let base = unitFilter === 'toate'
      ? parcele
      : parcele.filter((p) => normalizeUnitateTip(p.tip_unitate) === unitFilter)

    if (search.trim()) {
      const term = normalizeStr(search)
      base = base.filter((p) =>
        [p.nume_parcela, p.soi_plantat, p.soi, p.tip_unitate]
          .some((v) => normalizeStr(v).includes(term))
      )
    }
    return base
  }, [parcele, unitFilter, search])

  useEffect(() => {
    const raw = searchParams.get('selected')?.trim()
    if (!raw) {
      lastUrlSelectedRef.current = null
      return
    }
    if (parcele.length === 0) return
    if (lastUrlSelectedRef.current === raw) return

    const match = parcele.find((parcela) => parcela.id === raw)
    if (!match) return

    const term = normalizeStr(search)
    const typeOk = unitFilter === 'toate' || normalizeUnitateTip(match.tip_unitate) === unitFilter
    const nameOk =
      !term ||
      [match.nume_parcela, match.soi_plantat, match.soi, match.tip_unitate].some((v) =>
        normalizeStr(v).includes(term)
      )

    queueMicrotask(() => {
      lastUrlSelectedRef.current = raw
      setDesktopSelectedParcelaId(match.id)
      setExpandedId(match.id)
      if (!typeOk || !nameOk) {
        setUnitFilter('toate')
        setSearch('')
      }
    })
  }, [parcele, search, searchParams, unitFilter])

  useEffect(() => {
    if (typeof window === 'undefined') return
    const media = window.matchMedia('(min-width: 768px)')
    const sync = () => setIsDesktop(media.matches)
    sync()
    media.addEventListener('change', sync)
    return () => media.removeEventListener('change', sync)
  }, [])

  useEffect(() => {
    if (!isDesktop) return
    if (filteredParcele.length === 1) {
      const id = filteredParcele[0].id
      window.setTimeout(() => setExpandedId(id), 0)
      return
    }
    if (expandedId && !filteredParcele.some((parcela) => parcela.id === expandedId)) {
      window.setTimeout(() => setExpandedId(null), 0)
    }
  }, [expandedId, filteredParcele, isDesktop])

  const filteredParcelaIds = useMemo(
    () => filteredParcele.map((parcela) => parcela.id).sort(),
    [filteredParcele]
  )
  const culturiCountsScope = useMemo(
    () => filteredParcelaIds.join('|') || 'empty',
    [filteredParcelaIds]
  )
  const { data: activeCulturiCounts = {} } = useQuery({
    queryKey: queryKeys.culturiCounts(culturiCountsScope),
    queryFn: () => getActiveCulturiCountsByParcela(filteredParcelaIds),
    staleTime: 30000,
    refetchOnWindowFocus: false,
    enabled: filteredParcelaIds.length > 0,
  })

  const unitFilterCounts = useMemo(
    () => ({
      toate: parcele.length,
      camp: parcele.filter((p) => normalizeUnitateTip(p.tip_unitate) === 'camp').length,
      cultura_mare: parcele.filter((p) => normalizeUnitateTip(p.tip_unitate) === 'cultura_mare').length,
      solar: parcele.filter((p) => normalizeUnitateTip(p.tip_unitate) === 'solar').length,
      livada: parcele.filter((p) => normalizeUnitateTip(p.tip_unitate) === 'livada').length,
    }),
    [parcele]
  )
  const addCulturaParcela = useMemo(
    () => parcele.find((parcela) => parcela.id === addCulturaParcelaId) ?? null,
    [parcele, addCulturaParcelaId]
  )
  const addMicroclimatParcela = useMemo(
    () => parcele.find((parcela) => parcela.id === addMicroclimatParcelaId) ?? null,
    [parcele, addMicroclimatParcelaId]
  )
  const desktopSelectedParcela = useMemo(
    () => filteredParcele.find((parcela) => parcela.id === desktopSelectedParcelaId) ?? filteredParcele[0] ?? null,
    [desktopSelectedParcelaId, filteredParcele]
  )
  const desktopSelectedParcelaIdResolved = desktopSelectedParcela?.id ?? null

  useEffect(() => {
    if (!isDesktop || typeof window === 'undefined') return
    const onScroll = () => setDesktopDockScrolled(window.scrollY > 12)
    window.addEventListener('scroll', onScroll, { passive: true })
    onScroll()
    return () => window.removeEventListener('scroll', onScroll)
  }, [isDesktop])

  const activeMeteoParcelaId = expandedId ?? desktopSelectedParcelaId ?? filteredParcele[0]?.id ?? null
  const activeMeteoParcela = useMemo(
    () => filteredParcele.find((parcela) => parcela.id === activeMeteoParcelaId) ?? null,
    [activeMeteoParcelaId, filteredParcele]
  )
  const meteoCoordsSelection = useMemo(() => {
    const selectedCoords = resolveParcelaMeteoCoords(activeMeteoParcela)
    if (selectedCoords) {
      return {
        coords: selectedCoords,
        locationSource: 'parcela' as const,
        locationLabel: activeMeteoParcela?.nume_parcela || 'Parcela selectată',
      }
    }

    const fallbackComercial = parcele.find((parcela) => {
      if (parcela.id === activeMeteoParcela?.id) return false
      if (coerceParcelaScopFromDb(parcela.rol) !== 'comercial') return false
      return Boolean(resolveParcelaMeteoCoords(parcela))
    })

    if (fallbackComercial) {
      const fallbackCoords = resolveParcelaMeteoCoords(fallbackComercial)
      if (fallbackCoords) {
        return {
          coords: fallbackCoords,
          locationSource: 'fallback' as const,
          locationLabel: fallbackComercial.nume_parcela || 'Parcelă comercială',
        }
      }
    }

    const fallbackAny = parcele.find((parcela) => {
      if (parcela.id === activeMeteoParcela?.id) return false
      return Boolean(resolveParcelaMeteoCoords(parcela))
    })

    if (fallbackAny) {
      const fallbackCoords = resolveParcelaMeteoCoords(fallbackAny)
      if (fallbackCoords) {
        return {
          coords: fallbackCoords,
          locationSource: 'fallback' as const,
          locationLabel: fallbackAny.nume_parcela || 'Parcelă',
        }
      }
    }

    return {
      coords: null,
      locationSource: 'none' as const,
      locationLabel: null,
    }
  }, [activeMeteoParcela, parcele])
  const meteoAuto = useMeteo({
    coords: meteoCoordsSelection.coords ?? undefined,
    enabled: Boolean(meteoCoordsSelection.coords),
  })
  const meteoAutoSummary = useMemo(() => {
    if (!meteoCoordsSelection.coords) {
      return {
        state: 'empty' as const,
        reason: 'Date automate indisponibile: parcela selectată și fallback-ul fermei nu au coordonate.',
      }
    }
    if (meteoAuto.loading) {
      return {
        state: 'loading' as const,
        reason: 'Se încarcă datele automate meteo.',
      }
    }
    if (!meteoAuto.data?.available) {
      const edgeError = (meteoAuto.data?.error ?? meteoAuto.error ?? '').trim()
      return {
        state: 'empty' as const,
        reason: edgeError
          ? `Date automate indisponibile: ${edgeError}`
          : 'Date automate indisponibile momentan pentru coordonatele selectate.',
      }
    }

    return {
      state: 'ready' as const,
      temperature: meteoAuto.data.current?.temp ?? null,
      humidity: meteoAuto.data.current?.humidity ?? null,
      rainChance: meteoAuto.data.forecastTomorrow?.pop ?? null,
      wind: meteoAuto.data.current?.windSpeed ?? null,
      fetchedAt: meteoAuto.data.fetchedAt ?? null,
      source: meteoAuto.data.source ?? null,
      locationSource: meteoCoordsSelection.locationSource,
      locationLabel: meteoCoordsSelection.locationLabel,
    }
  }, [meteoAuto.data, meteoAuto.error, meteoAuto.loading, meteoCoordsSelection])
  const { data: desktopMicroclimatLogs = [] } = useQuery({
    queryKey: ['solar_climate_logs', 'active-microclimat', activeMeteoParcelaId],
    queryFn: () => getSolarClimateLogs(activeMeteoParcelaId ?? '', 12),
    staleTime: 60000,
    refetchOnWindowFocus: false,
    enabled: Boolean(activeMeteoParcelaId) && normalizeUnitateTip(activeMeteoParcela?.tip_unitate) === 'solar',
  })
  const currentSezon = getCurrentSezon()
  const { data: desktopStadiiCanonice = [] } = useQuery({
    queryKey: ['desktop-inspector', ...queryKeys.parcelaCultureStages(desktopSelectedParcelaIdResolved ?? '')],
    queryFn: () => getStadiiCanoniceParcela(desktopSelectedParcelaIdResolved ?? '', currentSezon, 30),
    staleTime: 30000,
    refetchOnWindowFocus: false,
    enabled: Boolean(desktopSelectedParcelaIdResolved),
  })
  const desktopSelectedCropCod = useMemo(
    () =>
      normalizeCropCod(desktopSelectedParcela?.cultura) ??
      normalizeCropCod(desktopSelectedParcela?.tip_fruct),
    [desktopSelectedParcela?.cultura, desktopSelectedParcela?.tip_fruct]
  )
  const desktopSelectedGrupBiologic = useMemo(
    () => getGrupBiologicForCropCod(desktopSelectedCropCod),
    [desktopSelectedCropCod]
  )
  const desktopCurrentStage = useMemo(
    () => getCurrentCanonicalStage(desktopStadiiCanonice, desktopSelectedGrupBiologic),
    [desktopStadiiCanonice, desktopSelectedGrupBiologic]
  )
  const selectedParcelaTratamente = useMemo(
    () => (desktopSelectedParcelaIdResolved ? tratamenteByParcela.get(desktopSelectedParcelaIdResolved) ?? [] : []),
    [desktopSelectedParcelaIdResolved, tratamenteByParcela]
  )
  const lastTreatmentEntry = selectedParcelaTratamente[0] ?? null
  const lastTreatmentDays = lastTreatmentEntry
    ? Math.max(0, Math.floor((today.getTime() - new Date(lastTreatmentEntry.date).getTime()) / 86_400_000))
    : null
  const selectedParcelaRecoltari = useMemo(
    () =>
      desktopSelectedParcelaIdResolved
        ? recoltari.filter((item) => item.parcela_id === desktopSelectedParcelaIdResolved)
        : [],
    [desktopSelectedParcelaIdResolved, recoltari]
  )
  const latestDesktopMicroclimat = desktopMicroclimatLogs[0] ?? null
  const jurnalEntries = useMemo(() => {
    if (!desktopSelectedParcelaIdResolved) return []
    const activities = activitati
      .filter((activity) => activity.parcela_id === desktopSelectedParcelaIdResolved)
      .map((activity) => ({
        id: `activitate:${activity.id}`,
        date: activity.data_aplicare || activity.created_at || '',
        kind: isTreatmentLikeActivity(activity) ? ('tratament' as const) : ('activitate' as const),
        title: activity.tip_activitate || 'Activitate',
        details: [activity.produs_utilizat, activity.doza].filter(Boolean).join(' · ') || null,
      }))
    const harvests = selectedParcelaRecoltari.map((recoltare) => ({
      id: `recoltare:${recoltare.id}`,
      date: recoltare.data || recoltare.created_at || '',
      kind: 'recoltare' as const,
      title: 'Recoltare înregistrată',
      details: `${Number(recoltare.kg_cal1 || 0) + Number(recoltare.kg_cal2 || 0)} kg`,
    }))
    const stages = desktopStadiiCanonice.map((stage) => ({
      id: `stadiu:${stage.id}`,
      date: stage.data_observata || stage.created_at || '',
      kind: 'stadiu' as const,
      title: formatEtapaLabel(stage.stadiu, desktopSelectedGrupBiologic, stage.cohort),
      details: stage.observatii || null,
    }))

    return [...activities, ...harvests, ...stages].sort((a, b) => {
      const left = new Date(b.date).getTime()
      const right = new Date(a.date).getTime()
      return left - right
    })
  }, [
    activitati,
    desktopSelectedGrupBiologic,
    desktopSelectedParcelaIdResolved,
    desktopStadiiCanonice,
    selectedParcelaRecoltari,
  ])
  const filteredJournalEntries = useMemo(() => {
    const periodStart = getJournalPeriodStart(desktopJournalPeriodFilter, currentSezon)
    return jurnalEntries.filter((entry) => {
      const kind = getJournalEntryKind(entry)
      if (desktopJournalTypeFilter !== 'all') {
        if (desktopJournalTypeFilter === 'activitati' && kind !== 'activitate') return false
        if (desktopJournalTypeFilter === 'tratamente' && kind !== 'tratament') return false
        if (desktopJournalTypeFilter === 'recoltari' && kind !== 'recoltare') return false
        if (desktopJournalTypeFilter === 'stadii' && kind !== 'stadiu') return false
      }
      if (!periodStart) return true
      const entryDate = new Date(entry.date)
      return !Number.isNaN(entryDate.getTime()) && entryDate.getTime() >= periodStart.getTime()
    })
  }, [currentSezon, desktopJournalPeriodFilter, desktopJournalTypeFilter, jurnalEntries])
  const journalKindCounts = useMemo(
    () =>
      jurnalEntries.reduce(
        (acc, entry) => {
          acc[getJournalEntryKind(entry)] += 1
          return acc
        },
        { activitate: 0, tratament: 0, recoltare: 0, stadiu: 0 }
      ),
    [jurnalEntries]
  )

  return (
    <AppShell
      header={<PageHeader title="Terenuri" subtitle="Administrare terenuri cultivate" rightSlot={<MapIcon className="h-5 w-5" />} contentVariant="workspace" />}
      bottomBar={null}
    >
      <DashboardContentShell variant="workspace" className="mt-2 space-y-3 py-2.5 sm:mt-0 sm:space-y-4 sm:py-3 md:space-y-2.5 md:py-2.5">
        {resolvedError ? (
          <ErrorState
            title="Eroare la încărcare"
            message={resolvedError}
            onRetry={() => queryClient.invalidateQueries({ queryKey: queryKeys.parcele, exact: true })}
          />
        ) : null}

        {isLoading ? <EntityListSkeleton /> : null}

        {!isLoading && !resolvedError && parcele.length === 0 ? (
          <div className="flex flex-col items-center gap-4">
            <ModuleEmptyCard
              emoji="🌿"
              title="Niciun teren adăugat"
              hint="Adaugă primul teren cu butonul +"
            />
            <button
              type="button"
              onClick={() => setAddOpen(true)}
              className="rounded-xl border border-[var(--pill-active-border)] bg-[var(--pill-active-bg)] px-5 py-2.5 text-[13px] font-bold text-[var(--pill-active-text)] transition-opacity hover:opacity-95"
            >
              🌿 Adaugă primul teren
            </button>
          </div>
        ) : null}

        {!isLoading && !resolvedError && parcele.length > 0 ? (
          <>
            {filteredParcele.length === 0 ? (
              <>
                <div className="space-y-3 md:hidden">
                  <ModulePillRow>
                    {PILL_FILTERS.filter((f) => f.key === 'toate' || unitFilterCounts[f.key] > 0).map((f) => (
                      <ModulePillFilterButton
                        key={f.key}
                        active={unitFilter === f.key}
                        onClick={() => setUnitFilter(f.key)}
                      >
                        {f.label}
                      </ModulePillFilterButton>
                    ))}
                  </ModulePillRow>
                  {parcele.length > 5 ? (
                    <SearchField
                      placeholder="Caută după nume, soi sau cultură..."
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      aria-label="Caută terenuri"
                    />
                  ) : null}
                  <ModuleEmptyCard
                    emoji={unitFilter === 'solar' ? '🏡' : unitFilter === 'livada' ? '🍎' : unitFilter === 'cultura_mare' ? '🚜' : '🌿'}
                    title={
                      unitFilter === 'solar'
                        ? 'Niciun solar adăugat'
                        : unitFilter === 'livada'
                          ? 'Nicio livadă adăugată'
                          : unitFilter === 'cultura_mare'
                            ? 'Nicio cultură mare adăugată'
                            : 'Niciun teren găsit'
                    }
                    hint={unitFilter === 'solar' ? 'Solariile vor apărea aici' : 'Modifică filtrul sau căutarea'}
                  />
                </div>
                <div className="hidden md:block md:space-y-3">
                  <div
                    className={cn(
                      'sticky top-0 z-30 border-b border-[var(--surface-divider)] bg-white transition-[box-shadow,padding] duration-200 dark:bg-[var(--agri-surface)]',
                      desktopDockScrolled ? 'py-2 shadow-[0_6px_20px_-14px_rgba(12,15,19,0.1)]' : 'py-2.5 shadow-none',
                    )}
                  >
                    <div className={cn('flex flex-col gap-2', desktopDockScrolled && 'gap-1.5')}>
                      <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1.5">
                        <div className="flex shrink-0 items-center gap-1.5">
                          <span className="text-[10px] font-bold uppercase tracking-[0.06em] text-[var(--agri-text-muted)]">
                            Terenuri
                          </span>
                          <span className="tabular-nums rounded-md border border-[var(--surface-divider)] bg-white px-1.5 py-0.5 text-[10px] font-semibold text-[var(--agri-text-muted)] dark:bg-[var(--agri-surface)]">
                            {filteredParcele.length}
                          </span>
                        </div>
                        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1">
                          {PILL_FILTERS.filter((f) => f.key === 'toate' || unitFilterCounts[f.key] > 0).map((f) => (
                            <DesktopParcelToolbarPill
                              key={f.key}
                              active={unitFilter === f.key}
                              onClick={() => setUnitFilter(f.key)}
                            >
                              {f.label}
                            </DesktopParcelToolbarPill>
                          ))}
                        </div>
                      </div>
                      {parcele.length > 5 ? (
                        <SearchField
                          placeholder="Caută după nume, soi sau cultură..."
                          value={search}
                          onChange={(e) => setSearch(e.target.value)}
                          aria-label="Caută terenuri"
                        />
                      ) : null}
                    </div>
                  </div>
                  <ModuleEmptyCard
                    emoji={unitFilter === 'solar' ? '🏡' : unitFilter === 'livada' ? '🍎' : unitFilter === 'cultura_mare' ? '🚜' : '🌿'}
                    title={
                      unitFilter === 'solar'
                        ? 'Niciun solar adăugat'
                        : unitFilter === 'livada'
                          ? 'Nicio livadă adăugată'
                          : unitFilter === 'cultura_mare'
                            ? 'Nicio cultură mare adăugată'
                            : 'Niciun teren găsit'
                    }
                    hint={unitFilter === 'solar' ? 'Solariile vor apărea aici' : 'Modifică filtrul sau căutarea'}
                  />
                </div>
              </>
            ) : (
              <>
                <div className="space-y-3 md:hidden">
                  <ModulePillRow>
                    {PILL_FILTERS.filter((f) => f.key === 'toate' || unitFilterCounts[f.key] > 0).map((f) => (
                      <ModulePillFilterButton
                        key={f.key}
                        active={unitFilter === f.key}
                        onClick={() => setUnitFilter(f.key)}
                      >
                        {f.label}
                      </ModulePillFilterButton>
                    ))}
                  </ModulePillRow>
                  {parcele.length > 5 ? (
                    <SearchField
                      placeholder="Caută după nume, soi sau cultură..."
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      aria-label="Caută terenuri"
                    />
                  ) : null}
                  <div className="grid grid-cols-1 gap-3">
                    {filteredParcele.map((parcela) => {
                      const isSolar = normalizeUnitateTip(parcela.tip_unitate) === 'solar'
                      const isActiveForMeteo = parcela.id === activeMeteoParcelaId
                      return (
                        <TerenCard
                          key={parcela.id}
                          parcela={parcela}
                          latestActivity={latestActivityByParcela.get(parcela.id)}
                          activeCulturiCount={activeCulturiCounts[parcela.id] ?? 0}
                          isExpanded={expandedId === parcela.id}
                          onToggle={(id) => setExpandedId((current) => (current === id ? null : id))}
                          onAddActivity={(id) => {
                            setAddActivityParcelaId(id)
                            setAddActivityOpen(true)
                          }}
                          onTratamente={(id) => {
                            router.push(`/parcele/${id}/tratamente`)
                          }}
                          onHistoric={() => {
                            if (isSolar) {
                              router.push(`/parcele?selected=${encodeURIComponent(parcela.id)}`)
                            } else {
                              router.push('/activitati-agricole')
                            }
                          }}
                          onEdit={(p) => { setSelectedParcela(p); setEditOpen(true) }}
                          onDelete={(p) => { setSelectedParcela(p); setDeleteOpen(true) }}
                          onAddCultura={() => setAddCulturaParcelaId(parcela.id)}
                          onAddMicroclimat={() => setAddMicroclimatParcelaId(parcela.id)}
                          onDesfiintaCultura={(c) => setDesfiintaState({ cultura: c, parcelaId: parcela.id })}
                          meteoAutoSummary={meteoAutoSummary}
                          hasManualMicroclimat={isActiveForMeteo && isSolar && desktopMicroclimatLogs.length > 0}
                          onOpenManualMicroclimat={() =>
                            router.push(`/parcele?selected=${encodeURIComponent(parcela.id)}`)
                          }
                        />
                      )
                    })}
                  </div>
                </div>

                <div className="hidden md:block md:space-y-3">
                  <div
                    className={cn(
                      'sticky top-0 z-30 border-b border-[var(--surface-divider)] bg-white transition-[box-shadow,padding] duration-200 dark:bg-[var(--agri-surface)]',
                      desktopDockScrolled ? 'py-2 shadow-[0_6px_20px_-14px_rgba(12,15,19,0.1)]' : 'py-2.5 shadow-none',
                    )}
                  >
                    <div className={cn('flex flex-col gap-2', desktopDockScrolled && 'gap-1.5')}>
                      <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1.5">
                        <div className="flex shrink-0 items-center gap-1.5">
                          <span className="text-[10px] font-bold uppercase tracking-[0.06em] text-[var(--agri-text-muted)]">
                            Terenuri
                          </span>
                          <span className="tabular-nums rounded-md border border-[var(--surface-divider)] bg-white px-1.5 py-0.5 text-[10px] font-semibold text-[var(--agri-text-muted)] dark:bg-[var(--agri-surface)]">
                            {filteredParcele.length}
                          </span>
                        </div>
                        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1">
                          {PILL_FILTERS.filter((f) => f.key === 'toate' || unitFilterCounts[f.key] > 0).map((f) => (
                            <DesktopParcelToolbarPill
                              key={f.key}
                              active={unitFilter === f.key}
                              onClick={() => setUnitFilter(f.key)}
                            >
                              {f.label}
                            </DesktopParcelToolbarPill>
                          ))}
                        </div>
                      </div>
                      {parcele.length > 5 ? (
                        <SearchField
                          placeholder="Caută după nume, soi sau cultură..."
                          value={search}
                          onChange={(e) => setSearch(e.target.value)}
                          aria-label="Caută terenuri"
                        />
                      ) : null}
                    {(() => {
                      const n = filteredParcele.length
                      return (
                        <div
                          className={cn(
                            'min-w-0 w-full',
                            n > 6
                              ? 'flex gap-3 overflow-x-auto pb-1 pt-0.5 [scrollbar-gutter:stable]'
                              : n <= 2
                                ? 'flex w-full flex-wrap gap-3 md:gap-4'
                                : 'grid w-full gap-3'
                          )}
                          style={n > 2 && n <= 6 ? { gridTemplateColumns: `repeat(${n}, minmax(0, 1fr))` } : undefined}
                        >
                          {filteredParcele.map((parcela) => {
                            const isSelected = desktopSelectedParcela?.id === parcela.id
                            const wrapClass =
                              n > 6
                                ? 'min-w-[160px] max-w-[220px] shrink-0'
                                : n <= 2
                                  ? 'min-w-0 flex-1 basis-0 md:min-w-[12rem]'
                                  : 'min-w-0'
                            return (
                              <div key={parcela.id} className={wrapClass}>
                                <DesktopParcelStripCard
                                  parcela={parcela}
                                  isSelected={isSelected}
                                  latestActivity={latestActivityByParcela.get(parcela.id)}
                                  today={today}
                                  onSelect={() => {
                                    setDesktopSelectedParcelaId(parcela.id)
                                    setDesktopInspectorTab('prezentare')
                                  }}
                                />
                              </div>
                            )
                          })}
                        </div>
                      )
                    })()}
                    </div>
                  </div>

                  <section className="rounded-xl border border-[var(--surface-divider)] bg-white shadow-[0_1px_4px_-1px_rgba(12,15,19,0.06)] dark:bg-[var(--agri-surface)] dark:shadow-none">
                    {!desktopSelectedParcela ? (
                      <div className="flex min-h-[360px] items-center justify-center p-6 text-sm text-[var(--agri-text-muted)]">
                        Selectează o parcelă pentru detalii.
                      </div>
                    ) : (
                      <div className="flex h-full min-h-[360px] flex-col">
                        <div className="shrink-0 border-b border-[var(--surface-divider)] bg-white px-4 py-3 md:px-6 lg:px-8 dark:bg-[var(--agri-surface)]">
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div className="min-w-0">
                              <h2 className="truncate text-2xl font-bold tracking-tight text-[var(--agri-text)]">
                                {desktopSelectedParcela.nume_parcela || 'Teren'}
                              </h2>
                              <p className="mt-1 text-sm text-[var(--agri-text-muted)]">
                                {buildParcelaInspectorSubtitle(desktopSelectedParcela)}
                              </p>
                            </div>
                            {(() => {
                              const b = operationalBadge(coerceStatusOperationalFromDb(desktopSelectedParcela.status_operational))
                              return (
                                <span
                                  className="inline-flex shrink-0 items-center rounded-full border bg-white px-2.5 py-0.5 text-[11px] font-bold"
                                  style={{ borderColor: b.color, color: b.color }}
                                >
                                  {b.text}
                                </span>
                              )
                            })()}
                          </div>

                          <div className="mt-3 grid grid-cols-2 gap-2 md:gap-2.5 lg:grid-cols-4">
                            {(
                              [
                                {
                                  label: 'Rol',
                                  value: SCOP_LABELS[coerceParcelaScopFromDb(desktopSelectedParcela.rol)],
                                },
                                {
                                  label: 'Culturi active',
                                  value: String(activeCulturiCounts[desktopSelectedParcela.id] ?? 0),
                                },
                                {
                                  label: 'Ultima activitate',
                                  value: latestActivityByParcela.get(desktopSelectedParcela.id)
                                    ? activityRelativeTime(latestActivityByParcela.get(desktopSelectedParcela.id)?.date, today)
                                    : 'Nicio activitate',
                                },
                                {
                                  label: 'Ultimul tratament',
                                  value: latestTreatmentByParcela.get(desktopSelectedParcela.id)
                                    ? activityRelativeTime(latestTreatmentByParcela.get(desktopSelectedParcela.id)?.date, today)
                                    : 'Nedisponibil',
                                },
                              ] as const
                            ).map((cell) => (
                              <div
                                key={cell.label}
                                className="rounded-lg border border-[var(--surface-divider)] bg-white px-2.5 py-2 dark:bg-[var(--agri-surface)]"
                              >
                                <p className="text-[10px] font-medium uppercase tracking-wide text-[var(--agri-text-muted)]">{cell.label}</p>
                                <p className="mt-0.5 text-sm font-semibold leading-snug text-[var(--agri-text)]">{cell.value}</p>
                              </div>
                            ))}
                          </div>

                          <div className="mt-3 flex flex-wrap items-center justify-between gap-x-3 gap-y-2 border-t border-[var(--surface-divider)] pt-3">
                            <div className="flex min-w-0 flex-wrap items-center gap-2">
                              <button
                                type="button"
                                onClick={() => {
                                  setAddActivityParcelaId(desktopSelectedParcela.id)
                                  setAddActivityOpen(true)
                                }}
                                className="inline-flex h-8 items-center justify-center rounded-lg bg-[var(--agri-primary)] px-3 text-xs font-semibold text-[var(--agri-primary-contrast)] shadow-[var(--shadow-soft)] transition-opacity hover:opacity-95"
                              >
                                + Activitate
                              </button>
                              <button
                                type="button"
                                onClick={() => router.push(`/parcele/${desktopSelectedParcela.id}/tratamente`)}
                                className="inline-flex h-8 items-center justify-center rounded-lg border border-[var(--border-default)] bg-[var(--surface-card)] px-3 text-xs font-semibold text-[var(--agri-text)] shadow-[var(--shadow-soft)] transition-colors hover:bg-[var(--surface-card-muted)] dark:bg-[var(--agri-surface)]"
                              >
                                <SprayCan className="mr-1.5 h-3.5 w-3.5 text-[var(--agri-primary)]" aria-hidden />
                                + Tratament
                              </button>
                              {normalizeUnitateTip(desktopSelectedParcela.tip_unitate) === 'solar' ? (
                                <>
                                  <button
                                    type="button"
                                    onClick={() => setAddCulturaParcelaId(desktopSelectedParcela.id)}
                                    className="inline-flex h-8 items-center justify-center rounded-lg border border-[var(--border-default)] bg-[var(--surface-card)] px-3 text-xs font-semibold text-[var(--agri-text)] shadow-[var(--shadow-soft)] transition-colors hover:bg-[var(--surface-card-muted)] dark:bg-[var(--agri-surface)]"
                                  >
                                    + Cultură
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setAddMicroclimatParcelaId(desktopSelectedParcela.id)}
                                    className="inline-flex h-8 items-center justify-center rounded-lg border border-[color:color-mix(in_srgb,var(--status-info-text)_28%,var(--border-default))] bg-[var(--surface-card)] px-3 text-xs font-semibold text-[var(--status-info-text)] shadow-[var(--shadow-soft)] transition-colors hover:bg-[var(--surface-card-muted)]"
                                  >
                                    + Microclimat
                                  </button>
                                </>
                              ) : null}
                            </div>
                            <div className="flex flex-wrap items-center justify-end gap-2">
                              <button
                                type="button"
                                onClick={() => {
                                  setSelectedParcela(desktopSelectedParcela)
                                  setEditOpen(true)
                                }}
                                className="inline-flex h-8 items-center justify-center rounded-lg border border-[var(--border-default)] bg-[var(--surface-card)] px-3 text-xs font-semibold text-[var(--agri-text)] shadow-[var(--shadow-soft)] transition-colors hover:bg-[var(--surface-card-muted)]"
                              >
                                Editează
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setSelectedParcela(desktopSelectedParcela)
                                  setDeleteOpen(true)
                                }}
                                className="inline-flex h-8 items-center justify-center rounded-lg border border-[color:color-mix(in_srgb,var(--destructive)_35%,var(--border-default))] bg-transparent px-3 text-xs font-semibold text-[var(--destructive)] transition-colors hover:bg-[color:color-mix(in_srgb,var(--destructive)_08%,transparent)]"
                              >
                                Șterge
                              </button>
                            </div>
                          </div>
                        </div>

                        <div className="shrink-0 border-b border-[var(--surface-divider)] bg-white px-4 pb-0 pt-2 md:px-6 lg:px-8 dark:bg-[var(--agri-surface)]">
                          <div className="flex flex-wrap gap-0.5">
                            {(
                              [
                                ['prezentare', 'Prezentare'],
                                ['jurnal', 'Jurnal'],
                                ['tratamente', 'Tratamente'],
                                ['microclimat', 'Microclimat'],
                              ] as const
                            ).map(([key, label]) => {
                              const active = desktopInspectorTab === key
                              return (
                                <button
                                  key={key}
                                  type="button"
                                  onClick={() => setDesktopInspectorTab(key)}
                                  className={cn(
                                    'relative rounded-t-md px-3 py-2 text-xs font-semibold transition-colors',
                                    active
                                      ? 'text-[var(--pill-active-border)]'
                                      : 'text-[var(--agri-text-muted)] hover:text-[var(--agri-text)]'
                                  )}
                                >
                                  {active ? (
                                    <span
                                      className="absolute inset-x-1 bottom-0 h-0.5 rounded-full bg-[var(--pill-active-border)]"
                                      aria-hidden
                                    />
                                  ) : null}
                                  <span className={cn('relative', active && 'font-bold')}>{label}</span>
                                </button>
                              )
                            })}
                          </div>
                        </div>

                        <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden bg-white p-3.5 md:p-5 lg:px-8 lg:pb-5 lg:pt-4 dark:bg-[var(--agri-surface)]">
                          {desktopInspectorTab === 'prezentare' ? (
                            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 md:gap-4 xl:grid-cols-3 xl:gap-4">
                              <div className="flex min-h-0 flex-col rounded-lg border border-[var(--surface-divider)] bg-white p-3 shadow-[0_1px_2px_rgba(12,15,19,0.04)] dark:bg-[var(--agri-surface)]">
                                <p className="text-xs font-medium text-[var(--agri-text-muted)]">Rezumat agronomic</p>
                                <p className="mt-1.5 text-sm font-semibold leading-snug text-[var(--agri-text)]">
                                  {buildParcelaSummaryLine(desktopSelectedParcela, activeCulturiCounts[desktopSelectedParcela.id] ?? 0) ||
                                    'Fără sumar disponibil'}
                                </p>
                                <p className="mt-2 text-[11px] leading-snug text-[var(--agri-text-muted)]">
                                  Pentru istoric detaliat, vezi tabul Jurnal.
                                </p>
                              </div>
                              <div className="flex min-h-0 flex-col rounded-lg border border-[var(--surface-divider)] bg-white p-3 shadow-[0_1px_2px_rgba(12,15,19,0.04)] dark:bg-[var(--agri-surface)]">
                                <p className="text-xs font-medium text-[var(--agri-text-muted)]">Stadiu fenologic curent</p>
                                <p className="mt-1.5 text-sm font-semibold text-[var(--agri-text)]">
                                  {desktopCurrentStage
                                    ? formatEtapaLabel(
                                        desktopCurrentStage.stadiu,
                                        desktopSelectedGrupBiologic,
                                        desktopCurrentStage.cohort
                                      )
                                    : 'Niciun stadiu înregistrat'}
                                </p>
                                <p className="mt-2 text-[11px] leading-snug text-[var(--agri-text-muted)]">
                                  {desktopCurrentStage
                                    ? `Observat la ${new Date(desktopCurrentStage.data_observata).toLocaleDateString('ro-RO')}`
                                    : 'Actualizează stadiul din fluxul existent (parcelă / tratamente).'}
                                </p>
                              </div>
                              <div className="flex min-h-0 flex-col rounded-lg border border-[var(--surface-divider)] bg-white p-3 shadow-[0_1px_2px_rgba(12,15,19,0.04)] dark:bg-[var(--agri-surface)]">
                                <p className="text-xs font-medium text-[var(--agri-text-muted)]">Culturi și soiuri</p>
                                <p className="mt-1.5 text-sm font-semibold leading-snug text-[var(--agri-text)]">
                                  {buildParcelaCulturaSoiLine(desktopSelectedParcela) || 'Nu sunt completate cultură/soi la nivel de teren.'}
                                </p>
                                {desktopSelectedParcela.tip_fruct?.trim() ? (
                                  <p className="mt-2 text-[11px] text-[var(--agri-text-muted)]">
                                    Tip fruct: {desktopSelectedParcela.tip_fruct.trim()}
                                  </p>
                                ) : null}
                                <p className="mt-2 text-[11px] text-[var(--agri-text-muted)]">
                                  {getCulturiCountLabel(activeCulturiCounts[desktopSelectedParcela.id] ?? 0, true)}
                                </p>
                              </div>
                              <div className="flex min-h-0 flex-col rounded-lg border border-[var(--surface-divider)] bg-white p-3 shadow-[0_1px_2px_rgba(12,15,19,0.04)] dark:bg-[var(--agri-surface)]">
                                <p className="text-xs font-medium text-[var(--agri-text-muted)]">Ultimele intervenții</p>
                                {latestActivityByParcela.get(desktopSelectedParcela.id) ? (
                                  <p className="mt-1.5 text-sm font-semibold text-[var(--agri-text)]">
                                    Activitate: {latestActivityByParcela.get(desktopSelectedParcela.id)?.type}
                                    {latestActivityByParcela.get(desktopSelectedParcela.id)?.product
                                      ? ` · ${latestActivityByParcela.get(desktopSelectedParcela.id)?.product}`
                                      : ''}
                                  </p>
                                ) : (
                                  <p className="mt-1.5 text-sm text-[var(--agri-text-muted)]">Nicio activitate recentă în datele încărcate.</p>
                                )}
                                {latestTreatmentByParcela.get(desktopSelectedParcela.id) ? (
                                  <p className="mt-2 text-sm text-[var(--agri-text)]">
                                    Tratament: {latestTreatmentByParcela.get(desktopSelectedParcela.id)?.type}
                                    {latestTreatmentByParcela.get(desktopSelectedParcela.id)?.product
                                      ? ` · ${latestTreatmentByParcela.get(desktopSelectedParcela.id)?.product}`
                                      : ''}
                                  </p>
                                ) : (
                                  <p className="mt-2 text-sm text-[var(--agri-text-muted)]">Niciun tratament recent în datele încărcate.</p>
                                )}
                              </div>
                              <div className="flex min-h-0 flex-col rounded-lg border border-[var(--surface-divider)] bg-white p-3 shadow-[0_1px_2px_rgba(12,15,19,0.04)] dark:bg-[var(--agri-surface)]">
                                <p className="text-xs font-medium text-[var(--agri-text-muted)]">Microclimat / date automate</p>
                                <div className="mt-1.5">
                                  <MicroclimatAutoCard summary={meteoAutoSummary} compact surfaceTone="clean" />
                                </div>
                              </div>
                              <div className="flex min-h-0 flex-col rounded-lg border border-[var(--surface-divider)] bg-white p-3 shadow-[0_1px_2px_rgba(12,15,19,0.04)] dark:bg-[var(--agri-surface)]">
                                <p className="text-xs font-medium text-[var(--agri-text-muted)]">Observații / note</p>
                                <p className="mt-1.5 text-sm leading-snug text-[var(--agri-text)]">
                                  {(desktopSelectedParcela.observatii ?? '').trim() || 'Nu există observații salvate pe acest teren.'}
                                </p>
                              </div>
                            </div>
                          ) : null}

                          {desktopInspectorTab === 'jurnal' ? (
                            <div className="space-y-3">
                              <div className="space-y-1.5">
                                <p className="text-[10px] font-bold uppercase tracking-wide text-[var(--agri-text-muted)]">Tip</p>
                                <div className="flex flex-wrap gap-1.5">
                                  {(
                                    [
                                      ['all', 'Toate'],
                                      ['activitati', 'Activități'],
                                      ['tratamente', 'Tratamente'],
                                      ['recoltari', 'Recoltări'],
                                      ['stadii', 'Stadii'],
                                    ] as const
                                  ).map(([value, label]) => (
                                    <button
                                      key={value}
                                      type="button"
                                      onClick={() => setDesktopJournalTypeFilter(value)}
                                      className={cn(
                                        'rounded-full border px-2.5 py-1 text-[11px] font-semibold transition-colors',
                                        desktopJournalTypeFilter === value
                                          ? 'border-[var(--pill-active-border)] bg-white text-[var(--pill-active-border)] dark:bg-[var(--agri-surface)]'
                                          : 'border-[var(--surface-divider)] bg-white text-[var(--button-muted-text)] hover:border-[var(--agri-border)] dark:bg-[var(--agri-surface)]'
                                      )}
                                    >
                                      {label}
                                    </button>
                                  ))}
                                </div>
                              </div>

                              <div className="space-y-1.5">
                                <p className="text-[10px] font-bold uppercase tracking-wide text-[var(--agri-text-muted)]">Perioadă</p>
                                <div className="flex flex-wrap gap-1.5">
                                  {(
                                    [
                                      ['7d', '7 zile'],
                                      ['30d', '30 zile'],
                                      ['sezon', 'Sezon'],
                                      ['tot', 'Tot'],
                                    ] as const
                                  ).map(([value, label]) => (
                                    <button
                                      key={value}
                                      type="button"
                                      onClick={() => setDesktopJournalPeriodFilter(value)}
                                      className={cn(
                                        'rounded-full border px-2.5 py-1 text-[11px] font-semibold transition-colors',
                                        desktopJournalPeriodFilter === value
                                          ? 'border-[var(--pill-active-border)] bg-white text-[var(--pill-active-border)] dark:bg-[var(--agri-surface)]'
                                          : 'border-[var(--surface-divider)] bg-white text-[var(--button-muted-text)] hover:border-[var(--agri-border)] dark:bg-[var(--agri-surface)]'
                                      )}
                                    >
                                      {label}
                                    </button>
                                  ))}
                                </div>
                              </div>

                              <p className="text-[11px] text-[var(--agri-text-muted)]">{journalEventCountLabel(jurnalEntries.length)}</p>

                              {filteredJournalEntries.length === 0 ? (
                                <div className="rounded-lg border border-[var(--surface-divider)] bg-white p-3.5 text-sm text-[var(--agri-text-muted)] dark:bg-[var(--agri-surface)]">
                                  {jurnalEntries.length === 0
                                    ? 'Nu există încă evenimente în jurnal pentru această parcelă.'
                                    : desktopJournalTypeFilter !== 'all' &&
                                        journalKindCounts[
                                          desktopJournalTypeFilter === 'activitati'
                                            ? 'activitate'
                                            : desktopJournalTypeFilter === 'tratamente'
                                              ? 'tratament'
                                              : desktopJournalTypeFilter === 'recoltari'
                                                ? 'recoltare'
                                                : 'stadiu'
                                        ] === 0
                                      ? `Nu există încă ${getJournalTypeLabel(desktopJournalTypeFilter).toLowerCase()} pentru această parcelă.`
                                      : `Nu există evenimente în ${getJournalPeriodLabel(desktopJournalPeriodFilter)} pentru filtrul selectat.`}
                                </div>
                              ) : (
                                <div className="space-y-1.5">
                                  {filteredJournalEntries.slice(0, 20).map((entry) => {
                                    const kind = getJournalEntryKind(entry)
                                    const meta = getJournalKindMeta(kind)
                                    return (
                                      <div
                                        key={entry.id}
                                        className="rounded-lg border border-[var(--surface-divider)] bg-white px-3 py-2 dark:bg-[var(--agri-surface)]"
                                      >
                                        <div className="flex items-start gap-2.5">
                                          <div
                                            className={cn(
                                              'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border',
                                              meta.toneClass
                                            )}
                                          >
                                            {meta.icon}
                                          </div>
                                          <div className="min-w-0 flex-1">
                                            <div className="flex items-start justify-between gap-2">
                                              <div className="min-w-0">
                                                <div className="flex items-center gap-1.5">
                                                  <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--agri-text-muted)]">{meta.label}</p>
                                                </div>
                                                <p className="truncate text-sm font-semibold leading-5 text-[var(--agri-text)]">{entry.title}</p>
                                                {entry.details ? (
                                                  <p className="mt-0.5 truncate text-[11px] text-[var(--agri-text-muted)]">{entry.details}</p>
                                                ) : null}
                                              </div>
                                              <span className="shrink-0 rounded-full border border-[var(--surface-divider)] bg-[var(--agri-surface)] px-2 py-0.5 text-[11px] font-semibold text-[var(--agri-text-muted)]">
                                                {new Date(entry.date).toLocaleDateString('ro-RO', {
                                                  day: '2-digit',
                                                  month: 'short',
                                                })}
                                              </span>
                                            </div>
                                          </div>
                                        </div>
                                      </div>
                                    )
                                  })}
                                </div>
                              )}
                            </div>
                          ) : null}

                          {desktopInspectorTab === 'tratamente' ? (
                            <div className="space-y-2.5">
                              <div className="grid gap-4 md:grid-cols-2 md:gap-5 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)] xl:gap-6">
                                <div className="rounded-lg border border-[var(--surface-divider)] bg-white p-3 dark:bg-[var(--agri-surface)]">
                                  <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--agri-text-muted)]">Ultimul tratament</p>
                                  {lastTreatmentEntry ? (
                                    <>
                                      <p className="mt-1 truncate text-sm font-semibold leading-5 text-[var(--agri-text)]">
                                        {lastTreatmentEntry.type}
                                      </p>
                                      <p className="mt-0.5 truncate text-[11px] text-[var(--agri-text-muted)]">
                                        {lastTreatmentEntry.product || 'Fără produs specificat'}
                                        {lastTreatmentEntry.dose ? ` · Doză: ${lastTreatmentEntry.dose}` : ''}
                                      </p>
                                    </>
                                  ) : (
                                    <p className="mt-1 text-sm text-[var(--agri-text-muted)]">Nu există tratamente înregistrate pentru această parcelă.</p>
                                  )}
                                </div>
                                <div className="rounded-lg border border-[var(--surface-divider)] bg-white p-3 dark:bg-[var(--agri-surface)]">
                                  <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--agri-text-muted)]">Ritm</p>
                                  <p className="mt-1 text-sm font-semibold text-[var(--agri-text)]">
                                    {lastTreatmentDays !== null ? `${lastTreatmentDays} zile` : 'N/A'}
                                  </p>
                                  <p className="mt-0.5 text-[11px] text-[var(--agri-text-muted)]">
                                    De la ultima intervenție înregistrată.
                                  </p>
                                </div>
                              </div>

                              <div className="space-y-1.5">
                                {selectedParcelaTratamente.slice(0, 8).map((item, index) => (
                                  <div
                                    key={`${item.date}:${item.type}:${index}`}
                                    className="rounded-lg border border-[var(--surface-divider)] bg-white px-3 py-2 dark:bg-[var(--agri-surface)]"
                                  >
                                    <div className="flex items-start justify-between gap-3">
                                      <div className="min-w-0">
                                        <p className="truncate text-sm font-semibold leading-5 text-[var(--agri-text)]">{item.type}</p>
                                        <p className="mt-0.5 truncate text-[11px] text-[var(--agri-text-muted)]">
                                          {item.product || 'Fără produs'}{item.dose ? ` · ${item.dose}` : ''}
                                        </p>
                                      </div>
                                      <span className="shrink-0 rounded-full border border-[var(--surface-divider)] bg-[var(--agri-surface)] px-2 py-0.5 text-[11px] font-semibold text-[var(--agri-text-muted)]">
                                        {new Date(item.date).toLocaleDateString('ro-RO', {
                                          day: '2-digit',
                                          month: 'short',
                                        })}
                                      </span>
                                    </div>
                                  </div>
                                ))}
                                {selectedParcelaTratamente.length === 0 ? null : (
                                  <button
                                    type="button"
                                    onClick={() => router.push(`/parcele/${desktopSelectedParcela.id}/tratamente`)}
                                    className="inline-flex h-8 items-center justify-center rounded-lg border border-[var(--surface-divider)] bg-white px-3 text-[11px] font-semibold text-[var(--agri-text)] transition-colors hover:border-[var(--agri-border)] dark:bg-[var(--agri-surface)]"
                                  >
                                    <SprayCan className="mr-1.5 h-3.5 w-3.5 text-[var(--pill-active-border)]" aria-hidden />
                                    Deschide fluxul complet de tratamente
                                  </button>
                                )}
                              </div>
                            </div>
                          ) : null}

                          {desktopInspectorTab === 'microclimat' ? (
                            <div className="space-y-2.5">
                              <MicroclimatAutoCard summary={meteoAutoSummary} surfaceTone="clean" />

                              <div className="rounded-lg border border-[var(--surface-divider)] bg-white p-3 dark:bg-[var(--agri-surface)]">
                                <div className="flex items-center justify-between gap-3">
                                  <div className="flex items-center gap-2">
                                    <Droplets className="h-3.5 w-3.5 text-[var(--pill-active-border)]" aria-hidden />
                                    <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--agri-text-muted)]">Date manuale</p>
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      router.push(
                                        `/parcele?selected=${encodeURIComponent(desktopSelectedParcela.id)}`
                                      )
                                    }
                                    className="inline-flex h-7 items-center rounded-md border border-[var(--button-muted-border)] bg-[var(--button-muted-bg)] px-2.5 text-[11px] font-semibold text-[var(--button-muted-text)]"
                                  >
                                    Vezi istoric meteo
                                  </button>
                                </div>

                                {normalizeUnitateTip(desktopSelectedParcela.tip_unitate) !== 'solar' ? (
                                  <div className="mt-2 rounded-lg border border-[var(--surface-divider)] bg-white px-3 py-2 text-sm text-[var(--agri-text-muted)] dark:bg-[var(--agri-surface)]">
                                    Microclimatul manual este disponibil în principal pentru solarii.
                                  </div>
                                ) : desktopMicroclimatLogs.length === 0 ? (
                                  <div className="mt-2 rounded-lg border border-[var(--surface-divider)] bg-white px-3 py-2 text-sm text-[var(--agri-text-muted)] dark:bg-[var(--agri-surface)]">
                                    Nu există încă înregistrări manuale de microclimat.
                                  </div>
                                ) : (
                                  <div className="mt-2 space-y-1.5">
                                    {latestDesktopMicroclimat ? (
                                      <div className="rounded-md border border-[var(--surface-divider)] bg-white px-3 py-2 shadow-[0_1px_2px_rgba(12,15,19,0.04)] dark:bg-[var(--agri-surface)]">
                                        <div className="flex items-start justify-between gap-3">
                                          <div className="min-w-0">
                                            <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--agri-text-muted)]">Ultima înregistrare</p>
                                            <p className="mt-0.5 text-sm font-semibold tabular-nums text-[var(--agri-text)]">
                                              {Number(latestDesktopMicroclimat.temperatura).toFixed(1)}°C · {Number(latestDesktopMicroclimat.umiditate).toFixed(0)}%
                                            </p>
                                          </div>
                                          <span className="shrink-0 rounded-full border border-[var(--surface-divider)] bg-white px-2 py-0.5 text-[11px] font-semibold text-[var(--agri-text-muted)] dark:bg-[var(--agri-surface)]">
                                            {new Date(latestDesktopMicroclimat.created_at).toLocaleDateString('ro-RO', {
                                              day: '2-digit',
                                              month: 'short',
                                            })}
                                          </span>
                                        </div>
                                      </div>
                                    ) : null}

                                    {desktopMicroclimatLogs.slice(1, 5).map((log) => (
                                      <div key={log.id} className="rounded-lg border border-[var(--surface-divider)] bg-white px-3 py-2 dark:bg-[var(--agri-surface)]">
                                        <div className="flex items-start justify-between gap-3">
                                          <div className="min-w-0">
                                            <p className="text-sm font-semibold leading-5 text-[var(--agri-text)]">
                                              {Number(log.temperatura).toFixed(1)}°C · {Number(log.umiditate).toFixed(0)}%
                                            </p>
                                            <p className="mt-0.5 text-[11px] text-[var(--agri-text-muted)]">
                                              Înregistrare manuală
                                            </p>
                                          </div>
                                          <span className="shrink-0 rounded-full border border-[var(--surface-divider)] bg-white px-2 py-0.5 text-[11px] font-semibold text-[var(--agri-text-muted)] dark:bg-[var(--agri-surface)]">
                                            {new Date(log.created_at).toLocaleDateString('ro-RO', {
                                              day: '2-digit',
                                              month: 'short',
                                            })}
                                          </span>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>

                              <div className="rounded-lg border border-[var(--surface-divider)] bg-white p-3 dark:bg-[var(--agri-surface)]">
                                <div className="flex items-center justify-between gap-3">
                                  <div className="flex items-center gap-2">
                                    <Clock3 className="h-3.5 w-3.5 text-[var(--pill-active-border)]" aria-hidden />
                                    <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--agri-text-muted)]">Istoric</p>
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      router.push(
                                        `/parcele?selected=${encodeURIComponent(desktopSelectedParcela.id)}`
                                      )
                                    }
                                    className="inline-flex h-7 items-center rounded-md border border-[var(--button-muted-border)] bg-[var(--button-muted-bg)] px-2.5 text-[11px] font-semibold text-[var(--button-muted-text)]"
                                  >
                                    Vezi istoric meteo
                                  </button>
                                </div>
                                <p className="mt-1 text-sm text-[var(--agri-text-muted)]">
                                  Istoricul complet rămâne disponibil în pagina parcelei, fără a introduce un istoric persistent nou aici.
                                </p>
                              </div>
                            </div>
                          ) : null}
                        </div>
                      </div>
                    )}
                  </section>
                </div>
              </>
            )}
          </>
        ) : null}
      </DashboardContentShell>

      <AddParcelDrawer
        open={addOpen}
        onOpenChange={setAddOpen}
        soiuriDisponibile={SOIURI_DISPONIBILE}
        onCreated={() => queryClient.invalidateQueries({ queryKey: queryKeys.parcele, exact: true })}
      />

      <EditParcelDialog
        open={editOpen}
        onOpenChange={(nextOpen) => {
          setEditOpen(nextOpen)
          if (!nextOpen) setSelectedParcela(null)
        }}
        parcela={selectedParcela}
        soiuriDisponibile={SOIURI_DISPONIBILE}
        onSaved={() => queryClient.invalidateQueries({ queryKey: queryKeys.parcele, exact: true })}
      />

      <ConfirmDeleteDialog
        open={deleteOpen}
        onOpenChange={(nextOpen) => {
          setDeleteOpen(nextOpen)
          if (!nextOpen) setSelectedParcela(null)
        }}
        itemType="Teren"
        itemName={buildParcelaDeleteLabel(selectedParcela)}
        description={`Ștergi terenul ${buildParcelaDeleteLabel(selectedParcela)}?`}
        loading={deleteMutation.isPending}
        onConfirm={() => {
          if (!selectedParcela) return
          setDeleteOpen(false)
          scheduleDelete(selectedParcela)
          setSelectedParcela(null)
        }}
      />

      <AddActivitateAgricolaDialog
        open={addActivityOpen}
        onOpenChange={(open) => {
          setAddActivityOpen(open)
          if (!open) setAddActivityParcelaId(undefined)
        }}
        hideTrigger
        defaultParcelaId={addActivityParcelaId}
        contextParcelaLabel={parcele.find((parcela) => parcela.id === addActivityParcelaId)?.nume_parcela ?? undefined}
      />

      <AddCulturaDialog
        open={addCulturaParcelaId !== null}
        onOpenChange={(open) => { if (!open) setAddCulturaParcelaId(null) }}
        parcelaId={addCulturaParcelaId ?? ''}
        tipUnitate={addCulturaParcela?.tip_unitate}
        parcelaLabel={addCulturaParcela?.nume_parcela ?? undefined}
        onCreated={() => {
          if (addCulturaParcelaId) {
            queryClient.invalidateQueries({ queryKey: queryKeys.culturi(addCulturaParcelaId) })
            queryClient.invalidateQueries({ queryKey: ['culturi-counts'] })
          }
        }}
      />

      <AddMicroclimatDialog
        open={addMicroclimatParcelaId !== null}
        onOpenChange={(open) => { if (!open) setAddMicroclimatParcelaId(null) }}
        parcelaId={addMicroclimatParcelaId}
        tipUnitate={addMicroclimatParcela?.tip_unitate}
        onCreated={() => { /* microclimat logs don't need cache invalidation here */ }}
      />

      <DesfiinteazaCulturaDialog
        open={desfiintaState !== null}
        onOpenChange={(open) => { if (!open) setDesfiintaState(null) }}
        cultura={desfiintaState?.cultura ?? null}
        onDesfiintat={() => {
          if (desfiintaState) {
            queryClient.invalidateQueries({ queryKey: queryKeys.culturi(desfiintaState.parcelaId) })
            queryClient.invalidateQueries({ queryKey: ['culturi-counts'] })
          }
        }}
      />
    </AppShell>
  )
}
