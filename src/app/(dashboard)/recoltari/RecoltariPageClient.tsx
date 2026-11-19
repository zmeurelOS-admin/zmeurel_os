'use client'

import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Plus, Scale } from 'lucide-react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'

import { AppShell } from '@/components/app/AppShell'
import { useDashboardAuth } from '@/components/app/DashboardAuthContext'
import { PageHeader } from '@/components/app/PageHeader'
import { Button, EmptyState, ListRow, Notice, StatHero, kitText, longDayRo, todayIso as readTodayIso } from '@/components/kit'
import { RecoltareStepForm, type RecoltareAiPrefill } from '@/components/recoltari/RecoltareStepForm'
import { useTrackModuleView } from '@/lib/analytics/useTrackModuleView'
import { queryKeys } from '@/lib/query-keys'
import { aggregateRecoltariByCulegator, type RecoltareWorkerAggregate } from '@/lib/recoltari/aggregate-by-culegator'
import { formatKg, formatKgValue, formatLei, recoltariOfDay, summarizeRecoltariDay } from '@/lib/recoltari/day-view'
import { getCulegatori } from '@/lib/supabase/queries/culegatori'
import { getParcele } from '@/lib/supabase/queries/parcele'
import { getRecoltari } from '@/lib/supabase/queries/recoltari'
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

  // Ziua se citește doar în browser: serverul are alt fus orar, iar după miezul nopții ar afișa ziua greșită.
  const todayIso = useSyncExternalStore(subscribeToDayChange, readTodayIso, noServerDay)

  const [formOpen, setFormOpen] = useState(false)
  const [aiPrefill, setAiPrefill] = useState<RecoltareAiPrefill | null>(null)

  // ─── Deschiderea din adresă (`?add=1`, `?openForm=1&…` din chatul AI) ───
  const pathname = usePathname()
  const router = useRouter()
  const searchParams = useSearchParams()
  const queryString = searchParams.toString()
  const formRequestedInUrl = searchParams.get('add') === '1' || hasAiOpenForm(searchParams)

  // Parametrii se citesc o singură dată și se șterg înainte ca formularul să se deschidă. Altfel fereastra
  // și-ar pune intrarea în istoric peste o adresă cu `openForm=1`, iar un „înapoi” ulterior ar redeschide-o.
  const [seenQuery, setSeenQuery] = useState<string | null>(null)
  const [pendingFromUrl, setPendingFromUrl] = useState<{ prefill: RecoltareAiPrefill | null } | null>(null)
  if (seenQuery !== queryString) {
    setSeenQuery(queryString)
    if (formRequestedInUrl) {
      setPendingFromUrl({ prefill: hasAiOpenForm(searchParams) ? parseAiRecoltarePrefill(searchParams) : null })
    } else if (pendingFromUrl) {
      setPendingFromUrl(null)
      if (canWriteRecoltari) {
        setAiPrefill(pendingFromUrl.prefill)
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
    setFormOpen(true)
  }, [])

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

  const dayRecoltari = useMemo(
    () => (todayIso ? recoltariOfDay(recoltari, todayIso) : []),
    [recoltari, todayIso],
  )
  const summary = useMemo(() => summarizeRecoltariDay(dayRecoltari), [dayRecoltari])
  const workers = useMemo(() => {
    const names = new Map(culegatori.map((culegator) => [culegator.id, culegator.nume_prenume]))
    return aggregateRecoltariByCulegator({
      recoltari: dayRecoltari,
      resolveWorkerName: (workerId) => (workerId ? names.get(workerId)?.trim() || undefined : undefined),
    })
  }, [culegatori, dayRecoltari])

  const loading = todayIso === null || isLoading
  const hasRows = workers.length > 0

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
          subtitle={todayIso ? capitalize(longDayRo(todayIso)) : undefined}
          contentVariant="workspace"
        />
      }
      bottomBarFixed
      bottomBar={
        // Butonul mare ține locul butonului plutitor (+) pe această pagină.
        // Loc liber în stânga pentru bula „beta” (40 px, fixă la 16 px de margine, pe același rând).
        canWriteRecoltari && hasRows && !loading && !isError ? (
          <div className="mx-auto w-full max-w-md pl-18 pr-4">
            <div className="rounded-box shadow-2">{addButton}</div>
          </div>
        ) : undefined
      }
    >
      <div className="mx-auto w-full max-w-xl space-y-4 pt-3">
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
            <StatHero
              label="Total azi"
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

            <section aria-labelledby="recoltari-notati-azi" className="space-y-2">
              <h2 id="recoltari-notati-azi" className={cn('px-1 font-extrabold text-fg', kitText.card)}>
                Notați azi
              </h2>
              <ul className="space-y-2">
                {workers.map((worker) => (
                  <li key={worker.workerKey}>
                    <ListRow
                      title={worker.workerName}
                      detail={workerDetail(worker)}
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
          <EmptyState
            icon={<Scale />}
            title="Nimic notat azi"
            description={
              canWriteRecoltari
                ? 'Seara, notează kilogramele culese de fiecare culegător.'
                : 'Kilogramele culese azi apar aici după ce sunt notate.'
            }
            action={canWriteRecoltari ? <div className="w-64 max-w-full">{addButton}</div> : undefined}
          />
        )}
      </div>

      {todayIso ? (
        <RecoltareStepForm
          open={formOpen}
          onOpenChange={setFormOpen}
          recoltari={recoltari}
          parcele={parcele}
          culegatori={culegatori}
          todayIso={todayIso}
          defaultDate={todayIso}
          prefill={aiPrefill}
        />
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
