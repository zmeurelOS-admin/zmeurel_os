'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import dynamic from 'next/dynamic'
import { useQuery } from '@tanstack/react-query'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { ArrowLeft, ClipboardList, Ellipsis, Flag, MessageSquareText, Plus, Search, Truck } from 'lucide-react'

import { AppShell } from '@/components/app/AppShell'
import { useDashboardAuth } from '@/components/app/DashboardAuthContext'
import { PageHeader } from '@/components/app/PageHeader'
import { ComandaCard } from '@/components/comenzi/ComandaCard'
import { ComandaSheet } from '@/components/comenzi/ComandaSheet'
import { ComandaStepForm, type ComandaPrefill } from '@/components/comenzi/ComandaStepForm'
import { ComenziDesktop } from '@/components/comenzi/ComenziDesktop'
import { ComutatorComenziLivrari, ComutatorVedere } from '@/components/comenzi/ComutatoareComenzi'
import { PuneInLivrareSheet } from '@/components/comenzi/PuneInLivrareSheet'
import {
  BigInput,
  BottomSheet,
  Button,
  EmptyState,
  FilterPills,
  ListRow,
  Notice,
  Segments,
  StatTile,
  kitText,
  longDayRo,
} from '@/components/kit'
import { track } from '@/lib/analytics/track'
import { useTrackModuleView } from '@/lib/analytics/useTrackModuleView'
import {
  deliveryCandidates,
  groupComenziByDay,
  splitComenziByBucket,
  summarizeComenzi,
  type ComenziBucket,
} from '@/lib/comenzi/day-view'
import { comandaClientName, comandaNeincasata, comandaRestDeIncasat } from '@/lib/comenzi/display'
import { esteNeincasataPeste30, textNeincasatePeste30 } from '@/lib/notifications/zilnice/neincasate-30'
import {
  capitalizeRo,
  formatKg,
  formatLei,
  formatNumber,
  phoneDigits,
  searchKey,
  weekdayDateRo,
} from '@/lib/format-ro'
import { queryKeys } from '@/lib/query-keys'
import { useSchemaFeatures } from '@/lib/schema-features'
import { getClienți } from '@/lib/supabase/queries/clienti'
import { getComenzi, getComenziStockSummaryAzi, type Comanda } from '@/lib/supabase/queries/comenzi'
import { getParcele } from '@/lib/supabase/queries/parcele'
import { culturileFermei } from '@/lib/parcele/culturi-ferma'
import { etichetaStocFerma } from '@/lib/stocuri/pe-cultura'
import { useTodayIso } from '@/lib/ui/use-today-iso'
import { useIdDinUrl, useVedereDinUrl } from '@/lib/ui/useIdDinUrl'
import type { FiltruComenziDesktop } from '@/lib/comenzi/tabel'
import { cn } from '@/lib/utils'

// Deschis doar la cerere: nu intră în primul JS al paginii.
const ComenziDinMesajSheet = dynamic(
  () => import('./ComenziDinMesajSheet').then((mod) => mod.ComenziDinMesajSheet),
  { ssr: false },
)

// ─── Legătura prin URL: chatul AI și fișa clientului ───────────────────────────

export function hasAiComandaOpenForm(searchParams: Pick<URLSearchParams, 'get'>): boolean {
  return searchParams.get('openForm') === '1'
}

/** `?openForm=1&client_id=…&client_label=…&telefon=…&locatie_livrare=…&data_livrare=…&cantitate_kg=…&pret_per_kg=…&observatii=…` */
export function parseAiComandaPrefill(searchParams: Pick<URLSearchParams, 'get'>): ComandaPrefill | null {
  if (!hasAiComandaOpenForm(searchParams)) return null
  const read = (name: string) => (searchParams.get(name) ?? '').trim()
  return {
    clientId: read('client_id'),
    clientName: read('client_label') || read('nume_client'),
    telefon: read('telefon'),
    adresa: read('locatie_livrare'),
    dataLivrare: read('data_livrare'),
    cantitateKg: read('cantitate_kg'),
    pretPerKg: read('pret_per_kg'),
    observatii: read('observatii'),
  }
}

/** `?client=<id>&nou=1`: comandă nouă pentru un client ales (din fișa clientului). */
export function parseClientComandaPrefill(searchParams: Pick<URLSearchParams, 'get'>): ComandaPrefill | null {
  const clientId = (searchParams.get('client') ?? '').trim()
  if (searchParams.get('nou') !== '1' || !clientId) return null
  return {
    clientId,
    clientName: '',
    telefon: '',
    adresa: '',
    dataLivrare: '',
    cantitateKg: '',
    pretPerKg: '',
    observatii: '',
  }
}

/** Parametrii care deschid formularul; se șterg din adresă imediat ce au fost citiți. */
const FORM_QUERY_PARAMS = [
  'add',
  'openForm',
  'edit',
  'nou',
  'client',
  'nume_client',
  'client_id',
  'client_label',
  'telefon',
  'cantitate_kg',
  'pret_per_kg',
  'data_livrare',
  'produs',
  'observatii',
  'locatie_livrare',
  'sursa',
] as const

type PendingFromUrl =
  | { kind: 'create'; prefill: ComandaPrefill | null }
  | { kind: 'edit'; comandaId: string }

function readPendingFromUrl(searchParams: Pick<URLSearchParams, 'get'>): PendingFromUrl | null {
  const editId = (searchParams.get('edit') ?? '').trim()
  if (editId) return { kind: 'edit', comandaId: editId }
  const fromClient = parseClientComandaPrefill(searchParams)
  if (fromClient) return { kind: 'create', prefill: fromClient }
  const fromChat = parseAiComandaPrefill(searchParams)
  if (fromChat) return { kind: 'create', prefill: fromChat }
  if (searchParams.get('add') === '1') return { kind: 'create', prefill: null }
  return null
}

// ─── Vederi ────────────────────────────────────────────────────────────────────

type ArchiveFilter = 'toate' | 'active' | 'livrate' | 'neincasate' | 'neincasate30' | 'anulate'
type PageView = { kind: 'zile' } | { kind: 'arhiva'; filter: ArchiveFilter }

const BUCKET_LABEL: Record<ComenziBucket, string> = {
  azi: 'Azi',
  maine: 'Mâine',
  tarziu: 'Mai târziu',
  'fara-data': 'Fără dată',
}

const ARCHIVE_PAGE_SIZE = 40

/** Legăturile vechi din Acasă (`?filter=…`) aleg segmentul sau arhiva de la pornire. */
function initialFromFilter(filter: string | null): { bucket: ComenziBucket; view: PageView } {
  if (filter === 'viitoare' || filter === 'programate') return { bucket: 'tarziu', view: { kind: 'zile' } }
  if (filter === 'livrate') return { bucket: 'azi', view: { kind: 'arhiva', filter: 'livrate' } }
  if (filter === 'toate') return { bucket: 'azi', view: { kind: 'arhiva', filter: 'toate' } }
  if (filter === 'neincasat') return { bucket: 'azi', view: { kind: 'arhiva', filter: 'neincasate' } }
  // Mementoul „neîncasate de peste 30 de zile” (promptul 33, notificarea și rândul din Acasă).
  if (filter === 'neincasat30') return { bucket: 'azi', view: { kind: 'arhiva', filter: 'neincasate30' } }
  return { bucket: 'azi', view: { kind: 'zile' } }
}

/** Aceleași legături vechi (`?filter=…`), pe desktop (promptul 35, §5): filtrul listei. */
function filtruDesktopDin(filter: string | null): FiltruComenziDesktop {
  if (filter === 'neincasat' || filter === 'neincasat30') return 'neincasate'
  if (filter === 'livrate' || filter === 'toate') return 'toate'
  if (filter === 'viitoare' || filter === 'programate') return 'saptamana'
  return 'azi'
}

// ─── Pagina ────────────────────────────────────────────────────────────────────

export function ComenziPageClient() {
  useTrackModuleView('comenzi')

  const { memberRole, accessLevel } = useDashboardAuth()
  const isOperator = memberRole === 'operator'
  const canWrite = !isOperator || accessLevel === 'write'
  const canDelete = !isOperator

  const features = useSchemaFeatures()
  const todayIso = useTodayIso()

  const pathname = usePathname()
  const router = useRouter()
  const searchParams = useSearchParams()
  const queryString = searchParams.toString()

  const [initial] = useState(() =>
    initialFromFilter(typeof window === 'undefined' ? null : new URLSearchParams(window.location.search).get('filter')),
  )
  const [filtruDesktop] = useState(() =>
    filtruDesktopDin(typeof window === 'undefined' ? null : new URLSearchParams(window.location.search).get('filter')),
  )
  // Desktop (promptul 35, §5): comanda aleasă și vederea, în adresă.
  const [idAles, alegeId] = useIdDinUrl()
  const [vedere, setVedere] = useVedereDinUrl()
  const [bucket, setBucket] = useState<ComenziBucket>(initial.bucket)
  const [view, setView] = useState<PageView>(initial.view)
  const [archiveSearch, setArchiveSearch] = useState('')
  const [archiveLimit, setArchiveLimit] = useState(ARCHIVE_PAGE_SIZE)

  const [formOpen, setFormOpen] = useState(false)
  const [prefill, setPrefill] = useState<ComandaPrefill | null>(null)
  // Rămân setate până la următoarea deschidere, ca să nu sară conținutul cât se animă închiderea.
  const [editing, setEditing] = useState<Comanda | null>(null)
  const [openComandaId, setOpenComandaId] = useState<string | null>(null)
  const [sheetOpen, setSheetOpen] = useState(false)
  const [deliveryOpen, setDeliveryOpen] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [dinMesajOpen, setDinMesajOpen] = useState(false)

  // ─── Date ───
  const {
    data: comenzi = [],
    isLoading,
    isError,
    error,
    refetch,
    isRefetching,
    isSuccess: comenziLoaded,
  } = useQuery({
    queryKey: queryKeys.comenzi,
    queryFn: getComenzi,
    staleTime: 30000,
    refetchOnWindowFocus: false,
  })

  const { data: clienti = [], isSuccess: clientiLoaded } = useQuery({
    queryKey: queryKeys.clienti,
    queryFn: getClienți,
    staleTime: 30000,
    refetchOnWindowFocus: false,
  })

  const { data: stockSummary } = useQuery({
    queryKey: queryKeys.comenziStockSummaryAzi,
    queryFn: getComenziStockSummaryAzi,
    staleTime: 30000,
    refetchOnWindowFocus: false,
  })
  const stocDisponibilKg = stockSummary ? stockSummary.totalStocDisponibilKg : null
  // Eticheta stocului, din cultura parcelelor (promptul 31).
  const parceleQuery = useQuery({ queryKey: queryKeys.parcele, queryFn: getParcele })
  const culturiFerma = useMemo(() => (parceleQuery.data ? culturileFermei(parceleQuery.data) : null), [parceleQuery.data])
  const textStoc =
    culturiFerma && culturiFerma.length === 0
      ? 'Adaugă întâi o parcelă: stocul vine din recoltările ei.'
      : stocDisponibilKg !== null
        ? `${(culturiFerma && etichetaStocFerma(culturiFerma)) ?? 'În stoc, calitatea 1'}: ${formatKg(stocDisponibilKg)}`
        : 'Se calculează stocul…'

  const clientMap = useMemo(() => new Map(clienti.map((client) => [client.id, client])), [clienti])
  const clientName = useCallback((comanda: Comanda) => comandaClientName(comanda, clientMap), [clientMap])

  // ─── Deschiderea din adresă ───
  // Parametrii se citesc o singură dată și se șterg înainte ca formularul să se deschidă. Altfel fereastra
  // și-ar pune intrarea în istoric peste o adresă cu `openForm=1`, iar un „înapoi” ulterior ar redeschide-o.
  const formRequestedInUrl = readPendingFromUrl(searchParams) !== null
  const [seenQuery, setSeenQuery] = useState<string | null>(null)
  const [pendingFromUrl, setPendingFromUrl] = useState<PendingFromUrl | null>(null)
  if (seenQuery !== queryString) {
    setSeenQuery(queryString)
    const pending = readPendingFromUrl(searchParams)
    if (pending) setPendingFromUrl(pending)
  }
  // Formularul are nevoie de clienți (și de comenzi, la editare) ca să pornească pe pasul potrivit.
  const dataReady = comenziLoaded && clientiLoaded
  if (pendingFromUrl && !formRequestedInUrl && dataReady) {
    setPendingFromUrl(null)
    if (canWrite) {
      if (pendingFromUrl.kind === 'edit') {
        const target = comenzi.find((comanda) => comanda.id === pendingFromUrl.comandaId)
        if (target) {
          setPrefill(null)
          setEditing(target)
          setFormOpen(true)
        }
      } else {
        setPrefill(pendingFromUrl.prefill)
        setEditing(null)
        setFormOpen(true)
      }
    }
  }

  useEffect(() => {
    if (!formRequestedInUrl) return
    const nextParams = new URLSearchParams(queryString)
    for (const name of FORM_QUERY_PARAMS) nextParams.delete(name)
    const query = nextParams.toString()
    const nextUrl = query ? `${pathname}?${query}` : pathname
    window.history.replaceState(window.history.state, '', nextUrl)
    router.replace(nextUrl, { scroll: false })
  }, [formRequestedInUrl, pathname, queryString, router])

  // ─── Acțiuni ───
  const openCreate = useCallback(() => {
    setPrefill(null)
    setEditing(null)
    setFormOpen(true)
  }, [])

  const openComanda = useCallback((comanda: Comanda) => {
    setOpenComandaId(comanda.id)
    setSheetOpen(true)
  }, [])

  const openEdit = useCallback((comanda: Comanda) => {
    // Foaia se închide înainte să se deschidă formularul: două ferestre suprapuse s-ar închide amândouă la „înapoi”.
    setSheetOpen(false)
    setPrefill(null)
    setEditing(comanda)
    setFormOpen(true)
  }, [])

  const openDinMesaj = useCallback(() => {
    setMenuOpen(false)
    setDinMesajOpen(true)
  }, [])

  const openArchive = useCallback((filter: ArchiveFilter) => {
    setMenuOpen(false)
    setArchiveSearch('')
    setArchiveLimit(ARCHIVE_PAGE_SIZE)
    setView({ kind: 'arhiva', filter })
  }, [])

  // ─── Pe zile ───
  const buckets = useMemo(
    () => (todayIso ? splitComenziByBucket(comenzi, todayIso) : { azi: [], maine: [], tarziu: [], 'fara-data': [] }),
    [comenzi, todayIso],
  )
  const aziSummary = useMemo(() => summarizeComenzi(buckets.azi), [buckets.azi])
  const maineSummary = useMemo(() => summarizeComenzi(buckets.maine), [buckets.maine])
  const candidates = useMemo(() => deliveryCandidates(buckets.azi), [buckets.azi])
  const inLivrareCount = buckets.azi.length - candidates.length
  const visible = buckets[bucket]
  const laterGroups = useMemo(() => (bucket === 'tarziu' ? groupComenziByDay(buckets.tarziu) : []), [bucket, buckets.tarziu])

  // ─── Arhiva (toate comenzile, cu căutare) ───
  const neincasate = useMemo(
    () => comenzi.filter((comanda) => comandaNeincasata(comanda)),
    [comenzi],
  )
  const neincasate30 = useMemo(
    () => (todayIso ? neincasate.filter((comanda) => esteNeincasataPeste30(comanda, todayIso)) : []),
    [neincasate, todayIso],
  )
  const archiveCounts = useMemo(
    () => ({
      toate: comenzi.length,
      active: comenzi.filter((comanda) => comanda.status !== 'livrata' && comanda.status !== 'anulata').length,
      livrate: comenzi.filter((comanda) => comanda.status === 'livrata').length,
      neincasate: neincasate.length,
      neincasate30: neincasate30.length,
      anulate: comenzi.filter((comanda) => comanda.status === 'anulata').length,
    }),
    [comenzi, neincasate, neincasate30],
  )
  const archiveFilter = view.kind === 'arhiva' ? view.filter : 'toate'
  const archiveList = useMemo(() => {
    if (view.kind !== 'arhiva') return []
    const text = searchKey(archiveSearch)
    const digits = phoneDigits(archiveSearch).replace(/^0+/, '')
    return comenzi
      .filter((comanda) => {
        if (archiveFilter === 'active' && (comanda.status === 'livrata' || comanda.status === 'anulata')) return false
        if (archiveFilter === 'livrate' && comanda.status !== 'livrata') return false
        if (archiveFilter === 'anulate' && comanda.status !== 'anulata') return false
        if (
          archiveFilter === 'neincasate' &&
          !comandaNeincasata(comanda)
        ) {
          return false
        }
        if (archiveFilter === 'neincasate30' && !(todayIso && esteNeincasataPeste30(comanda, todayIso))) return false
        if (!text) return true
        if (searchKey(comandaClientName(comanda, clientMap)).includes(text)) return true
        return digits.length >= 3 && phoneDigits(comanda.telefon).includes(digits)
      })
      .sort((left, right) => {
        const leftDay = left.data_livrare ?? left.data_comanda ?? ''
        const rightDay = right.data_livrare ?? right.data_comanda ?? ''
        return rightDay.localeCompare(leftDay) || String(right.created_at).localeCompare(String(left.created_at))
      })
  }, [archiveFilter, archiveSearch, clientMap, comenzi, todayIso, view.kind])

  useEffect(() => {
    const query = archiveSearch.trim()
    if (!query) return
    const timer = setTimeout(() => track('search', { module: 'comenzi', query }), 500)
    return () => clearTimeout(timer)
  }, [archiveSearch])

  const openedComanda = comenzi.find((comanda) => comanda.id === openComandaId) ?? null
  // Comanda deschisă a dispărut (ștearsă): foaia se închide de tot.
  if (sheetOpen && openComandaId !== null && openedComanda === null && !isLoading) setSheetOpen(false)

  const loading = todayIso === null || isLoading
  const hasAny = comenzi.length > 0
  // Pe desktop, lista + fișa înlocuiesc pagina de telefon după ce datele au venit (până atunci, același schelet).
  const desktopGata = !loading && !isError

  const addButton = (
    <Button type="button" variant="primary" size="touch-lg" className="w-full" onClick={openCreate}>
      <Plus aria-hidden />
      Comandă nouă
    </Button>
  )

  const renderCards = (list: readonly Comanda[], showDay: boolean) => (
    <ul className="space-y-2.5">
      {list.map((comanda) => (
        <li key={comanda.id}>
          <ComandaCard
            comanda={comanda}
            clientName={clientName(comanda)}
            todayIso={todayIso ?? ''}
            showDay={showDay}
            onOpen={() => openComanda(comanda)}
          />
        </li>
      ))}
    </ul>
  )

  let body: React.ReactNode
  if (isError) {
    body = (
      <Notice
        tone="danger"
        title="Comenzile nu s-au încărcat"
        action={
          <Button type="button" variant="neutral" size="touch" loading={isRefetching} onClick={() => void refetch()}>
            Reîncearcă
          </Button>
        }
      >
        {(error as Error | null)?.message || 'Verifică internetul și încearcă din nou.'}
      </Notice>
    )
  } else if (loading) {
    body = <PageSkeleton />
  } else if (view.kind === 'arhiva') {
    const shown = archiveList.slice(0, archiveLimit)
    body = (
      <>
        <Button type="button" variant="neutral" size="touch" onClick={() => setView({ kind: 'zile' })}>
          <ArrowLeft aria-hidden />
          Înapoi la zile
        </Button>
        <BigInput
          aria-label="Caută o comandă după client sau telefon"
          placeholder="Client sau telefon"
          value={archiveSearch}
          onChange={(event) => {
            setArchiveSearch(event.target.value)
            setArchiveLimit(ARCHIVE_PAGE_SIZE)
          }}
          leading={<Search aria-hidden />}
          autoComplete="off"
          enterKeyHint="search"
        />
        <FilterPills<ArchiveFilter>
          aria-label="Ce comenzi arăt"
          value={archiveFilter}
          onValueChange={(filter) => {
            setArchiveLimit(ARCHIVE_PAGE_SIZE)
            setView({ kind: 'arhiva', filter })
          }}
          options={[
            { value: 'toate', label: 'Toate', count: archiveCounts.toate },
            { value: 'active', label: 'Active', count: archiveCounts.active },
            { value: 'livrate', label: 'Livrate', count: archiveCounts.livrate },
            { value: 'neincasate', label: 'Neîncasate', count: archiveCounts.neincasate },
            ...(archiveCounts.neincasate30 > 0 || archiveFilter === 'neincasate30'
              ? [{ value: 'neincasate30' as const, label: 'Peste 30 de zile', count: archiveCounts.neincasate30 }]
              : []),
            { value: 'anulate', label: 'Anulate', count: archiveCounts.anulate },
          ]}
        />
        {archiveFilter === 'neincasate30' && neincasate30.length > 0 ? (
          <Notice tone="warning" title={textNeincasatePeste30({ numar: neincasate30.length, lei: neincasate30.reduce((sum, comanda) => sum + comandaRestDeIncasat(comanda), 0) })}>
            Livrate acum cel puțin 30 de zile și încă neîncasate.
          </Notice>
        ) : null}
        {archiveFilter === 'neincasate' && neincasate.length > 0 ? (
          <Notice tone="warning" title={`De încasat: ${formatLei(neincasate.reduce((sum, comanda) => sum + comandaRestDeIncasat(comanda), 0))}`}>
            Din {neincasate.length} {neincasate.length === 1 ? 'comandă livrată' : 'comenzi livrate'}.
          </Notice>
        ) : null}
        {shown.length === 0 ? (
          <EmptyState icon={<Search />} title="Nicio comandă găsită" description="Schimbă filtrul sau căutarea." />
        ) : (
          <>
            {renderCards(shown, true)}
            {archiveList.length > shown.length ? (
              <Button
                type="button"
                variant="neutral"
                size="touch"
                className="w-full"
                onClick={() => setArchiveLimit((limit) => limit + ARCHIVE_PAGE_SIZE)}
              >
                Arată încă {Math.min(ARCHIVE_PAGE_SIZE, archiveList.length - shown.length)}
              </Button>
            ) : null}
          </>
        )}
      </>
    )
  } else {
    body = (
      <>
        <div className="grid grid-cols-2 gap-2.5">
          <StatTile
            tone="inverse"
            value={formatNumber(aziSummary.kg)}
            unit="kg"
            label={`Azi de livrat · ${aziSummary.count} ${aziSummary.count === 1 ? 'comandă' : 'comenzi'} · ${formatLei(aziSummary.lei)}`}
          />
          <StatTile
            value={formatNumber(maineSummary.kg)}
            unit="kg"
            label={`Mâine · ${maineSummary.count} ${maineSummary.count === 1 ? 'comandă' : 'comenzi'} · ${formatLei(maineSummary.lei)}`}
          />
        </div>

        <div className="flex gap-2.5">
          {canWrite ? (
            <Button type="button" variant="neutral" size="touch" className="min-w-0 flex-1" onClick={openDinMesaj}>
              <MessageSquareText aria-hidden />
              <span className="truncate">Din mesaj</span>
            </Button>
          ) : null}
          <Button
            type="button"
            variant="neutral"
            size={canWrite ? 'icon-touch' : 'touch'}
            className={canWrite ? 'shrink-0' : 'flex-1'}
            aria-label="Mai multe: căutare, livrate, neîncasate"
            onClick={() => setMenuOpen(true)}
          >
            <Ellipsis aria-hidden />
            {canWrite ? null : 'Caută și vezi toate comenzile'}
          </Button>
        </div>

        {canWrite ? <div className="hidden md:block lg:hidden">{addButton}</div> : null}

        <Segments<ComenziBucket>
          aria-label="Ce zi arăt"
          panelId="comenzi-lista"
          value={bucket}
          onValueChange={setBucket}
          options={[
            { value: 'azi', label: BUCKET_LABEL.azi, count: buckets.azi.length },
            { value: 'maine', label: BUCKET_LABEL.maine, count: buckets.maine.length },
            { value: 'tarziu', label: BUCKET_LABEL.tarziu },
            { value: 'fara-data', label: BUCKET_LABEL['fara-data'] },
          ]}
        />

        <section id="comenzi-lista" role="tabpanel" aria-label={BUCKET_LABEL[bucket]} className="space-y-3">
          {bucket === 'azi' ? (
            <>
              {aziSummary.prioritareCount > 0 ? (
                <Notice
                  tone="warning"
                  icon={<Flag aria-hidden />}
                  title={`${aziSummary.prioritareCount} ${aziSummary.prioritareCount === 1 ? 'prioritară' : 'prioritare'} azi · ${formatKg(aziSummary.prioritareKg)}`}
                >
                  De livrat cu prioritate.
                </Notice>
              ) : null}
              {buckets.azi.length > 0 ? (
                <div className="space-y-2">
                  {canWrite && candidates.length > 0 ? (
                    <Button type="button" variant="neutral" size="touch-lg" className="w-full" onClick={() => setDeliveryOpen(true)}>
                      <Truck aria-hidden />
                      Pune în livrare azi ({candidates.length})
                    </Button>
                  ) : null}
                  <p className={cn('px-1 text-fg-muted', kitText.helper)}>
                    {textStoc}
                    {inLivrareCount > 0 ? ` · ${inLivrareCount} deja în livrare` : ''}
                  </p>
                </div>
              ) : null}
            </>
          ) : null}

          {(bucket === 'tarziu' || bucket === 'fara-data') && visible.length > 0 ? (
            <p className={cn('px-1 text-fg-muted', kitText.secondary)}>
              {visible.length} {visible.length === 1 ? 'comandă' : 'comenzi'} · {formatKg(summarizeComenzi(visible).kg)}
            </p>
          ) : null}

          {visible.length === 0 ? (
            <EmptyState
              icon={<ClipboardList />}
              title={emptyTitle(bucket, hasAny)}
              description={canWrite ? emptyHint(bucket) : 'Comenzile apar aici după ce sunt notate.'}
              action={canWrite && !hasAny ? <div className="w-64 max-w-full">{addButton}</div> : undefined}
            />
          ) : bucket === 'tarziu' ? (
            <div className="space-y-4">
              {laterGroups.map((group) => (
                <section key={group.day ?? 'fara'} className="space-y-2">
                  <h2 className={cn('px-1 font-extrabold text-fg', kitText.card)}>
                    {group.day && todayIso ? capitalizeRo(weekdayDateRo(group.day)) : 'Fără dată'}
                    <span className={cn('ml-2 font-semibold text-fg-muted', kitText.secondary)}>
                      {formatKg(summarizeComenzi(group.comenzi).kg)}
                    </span>
                  </h2>
                  {renderCards(group.comenzi, false)}
                </section>
              ))}
            </div>
          ) : (
            renderCards(visible, false)
          )}
        </section>
      </>
    )
  }

  return (
    <AppShell
      header={
        <PageHeader
          title="Comenzi"
          subtitle={todayIso ? capitalizeRo(longDayRo(todayIso)) : undefined}
          contentVariant="workspace"
          actiune={canWrite ? { label: 'Comandă', onClick: openCreate } : null}
          alteActiuni={
            canWrite ? (
              <Button type="button" variant="neutral" size="touch" onClick={openDinMesaj}>
                <MessageSquareText aria-hidden />
                Din mesaj
              </Button>
            ) : null
          }
          comutatoare={
            <>
              <ComutatorComenziLivrari activ="comenzi" />
              <ComutatorVedere vedere={vedere} onVedere={setVedere} />
            </>
          }
        />
      }
      bottomBarFixed
      bottomBar={
        // Butonul mare ține locul butonului plutitor (+) pe această pagină.
        canWrite && hasAny && !loading && !isError ? (
          <div className="mx-auto w-full max-w-md px-4">
            <div className="rounded-box shadow-2">{addButton}</div>
          </div>
        ) : undefined
      }
    >
      <div className={cn('mx-auto w-full max-w-modul space-y-4 pt-3', desktopGata && 'lg:hidden')}>{body}</div>
      {desktopGata && todayIso ? (
        <div className="hidden pt-3 lg:block">
          <ComenziDesktop
            comenzi={comenzi}
            numeClient={clientName}
            telefonClient={(comanda) => (comanda.client_id ? (clientMap.get(comanda.client_id)?.telefon ?? null) : null)}
            todayIso={todayIso}
            canWrite={canWrite}
            canDelete={canDelete}
            hasPrioritara={features.comenziPrioritara}
            onEdit={openEdit}
            vedere={vedere}
            idAles={idAles}
            onAlege={(id, { push }) => alegeId(id, { push })}
            onDeschideDinTabel={(id) => {
              setVedere('lista')
              alegeId(id, { push: true })
            }}
            filtruInitial={filtruDesktop}
          />
        </div>
      ) : null}

      {todayIso ? (
        <>
          <ComandaSheet
            open={sheetOpen}
            onOpenChange={setSheetOpen}
            comanda={openedComanda}
            clientName={openedComanda ? clientName(openedComanda) : ''}
            clientTelefon={openedComanda?.client_id ? clientMap.get(openedComanda.client_id)?.telefon : null}
            todayIso={todayIso}
            canWrite={canWrite}
            canDelete={canDelete}
            hasPrioritara={features.comenziPrioritara}
            onEdit={openEdit}
          />
          <PuneInLivrareSheet
            open={deliveryOpen}
            onOpenChange={setDeliveryOpen}
            aziComenzi={buckets.azi}
            clientName={clientName}
            stocDisponibilKg={stocDisponibilKg}
          />
          <ComandaStepForm
            open={formOpen}
            onOpenChange={setFormOpen}
            clienti={clienti}
            comenzi={comenzi}
            todayIso={todayIso}
            hasPrioritara={features.comenziPrioritara}
            prefill={prefill}
            editing={editing}
          />
        </>
      ) : null}

      <BottomSheet open={menuOpen} onOpenChange={setMenuOpen} title="Mai multe">
        <ul className="space-y-2">
          <li>
            <ListRow
              avatar={false}
              leading={<MenuIcon><Search aria-hidden /></MenuIcon>}
              title="Caută o comandă"
              detail="După client sau telefon, în toate comenzile"
              onClick={() => openArchive('toate')}
            />
          </li>
          <li>
            <ListRow
              avatar={false}
              leading={<MenuIcon><ClipboardList aria-hidden /></MenuIcon>}
              title="Livrate"
              detail={`${archiveCounts.livrate} comenzi`}
              onClick={() => openArchive('livrate')}
            />
          </li>
          <li>
            <ListRow
              avatar={false}
              leading={<MenuIcon><ClipboardList aria-hidden /></MenuIcon>}
              title="Neîncasate"
              detail={
                neincasate.length > 0
                  ? `${neincasate.length} · ${formatLei(neincasate.reduce((sum, comanda) => sum + comandaRestDeIncasat(comanda), 0))}`
                  : 'Nimic de încasat'
              }
              onClick={() => openArchive('neincasate')}
            />
          </li>
          <li>
            <ListRow
              avatar={false}
              leading={<MenuIcon><ClipboardList aria-hidden /></MenuIcon>}
              title="Anulate"
              detail={`${archiveCounts.anulate} comenzi`}
              onClick={() => openArchive('anulate')}
            />
          </li>
        </ul>
      </BottomSheet>

      {canWrite ? (
        <ComenziDinMesajSheet clienti={clienti} open={dinMesajOpen} onOpenChange={setDinMesajOpen} />
      ) : null}
    </AppShell>
  )
}

function MenuIcon({ children }: { children: React.ReactNode }) {
  return (
    <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-surface-muted text-fg [&_svg]:size-5">
      {children}
    </span>
  )
}

function emptyTitle(bucket: ComenziBucket, hasAny: boolean): string {
  if (!hasAny) return 'Nicio comandă încă'
  if (bucket === 'azi') return 'Nimic de livrat azi'
  if (bucket === 'maine') return 'Nimic pentru mâine'
  if (bucket === 'tarziu') return 'Nimic programat mai târziu'
  return 'Nicio comandă fără dată'
}

function emptyHint(bucket: ComenziBucket): string {
  if (bucket === 'fara-data') return 'Aici stau comenzile pentru care nu s-a stabilit încă ziua.'
  return 'Notează comanda când sună clientul sau lipește mesajul lui la „Din mesaj”.'
}

function PageSkeleton() {
  return (
    <div className="space-y-4" aria-busy="true" aria-label="Se încarcă comenzile">
      <div className="grid grid-cols-2 gap-2.5">
        <div className="h-[78px] animate-pulse rounded-box bg-surface-muted" />
        <div className="h-[78px] animate-pulse rounded-box bg-surface-muted" />
      </div>
      <div className="h-14 animate-pulse rounded-box bg-surface-muted" />
      <div className="space-y-2.5">
        <div className="h-32 animate-pulse rounded-card bg-surface-muted" />
        <div className="h-32 animate-pulse rounded-card bg-surface-muted" />
        <div className="h-32 animate-pulse rounded-card bg-surface-muted" />
      </div>
    </div>
  )
}
