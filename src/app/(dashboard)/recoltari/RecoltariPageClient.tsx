'use client'

import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from 'react'
import { useQuery } from '@tanstack/react-query'
import { CalendarDays, Plus, Scale } from 'lucide-react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'

import { AppShell } from '@/components/app/AppShell'
import { useDashboardAuth } from '@/components/app/DashboardAuthContext'
import { PageHeader } from '@/components/app/PageHeader'
import {
  Button,
  CalendarSheet,
  EmptyState,
  ListRow,
  Notice,
  StatHero,
  addDaysIso,
  kitText,
  longDayRo,
  todayIso as readTodayIso,
} from '@/components/kit'
import { CulegatorCantaririSheet } from '@/components/recoltari/CulegatorCantaririSheet'
import { RecoltareStepForm, type RecoltareAiPrefill } from '@/components/recoltari/RecoltareStepForm'
import { useRecoltareDeleteWithUndo } from '@/components/recoltari/useRecoltareDeleteWithUndo'
import { useTrackModuleView } from '@/lib/analytics/useTrackModuleView'
import { queryKeys } from '@/lib/query-keys'
import { aggregateRecoltariByCulegator, type RecoltareWorkerAggregate } from '@/lib/recoltari/aggregate-by-culegator'
import {
  formatKg,
  formatKgValue,
  formatLei,
  recoltariOfDay,
  shortDayLabel,
  summarizeRecoltariDay,
} from '@/lib/recoltari/day-view'
import { getCulegatori } from '@/lib/supabase/queries/culegatori'
import { getParcele } from '@/lib/supabase/queries/parcele'
import { getRecoltari, type Recoltare } from '@/lib/supabase/queries/recoltari'
import { cn } from '@/lib/utils'

// ─── Legătura cu chatul AI (prin URL) ──────────────────────────────────────────

export function hasAiOpenForm(searchParams: Pick<URLSearchParams, 'get'>): boolean {
  return searchParams.get('openForm') === '1'
}

export function parseAiRecoltarePrefill(searchParams: Pick<URLSearchParams, 'get'>): RecoltareAiPrefill {
  return {
    parcela_id: (searchParams.get('parcela_id') ?? '').trim(),
    parcela_label: (searchParams.get('parcela_label') ?? searchParams.get('parcela') ?? '').trim(),
    cantitate_kg: (searchParams.get('cantitate_kg') ?? '').trim(),
    data: (searchParams.get('data') ?? '').trim(),
    observatii: (searchParams.get('observatii') ?? '').trim(),
  }
}

/** Parametrii care deschid formularul; se șterg din adresă imediat ce au fost citiți. */
const FORM_QUERY_PARAMS = [
  'add',
  'openForm',
  'cantitate_kg',
  'parcela',
  'parcela_id',
  'parcela_label',
  'data',
  'calitate',
  'culegator',
  'observatii',
] as const

// ─── Ziua de azi, pe ceasul telefonului ────────────────────────────────────────

/** Pagina rămasă deschisă peste noapte trece singură pe ziua nouă. */
function subscribeToDayChange(onChange: () => void) {
  const onVisible = () => {
    if (document.visibilityState === 'visible') onChange()
  }
  document.addEventListener('visibilitychange', onVisible)
  const timer = window.setInterval(onChange, 60_000)
  return () => {
    document.removeEventListener('visibilitychange', onVisible)
    window.clearInterval(timer)
  }
}

const noServerDay = () => null

function capitalize(text: string): string {
  return text.charAt(0).toLocaleUpperCase('ro-RO') + text.slice(1)
}

// ─── Pagina ────────────────────────────────────────────────────────────────────

export function RecoltariPageClient() {
  useTrackModuleView('recoltari')

  const { memberRole, accessLevel } = useDashboardAuth()
  const canWriteRecoltari = memberRole !== 'operator' || accessLevel === 'write'
  const canDeleteRecoltari = memberRole !== 'operator'

  // Ziua se citește doar în browser: serverul are alt fus orar, iar după miezul nopții ar afișa ziua greșită.
  const todayIso = useSyncExternalStore(subscribeToDayChange, readTodayIso, noServerDay)

  // Pagina arată o singură zi: azi, sau una anterioară aleasă din calendar (pentru corecturi).
  const [selectedDay, setSelectedDay] = useState<string | null>(null)
  const [dayPickerOpen, setDayPickerOpen] = useState(false)
  const day = todayIso && selectedDay && selectedDay < todayIso ? selectedDay : todayIso
  const isToday = day === todayIso

  const [formOpen, setFormOpen] = useState(false)
  const [aiPrefill, setAiPrefill] = useState<RecoltareAiPrefill | null>(null)
  const [initialCulegatorId, setInitialCulegatorId] = useState<string | null>(null)
  // Rămâne setată până la următoarea deschidere, ca formularul să nu-și schimbe conținutul cât se închide.
  const [editing, setEditing] = useState<Recoltare | null>(null)
  const [openWorkerKey, setOpenWorkerKey] = useState<string | null>(null)

  // ─── Deschiderea din adresă (`?add=1`, `?openForm=1&…` din chatul AI) ───
  const pathname = usePathname()
  const router = useRouter()
  const searchParams = useSearchParams()
  const queryString = searchParams.toString()
  // `?culegator=<id>` vine din fișa culegătorului („Adaugă kg azi”): formularul pornește direct pe kilograme.
  const culegatorFromUrl = hasAiOpenForm(searchParams) ? '' : (searchParams.get('culegator') ?? '').trim()
  const formRequestedInUrl = searchParams.get('add') === '1' || hasAiOpenForm(searchParams) || culegatorFromUrl !== ''

  // Parametrii se citesc o singură dată și se șterg înainte ca formularul să se deschidă. Altfel fereastra
  // și-ar pune intrarea în istoric peste o adresă cu `openForm=1`, iar un „înapoi” ulterior ar redeschide-o.
  const [seenQuery, setSeenQuery] = useState<string | null>(null)
  const [pendingFromUrl, setPendingFromUrl] = useState<{
    prefill: RecoltareAiPrefill | null
    culegatorId: string | null
  } | null>(null)
  if (seenQuery !== queryString) {
    setSeenQuery(queryString)
    if (formRequestedInUrl) {
      setPendingFromUrl({
        prefill: hasAiOpenForm(searchParams) ? parseAiRecoltarePrefill(searchParams) : null,
        culegatorId: culegatorFromUrl || null,
      })
    } else if (pendingFromUrl) {
      setPendingFromUrl(null)
      if (canWriteRecoltari) {
        setAiPrefill(pendingFromUrl.prefill)
        setInitialCulegatorId(pendingFromUrl.culegatorId)
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

  const openForm = useCallback(() => {
    setAiPrefill(null)
    setInitialCulegatorId(null)
    setEditing(null)
    setFormOpen(true)
  }, [])

  const openEdit = useCallback((recoltare: Recoltare) => {
    // Foaia se închide înainte să se deschidă formularul: două ferestre suprapuse s-ar închide amândouă la „înapoi”.
    setOpenWorkerKey(null)
    setAiPrefill(null)
    setInitialCulegatorId(null)
    setEditing(recoltare)
    setFormOpen(true)
  }, [])

  const handleWorkerSheetOpenChange = useCallback((open: boolean) => {
    if (!open) setOpenWorkerKey(null)
  }, [])

  const scheduleDelete = useRecoltareDeleteWithUndo({ canDelete: canDeleteRecoltari })

  // ─── Date ───
  const {
    data: recoltari = [],
    isLoading,
    isError,
    error,
    refetch,
    isRefetching,
  } = useQuery({
    queryKey: queryKeys.recoltari,
    queryFn: getRecoltari,
    staleTime: 30000,
    refetchOnWindowFocus: false,
  })

  const { data: parcele = [] } = useQuery({
    queryKey: queryKeys.parcele,
    queryFn: getParcele,
    staleTime: 30000,
    refetchOnWindowFocus: false,
  })

  const { data: culegatori = [] } = useQuery({
    queryKey: queryKeys.culegatori,
    queryFn: getCulegatori,
    staleTime: 30000,
    refetchOnWindowFocus: false,
  })

  const dayRecoltari = useMemo(() => (day ? recoltariOfDay(recoltari, day) : []), [recoltari, day])
  const summary = useMemo(() => summarizeRecoltariDay(dayRecoltari), [dayRecoltari])
  const workers = useMemo(() => {
    const names = new Map(culegatori.map((culegator) => [culegator.id, culegator.nume_prenume]))
    return aggregateRecoltariByCulegator({
      recoltari: dayRecoltari,
      resolveWorkerName: (workerId) => (workerId ? names.get(workerId)?.trim() || undefined : undefined),
    })
  }, [culegatori, dayRecoltari])

  const parcelaNames = useMemo(
    () => new Map(parcele.map((parcela) => [parcela.id, parcela.nume_parcela?.trim() || 'Parcelă fără nume'])),
    [parcele],
  )
  const parcelaName = useCallback(
    (parcelaId: string | null) => (parcelaId ? parcelaNames.get(parcelaId) : undefined) ?? 'Parcelă necunoscută',
    [parcelaNames],
  )

  const loading = todayIso === null || day === null || isLoading
  const hasRows = workers.length > 0
  const openWorker = workers.find((worker) => worker.workerKey === openWorkerKey) ?? null
  // Culegătorul deschis nu mai are nicio cântărire în ziua afișată (ultima a fost ștearsă sau s-a schimbat ziua):
  // foaia se închide de tot, ca să nu se redeschidă singură când el reapare în listă.
  if (openWorkerKey !== null && openWorker === null && !loading) setOpenWorkerKey(null)
  const dayName = day ? longDayRo(day) : ''

  // Ziua afișată: discret, deasupra totalului. O zi anterioară se deschide pentru corecturi.
  const dayRow =
    todayIso && day ? (
      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant="neutral"
          size="touch"
          aria-label={`Ziua afișată: ${dayName}. Alege altă zi`}
          onClick={() => setDayPickerOpen(true)}
        >
          <CalendarDays aria-hidden />
          {shortDayLabel(day, todayIso)}
        </Button>
        {isToday ? null : (
          <Button type="button" variant="quiet" size="touch" onClick={() => setSelectedDay(null)}>
            Înapoi la azi
          </Button>
        )}
      </div>
    ) : null

  const addButton = (
    <Button type="button" variant="primary" size="touch-lg" className="w-full" onClick={openForm}>
      <Plus aria-hidden />
      Adaugă kg
    </Button>
  )

  return (
    <AppShell
      header={
        <PageHeader
          title="Recoltări"
          // Ziua afișată, nu neapărat azi: aceeași cu pastila de dată de sub antet.
          subtitle={day ? capitalize(longDayRo(day)) : undefined}
          contentVariant="workspace"
        />
      }
      bottomBarFixed
      bottomBar={
        // Butonul mare ține locul butonului plutitor (+) pe această pagină.
        canWriteRecoltari && hasRows && !loading && !isError ? (
          <div className="mx-auto w-full max-w-md px-4">
            <div className="rounded-box shadow-2">{addButton}</div>
          </div>
        ) : undefined
      }
    >
      <div className="mx-auto w-full max-w-modul space-y-4 pt-3">
        {isError ? (
          <Notice
            tone="danger"
            title="Recoltările nu s-au încărcat"
            action={
              <Button type="button" variant="neutral" size="touch" loading={isRefetching} onClick={() => void refetch()}>
                Reîncearcă
              </Button>
            }
          >
            {(error as Error | null)?.message || 'Verifică internetul și încearcă din nou.'}
          </Notice>
        ) : loading ? (
          <PageSkeleton />
        ) : hasRows ? (
          <>
            {dayRow}
            <StatHero
              label={isToday ? 'Total azi' : `Total ${dayName}`}
              value={formatKgValue(summary.totalKg)}
              unit="kg"
              items={[
                { label: 'De plată', value: formatLei(summary.paymentLei) },
                { label: 'Culegători', value: summary.workerCount },
                { label: 'Calitatea 1', value: formatKg(summary.cal1Kg) },
                { label: 'Calitatea 2', value: formatKg(summary.cal2Kg) },
              ]}
            />

            {canWriteRecoltari ? <div className="hidden md:block">{addButton}</div> : null}

            <section aria-labelledby="recoltari-notati" className="space-y-2">
              <h2 id="recoltari-notati" className={cn('px-1 font-extrabold text-fg', kitText.card)}>
                {isToday ? 'Notați azi' : `Notați ${dayName}`}
              </h2>
              <ul className="space-y-2">
                {workers.map((worker) => (
                  <li key={worker.workerKey}>
                    <ListRow
                      title={worker.workerName}
                      detail={workerDetail(worker)}
                      onClick={() => setOpenWorkerKey(worker.workerKey)}
                      chevron={false}
                      aria-label={`${worker.workerName}, ${formatKg(worker.totalKg)}, ${formatLei(worker.totalPaymentLei)}. Vezi cântăririle`}
                      trailing={
                        <span className="flex flex-col items-end">
                          <span className={cn('font-extrabold text-fg', kitText.base)}>{formatKg(worker.totalKg)}</span>
                          <span className={cn('text-fg-muted', kitText.secondary)}>{formatLei(worker.totalPaymentLei)}</span>
                        </span>
                      }
                    />
                  </li>
                ))}
              </ul>
            </section>
          </>
        ) : (
          <>
            {dayRow}
            <EmptyState
              icon={<Scale />}
              title={isToday ? 'Nimic notat azi' : `Nimic notat ${dayName}`}
              description={
                canWriteRecoltari
                  ? isToday
                    ? 'Seara, notează kilogramele culese de fiecare culegător.'
                    : 'Poți adăuga o cântărire uitată pentru această zi.'
                  : 'Kilogramele culese apar aici după ce sunt notate.'
              }
              action={canWriteRecoltari ? <div className="w-64 max-w-full">{addButton}</div> : undefined}
            />
          </>
        )}
      </div>

      {todayIso && day ? (
        <>
          <CalendarSheet
            open={dayPickerOpen}
            onOpenChange={setDayPickerOpen}
            title="Ce zi vrei să vezi?"
            value={day}
            onChange={(iso) => setSelectedDay(iso === todayIso ? null : iso)}
            max={todayIso}
            shortcuts={[
              { label: 'Azi', value: todayIso },
              { label: 'Ieri', value: addDaysIso(todayIso, -1) },
              { label: 'Alaltăieri', value: addDaysIso(todayIso, -2) },
            ]}
          />
          <CulegatorCantaririSheet
            open={openWorker !== null}
            onOpenChange={handleWorkerSheetOpenChange}
            worker={openWorker}
            parcelaName={parcelaName}
            canEdit={canWriteRecoltari}
            canDelete={canDeleteRecoltari}
            onEdit={openEdit}
            onDelete={scheduleDelete}
          />
          <RecoltareStepForm
            open={formOpen}
            onOpenChange={setFormOpen}
            recoltari={recoltari}
            parcele={parcele}
            culegatori={culegatori}
            todayIso={todayIso}
            defaultDate={day}
            prefill={aiPrefill}
            initialCulegatorId={initialCulegatorId}
            editing={editing}
          />
        </>
      ) : null}
    </AppShell>
  )
}

function workerDetail(worker: RecoltareWorkerAggregate): string {
  const parts = [`Cal. 1: ${formatKg(worker.totalCal1Kg)}`]
  if (worker.totalCal2Kg > 0) parts.push(`Cal. 2: ${formatKg(worker.totalCal2Kg)}`)
  if (worker.harvestCount > 1) parts.push(`${worker.harvestCount} cântăriri`)
  return parts.join(' · ')
}

function PageSkeleton() {
  return (
    <div className="space-y-4" aria-busy="true" aria-label="Se încarcă recoltările">
      <div className="h-56 animate-pulse rounded-card bg-surface-muted" />
      <div className="space-y-2">
        <div className="h-[68px] animate-pulse rounded-box bg-surface-muted" />
        <div className="h-[68px] animate-pulse rounded-box bg-surface-muted" />
        <div className="h-[68px] animate-pulse rounded-box bg-surface-muted" />
      </div>
    </div>
  )
}
