'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { ChevronLeft, ChevronRight, MessageCircle, Phone, ReceiptText, Search, ShoppingBasket, Zap } from 'lucide-react'

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
  SummaryList,
  SummaryRow,
  buttonVariants,
  kitFocus,
  kitText,
  parseDecimal,
} from '@/components/kit'
import { VanzareRapidaForm } from '@/components/vanzari/VanzareRapidaForm'
import { track } from '@/lib/analytics/track'
import { useTrackModuleView } from '@/lib/analytics/useTrackModuleView'
import { phoneForLinks } from '@/lib/comenzi/display'
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
import { generateClientId } from '@/lib/offline/generateClientId'
import { adaugaPlataVanzare, getVanzari, setVanzareStatusPlata } from '@/lib/supabase/queries/vanzari'
import { aplicaPlata, restDeIncasat } from '@/lib/vanzari/incasari'
import {
  buildVanzareRows,
  incasatInLuna,
  searchVanzari,
  sortVanzari,
  vanzariDinLuna,
  vanzariNeincasate,
  type VanzareRow,
} from '@/lib/vanzari/view'
import { toast } from '@/lib/ui/toast'
import { useTodayIso } from '@/lib/ui/use-today-iso'
import { cn } from '@/lib/utils'

type Tab = 'toate' | 'neincasate'
type SheetView = 'detalii' | 'parte'

/** Vânzările care depind de o plată: registrul, comenzile (statusul plății) și Acasă. */
const PAYMENT_INVALIDATED = [queryKeys.vanzari, queryKeys.comenzi, queryKeys.dashboard] as const

function errorText(cause: unknown, fallback: string): string {
  return cause instanceof Error && cause.message ? cause.message : fallback
}

/**
 * Registrul de vânzări. Vânzările se creează singure la livrarea unei comenzi; de aici se marchează
 * încasările și se face o „Vânzare rapidă” (la poartă, la piață).
 */
export function VanzariPageClient() {
  useTrackModuleView('vanzari')

  const router = useRouter()
  const queryClient = useQueryClient()
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
  const [sheetView, setSheetView] = useState<SheetView>('detalii')
  const [parteText, setParteText] = useState('')
  // Cheia plății: una pe deschiderea „Cât a dat acum”, păstrată la reîncercare (nu se adună de două ori).
  const plataIdRef = useRef<string | null>(null)
  const [busy, setBusy] = useState<'incasat' | 'neincasat' | 'parte' | null>(null)
  const [sheetError, setSheetError] = useState<string | null>(null)

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
  const currentMonth: MonthRef | null = todayIso ? monthOfIso(todayIso) : null
  const month = currentMonth ? shiftMonthRef(currentMonth, monthOffset) : null
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
    setSheetView('detalii')
    setParteText('')
    setSheetError(null)
    setSheetOpen(true)
  }

  const refreshPayments = () => {
    for (const queryKey of PAYMENT_INVALIDATED) void queryClient.invalidateQueries({ queryKey })
  }

  const markStatus = async (row: VanzareRow, status: 'platit' | 'restanta') => {
    if (busy || !todayIso) return
    setBusy(status === 'platit' ? 'incasat' : 'neincasat')
    setSheetError(null)
    try {
      await setVanzareStatusPlata(row.id, status, todayIso)
      toast.success(status === 'platit' ? `Încasat: ${formatLei(row.total)}` : 'Trecută ca neîncasată')
      setSheetOpen(false)
    } catch (cause) {
      setSheetError(errorText(cause, 'Nu s-a salvat. Verifică internetul și încearcă din nou.'))
    } finally {
      refreshPayments()
      setBusy(null)
    }
  }

  const parteLei = parseDecimal(parteText)
  const plataNoua = opened && parteLei !== null && todayIso ? aplicaPlata(opened, parteLei, todayIso) : null
  const parteValid = plataNoua !== null && plataNoua.ok

  const savePartial = async () => {
    if (busy || !opened || !parteValid || parteLei === null || !todayIso || !plataNoua?.ok) return
    if (!plataIdRef.current) plataIdRef.current = generateClientId()
    setBusy('parte')
    setSheetError(null)
    try {
      await adaugaPlataVanzare({ vanzareId: opened.id, sumaLei: parteLei, dataIso: todayIso, plataId: plataIdRef.current })
      plataIdRef.current = null
      toast.success(
        plataNoua.completeaza
          ? `Încasat tot: ${formatLei(opened.total)}`
          : `A dat ${formatLei(parteLei)} · rest ${formatLei(plataNoua.rest)}`,
      )
      if (plataNoua.completeaza) setSheetOpen(false)
      else setSheetView('detalii')
    } catch (cause) {
      setSheetError(errorText(cause, 'Nu s-a salvat. Verifică internetul și încearcă din nou.'))
    } finally {
      refreshPayments()
      setBusy(null)
    }
  }

  const loading = todayIso === null || vanzariQuery.isLoading
  const phone = opened ? phoneForLinks(opened.telefon) : null

  const rapidaButton = (
    <Button type="button" variant="primary" size="touch-lg" className="w-full" onClick={() => setRapidaOpen(true)}>
      <Zap aria-hidden />
      Vânzare rapidă
    </Button>
  )

  return (
    <AppShell
      header={<PageHeader title="Vânzări" subtitle={monthLabel ? capitalizeRo(monthLabel) : undefined} contentVariant="workspace" />}
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
      <div className="mx-auto w-full max-w-modul space-y-4 pt-3">
        {/* Luna: schimbă cardul „Încasat” și lista „Toate”. */}
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

        {canWrite ? <div className="hidden md:block">{rapidaButton}</div> : null}

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

      <BottomSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        title={sheetView === 'parte' ? 'Cât a dat acum?' : (opened?.clientNume ?? 'Vânzare')}
        description={
          opened
            ? sheetView === 'parte'
              ? `${opened.clientNume} · total ${formatLei(opened.total)}`
              : `${capitalizeRo(weekdayDateRo(opened.data))} · ${opened.rapida ? 'vânzare rapidă' : opened.comanda_id ? 'din comanda livrată' : 'vânzare directă'}`
            : undefined
        }
      >
        {opened ? (
          sheetView === 'parte' ? (
            <form
              className="space-y-4"
              onSubmit={(event) => {
                event.preventDefault()
                void savePartial()
              }}
            >
              {sheetError ? (
                <Notice tone="danger" title="Nu s-a salvat">
                  {sheetError}
                </Notice>
              ) : null}
              <BigInput
                label="Cât a dat acum"
                inputMode="decimal"
                autoComplete="off"
                enterKeyHint="done"
                placeholder="ex. 50"
                value={parteText}
                onChange={(event) => setParteText(event.target.value)}
                trailing={<span className={cn('font-bold text-fg-muted', kitText.base)}>lei</span>}
                error={plataNoua && !plataNoua.ok && parteText.trim() !== '' ? plataNoua.motiv : undefined}
                hint={`A dat până acum: ${formatLei(opened.primit)} · rest ${formatLei(opened.rest)}`}
              />
              {plataNoua?.ok ? (
                <p className={cn('text-fg-muted', kitText.secondary)}>
                  {plataNoua.completeaza
                    ? 'Cu asta a dat tot: vânzarea devine încasată azi.'
                    : `După plată: rest ${formatLei(plataNoua.rest)}. Vânzarea rămâne neîncasată până vine restul.`}
                </p>
              ) : null}
              <Button type="submit" variant="primary" size="touch-lg" className="w-full" loading={busy === 'parte'} disabled={!parteValid}>
                {parteValid && parteLei !== null ? `Notează ${formatLei(parteLei)}` : 'Notează suma'}
              </Button>
              <Button
                type="button"
                variant="neutral"
                size="touch-lg"
                className="w-full"
                onClick={() => {
                  setSheetError(null)
                  setSheetView('detalii')
                }}
              >
                Înapoi
              </Button>
            </form>
          ) : (
            <div className="space-y-4">
              <div className="flex">
                <StatusPill tone={opened.incasata ? 'success' : 'warning'}>
                  {opened.incasata
                    ? opened.data_incasare
                      ? `Încasat · ${shortDateRo(opened.data_incasare)}`
                      : 'Încasat'
                    : 'Neîncasat'}
                </StatusPill>
              </div>

              {sheetError ? (
                <Notice tone="danger" title="Nu s-a salvat">
                  {sheetError}
                </Notice>
              ) : null}

              <SummaryList>
                <SummaryRow label="Cantitate" value={formatKg(Number(opened.cantitate_kg) || 0)} />
                <SummaryRow label="Preț" value={formatLeiKg(Number(opened.pret_lei_kg) || 0)} />
                <SummaryRow label="Total" value={formatLei(opened.total)} />
                {!opened.incasata && opened.primit > 0 ? (
                  <>
                    <SummaryRow
                      label="A dat"
                      value={`${formatLei(opened.primit)}${opened.data_incasare_partiala ? ` · ${shortDateRo(opened.data_incasare_partiala)}` : ''}`}
                    />
                    <SummaryRow label="Rest de primit" value={formatLei(opened.rest)} />
                  </>
                ) : null}
              </SummaryList>

              <div className="flex flex-col gap-2.5">
                {canWrite && !opened.incasata ? (
                  <Button
                    type="button"
                    variant="primary"
                    size="touch-lg"
                    className="w-full"
                    loading={busy === 'incasat'}
                    disabled={busy !== null}
                    onClick={() => void markStatus(opened, 'platit')}
                  >
                    Marchează încasat azi
                  </Button>
                ) : null}
                {canWrite && !opened.incasata && vanzariPlataPartiala ? (
                  <Button
                    type="button"
                    variant="neutral"
                    size="touch"
                    className="w-full"
                    disabled={busy !== null}
                    onClick={() => {
                      setSheetError(null)
                      setParteText('')
                      plataIdRef.current = null
                      setSheetView('parte')
                    }}
                  >
                    A dat doar o parte…
                  </Button>
                ) : null}
                {phone ? (
                  <div className="grid grid-cols-2 gap-2.5">
                    <a href={`tel:${phone.tel}`} className={cn(buttonVariants({ variant: 'neutral', size: 'touch' }), 'w-full')}>
                      <Phone aria-hidden />
                      Sună clientul
                    </a>
                    <a
                      href={`https://wa.me/${phone.wa}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={cn(buttonVariants({ variant: 'neutral', size: 'touch' }), 'w-full')}
                    >
                      <MessageCircle aria-hidden />
                      WhatsApp
                    </a>
                  </div>
                ) : null}
                {opened.comanda_id && !opened.rapida ? (
                  <Button
                    type="button"
                    variant="neutral"
                    size="touch"
                    className="w-full"
                    onClick={() => {
                      setSheetOpen(false)
                      router.push('/comenzi?filter=livrate')
                    }}
                  >
                    <ShoppingBasket aria-hidden />
                    Vezi comanda
                  </Button>
                ) : null}
                {canWrite && opened.incasata ? (
                  <Button
                    type="button"
                    variant="quiet"
                    size="touch"
                    className="w-full"
                    loading={busy === 'neincasat'}
                    disabled={busy !== null}
                    onClick={() => void markStatus(opened, 'restanta')}
                  >
                    Marchează neîncasat
                  </Button>
                ) : null}
              </div>
            </div>
          )
        ) : null}
      </BottomSheet>
    </AppShell>
  )
}
