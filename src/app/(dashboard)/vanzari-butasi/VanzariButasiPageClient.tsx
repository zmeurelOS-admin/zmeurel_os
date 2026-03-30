'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from '@/lib/ui/toast'

import { AppShell } from '@/components/app/AppShell'
import { ErrorState } from '@/components/app/ErrorState'
import { ListSkeletonCard } from '@/components/app/ListSkeleton'
import { PageHeader } from '@/components/app/PageHeader'
import { DeleteConfirmDialog } from '@/components/parcele/DeleteConfirmDialog'
import { SearchField } from '@/components/ui/SearchField'
import { MobileEntityCard } from '@/components/ui/MobileEntityCard'
import StatusBadge from '@/components/ui/StatusBadge'
import { AddVanzareButasiDialog } from '@/components/vanzari-butasi/AddVanzareButasiDialog'
import { EditVanzareButasiDialog } from '@/components/vanzari-butasi/EditVanzareButasiDialog'
import { useAddAction } from '@/contexts/AddActionContext'
import { getClienți } from '@/lib/supabase/queries/clienti'
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

function orderRest(order: VanzareButasi): number {
  return Number(order.total_lei || 0) - Number(order.avans_suma || 0)
}

function extractManualPhone(observatii: string | null | undefined): string | null {
  if (!observatii) return null
  const match = observatii.match(/\((\+?[0-9\s-]{7,})\)/)
  return match?.[1] ?? null
}

function formatLei(value: number): string {
  return `${new Intl.NumberFormat('ro-RO', { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(value)} RON`
}

type PeriodFilter = 'luna' | 'toate'

function statusLabel(status: string): string {
  if (status === 'livrata') return '✅ Livrată'
  if (status === 'anulata') return '❌ Anulată'
  if (status === 'in_curs') return '🔵 În curs'
  return '🟡 Nouă'
}

function statusColor(status: string): { bg: string; color: string } {
  if (status === 'livrata') return { bg: 'var(--soft-success-bg)', color: 'var(--soft-success-text)' }
  if (status === 'anulata') return { bg: 'var(--agri-surface-muted)', color: 'var(--text-hint)' }
  if (status === 'in_curs') return { bg: 'var(--soft-info-bg)', color: 'var(--soft-info-text)' }
  return { bg: 'var(--soft-warning-bg)', color: 'var(--soft-warning-text)' }
}

// ─── Inline card component ────────────────────────────────────────────────────

function ButasiCardNew({
  vanzare,
  clientNume,
  onEdit,
  onDelete,
}: {
  vanzare: VanzareButasi
  clientNume: string | undefined
  onEdit: () => void
  onDelete: () => void
}) {
  const title = clientNume ?? vanzare.client_nume_manual ?? '—'
  const totalButasi = (vanzare.items ?? []).reduce((sum, item) => sum + Number(item.cantitate || 0), 0)
  const firstItem = vanzare.items?.[0]
  const soi = firstItem?.soi || 'Butași'
  const subtitle = `${soi} · ${totalButasi} buc`
  const valoare = Number(vanzare.total_lei || 0)
  const mainValue = `${valoare.toFixed(0)} lei`
  
  // Mapare status la StatusBadge variant
  const getStatusVariant = (status: string): 'success' | 'warning' | 'danger' | 'neutral' => {
    if (status === 'livrata') return 'success'
    if (status === 'anulata') return 'danger'
    if (status === 'in_curs') return 'warning'
    return 'neutral'
  }

  return (
    <MobileEntityCard
      title={title}
      value={mainValue}
      secondary={subtitle}
      status={
        <StatusBadge
          text={statusLabel(vanzare.status)}
          variant={getStatusVariant(vanzare.status)}
        />
      }
      onClick={() => {
        // Deschide direct dialogul de editare la click
        onEdit()
      }}
    />
  )
}

// ─── Page component ───────────────────────────────────────────────────────────

export function VanzariButasiPageClient({ initialVanzari, clienti, parcele }: VanzariButasiPageClientProps) {
  const queryClient = useQueryClient()
  const { registerAddAction } = useAddAction()

  const pendingDeleteTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({})
  const pendingDeletedItems = useRef<Record<string, { item: VanzareButasi; index: number }>>({})
  const deleteMutateRef = useRef<(id: string) => void>(() => {})

  const [searchTerm, setSearchTerm] = useState('')
  const [periodFilter, setPeriodFilter] = useState<PeriodFilter>('luna')
  const [addOpen, setAddOpen] = useState(false)
  const [editingVanzare, setEditingVanzare] = useState<VanzareButasi | null>(null)
  const [deletingVanzare, setDeletingVanzare] = useState<VanzareButasi | null>(null)

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
      toast.success('Comanda ștearsă')
      setDeletingVanzare(null)
    },
    onError: (err: Error) => {
      toast.error(err.message)
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
    const unregister = registerAddAction(() => setAddOpen(true), 'Adaugă vânzare material săditor')
    return unregister
  }, [registerAddAction])

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

    toast('Element șters', {
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

  const { data: clientiData = clienti } = useQuery({
    queryKey: queryKeys.clienti,
    queryFn: getClienți,
    initialData: clienti as Parameters<typeof getClienți> extends never ? never : Awaited<ReturnType<typeof getClienți>>,
    staleTime: 0,
    refetchOnMount: true,
  })

  const clientMap = useMemo(() => {
    const map: Record<string, string> = {}
    clientiData.forEach((c) => { map[c.id] = c.nume_client || 'Client' })
    return map
  }, [clientiData])

  const clientPhoneMap = useMemo(() => {
    const map: Record<string, string | null> = {}
    clientiData.forEach((c) => { map[c.id] = c.telefon })
    return map
  }, [clientiData])

  const parcelaMap = useMemo(() => {
    const map: Record<string, string> = {}
    parcele.forEach((p) => { map[p.id] = p.nume_parcela || 'Parcela' })
    return map
  }, [parcele])

  // ── Computed ───────────────────────────────────────────────────────────────

  const currentMonth = useMemo(() => {
    const now = new Date()
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  }, [])

  const scoreboard = useMemo(() => {
    const lunaOrders = vanzari.filter((v) => (v.data_comanda ?? '').startsWith(currentMonth))
    const totalButasi = lunaOrders.reduce(
      (sum, v) => sum + (v.items ?? []).reduce((s, item) => s + Number(item.cantitate || 0), 0),
      0
    )
    return { nrLuna: lunaOrders.length, totalButasi }
  }, [vanzari, currentMonth])

  const filteredVanzari = useMemo(() => {
    let rows = vanzari

    if (periodFilter === 'luna') {
      rows = rows.filter((v) => (v.data_comanda ?? '').startsWith(currentMonth))
    }

    if (!searchTerm.trim()) return rows
    const term = searchTerm.toLowerCase().trim()
    return rows.filter((order) => {
      const clientName = order.client_id
        ? clientMap[order.client_id]?.toLowerCase()
        : (order.client_nume_manual?.toLowerCase() ?? '')
      const itemNames = (order.items ?? []).map((item) => item.soi.toLowerCase()).join(' ')
      return (
        order.status.toLowerCase().includes(term) ||
        clientName?.includes(term) ||
        order.observatii?.toLowerCase().includes(term) ||
        order.adresa_livrare?.toLowerCase().includes(term) ||
        itemNames.includes(term)
      )
    })
  }, [vanzari, periodFilter, currentMonth, searchTerm, clientMap])

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <AppShell
      header={<PageHeader title="Material săditor" subtitle="Comenzi material săditor" rightSlot={<span style={{ fontSize: 22 }}>🌿</span>} />}
    >
      <div className="mx-auto mt-3 w-full max-w-4xl space-y-3 px-0 py-3 sm:mt-0 sm:px-3">

        {/* Scoreboard */}
        <div style={{
          display: 'flex', flexWrap: 'wrap', gap: '4px 14px', alignItems: 'center',
          padding: '10px 14px', background: '#1b3a2a', borderRadius: 14,
        }}>
          <span style={{ color: '#fff', fontWeight: 700, fontSize: 15 }}>{scoreboard.nrLuna} comenzi luna aceasta</span>
          {scoreboard.totalButasi > 0 && (
            <>
              <span style={{ color: '#ffffff33' }}>·</span>
              <span style={{ color: '#a3c9b8', fontSize: 13 }}>{scoreboard.totalButasi} butași</span>
            </>
          )}
        </div>

        {/* Period pills */}
        <div style={{ display: 'flex', gap: 8 }}>
          {([['luna', 'Luna aceasta'], ['toate', 'Toate']] as Array<[PeriodFilter, string]>).map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => setPeriodFilter(value)}
              style={{
                borderRadius: 20, padding: '4px 14px', fontSize: 12, fontWeight: 600,
                background: periodFilter === value ? 'var(--pill-active-bg)' : 'var(--pill-inactive-bg)',
                color: periodFilter === value ? 'var(--pill-active-text)' : 'var(--pill-inactive-text)',
                border: `1px solid ${periodFilter === value ? 'var(--pill-active-border)' : 'var(--pill-inactive-border)'}`,
                cursor: 'pointer',
              }}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Search */}
        <SearchField
          placeholder="Caută după client, status, soi sau observații..."
          value={searchTerm}
          onChange={(event) => setSearchTerm(event.target.value)}
          aria-label="Caută comenzi material săditor"
        />

        {/* Error */}
        {isError ? <ErrorState title="Eroare" message={(error as Error).message} /> : null}

        {/* Loading */}
        {isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <ListSkeletonCard key={i} className="min-h-[72px]" />
            ))}
          </div>
        ) : null}

        {/* Empty state */}
        {!isLoading && !isError && filteredVanzari.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '48px 24px' }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>🌿</div>
            <p style={{ fontWeight: 700, fontSize: 16, color: 'var(--agri-text)', marginBottom: 6 }}>Nicio comandă adăugată</p>
            <p style={{ fontSize: 13, color: 'var(--text-hint)' }}>Adaugă prima comandă de material săditor</p>
          </div>
        ) : null}

        {/* Cards */}
        {!isLoading && !isError && filteredVanzari.length > 0 ? (
          <div>
            {filteredVanzari.map((vanzare) => (
              <ButasiCardNew
                key={vanzare.id}
                vanzare={vanzare}
                clientNume={vanzare.client_id ? clientMap[vanzare.client_id] : (vanzare.client_nume_manual ?? undefined)}
                onEdit={() => setEditingVanzare(vanzare)}
                onDelete={() => setDeletingVanzare(vanzare)}
              />
            ))}
          </div>
        ) : null}
      </div>

      <AddVanzareButasiDialog open={addOpen} onOpenChange={setAddOpen} hideTrigger />

      <EditVanzareButasiDialog
        vanzare={editingVanzare}
        open={!!editingVanzare}
        onOpenChange={(nextOpen) => { if (!nextOpen) setEditingVanzare(null) }}
      />

      <DeleteConfirmDialog
        open={!!deletingVanzare}
        onOpenChange={(nextOpen) => { if (!nextOpen) setDeletingVanzare(null) }}
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
        description={`Ștergi comanda din ${deletingVanzare?.data_comanda ? new Date(deletingVanzare.data_comanda).toLocaleDateString('ro-RO') : 'data necunoscută'} către ${deletingVanzare?.client_id ? clientMap[deletingVanzare.client_id] : (deletingVanzare?.client_nume_manual || 'client necunoscut')}?`}
      />
    </AppShell>
  )
}
