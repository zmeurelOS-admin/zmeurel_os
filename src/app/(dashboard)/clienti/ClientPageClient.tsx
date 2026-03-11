'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { UserCheck, Users } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { toast } from '@/lib/ui/toast'

import { AppShell } from '@/components/app/AppShell'
import { ConfirmDeleteDialog } from '@/components/app/ConfirmDeleteDialog'
import { EmptyState } from '@/components/ui/EmptyState'
import { ErrorState } from '@/components/app/ErrorState'
import { ListSkeletonCard } from '@/components/app/ListSkeleton'
import { PageHeader } from '@/components/app/PageHeader'
import { StickyActionBar } from '@/components/app/StickyActionBar'
import { useMobileScrollRestore } from '@/components/app/useMobileScrollRestore'
import { AddClientDialog } from '@/components/clienti/AddClientDialog'
import { ClientCard } from '@/components/clienti/ClientCard'
import { ClientDetailsDrawer } from '@/components/clienti/ClientDetailsDrawer'
import { EditClientDialog } from '@/components/clienti/EditClientDialog'
import AlertCard from '@/components/ui/AlertCard'
import MiniCard from '@/components/ui/MiniCard'
import { SearchField } from '@/components/ui/SearchField'
import { Button } from '@/components/ui/button'
import { useAddAction } from '@/contexts/AddActionContext'
import { colors, radius, shadows, spacing } from '@/lib/design-tokens'
import { createClienți, deleteClienți, getClienți, updateClienți, type Client } from '@/lib/supabase/queries/clienti'
import { getComenzi } from '@/lib/supabase/queries/comenzi'
import { getVanzari } from '@/lib/supabase/queries/vanzari'
import { queryKeys } from '@/lib/query-keys'

interface ClientPageClientProps {
  initialClienți: Client[]
}

function normalizeText(value: string | null | undefined): string {
  return (value ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
}

function isIncasata(status: string | null | undefined): boolean {
  const normalized = normalizeText(status)
  return normalized.includes('incasata') || normalized.includes('incasat') || normalized.includes('platit') || normalized.includes('achitat')
}

export function ClientPageClient({ initialClienți }: ClientPageClientProps) {
  const router = useRouter()
  const queryClient = useQueryClient()
  const { registerAddAction } = useAddAction()
  const [searchTerm, setSearchTerm] = useState('')
  const [showOnlyUnpaid, setShowOnlyUnpaid] = useState(false)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [selectedClient, setSelectedClient] = useState<Client | null>(null)
  const [desktopSelectedClientId, setDesktopSelectedClientId] = useState<string | null>(null)
  const [editingClient, setEditingClient] = useState<Client | null>(null)
  const [deletingClient, setDeletingClient] = useState<Client | null>(null)
  const [focusClientId, setFocusClientId] = useState<string | null>(null)
  const [focusTick, setFocusTick] = useState(0)
  const pendingDeleteTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({})
  const pendingDeletedItems = useRef<Record<string, Client>>({})

  const {
    data: clienti = initialClienți,
    isLoading,
    isError,
    error,
  } = useQuery({
    queryKey: queryKeys.clienti,
    queryFn: getClienți,
    initialData: initialClienți,
  })

  useMobileScrollRestore({
    storageKey: 'scroll:clienti',
    ready: !isLoading,
  })

  const { data: comenzi = [], isLoading: isLoadingComenzi } = useQuery({
    queryKey: queryKeys.comenzi,
    queryFn: getComenzi,
  })

  const { data: vanzari = [] } = useQuery({
    queryKey: queryKeys.vanzari,
    queryFn: getVanzari,
  })

  const createMutation = useMutation({
    mutationFn: createClienți,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.clienti })
      toast.success('Client adaugat cu succes')
      setDialogOpen(false)
    },
    onError: (err: Error) => {
      toast.error(err.message)
    },
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Parameters<typeof updateClienți>[1] }) => updateClienți(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.clienti })
      toast.success('Client actualizat')
      setEditOpen(false)
      setEditingClient(null)
    },
    onError: (err: Error) => {
      toast.error(err.message)
    },
  })

  const deleteMutation = useMutation({
    mutationFn: deleteClienți,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.clienti })
      toast.success('Client sters')
    },
    onError: (err: Error) => {
      toast.error(err.message)
      queryClient.invalidateQueries({ queryKey: queryKeys.clienti })
    },
  })

  useEffect(() => {
    return () => {
      Object.values(pendingDeleteTimers.current).forEach((timer) => clearTimeout(timer))
    }
  }, [])

  useEffect(() => {
    const unregister = registerAddAction(() => setDialogOpen(true), 'Adauga client')
    return unregister
  }, [registerAddAction])

  const scheduleDelete = (client: Client) => {
    const clientId = client.id
    pendingDeletedItems.current[clientId] = client
    queryClient.setQueryData<Client[]>(queryKeys.clienti, (current = []) => current.filter((item) => item.id !== clientId))

    const timer = setTimeout(() => {
      delete pendingDeleteTimers.current[clientId]
      delete pendingDeletedItems.current[clientId]
      deleteMutation.mutate(clientId)
    }, 5000)

    pendingDeleteTimers.current[clientId] = timer

    toast.warning('Client programat pentru ștergere.', {
      duration: 5000,
      action: {
        label: 'Undo',
        onClick: () => {
          const pendingTimer = pendingDeleteTimers.current[clientId]
          if (!pendingTimer) return
          clearTimeout(pendingTimer)
          delete pendingDeleteTimers.current[clientId]
          delete pendingDeletedItems.current[clientId]
          queryClient.invalidateQueries({ queryKey: queryKeys.clienti })
          toast.success('ștergerea a fost anulat?.')
        },
      },
    })
  }

  const metricsByClient = useMemo(() => {
    const map: Record<
      string,
      {
        totalRon: number
        totalKg: number
        vanzariCount: number
        unpaidRon: number
        hasRecentSales: boolean
        lastVanzare?: { data: string; kg: number; totalRon: number } | null
        comenziCount: number
        lastComanda?: { data: string; kg: number; status: string } | null
      }
    > = {}

    const now = Date.now()
    for (const client of clienti) {
      map[client.id] = {
        totalRon: 0,
        totalKg: 0,
        vanzariCount: 0,
        unpaidRon: 0,
        hasRecentSales: false,
        lastVanzare: null,
        comenziCount: 0,
        lastComanda: null,
      }
    }

    for (const vanzare of vanzari) {
      if (!vanzare.client_id || !map[vanzare.client_id]) continue
      const totalRon = Number(vanzare.cantitate_kg || 0) * Number(vanzare.pret_lei_kg || 0)
      const entry = map[vanzare.client_id]
      entry.totalRon += totalRon
      entry.totalKg += Number(vanzare.cantitate_kg || 0)
      entry.vanzariCount += 1
      if (!isIncasata(vanzare.status_plata)) entry.unpaidRon += totalRon
      const saleDate = new Date(vanzare.data)
      if (!Number.isNaN(saleDate.getTime())) {
        const daysDiff = (now - saleDate.getTime()) / (1000 * 60 * 60 * 24)
        if (daysDiff <= 30) entry.hasRecentSales = true
      }
      if (!entry.lastVanzare || vanzare.data > entry.lastVanzare.data) {
        entry.lastVanzare = {
          data: vanzare.data,
          kg: Number(vanzare.cantitate_kg || 0),
          totalRon,
        }
      }
    }

    for (const comanda of comenzi) {
      if (!comanda.client_id || !map[comanda.client_id]) continue
      const entry = map[comanda.client_id]
      entry.comenziCount += 1
      const date = comanda.data_livrare || comanda.data_comanda
      if (!entry.lastComanda || date > entry.lastComanda.data) {
        entry.lastComanda = {
          data: date,
          kg: Number(comanda.cantitate_kg || 0),
          status: comanda.status,
        }
      }
    }

    return map
  }, [clienti, comenzi, vanzari])

  const totalOpenOrders = useMemo(
    () => comenzi.filter((row) => row.status !== 'livrata' && row.status !== 'anulata').length,
    [comenzi]
  )

  const totalUnpaidRon = useMemo(
    () =>
      vanzari.reduce((sum, row) => {
        const value = Number(row.cantitate_kg || 0) * Number(row.pret_lei_kg || 0)
        return isIncasata(row.status_plata) ? sum : sum + value
      }, 0),
    [vanzari]
  )

  const clientsWithUnpaid = useMemo(
    () => clienti.filter((client) => (metricsByClient[client.id]?.unpaidRon ?? 0) > 0),
    [clienti, metricsByClient]
  )

  const ranking = useMemo(() => {
    return clienti
      .map((client) => ({
        client,
        totalRon: metricsByClient[client.id]?.totalRon ?? 0,
        totalKg: metricsByClient[client.id]?.totalKg ?? 0,
      }))
      .filter((row) => row.totalRon > 0)
      .sort((a, b) => b.totalRon - a.totalRon)
      .slice(0, 5)
  }, [clienti, metricsByClient])

  const rankingMaxRon = useMemo(
    () => ranking.reduce((max, row) => (row.totalRon > max ? row.totalRon : max), 0),
    [ranking]
  )

  const filteredClienți = useMemo(() => {
    const term = searchTerm.toLowerCase().trim()
    let rows = clienti

    if (term) {
      rows = rows.filter((client) =>
        [client.nume_client, client.telefon, client.email, client.adresa, client.observatii]
          .filter(Boolean)
          .some((value) => value?.toLowerCase().includes(term))
      )
    }

    if (showOnlyUnpaid) {
      rows = rows.filter((client) => (metricsByClient[client.id]?.unpaidRon ?? 0) > 0)
    }
    return rows
  }, [clienti, searchTerm, showOnlyUnpaid, metricsByClient])

  const selectedClientComenzi = useMemo(() => {
    if (!selectedClient) return []
    return comenzi.filter((comanda) => comanda.client_id === selectedClient.id)
  }, [comenzi, selectedClient])

  const focusKeyByClient = useMemo(() => {
    if (!focusClientId) return {}
    return { [focusClientId]: focusTick }
  }, [focusClientId, focusTick])

  const desktopSelectedClient =
    filteredClienți.find((item) => item.id === desktopSelectedClientId) ??
    filteredClienți[0] ??
    null

  return (
    <AppShell
      header={<PageHeader title="Clienți" subtitle="Administrare clienți" rightSlot={<UserCheck className="h-5 w-5" />} />}
      bottomBar={
        <StickyActionBar>
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-medium text-[var(--agri-text-muted)]">Total clienti: {clienti.length}</p>
          </div>
        </StickyActionBar>
      }
    >
      <div className="mx-auto mt-4 w-full max-w-4xl space-y-3 px-0 py-3 sm:mt-0 sm:px-3 lg:max-w-7xl">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <MiniCard icon="🤝" value={String(clienti.length)} sub="clienti" label="" />
          <MiniCard icon="📦" value={String(totalOpenOrders)} sub="comenzi active" label="" onClick={() => router.push('/comenzi')} />
          <div
            style={{
              background: colors.white,
              borderRadius: radius.xl,
              boxShadow: shadows.card,
              padding: `${spacing.lg}px`,
              minHeight: 110,
              border: `1px solid ${totalUnpaidRon > 0 ? colors.coral : colors.green}`,
            }}
          >
            <div style={{ fontSize: 16, marginBottom: spacing.sm }}>💸</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: totalUnpaidRon > 0 ? colors.coral : colors.green }}>
              {totalUnpaidRon.toFixed(0)}
            </div>
            <div style={{ fontSize: 10, color: colors.gray, marginTop: spacing.xs }}>RON de colectat</div>
          </div>
        </div>

        <div
          style={{
            background: colors.white,
            borderRadius: radius.xl,
            boxShadow: shadows.card,
            padding: spacing.lg,
          }}
        >
          <h3 style={{ fontSize: 13, fontWeight: 700, color: colors.dark, marginBottom: spacing.sm }}>Top clienti (valoare)</h3>
          {ranking.length === 0 ? (
            <p style={{ fontSize: 11, color: colors.gray }}>Nu exist? vânzări pentru ranking.</p>
          ) : (
            <div style={{ display: 'grid', gap: spacing.xs }}>
              {ranking.map((row, index) => {
                const progress = rankingMaxRon > 0 ? Math.max(6, (row.totalRon / rankingMaxRon) * 100) : 0
                const rankBg = [colors.greenLight, colors.blueLight, colors.yellowLight, colors.coralLight][index % 4]
                return (
                  <button
                    key={row.client.id}
                    type="button"
                    onClick={() => {
                      setFocusClientId(row.client.id)
                      setFocusTick((current) => current + 1)
                    }}
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
                      <div
                        style={{
                          width: 24,
                          height: 24,
                          borderRadius: radius.sm,
                          background: rankBg,
                          color: colors.dark,
                          fontSize: 11,
                          fontWeight: 700,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0,
                        }}
                      >
                        {index + 1}
                      </div>
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div style={{ fontSize: 12, fontWeight: 700, color: colors.dark, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {row.client.nume_client}
                        </div>
                        <div style={{ marginTop: 3, height: 5, borderRadius: radius.full, background: colors.grayLight, overflow: 'hidden' }}>
                          <div style={{ width: `${progress}%`, height: '100%', borderRadius: radius.full, background: colors.green }} />
                        </div>
                      </div>
                      <div style={{ textAlign: 'right', flexShrink: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 700, color: colors.dark }}>{row.totalRon.toFixed(0)} RON</div>
                        <div style={{ fontSize: 10, color: colors.gray }}>{row.totalKg.toFixed(1)} kg</div>
                      </div>
                    </div>
                  </button>
                )
              })}
            </div>
          )}
        </div>

        {clientsWithUnpaid.length > 0 ? (
          <AlertCard
            icon="💸"
            label={`${clientsWithUnpaid.length} clienti cu sold neincasat`}
            value={totalUnpaidRon.toFixed(0)}
            sub="RON de colectat"
            variant="warning"
            onClick={() => setShowOnlyUnpaid(true)}
          />
        ) : null}

        <div className="flex items-center gap-2">
          <SearchField
            containerClassName="flex-1"
            placeholder="Caută client dupa nume, telefon sau email..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            aria-label="Caută clienti"
          />
          {showOnlyUnpaid ? (
            <Button type="button" variant="outline" className="h-12 shrink-0" onClick={() => setShowOnlyUnpaid(false)}>
              Reset
            </Button>
          ) : null}
        </div>

        {isError ? <ErrorState title="Eroare la înc?rcare" message={(error as Error).message} onRetry={() => queryClient.invalidateQueries({ queryKey: queryKeys.clienti })} /> : null}
        {isLoading ? (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {Array.from({ length: 4 }).map((_, index) => (
              <ListSkeletonCard key={index} className="min-h-[146px] sm:min-h-[208px]" />
            ))}
          </div>
        ) : null}

        {!isLoading && !isError && filteredClienți.length === 0 ? (
          <EmptyState icon={<Users className="h-16 w-16" />} title="Niciun client inca" description="Adaugă primul client pentru a incepe" />
        ) : null}

        {!isLoading && !isError && filteredClienți.length > 0 ? (
          <>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:hidden">
              {filteredClienți.map((client) => {
                const metrics = metricsByClient[client.id]
                return (
                  <ClientCard
                    key={client.id}
                    client={client}
                    totalRon={metrics?.totalRon ?? 0}
                    totalKg={metrics?.totalKg ?? 0}
                    comenziCount={metrics?.comenziCount ?? 0}
                    vanzariCount={metrics?.vanzariCount ?? 0}
                    unpaidRon={metrics?.unpaidRon ?? 0}
                    hasRecentSales={metrics?.hasRecentSales ?? false}
                    lastComanda={metrics?.lastComanda}
                    lastVanzare={metrics?.lastVanzare}
                    focusKey={focusKeyByClient[client.id] ?? 0}
                    onEdit={(item) => {
                      setEditingClient(item)
                      setEditOpen(true)
                    }}
                    onDelete={(id) => {
                      const target = clienti.find((item) => item.id === id) ?? null
                      setDeletingClient(target)
                    }}
                    onOpenDetails={(item) => {
                      setSelectedClient(item)
                      setDrawerOpen(true)
                    }}
                  />
                )
              })}
            </div>

            <div className="hidden lg:grid lg:grid-cols-[minmax(0,1.9fr)_minmax(360px,1fr)] lg:gap-4">
              <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
                <table className="min-w-full text-left text-sm">
                  <thead className="bg-gray-100 text-xs uppercase tracking-wide text-gray-500">
                    <tr>
                      <th className="px-4 py-3 font-semibold">Client</th>
                      <th className="px-4 py-3 font-semibold">Telefon</th>
                      <th className="px-4 py-3 font-semibold">Vanzari</th>
                      <th className="px-4 py-3 font-semibold">Comenzi</th>
                      <th className="px-4 py-3 font-semibold">Neincasat</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredClienți.map((client) => {
                      const metrics = metricsByClient[client.id]
                      const isSelected = desktopSelectedClient?.id === client.id
                      return (
                        <tr
                          key={client.id}
                          className={`cursor-pointer border-t border-gray-100 transition-colors ${isSelected ? 'bg-blue-50' : 'hover:bg-gray-50'}`}
                          onClick={() => setDesktopSelectedClientId(client.id)}
                        >
                          <td className="px-4 py-3 font-medium text-gray-900">{client.nume_client}</td>
                          <td className="px-4 py-3 text-gray-700">{client.telefon || '-'}</td>
                          <td className="px-4 py-3 text-gray-700">{metrics?.vanzariCount ?? 0}</td>
                          <td className="px-4 py-3 text-gray-700">{metrics?.comenziCount ?? 0}</td>
                          <td className="px-4 py-3 text-gray-900">{(metrics?.unpaidRon ?? 0).toFixed(0)} RON</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>

              <aside className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
                <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-500">Profil client</h3>
                {desktopSelectedClient ? (
                  <div className="mt-4 space-y-3 text-sm text-gray-700">
                    <p><span className="font-medium text-gray-900">Nume:</span> {desktopSelectedClient.nume_client}</p>
                    <p><span className="font-medium text-gray-900">Telefon:</span> {desktopSelectedClient.telefon || '-'}</p>
                    <p><span className="font-medium text-gray-900">Email:</span> {desktopSelectedClient.email || '-'}</p>
                    <p><span className="font-medium text-gray-900">Adresa:</span> {desktopSelectedClient.adresa || '-'}</p>
                    <p><span className="font-medium text-gray-900">Vanzari:</span> {metricsByClient[desktopSelectedClient.id]?.vanzariCount ?? 0}</p>
                    <p><span className="font-medium text-gray-900">Comenzi:</span> {metricsByClient[desktopSelectedClient.id]?.comenziCount ?? 0}</p>
                    <p><span className="font-medium text-gray-900">Sold neincasat:</span> {(metricsByClient[desktopSelectedClient.id]?.unpaidRon ?? 0).toFixed(0)} RON</p>
                    <div className="flex flex-wrap gap-2 pt-2">
                      <button
                        type="button"
                        className="rounded-md bg-gray-900 px-3 py-2 text-xs font-semibold text-white hover:bg-gray-800"
                        onClick={() => {
                          setSelectedClient(desktopSelectedClient)
                          setDrawerOpen(true)
                        }}
                      >
                        Vezi detalii
                      </button>
                      <button
                        type="button"
                        className="rounded-md border border-gray-300 px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-100"
                        onClick={() => {
                          setEditingClient(desktopSelectedClient)
                          setEditOpen(true)
                        }}
                      >
                        Editeaza
                      </button>
                      <button
                        type="button"
                        className="rounded-md border border-red-200 px-3 py-2 text-xs font-semibold text-red-700 hover:bg-red-50"
                        onClick={() => setDeletingClient(desktopSelectedClient)}
                      >
                        Sterge
                      </button>
                    </div>
                  </div>
                ) : (
                  <p className="mt-4 text-sm text-gray-600">Selecteaza un client pentru detalii.</p>
                )}
              </aside>
            </div>
          </>
        ) : null}
      </div>

      <AddClientDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onSubmit={async (data) => {
          await createMutation.mutateAsync({
            nume_client: data.nume_client,
            telefon: data.telefon || null,
            email: data.email || null,
            adresa: data.adresa || null,
            pret_negociat_lei_kg: data.pret_negociat_lei_kg ? Number(data.pret_negociat_lei_kg) : null,
            observatii: data.observatii || null,
          })
        }}
      />

      <EditClientDialog
        client={editingClient}
        open={editOpen}
        onOpenChange={(open) => {
          setEditOpen(open)
          if (!open) setEditingClient(null)
        }}
        onSubmit={async (id, data) => {
          await updateMutation.mutateAsync({
            id,
            payload: {
              nume_client: data.nume_client,
              telefon: data.telefon || null,
              email: data.email || null,
              adresa: data.adresa || null,
              pret_negociat_lei_kg: data.pret_negociat_lei_kg ? Number(data.pret_negociat_lei_kg) : null,
              observatii: data.observatii || null,
            },
          })
        }}
      />

      <ClientDetailsDrawer
        open={drawerOpen}
        onOpenChange={(open) => {
          setDrawerOpen(open)
          if (!open) setSelectedClient(null)
        }}
        client={selectedClient}
        comenzi={selectedClientComenzi}
        isLoadingComenzi={isLoadingComenzi}
        onEdit={(client) => {
          setSelectedClient(client)
          setDrawerOpen(false)
          setEditingClient(client)
          setEditOpen(true)
        }}
        onDelete={(client) => {
          setDrawerOpen(false)
          setDeletingClient(client)
        }}
      />

      <ConfirmDeleteDialog
        open={!!deletingClient}
        onOpenChange={(open) => {
          if (!open) setDeletingClient(null)
        }}
        itemType="Client"
        itemName={deletingClient?.nume_client}
        description={`Stergi clientul ${deletingClient?.nume_client || 'selectat'}?`}
        loading={deleteMutation.isPending}
        onConfirm={() => {
          if (!deletingClient) return
          scheduleDelete(deletingClient)
          setDeletingClient(null)
        }}
      />
    </AppShell>
  )
}
