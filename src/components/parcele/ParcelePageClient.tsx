'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Map as MapIcon } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { toast } from '@/lib/ui/toast'

import { AppShell } from '@/components/app/AppShell'
import { ConfirmDeleteDialog } from '@/components/app/ConfirmDeleteDialog'
import { ErrorState } from '@/components/app/ErrorState'
import { ListSkeletonCard } from '@/components/app/ListSkeleton'
import { PageHeader } from '@/components/app/PageHeader'
import { StickyActionBar } from '@/components/app/StickyActionBar'
import { useMobileScrollRestore } from '@/components/app/useMobileScrollRestore'
import { AddParcelDrawer } from '@/components/parcele/AddParcelDrawer'
import { EditParcelDialog } from '@/components/parcele/EditParcelDialog'
import { ParceleList } from '@/components/parcele/ParceleList'
import MiniCard from '@/components/ui/MiniCard'
import { useAddAction } from '@/contexts/AddActionContext'
import { colors, radius, shadows, spacing } from '@/lib/design-tokens'
import { computeActivityRemainingDays } from '@/lib/parcele/pauza'
import { getUnitateFilterLabel, normalizeUnitateTip, type UnitateTip } from '@/lib/parcele/unitate'
import { getActivitatiAgricole } from '@/lib/supabase/queries/activitati-agricole'
import { deleteParcela, getParcele, type Parcela } from '@/lib/supabase/queries/parcele'
import { getRecoltari } from '@/lib/supabase/queries/recoltari'
import { buildParcelaDeleteLabel } from '@/lib/ui/delete-labels'
import { queryKeys } from '@/lib/query-keys'

interface ParcelePageClientProps {
  initialParcele?: Parcela[]
  initialError?: string | null
}

type UnitFilter = 'toate' | UnitateTip

const SOIURI_DISPONIBILE = ['Delniwa', 'Maravilla', 'Enrosadira', 'Husaria']

function toDateOnly(value: string | null | undefined): string {
  return (value ?? '').slice(0, 10)
}

function toIsoDate(value: Date): string {
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`
}

function getActivityEmoji(type: string | null | undefined): string {
  const value = (type ?? '').toLowerCase()
  if (value.includes('tratament')) return '🧪'
  if (value.includes('fertiliz')) return '🌱'
  if (value.includes('tundere') || value.includes('taiere') || value.includes('curatare')) return '✂️'
  return '📋'
}

function formatSurface(totalMp: number): { value: string; unit: string } {
  if (totalMp >= 10000) {
    return { value: (totalMp / 10000).toFixed(2), unit: 'ha' }
  }
  return { value: totalMp.toFixed(0), unit: 'mp' }
}

export function ParcelePageClient({ initialError }: ParcelePageClientProps) {
  const router = useRouter()
  const queryClient = useQueryClient()
  const { registerAddAction } = useAddAction()
  const pendingDeleteTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({})
  const pendingDeletedItems = useRef<Record<string, { item: Parcela; index: number }>>({})

  const [addOpen, setAddOpen] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [selectedParcela, setSelectedParcela] = useState<Parcela | null>(null)
  const [focusParcelId, setFocusParcelId] = useState<string | null>(null)
  const [unitFilter, setUnitFilter] = useState<UnitFilter>('toate')

  const {
    data: parcele = [],
    isLoading,
    isError,
    error,
  } = useQuery({
    queryKey: queryKeys.parcele,
    queryFn: getParcele,
    staleTime: 30000,
    refetchOnWindowFocus: false,
  })

  const { data: recoltari = [] } = useQuery({
    queryKey: queryKeys.recoltari,
    queryFn: getRecoltari,
    staleTime: 30000,
    refetchOnWindowFocus: false,
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
      toast.success('Teren sters')
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
    return () => {
      Object.values(pendingDeleteTimers.current).forEach((timer) => clearTimeout(timer))
    }
  }, [])

  useEffect(() => {
    const unregister = registerAddAction(() => setAddOpen(true), 'Adauga teren')
    return unregister
  }, [registerAddAction])

  const scheduleDelete = (parcela: Parcela) => {
    const parcelaId = parcela.id
    const currentItems = queryClient.getQueryData<Parcela[]>(queryKeys.parcele) ?? []
    const deleteIndex = currentItems.findIndex((item) => item.id === parcelaId)

    pendingDeletedItems.current[parcelaId] = { item: parcela, index: deleteIndex }
    queryClient.setQueryData<Parcela[]>(queryKeys.parcele, (current = []) => current.filter((item) => item.id !== parcelaId))

    const timer = setTimeout(() => {
      delete pendingDeleteTimers.current[parcelaId]
      delete pendingDeletedItems.current[parcelaId]
      deleteMutation.mutate(parcelaId)
    }, 5000)

    pendingDeleteTimers.current[parcelaId] = timer

    toast('Element sters', {
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

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const todayIso = toIsoDate(today)
  const seasonStart = new Date(today.getFullYear(), 0, 1)
  seasonStart.setHours(0, 0, 0, 0)
  const seasonStartIso = toIsoDate(seasonStart)

  const activeParcele = useMemo(
    () =>
      parcele.filter((item) => {
        const status = (item.status || '').toLowerCase()
        if (!status) return true
        return !status.includes('inactiv')
      }),
    [parcele]
  )
  const unitFilterCounts = useMemo(
    () => ({
      toate: parcele.length,
      camp: parcele.filter((parcela) => normalizeUnitateTip(parcela.tip_unitate) === 'camp').length,
      solar: parcele.filter((parcela) => normalizeUnitateTip(parcela.tip_unitate) === 'solar').length,
      livada: parcele.filter((parcela) => normalizeUnitateTip(parcela.tip_unitate) === 'livada').length,
    }),
    [parcele]
  )
  const filteredParcele = useMemo(() => {
    if (unitFilter === 'toate') return parcele
    return parcele.filter((parcela) => normalizeUnitateTip(parcela.tip_unitate) === unitFilter)
  }, [parcele, unitFilter])
  const totalSurfaceMp = useMemo(() => parcele.reduce((sum, row) => sum + Number(row.suprafata_m2 || 0), 0), [parcele])
  const totalPlants = useMemo(() => parcele.reduce((sum, row) => sum + Number(row.nr_plante || 0), 0), [parcele])
  const surface = formatSurface(totalSurfaceMp)

  const productionByParcela = useMemo(() => {
    const map = new Map<string, number>()
    for (const row of recoltari) {
      if (!row.parcela_id) continue
      const date = toDateOnly(row.data)
      if (date < seasonStartIso || date > todayIso) continue
      const kg = Number(row.kg_cal1 || 0) + Number(row.kg_cal2 || 0)
      map.set(row.parcela_id, (map.get(row.parcela_id) ?? 0) + kg)
    }
    return map
  }, [recoltari, seasonStartIso, todayIso])

  const latestHarvestByParcela = useMemo(() => {
    const map = new Map<string, { date: string; kg: number }>()
    for (const row of recoltari) {
      if (!row.parcela_id) continue
      const current = map.get(row.parcela_id)
      const next = { date: row.data, kg: Number(row.kg_cal1 || 0) + Number(row.kg_cal2 || 0) }
      if (!current || next.date > current.date) map.set(row.parcela_id, next)
    }
    return map
  }, [recoltari])

  const latestActivityByParcela = useMemo(() => {
    const map = new Map<string, { date: string; type: string; product: string; pauseUntil?: string | null }>()
    for (const row of activitati) {
      if (!row.parcela_id) continue
      const current = map.get(row.parcela_id)
      const tip = row.tip_activitate || 'Activitate'
      const produs = row.produs_utilizat || ''
      const remaining = computeActivityRemainingDays(row, today)
      const isTreatment = (row.tip_activitate || '').toLowerCase().includes('tratament')
      const pauseUntil =
        remaining > 0 && isTreatment
          ? toIsoDate(new Date(today.getFullYear(), today.getMonth(), today.getDate() + remaining))
          : null
      const next = {
        date: row.data_aplicare,
        type: tip,
        product: produs,
        pauseUntil,
      }
      if (!current || next.date > current.date) map.set(row.parcela_id, next)
    }
    return map
  }, [activitati, today])

  const productionRows = useMemo(() => {
    return filteredParcele.map((parcela) => ({
      parcela,
      kg: productionByParcela.get(parcela.id) ?? 0,
    }))
  }, [filteredParcele, productionByParcela])

  const maxProduction = useMemo(
    () => productionRows.reduce((max, row) => (row.kg > max ? row.kg : max), 0),
    [productionRows]
  )
  const visibleFocusParcelId = useMemo(() => {
    if (!focusParcelId) return null
    return filteredParcele.some((parcela) => parcela.id === focusParcelId) ? focusParcelId : null
  }, [filteredParcele, focusParcelId])

  const parcelInsights = useMemo(() => {
    const map: Record<
      string,
      {
        productionKg: number
        latestHarvest?: { date: string; kg: number } | null
        latestActivity?: { date: string; type: string } | null
      }
    > = {}

    for (const parcela of parcele) {
      const latestHarvest = latestHarvestByParcela.get(parcela.id)
      const latestActivity = latestActivityByParcela.get(parcela.id)
      map[parcela.id] = {
        productionKg: productionByParcela.get(parcela.id) ?? 0,
        latestHarvest: latestHarvest ? { date: latestHarvest.date, kg: latestHarvest.kg } : null,
        latestActivity: latestActivity
          ? { date: latestActivity.date, type: latestActivity.type }
          : null,
      }
    }
    return map
  }, [parcele, productionByParcela, latestHarvestByParcela, latestActivityByParcela])

  return (
    <AppShell
      header={
        <PageHeader
          title="Terenuri"
          subtitle="Administrare terenuri cultivate"
          rightSlot={<MapIcon className="h-5 w-5" />}
        />
      }
      bottomBar={
        <StickyActionBar>
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-medium text-[var(--agri-text-muted)]">Total terenuri: {parcele.length}</p>
          </div>
        </StickyActionBar>
      }
    >
      <div className="mx-auto mt-4 w-full max-w-4xl space-y-3 px-0 py-3 sm:mt-0 sm:px-3">
        {resolvedError ? <ErrorState title="Eroare la înc?rcare" message={resolvedError} onRetry={() => queryClient.invalidateQueries({ queryKey: queryKeys.parcele, exact: true })} /> : null}

        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, index) => (
              <ListSkeletonCard key={index} className="min-h-[146px] sm:min-h-[208px]" />
            ))}
          </div>
        ) : null}

        {!isLoading && !resolvedError && parcele.length === 0 ? (
          <div style={{ background: colors.white, borderRadius: radius.xl, boxShadow: shadows.card, padding: spacing.xxl, textAlign: 'center' }}>
            <div style={{ fontSize: 40 }}>🗺️</div>
            <h3 style={{ marginTop: spacing.sm, fontSize: 20, fontWeight: 700, color: colors.dark }}>Niciun teren inca</h3>
            <p style={{ marginTop: spacing.sm, fontSize: 12, color: colors.gray }}>
              Adaugă primul teren ca s? poți înregistra recoltări ți activități.
            </p>
            <button
              type="button"
              onClick={() => setAddOpen(true)}
              style={{
                marginTop: spacing.lg,
                border: 'none',
                borderRadius: radius.lg,
                background: colors.primary,
                color: colors.white,
                fontWeight: 700,
                fontSize: 14,
                padding: '12px 14px',
                cursor: 'pointer',
              }}
            >
              🗺️ Adaugă primul teren
            </button>
          </div>
        ) : null}

        {!isLoading && !resolvedError && parcele.length > 0 ? (
          <>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <MiniCard icon="🗺️" value={String(activeParcele.length)} sub="terenuri" label="Active" />
              <MiniCard icon="📐" value={surface.value} sub={surface.unit} label="Suprafață" />
              <MiniCard icon="🌿" value={String(totalPlants)} sub="plante" label="Total" />
            </div>

            <div style={{ display: 'flex', gap: spacing.xs, overflowX: 'auto', paddingBottom: 2 }}>
              {(['toate', 'camp', 'solar', 'livada'] as UnitFilter[]).map((filterKey) => {
                const active = unitFilter === filterKey
                return (
                  <button
                    key={filterKey}
                    type="button"
                    onClick={() => setUnitFilter(filterKey)}
                    style={{
                      borderRadius: radius.md,
                      border: `1px solid ${active ? colors.primary : colors.grayLight}`,
                      background: active ? colors.primary : colors.white,
                      color: active ? colors.white : colors.dark,
                      fontSize: 12,
                      fontWeight: 700,
                      padding: '8px 10px',
                      whiteSpace: 'nowrap',
                      cursor: 'pointer',
                    }}
                  >
                    {getUnitateFilterLabel(filterKey)} ({unitFilterCounts[filterKey]})
                  </button>
                )
              })}
            </div>

            <div style={{ background: colors.white, borderRadius: radius.xl, boxShadow: shadows.card, padding: spacing.lg }}>
              <h3 style={{ fontSize: 13, fontWeight: 700, color: colors.dark, marginBottom: spacing.sm }}>Producție sezon per teren</h3>
              <div style={{ display: 'grid', gap: spacing.xs }}>
                {productionRows.length === 0 ? (
                  <div style={{ fontSize: 11, color: colors.gray }}>
                    Nu exist? unitati pentru filtrul selectat.
                  </div>
                ) : (
                  productionRows.map((row) => {
                    const percent = maxProduction > 0 ? Math.max(6, (row.kg / maxProduction) * 100) : 0
                    return (
                      <button
                        key={row.parcela.id}
                        type="button"
                        onClick={() => setFocusParcelId(row.parcela.id)}
                        style={{
                          border: 'none',
                          background: colors.white,
                          borderRadius: radius.md,
                          width: '100%',
                          textAlign: 'left',
                          padding: `${spacing.xs + 2}px ${spacing.sm}px`,
                          cursor: 'pointer',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: spacing.sm }}>
                          <div style={{ minWidth: 0, flex: 1 }}>
                            <div style={{ fontSize: 12, fontWeight: 700, color: colors.dark }}>{row.parcela.nume_parcela || 'Teren'}</div>
                            <div style={{ fontSize: 10, color: colors.gray }}>{row.parcela.soi_plantat || 'Soi necunoscut'}</div>
                            <div style={{ marginTop: 4, height: 6, borderRadius: radius.full, background: colors.grayLight, overflow: 'hidden' }}>
                              <div
                                style={{
                                  width: `${percent}%`,
                                  height: '100%',
                                  borderRadius: radius.full,
                                  background: row.kg > 0 ? colors.green : colors.gray,
                                }}
                              />
                            </div>
                            {row.kg <= 0 ? <div style={{ fontSize: 10, color: colors.gray, marginTop: 2 }}>Nicio recoltare inca</div> : null}
                          </div>
                          <div style={{ textAlign: 'right', flexShrink: 0 }}>
                            <div style={{ fontSize: 13, fontWeight: 700, color: colors.dark }}>{row.kg.toFixed(1)}</div>
                            <div style={{ fontSize: 10, color: colors.gray }}>kg</div>
                          </div>
                        </div>
                      </button>
                    )
                  })
                )}
              </div>
            </div>

            <div style={{ background: colors.white, borderRadius: radius.xl, boxShadow: shadows.card, padding: spacing.lg }}>
              <h3 style={{ fontSize: 13, fontWeight: 700, color: colors.dark, marginBottom: spacing.sm }}>Ultima activitate</h3>
              <div style={{ display: 'grid', gap: spacing.xs }}>
                {filteredParcele.map((parcela) => {
                  const item = latestActivityByParcela.get(parcela.id)
                  return (
                    <button
                      key={parcela.id}
                      type="button"
                      onClick={() => router.push('/activitati-agricole')}
                      style={{
                        border: 'none',
                        background: colors.white,
                        borderRadius: radius.md,
                        width: '100%',
                        textAlign: 'left',
                        padding: `${spacing.xs + 2}px ${spacing.sm}px`,
                        cursor: 'pointer',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: spacing.sm }}>
                        <span style={{ fontSize: 14, flexShrink: 0 }}>{getActivityEmoji(item?.type)}</span>
                        <div style={{ minWidth: 0, flex: 1 }}>
                          <div style={{ fontSize: 12, fontWeight: 700, color: colors.dark }}>{parcela.nume_parcela || 'Teren'}</div>
                          <div style={{ fontSize: 11, color: colors.gray }}>
                            {item ? `${item.type}${item.product ? ` · ${item.product}` : ''}` : 'Fără activitate'}
                          </div>
                          {item?.pauseUntil ? (
                            <span
                              style={{
                                display: 'inline-flex',
                                marginTop: 4,
                                borderRadius: radius.sm,
                                background: colors.coralLight,
                                color: colors.coral,
                                padding: '2px 6px',
                                fontSize: 10,
                                fontWeight: 700,
                              }}
                            >
                              ⏳ Pauză pîn? {new Date(item.pauseUntil).toLocaleDateString('ro-RO')}
                            </span>
                          ) : null}
                        </div>
                        <div style={{ fontSize: 11, color: colors.gray, flexShrink: 0 }}>
                          {item ? new Date(item.date).toLocaleDateString('ro-RO') : '-'}
                        </div>
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>

            <ParceleList
              parcele={filteredParcele}
              parcelInsights={parcelInsights}
              focusParcelId={visibleFocusParcelId}
              onOpen={(parcela) => {
                router.push(`/parcele/${parcela.id}`)
              }}
              onEdit={(parcela) => {
                setSelectedParcela(parcela)
                setEditOpen(true)
              }}
              onDelete={(parcela) => {
                setSelectedParcela(parcela)
                setDeleteOpen(true)
              }}
            />
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
        description={`Stergi terenul ${buildParcelaDeleteLabel(selectedParcela)}?`}
        loading={deleteMutation.isPending}
        onConfirm={() => {
          if (!selectedParcela) return
          setDeleteOpen(false)
          scheduleDelete(selectedParcela)
          setSelectedParcela(null)
        }}
      />
    </AppShell>
  )
}
