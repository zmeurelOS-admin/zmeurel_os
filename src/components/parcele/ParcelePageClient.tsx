'use client'

import dynamic from 'next/dynamic'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ChevronDown, ChevronUp, Map as MapIcon, SprayCan } from 'lucide-react'
import { useRouter, useSearchParams } from 'next/navigation'

import { AppShell } from '@/components/app/AppShell'
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
import { getConditiiMediuLabel } from '@/lib/parcele/culturi'
import { normalizeUnitateTip, type UnitateTip } from '@/lib/parcele/unitate'
import { buildLatestActivityByParcela, getActivityDaysAgo, getActivityPauseRemainingDays } from '@/lib/activitati/timeline'
import { queryKeys } from '@/lib/query-keys'
import { cn } from '@/lib/utils'
import { getActivitatiAgricole } from '@/lib/supabase/queries/activitati-agricole'
import { getSolarClimateLogs } from '@/lib/supabase/queries/solar-tracking'
import {
  createEtapaCultura,
  deleteEtapaCultura,
  getActiveCulturiCountsByParcela,
  getEtapeCulturaById,
  type Cultura,
  type EtapaCultura,
} from '@/lib/supabase/queries/culturi'
import { getCulturiForSolar } from '@/lib/supabase/queries/culturi'
import { deleteParcela, getParcele, type Parcela } from '@/lib/supabase/queries/parcele'
import { buildParcelaDeleteLabel } from '@/lib/ui/delete-labels'
import { toast } from '@/lib/ui/toast'
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

const SOIURI_DISPONIBILE = ['Delniwa', 'Maravilla', 'Enrosadira', 'Husaria']

const PILL_FILTERS: Array<{ key: UnitFilter; label: string }> = [
  { key: 'toate', label: 'Toate' },
  { key: 'camp', label: 'Câmp' },
  { key: 'cultura_mare', label: 'Cultură mare' },
  { key: 'solar', label: 'Solarii' },
  { key: 'livada', label: 'Livadă' },
]

const ETAPA_PILLS = [
  { value: 'plantare', label: '🌱 Plantare' },
  { value: 'primele_flori', label: '🌸 Primele flori' },
  { value: 'fructificare', label: '🍅 Fructificare' },
  { value: 'cules', label: '🧺 Cules' },
  { value: 'altele', label: '📋 Altele' },
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
  const e = etapa.toLowerCase()
  if (e.includes('plantare') || e.includes('flori') || e.includes('fructif') || e.includes('cules')) return '#2D6A4F'
  if (e.includes('seceta') || e.includes('daun') || e.includes('problem') || e.includes('desfiin')) return '#e85d5d'
  return '#95b8a0'
}

function formatEtapaLabel(value: string | null | undefined): string {
  const raw = (value ?? '').trim()
  if (!raw) return 'Plantare'
  const normalized = raw.replaceAll('_', ' ').trim()
  return normalized.charAt(0).toUpperCase() + normalized.slice(1)
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

function CulturaCard({
  cultura,
  onDesfiintaCultura,
}: {
  cultura: Cultura
  onDesfiintaCultura: (c: Cultura) => void
}) {
  const queryClient = useQueryClient()
  const [expanded, setExpanded] = useState(false)
  const [showAddForm, setShowAddForm] = useState(false)
  const [selectedEtapa, setSelectedEtapa] = useState('')
  const [customEtapa, setCustomEtapa] = useState('')
  const [observatii, setObservatii] = useState('')
  const [dataEtapa, setDataEtapa] = useState(new Date().toISOString().slice(0, 10))

  const fallbackStage = (() => {
    const normalized = normalizeStr(cultura.stadiu)
    if (!normalized || normalized === 'crestere' || normalized === 'creștere') return 'Plantare'
    return formatEtapaLabel(cultura.stadiu)
  })()
  const name = [cultura.tip_planta, cultura.soi].filter(Boolean).join(' · ')
  const isActive = cultura.activa !== false

  const { data: etape = [], isLoading: etapeLoading } = useQuery({
    queryKey: queryKeys.etapeCultura(cultura.id),
    queryFn: () => getEtapeCulturaById(cultura.id),
    enabled: true,
    staleTime: 30000,
    refetchOnWindowFocus: false,
  })
  const latestStageLabel = formatEtapaLabel(etape[0]?.etapa ?? fallbackStage)

  const addMutation = useMutation({
    mutationFn: () => {
      const etapa = selectedEtapa === 'altele' ? customEtapa.trim() : selectedEtapa
      if (!etapa) throw new Error('Selectează o etapă')
      return createEtapaCultura({
        cultura_id: cultura.id,
        etapa,
        observatii: observatii || undefined,
        data_etapa: dataEtapa,
      })
    },
    onSuccess: () => {
      toast.success('Etapă salvată')
      queryClient.invalidateQueries({ queryKey: queryKeys.etapeCultura(cultura.id) })
      setShowAddForm(false)
      setSelectedEtapa('')
      setCustomEtapa('')
      setObservatii('')
      setDataEtapa(new Date().toISOString().slice(0, 10))
    },
    onError: (err: unknown) => toast.error(toErrorMessage(err)),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteEtapaCultura(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.etapeCultura(cultura.id) })
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
          {etapeLoading ? (
            <div style={{ fontSize: 11, color: 'var(--text-hint)', marginBottom: 8 }}>Se încarcă...</div>
          ) : etape.length === 0 ? (
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
              {etape.map((etapa: EtapaCultura) => (
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
                      {etapa.etapa}
                    </div>
                    {etapa.observatii ? (
                      <div style={{ fontSize: 10, color: 'var(--agri-text-muted)', marginTop: 1 }}>{etapa.observatii}</div>
                    ) : null}
                  </div>
                  {/* Date + delete */}
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2, flexShrink: 0 }}>
                    <span style={{ fontSize: 10, color: 'var(--text-hint)' }}>{etapa.data_etapa}</span>
                    <button
                      type="button"
                      onClick={() => deleteMutation.mutate(etapa.id)}
                      disabled={deleteMutation.isPending}
                      style={{
                        fontSize: 10,
                        color: 'var(--text-hint)',
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        padding: 0,
                        lineHeight: 1,
                      }}
                      aria-label="Șterge etapă"
                    >
                      🗑
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Add etapa button */}
          {isActive && !showAddForm ? (
            <button
              type="button"
              onClick={() => setShowAddForm(true)}
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
              ＋ Adaugă etapă
            </button>
          ) : null}

          {showAddForm ? (
            <ResponsiveFormContainer
              open={showAddForm}
              onOpenChange={(nextOpen) => {
                setShowAddForm(nextOpen)
                if (!nextOpen) {
                  setSelectedEtapa('')
                  setCustomEtapa('')
                  setObservatii('')
                }
              }}
              title="Adaugă etapă"
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
                {/* Pills */}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginBottom: 8 }}>
                  {ETAPA_PILLS.map((p) => (
                    <button
                      key={p.value}
                      type="button"
                      onClick={() => setSelectedEtapa(p.value)}
                      style={{
                        padding: '4px 10px',
                        fontSize: 10,
                        fontWeight: 600,
                        borderRadius: 20,
                        border: `1px solid ${selectedEtapa === p.value ? 'var(--pill-active-border)' : 'var(--pill-inactive-border)'}`,
                        background: selectedEtapa === p.value ? 'var(--pill-active-bg)' : 'var(--pill-inactive-bg)',
                        color: selectedEtapa === p.value ? 'var(--pill-active-text)' : 'var(--pill-inactive-text)',
                        cursor: 'pointer',
                      }}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
                {/* Custom etapa field (if "Altele") */}
                {selectedEtapa === 'altele' ? (
                  <input
                    type="text"
                    value={customEtapa}
                    onChange={(e) => setCustomEtapa(e.target.value)}
                    placeholder="Descrie etapa..."
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
                  />
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
                    onClick={() => { setShowAddForm(false); setSelectedEtapa(''); setCustomEtapa(''); setObservatii('') }}
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
                    disabled={addMutation.isPending || !selectedEtapa}
                    style={{
                      flex: 1,
                      padding: '7px 0',
                      fontSize: 11,
                      fontWeight: 600,
                      background: addMutation.isPending || !selectedEtapa ? 'var(--agri-surface-muted)' : 'var(--pill-active-bg)',
                      color: addMutation.isPending || !selectedEtapa ? 'var(--text-hint)' : 'var(--pill-active-text)',
                      border: `1px solid ${addMutation.isPending || !selectedEtapa ? 'var(--agri-border)' : 'var(--pill-active-border)'}`,
                      borderRadius: 8,
                      cursor: addMutation.isPending || !selectedEtapa ? 'default' : 'pointer',
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
  solarId,
  tipUnitate,
  onAddCultura,
  onAddMicroclimat,
  onDesfiintaCultura,
  withTopBorder = true,
}: {
  solarId: string
  tipUnitate: string | null | undefined
  onAddCultura: () => void
  onAddMicroclimat: () => void
  onDesfiintaCultura: (c: Cultura) => void
  withTopBorder?: boolean
}) {
  const [showMicroHistory, setShowMicroHistory] = useState(false)
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

  const activeCulturi = culturi.filter((c) => c.activa !== false)
  const inactiveCulturi = culturi.filter((c) => c.activa === false)
  const conditiiLabel = getConditiiMediuLabel(tipUnitate)
  const latestMicroclimat = microclimatLogs[0]

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
              onDesfiintaCultura={onDesfiintaCultura}
            />
          ))}
        </div>
        </>
      )}
    </div>
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
}) {
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const { emoji, bg } = unitIcon(parcela.tip_unitate)
  const operational = coerceStatusOperationalFromDb(parcela.status_operational)
  const badge = operationalBadge(operational)
  const hasPause = Boolean(latestActivity?.pauseUntil)
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
          solarId={parcela.id}
          tipUnitate={parcela.tip_unitate}
          onAddCultura={onAddCultura}
          onAddMicroclimat={onAddMicroclimat}
          onDesfiintaCultura={onDesfiintaCultura}
        />

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
        className="hidden w-full overflow-hidden rounded-2xl bg-[var(--agri-surface)] shadow-[var(--agri-shadow)] transition-all duration-200 md:block md:hover:bg-[color:color-mix(in_srgb,var(--agri-surface-muted)_35%,var(--agri-surface))]"
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
                className="inline-flex h-9 items-center justify-center rounded-lg border border-[var(--agri-border)] bg-[var(--agri-surface)] px-3 text-xs font-semibold text-[var(--agri-text)] transition-colors hover:bg-[var(--agri-surface-muted)]"
              >
                <SprayCan className="mr-1.5 h-3.5 w-3.5" aria-hidden />
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

  return (
    <AppShell
      header={<PageHeader title="Terenuri" subtitle="Administrare terenuri cultivate" rightSlot={<MapIcon className="h-5 w-5" />} />}
      bottomBar={null}
    >
      <div className="mx-auto mt-2 w-full max-w-7xl space-y-3 py-3 sm:mt-0 sm:space-y-4 sm:py-3">
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
            {/* Pills filtrare */}
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

            {/* Search (doar dacă > 5 terenuri) */}
            {parcele.length > 5 ? (
              <SearchField
                placeholder="Caută după nume, soi sau cultură..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                aria-label="Caută terenuri"
              />
            ) : null}

            {/* Lista carduri */}
            {filteredParcele.length === 0 ? (
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
            ) : (
              <div className="grid grid-cols-1 gap-3">
                {filteredParcele.map((parcela) => {
                  const isSolar = normalizeUnitateTip(parcela.tip_unitate) === 'solar'
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
                          router.push(`/parcele/${parcela.id}`)
                        } else {
                          router.push('/activitati-agricole')
                        }
                      }}
                      onEdit={(p) => { setSelectedParcela(p); setEditOpen(true) }}
                      onDelete={(p) => { setSelectedParcela(p); setDeleteOpen(true) }}
                      onAddCultura={() => setAddCulturaParcelaId(parcela.id)}
                      onAddMicroclimat={() => setAddMicroclimatParcelaId(parcela.id)}
                      onDesfiintaCultura={(c) => setDesfiintaState({ cultura: c, parcelaId: parcela.id })}
                    />
                  )
                })}
              </div>
            )}
          </>
        ) : null}
      </div>

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
      />

      <AddCulturaDialog
        open={addCulturaParcelaId !== null}
        onOpenChange={(open) => { if (!open) setAddCulturaParcelaId(null) }}
        parcelaId={addCulturaParcelaId ?? ''}
        tipUnitate={addCulturaParcela?.tip_unitate}
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
