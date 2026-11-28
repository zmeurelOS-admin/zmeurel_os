'use client'

import { useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ChevronLeft, ChevronRight, ReceiptText, Search, Zap } from 'lucide-react'

import { AppShell } from '@/components/app/AppShell'
import { useDashboardAuth } from '@/components/app/DashboardAuthContext'
import { PageHeader } from '@/components/app/PageHeader'
import {
  BigInput,
  BottomSheet,
  Button,
  EmptyState,
  ListRow,
  Notice,
  Segments,
  StatTile,
  StatusPill,
  kitFocus,
  kitText,
} from '@/components/kit'
import { VanzareRapidaForm } from '@/components/vanzari/VanzareRapidaForm'
import { useVanzareFisa } from '@/components/vanzari/useVanzareFisa'
import { VanzariDesktop } from '@/components/vanzari/VanzariDesktop'
import { ComutatorVedere } from '@/components/comenzi/ComutatoareComenzi'
import { useIdDinUrl, useVedereDinUrl } from '@/lib/ui/useIdDinUrl'
import { track } from '@/lib/analytics/track'
import { useTrackModuleView } from '@/lib/analytics/useTrackModuleView'
import { groupByDay, isSameMonth, monthOfIso, shiftMonthRef, type MonthRef } from '@/lib/financial/view'
import {
  capitalizeRo,
  formatKg,
  formatLei,
  formatLeiKg,
  monthYearRo,
  relativeDayRo,
  shortDateRo,
  weekdayDateRo,
} from '@/lib/format-ro'
import { queryKeys } from '@/lib/query-keys'
import { useSchemaFeatures } from '@/lib/schema-features'
import { getClienți } from '@/lib/supabase/queries/clienti'
import { getComenzi } from '@/lib/supabase/queries/comenzi'
import { getVanzari } from '@/lib/supabase/queries/vanzari'
import { restDeIncasat } from '@/lib/vanzari/incasari'
import {
  buildVanzareRows,
  incasatInLuna,
  searchVanzari,
  sortVanzari,
  vanzariDinLuna,
  vanzariNeincasate,
  type VanzareRow,
} from '@/lib/vanzari/view'
import { useTodayIso } from '@/lib/ui/use-today-iso'
import { cn } from '@/lib/utils'

type Tab = 'toate' | 'neincasate'
function errorText(cause: unknown, fallback: string): string {
  return cause instanceof Error && cause.message ? cause.message : fallback
}

/**
 * Registrul de vânzări. Vânzările se creează singure la livrarea unei comenzi; de aici se marchează
 * încasările și se face o „Vânzare rapidă” (la poartă, la piață).
 */
export function VanzariPageClient() {
  useTrackModuleView('vanzari')

  const { memberRole, accessLevel } = useDashboardAuth()
  const canWrite = memberRole !== 'operator' || accessLevel === 'write'
  const todayIso = useTodayIso()
  const { vanzariPlataPartiala } = useSchemaFeatures()

  const [tab, setTab] = useState<Tab>(() =>
    typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('fila') === 'neincasate' ? 'neincasate' : 'toate',
  )
  const [monthOffset, setMonthOffset] = useState(0)
  const [query, setQuery] = useState('')
  const [rapidaOpen, setRapidaOpen] = useState(false)

  const [openedId, setOpenedId] = useState<string | null>(null)
  const [sheetOpen, setSheetOpen] = useState(false)
  // ─── Date ───
  const vanzariQuery = useQuery({
    queryKey: queryKeys.vanzari,
    queryFn: getVanzari,
    staleTime: 30000,
    refetchOnWindowFocus: false,
  })
  const { data: comenzi = [] } = useQuery({
    queryKey: queryKeys.comenzi,
    queryFn: () => getComenzi(),
    staleTime: 30000,
    refetchOnWindowFocus: false,
  })
  const { data: clienti = [] } = useQuery({
    queryKey: queryKeys.clienti,
    queryFn: getClienți,
    staleTime: 30000,
    refetchOnWindowFocus: false,
  })

  const rows = useMemo(
    () => sortVanzari(buildVanzareRows(vanzariQuery.data ?? [], clienti, comenzi)),
    [vanzariQuery.data, clienti, comenzi],
  )

  // ─── Perioada ───
  const currentMonth = useMemo<MonthRef | null>(() => (todayIso ? monthOfIso(todayIso) : null), [todayIso])
  const month = useMemo(() => (currentMonth ? shiftMonthRef(currentMonth, monthOffset) : null), [currentMonth, monthOffset])
  const monthLabel = month ? monthYearRo(month.year, month.month) : ''
  const atPresent = Boolean(month && currentMonth && isSameMonth(month, currentMonth))

  const incasat = useMemo(() => (month ? incasatInLuna(rows, month) : { lei: 0, kg: 0, count: 0 }), [rows, month])
  const rest = useMemo(() => restDeIncasat(rows), [rows])
  const neincasate = useMemo(() => vanzariNeincasate(rows), [rows])
  const monthRows = useMemo(() => (month ? vanzariDinLuna(rows, month) : []), [rows, month])

  const tabRows = tab === 'neincasate' ? neincasate : monthRows
  const visible = useMemo(() => searchVanzari(tabRows, query), [tabRows, query])
  const days = useMemo(() => groupByDay(visible), [visible])
  const opened = openedId ? (rows.find((row) => row.id === openedId) ?? null) : null

  useEffect(() => {
    const text = query.trim()
    if (!text) return
    const timer = setTimeout(() => track('search', { module: 'vanzari', query: text }), 500)
    return () => clearTimeout(timer)
  }, [query])

  // ─── Foaia unei vânzări ───
  const openRow = (row: VanzareRow) => {
    setOpenedId(row.id)
    setSheetOpen(true)
  }
  // Conținutul foii (promptul 35, §8: același în fișa de desktop), în `useVanzareFisa`.
  const fisa = useVanzareFisa({ activ: sheetOpen, vanzare: opened, todayIso, canWrite, vanzariPlataPartiala, onClose: () => setSheetOpen(false) })

  const loading = todayIso === null || vanzariQuery.isLoading
  // Desktop (promptul 35, §8): vânzarea aleasă și vederea, în adresă.
  const [idAles, alegeId] = useIdDinUrl()
  const [vedere, setVedere] = useVedereDinUrl()

  const navLuna = (
    <div className="flex items-center gap-2">
      <Button type="button" variant="neutral" size="icon-touch" aria-label="Luna dinainte" onClick={() => setMonthOffset((value) => value - 1)}>
        <ChevronLeft aria-hidden />
      </Button>
      <p className={cn('min-w-0 flex-1 truncate text-center font-extrabold text-fg', kitText.card)} aria-live="polite">
        {monthLabel ? capitalizeRo(monthLabel) : '…'}
      </p>
      <Button
        type="button"
        variant="neutral"
        size="icon-touch"
        aria-label="Luna următoare"
        disabled={atPresent}
        onClick={() => setMonthOffset((value) => value + 1)}
      >
        <ChevronRight aria-hidden />
      </Button>
    </div>
  )

  const rapidaButton = (
    <Button type="button" variant="primary" size="touch-lg" className="w-full" onClick={() => setRapidaOpen(true)}>
      <Zap aria-hidden />
      Vânzare rapidă
    </Button>
  )

  return (
    <AppShell
      header={
        <PageHeader
          title="Vânzări"
          subtitle={monthLabel ? capitalizeRo(monthLabel) : undefined}
          contentVariant="workspace"
          actiune={canWrite && todayIso ? { label: 'Vânzare rapidă', onClick: () => setRapidaOpen(true), icon: <Zap aria-hidden /> } : null}
          comutatoare={<ComutatorVedere vedere={vedere} onVedere={setVedere} />}
        />
      }
      bottomBarFixed
      bottomBar={
        // Butonul mare ține locul butonului plutitor (+).
        canWrite && todayIso ? (
          <div className="mx-auto w-full max-w-md px-4">
            <div className="rounded-box shadow-2">{rapidaButton}</div>
          </div>
        ) : undefined
      }
    >
      {!loading && todayIso ? (
        <div className="mx-auto hidden w-full max-w-modul pt-3 lg:block">
          <VanzariDesktop
            randuri={tabRows}
            todayIso={todayIso}
            canWrite={canWrite}
            vanzariPlataPartiala={vanzariPlataPartiala}
            vedere={vedere}
            idAles={idAles}
            onAlege={(id, { push }) => alegeId(id, { push })}
            onDeschideDinTabel={(id) => {
              setVedere('lista')
              alegeId(id, { push: true })
            }}
            sus={
              <div className="flex flex-wrap items-center gap-2">
                <div className="w-[300px]">{navLuna}</div>
                <Segments<Tab>
                  aria-label="Ce vânzări arăt"
                  value={tab}
                  onValueChange={setTab}
                  options={[
                    { value: 'toate', label: 'Luna' },
                    { value: 'neincasate', label: 'Neîncasate', count: rest.count },
                  ]}
                  className="w-[260px]"
                />
              </div>
            }
          />
        </div>
      ) : null}
      <div className={cn('mx-auto w-full max-w-modul space-y-4 pt-3', !loading && todayIso && 'lg:hidden')}>
        {/* Luna: schimbă cardul „Încasat” și lista „Toate”. */}
        {navLuna}

        {vanzariQuery.isError ? (
          <Notice
            tone="danger"
            title="Vânzările nu s-au încărcat"
            action={
              <Button type="button" variant="neutral" size="touch" loading={vanzariQuery.isRefetching} onClick={() => void vanzariQuery.refetch()}>
                Reîncearcă
              </Button>
            }
          >
            {errorText(vanzariQuery.error, 'Verifică internetul și încearcă din nou.')}
          </Notice>
        ) : null}

        <div className="grid grid-cols-2 gap-2.5">
          <StatTile
            tone="inverse"
            value={formatLei(incasat.lei)}
            label={`Încasat în ${monthLabel.split(' ')[0] || 'lună'} · ${formatKg(incasat.kg)} · ${incasat.count} ${incasat.count === 1 ? 'vânzare' : 'vânzări'}`}
          />
          {rest.count > 0 ? (
            <button
              type="button"
              className={cn('min-w-0 rounded-box text-left', kitFocus)}
              aria-label={`Neîncasat: ${formatLei(rest.lei)}, ${rest.count} ${rest.count === 1 ? 'vânzare' : 'vânzări'}. Vezi-le`}
              onClick={() => setTab('neincasate')}
            >
              <StatTile
                tone="warning"
                className="h-full"
                value={formatLei(rest.lei)}
                label={`Neîncasat · ${rest.count} ${rest.count === 1 ? 'vânzare' : 'vânzări'} · vezi`}
              />
            </button>
          ) : (
            <StatTile value={formatLei(0)} label="Neîncasat · totul e încasat" />
          )}
        </div>

        {canWrite ? <div className="hidden md:block lg:hidden">{rapidaButton}</div> : null}

        <Segments<Tab>
          aria-label="Ce vânzări arăt"
          panelId="vanzari-lista"
          value={tab}
          onValueChange={setTab}
          options={[
            { value: 'toate', label: 'Toate' },
            { value: 'neincasate', label: 'Neîncasate', count: rest.count },
          ]}
        />

        {tabRows.length > 5 ? (
          <BigInput
            aria-label="Caută după client"
            placeholder="Caută după client"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            leading={<Search aria-hidden />}
            autoComplete="off"
            autoCorrect="off"
            enterKeyHint="search"
          />
        ) : null}

        <section id="vanzari-lista" role="tabpanel" aria-label={tab === 'neincasate' ? 'Vânzări neîncasate' : 'Toate vânzările lunii'} className="space-y-4">
          {tab === 'neincasate' && neincasate.length > 0 ? (
            <p className={cn('px-1 text-fg-muted', kitText.secondary)}>Din toate lunile, cele mai noi întâi.</p>
          ) : null}

          {loading ? (
            <div className="space-y-2" aria-busy="true" aria-label="Se încarcă">
              <div className="h-[68px] animate-pulse rounded-box bg-surface-muted" />
              <div className="h-[68px] animate-pulse rounded-box bg-surface-muted" />
            </div>
          ) : visible.length === 0 ? (
            query.trim() ? (
              <EmptyState icon={<Search />} title="Nicio vânzare găsită" description="Verifică numele clientului." />
            ) : tab === 'neincasate' ? (
              <EmptyState icon={<ReceiptText />} title="Totul e încasat" description="Nu ai nimic de primit de la clienți." />
            ) : (
              <EmptyState
                icon={<ReceiptText />}
                title="Nicio vânzare în această lună"
                description="Vânzările apar singure când livrezi o comandă. La poartă sau la piață, folosește „Vânzare rapidă”."
              />
            )
          ) : (
            days.map((day) => (
              <section key={day.day} aria-label={weekdayDateRo(day.day)} className="space-y-2">
                <h3 className={cn('px-1 font-bold text-fg-muted', kitText.secondary)}>
                  {todayIso ? capitalizeRo(relativeDayRo(day.day, todayIso)) : shortDateRo(day.day)}
                </h3>
                <ul className="space-y-2">
                  {day.rows.map((row) => (
                    <li key={row.id}>
                      <ListRow
                        title={row.clientNume}
                        detail={
                          row.primit > 0 && !row.incasata
                            ? `A dat ${formatLei(row.primit)} · rest ${formatLei(row.rest)}`
                            : `${formatKg(Number(row.cantitate_kg) || 0)} × ${formatLeiKg(Number(row.pret_lei_kg) || 0)}`
                        }
                        onClick={() => openRow(row)}
                        chevron={false}
                        aria-label={`${row.clientNume}, ${formatLei(row.total)}, ${row.incasata ? 'încasat' : 'neîncasat'}. Deschide`}
                        trailing={
                          <span className="flex flex-col items-end gap-1">
                            <span className={cn('font-extrabold text-fg', kitText.base)}>{formatLei(row.total)}</span>
                            <StatusPill tone={row.incasata ? 'success' : 'warning'}>{row.incasata ? 'Încasat' : 'Neîncasat'}</StatusPill>
                          </span>
                        }
                      />
                    </li>
                  ))}
                </ul>
              </section>
            ))
          )}
        </section>
      </div>

      {todayIso ? (
        <VanzareRapidaForm open={rapidaOpen} onOpenChange={setRapidaOpen} todayIso={todayIso} clienti={clienti} comenzi={comenzi} />
      ) : null}

      <BottomSheet open={sheetOpen} onOpenChange={setSheetOpen} title={fisa?.title ?? 'Vânzare'} description={fisa?.description}>
        {fisa?.content ?? null}
      </BottomSheet>
    </AppShell>
  )
}
