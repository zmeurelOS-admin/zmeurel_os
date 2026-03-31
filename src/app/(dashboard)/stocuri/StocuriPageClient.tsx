'use client'

import { useMemo, useState } from 'react'
import type { ColumnDef } from '@tanstack/react-table'
import { useQuery } from '@tanstack/react-query'

import { AppShell } from '@/components/app/AppShell'
import { ErrorState } from '@/components/app/ErrorState'
import { LoadingState } from '@/components/app/LoadingState'
import { PageHeader } from '@/components/app/PageHeader'
import { MobileEntityCard } from '@/components/ui/MobileEntityCard'
import { ResponsiveDataView } from '@/components/ui/ResponsiveDataView'
import { getStocuriPeLocatii, type StocFilters } from '@/lib/supabase/queries/miscari-stoc'
import { queryKeys } from '@/lib/query-keys'

interface ParcelaOption {
  id: string
  nume_parcela: string
}

interface StocuriPageClientProps {
  initialParcele: ParcelaOption[]
}

const LOW_STOCK_THRESHOLD = 20

function formatKg(value: number): string {
  return new Intl.NumberFormat('ro-RO', { maximumFractionDigits: 1 }).format(value)
}

function stocColor(kg: number): string {
  if (kg > 20) return 'var(--status-success-text)'
  if (kg >= 10) return 'var(--status-warning-text)'
  return 'var(--status-danger-text)'
}

function formatDate(value: string | null | undefined): string {
  if (!value) return '-'
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return '-'
  return parsed.toLocaleDateString('ro-RO')
}

interface StocRow {
  locatie_id: string
  locatie_nume: string
  produs: string
  stoc_fresh_cal1: number
  stoc_fresh_cal2: number
  stoc_congelat: number
  stoc_procesat: number
  total_kg: number
  last_updated: string | null
}

interface DesktopStocRow {
  id: string
  produs: string
  cantitate: number
  unitate: string
  lastUpdated: string | null
}

interface LocatieCardProps {
  row: StocRow
  isExpanded: boolean
  onToggle: () => void
}

function LocatieCard({ row, isExpanded, onToggle }: LocatieCardProps) {
  const total = Number(row.total_kg || 0)
  const cal1 = Number(row.stoc_fresh_cal1 || 0)
  const cal2 = Number(row.stoc_fresh_cal2 || 0)
  const congelat = Number(row.stoc_congelat || 0)
  const procesat = Number(row.stoc_procesat || 0)
  const totalFresh = cal1 + cal2
  const cal1Pct = totalFresh > 0 ? (cal1 / totalFresh) * 100 : 0
  const isLow = total > 0 && total < LOW_STOCK_THRESHOLD

  return (
    <MobileEntityCard
      title={row.locatie_nume}
      mainValue={`${formatKg(total)} kg`}
      subtitle={row.produs || 'Produs necunoscut'}
      statusLabel={isLow ? 'Scăzut' : formatDate(row.last_updated)}
      statusTone={isLow ? 'danger' : 'neutral'}
      onClick={onToggle}
      bottomSlot={isExpanded ? (
        <>
          {totalFresh > 0 ? (
            <div>
              <div className="flex justify-between text-xs">
                <span>
                  <span className="text-[var(--agri-text-muted)]">Cal I: </span>
                  <span className="font-semibold text-[var(--status-success-text)]">{formatKg(cal1)} kg</span>
                </span>
                <span>
                  <span className="text-[var(--agri-text-muted)]">Cal II: </span>
                  <span className="font-semibold text-[var(--status-warning-text)]">{formatKg(cal2)} kg</span>
                </span>
              </div>
              <div className="mt-2 flex h-1.5 w-full overflow-hidden rounded bg-[var(--agri-surface-muted)]">
                <div style={{ width: `${Math.max(0, Math.min(100, cal1Pct))}%` }} className="bg-[var(--status-success-text)]" />
                <div style={{ width: `${Math.max(0, Math.min(100, 100 - cal1Pct))}%` }} className="bg-[var(--status-warning-text)]" />
              </div>
            </div>
          ) : null}

          <div className="mt-3 flex flex-wrap gap-2 text-xs text-[var(--agri-text)]">
            {totalFresh > 0 ? (
              <span>
                <span className="text-[var(--agri-text-muted)]">Fresh: </span>
                <span className="font-semibold">{formatKg(totalFresh)} kg</span>
              </span>
            ) : null}
            {congelat > 0 ? (
              <span>
                <span className="text-[var(--agri-text-muted)]">Congelat: </span>
                <span className="font-semibold">{formatKg(congelat)} kg</span>
              </span>
            ) : null}
            {procesat > 0 ? (
              <span>
                <span className="text-[var(--agri-text-muted)]">Procesat: </span>
                <span className="font-semibold">{formatKg(procesat)} kg</span>
              </span>
            ) : null}
            <span>
              <span className="text-[var(--agri-text-muted)]">Total: </span>
              <span className="font-semibold" style={{ color: stocColor(total) }}>
                {formatKg(total)} kg
              </span>
            </span>
          </div>
        </>
      ) : undefined}
    />
  )
}

export function StocuriPageClient({ initialParcele }: StocuriPageClientProps) {
  const [locatieId, setLocatieId] = useState<string>('all')
  const [produs, setProdus] = useState<string>('all')
  const [depozit, setDepozit] = useState<'all' | 'fresh' | 'congelat' | 'procesat'>('all')
  const [calitate, setCalitate] = useState<'all' | 'cal1' | 'cal2'>('all')
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const locationOnlyFilters = useMemo<StocFilters>(
    () => ({
      locatieId: locatieId === 'all' ? undefined : locatieId,
      depozit: 'all',
      calitate: 'all',
    }),
    [locatieId]
  )

  const { data: stocuriPeLocatie = [] } = useQuery({
    queryKey: queryKeys.stocuriLocatii(locationOnlyFilters),
    queryFn: () => getStocuriPeLocatii(locationOnlyFilters),
  })

  const produseDisponibile = useMemo(
    () =>
      Array.from(new Set(stocuriPeLocatie.map((row) => String(row.produs || '').trim()).filter(Boolean))).sort((a, b) =>
        a.localeCompare(b, 'ro')
      ),
    [stocuriPeLocatie]
  )

  const effectiveProdus = useMemo(() => {
    if (produseDisponibile.length === 0) return 'all'
    if (locatieId !== 'all') return produseDisponibile.includes(produs) ? produs : produseDisponibile[0]
    if (produs !== 'all' && !produseDisponibile.includes(produs)) return 'all'
    return produs
  }, [locatieId, produs, produseDisponibile])

  const queryFilters = useMemo<StocFilters>(
    () => ({
      locatieId: locatieId === 'all' ? undefined : locatieId,
      produs: effectiveProdus === 'all' ? undefined : effectiveProdus,
      depozit,
      calitate,
    }),
    [locatieId, effectiveProdus, depozit, calitate]
  )

  const {
    data: stocuri = [],
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: queryKeys.stocuriLocatii(queryFilters),
    queryFn: () => getStocuriPeLocatii(queryFilters),
  })

  const totalKg = useMemo(() => stocuri.reduce((sum, item) => sum + Number(item.total_kg ?? 0), 0), [stocuri])
  const activeLocations = useMemo(() => stocuri.filter((item) => Number(item.total_kg || 0) > 0).length, [stocuri])
  const isLowStock = totalKg > 0 && totalKg < LOW_STOCK_THRESHOLD
  const desktopRows = useMemo<DesktopStocRow[]>(() => {
    const grouped = new Map<string, DesktopStocRow>()

    stocuri.forEach((row) => {
      const produsName = String(row.produs || '').trim() || 'Produs necunoscut'
      const current = grouped.get(produsName) ?? {
        id: produsName,
        produs: produsName,
        cantitate: 0,
        unitate: 'kg',
        lastUpdated: row.last_updated ?? null,
      }

      current.cantitate += Number(row.total_kg || 0)
      if (row.last_updated && (!current.lastUpdated || row.last_updated > current.lastUpdated)) {
        current.lastUpdated = row.last_updated
      }

      grouped.set(produsName, current)
    })

    return Array.from(grouped.values())
  }, [stocuri])
  const desktopColumns = useMemo<ColumnDef<DesktopStocRow>[]>(() => [
    {
      accessorKey: 'produs',
      header: 'Produs',
      cell: ({ row }) => <span className="font-medium">{row.original.produs}</span>,
    },
    {
      accessorKey: 'cantitate',
      header: 'Cantitate',
      cell: ({ row }) => `${formatKg(row.original.cantitate)} kg`,
      meta: {
        searchValue: (row: DesktopStocRow) => row.cantitate,
        numeric: true,
      },
    },
    {
      accessorKey: 'unitate',
      header: 'Unitate',
    },
    {
      accessorKey: 'lastUpdated',
      header: 'Ultimul update',
      cell: ({ row }) => formatDate(row.original.lastUpdated),
      meta: {
        searchValue: (row: DesktopStocRow) => formatDate(row.lastUpdated),
      },
    },
  ], [])

  const DEPOZIT_PILLS: { key: 'all' | 'fresh' | 'congelat' | 'procesat'; label: string }[] = [
    { key: 'all', label: 'Toate' },
    { key: 'fresh', label: 'Fresh' },
    { key: 'congelat', label: 'Congelat' },
    { key: 'procesat', label: 'Procesat' },
  ]

  const CALITATE_PILLS: { key: 'all' | 'cal1' | 'cal2'; label: string }[] = [
    { key: 'all', label: 'Toate' },
    { key: 'cal1', label: 'Cal I' },
    { key: 'cal2', label: 'Cal II' },
  ]

  return (
    <AppShell
      header={<PageHeader title="Stocuri" subtitle="Inventar curent pe locații" />}
      bottomBar={null}
    >
      <div className="mx-auto mt-2 w-full max-w-4xl py-3 sm:mt-0 sm:py-3">

        {/* SCOREBOARD */}
        {totalKg > 0 ? (
          <div style={{
            background: 'var(--agri-surface)', borderRadius: 12, padding: '10px 14px',
            border: '1px solid var(--agri-border)', marginBottom: 8,
            display: 'flex', alignItems: 'baseline', gap: 12, flexWrap: 'wrap',
          }}>
            <span>
              <span style={{ fontSize: 22, fontWeight: 800, color: stocColor(totalKg), letterSpacing: '-0.03em' }}>
                {formatKg(totalKg)}
              </span>
              <span style={{ fontSize: 11, fontWeight: 500, color: 'var(--text-hint)', marginLeft: 4 }}>kg disponibil</span>
            </span>
            {activeLocations > 0 ? (
              <span>
                <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--agri-text)' }}>{activeLocations}</span>
                <span style={{ fontSize: 11, color: 'var(--agri-text-muted)', marginLeft: 2 }}>locații</span>
              </span>
            ) : null}
          </div>
        ) : null}

        {/* LOW STOCK ALERT */}
        {isLowStock ? (
          <div style={{
            background: 'var(--status-danger-bg)', borderRadius: 12, padding: '10px 14px',
            borderLeft: '3px solid var(--status-danger-text)', marginBottom: 8,
          }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--status-danger-text)' }}>
              ⚠️ Stoc scăzut — reaprovizionează
            </span>
          </div>
        ) : null}

        {/* FILTERS */}
        <div style={{
          background: 'var(--agri-surface)', borderRadius: 12, padding: '10px 14px',
          border: '1px solid var(--agri-border)', marginBottom: 10,
        }}>
          {/* Locatie */}
          {initialParcele.length > 0 ? (
            <div style={{ marginBottom: 8 }}>
              <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--agri-text-muted)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Locație</div>
              <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                <button
                  type="button"
                  onClick={() => setLocatieId('all')}
                  style={{
                    padding: '5px 12px', fontSize: 11, fontWeight: 600, borderRadius: 20, border: 'none', cursor: 'pointer',
                    background: locatieId === 'all' ? 'var(--pill-active-bg)' : 'var(--pill-inactive-bg)',
                    color: locatieId === 'all' ? 'var(--pill-active-text)' : 'var(--pill-inactive-text)',
                  }}
                >
                  Toate
                </button>
                {initialParcele.map((parcela) => (
                  <button
                    key={parcela.id}
                    type="button"
                    onClick={() => setLocatieId(parcela.id)}
                    style={{
                      padding: '5px 12px', fontSize: 11, fontWeight: 600, borderRadius: 20, border: 'none', cursor: 'pointer',
                      background: locatieId === parcela.id ? 'var(--pill-active-bg)' : 'var(--pill-inactive-bg)',
                      color: locatieId === parcela.id ? 'var(--pill-active-text)' : 'var(--pill-inactive-text)',
                    }}
                  >
                    {parcela.nume_parcela || 'Teren'}
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          {/* Produs */}
          {produseDisponibile.length > 1 ? (
            <div style={{ marginBottom: 8 }}>
              <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--agri-text-muted)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Produs</div>
              <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                <button
                  type="button"
                  onClick={() => setProdus('all')}
                  style={{
                    padding: '5px 12px', fontSize: 11, fontWeight: 600, borderRadius: 20, border: 'none', cursor: 'pointer',
                    background: effectiveProdus === 'all' ? 'var(--pill-active-bg)' : 'var(--pill-inactive-bg)',
                    color: effectiveProdus === 'all' ? 'var(--pill-active-text)' : 'var(--pill-inactive-text)',
                  }}
                >
                  Toate
                </button>
                {produseDisponibile.map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setProdus(p)}
                    style={{
                      padding: '5px 12px', fontSize: 11, fontWeight: 600, borderRadius: 20, border: 'none', cursor: 'pointer',
                      background: effectiveProdus === p ? 'var(--pill-active-bg)' : 'var(--pill-inactive-bg)',
                      color: effectiveProdus === p ? 'var(--pill-active-text)' : 'var(--pill-inactive-text)',
                    }}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          {/* Depozit */}
          <div style={{ marginBottom: 8 }}>
            <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--agri-text-muted)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Depozit</div>
            <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
              {DEPOZIT_PILLS.map(({ key, label }) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setDepozit(key)}
                  style={{
                    padding: '5px 12px', fontSize: 11, fontWeight: 600, borderRadius: 20, border: 'none', cursor: 'pointer',
                    background: depozit === key ? 'var(--pill-active-bg)' : 'var(--pill-inactive-bg)',
                    color: depozit === key ? 'var(--pill-active-text)' : 'var(--pill-inactive-text)',
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Calitate */}
          <div>
            <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--agri-text-muted)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Calitate</div>
            <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
              {CALITATE_PILLS.map(({ key, label }) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setCalitate(key)}
                  style={{
                    padding: '5px 12px', fontSize: 11, fontWeight: 600, borderRadius: 20, border: 'none', cursor: 'pointer',
                    background: calitate === key ? 'var(--pill-active-bg)' : 'var(--pill-inactive-bg)',
                    color: calitate === key ? 'var(--pill-active-text)' : 'var(--pill-inactive-text)',
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {isError ? <ErrorState title="Eroare la încărcarea stocurilor" message={(error as Error).message} onRetry={() => refetch()} /> : null}
        {isLoading ? <LoadingState label="Se calculează stocurile..." /> : null}

        {/* EMPTY STATE */}
        {!isLoading && !isError && stocuri.length === 0 ? (
          <div style={{
            background: 'var(--agri-surface)', borderRadius: 14, padding: '36px 20px',
            textAlign: 'center', border: '1px solid var(--agri-border)',
          }}>
            <div style={{ fontSize: 36, marginBottom: 8 }}>📦</div>
            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--agri-text)', marginBottom: 6 }}>Niciun stoc înregistrat</div>
            <div style={{ fontSize: 12, color: 'var(--text-hint)' }}>Stocul se actualizează automat din recoltări și vânzări</div>
          </div>
        ) : null}

        {/* LIST */}
        {!isLoading && !isError && stocuri.length > 0 ? (
          <ResponsiveDataView
            columns={desktopColumns}
            data={desktopRows}
            mobileData={stocuri as StocRow[]}
            getRowId={(row) => row.id}
            getMobileRowId={(row) => `${row.locatie_id}-${row.produs}`}
            searchPlaceholder="Caută produs sau dată..."
            emptyMessage="Nu am găsit poziții de stoc pentru filtrele curente."
            renderCard={(row) => {
              const cardKey = `${row.locatie_id}-${row.produs}`
              return (
                <LocatieCard
                  row={row}
                  isExpanded={expandedId === cardKey}
                  onToggle={() => setExpandedId(expandedId === cardKey ? null : cardKey)}
                />
              )
            }}
          />
        ) : null}

      </div>
    </AppShell>
  )
}
