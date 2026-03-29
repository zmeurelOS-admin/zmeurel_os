'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { toast } from '@/lib/ui/toast'

import { AddActivitateAgricolaDialog } from '@/components/activitati-agricole/AddActivitateAgricolaDialog'
import { EditActivitateAgricolaDialog } from '@/components/activitati-agricole/EditActivitateAgricolaDialog'
import { AppShell } from '@/components/app/AppShell'
import { ConfirmDeleteDialog } from '@/components/app/ConfirmDeleteDialog'
import { EmptyState } from '@/components/ui/EmptyState'
import { ErrorState } from '@/components/app/ErrorState'
import { LoadingState } from '@/components/app/LoadingState'
import { PageHeader } from '@/components/app/PageHeader'
import { StickyActionBar } from '@/components/app/StickyActionBar'
import { SearchField } from '@/components/ui/SearchField'
import { useAddAction } from '@/contexts/AddActionContext'
import { computeActivityRemainingDays } from '@/lib/parcele/pauza'
import { track } from '@/lib/analytics/track'
import { trackEvent } from '@/lib/analytics/trackEvent'
import { useTrackModuleView } from '@/lib/analytics/useTrackModuleView'
import { deleteActivitateAgricola, getActivitatiAgricole, type ActivitateAgricola } from '@/lib/supabase/queries/activitati-agricole'
import { getParcele } from '@/lib/supabase/queries/parcele'
import { buildActivitateDeleteLabel } from '@/lib/ui/delete-labels'
import { queryKeys } from '@/lib/query-keys'

type TipFilter = 'toate' | 'tratamente' | 'fertilizare' | 'taiere' | 'altele'

function toDateOnly(value: string | null | undefined): string {
  return (value ?? '').slice(0, 10)
}

function toIsoDate(value: Date): string {
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`
}

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
  if (t.includes('irig') || t.includes('udar') || t.includes('fertirig') || t.includes('fertigare')) return '💧'
  if (t.includes('tratament') || t.includes('fungic') || t.includes('pestic') || t.includes('erbic') || t.includes('insecticid')) return '💊'
  if (t.includes('plivit') || t.includes('buruien')) return '🌿'
  if (t.includes('tund') || t.includes('tai') || t.includes('curata') || t.includes('copilit') || t.includes('defolier')) return '✂️'
  if (t.includes('plantar')) return '🌱'
  if (t.includes('fert')) return '🌿'
  return '📋'
}

function formatDate(value: string | null | undefined): string {
  if (!value) return '-'
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return '-'
  return parsed.toLocaleDateString('ro-RO')
}

function formatDateShort(value: string | null | undefined): string {
  if (!value) return '-'
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return '-'
  return parsed.toLocaleDateString('ro-RO', { day: 'numeric', month: 'short' })
}

function relativeTime(daysAgo: number | null): { text: string; color: string } {
  if (daysAgo === null) return { text: 'Nicio activitate', color: '#ccc' }
  if (daysAgo === 0) return { text: 'azi', color: 'var(--value-positive)' }
  if (daysAgo === 1) return { text: 'ieri', color: 'var(--value-positive)' }
  if (daysAgo < 3) return { text: `acum ${daysAgo} zile`, color: 'var(--value-positive)' }
  if (daysAgo <= 5) return { text: `acum ${daysAgo} zile`, color: 'var(--status-warning-text)' }
  return { text: `acum ${daysAgo} zile`, color: 'var(--status-danger-text)' }
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
  const activityRefs = useRef<Record<string, HTMLDivElement | null>>({})

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
  const [expandedById, setExpandedById] = useState<Record<string, boolean>>({})
  const [editOpen, setEditOpen] = useState(false)
  const [selected, setSelected] = useState<ActivitateAgricola | null>(null)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [toDelete, setToDelete] = useState<ActivitateAgricola | null>(null)
  const openFormFromQuery = hasAiActivityOpenForm(searchParams)

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

  useEffect(() => { deleteMutateRef.current = (id) => deleteMutation.mutate(id) })
  useEffect(() => {
    return () => {
      Object.keys(pendingDeleteTimers.current).forEach((id) => {
        clearTimeout(pendingDeleteTimers.current[id])
        if (pendingDeletedItems.current[id]) {
          delete pendingDeletedItems.current[id]
          deleteMutateRef.current(id)
        }
      })
      pendingDeleteTimers.current = {}
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const unregister = registerAddAction(() => {
      setAiPrefill(null)
      setAddOpen(true)
    }, 'Adauga activitate')
    return unregister
  }, [registerAddAction])

  useEffect(() => {
    if (!openFormFromQuery) return
    setAiPrefill(parseAiActivitatePrefill(searchParams))
    setAddOpen(true)

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
  }, [openFormFromQuery, pathname, router, searchParams])

  useEffect(() => {
    const query = searchQuery.trim()
    if (!query) return
    const timer = setTimeout(() => {
      track('search', { module: 'activitati', query })
    }, 500)
    return () => clearTimeout(timer)
  }, [searchQuery])

  const scheduleDelete = (activitate: ActivitateAgricola) => {
    const activitateId = activitate.id
    const currentItems = queryClient.getQueryData<ActivitateAgricola[]>(queryKeys.activitati) ?? []
    const deleteIndex = currentItems.findIndex((item) => item.id === activitateId)

    pendingDeletedItems.current[activitateId] = { item: activitate, index: deleteIndex }
    queryClient.setQueryData<ActivitateAgricola[]>(queryKeys.activitati, (current = []) =>
      current.filter((item) => item.id !== activitateId)
    )

    const timer = setTimeout(() => {
      delete pendingDeleteTimers.current[activitateId]
      delete pendingDeletedItems.current[activitateId]
      deleteMutation.mutate(activitateId)
    }, 5000)

    pendingDeleteTimers.current[activitateId] = timer

    toast('Element sters', {
      duration: 5000,
      action: {
        label: 'Undo',
        onClick: () => {
          const pendingTimer = pendingDeleteTimers.current[activitateId]
          if (!pendingTimer) return
          clearTimeout(pendingTimer)
          delete pendingDeleteTimers.current[activitateId]
          const pendingItem = pendingDeletedItems.current[activitateId]
          delete pendingDeletedItems.current[activitateId]
          if (!pendingItem) return

          queryClient.setQueryData<ActivitateAgricola[]>(queryKeys.activitati, (current = []) => {
            if (current.some((item) => item.id === activitateId)) return current
            const next = [...current]
            const insertAt = pendingItem.index >= 0 ? Math.min(pendingItem.index, next.length) : next.length
            next.splice(insertAt, 0, pendingItem.item)
            return next
          })
        },
      },
    })
  }

  const parcelaMap = useMemo(() => {
    const map: Record<string, string> = {}
    parcele.forEach((p) => {
      map[p.id] = p.nume_parcela || 'Teren'
    })
    return map
  }, [parcele])

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const todayIso = toIsoDate(today)

  const activePauseActivities = useMemo(() => {
    return activitati
      .map((row) => {
        const kind = activityKind(row.tip_activitate)
        const remaining = computeActivityRemainingDays(row, today)
        if (kind !== 'tratamente' || remaining <= 0) return null
        const expiry = new Date(today.getFullYear(), today.getMonth(), today.getDate() + remaining)
        return {
          activity: row,
          remainingDays: remaining,
          expiryDate: toIsoDate(expiry),
        }
      })
      .filter((item): item is { activity: ActivitateAgricola; remainingDays: number; expiryDate: string } => Boolean(item))
  }, [activitati, today])

  const activePauseByParcelaId = useMemo(() => {
    const map = new Map<string, number>()
    for (const item of activePauseActivities) {
      if (item.activity.parcela_id) {
        const existing = map.get(item.activity.parcela_id) ?? 0
        map.set(item.activity.parcela_id, Math.max(existing, item.remainingDays))
      }
    }
    return map
  }, [activePauseActivities])

  const stareParceleRows = useMemo(() => {
    const activeParcele = parcele.filter((item) => {
      const status = normalizeText(item.status)
      if (!status) return true
      return !status.includes('inactiv')
    })

    return activeParcele.map((parcela) => {
      const rows = activitati
        .filter((act) => act.parcela_id === parcela.id)
        .sort((a, b) => (b.data_aplicare || '').localeCompare(a.data_aplicare || ''))
      const latest = rows[0]
      if (!latest) {
        return {
          parcela,
          latest: null as null | ActivitateAgricola,
          daysAgo: null as number | null,
        }
      }
      const activityDate = new Date(latest.data_aplicare)
      const daysAgo = Number.isNaN(activityDate.getTime()) ? null : Math.floor((today.getTime() - activityDate.getTime()) / (1000 * 60 * 60 * 24))
      return { parcela, latest, daysAgo }
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

  const scrollToActivity = (activityId: string) => {
    setExpandedById((current) => ({ ...current, [activityId]: true }))
    const target = activityRefs.current[activityId]
    if (target) target.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }

  void scrollToActivity

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
      <div className="mx-auto mt-4 w-full max-w-7xl space-y-3 py-3 sm:mt-0 sm:space-y-4 sm:py-4">

        {/* STARE TERENURI */}
        {stareParceleRows.length > 0 ? (
          <div>
            <span style={SECTION_LABEL_STYLE}>Stare terenuri</span>
            <div style={{ background: 'var(--agri-surface)', borderRadius: 14, overflow: 'hidden', border: '1px solid var(--agri-border)' }}>
              {stareParceleRows.map((row, idx) => {
                const rel = relativeTime(row.daysAgo)
                const emoji = activityEmojiByTip(row.latest?.tip_activitate)
                const pausaZile = row.parcela.id ? (activePauseByParcelaId.get(row.parcela.id) ?? 0) : 0
                return (
                  <button
                    key={row.parcela.id}
                    type="button"
                    onClick={() => setSelectedParcelaId((prev) => (prev === row.parcela.id ? null : row.parcela.id))}
                    style={{
                      width: '100%',
                      textAlign: 'left',
                      border: 'none',
                      background: selectedParcelaId === row.parcela.id ? 'var(--soft-success-bg)' : 'transparent',
                      padding: '10px 14px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      cursor: 'pointer',
                      borderBottom: idx < stareParceleRows.length - 1 ? '1px solid var(--surface-divider)' : 'none',
                    }}
                  >
                    <span style={{ fontSize: 15, flexShrink: 0 }}>{row.latest ? emoji : '📋'}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--agri-text)' }}>
                        {row.parcela.nume_parcela || 'Teren'}
                        {pausaZile > 0 ? (
                          <span style={{ marginLeft: 6, fontSize: 9, fontWeight: 700, background: 'var(--status-danger-bg)', color: 'var(--status-danger-text)', border: '1px solid var(--status-danger-border)', borderRadius: 10, padding: '2px 6px' }}>
                            ⏳ Pauză {pausaZile}z
                          </span>
                        ) : null}
                      </div>
                      <div style={{ fontSize: 10, color: 'var(--agri-text-muted)', marginTop: 1 }}>
                        {row.latest
                          ? [row.latest.tip_activitate, row.latest.produs_utilizat].filter(Boolean).join(' · ')
                          : 'Nicio activitate'}
                      </div>
                    </div>
                    <div style={{ fontSize: 10, fontWeight: 600, color: rel.color, flexShrink: 0, textAlign: 'right' }}>
                      {rel.text}
                    </div>
                  </button>
                )
              })}
            </div>
          </div>
        ) : null}

        {/* ADAUGĂ RAPID */}
        <div>
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
              const kind = activityKind(a.tip_activitate)
              const remainingDays = kind === 'tratamente' ? computeActivityRemainingDays(a, today) : 0
              const hasActivePause = remainingDays > 0
              const isExpanded = !!expandedById[a.id]
              const expiryDate = hasActivePause
                ? toIsoDate(new Date(today.getFullYear(), today.getMonth(), today.getDate() + remainingDays))
                : null
              const emoji = activityEmojiByTip(a.tip_activitate)
              const parcelaName = a.parcela_id ? parcelaMap[a.parcela_id] || 'Teren' : 'Teren'

              return (
                <div
                  className="w-full"
                  key={a.id}
                  ref={(node) => {
                    activityRefs.current[a.id] = node
                  }}
                  style={{
                    background: 'var(--agri-surface)',
                    borderRadius: 14,
                    border: isExpanded ? '1.5px solid var(--soft-success-border)' : '1px solid var(--agri-border)',
                    boxShadow: isExpanded ? 'var(--shadow-card-raised)' : 'var(--shadow-card-soft)',
                    overflow: 'hidden',
                  }}
                >
                  <button
                    type="button"
                    onClick={() => setExpandedById((current) => ({ ...current, [a.id]: !current[a.id] }))}
                    style={{
                      width: '100%',
                      border: 'none',
                      background: 'transparent',
                      textAlign: 'left',
                      padding: '9px 14px',
                      cursor: 'pointer',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 18, flexShrink: 0 }}>{emoji}</span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--agri-text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {a.tip_activitate || 'Activitate'} — {parcelaName}
                        </div>
                        {(a.produs_utilizat || a.doza) ? (
                          <div style={{ fontSize: 10, color: 'var(--agri-text-muted)', marginTop: 1 }}>
                            {[a.produs_utilizat, a.doza].filter(Boolean).join(' · ')}
                          </div>
                        ) : null}
                      </div>
                      <div style={{ textAlign: 'right', flexShrink: 0 }}>
                        <div style={{ fontSize: 10, color: 'var(--text-hint)' }}>{formatDateShort(a.data_aplicare)}</div>
                        {hasActivePause ? (
                          <span style={{ display: 'inline-block', marginTop: 2, fontSize: 9, fontWeight: 700, background: 'var(--status-danger-bg)', color: 'var(--status-danger-text)', border: '1px solid var(--status-danger-border)', borderRadius: 10, padding: '2px 6px' }}>
                            ⏳ {remainingDays}z
                          </span>
                        ) : null}
                      </div>
                    </div>
                    {/* Drag indicator */}
                    <div style={{ display: 'flex', justifyContent: 'center', marginTop: 6 }}>
                      <div style={{ width: 22, height: 2.5, borderRadius: 2, background: 'var(--text-hint)', opacity: 0.3 }} />
                    </div>
                  </button>

                  {isExpanded ? (
                    <div
                      style={{
                        borderTop: '1px solid var(--surface-divider)',
                        padding: '10px 14px 12px',
                      }}
                    >
                      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', fontSize: 11, marginBottom: 10 }}>
                        <span><span style={{ color: 'var(--agri-text-muted)' }}>Teren: </span><strong>{parcelaName}</strong></span>
                        <span><span style={{ color: 'var(--agri-text-muted)' }}>Tip: </span><strong>{a.tip_activitate || '-'}</strong></span>
                        {a.produs_utilizat ? <span><span style={{ color: 'var(--agri-text-muted)' }}>Produs: </span><strong>{a.produs_utilizat}</strong></span> : null}
                        {a.doza ? <span><span style={{ color: 'var(--agri-text-muted)' }}>Doză: </span><strong>{a.doza}</strong></span> : null}
                        {a.operator ? <span><span style={{ color: 'var(--agri-text-muted)' }}>Operator: </span><strong>{a.operator}</strong></span> : null}
                        {a.observatii ? <span><span style={{ color: 'var(--agri-text-muted)' }}>Obs: </span><strong>{a.observatii}</strong></span> : null}
                        {kind === 'tratamente' && a.timp_pauza_zile ? (
                          <span>
                            <span style={{ color: 'var(--agri-text-muted)' }}>Pauză: </span>
                            <strong style={{ color: hasActivePause ? 'var(--status-warning-text)' : 'var(--value-positive)' }}>
                              {a.timp_pauza_zile} zile{expiryDate ? ` · exp. ${formatDate(expiryDate)}` : ''}
                            </strong>
                          </span>
                        ) : null}
                      </div>

                      <div style={{ borderTop: '1px solid var(--surface-divider)', paddingTop: 10, display: 'flex', justifyContent: 'center', gap: 6 }}>
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation()
                            setSelected(a)
                            setEditOpen(true)
                          }}
                          style={{ padding: '6px 14px', fontSize: 10, fontWeight: 600, background: 'var(--button-muted-bg)', color: 'var(--button-muted-text)', border: '1px solid var(--button-muted-border)', borderRadius: 8, cursor: 'pointer' }}
                        >
                          ✏️ Editează
                        </button>
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation()
                            setToDelete(a)
                            setDeleteOpen(true)
                          }}
                          style={{ padding: '6px 14px', fontSize: 10, fontWeight: 600, background: 'var(--status-danger-bg)', color: 'var(--status-danger-text)', border: '1px solid var(--status-danger-border)', borderRadius: 8, cursor: 'pointer' }}
                        >
                          🗑️ Șterge
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
        open={addOpen}
        onOpenChange={(open) => {
          setAddOpen(open)
          if (!open) {
            setAiPrefill(null)
          }
        }}
        hideTrigger
        aiPrefill={aiPrefill}
      />

      <EditActivitateAgricolaDialog
        activitate={selected}
        open={editOpen}
        onOpenChange={(open) => {
          setEditOpen(open)
          if (!open) setSelected(null)
        }}
      />

      <ConfirmDeleteDialog
        open={deleteOpen}
        onOpenChange={(open) => {
          setDeleteOpen(open)
          if (!open) setToDelete(null)
        }}
        itemType="Activitate"
        itemName={buildActivitateDeleteLabel(toDelete)}
        description={`Stergi activitatea ${toDelete?.tip_activitate || 'necunoscuta'} din ${toDelete?.data_aplicare ? new Date(toDelete.data_aplicare).toLocaleDateString('ro-RO') : 'data necunoscuta'} - teren ${toDelete?.parcela_id ? parcelaMap[toDelete.parcela_id] || 'necunoscut' : 'necunoscut'}?`}
        loading={deleteMutation.isPending}
        onConfirm={() => {
          if (!toDelete) return
          setDeleteOpen(false)
          scheduleDelete(toDelete)
          setToDelete(null)
        }}
      />
    </AppShell>
  )
}


