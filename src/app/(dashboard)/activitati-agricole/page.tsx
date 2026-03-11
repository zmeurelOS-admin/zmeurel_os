'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Calendar, ClipboardList } from 'lucide-react'
import { useRouter } from 'next/navigation'
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
import AlertCard from '@/components/ui/AlertCard'
import MiniCard from '@/components/ui/MiniCard'
import { SearchField } from '@/components/ui/SearchField'
import { useAddAction } from '@/contexts/AddActionContext'
import { colors, radius, shadows, spacing } from '@/lib/design-tokens'
import { computeActivityRemainingDays } from '@/lib/parcele/pauza'
import { track } from '@/lib/analytics/track'
import { trackEvent } from '@/lib/analytics/trackEvent'
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
  if (value.includes('tratament') || value.includes('fungic') || value.includes('pestic') || value.includes('erbic')) return 'tratamente'
  if (value.includes('fert')) return 'fertilizare'
  if (value.includes('tund') || value.includes('tai') || value.includes('curata')) return 'taiere'
  if (value.includes('toate')) return 'toate'
  return 'altele'
}

function activityEmoji(kind: TipFilter): string {
  if (kind === 'tratamente') return '🧪'
  if (kind === 'fertilizare') return '🌱'
  if (kind === 'taiere') return '✂️'
  return '📋'
}

function activityBg(kind: TipFilter): string {
  if (kind === 'tratamente') return colors.coralLight
  if (kind === 'fertilizare') return colors.greenLight
  if (kind === 'taiere') return colors.yellowLight
  return colors.grayLight
}

function formatDate(value: string | null | undefined): string {
  if (!value) return '-'
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return '-'
  return parsed.toLocaleDateString('ro-RO')
}

export default function ActivitatiPage() {
  const router = useRouter()
  const queryClient = useQueryClient()
  const { registerAddAction } = useAddAction()
  const pendingDeleteTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({})
  const pendingDeletedItems = useRef<Record<string, { item: ActivitateAgricola; index: number }>>({})
  const activityRefs = useRef<Record<string, HTMLDivElement | null>>({})

  const {
    data: activitati = [],
    isLoading,
    isError,
    error,
  } = useQuery({
    queryKey: queryKeys.activitati,
    queryFn: getActivitatiAgricole,
  })
  const { data: parcele = [] } = useQuery({
    queryKey: queryKeys.parcele,
    queryFn: getParcele,
  })

  const [addOpen, setAddOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [tipFilter, setTipFilter] = useState<TipFilter>('toate')
  const [selectedParcelaId, setSelectedParcelaId] = useState<string | null>(null)
  const [expandedById, setExpandedById] = useState<Record<string, boolean>>({})
  const [editOpen, setEditOpen] = useState(false)
  const [selected, setSelected] = useState<ActivitateAgricola | null>(null)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [toDelete, setToDelete] = useState<ActivitateAgricola | null>(null)

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
    return () => {
      Object.values(pendingDeleteTimers.current).forEach((timer) => clearTimeout(timer))
    }
  }, [])

  useEffect(() => {
    const unregister = registerAddAction(() => setAddOpen(true), 'Adauga activitate')
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
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1)
  const monthStartIso = toIsoDate(monthStart)

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

  const activePauseByParcela = useMemo(() => {
    const map = new Map<string, { activity: ActivitateAgricola; remainingDays: number; expiryDate: string }>()
    for (const item of activePauseActivities) {
      const parcelaId = item.activity.parcela_id
      if (!parcelaId) continue
      const existing = map.get(parcelaId)
      if (!existing || item.activity.data_aplicare > existing.activity.data_aplicare) {
        map.set(parcelaId, item)
      }
    }
    return Array.from(map.values())
  }, [activePauseActivities])

  const dashboardSummary = useMemo(() => {
    const activitatiAzi = activitati.filter((item) => toDateOnly(item.data_aplicare) === todayIso).length
    const activitatiLuna = activitati.filter((item) => {
      const date = toDateOnly(item.data_aplicare)
      return date >= monthStartIso && date <= todayIso
    }).length
    return {
      activitatiAzi,
      activitatiLuna,
      tratamenteActive: activePauseActivities.length,
    }
  }, [activitati, activePauseActivities.length, monthStartIso, todayIso])

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

  const refresh = () => queryClient.invalidateQueries({ queryKey: queryKeys.activitati })

  return (
    <AppShell
      header={<PageHeader title="Activități Agricole" subtitle="Istoric lucrari ți tratamente" rightSlot={<ClipboardList className="h-5 w-5" />} />}
      bottomBar={
        <StickyActionBar>
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-medium text-[var(--agri-text-muted)]">Total activități: {activitati.length}</p>
          </div>
        </StickyActionBar>
      }
    >
      <div className="mx-auto mt-4 w-full max-w-4xl space-y-3 px-0 py-3 sm:mt-0 sm:px-3">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <MiniCard icon="✂️" value={String(dashboardSummary.activitatiAzi)} sub="azi" label="" />
          <MiniCard icon="📅" value={String(dashboardSummary.activitatiLuna)} sub="luna asta" label="" />
          <div
            style={{
              background: colors.white,
              borderRadius: radius.xl,
              boxShadow: shadows.card,
              padding: `${spacing.lg}px`,
              minHeight: 110,
              border: `1px solid ${dashboardSummary.tratamenteActive > 0 ? colors.coral : colors.grayLight}`,
            }}
          >
            <div style={{ fontSize: 16, marginBottom: spacing.sm }}>🧪</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: dashboardSummary.tratamenteActive > 0 ? colors.coral : colors.dark }}>{dashboardSummary.tratamenteActive}</div>
            <div style={{ fontSize: 10, color: colors.gray, marginTop: spacing.xs }}>cu pauză activa</div>
          </div>
        </div>

        {activePauseByParcela.length > 0 ? (
          <div className="space-y-2">
            {activePauseByParcela.map((item) => {
              const parcelaName = item.activity.parcela_id ? parcelaMap[item.activity.parcela_id] || 'Teren' : 'Teren'
              return (
                <AlertCard
                  key={item.activity.id}
                  icon="⚠️"
                  label={`Teren ${parcelaName} — pauză tratament pîn? ${formatDate(item.expiryDate)}`}
                  value={`${item.remainingDays} zile`}
                  sub={`${item.activity.produs_utilizat || 'Produs n/a'} aplicat pe ${formatDate(item.activity.data_aplicare)}`}
                  variant="danger"
                  onClick={() => scrollToActivity(item.activity.id)}
                />
              )
            })}
          </div>
        ) : null}

        <div style={{ background: colors.white, borderRadius: radius.xl, boxShadow: shadows.card, padding: spacing.lg }}>
          <h3 style={{ fontSize: 13, fontWeight: 700, color: colors.dark, marginBottom: spacing.sm }}>Stare terenuri</h3>
          <div style={{ display: 'grid', gap: spacing.xs }}>
            {stareParceleRows.map((row) => {
              const kind = activityKind(row.latest?.tip_activitate)
              return (
                <button
                  key={row.parcela.id}
                  type="button"
                  onClick={() => {
                    router.push('/activitati-agricole')
                    setSelectedParcelaId(row.parcela.id)
                  }}
                  style={{
                    border: 'none',
                    width: '100%',
                    textAlign: 'left',
                    background: colors.white,
                    borderRadius: radius.md,
                    padding: `${spacing.xs + 2}px ${spacing.sm}px`,
                    cursor: 'pointer',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: spacing.sm }}>
                    <span style={{ fontSize: 14, flexShrink: 0 }}>{activityEmoji(kind)}</span>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: colors.dark }}>{row.parcela.nume_parcela || 'Teren'}</div>
                      <div style={{ fontSize: 11, color: row.latest ? colors.gray : colors.yellow }}>
                        {row.latest ? `${row.latest.tip_activitate || 'Activitate'} — ${row.latest.produs_utilizat || '-'}` : 'Nicio activitate'}
                      </div>
                    </div>
                    <div style={{ fontSize: 11, color: row.daysAgo !== null && row.daysAgo > 14 ? colors.yellow : colors.gray, flexShrink: 0 }}>
                      {row.daysAgo === null ? '—' : `acum ${row.daysAgo} zile`}
                    </div>
                  </div>
                </button>
              )
            })}
          </div>
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: spacing.xs }}>
          {([
            ['toate', 'Toate'],
            ['tratamente', '🧪 Tratamente'],
            ['fertilizare', '🌱 Fertilizare'],
            ['taiere', '✂️ Taiere'],
            ['altele', 'Altele'],
          ] as Array<[TipFilter, string]>).map(([key, label]) => {
            const active = tipFilter === key
            return (
              <button
                key={key}
                type="button"
                onClick={() => setTipFilter(key)}
                style={{
                  minHeight: 34,
                  borderRadius: radius.md,
                  border: active ? 'none' : `1px solid ${colors.grayLight}`,
                  background: active ? colors.primary : colors.white,
                  color: active ? colors.white : colors.gray,
                  fontSize: 11,
                  fontWeight: 700,
                  padding: '0 10px',
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
                minHeight: 34,
                borderRadius: radius.md,
                border: 'none',
                background: colors.coralLight,
                color: colors.coral,
                fontSize: 11,
                fontWeight: 700,
                padding: '0 10px',
                cursor: 'pointer',
              }}
            >
              ✕ Reset teren
            </button>
          ) : null}
        </div>

        <SearchField
          placeholder="Caută activitate, produs, doza..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          aria-label="Caută activități"
        />

        {isError ? <ErrorState title="Eroare la înc?rcare" message={(error as Error).message} onRetry={refresh} /> : null}
        {isLoading ? <LoadingState label="Se încarcă activitatile..." /> : null}
        {!isLoading && !isError && filteredActivitati.length === 0 ? (
          <EmptyState
            icon={<Calendar className="h-16 w-16" />}
            title="Nicio activitate inca"
            description="Adaugă prima activitate pentru a incepe"
          />
        ) : null}

        {filteredActivitati.length > 0 ? (
          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
            {filteredActivitati.map((a) => {
              const kind = activityKind(a.tip_activitate)
              const remainingDays = kind === 'tratamente' ? computeActivityRemainingDays(a, today) : 0
              const hasActivePause = remainingDays > 0
              const isExpanded = !!expandedById[a.id]
              const expiryDate = hasActivePause
                ? toIsoDate(new Date(today.getFullYear(), today.getMonth(), today.getDate() + remainingDays))
                : null

              return (
                <div
                  key={a.id}
                  ref={(node) => {
                    activityRefs.current[a.id] = node
                  }}
                  style={{
                    borderRadius: radius.lg,
                    border: `1px solid ${colors.grayLight}`,
                    boxShadow: shadows.card,
                    background: hasActivePause ? colors.coralLight : colors.white,
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
                      padding: spacing.md,
                      cursor: 'pointer',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: spacing.sm }}>
                      <div
                        style={{
                          width: 40,
                          height: 40,
                          borderRadius: radius.md,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          background: activityBg(kind),
                          fontSize: 18,
                          flexShrink: 0,
                        }}
                      >
                        {activityEmoji(kind)}
                      </div>
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div style={{ fontSize: 14, fontWeight: 700, color: colors.dark, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {a.tip_activitate || 'Activitate'}
                        </div>
                        <div style={{ fontSize: 11, color: colors.gray }}>
                          Teren {a.parcela_id ? parcelaMap[a.parcela_id] || 'necunoscut' : 'necunoscut'}
                        </div>
                        {(a.produs_utilizat || a.doza) ? (
                          <div style={{ fontSize: 11, color: colors.gray }}>
                            {[a.produs_utilizat, a.doza].filter(Boolean).join(' · ')}
                          </div>
                        ) : null}
                      </div>
                      <div style={{ textAlign: 'right', flexShrink: 0 }}>
                        <div style={{ fontSize: 12, color: colors.dark }}>{formatDate(a.data_aplicare)}</div>
                        {hasActivePause ? (
                          <span
                            style={{
                              display: 'inline-flex',
                              marginTop: 4,
                              borderRadius: radius.sm,
                              background: colors.coral,
                              color: colors.white,
                              padding: '2px 6px',
                              fontSize: 10,
                              fontWeight: 700,
                            }}
                          >
                            ⏳ Pauză {remainingDays} zile
                          </span>
                        ) : null}
                      </div>
                    </div>
                  </button>

                  {isExpanded ? (
                    <div
                      style={{
                        borderTop: `1px solid ${colors.grayLight}`,
                        padding: `${spacing.sm}px ${spacing.md}px ${spacing.md}px`,
                        display: 'grid',
                        gap: spacing.sm,
                        background: colors.white,
                      }}
                    >
                      <div style={{ display: 'grid', gap: 4 }}>
                        <div style={{ fontSize: 11, color: colors.gray }}>
                          <strong style={{ color: colors.dark }}>Operator:</strong> {a.operator || '-'}
                        </div>
                        <div style={{ fontSize: 11, color: colors.gray }}>
                          <strong style={{ color: colors.dark }}>Observații:</strong> {a.observatii || '-'}
                        </div>
                        <div style={{ fontSize: 11, color: colors.gray }}>
                          <strong style={{ color: colors.dark }}>Durata:</strong> {a.timp_pauza_zile || 0} zile
                        </div>
                        {kind === 'tratamente' ? (
                          <div style={{ fontSize: 11, color: colors.gray }}>
                            <strong style={{ color: colors.dark }}>Timp pauză:</strong> {a.timp_pauza_zile || 0} zile · Expira: {expiryDate ? formatDate(expiryDate) : '-'}
                          </div>
                        ) : null}
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: spacing.sm }}>
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation()
                            setSelected(a)
                            setEditOpen(true)
                          }}
                          style={{
                            minHeight: 48,
                            border: 'none',
                            borderRadius: radius.md,
                            background: colors.yellowLight,
                            color: colors.dark,
                            fontSize: 12,
                            fontWeight: 700,
                            cursor: 'pointer',
                          }}
                        >
                          ✏️ Edit
                        </button>
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation()
                            setToDelete(a)
                            setDeleteOpen(true)
                          }}
                          style={{
                            minHeight: 48,
                            border: 'none',
                            borderRadius: radius.md,
                            background: colors.coralLight,
                            color: colors.coral,
                            fontSize: 12,
                            fontWeight: 700,
                            cursor: 'pointer',
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

      <AddActivitateAgricolaDialog open={addOpen} onOpenChange={setAddOpen} hideTrigger />

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
