'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Check,
  ChevronDown,
  ChevronUp,
  Ellipsis,
  Flag,
  ListOrdered,
  MapPinned,
  Navigation,
  Phone,
  PhoneMissed,
  RefreshCw,
  Truck,
} from 'lucide-react'

import { AppShell } from '@/components/app/AppShell'
import { useDashboardAuth } from '@/components/app/DashboardAuthContext'
import { PageHeader } from '@/components/app/PageHeader'
import {
  ActionCard,
  ActionCardChip,
  BottomSheet,
  Button,
  EmptyState,
  ListRow,
  Notice,
  ProgressBar,
  Segments,
  StatTile,
  StatusPill,
  buttonVariants,
  kitText,
  longDayRo,
} from '@/components/kit'
import { AranjeazaTraseu } from '@/components/livrari/AranjeazaTraseu'
import { StopSheet, type RouteStop, type StopSheetEntry } from '@/components/livrari/StopSheet'
import { ComandaFisa } from '@/components/comenzi/ComandaFisa'
import { ComutatorComenziLivrari } from '@/components/comenzi/ComutatoareComenzi'
import { useEsteDesktop } from '@/lib/ui/useEsteDesktop'
import { useIdDinUrl } from '@/lib/ui/useIdDinUrl'
import { useRouter } from 'next/navigation'
import { elementAles } from '@/components/kit'
import { useTrackModuleView } from '@/lib/analytics/useTrackModuleView'
import { bucketOfComanda } from '@/lib/comenzi/day-view'
import { comandaClientName, comandaNeincasata, comandaNota, comandaTelefon, phoneForLinks } from '@/lib/comenzi/display'
import { capitalizeRo, formatKg, formatLei, formatNumber } from '@/lib/format-ro'
import { OptimizeRouteError, getDevicePosition, requestOptimizedRoute } from '@/lib/livrari/device'
import { readNavApp, readNoAnswerTime, writeNavApp, writeNoAnswerTime } from '@/lib/livrari/prefs'
import {
  applyOptimizedOrder,
  clientLocation,
  deliveredToday,
  leiDeIncasat,
  mapsBatches,
  mapsRouteUrl,
  moveStop,
  moveStopToEnd,
  navigateUrl,
  routeProgress,
  routeStops,
  type NavApp,
} from '@/lib/livrari/route'
import { queryKeys } from '@/lib/query-keys'
import { useSchemaFeatures } from '@/lib/schema-features'
import { getClienți } from '@/lib/supabase/queries/clienti'
import { getComenzi, updateOrdineLivrare, type Comanda } from '@/lib/supabase/queries/comenzi'
import { toast } from '@/lib/ui/toast'
import { useTodayIso } from '@/lib/ui/use-today-iso'
import { cn } from '@/lib/utils'

type OptimizeMessage = { tone: 'success' | 'warning' | 'danger'; title: string; text?: string }

/** Cât trebuie să fi stat aplicația în fundal ca întoarcerea să fie luată drept „am terminat apelul”. */
const MIN_CALL_MS = 1500

/**
 * Livrări, ecranul din mașină: progresul zilei, următoarea oprire mare (Sună / Navighează / Livrat),
 * restul opririlor în ordinea drumului și cele livrate, strânse într-un rând.
 */
export function LivrariPageClient() {
  useTrackModuleView('livrari')

  const queryClient = useQueryClient()
  const { memberRole, accessLevel } = useDashboardAuth()
  const canWrite = memberRole !== 'operator' || accessLevel === 'write'
  const features = useSchemaFeatures()
  const todayIso = useTodayIso()

  // Desktop (promptul 35, §5): oprirea aleasă (`?id=`) are fișa comenzii în dreapta.
  const esteDesktop = useEsteDesktop()
  const router = useRouter()
  const [idAles, alegeId] = useIdDinUrl()
  const [sheet, setSheet] = useState<{ stop: RouteStop; entry: StopSheetEntry } | null>(null)
  const [sheetOpen, setSheetOpen] = useState(false)
  const [arranging, setArranging] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [deliveredOpen, setDeliveredOpen] = useState(false)
  const [navApp, setNavApp] = useState<NavApp>(() => (typeof window === 'undefined' ? 'google' : readNavApp()))
  const [noAnswerVersion, setNoAnswerVersion] = useState(0)
  const [optimizing, setOptimizing] = useState(false)
  const [optimizeMessage, setOptimizeMessage] = useState<OptimizeMessage | null>(null)
  const [mapsBatch, setMapsBatch] = useState<{ anchor: string; index: number }>({ anchor: '', index: 0 })

  // ─── Date ───
  const {
    data: comenzi = [],
    isLoading,
    isError,
    error,
    refetch,
    isFetching,
  } = useQuery({
    queryKey: queryKeys.comenzi,
    queryFn: getComenzi,
    staleTime: 30000,
    refetchOnWindowFocus: false,
  })
  const { data: clienti = [] } = useQuery({
    queryKey: queryKeys.clienti,
    queryFn: getClienți,
    staleTime: 30000,
    refetchOnWindowFocus: false,
  })

  const clientMap = useMemo(() => new Map(clienti.map((client) => [client.id, client])), [clienti])

  const stops = useMemo<RouteStop[]>(
    () =>
      routeStops(comenzi).map((comanda, index) => {
        const client = comanda.client_id ? clientMap.get(comanda.client_id) ?? null : null
        return {
          comanda,
          client,
          name: comandaClientName(comanda, clientMap),
          location: clientLocation(client),
          position: index + 1,
        }
      }),
    [clientMap, comenzi],
  )
  const delivered = useMemo(() => (todayIso ? deliveredToday(comenzi, todayIso) : []), [comenzi, todayIso])
  const opritAles = elementAles(stops, (stop) => stop.comanda.id, idAles)
  const progress = useMemo(() => routeProgress(stops.map((stop) => stop.comanda), delivered.length), [delivered.length, stops])
  const notInDelivery = useMemo(
    () =>
      todayIso
        ? comenzi.filter((comanda) => comanda.status !== 'in_livrare' && bucketOfComanda(comanda, todayIso) === 'azi')
        : [],
    [comenzi, todayIso],
  )

  const stopIdsKey = stops.map((stop) => stop.comanda.id).join(',')
  const noAnswerTimes = useMemo(() => {
    const times: Record<string, string | null> = {}
    // `noAnswerVersion` crește la fiecare scriere, ca orele să fie recitite din telefon.
    if (!todayIso || typeof window === 'undefined' || noAnswerVersion < 0) return times
    for (const id of stopIdsKey ? stopIdsKey.split(',') : []) times[id] = readNoAnswerTime(id, todayIso)
    return times
  }, [stopIdsKey, todayIso, noAnswerVersion])

  // ─── Ordinea pe drum ───
  const saveOrder = useCallback(
    (ids: string[]) => {
      // Optimist: ordinea se vede pe loc; la eroare, lista se reîncarcă de pe server.
      queryClient.setQueryData<Comanda[]>(queryKeys.comenzi, (current) => {
        if (!current) return current
        const position = new Map(ids.map((id, index) => [id, index]))
        return current.map((comanda) =>
          position.has(comanda.id) ? { ...comanda, ordine_livrare: position.get(comanda.id) ?? null } : comanda,
        )
      })
      updateOrdineLivrare(ids).catch((cause: unknown) => {
        toast.error(cause instanceof Error && cause.message ? cause.message : 'Ordinea nu s-a salvat.')
        void queryClient.invalidateQueries({ queryKey: queryKeys.comenzi })
      })
    },
    [queryClient],
  )

  const currentIds = useCallback(
    () => routeStops(queryClient.getQueryData<Comanda[]>(queryKeys.comenzi) ?? []).map((comanda) => comanda.id),
    [queryClient],
  )

  const handleMove = useCallback(
    (comandaId: string, direction: -1 | 1) => saveOrder(moveStop(currentIds(), comandaId, direction)),
    [currentIds, saveOrder],
  )
  const handleMoveToEnd = useCallback(
    (comandaId: string) => saveOrder(moveStopToEnd(currentIds(), comandaId)),
    [currentIds, saveOrder],
  )

  const locatedStops = stops.filter((stop) => stop.location !== null)
  const optimizeBlockedReason = !features.clientiLocatie
    ? 'Optimizarea are nevoie de locațiile clienților. Se activează după actualizarea bazei de date.'
    : locatedStops.length < 2
      ? 'Trebuie cel puțin două opriri cu locație salvată. Până atunci, aranjează cu săgețile.'
      : null

  const optimize = async () => {
    if (optimizing || optimizeBlockedReason) return
    setOptimizing(true)
    setOptimizeMessage(null)
    try {
      const start = await getDevicePosition()
      const result = await requestOptimizedRoute({
        start: { lat: start.lat, lng: start.lng },
        stops: locatedStops.map((stop) => ({ id: stop.comanda.id, lat: stop.location!.lat, lng: stop.location!.lng })),
      })
      const ids = stops.map((stop) => stop.comanda.id)
      saveOrder(applyOptimizedOrder(ids, result.order))
      const leftOut = ids.length - result.order.length
      setOptimizeMessage({
        tone: 'success',
        title: 'Traseu optimizat',
        text:
          leftOut > 0
            ? `${result.order.length} opriri așezate pe drum; ${leftOut} fără locație au rămas la final.`
            : `${result.order.length} opriri așezate pe drum, pornind de unde ești.`,
      })
    } catch (cause) {
      if (cause instanceof OptimizeRouteError && cause.code === 'ORS_NOT_CONFIGURED') {
        setOptimizeMessage({
          tone: 'warning',
          title: 'Optimizarea nu e configurată încă',
          text: 'Aranjează traseul cu săgețile.',
        })
      } else {
        setOptimizeMessage({
          tone: 'danger',
          title: 'Traseul nu s-a putut optimiza',
          text: cause instanceof Error ? cause.message : 'Aranjează traseul cu săgețile.',
        })
      }
    } finally {
      setOptimizing(false)
    }
  }

  // ─── Foaia unei opriri ───
  const openStop = useCallback(
    (stop: RouteStop, entry: StopSheetEntry) => {
      // Pe desktop, meniul opririi e fișa din dreapta; livrarea și apelul se deschid tot în foaie.
      if (esteDesktop && entry === 'meniu') {
        alegeId(stop.comanda.id, { push: true })
        return
      }
      setSheet({ stop, entry })
      setSheetOpen(true)
    },
    [alegeId, esteDesktop],
  )

  // Datele la zi ale opririi deschise. După livrare oprirea iese din traseu, dar foaia mai are nevoie de ea
  // (întrebarea despre locație vine chiar atunci): rămâne cea de la deschidere.
  const sheetStop = sheet ? stops.find((stop) => stop.comanda.id === sheet.stop.comanda.id) ?? sheet.stop : null

  // ─── Sună → „Cum a fost apelul?” la întoarcerea în aplicație ───
  const pendingCall = useRef<{ stop: RouteStop; at: number } | null>(null)
  const handleCall = useCallback((stop: RouteStop) => {
    const phone = phoneForLinks(comandaTelefon(stop.comanda, stop.client))
    if (!phone) return
    setSheetOpen(false)
    pendingCall.current = { stop, at: Date.now() }
    window.location.href = `tel:${phone.tel}`
  }, [])

  useEffect(() => {
    if (!canWrite) return
    const onVisible = () => {
      const call = pendingCall.current
      if (document.visibilityState !== 'visible' || !call) return
      if (Date.now() - call.at < MIN_CALL_MS) return
      pendingCall.current = null
      openStop(call.stop, 'apel')
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [canWrite, openStop])

  const handleNoAnswer = useCallback((comandaId: string, at: Date | null) => {
    writeNoAnswerTime(comandaId, at)
    setNoAnswerVersion((version) => version + 1)
  }, [])

  const chooseNavApp = (app: NavApp) => {
    setNavApp(app)
    writeNavApp(app)
  }

  // ─── „Pornește în Maps”: câte 9 opriri ───
  const batches = mapsBatches(stops)
  const anchor = stops[0]?.comanda.id ?? ''
  const batchIndex = mapsBatch.anchor === anchor ? Math.min(mapsBatch.index, Math.max(batches.length - 1, 0)) : 0
  const batch = batches[batchIndex] ?? []
  const batchUrl = mapsRouteUrl(batch.map((stop) => stop.location!).filter(Boolean))
  const batchFrom = batch[0]?.position
  const batchTo = batch[batch.length - 1]?.position

  const loading = todayIso === null || isLoading
  const next = stops[0] ?? null
  const rest = stops.slice(1)
  const deliveredLei = delivered.reduce((sum, comanda) => sum + leiDeIncasat(comanda), 0)

  let body: React.ReactNode
  if (isError) {
    body = (
      <Notice
        tone="danger"
        title="Livrările nu s-au încărcat"
        action={
          <Button type="button" variant="neutral" size="touch" loading={isFetching} onClick={() => void refetch()}>
            Reîncearcă
          </Button>
        }
      >
        {(error as Error | null)?.message || 'Verifică internetul și încearcă din nou.'}
      </Notice>
    )
  } else if (loading) {
    body = <PageSkeleton />
  } else if (arranging) {
    body = (
      <AranjeazaTraseu
        stops={stops}
        onMove={handleMove}
        onDone={() => {
          setArranging(false)
          setOptimizeMessage(null)
        }}
        optimizeBlockedReason={optimizeBlockedReason}
        optimizing={optimizing}
        onOptimize={() => void optimize()}
        optimizeMessage={optimizeMessage}
      />
    )
  } else if (stops.length === 0 && delivered.length === 0) {
    body = (
      <>
        <EmptyState
          icon={<Truck />}
          title="Nicio livrare în drum"
          description="Comenzile apar aici după ce le pui în livrare din Comenzi."
          action={
            <Link href="/comenzi" className={cn(buttonVariants({ variant: 'primary', size: 'touch' }), 'w-64 max-w-full')}>
              Deschide Comenzi
            </Link>
          }
        />
        {notInDelivery.length > 0 ? <NotInDeliveryNotice count={notInDelivery.length} /> : null}
      </>
    )
  } else {
    const nextLei = next ? leiDeIncasat(next.comanda) : 0
    const nextPhone = next ? phoneForLinks(comandaTelefon(next.comanda, next.client)) : null
    const nextNota = next ? comandaNota(next.comanda) : ''
    const nextNoAnswer = next?.comanda.last_call_status === 'no_answer'

    body = (
      <>
        <section aria-label="Progresul zilei" className="space-y-2.5 rounded-card border border-border bg-surface p-4 shadow-1">
          <ProgressBar
            label="Livrate azi"
            valueLabel={`${progress.deliveredCount} din ${progress.totalCount}`}
            value={progress.deliveredCount}
            max={Math.max(progress.totalCount, 1)}
            tone="success"
          />
          <div className="grid grid-cols-2 gap-2.5">
            <StatTile value={formatNumber(progress.kgRamase)} unit="kg" label="rămase de livrat" />
            <StatTile tone="inverse" value={formatLei(progress.leiDeIncasat)} label="de încasat" />
          </div>
        </section>

        {notInDelivery.length > 0 ? <NotInDeliveryNotice count={notInDelivery.length} /> : null}

        {next ? (
          <section aria-label="Următoarea oprire" className="space-y-2.5">
            <h2 className={cn('px-1 font-extrabold text-fg', kitText.card)}>Următoarea oprire</h2>
            <ActionCard
              emphasis="hero"
              leading={next.position}
              title={<span className="line-clamp-2 break-words">{next.name}</span>}
              meta={<span className="line-clamp-3 break-words">{next.comanda.locatie_livrare?.trim() || next.client?.adresa?.trim() || 'Fără adresă'}</span>}
              amount={nextLei > 0 ? formatLei(nextLei) : formatKg(next.comanda.cantitate_kg)}
              amountLabel={nextLei > 0 ? 'de încasat' : 'fără bani'}
              pills={
                <>
                  <ActionCardChip>{formatKg(next.comanda.cantitate_kg)}</ActionCardChip>
                  {next.comanda.prioritara ? (
                    <StatusPill tone="warning" icon={<Flag aria-hidden />}>
                      Prioritară
                    </StatusPill>
                  ) : null}
                  {nextNoAnswer ? (
                    <StatusPill tone="warning" icon={<PhoneMissed aria-hidden />}>
                      {noAnswerTimes[next.comanda.id] ? `N-a răspuns · ${noAnswerTimes[next.comanda.id]}` : 'N-a răspuns'}
                    </StatusPill>
                  ) : null}
                </>
              }
              note={nextNota || undefined}
              secondaryActions={[
                {
                  label: 'Sună',
                  icon: <Phone aria-hidden />,
                  onClick: () => handleCall(next),
                  disabled: !nextPhone,
                  disabledReason: 'fără telefon',
                },
                {
                  label: navApp === 'waze' ? 'Waze' : 'Navighează',
                  icon: <Navigation aria-hidden />,
                  onClick: () => {
                    if (next.location) window.open(navigateUrl(next.location, navApp), '_blank', 'noopener,noreferrer')
                  },
                  disabled: !next.location,
                  disabledReason: 'fără locație încă',
                },
              ]}
              action={
                canWrite
                  ? { label: 'Livrat', icon: <Check aria-hidden />, onClick: () => openStop(next, 'livrat') }
                  : undefined
              }
            />
            <Button
              type="button"
              variant="neutral"
              size="touch"
              className="w-full"
              aria-label={`Mai multe pentru oprirea ${next.name}: nu a răspuns, mută, copiază`}
              onClick={() => openStop(next, 'meniu')}
            >
              <Ellipsis aria-hidden />
              Mai multe pentru această oprire
            </Button>
          </section>
        ) : (
          <Notice tone="success" title="Traseul e gata">
            {delivered.length} {delivered.length === 1 ? 'livrare făcută' : 'livrări făcute'} azi.
          </Notice>
        )}

        {stops.length > 0 ? (
          <div className="space-y-2">
            {batchUrl ? (
              <a
                href={batchUrl}
                target="_blank"
                rel="noopener noreferrer"
                className={cn(buttonVariants({ variant: 'neutral', size: 'touch-lg' }), 'w-full')}
                onClick={() => {
                  // După deschidere, butonul trece la următoarele 9 (dacă mai sunt).
                  if (batchIndex + 1 < batches.length) setMapsBatch({ anchor, index: batchIndex + 1 })
                }}
              >
                <MapPinned aria-hidden />
                {batches.length > 1
                  ? `Pornește în Maps: opririle ${batchFrom}–${batchTo}`
                  : `Pornește în Maps (${batch.length} ${batch.length === 1 ? 'oprire' : 'opriri'})`}
              </a>
            ) : (
              <Button type="button" variant="neutral" size="touch-lg" className="w-full" disabled aria-describedby="maps-fara-locatii">
                <MapPinned aria-hidden />
                Pornește în Maps
              </Button>
            )}
            <p id="maps-fara-locatii" className={cn('px-1 text-fg-muted', kitText.helper)}>
              {batchUrl
                ? batches.length > 1
                  ? `Google Maps primește câte 9 opriri. Grupul ${batchIndex + 1} din ${batches.length}.`
                  : locatedStops.length < stops.length
                    ? `${stops.length - locatedStops.length} ${stops.length - locatedStops.length === 1 ? 'oprire nu are' : 'opriri nu au'} locație și nu intră în traseu.`
                    : 'Traseul pornește de unde ești.'
                : 'Nicio oprire nu are locație salvată încă.'}
            </p>
            {batches.length > 1 && batchIndex > 0 ? (
              <Button type="button" variant="quiet" size="touch" className="w-full" onClick={() => setMapsBatch({ anchor, index: 0 })}>
                Înapoi la primele 9
              </Button>
            ) : null}

            <div className="flex gap-2.5">
              {canWrite && stops.length > 1 ? (
                <Button type="button" variant="neutral" size="touch" className="min-w-0 flex-1" onClick={() => setArranging(true)}>
                  <ListOrdered aria-hidden />
                  <span className="truncate">Aranjează traseul</span>
                </Button>
              ) : null}
              <Button
                type="button"
                variant="neutral"
                size={canWrite && stops.length > 1 ? 'icon-touch' : 'touch'}
                className={canWrite && stops.length > 1 ? 'shrink-0' : 'flex-1'}
                aria-label="Setările traseului: aplicația de navigare, reîncărcare"
                onClick={() => setMenuOpen(true)}
              >
                <Ellipsis aria-hidden />
                {canWrite && stops.length > 1 ? null : 'Setările traseului'}
              </Button>
            </div>
          </div>
        ) : null}

        {rest.length > 0 ? (
          <section aria-labelledby="livrari-urmatoarele" className="space-y-2">
            <h2 id="livrari-urmatoarele" className={cn('px-1 font-extrabold text-fg', kitText.card)}>
              Apoi ({rest.length})
            </h2>
            <ul className="space-y-2">
              {rest.map((stop) => {
                const lei = leiDeIncasat(stop.comanda)
                const noAnswer = stop.comanda.last_call_status === 'no_answer'
                return (
                  <li key={stop.comanda.id}>
                    <ListRow
                      avatar={false}
                      leading={<StopNumber>{stop.position}</StopNumber>}
                      title={stop.name}
                      detail={[
                        noAnswer
                          ? noAnswerTimes[stop.comanda.id]
                            ? `N-a răspuns ${noAnswerTimes[stop.comanda.id]}`
                            : 'N-a răspuns'
                          : null,
                        stop.comanda.locatie_livrare?.trim() || stop.client?.adresa?.trim() || 'Fără adresă',
                      ]
                        .filter(Boolean)
                        .join(' · ')}
                      onClick={() => openStop(stop, 'meniu')}
                      chevron={false}
                      aria-label={`Oprirea ${stop.position}: ${stop.name}, ${formatKg(stop.comanda.cantitate_kg)}${lei > 0 ? `, ${formatLei(lei)} de încasat` : ''}. Deschide`}
                      trailing={
                        <span className="flex flex-col items-end">
                          <span className={cn('font-extrabold text-fg', kitText.base)}>{formatKg(stop.comanda.cantitate_kg)}</span>
                          <span className={cn('text-fg-muted', kitText.secondary)}>{lei > 0 ? formatLei(lei) : 'fără bani'}</span>
                        </span>
                      }
                    />
                  </li>
                )
              })}
            </ul>
          </section>
        ) : null}

        {delivered.length > 0 ? (
          <section aria-label="Livrate azi" className="space-y-2">
            <button
              type="button"
              aria-expanded={deliveredOpen}
              onClick={() => setDeliveredOpen((value) => !value)}
              className="flex min-h-touch-lg w-full items-center gap-3 rounded-box border border-success-border bg-success-bg px-4 py-2 text-left text-success-text outline-none focus-visible:ring-[3px] focus-visible:ring-primary/40"
            >
              <Check aria-hidden className="size-5 shrink-0" />
              <span className={cn('min-w-0 flex-1 font-bold', kitText.base)}>
                {delivered.length} {delivered.length === 1 ? 'livrată' : 'livrate'} azi
                {deliveredLei > 0 ? ` · ${formatLei(deliveredLei)}` : ''}
              </span>
              {deliveredOpen ? <ChevronUp aria-hidden className="size-5 shrink-0" /> : <ChevronDown aria-hidden className="size-5 shrink-0" />}
            </button>
            {deliveredOpen ? (
              <ul className="space-y-2">
                {delivered.map((comanda) => (
                  <li
                    key={comanda.id}
                    className="flex min-h-touch items-center justify-between gap-3 rounded-box border border-border bg-surface px-4 py-2"
                  >
                    <span className={cn('min-w-0 truncate font-semibold text-fg', kitText.secondary)}>
                      {comandaClientName(comanda, clientMap)}
                    </span>
                    <span className={cn('shrink-0 text-fg-muted', kitText.secondary)}>
                      {formatKg(comanda.cantitate_kg)}
                      {comandaNeincasata(comanda) ? ' · neîncasat' : ''}
                    </span>
                  </li>
                ))}
              </ul>
            ) : null}
          </section>
        ) : null}
      </>
    )
  }

  return (
    <AppShell
      header={
        <PageHeader
          title={arranging ? 'Aranjează traseul' : 'Livrări'}
          subtitle={todayIso ? capitalizeRo(longDayRo(todayIso)) : undefined}
          contentVariant="workspace"
          comutatoare={<ComutatorComenziLivrari activ="livrari" />}
        />
      }
    >
      {/* Pe desktop: traseul în stânga (aceeași listă), fișa comenzii alese în dreapta. */}
      <div className="mx-auto w-full max-w-modul pt-3 lg:grid lg:grid-cols-[440px_minmax(0,1fr)] lg:items-start lg:gap-4">
        <div className="space-y-4">{body}</div>
        {opritAles && todayIso ? (
          <div className="hidden min-w-0 lg:block">
            <ComandaFisa
              key={opritAles.comanda.id}
              comanda={opritAles.comanda}
              comenzi={comenzi}
              clientName={opritAles.name}
              numeClient={(comanda) => comandaClientName(comanda, clientMap)}
              clientTelefon={opritAles.client?.telefon ?? null}
              todayIso={todayIso}
              canWrite={canWrite}
              canDelete={memberRole !== 'operator'}
              hasPrioritara={features.comenziPrioritara}
              onEdit={(comanda) => router.push(`/comenzi?edit=${comanda.id}`)}
              onAlege={(id) => alegeId(id, { push: true })}
            />
          </div>
        ) : (
          <div className="hidden min-w-0 lg:block">
            <EmptyState
              icon={<Truck />}
              title="Nicio comandă în livrare acum"
              description="Pune comenzile de azi în livrare din Comenzi; fișa celei alese apare aici."
            />
          </div>
        )}
      </div>

      {todayIso ? (
        <StopSheet
          open={sheetOpen}
          onOpenChange={setSheetOpen}
          stop={sheetStop}
          entry={sheet?.entry ?? 'meniu'}
          todayIso={todayIso}
          canWrite={canWrite}
          hasLocatie={features.clientiLocatie}
          hasPlataPartiala={features.vanzariPlataPartiala}
          navApp={navApp}
          noAnswerTime={sheetStop ? noAnswerTimes[sheetStop.comanda.id] ?? null : null}
          onCall={handleCall}
          onNoAnswer={handleNoAnswer}
          onMoveToEnd={handleMoveToEnd}
        />
      ) : null}

      <BottomSheet open={menuOpen} onOpenChange={setMenuOpen} title="Setările traseului">
        <div className="space-y-4">
          <div className="space-y-2">
            <p className={cn('px-1 font-bold text-fg', kitText.secondary)}>„Navighează” la o oprire deschide</p>
            <Segments<NavApp>
              aria-label="Aplicația de navigare pentru o singură oprire"
              value={navApp}
              onValueChange={chooseNavApp}
              options={[
                { value: 'google', label: 'Google Maps' },
                { value: 'waze', label: 'Waze' },
              ]}
            />
            <p className={cn('px-1 text-fg-muted', kitText.helper)}>
              „Pornește în Maps” (mai multe opriri) merge doar cu Google Maps.
            </p>
          </div>
          <Button
            type="button"
            variant="neutral"
            size="touch"
            className="w-full"
            loading={isFetching}
            onClick={() => {
              void refetch()
              void queryClient.invalidateQueries({ queryKey: queryKeys.clienti })
            }}
          >
            <RefreshCw aria-hidden />
            Reîncarcă livrările
          </Button>
          <Link href="/comenzi" className={cn(buttonVariants({ variant: 'neutral', size: 'touch' }), 'w-full')}>
            Deschide Comenzi
          </Link>
        </div>
      </BottomSheet>
    </AppShell>
  )
}

function StopNumber({ children }: { children: React.ReactNode }) {
  return (
    <span
      className={cn(
        'flex size-11 shrink-0 items-center justify-center rounded-full bg-surface-muted font-extrabold text-fg',
        kitText.base,
      )}
      aria-hidden
    >
      {children}
    </span>
  )
}

function NotInDeliveryNotice({ count }: { count: number }) {
  return (
    <Notice
      tone="info"
      title={`${count} ${count === 1 ? 'comandă de azi nu e' : 'comenzi de azi nu sunt'} încă în livrare`}
      action={
        // Text scurt: un buton mai lat decât cardul ar împinge toată pagina în afara ecranului.
        <Link href="/comenzi" className={buttonVariants({ variant: 'neutral', size: 'touch' })}>
          Deschide Comenzi
        </Link>
      }
    >
      Le pui în livrare din Comenzi, cu „Pune în livrare azi”.
    </Notice>
  )
}

function PageSkeleton() {
  return (
    <div className="space-y-4" aria-busy="true" aria-label="Se încarcă livrările">
      <div className="h-36 animate-pulse rounded-card bg-surface-muted" />
      <div className="h-72 animate-pulse rounded-card bg-surface-muted" />
      <div className="space-y-2">
        <div className="h-[68px] animate-pulse rounded-box bg-surface-muted" />
        <div className="h-[68px] animate-pulse rounded-box bg-surface-muted" />
      </div>
    </div>
  )
}
