'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { toast } from '@/lib/ui/toast'

import { AppShell } from '@/components/app/AppShell'
import { EmptyState } from '@/components/app/EmptyState'
import { ErrorState } from '@/components/app/ErrorState'
import { LoadingState } from '@/components/app/LoadingState'
import { PageHeader } from '@/components/app/PageHeader'
import { StickyActionBar } from '@/components/app/StickyActionBar'
import { SectionTitle } from '@/components/dashboard/SectionTitle'
import { DeleteConfirmDialog } from '@/components/parcele/DeleteConfirmDialog'
import AlertCard from '@/components/ui/AlertCard'
import MiniCard from '@/components/ui/MiniCard'
import { SearchField } from '@/components/ui/SearchField'
import { AddVanzareButasiDialog } from '@/components/vanzari-butasi/AddVanzareButasiDialog'
import { EditVanzareButasiDialog } from '@/components/vanzari-butasi/EditVanzareButasiDialog'
import { VanzareButasiCard } from '@/components/vanzari-butasi/VanzareButasiCard'
import { ViewVanzareButasiDialog } from '@/components/vanzari-butasi/ViewVanzareButasiDialog'
import { useAddAction } from '@/contexts/AddActionContext'
import { colors, radius, shadows, spacing } from '@/lib/design-tokens'
import {
  deleteVanzareButasi,
  getVanzariButasi,
  type VanzareButasi,
} from '@/lib/supabase/queries/vanzari-butasi'
import { buildButasiOrderDeleteLabel } from '@/lib/ui/delete-labels'
import { queryKeys } from '@/lib/query-keys'

interface Client {
  id: string
  nume_client: string
  telefon: string | null
}

interface Parcela {
  id: string
  nume_parcela: string
}

interface VanzariButasiPageClientProps {
  initialVanzari: VanzareButasi[]
  clienti: Client[]
  parcele: Parcela[]
}

type SummaryFilter = 'toate' | 'active' | 'with-avans' | 'rest'

const integerFormatter = new Intl.NumberFormat('ro-RO', { maximumFractionDigits: 0 })

function formatLei(value: number): string {
  return `${new Intl.NumberFormat('ro-RO', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value)} lei`
}

function formatCompactNumber(value: number): string {
  return integerFormatter.format(Math.round(value))
}

function isSummaryFilter(value: string | null): value is SummaryFilter {
  return value === 'toate' || value === 'active' || value === 'with-avans' || value === 'rest'
}

function orderRest(order: VanzareButasi): number {
  return Number(order.total_lei || 0) - Number(order.avans_suma || 0)
}

function extractManualPhone(observatii: string | null | undefined): string | null {
  if (!observatii) return null
  const match = observatii.match(/\((\+?[0-9\s-]{7,})\)/)
  return match?.[1] ?? null
}

export function VanzariButasiPageClient({ initialVanzari, clienti, parcele }: VanzariButasiPageClientProps) {
  const pathname = usePathname()
  const router = useRouter()
  const searchParams = useSearchParams()
  const queryClient = useQueryClient()
  const { registerAddAction } = useAddAction()

  const pendingDeleteTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({})
  const pendingDeletedItems = useRef<Record<string, { item: VanzareButasi; index: number }>>({})

  const [searchTerm, setSearchTerm] = useState('')
  const [addOpen, setAddOpen] = useState(false)
  const [viewingVanzare, setViewingVanzare] = useState<VanzareButasi | null>(null)
  const [editingVanzare, setEditingVanzare] = useState<VanzareButasi | null>(null)
  const [deletingVanzare, setDeletingVanzare] = useState<VanzareButasi | null>(null)

  const summaryFilter = useMemo<SummaryFilter>(() => {
    const view = searchParams.get('view')
    return isSummaryFilter(view) ? view : 'toate'
  }, [searchParams])

  const selectedSoi = useMemo(() => searchParams.get('soi')?.trim() ?? '', [searchParams])

  const {
    data: vanzari = initialVanzari,
    isLoading,
    isError,
    error,
  } = useQuery({
    queryKey: queryKeys.vanzariButasi,
    queryFn: getVanzariButasi,
    initialData: initialVanzari,
  })

  const deleteMutation = useMutation({
    mutationFn: deleteVanzareButasi,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.vanzariButasi })
      toast.success('Comanda stearsa')
      setDeletingVanzare(null)
    },
    onError: (err: Error) => {
      toast.error(err.message)
    },
  })

  useEffect(() => {
    return () => {
      Object.values(pendingDeleteTimers.current).forEach((timer) => clearTimeout(timer))
    }
  }, [])

  useEffect(() => {
    const unregister = registerAddAction(() => setAddOpen(true), 'Adauga vanzare material saditor')
    return unregister
  }, [registerAddAction])

  const applyDashboardFilter = (view: SummaryFilter, soi?: string) => {
    const nextParams = new URLSearchParams(searchParams.toString())
    nextParams.set('view', view)

    if (soi) {
      nextParams.set('soi', soi)
    } else {
      nextParams.delete('soi')
    }

    const query = nextParams.toString()
    router.push(query ? `${pathname}?${query}` : pathname, { scroll: false })
  }

  const scheduleDelete = (order: VanzareButasi) => {
    const orderId = order.id
    const currentItems = queryClient.getQueryData<VanzareButasi[]>(queryKeys.vanzariButasi) ?? []
    const deleteIndex = currentItems.findIndex((item) => item.id === orderId)

    pendingDeletedItems.current[orderId] = { item: order, index: deleteIndex }
    queryClient.setQueryData<VanzareButasi[]>(queryKeys.vanzariButasi, (current = []) =>
      current.filter((item) => item.id !== orderId)
    )

    const timer = setTimeout(() => {
      delete pendingDeleteTimers.current[orderId]
      delete pendingDeletedItems.current[orderId]
      deleteMutation.mutate(orderId)
    }, 5000)

    pendingDeleteTimers.current[orderId] = timer

    toast('Element sters', {
      duration: 5000,
      action: {
        label: 'Undo',
        onClick: () => {
          const pendingTimer = pendingDeleteTimers.current[orderId]
          if (!pendingTimer) return

          clearTimeout(pendingTimer)
          delete pendingDeleteTimers.current[orderId]

          const pendingItem = pendingDeletedItems.current[orderId]
          delete pendingDeletedItems.current[orderId]
          if (!pendingItem) return

          queryClient.setQueryData<VanzareButasi[]>(queryKeys.vanzariButasi, (current = []) => {
            if (current.some((item) => item.id === orderId)) return current

            const next = [...current]
            const insertAt = pendingItem.index >= 0 ? Math.min(pendingItem.index, next.length) : next.length
            next.splice(insertAt, 0, pendingItem.item)
            return next
          })
        },
      },
    })
  }

  const clientMap = useMemo(() => {
    const map: Record<string, string> = {}
    clienti.forEach((client) => {
      map[client.id] = client.nume_client || 'Client'
    })
    return map
  }, [clienti])

  const clientPhoneMap = useMemo(() => {
    const map: Record<string, string | null> = {}
    clienti.forEach((client) => {
      map[client.id] = client.telefon
    })
    return map
  }, [clienti])

  const parcelaMap = useMemo(() => {
    const map: Record<string, string> = {}
    parcele.forEach((parcela) => {
      map[parcela.id] = parcela.nume_parcela || 'Parcela'
    })
    return map
  }, [parcele])

  const filteredVanzari = useMemo(() => {
    let rows = vanzari

    if (summaryFilter === 'active') {
      rows = rows.filter((order) => order.status !== 'anulata')
    } else if (summaryFilter === 'with-avans') {
      rows = rows.filter((order) => Number(order.avans_suma || 0) > 0)
    } else if (summaryFilter === 'rest') {
      rows = rows.filter((order) => order.status !== 'anulata' && orderRest(order) > 0)
    }

    if (selectedSoi) {
      const selectedSoiLower = selectedSoi.toLowerCase()
      rows = rows.filter((order) => order.items.some((item) => item.soi?.toLowerCase() === selectedSoiLower))
    }

    if (!searchTerm.trim()) return rows

    const term = searchTerm.toLowerCase().trim()
    return rows.filter((order) => {
      const clientName = order.client_id
        ? clientMap[order.client_id]?.toLowerCase()
        : (order.client_nume_manual?.toLowerCase() || '')
      const itemNames = order.items.map((item) => item.soi.toLowerCase()).join(' ')

      return (
        order.status.toLowerCase().includes(term) ||
        clientName?.includes(term) ||
        order.observatii?.toLowerCase().includes(term) ||
        order.adresa_livrare?.toLowerCase().includes(term) ||
        itemNames.includes(term)
      )
    })
  }, [vanzari, summaryFilter, selectedSoi, searchTerm, clientMap])

  const totalComenziFiltrate = useMemo(
    () => filteredVanzari.reduce((sum, order) => sum + Number(order.total_lei || 0), 0),
    [filteredVanzari]
  )

  const restTotalFiltrat = useMemo(
    () => filteredVanzari.reduce((sum, order) => sum + Math.max(0, orderRest(order)), 0),
    [filteredVanzari]
  )

  const summary = useMemo(() => {
    const activeOrders = vanzari.filter((order) => order.status !== 'anulata')
    const totalComenziCount = activeOrders.length

    const totalButasi = activeOrders.reduce(
      (sum, order) => sum + order.items.reduce((itemSum, item) => itemSum + Number(item.cantitate || 0), 0),
      0
    )

    const valoareTotala = activeOrders.reduce((sum, order) => sum + Number(order.total_lei || 0), 0)
    const avansuriPrimite = activeOrders.reduce((sum, order) => sum + Number(order.avans_suma || 0), 0)
    const restDeIncasat = activeOrders.reduce((sum, order) => sum + Math.max(0, orderRest(order)), 0)

    const perSoiMap = new Map<string, { soi: string; cantitate: number; comandaIds: Set<string> }>()

    activeOrders.forEach((order) => {
      order.items.forEach((item) => {
        const soi = item.soi?.trim()
        if (!soi) return

        const current = perSoiMap.get(soi) ?? { soi, cantitate: 0, comandaIds: new Set<string>() }
        current.cantitate += Number(item.cantitate || 0)
        current.comandaIds.add(order.id)
        perSoiMap.set(soi, current)
      })
    })

    const perSoi = Array.from(perSoiMap.values())
      .map((row) => ({
        soi: row.soi,
        cantitate: row.cantitate,
        comenziCount: row.comandaIds.size,
        progress: totalButasi > 0 ? Math.max(6, Math.round((row.cantitate / totalButasi) * 100)) : 0,
      }))
      .filter((row) => row.cantitate > 0)
      .sort((a, b) => b.cantitate - a.cantitate)

    return {
      totalComenziCount,
      totalButasi,
      valoareTotala,
      avansuriPrimite,
      restDeIncasat,
      perSoi,
    }
  }, [vanzari])

  return (
    <AppShell
      header={<PageHeader title="Material săditor" subtitle="Comenzi material săditor" />}
      bottomBar={
        <StickyActionBar>
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-medium text-[var(--agri-text-muted)]">Total comenzi: {formatLei(totalComenziFiltrate)}</p>
            <p className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-800">Rest total: {formatLei(restTotalFiltrat)}</p>
          </div>
        </StickyActionBar>
      }
    >
      <div className="mx-auto mt-3 w-full max-w-4xl space-y-3 px-0 py-3 sm:mt-0 sm:px-3 sm:space-y-4 sm:py-4">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <MiniCard
            icon={'\u{1F33F}'}
            value={String(summary.totalComenziCount)}
            sub="comenzi"
            label="Total comenzi"
            onClick={() => applyDashboardFilter('active', selectedSoi || undefined)}
          />
          <MiniCard
            icon={'\u{1F4E6}'}
            value={formatCompactNumber(summary.totalButasi)}
            sub="bucati"
            label="Total materiale"
            onClick={() => applyDashboardFilter('toate', selectedSoi || undefined)}
          />
          <MiniCard
            icon={'\u{1F4B0}'}
            value={formatCompactNumber(summary.valoareTotala)}
            sub="RON"
            label="Valoare"
            className="col-span-2 sm:col-span-1"
            onClick={() => applyDashboardFilter('toate', selectedSoi || undefined)}
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <AlertCard
            icon={'\u{2705}'}
            label="Avansuri"
            value={formatCompactNumber(summary.avansuriPrimite)}
            sub="RON incasat"
            variant="success"
            onClick={() => applyDashboardFilter('with-avans', selectedSoi || undefined)}
          />
          <AlertCard
            icon={'\u{1F4B8}'}
            label="Rest"
            value={formatCompactNumber(summary.restDeIncasat)}
            sub="RON de colectat"
            variant={summary.restDeIncasat > 0 ? 'warning' : 'success'}
            onClick={() => applyDashboardFilter('rest', selectedSoi || undefined)}
          />
        </div>

        <div
          style={{
            background: colors.white,
            borderRadius: radius.lg,
            boxShadow: shadows.card,
            padding: spacing.md,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm, marginBottom: spacing.sm }}>
            <SectionTitle className="flex-1" title="Comenzi pe soi" />
            {selectedSoi ? (
              <button
                type="button"
                onClick={() => applyDashboardFilter(summaryFilter)}
                style={{
                  border: 'none',
                  background: colors.coralLight,
                  color: colors.coral,
                  borderRadius: radius.md,
                  fontSize: 11,
                  fontWeight: 700,
                  padding: '5px 10px',
                  cursor: 'pointer',
                }}
              >
                Reset soi
              </button>
            ) : null}
          </div>

          {summary.perSoi.length === 0 ? (
            <p style={{ fontSize: 11, color: colors.gray }}>Nu există soiuri cu comenzi active.</p>
          ) : (
            <div style={{ display: 'grid', gap: spacing.xs }}>
              {summary.perSoi.map((row) => {
                const isSelected = selectedSoi.toLowerCase() === row.soi.toLowerCase()
                return (
                  <button
                    key={row.soi}
                    type="button"
                    onClick={() => {
                      const nextSoi = isSelected ? undefined : row.soi
                      applyDashboardFilter(summaryFilter, nextSoi)
                    }}
                    style={{
                      border: 'none',
                      width: '100%',
                      textAlign: 'left',
                      cursor: 'pointer',
                      borderRadius: radius.md,
                      background: isSelected ? colors.primary : colors.white,
                      color: isSelected ? colors.white : colors.dark,
                      padding: `${spacing.xs + 2}px ${spacing.sm}px`,
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: spacing.sm }}>
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: spacing.xs,
                            fontSize: 12,
                            fontWeight: 700,
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                          }}
                        >
                          <span aria-hidden="true">{'\u{1F33F}'}</span>
                          {row.soi}
                        </div>
                        <div
                          style={{
                            marginTop: 4,
                            height: 6,
                            borderRadius: radius.full,
                            background: isSelected ? 'rgba(255,255,255,0.35)' : colors.grayLight,
                            overflow: 'hidden',
                          }}
                        >
                          <div
                            style={{
                              width: `${row.progress}%`,
                              height: '100%',
                              borderRadius: radius.full,
                              background: isSelected ? colors.white : colors.primary,
                            }}
                          />
                        </div>
                      </div>
                      <div style={{ flexShrink: 0, textAlign: 'right', fontSize: 13, fontWeight: 700 }}>
                        {row.comenziCount} comenzi • {formatCompactNumber(row.cantitate)} buc
                      </div>
                    </div>
                  </button>
                )
              })}
            </div>
          )}
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: spacing.xs }}>
          {([
            ['toate', 'Toate'],
            ['active', 'Active'],
            ['with-avans', 'Cu avans'],
            ['rest', 'Rest'],
          ] as Array<[SummaryFilter, string]>).map(([value, label]) => {
            const active = summaryFilter === value
            return (
              <button
                key={value}
                type="button"
                onClick={() => applyDashboardFilter(value, selectedSoi || undefined)}
                style={{
                  minHeight: 34,
                  borderRadius: 20,
                  border: active ? 'none' : `1px solid ${colors.grayLight}`,
                  background: active ? colors.primary : colors.white,
                  color: active ? colors.white : colors.gray,
                  fontSize: 11,
                  fontWeight: 700,
                  padding: '0 12px',
                  cursor: 'pointer',
                }}
              >
                {label}
              </button>
            )
          })}
        </div>

        <SearchField
          placeholder="Caută dupa client, status, soi sau observații..."
          value={searchTerm}
          onChange={(event) => setSearchTerm(event.target.value)}
          aria-label="Caută comenzi material săditor"
        />

        {isError ? <ErrorState title="Eroare" message={(error as Error).message} /> : null}
        {isLoading ? <LoadingState label="Se încarcă comenzile..." /> : null}

        {!isLoading && !isError && filteredVanzari.length === 0 ? (
          <EmptyState
            icon={<span style={{ fontSize: 36 }}>{'\u{1F33F}'}</span>}
            title="Nicio comanda de material saditor"
            description="Adaugă prima comandă de material săditor."
            primaryAction={{
              label: 'Adaugă comanda',
              onClick: () => setAddOpen(true),
            }}
          />
        ) : null}

        {!isLoading && !isError && filteredVanzari.length > 0 ? (
          <div className="grid grid-cols-1 gap-3 lg:gap-4">
            {filteredVanzari.map((vanzare) => (
              <VanzareButasiCard
                key={vanzare.id}
                vanzare={vanzare}
                clientNume={vanzare.client_id ? clientMap[vanzare.client_id] : (vanzare.client_nume_manual || undefined)}
                clientTelefon={
                  vanzare.client_id
                    ? clientPhoneMap[vanzare.client_id]
                    : extractManualPhone(vanzare.observatii)
                }
                parcelaNume={vanzare.parcela_sursa_id ? parcelaMap[vanzare.parcela_sursa_id] : undefined}
                onView={setViewingVanzare}
                onEdit={setEditingVanzare}
                onDelete={setDeletingVanzare}
              />
            ))}
          </div>
        ) : null}
      </div>

      <AddVanzareButasiDialog open={addOpen} onOpenChange={setAddOpen} hideTrigger />

      <ViewVanzareButasiDialog
        open={!!viewingVanzare}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) setViewingVanzare(null)
        }}
        vanzare={viewingVanzare}
        clientNume={
          viewingVanzare?.client_id
            ? clientMap[viewingVanzare.client_id]
            : (viewingVanzare?.client_nume_manual || undefined)
        }
        clientTelefon={viewingVanzare?.client_id ? clientPhoneMap[viewingVanzare.client_id] : extractManualPhone(viewingVanzare?.observatii)}
        parcelaNume={viewingVanzare?.parcela_sursa_id ? parcelaMap[viewingVanzare.parcela_sursa_id] : undefined}
        onEdit={setEditingVanzare}
        onDelete={setDeletingVanzare}
      />

      <EditVanzareButasiDialog
        vanzare={editingVanzare}
        open={!!editingVanzare}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) setEditingVanzare(null)
        }}
      />

      <DeleteConfirmDialog
        open={!!deletingVanzare}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) setDeletingVanzare(null)
        }}
        onConfirm={() => {
          if (!deletingVanzare) return
          scheduleDelete(deletingVanzare)
          setDeletingVanzare(null)
        }}
        itemName={buildButasiOrderDeleteLabel(
          deletingVanzare,
          deletingVanzare?.client_id ? clientMap[deletingVanzare.client_id] : (deletingVanzare?.client_nume_manual || '')
        )}
        itemType="comanda"
        description={`Stergi comanda din ${deletingVanzare?.data_comanda ? new Date(deletingVanzare.data_comanda).toLocaleDateString('ro-RO') : 'data necunoscuta'} catre ${deletingVanzare?.client_id ? clientMap[deletingVanzare.client_id] : (deletingVanzare?.client_nume_manual || 'client necunoscut')}?`}
      />
    </AppShell>
  )
}
