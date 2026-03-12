'use client'

import dynamic from 'next/dynamic'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { toast } from '@/lib/ui/toast'

import { AppShell } from '@/components/app/AppShell'
import { ErrorState } from '@/components/app/ErrorState'
import { LoadingState } from '@/components/app/LoadingState'
import { TableCardsSkeleton } from '@/components/app/ModuleSkeletons'
import { PageHeader } from '@/components/app/PageHeader'
import { StickyActionBar } from '@/components/app/StickyActionBar'
import AlertCard from '@/components/ui/AlertCard'
import Sparkline from '@/components/ui/Sparkline'
import TrendBadge from '@/components/ui/TrendBadge'
import { VanzareCard } from '@/components/vanzari/VanzareCard'
import { SearchField } from '@/components/ui/SearchField'
import { track } from '@/lib/analytics/track'
import { trackEvent } from '@/lib/analytics/trackEvent'
import { colors, radius, shadows, spacing } from '@/lib/design-tokens'
import { getComenzi } from '@/lib/supabase/queries/comenzi'
import { getClienți } from '@/lib/supabase/queries/clienti'
import { deleteVanzare, getVanzari, updateVanzare, type Vanzare } from '@/lib/supabase/queries/vanzari'
import { buildVanzareDeleteLabel } from '@/lib/ui/delete-labels'
import { useAddAction } from '@/contexts/AddActionContext'
import { queryKeys } from '@/lib/query-keys'

const AddVanzareDialog = dynamic(
  () => import('@/components/vanzari/AddVanzareDialog').then((mod) => mod.AddVanzareDialog),
  { ssr: false }
)
const EditVanzareDialog = dynamic(
  () => import('@/components/vanzari/EditVanzareDialog').then((mod) => mod.EditVanzareDialog),
  { ssr: false }
)
const ViewVanzareDialog = dynamic(
  () => import('@/components/vanzari/ViewVanzareDialog').then((mod) => mod.ViewVanzareDialog),
  { ssr: false }
)
const ConfirmDeleteDialog = dynamic(
  () => import('@/components/app/ConfirmDeleteDialog').then((mod) => mod.ConfirmDeleteDialog),
  { ssr: false }
)

interface Client {
  id: string
  nume: string
  telefon: string | null
}

interface VanzariPageClientProps {
  initialVanzari?: Vanzare[]
  clienti?: Client[]
}

type TemporalFilter = 'azi' | 'sapt' | 'luna' | 'sezon' | 'toate'

function toDateOnly(value: string | null | undefined): string {
  return (value ?? '').slice(0, 10)
}

function toIsoDate(value: Date): string {
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`
}

function getStartOfWeek(value: Date): Date {
  const date = new Date(value)
  date.setHours(0, 0, 0, 0)
  const weekday = date.getDay()
  const shift = weekday === 0 ? 6 : weekday - 1
  date.setDate(date.getDate() - shift)
  return date
}

function getStartOfMonth(value: Date): Date {
  const date = new Date(value)
  date.setHours(0, 0, 0, 0)
  date.setDate(1)
  return date
}

function getStartOfSeason(value: Date): Date {
  const date = new Date(value.getFullYear(), 0, 1)
  date.setHours(0, 0, 0, 0)
  return date
}

function normalizeText(value: string | null | undefined): string {
  return (value ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
}

function isIncasata(status: string | null | undefined): boolean {
  const normalized = normalizeText(status)
  return normalized.includes('incasat') || normalized.includes('platit') || normalized.includes('achitat')
}

export function VanzariPageClient({ initialVanzari = [], clienti: initialClienți = [] }: VanzariPageClientProps) {
  const router = useRouter()
  const queryClient = useQueryClient()
  const { registerAddAction } = useAddAction()
  const pendingDeleteTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({})
  const pendingDeletedItems = useRef<Record<string, { item: Vanzare; index: number }>>({})

  const [searchTerm, setSearchTerm] = useState('')
  const [temporalFilter, setTemporalFilter] = useState<TemporalFilter>('luna')
  const [selectedClient, setSelectedClient] = useState<string | null>(null)
  const [paymentFilter, setPaymentFilter] = useState<'incasate' | 'neincasate' | null>(null)
  const [addOpen, setAddOpen] = useState(false)
  const [viewingVanzare, setViewingVanzare] = useState<Vanzare | null>(null)
  const [editingVanzare, setEditingVanzare] = useState<Vanzare | null>(null)
  const [deletingVanzare, setDeletingVanzare] = useState<Vanzare | null>(null)
  const [desktopSelectedVanzareId, setDesktopSelectedVanzareId] = useState<string | null>(null)

  const {
    data: vanzari = initialVanzari,
    isLoading,
    isError,
    error,
  } = useQuery({
    queryKey: queryKeys.vanzari,
    queryFn: getVanzari,
    initialData: initialVanzari,
    staleTime: 30000,
    refetchOnWindowFocus: false,
  })

  const { data: comenzi = [] } = useQuery({
    queryKey: queryKeys.comenzi,
    queryFn: getComenzi,
    staleTime: 30000,
    refetchOnWindowFocus: false,
  })

  const { data: clienti = initialClienți } = useQuery({
    queryKey: queryKeys.clienti,
    queryFn: async () => {
      const rows = await getClienți()
      return rows.map((client) => ({
        id: client.id,
        nume: client.nume_client,
        telefon: client.telefon,
      }))
    },
    initialData: initialClienți,
    staleTime: 30000,
    refetchOnWindowFocus: false,
  })

  const deleteMutation = useMutation({
    mutationFn: deleteVanzare,
    onSuccess: (_, deletedId) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.vanzari, exact: true })
      queryClient.invalidateQueries({ queryKey: queryKeys.stocGlobal, exact: true })
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard, exact: true })
      trackEvent('delete_item', 'vanzari')
      track('vanzare_delete', { id: deletedId })
      toast.success('Vânzare stearsa')
      setDeletingVanzare(null)
    },
    onError: (err: Error) => {
      toast.error(err.message)
      queryClient.invalidateQueries({ queryKey: queryKeys.vanzari, exact: true })
    },
  })

  const markPaidMutation = useMutation({
    mutationFn: (id: string) => updateVanzare(id, { status_plata: 'incasata' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.vanzari, exact: true })
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard, exact: true })
      toast.success('Vânzare marcată ca încasată ✅')
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
    const unregister = registerAddAction(() => setAddOpen(true), '💰 Vanzare directa')
    return unregister
  }, [registerAddAction])

  useEffect(() => {
    const query = searchTerm.trim()
    if (!query) return

    const timer = setTimeout(() => {
      track('search', { module: 'vanzari', query })
    }, 500)

    return () => clearTimeout(timer)
  }, [searchTerm])

  const scheduleDelete = (vanzare: Vanzare) => {
    const vanzareId = vanzare.id
    const currentItems = queryClient.getQueryData<Vanzare[]>(queryKeys.vanzari) ?? []
    const deleteIndex = currentItems.findIndex((item) => item.id === vanzareId)

    pendingDeletedItems.current[vanzareId] = { item: vanzare, index: deleteIndex }
    queryClient.setQueryData<Vanzare[]>(queryKeys.vanzari, (current = []) => current.filter((item) => item.id !== vanzareId))

    const timer = setTimeout(() => {
      delete pendingDeleteTimers.current[vanzareId]
      delete pendingDeletedItems.current[vanzareId]
      deleteMutation.mutate(vanzareId)
    }, 5000)

    pendingDeleteTimers.current[vanzareId] = timer

    toast('Element sters', {
      duration: 5000,
      action: {
        label: 'Undo',
        onClick: () => {
          const pendingTimer = pendingDeleteTimers.current[vanzareId]
          if (!pendingTimer) return
          clearTimeout(pendingTimer)
          delete pendingDeleteTimers.current[vanzareId]
          const pendingItem = pendingDeletedItems.current[vanzareId]
          delete pendingDeletedItems.current[vanzareId]
          if (!pendingItem) return

          queryClient.setQueryData<Vanzare[]>(queryKeys.vanzari, (current = []) => {
            if (current.some((item) => item.id === vanzareId)) return current
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
    clienti.forEach((c) => {
      map[c.id] = c.nume
    })
    return map
  }, [clienti])

  const clientPhoneMap = useMemo(() => {
    const map: Record<string, string | null> = {}
    clienti.forEach((c) => {
      map[c.id] = c.telefon
    })
    return map
  }, [clienti])

  const comandaMap = useMemo(() => {
    const map = new Map<string, (typeof comenzi)[number]>()
    for (const row of comenzi) {
      map.set(row.id, row)
    }
    return map
  }, [comenzi])

  const allVanzari = useMemo(() => {
    const todayIso = toIsoDate(new Date())
    return vanzari.map((row) => {
      const fromComanda = row.comanda_id ? comandaMap.get(row.comanda_id) : null
      const fallbackClient = fromComanda?.client_nume || fromComanda?.client_nume_manual || 'Client necunoscut'
      const clientNume = row.client_id ? clientMap[row.client_id] || fallbackClient : fallbackClient
      const telefon = row.client_id ? clientPhoneMap[row.client_id] || fromComanda?.telefon || null : fromComanda?.telefon || null

      return {
        ...row,
        clientNume,
        telefon,
        totalRon: Number(row.cantitate_kg || 0) * Number(row.pret_lei_kg || 0),
        incasata: isIncasata(row.status_plata),
        isNewFromComandaToday: Boolean(row.comanda_id) && toDateOnly(row.created_at) === todayIso,
      }
    })
  }, [vanzari, clientMap, clientPhoneMap, comandaMap])

  const searchedVanzari = useMemo(() => {
    const term = normalizeText(searchTerm)
    if (!term) return allVanzari
    return allVanzari.filter((row) => {
      return (
        normalizeText(row.clientNume).includes(term) ||
        normalizeText(row.status_plata).includes(term) ||
        normalizeText(row.observatii_ladite).includes(term)
      )
    })
  }, [allVanzari, searchTerm])

  const temporalVanzari = useMemo(() => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const todayIso = toIsoDate(today)
    const weekStartIso = toIsoDate(getStartOfWeek(today))
    const monthStartIso = toIsoDate(getStartOfMonth(today))
    const seasonStartIso = toIsoDate(getStartOfSeason(today))

    if (temporalFilter === 'toate') return searchedVanzari

    return searchedVanzari.filter((row) => {
      const rowDate = toDateOnly(row.data)
      if (temporalFilter === 'azi') return rowDate === todayIso
      if (temporalFilter === 'sapt') return rowDate >= weekStartIso && rowDate <= todayIso
      if (temporalFilter === 'luna') return rowDate >= monthStartIso && rowDate <= todayIso
      return rowDate >= seasonStartIso && rowDate <= todayIso
    })
  }, [searchedVanzari, temporalFilter])

  const filteredVanzari = useMemo(() => {
    return temporalVanzari.filter((row) => {
      if (selectedClient && row.clientNume !== selectedClient) return false
      if (paymentFilter === 'incasate' && !row.incasata) return false
      if (paymentFilter === 'neincasate' && row.incasata) return false
      return true
    })
  }, [temporalVanzari, selectedClient, paymentFilter])

  const total = useMemo(() => filteredVanzari.reduce((sum, v) => sum + v.totalRon, 0), [filteredVanzari])

  const dashboardSummary = useMemo(() => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const todayIso = toIsoDate(today)
    const monthStart = getStartOfMonth(today)
    const monthStartIso = toIsoDate(monthStart)

    const previousMonthStart = new Date(monthStart)
    previousMonthStart.setMonth(previousMonthStart.getMonth() - 1)
    const previousMonthStartIso = toIsoDate(previousMonthStart)

    const previousMonthEnd = new Date(monthStart)
    previousMonthEnd.setDate(previousMonthEnd.getDate() - 1)
    const previousMonthEndIso = toIsoDate(previousMonthEnd)

    const ronLunaCurenta = allVanzari.reduce((sum, row) => {
      const rowDate = toDateOnly(row.data)
      if (rowDate < monthStartIso || rowDate > todayIso) return sum
      return sum + row.totalRon
    }, 0)

    const ronLunaTrecuta = allVanzari.reduce((sum, row) => {
      const rowDate = toDateOnly(row.data)
      if (rowDate < previousMonthStartIso || rowDate > previousMonthEndIso) return sum
      return sum + row.totalRon
    }, 0)

    const kgLunaCurenta = allVanzari.reduce((sum, row) => {
      const rowDate = toDateOnly(row.data)
      if (rowDate < monthStartIso || rowDate > todayIso) return sum
      return sum + Number(row.cantitate_kg || 0)
    }, 0)

    const kgLunaTrecuta = allVanzari.reduce((sum, row) => {
      const rowDate = toDateOnly(row.data)
      if (rowDate < previousMonthStartIso || rowDate > previousMonthEndIso) return sum
      return sum + Number(row.cantitate_kg || 0)
    }, 0)

    const vanzariLunaCurenta = allVanzari.filter((row) => {
      const rowDate = toDateOnly(row.data)
      return rowDate >= monthStartIso && rowDate <= todayIso
    }).length

    const trendRon = ronLunaTrecuta > 0 ? ((ronLunaCurenta - ronLunaTrecuta) / ronLunaTrecuta) * 100 : ronLunaCurenta > 0 ? 100 : 0
    const trendKg = kgLunaTrecuta > 0 ? ((kgLunaCurenta - kgLunaTrecuta) / kgLunaTrecuta) * 100 : kgLunaCurenta > 0 ? 100 : 0

    const ronUltimele7Zile = Array.from({ length: 7 }, (_, index) => {
      const day = new Date(today)
      day.setDate(today.getDate() - 6 + index)
      const dayIso = toIsoDate(day)
      return allVanzari.reduce((sum, row) => {
        if (toDateOnly(row.data) !== dayIso) return sum
        return sum + row.totalRon
      }, 0)
    })

    const kgUltimele7Zile = Array.from({ length: 7 }, (_, index) => {
      const day = new Date(today)
      day.setDate(today.getDate() - 6 + index)
      const dayIso = toIsoDate(day)
      return allVanzari.reduce((sum, row) => {
        if (toDateOnly(row.data) !== dayIso) return sum
        return sum + Number(row.cantitate_kg || 0)
      }, 0)
    })

    const incasatRon = allVanzari.reduce((sum, row) => sum + (row.incasata ? row.totalRon : 0), 0)
    const neincasatRon = allVanzari.reduce((sum, row) => sum + (!row.incasata ? row.totalRon : 0), 0)
    const totalKgAll = allVanzari.reduce((sum, row) => sum + Number(row.cantitate_kg || 0), 0)
    const totalRonAll = allVanzari.reduce((sum, row) => sum + row.totalRon, 0)
    const pretMediu = totalKgAll > 0 ? totalRonAll / totalKgAll : 0

    return {
      ronLunaCurenta,
      kgLunaCurenta,
      vanzariLunaCurenta,
      trendRon,
      trendKg,
      ronUltimele7Zile,
      kgUltimele7Zile,
      incasatRon,
      neincasatRon,
      pretMediu,
    }
  }, [allVanzari])

  const topClienți = useMemo(() => {
    const grouped = new Map<string, { nume: string; totalRon: number; totalKg: number }>()
    for (const row of temporalVanzari) {
      const key = row.clientNume || 'Client necunoscut'
      const current = grouped.get(key) ?? { nume: key, totalRon: 0, totalKg: 0 }
      current.totalRon += row.totalRon
      current.totalKg += Number(row.cantitate_kg || 0)
      grouped.set(key, current)
    }
    return Array.from(grouped.values())
      .sort((a, b) => b.totalRon - a.totalRon)
      .slice(0, 5)
  }, [temporalVanzari])

  const maxTopClientRon = useMemo(() => topClienți.reduce((max, row) => (row.totalRon > max ? row.totalRon : max), 0), [topClienți])

  const activeFilterLabel = useMemo(() => {
    if (selectedClient) return `👤 ${selectedClient}`
    if (paymentFilter === 'incasate') return '✅ Încasate'
    if (paymentFilter === 'neincasate') return '💸 Neîncasate'
    return null
  }, [selectedClient, paymentFilter])

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: queryKeys.vanzari, exact: true })
  }

  const desktopSelectedVanzare =
    filteredVanzari.find((row) => row.id === desktopSelectedVanzareId) ??
    filteredVanzari[0] ??
    null

  return (
    <AppShell
      header={<PageHeader title="Vânzări Fructe" subtitle="Registrul de livrari completate" />}
      bottomBar={
        <StickyActionBar>
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-medium text-[var(--agri-text-muted)]">Venit total: {total.toFixed(2)} lei</p>
          </div>
        </StickyActionBar>
      }
    >
      <div className="mx-auto mt-4 w-full max-w-4xl space-y-3 px-0 py-3 sm:mt-0 sm:px-3 sm:space-y-4 sm:py-4 lg:max-w-7xl">
        <div className="grid grid-cols-2 gap-3">
          <div
            onClick={() => setTemporalFilter('luna')}
            style={{ background: colors.white, borderRadius: radius.xl, boxShadow: shadows.card, padding: spacing.lg, minHeight: 110, cursor: 'pointer' }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.sm }}>
              <span style={{ fontSize: 16 }}>💰</span>
              {Math.abs(dashboardSummary.trendRon) > 0.01 ? (
                <TrendBadge value={Number(Math.abs(dashboardSummary.trendRon).toFixed(0))} positive={dashboardSummary.trendRon >= 0} />
              ) : null}
            </div>
            <div style={{ fontSize: 10, color: colors.gray }}>Luna asta</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: colors.dark }}>{dashboardSummary.ronLunaCurenta.toFixed(0)} RON</div>
            <div style={{ fontSize: 10, color: colors.gray, marginBottom: spacing.xs }}>RON luna asta</div>
            {dashboardSummary.ronUltimele7Zile.some((value) => value > 0) ? (
              <Sparkline data={dashboardSummary.ronUltimele7Zile} color={colors.green} width={120} height={26} />
            ) : null}
          </div>

          <div
            onClick={() => setTemporalFilter('luna')}
            style={{ background: colors.white, borderRadius: radius.xl, boxShadow: shadows.card, padding: spacing.lg, minHeight: 110, cursor: 'pointer' }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.sm }}>
              <span style={{ fontSize: 16 }}>📦</span>
              {Math.abs(dashboardSummary.trendKg) > 0.01 ? (
                <TrendBadge value={Number(Math.abs(dashboardSummary.trendKg).toFixed(0))} positive={dashboardSummary.trendKg >= 0} />
              ) : null}
            </div>
            <div style={{ fontSize: 10, color: colors.gray }}>Total vandut</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: colors.dark }}>{dashboardSummary.kgLunaCurenta.toFixed(1)} kg</div>
            <div style={{ fontSize: 10, color: colors.gray, marginBottom: spacing.xs }}>{dashboardSummary.vanzariLunaCurenta} vânzări</div>
            {dashboardSummary.kgUltimele7Zile.some((value) => value > 0) ? (
              <Sparkline data={dashboardSummary.kgUltimele7Zile} color={colors.primary} width={120} height={26} />
            ) : null}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <AlertCard
            icon="✅"
            label="Incasat"
            value={dashboardSummary.incasatRon.toFixed(0)}
            sub="RON"
            variant="success"
            onClick={() => {
              setPaymentFilter('incasate')
              setSelectedClient(null)
            }}
          />
          <AlertCard
            icon={dashboardSummary.neincasatRon > 0 ? '💸' : '✅'}
            label={dashboardSummary.neincasatRon > 0 ? 'Neîncasat' : 'Tot încasat'}
            value={dashboardSummary.neincasatRon.toFixed(0)}
            sub={dashboardSummary.neincasatRon > 0 ? 'RON de colectat' : '0 RON de colectat'}
            variant={dashboardSummary.neincasatRon > 0 ? 'warning' : 'success'}
            onClick={dashboardSummary.neincasatRon > 0 ? () => {
              setPaymentFilter('neincasate')
              setSelectedClient(null)
            } : undefined}
          />
          <div style={{ background: colors.white, border: `1px solid ${colors.grayLight}`, borderRadius: radius.xl, boxShadow: shadows.card, padding: spacing.lg, minHeight: 110 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: colors.dark, marginBottom: spacing.xs }}>📊 Pret mediu</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: colors.dark }}>{dashboardSummary.pretMediu.toFixed(2)}</div>
            <div style={{ fontSize: 10, color: colors.gray }}>lei/kg</div>
          </div>
        </div>

        <div style={{ background: colors.white, borderRadius: radius.xl, boxShadow: shadows.card, padding: spacing.lg }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.sm }}>
            <h3 style={{ fontSize: 13, fontWeight: 700, color: colors.dark }}>Top clienti</h3>
            {selectedClient ? (
              <button
                type="button"
                onClick={() => setSelectedClient(null)}
                style={{ border: 'none', background: 'transparent', color: colors.coral, fontSize: 11, fontWeight: 700, cursor: 'pointer' }}
              >
                ✕ Reset
              </button>
            ) : null}
          </div>

          {topClienți.length === 0 ? (
            <p style={{ fontSize: 11, color: colors.gray }}>Nu există vânzări în intervalul selectat.</p>
          ) : (
            <div style={{ display: 'grid', gap: spacing.xs }}>
              {topClienți.map((client, index) => {
                const selected = selectedClient === client.nume
                const rankBg = [colors.greenLight, colors.blueLight, colors.yellowLight, colors.coralLight][index % 4]
                const progress = maxTopClientRon > 0 ? Math.max(6, (client.totalRon / maxTopClientRon) * 100) : 0
                return (
                  <button
                    key={client.nume}
                    type="button"
                    onClick={() => {
                      setSelectedClient((current) => (current === client.nume ? null : client.nume))
                      setPaymentFilter(null)
                    }}
                    style={{
                      border: 'none',
                      width: '100%',
                      textAlign: 'left',
                      background: selected ? colors.primary : colors.white,
                      color: selected ? colors.white : colors.dark,
                      borderRadius: radius.md,
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
                          background: selected ? colors.white : rankBg,
                          color: selected ? colors.primary : colors.dark,
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
                        <div style={{ fontSize: 12, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{client.nume}</div>
                        <div style={{ marginTop: 3, height: 5, borderRadius: radius.full, background: selected ? 'rgba(255,255,255,0.35)' : colors.grayLight, overflow: 'hidden' }}>
                          <div style={{ width: `${progress}%`, height: '100%', borderRadius: radius.full, background: selected ? colors.white : colors.green }} />
                        </div>
                      </div>

                      <div style={{ textAlign: 'right', flexShrink: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 700 }}>{client.totalRon.toFixed(0)} RON</div>
                        <div style={{ fontSize: 10, opacity: selected ? 0.9 : 0.8 }}>{client.totalKg.toFixed(1)} kg</div>
                      </div>
                    </div>
                  </button>
                )
              })}
            </div>
          )}
        </div>

        {activeFilterLabel ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm }}>
            <span style={{ background: colors.blueLight, color: colors.primary, borderRadius: radius.md, padding: '6px 10px', fontSize: 11, fontWeight: 700 }}>
              {activeFilterLabel}
            </span>
            <button
              type="button"
              onClick={() => {
                setSelectedClient(null)
                setPaymentFilter(null)
                setTemporalFilter('toate')
                setSearchTerm('')
              }}
              style={{ border: 'none', background: colors.coralLight, color: colors.coral, borderRadius: radius.md, padding: '6px 10px', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}
            >
              ✕ Arata toate
            </button>
          </div>
        ) : null}

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: spacing.xs }}>
          {([
            ['azi', 'Azi'],
            ['sapt', 'Sapt.'],
            ['luna', 'Luna'],
            ['sezon', 'Sezon'],
            ['toate', 'Toate'],
          ] as Array<[TemporalFilter, string]>).map(([key, label]) => {
            const active = temporalFilter === key
            return (
              <button
                key={key}
                type="button"
                onClick={() => setTemporalFilter(key)}
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
        </div>

        <SearchField placeholder="Caută dupa client sau status..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} aria-label="Caută vânzări" />

        {isError ? <ErrorState title="Eroare la încărcare" message={(error as Error).message} onRetry={refresh} /> : null}
        {isLoading ? <TableCardsSkeleton /> : null}

        {!isLoading && !isError && filteredVanzari.length === 0 ? (
          <div style={{ background: colors.white, borderRadius: radius.xl, boxShadow: shadows.card, padding: spacing.xxl, textAlign: 'center' }}>
            <div style={{ fontSize: 42, marginBottom: spacing.sm }}>💰</div>
            <h3 style={{ fontSize: 18, fontWeight: 700, color: colors.dark }}>Nicio vânzare încă</h3>
            <p style={{ fontSize: 12, color: colors.gray, marginTop: spacing.sm }}>
              Vânzările apar automat când livrezi comenzi. Du-te la Comenzi și apasă LIVRATĂ.
            </p>
            <button
              type="button"
              onClick={() => router.push('/comenzi')}
              style={{ marginTop: spacing.lg, border: 'none', borderRadius: radius.lg, background: colors.primary, color: colors.white, fontSize: 14, fontWeight: 700, padding: '12px 14px', cursor: 'pointer' }}
            >
              📦 Vezi comenzile
            </button>
          </div>
        ) : null}

        {!isLoading && !isError && filteredVanzari.length > 0 ? (
          <>
            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 sm:gap-3 md:grid-cols-2 lg:hidden">
              {filteredVanzari.map((vanzare) => (
                <VanzareCard
                  key={vanzare.id}
                  vanzare={vanzare}
                  clientNume={vanzare.clientNume}
                  telefon={vanzare.telefon}
                  incasata={vanzare.incasata}
                  isNewFromComandaToday={vanzare.isNewFromComandaToday}
                  onMarkPaid={() => markPaidMutation.mutate(vanzare.id)}
                  onOpenComanda={() => router.push('/comenzi')}
                  onView={setViewingVanzare}
                  onEdit={setEditingVanzare}
                  onDelete={setDeletingVanzare}
                />
              ))}
            </div>

            <div className="hidden lg:grid lg:grid-cols-[minmax(0,1.9fr)_minmax(340px,1fr)] lg:gap-4">
              <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
                <table className="min-w-full text-left text-sm">
                  <thead className="bg-gray-100 text-xs uppercase tracking-wide text-gray-500">
                    <tr>
                      <th className="px-4 py-3 font-semibold">Data</th>
                      <th className="px-4 py-3 font-semibold">Client</th>
                      <th className="px-4 py-3 font-semibold">Cantitate</th>
                      <th className="px-4 py-3 font-semibold">Total</th>
                      <th className="px-4 py-3 font-semibold">Plata</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredVanzari.map((vanzare) => {
                      const isSelected = desktopSelectedVanzare?.id === vanzare.id
                      return (
                        <tr
                          key={vanzare.id}
                          className={`cursor-pointer border-t border-gray-100 transition-colors ${isSelected ? 'bg-green-50' : 'hover:bg-gray-50'}`}
                          onClick={() => setDesktopSelectedVanzareId(vanzare.id)}
                        >
                          <td className="px-4 py-3 text-gray-700">{new Date(vanzare.data).toLocaleDateString('ro-RO')}</td>
                          <td className="px-4 py-3 font-medium text-gray-900">{vanzare.clientNume}</td>
                          <td className="px-4 py-3 text-gray-700">{Number(vanzare.cantitate_kg || 0).toFixed(2)} kg</td>
                          <td className="px-4 py-3 text-gray-900">{vanzare.totalRon.toFixed(2)} lei</td>
                          <td className="px-4 py-3">
                            <span
                              className={`rounded-full px-2 py-1 text-xs font-semibold ${
                                vanzare.incasata ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'
                              }`}
                            >
                              {vanzare.incasata ? 'Încasată' : 'Neîncasată'}
                            </span>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>

              <aside className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
                <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-500">Detalii vanzare</h3>
                {desktopSelectedVanzare ? (
                  <div className="mt-4 space-y-3 text-sm text-gray-700">
                    <p><span className="font-medium text-gray-900">Client:</span> {desktopSelectedVanzare.clientNume}</p>
                    <p><span className="font-medium text-gray-900">Data:</span> {new Date(desktopSelectedVanzare.data).toLocaleDateString('ro-RO')}</p>
                    <p><span className="font-medium text-gray-900">Cantitate:</span> {Number(desktopSelectedVanzare.cantitate_kg || 0).toFixed(2)} kg</p>
                    <p><span className="font-medium text-gray-900">Pret:</span> {Number(desktopSelectedVanzare.pret_lei_kg || 0).toFixed(2)} lei/kg</p>
                    <p><span className="font-medium text-gray-900">Total:</span> {desktopSelectedVanzare.totalRon.toFixed(2)} lei</p>
                    <p><span className="font-medium text-gray-900">Status plata:</span> {desktopSelectedVanzare.status_plata || '-'}</p>
                    {desktopSelectedVanzare.observatii_ladite ? (
                      <p><span className="font-medium text-gray-900">Observatii:</span> {desktopSelectedVanzare.observatii_ladite}</p>
                    ) : null}
                    <div className="flex flex-wrap gap-2 pt-2">
                      {!desktopSelectedVanzare.incasata ? (
                        <button
                          type="button"
                          className="rounded-md bg-emerald-600 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-700"
                          onClick={() => markPaidMutation.mutate(desktopSelectedVanzare.id)}
                        >
                          Marchează încasată
                        </button>
                      ) : null}
                      <button
                        type="button"
                        className="rounded-md bg-gray-900 px-3 py-2 text-xs font-semibold text-white hover:bg-gray-800"
                        onClick={() => setViewingVanzare(desktopSelectedVanzare)}
                      >
                        Vezi
                      </button>
                      <button
                        type="button"
                        className="rounded-md border border-gray-300 px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-100"
                        onClick={() => setEditingVanzare(desktopSelectedVanzare)}
                      >
                        Editează
                      </button>
                      <button
                        type="button"
                        className="rounded-md border border-red-200 px-3 py-2 text-xs font-semibold text-red-700 hover:bg-red-50"
                        onClick={() => setDeletingVanzare(desktopSelectedVanzare)}
                      >
                        Șterge
                      </button>
                    </div>
                  </div>
                ) : (
                  <p className="mt-4 text-sm text-gray-600">Selecteaza o vanzare pentru detalii.</p>
                )}
              </aside>
            </div>
          </>
        ) : null}
      </div>

      <AddVanzareDialog open={addOpen} onOpenChange={setAddOpen} hideTrigger />

      <ViewVanzareDialog
        open={!!viewingVanzare}
        onOpenChange={(open) => {
          if (!open) setViewingVanzare(null)
        }}
        vanzare={viewingVanzare}
        clientNume={viewingVanzare?.client_id ? clientMap[viewingVanzare.client_id] : undefined}
        clientTelefon={viewingVanzare?.client_id ? clientPhoneMap[viewingVanzare.client_id] : null}
        onEdit={setEditingVanzare}
        onDelete={setDeletingVanzare}
      />

      <EditVanzareDialog
        vanzare={editingVanzare}
        open={!!editingVanzare}
        onOpenChange={(open) => {
          if (!open) setEditingVanzare(null)
        }}
      />

      <ConfirmDeleteDialog
        open={!!deletingVanzare}
        onOpenChange={(open) => {
          if (!open) setDeletingVanzare(null)
        }}
        onConfirm={() => {
          if (!deletingVanzare) return
          scheduleDelete(deletingVanzare)
          setDeletingVanzare(null)
        }}
        itemName={buildVanzareDeleteLabel(deletingVanzare, deletingVanzare?.client_id ? clientMap[deletingVanzare.client_id] : '')}
        itemType="Vânzare"
        description={`Stergi vanzarea din ${deletingVanzare?.data ? new Date(deletingVanzare.data).toLocaleDateString('ro-RO') : 'data necunoscuta'} catre ${deletingVanzare?.client_id ? clientMap[deletingVanzare.client_id] || 'client necunoscut' : 'client necunoscut'}?`}
        loading={deleteMutation.isPending}
      />
    </AppShell>
  )
}
