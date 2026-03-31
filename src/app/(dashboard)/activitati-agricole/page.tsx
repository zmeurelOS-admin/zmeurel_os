'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { toast } from '@/lib/ui/toast'

import { AddActivitateAgricolaDialog } from '@/components/activitati-agricole/AddActivitateAgricolaDialog'
import { EditActivitateAgricolaDialog } from '@/components/activitati-agricole/EditActivitateAgricolaDialog'
import { AppShell } from '@/components/app/AppShell'
import { EmptyState } from '@/components/ui/EmptyState'
import { ErrorState } from '@/components/app/ErrorState'
import { LoadingState } from '@/components/app/LoadingState'
import { PageHeader } from '@/components/app/PageHeader'
import { StickyActionBar } from '@/components/app/StickyActionBar'
import { SearchField } from '@/components/ui/SearchField'
import { useAddAction } from '@/contexts/AddActionContext'
import { track } from '@/lib/analytics/track'
import { trackEvent } from '@/lib/analytics/trackEvent'
import { useTrackModuleView } from '@/lib/analytics/useTrackModuleView'
import {
  buildLatestActivityByParcela,
} from '@/lib/activitati/timeline'
import { deleteActivitateAgricola, getActivitatiAgricole, type ActivitateAgricola } from '@/lib/supabase/queries/activitati-agricole'
import { getParcele } from '@/lib/supabase/queries/parcele'
import { queryKeys } from '@/lib/query-keys'

type TipFilter = 'toate' | 'tratamente' | 'fertilizare' | 'taiere' | 'altele'

function normalizeText(value: string | null | undefined): string {
  return (value ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
}

function activityKind(tip: string | null | undefined): TipFilter {
  const value = normalizeText(tip)
  if (value.includes('tratament') || value.includes('fungic') || value.includes('pestic') || value.includes('erbic') || value.includes('insecticid')) return 'tratamente'
  if (value.includes('fert') || value.includes('fertirg') || value.includes('fertigare')) return 'fertilizare'
  if (value.includes('tund') || value.includes('tai') || value.includes('curata') || value.includes('copilit') || value.includes('defolier')) return 'taiere'
  if (value.includes('toate')) return 'toate'
  return 'altele'
}

function activityEmojiByTip(tip: string | null | undefined): string {
  const t = normalizeText(tip)
  if (t.includes('fungic') || t.includes('pestic') || t.includes('erbic') || t.includes('insecticid') || t.includes('tratament')) return '🧪'
  if (t.includes('fertirig') || (t.includes('irig') && t.includes('fert'))) return '💧'
  if (t.includes('fertiliz') || t.includes('foliar')) return '🌿'
  if (t.includes('tund') || t.includes('tai') || t.includes('curata') || t.includes('copilit') || t.includes('defolier')) return '✂️'
  return '🔧'
}

function activityDisplayLabel(tip: string | null | undefined): string {
  const t = normalizeText(tip)
  if (t.includes('fungic') || t.includes('pestic') || t.includes('erbic') || t.includes('insecticid') || t.includes('tratament')) return 'Fungicide/Pesticide'
  if (t.includes('fertirig') || (t.includes('irig') && t.includes('fert'))) return 'Fertirigare'
  if (t.includes('fertiliz') || t.includes('foliar')) return 'Fertilizare foliară'
  if (t.includes('tund') || t.includes('tai') || t.includes('curata') || t.includes('copilit') || t.includes('defolier')) return 'Tăiere'
  return 'Altele'
}

type TemporalBadge = {
  label: string
  className: string
}

function toStartOfDay(value: Date): Date {
  const copy = new Date(value)
  copy.setHours(0, 0, 0, 0)
  return copy
}

function getDaysFromActivity(dataAplicare: string | null | undefined, today: Date): number | null {
  if (!dataAplicare) return null
  const parsed = new Date(dataAplicare)
  if (Number.isNaN(parsed.getTime())) return null
  const activityDay = toStartOfDay(parsed)
  const diff = today.getTime() - activityDay.getTime()
  return Math.max(0, Math.floor(diff / (24 * 60 * 60 * 1000)))
}

function temporalBadgeForActivity(activity: ActivitateAgricola, today: Date): TemporalBadge {
  const daysSince = getDaysFromActivity(activity.data_aplicare, today)
  const pauseInterval = Number(activity.timp_pauza_zile ?? 0)

  if (pauseInterval > 0 && daysSince !== null) {
    const remaining = pauseInterval - daysSince
    if (remaining > 2) {
      return {
        label: `⏳ Pauză ${remaining} zile`,
        className: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
      }
    }
    if (remaining >= 1 && remaining <= 2) {
      return {
        label: `⚠️ Încă ${remaining} zile`,
        className: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
      }
    }
    return {
      label: '✅ Sigur de cules',
      className: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
    }
  }

  if (daysSince === 0) {
    return {
      label: 'azi',
      className: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400',
    }
  }
  if (daysSince === 1) {
    return {
      label: 'ieri',
      className: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400',
    }
  }
  if (daysSince !== null) {
    return {
      label: `acum ${daysSince} zile`,
      className: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400',
    }
  }

  return {
    label: 'fără dată',
    className: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400',
  }
}

function formatDateShort(value: string | null | undefined): string {
  if (!value) return '-'
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return '-'
  return parsed.toLocaleDateString('ro-RO', { day: 'numeric', month: 'short' })
}

const QUICK_ADD_PILLS = [
  { emoji: '💧', label: 'Irigare', value: 'irigatie' },
  { emoji: '💊', label: 'Tratament', value: 'fungicide_pesticide' },
  { emoji: '✂️', label: 'Tăiere', value: 'Tundere/Curatare' },
  { emoji: '🌱', label: 'Fertilizare', value: 'fertilizare_foliara' },
  { emoji: '📋', label: 'Altele', value: 'altele' },
]

const SECTION_LABEL_STYLE: React.CSSProperties = {
  fontSize: 10,
  fontWeight: 700,
  color: 'var(--text-hint)',
  letterSpacing: '0.07em',
  textTransform: 'uppercase',
  marginBottom: 8,
  display: 'block',
}

function hasAiActivityOpenForm(searchParams: Pick<URLSearchParams, 'get'>): boolean {
  return searchParams.get('openForm') === '1'
}

type AiActivitatePrefill = {
  tip: string
  parcela_id: string
  parcela_label: string
  produs: string
  doza: string
  data: string
  observatii: string
}

function parseAiActivitatePrefill(searchParams: Pick<URLSearchParams, 'get'>): AiActivitatePrefill {
  return {
    tip: (searchParams.get('tip') ?? '').trim(),
    parcela_id: (searchParams.get('parcela_id') ?? '').trim(),
    parcela_label: (searchParams.get('parcela_label') ?? searchParams.get('parcela') ?? '').trim(),
    produs: (searchParams.get('produs') ?? '').trim(),
    doza: (searchParams.get('doza') ?? '').trim(),
    data: (searchParams.get('data') ?? '').trim(),
    observatii: (searchParams.get('observatii') ?? '').trim(),
  }
}

export default function ActivitatiPage() {
  useTrackModuleView('activitati')
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const queryClient = useQueryClient()
  const { registerAddAction } = useAddAction()
  const pendingDeleteTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({})
  const pendingDeletedItems = useRef<Record<string, { item: ActivitateAgricola; index: number }>>({})
  const deleteMutateRef = useRef<(id: string) => void>(() => {})

  const {
    data: activitati = [],
    isLoading,
    isError,
    error,
  } = useQuery({
    queryKey: queryKeys.activitati,
    queryFn: getActivitatiAgricole,
    staleTime: 30000,
    refetchOnWindowFocus: false,
    retry: 1,
  })
  const { data: parcele = [] } = useQuery({
    queryKey: queryKeys.parcele,
    queryFn: getParcele,
    staleTime: 30000,
    refetchOnWindowFocus: false,
  })

  const [addOpen, setAddOpen] = useState(false)
  const [aiPrefill, setAiPrefill] = useState<AiActivitatePrefill | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [tipFilter, setTipFilter] = useState<TipFilter>('toate')
  const [selectedParcelaId, setSelectedParcelaId] = useState<string | null>(null)
  const [expandedCardId, setExpandedCardId] = useState<string | null>(null)
  const [editingActivity, setEditingActivity] = useState<ActivitateAgricola | null>(null)
  const openFormFromQuery = hasAiActivityOpenForm(searchParams)
  const queryAiPrefill = useMemo(
    () => (openFormFromQuery ? parseAiActivitatePrefill(searchParams) : null),
    [openFormFromQuery, searchParams]
  )
  const resolvedAiPrefill = openFormFromQuery ? queryAiPrefill : aiPrefill
  const isAddDialogOpen = addOpen || openFormFromQuery

  const clearActivitateFormQueryParams = useCallback(() => {
    const nextParams = new URLSearchParams(searchParams.toString())
    nextParams.delete('openForm')
    nextParams.delete('tip')
    nextParams.delete('parcela')
    nextParams.delete('parcela_id')
    nextParams.delete('parcela_label')
    nextParams.delete('produs')
    nextParams.delete('doza')
    nextParams.delete('data')
    nextParams.delete('observatii')
    const query = nextParams.toString()
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false })
  }, [pathname, router, searchParams])

  const deleteMutation = useMutation({
    mutationFn: deleteActivitateAgricola,
    onSuccess: (_, deletedId) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.activitati })
      trackEvent('delete_item', 'activitati')
      track('activitate_delete', { id: deletedId })
      toast.success('Activitate stearsa')
    },
    onError: (err: Error) => {
      toast.error(err.message)
      queryClient.invalidateQueries({ queryKey: queryKeys.activitati })
    },
  })

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
    const unregister = registerAddAction(() => {
      setAiPrefill(null)
      setAddOpen(true)
    }, 'Adauga activitate')
    return unregister
  }, [registerAddAction])

  useEffect(() => {
    const query = searchQuery.trim()
    if (!query) return
    const timer = setTimeout(() => {
      track('search', { module: 'activitati', query })
    }, 500)
    return () => clearTimeout(timer)
  }, [searchQuery])

  const parcelaMap = useMemo(() => {
    const map: Record<string, string> = {}
    parcele.forEach((p) => {
      map[p.id] = p.nume_parcela || 'Teren'
    })
    return map
  }, [parcele])

  const today = useMemo(() => {
    const date = new Date()
    date.setHours(0, 0, 0, 0)
    return date
  }, [])

  const stareParceleRows = useMemo(() => {
    const activeParcele = parcele.filter((item) => {
      const status = normalizeText(item.status)
      if (!status) return true
      return !status.includes('inactiv')
    })

    const latestByParcela = buildLatestActivityByParcela(activitati)

    return activeParcele.map((parcela) => {
      const latest = latestByParcela.get(parcela.id) ?? null
      if (!latest) {
        return {
          parcela,
          latest: null as null | ActivitateAgricola,
          daysAgo: null as number | null,
        }
      }
      return { parcela, latest }
    })
  }, [activitati, parcele, today])

  const filteredActivitati = useMemo(() => {
    const term = normalizeText(searchQuery)
    return activitati.filter((item) => {
      if (tipFilter !== 'toate' && activityKind(item.tip_activitate) !== tipFilter) return false
      if (selectedParcelaId && item.parcela_id !== selectedParcelaId) return false
      if (!term) return true
      return [
        item.tip_activitate,
        item.produs_utilizat,
        item.doza,
        item.observatii,
        item.operator,
        item.id_activitate,
      ]
        .filter(Boolean)
        .some((value) => normalizeText(value).includes(term))
    })
  }, [activitati, searchQuery, selectedParcelaId, tipFilter])

  const refresh = () => queryClient.invalidateQueries({ queryKey: queryKeys.activitati })

  return (
    <AppShell
      header={<PageHeader title="Activități Agricole" subtitle="Istoric lucrări și tratamente" />}
      bottomBar={
        <StickyActionBar>
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-medium text-[var(--agri-text-muted)]">Total activități: {activitati.length}</p>
          </div>
        </StickyActionBar>
      }
    >
      <div className="mx-auto mt-2 w-full max-w-7xl space-y-3 py-3 sm:mt-0 sm:space-y-4 sm:py-3">

        {/* STARE TERENURI */}
        {stareParceleRows.length > 0 ? (
          <div>
            <span style={SECTION_LABEL_STYLE}>Stare terenuri</span>
            <div style={{ background: 'var(--agri-surface)', borderRadius: 14, overflow: 'hidden', border: '1px solid var(--agri-border)' }}>
              {stareParceleRows.map((row) => {
                const badge = row.latest ? temporalBadgeForActivity(row.latest, today) : null
                const emoji = activityEmojiByTip(row.latest?.tip_activitate)
                return (
                  <button
                    key={row.parcela.id}
                    type="button"
                    onClick={() => setSelectedParcelaId((prev) => (prev === row.parcela.id ? null : row.parcela.id))}
                    className="w-full cursor-pointer border-b border-[var(--surface-divider)] px-3 py-2.5 text-left last:border-b-0 dark:border-slate-700/80"
                    style={{
                      width: '100%',
                      textAlign: 'left',
                      border: 'none',
                      background: selectedParcelaId === row.parcela.id ? 'var(--soft-success-bg)' : undefined,
                      padding: '10px 14px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      cursor: 'pointer',
                    }}
                  >
                    <span style={{ fontSize: 15, flexShrink: 0 }}>{row.latest ? emoji : '📋'}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--agri-text)' }}>
                        {row.parcela.nume_parcela || 'Teren'}
                      </div>
                      <div style={{ fontSize: 10, color: 'var(--agri-text-muted)', marginTop: 1 }}>
                        {row.latest
                          ? `${activityDisplayLabel(row.latest.tip_activitate)} · ${formatDateShort(row.latest.data_aplicare)}`
                          : 'Nicio activitate'}
                      </div>
                    </div>
                    {badge ? (
                      <span className={`rounded-full px-2 py-1 text-[10px] font-semibold ${badge.className}`}>{badge.label}</span>
                    ) : (
                      <span className="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-400">
                        Nicio activitate
                      </span>
                    )}
                  </button>
                )
              })}
            </div>
          </div>
        ) : null}

        {/* ADAUGĂ RAPID — ascuns pe mobil (FAB / flux principal rămân) */}
        <div className="hidden md:block">
          <span style={{ ...SECTION_LABEL_STYLE, marginTop: 6 }}>Adaugă rapid</span>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {QUICK_ADD_PILLS.map((pill) => (
              <button
                key={pill.value}
                type="button"
                onClick={() => {
                  setAiPrefill({ tip: pill.value, parcela_id: '', parcela_label: '', produs: '', doza: '', data: '', observatii: '' })
                  setAddOpen(true)
                }}
                style={{
                  padding: '8px 14px',
                  fontSize: 11,
                  fontWeight: 600,
                  background: 'var(--button-muted-bg)',
                  border: '1px solid var(--button-muted-border)',
                  color: 'var(--button-muted-text)',
                  borderRadius: 12,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 5,
                  cursor: 'pointer',
                }}
              >
                <span style={{ fontSize: 14 }}>{pill.emoji}</span>
                {pill.label}
              </button>
            ))}
          </div>
        </div>

        {/* RECENTE */}
        <div>
          <span style={{ ...SECTION_LABEL_STYLE, marginTop: 6 }}>Recente</span>

          {/* Filters */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
            {([
              ['toate', 'Toate'],
              ['tratamente', '💊 Tratamente'],
              ['fertilizare', '🌿 Fertilizare'],
              ['taiere', '✂️ Tăiere'],
              ['altele', 'Altele'],
            ] as Array<[TipFilter, string]>).map(([key, label]) => {
              const active = tipFilter === key
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setTipFilter(key)}
                  style={{
                    padding: '6px 14px',
                    fontSize: 11,
                    fontWeight: 600,
                    borderRadius: 20,
                    border: `1px solid ${active ? 'var(--pill-active-border)' : 'var(--pill-inactive-border)'}`,
                    background: active ? 'var(--pill-active-bg)' : 'var(--pill-inactive-bg)',
                    color: active ? 'var(--pill-active-text)' : 'var(--pill-inactive-text)',
                    cursor: 'pointer',
                  }}
                >
                  {label}
                </button>
              )
            })}
            {selectedParcelaId ? (
              <button
                type="button"
                onClick={() => setSelectedParcelaId(null)}
                style={{
                  padding: '6px 12px',
                  fontSize: 11,
                  fontWeight: 600,
                  borderRadius: 20,
                  border: '1px solid var(--status-danger-border)',
                  background: 'var(--status-danger-bg)',
                  color: 'var(--status-danger-text)',
                  cursor: 'pointer',
                }}
              >
                ✕ Reset teren
              </button>
            ) : null}
          </div>

          <SearchField
            placeholder="Caută activitate, produs, doză..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            aria-label="Caută activități"
          />
        </div>

        {isError ? <ErrorState title="Eroare la încărcare" message={(error as Error).message} onRetry={refresh} /> : null}
        {isLoading ? <LoadingState label="Se încarcă activitățile..." /> : null}

        {!isLoading && !isError && activitati.length === 0 ? (
          <div style={{ borderRadius: 12, background: 'var(--agri-surface)', border: '1px solid var(--agri-border)', padding: '20px 16px', textAlign: 'center' }}>
            <div style={{ fontSize: 36, marginBottom: 8 }}>✂️</div>
            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--agri-text)', marginBottom: 4 }}>Nicio activitate înregistrată</div>
            <div style={{ fontSize: 12, color: 'var(--text-hint)' }}>Adaugă prima activitate folosind butoanele rapide de sus</div>
          </div>
        ) : null}

        {!isLoading && !isError && activitati.length > 0 && filteredActivitati.length === 0 ? (
          <EmptyState
            icon={<span style={{ fontSize: 40 }}>📋</span>}
            title="Nicio activitate găsită"
            description="Modifică filtrul sau căutarea"
          />
        ) : null}

        {filteredActivitati.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredActivitati.map((a) => {
              const parcelaName = a.parcela_id ? parcelaMap[a.parcela_id] || 'Teren' : 'Teren'
              const badge = temporalBadgeForActivity(a, today)
              const isExpanded = expandedCardId === a.id

              return (
                <div key={a.id} className="rounded-[var(--agri-radius-lg)] border border-[var(--agri-border-card)] bg-[var(--agri-surface)] p-3.5 shadow-[var(--agri-shadow)] dark:bg-slate-800">
                  <button
                    type="button"
                    className="w-full text-left"
                    onClick={() => setExpandedCardId((prev) => (prev === a.id ? null : a.id))}
                    aria-expanded={isExpanded}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0 text-sm font-semibold text-[var(--agri-text)]">
                        {activityEmojiByTip(a.tip_activitate)} {activityDisplayLabel(a.tip_activitate)}
                      </div>
                      <span className={`shrink-0 rounded-full px-2 py-1 text-[10px] font-semibold ${badge.className}`}>
                        {badge.label}
                      </span>
                    </div>
                    <div className="mt-1.5 flex items-center justify-between gap-2">
                      <p className="truncate text-xs text-[var(--agri-text-muted)]">
                        {[a.produs_utilizat, a.doza].filter(Boolean).join(' · ') || 'Fără produs/doză'}
                      </p>
                      <p className="truncate text-xs text-[var(--agri-text-muted)]">{parcelaName}</p>
                    </div>
                  </button>

                  {isExpanded ? (
                    <div className="mt-3 space-y-2 border-t border-[var(--agri-border)] pt-3 dark:border-slate-700">
                      <p className="text-xs text-[var(--agri-text-muted)]">
                        <span className="font-semibold text-[var(--agri-text)]">Data:</span>{' '}
                        {a.data_aplicare ? new Date(a.data_aplicare).toLocaleDateString('ro-RO') : '-'}
                      </p>
                      <p className="text-xs text-[var(--agri-text-muted)]">
                        <span className="font-semibold text-[var(--agri-text)]">Parcelă:</span> {parcelaName}
                      </p>
                      <p className="text-xs text-[var(--agri-text-muted)]">
                        <span className="font-semibold text-[var(--agri-text)]">Observații:</span> {a.observatii?.trim() || '—'}
                      </p>

                      <div className="mt-2 flex gap-2">
                        <button
                          type="button"
                          className="flex-1 rounded-lg border border-amber-200 bg-amber-100/70 px-3 py-2 text-xs font-semibold text-amber-800 transition hover:bg-amber-100 dark:border-amber-900/60 dark:bg-amber-900/25 dark:text-amber-300"
                          onClick={() => setEditingActivity(a)}
                        >
                          ✏️ Edit
                        </button>
                        <button
                          type="button"
                          className="flex-1 rounded-lg border border-red-200 bg-red-100/70 px-3 py-2 text-xs font-semibold text-red-700 transition hover:bg-red-100 dark:border-red-900/60 dark:bg-red-900/25 dark:text-red-300"
                          onClick={() => {
                            const confirmed = window.confirm('Ștergi această activitate?')
                            if (confirmed) deleteMutation.mutate(a.id)
                          }}
                        >
                          🗑️ Delete
                        </button>
                      </div>
                    </div>
                  ) : null}
                </div>
              )
            })}
          </div>
        ) : null}
      </div>

      <AddActivitateAgricolaDialog
        open={isAddDialogOpen}
        onOpenChange={(open) => {
          if (!open) {
            setAddOpen(false)
            setAiPrefill(null)
            clearActivitateFormQueryParams()
            return
          }
          setAddOpen(true)
        }}
        hideTrigger
        aiPrefill={resolvedAiPrefill}
      />

      {editingActivity ? (
        <EditActivitateAgricolaDialog
          activitate={editingActivity}
          open={Boolean(editingActivity)}
          onOpenChange={(open) => {
            if (!open) {
              setEditingActivity(null)
              queryClient.invalidateQueries({ queryKey: queryKeys.activitati })
            }
          }}
        />
      ) : null}
    </AppShell>
  )
}


