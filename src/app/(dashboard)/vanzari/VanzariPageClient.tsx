'use client'

import { useEffect, useMemo, useState } from 'react'
import type { ColumnDef } from '@tanstack/react-table'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { toast } from '@/lib/ui/toast'

import { AppShell } from '@/components/app/AppShell'
import { DashboardContentShell } from '@/components/app/DashboardContentShell'
import { ErrorState } from '@/components/app/ErrorState'
import { TableCardsSkeleton } from '@/components/app/ModuleSkeletons'
import { PageHeader } from '@/components/app/PageHeader'
import { MobileEntityCard } from '@/components/ui/MobileEntityCard'
import { ResponsiveDataView } from '@/components/ui/ResponsiveDataView'
import { SearchField } from '@/components/ui/SearchField'
import { track } from '@/lib/analytics/track'
import { useTrackModuleView } from '@/lib/analytics/useTrackModuleView'
import { getComenzi } from '@/lib/supabase/queries/comenzi'
import { getClienți } from '@/lib/supabase/queries/clienti'
import {
  getVanzari,
  setVanzareStatusPlata,
  type Vanzare,
  type VanzareStatusPlataUpdate,
} from '@/lib/supabase/queries/vanzari'
import { queryKeys } from '@/lib/query-keys'

// Vânzările se creează exclusiv prin livrarea comenzilor (set_comanda_delivered).
// Pagina este un registru read-only; singura acțiune permisă e statusul plății.

interface Client {
  id: string
  nume: string
  telefon: string | null
}

interface VanzariPageClientProps {
  initialVanzari?: Vanzare[]
  clienti?: Client[]
}

type TemporalFilter = 'luna' | 'sapt' | 'toate'

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

function normalizeText(value: string | null | undefined): string {
  return (value ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
}

function isIncasata(status: string | null | undefined): boolean {
  const normalized = normalizeText(status)
  return normalized.includes('incasat') || normalized.includes('platit') || normalized.includes('achitat')
}

function formatData(value: string): string {
  const d = new Date(value)
  return d.toLocaleDateString('ro-RO', { day: '2-digit', month: 'short' })
}

function formatRon(value: number): string {
  return new Intl.NumberFormat('ro-RO', { maximumFractionDigits: 0 }).format(value)
}

interface EnrichedVanzare extends Vanzare {
  clientNume: string
  telefon: string | null
  totalRon: number
  incasata: boolean
}

interface VanzareCardNewProps {
  vanzare: EnrichedVanzare
  isExpanded: boolean
  onToggle: () => void
  onMarkPaid: () => void
  onMarkUnpaid: () => void
  onOpenComanda: () => void
}

function VanzareCardNew({ vanzare, isExpanded, onToggle, onMarkPaid, onMarkUnpaid, onOpenComanda }: VanzareCardNewProps) {
  const subtitle = new Date(vanzare.data).toLocaleDateString('ro-RO')
  const secondaryValue = `${Number(vanzare.cantitate_kg || 0).toFixed(1)} kg • ${Number(vanzare.pret_lei_kg || 0).toFixed(2)} RON/kg`
  const meta = vanzare.comanda_id ? 'Din comandă' : undefined

  return (
    <MobileEntityCard
      title={vanzare.clientNume}
      mainValue={`${formatRon(vanzare.totalRon)} RON`}
      subtitle={subtitle}
      secondaryValue={secondaryValue}
      meta={meta}
      statusLabel={vanzare.incasata ? 'Încasat' : 'Neîncasat'}
      statusTone={vanzare.incasata ? 'success' : 'warning'}
      showChevron
      onClick={onToggle}
      bottomSlot={isExpanded ? (
        <>
          {/* DETALII */}
          <div className="flex flex-wrap gap-2 text-xs text-[var(--agri-text)]">
            <span>
              <span className="text-[var(--agri-text-muted)]">Cantitate: </span>
              <span className="font-semibold">{Number(vanzare.cantitate_kg || 0).toFixed(2)} kg</span>
            </span>
            <span>
              <span className="text-[var(--agri-text-muted)]">Preț: </span>
              <span className="font-semibold">{Number(vanzare.pret_lei_kg || 0).toFixed(2)} RON/kg</span>
            </span>
            <span>
              <span className="text-[var(--agri-text-muted)]">Total: </span>
              <span className="font-semibold text-[var(--value-positive)]">{formatRon(vanzare.totalRon)} RON</span>
            </span>
            <span>
              <span className="text-[var(--agri-text-muted)]">Data: </span>
              <span className="font-semibold">{new Date(vanzare.data).toLocaleDateString('ro-RO')}</span>
            </span>
            <span>
              <span className="text-[var(--agri-text-muted)]">Încasat: </span>
              <span
                className="font-semibold"
                style={{
                  color: vanzare.incasata ? 'var(--status-success-text)' : 'var(--status-warning-text)',
                }}
              >
                {vanzare.incasata ? 'Da' : 'Nu'}
              </span>
            </span>
          </div>

          {/* LINK COMANDA */}
          {vanzare.comanda_id ? (
            <div className="mt-3">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  onOpenComanda()
                }}
                className="min-h-9 rounded-lg border border-[var(--soft-info-border)] bg-[var(--soft-info-bg)] px-3 text-[11px] font-semibold text-[var(--soft-info-text)]"
              >
                Vezi comanda
              </button>
            </div>
          ) : null}

          {/* CONTACT BUTTONS */}
          {vanzare.telefon ? (
            <div className="mt-3 flex gap-2">
              <a
                href={`tel:${vanzare.telefon}`}
                onClick={(e) => e.stopPropagation()}
                className="flex-1 min-h-11 rounded-xl border border-[var(--button-muted-border)] bg-[var(--button-muted-bg)] px-3 text-center text-sm font-semibold leading-[44px] text-[var(--button-muted-text)]"
              >
                Sună
              </a>
              <a
                href={`https://wa.me/${vanzare.telefon.replace(/\D/g, '')}`}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="flex-1 min-h-11 rounded-xl border border-[var(--status-success-border)] bg-[var(--status-success-bg)] px-3 text-center text-sm font-semibold leading-[44px] text-[var(--status-success-text)]"
              >
                WhatsApp
              </a>
            </div>
          ) : null}

          {/* TOGGLE INCASARE */}
          {!vanzare.incasata ? (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                onMarkPaid()
              }}
              className="mt-3 min-h-11 w-full rounded-xl bg-[var(--brand-blue)] px-3 text-sm font-bold text-white"
            >
              Marchează ca încasat
            </button>
          ) : (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                onMarkUnpaid()
              }}
              className="mt-3 min-h-11 w-full rounded-xl border border-[var(--button-muted-border)] bg-[var(--button-muted-bg)] px-3 text-sm font-semibold text-[var(--agri-text-muted)]"
            >
              Marchează ca neîncasat
            </button>
          )}
        </>
      ) : undefined}
    />
  )
}

export function VanzariPageClient({ initialVanzari = [], clienti: initialClienți = [] }: VanzariPageClientProps) {
  useTrackModuleView('vanzari')
  const router = useRouter()
  const queryClient = useQueryClient()
  const hasInitialVanzari = initialVanzari.length > 0
  const hasInitialClienti = initialClienți.length > 0

  const [searchTerm, setSearchTerm] = useState('')
  const [temporalFilter, setTemporalFilter] = useState<TemporalFilter>('luna')
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const {
    data: vanzari = initialVanzari,
    isLoading,
    isError,
    error,
  } = useQuery({
    queryKey: queryKeys.vanzari,
    queryFn: getVanzari,
    initialData: hasInitialVanzari ? initialVanzari : undefined,
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
    initialData: hasInitialClienti ? initialClienți : undefined,
    staleTime: 30000,
    refetchOnWindowFocus: false,
  })

  const statusPlataMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: VanzareStatusPlataUpdate }) =>
      setVanzareStatusPlata(id, status),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.vanzari, exact: true })
      queryClient.invalidateQueries({ queryKey: queryKeys.comenzi, exact: true })
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard, exact: true })
      toast.success(variables.status === 'platit' ? '✓ Marcat ca încasat' : 'Marcat ca neîncasat')
    },
    onError: (err: Error) => {
      toast.error(err.message)
    },
  })

  useEffect(() => {
    const query = searchTerm.trim()
    if (!query) return

    const timer = setTimeout(() => {
      track('search', { module: 'vanzari', query })
    }, 500)

    return () => clearTimeout(timer)
  }, [searchTerm])

  const clientMap = useMemo(() => {
    const map: Record<string, string> = {}
    clienti.forEach((c) => { map[c.id] = c.nume })
    return map
  }, [clienti])

  const clientPhoneMap = useMemo(() => {
    const map: Record<string, string | null> = {}
    clienti.forEach((c) => { map[c.id] = c.telefon })
    return map
  }, [clienti])

  const comandaMap = useMemo(() => {
    const map = new Map<string, (typeof comenzi)[number]>()
    for (const row of comenzi) {
      map.set(row.id, row)
    }
    return map
  }, [comenzi])

  const allVanzari = useMemo<EnrichedVanzare[]>(() => {
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
      }
    })
  }, [vanzari, clientMap, clientPhoneMap, comandaMap])

  const temporalVanzari = useMemo(() => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const todayIso = toIsoDate(today)
    const weekStartIso = toIsoDate(getStartOfWeek(today))
    const monthStartIso = toIsoDate(getStartOfMonth(today))

    if (temporalFilter === 'toate') return allVanzari

    return allVanzari.filter((row) => {
      const rowDate = toDateOnly(row.data)
      if (temporalFilter === 'sapt') return rowDate >= weekStartIso && rowDate <= todayIso
      return rowDate >= monthStartIso && rowDate <= todayIso
    })
  }, [allVanzari, temporalFilter])

  const filteredVanzari = useMemo(() => {
    const term = normalizeText(searchTerm)
    if (!term) return temporalVanzari
    return temporalVanzari.filter((row) =>
      normalizeText(row.clientNume).includes(term) ||
      normalizeText(row.status_plata).includes(term) ||
      normalizeText(row.observatii_ladite).includes(term)
    )
  }, [temporalVanzari, searchTerm])

  const scoreboard = useMemo(() => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const todayIso = toIsoDate(today)
    const monthStartIso = toIsoDate(getStartOfMonth(today))

    const lunaVanzari = allVanzari.filter((row) => {
      const rowDate = toDateOnly(row.data)
      return rowDate >= monthStartIso && rowDate <= todayIso
    })

    const vanzariLunaRon = lunaVanzari.reduce((sum, row) => sum + row.totalRon, 0)
    const vanzariLunaKg = lunaVanzari.reduce((sum, row) => sum + Number(row.cantitate_kg || 0), 0)
    const neincasatRon = allVanzari.reduce((sum, row) => sum + (!row.incasata ? row.totalRon : 0), 0)

    return { vanzariLunaRon, vanzariLunaKg, neincasatRon }
  }, [allVanzari])

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: queryKeys.vanzari, exact: true })
  }

  const PILL_FILTERS: { key: TemporalFilter; label: string }[] = [
    { key: 'luna', label: 'Luna' },
    { key: 'sapt', label: 'Săpt.' },
    { key: 'toate', label: 'Toate' },
  ]
  const desktopColumns = useMemo<ColumnDef<EnrichedVanzare>[]>(() => [
    {
      accessorKey: 'data',
      header: 'Data',
      cell: ({ row }) => formatData(row.original.data),
      meta: {
        searchValue: (row: EnrichedVanzare) => row.data,
      },
    },
    {
      accessorKey: 'clientNume',
      header: 'Client',
      cell: ({ row }) => <span className="font-medium">{row.original.clientNume}</span>,
    },
    {
      id: 'produse',
      header: 'Produse',
      cell: () => '1',
      meta: {
        searchValue: () => '1',
        numeric: true,
      },
    },
    {
      accessorKey: 'cantitate_kg',
      header: 'Cantitate',
      cell: ({ row }) => `${Number(row.original.cantitate_kg || 0).toFixed(1)} kg`,
      meta: {
        searchValue: (row: EnrichedVanzare) => row.cantitate_kg,
        numeric: true,
      },
    },
    {
      accessorKey: 'totalRon',
      header: 'Valoare',
      cell: ({ row }) => `${formatRon(row.original.totalRon)} RON`,
      meta: {
        searchValue: (row: EnrichedVanzare) => row.totalRon,
        numeric: true,
      },
    },
    {
      id: 'incasare',
      header: 'Încasare',
      enableSorting: false,
      cell: ({ row }) => (
        <span
          className="text-xs font-semibold"
          style={{
            color: row.original.incasata ? 'var(--status-success-text)' : 'var(--status-warning-text)',
          }}
        >
          {row.original.incasata ? 'Încasat' : 'Neîncasat'}
        </span>
      ),
      meta: {
        searchable: false,
        headerClassName: 'w-[104px] text-right',
        cellClassName: 'w-[104px] text-right',
      },
    },
  ], [])

  return (
    <AppShell
      header={<PageHeader title="Vânzări" subtitle="Registrul livrărilor finalizate" contentVariant="centered" />}
      bottomBar={null}
    >
      <DashboardContentShell variant="centered" className="mt-2 py-3 sm:mt-0 sm:py-3">

        {/* SCOREBOARD */}
        {scoreboard.vanzariLunaRon > 0 ? (
          <div style={{
            background: 'var(--agri-surface)', borderRadius: 12, padding: '10px 14px',
            border: '1px solid var(--agri-border)', marginBottom: 8,
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
              <span>
                <span style={{ fontSize: 22, fontWeight: 800, color: 'var(--value-positive)', letterSpacing: '-0.03em' }}>
                  {formatRon(scoreboard.vanzariLunaRon)}
                </span>
                <span style={{ fontSize: 11, fontWeight: 500, color: 'var(--text-hint)', marginLeft: 4 }}>RON luna</span>
              </span>
              {scoreboard.vanzariLunaKg > 0 ? (
                <span>
                  <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--agri-text)' }}>
                    {scoreboard.vanzariLunaKg.toFixed(1)}
                  </span>
                  <span style={{ fontSize: 11, color: 'var(--agri-text-muted)', marginLeft: 2 }}>kg</span>
                </span>
              ) : null}
            </div>
            {scoreboard.neincasatRon > 0 ? (
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 10, color: 'var(--agri-text-muted)' }}>neîncasat</div>
                <div>
                  <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--status-warning-text)' }}>
                    {formatRon(scoreboard.neincasatRon)}
                  </span>
                  <span style={{ fontSize: 10, color: 'var(--text-hint)', marginLeft: 2 }}>RON</span>
                </div>
              </div>
            ) : null}
          </div>
        ) : null}

        {/* PILLS */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 10, flexWrap: 'wrap' }}>
          {PILL_FILTERS.map(({ key, label }) => {
            const active = temporalFilter === key
            return (
              <button
                key={key}
                type="button"
                onClick={() => setTemporalFilter(key)}
                style={{
                  padding: '6px 14px', fontSize: 11, fontWeight: 600,
                  borderRadius: 20, border: 'none', cursor: 'pointer',
                  background: active ? 'var(--pill-active-bg)' : 'var(--pill-inactive-bg)',
                  color: active ? 'var(--pill-active-text)' : 'var(--pill-inactive-text)',
                }}
              >
                {label}
              </button>
            )
          })}
        </div>

        {/* SEARCH */}
        {allVanzari.length > 5 ? (
          <div style={{ marginBottom: 10 }}>
            <SearchField
              containerClassName="md:hidden"
              placeholder="Caută după client..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              aria-label="Caută vânzări"
            />
          </div>
        ) : null}

        {isError ? <ErrorState title="Eroare la încărcare" message={(error as Error).message} onRetry={refresh} /> : null}
        {isLoading ? <TableCardsSkeleton /> : null}

        {/* EMPTY STATE */}
        {!isLoading && !isError && filteredVanzari.length === 0 ? (
          <div style={{
            background: 'var(--agri-surface)', borderRadius: 14, padding: '36px 20px',
            textAlign: 'center', border: '1px solid var(--agri-border)',
          }}>
            <div style={{ fontSize: 36, marginBottom: 8 }}>💰</div>
            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--agri-text)', marginBottom: 6 }}>Nicio vânzare încă</div>
            <div style={{ fontSize: 12, color: 'var(--text-hint)' }}>
              Vânzările se creează automat când livrezi o comandă
            </div>
          </div>
        ) : null}

        {/* LIST */}
        {!isLoading && !isError && filteredVanzari.length > 0 ? (
          <ResponsiveDataView
            columns={desktopColumns}
            data={filteredVanzari}
            mobileContainerClassName="grid-cols-1"
            getRowId={(row) => row.id}
            searchPlaceholder="Caută în vânzări..."
            emptyMessage="Nu am găsit vânzări pentru filtrele curente."
            renderCard={(vanzare) => (
              <VanzareCardNew
                vanzare={vanzare}
                isExpanded={expandedId === vanzare.id}
                onToggle={() => setExpandedId(expandedId === vanzare.id ? null : vanzare.id)}
                onMarkPaid={() => statusPlataMutation.mutate({ id: vanzare.id, status: 'platit' })}
                onMarkUnpaid={() => statusPlataMutation.mutate({ id: vanzare.id, status: 'restanta' })}
                onOpenComanda={() => router.push('/comenzi')}
              />
            )}
          />
        ) : null}

      </DashboardContentShell>
    </AppShell>
  )
}
