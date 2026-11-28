'use client'

import { Suspense, useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'

import { Acasa } from '@/components/acasa/Acasa'
import { AcasaDesktop } from '@/components/acasa/AcasaDesktop'
import { NeincasatePeste30Acasa } from '@/components/acasa/NeincasatePeste30Acasa'
import { PrimiiPasi } from '@/components/acasa/PrimiiPasi'
import { MementoAcasa } from '@/components/analize/MementoAcasa'
import { AppShell } from '@/components/app/AppShell'
import { useDashboardAuth } from '@/components/app/DashboardAuthContext'
import { ErrorState } from '@/components/app/ErrorState'
import { PageHeader } from '@/components/app/PageHeader'
import { MementoCapcaneAcasa } from '@/components/capcane/MementoCapcaneAcasa'
import { BandaInstalare } from '@/components/pwa/BandaInstalare'
import { useLocFerma } from '@/hooks/useLocFerma'
import { useMeteo } from '@/hooks/useMeteo'
import { trackEvent } from '@/lib/analytics/trackEvent'
import { buildParcelDashboardStates } from '@/lib/dashboard/engine'
import { construiesteJurnalLucrari, lucrariPlanificateInZi } from '@/lib/lucrari/jurnal'
import { textCine } from '@/lib/lucrari/formular'
import { titluLucrare } from '@/lib/lucrari/tipuri'
import { culturileFermei } from '@/lib/parcele/culturi-ferma'
import { isParcelaDashboardRelevant } from '@/lib/parcele/dashboard-relevance'
import { queryKeys } from '@/lib/query-keys'
import { getSupabase } from '@/lib/supabase/client'
import { getActivitatiAgricole } from '@/lib/supabase/queries/activitati-agricole'
import { getCheltuieli } from '@/lib/supabase/queries/cheltuieli'
import { isPathAllowedForAccess } from '@/lib/farm-members/access'
import { useEsteDesktop } from '@/lib/ui/useEsteDesktop'
import { getComenzi } from '@/lib/supabase/queries/comenzi'
import { getLucrari } from '@/lib/supabase/queries/lucrari'
import { getSellableCal1StockSummary } from '@/lib/supabase/queries/miscari-stoc'
import { getParcele } from '@/lib/supabase/queries/parcele'
import { getRecoltari } from '@/lib/supabase/queries/recoltari'
import { getVanzari } from '@/lib/supabase/queries/vanzari'
import { getVanzariButasi } from '@/lib/supabase/queries/vanzari-butasi'
import { getTenantId } from '@/lib/tenant/get-tenant'
import { useAplicariTratament } from '@/lib/tratamente/hooks'
import { construiesteJurnal, planificateInZi, textParcele, textProduse } from '@/lib/tratamente/jurnal'
import { ETICHETA_TIP } from '@/lib/tratamente/model'
import { pauzeActive, pauzeOrdonate } from '@/lib/tratamente/pauza'
import type { Tables } from '@/types/supabase'

const EMPTY_LIST: never[] = []

type IntervalTratamentCultura = Pick<Tables<'culturi'>, 'id' | 'solar_id' | 'activa' | 'interval_tratament_zile'>

function toIsoDate(value: Date): string {
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`
}

function capitalizeaza(text: string): string {
  return text.charAt(0).toLocaleUpperCase('ro-RO') + text.slice(1)
}

/**
 * Acasă (promptul 34, §10): aceeași pagină pe telefon și pe desktop, o coloană de 720 px. Cardurile vechi de desktop
 * („Ce ai de făcut azi”, „Meteo azi”, „Recomandări pentru azi”, „Magazinul meu”, „Operațional și recent”) și editarea
 * layout-ului au ieșit; aici se încarcă doar ce arată Acasă.
 */
export default function DashboardPage() {
  const router = useRouter()
  const { memberRole, memberAccess } = useDashboardAuth()
  const proprietar = memberRole !== 'operator'
  // Promptul 35, §3: pe desktop (de la 1024 px) Acasă e tabloul de bord; sub, coloana de telefon, neschimbată.
  const esteDesktop = useEsteDesktop()
  // Promptul 33: vremea doar pentru o fermă cu loc (Setări › Ferma sau o parcelă cu coordonate).
  const locFerma = useLocFerma()
  const meteo = useMeteo({ enabled: locFerma.areLoc === true })
  const faraLocFerma = locFerma.areLoc === false
  const [currentDateTime] = useState(() => new Date())
  const currentDay = useMemo(() => {
    const value = new Date(currentDateTime)
    value.setHours(0, 0, 0, 0)
    return value
  }, [currentDateTime])

  useEffect(() => {
    trackEvent('open_dashboard', 'dashboard')
  }, [])

  useEffect(() => {
    const routesToPrefetch = ['/parcele', '/lucrari', '/recoltari', '/vanzari', '/comenzi', '/stocuri']
    const runPrefetch = () => routesToPrefetch.forEach((href) => router.prefetch(href))
    const requestIdle = (window as unknown as { requestIdleCallback?: (callback: () => void, options?: { timeout?: number }) => number })
      .requestIdleCallback
    const cancelIdle = (window as unknown as { cancelIdleCallback?: (id: number) => void }).cancelIdleCallback
    // Încărcarea rutelor așteaptă până browserul e liber, ca să nu concureze cu datele din Acasă.
    if (requestIdle && cancelIdle) {
      const idleId = requestIdle(() => runPrefetch(), { timeout: 2500 })
      return () => cancelIdle(idleId)
    }
    const timeoutId = window.setTimeout(runPrefetch, 1200)
    return () => window.clearTimeout(timeoutId)
  }, [router])

  const recoltariQuery = useQuery({ queryKey: queryKeys.recoltari, queryFn: getRecoltari, placeholderData: (previous) => previous })
  const parceleQuery = useQuery({ queryKey: queryKeys.parcele, queryFn: getParcele, placeholderData: (previous) => previous })
  // Lucrările, cu planificatele (Acasă: „De făcut azi” și „Planificată: …” din extrasezon).
  const lucrariQuery = useQuery({ queryKey: queryKeys.lucrari, queryFn: getLucrari, staleTime: 30_000, refetchOnWindowFocus: false })
  const activitatiQuery = useQuery({ queryKey: queryKeys.activitati, queryFn: getActivitatiAgricole, placeholderData: (previous) => previous })
  // Banii doar la proprietar (promptul 35): pentru operator, interogările de bani nu pornesc deloc.
  const vanzariQuery = useQuery({ queryKey: queryKeys.vanzari, queryFn: getVanzari, placeholderData: (previous) => previous, enabled: proprietar })
  // Material săditor livrat = venit (la data livrării).
  const vanzariButasiQuery = useQuery({ queryKey: queryKeys.vanzariButasi, queryFn: getVanzariButasi, placeholderData: (previous) => previous, enabled: proprietar })
  // Cheltuielile: doar pentru placa „Cheltuieli sezon · profit” din Acasă pe desktop, doar la proprietar.
  const cheltuieliQuery = useQuery({ queryKey: queryKeys.cheltuieli, queryFn: getCheltuieli, enabled: proprietar && esteDesktop })
  const comenziQuery = useQuery({ queryKey: queryKeys.comenzi, queryFn: getComenzi, placeholderData: (previous) => previous })
  const stocuriQuery = useQuery({ queryKey: queryKeys.stocGlobalCal1, queryFn: getSellableCal1StockSummary, placeholderData: (previous) => previous })

  const dashboardParcelaIds = useMemo(
    () => (parceleQuery.data ?? EMPTY_LIST).filter((parcela) => isParcelaDashboardRelevant(parcela)).map((parcela) => parcela.id),
    [parceleQuery.data],
  )

  // Intervalul de tratament al culturilor din solarii: intră în starea parcelelor („tratament depășit”).
  const treatmentIntervalsQuery = useQuery({
    queryKey: queryKeys.culturiTreatmentIntervals(dashboardParcelaIds.join(',')),
    enabled: dashboardParcelaIds.length > 0,
    queryFn: async (): Promise<IntervalTratamentCultura[]> => {
      const supabase = getSupabase()
      const tenantId = await getTenantId(supabase)
      const { data, error } = await supabase
        .from('culturi')
        .select('id,solar_id,activa,interval_tratament_zile')
        .eq('tenant_id', tenantId)
        .in('solar_id', dashboardParcelaIds)
      if (error) throw error
      return (data ?? []).map((row) => ({ id: row.id, solar_id: row.solar_id, activa: row.activa, interval_tratament_zile: row.interval_tratament_zile }))
    },
    placeholderData: (previous) => previous,
    staleTime: 5 * 60_000,
    refetchOnWindowFocus: false,
  })

  const coreQueries = [recoltariQuery, parceleQuery, activitatiQuery, ...(proprietar ? [vanzariQuery] : []), comenziQuery, stocuriQuery]
  const hasResolvedCoreData = coreQueries.some((query) => query.data !== undefined)
  const isLoading = !hasResolvedCoreData && coreQueries.some((query) => query.isLoading)
  const hasError = coreQueries.some((query) => query.isError)
  const errorMessage = coreQueries.map((query) => (query.error as Error | null)?.message).find(Boolean)

  const recoltari = recoltariQuery.data ?? EMPTY_LIST
  const parcele = parceleQuery.data ?? EMPTY_LIST
  // Culturile fermei, din parcele (promptul 31): `null` cât se încarcă parcelele.
  const culturiFerma = useMemo(() => (parceleQuery.data ? culturileFermei(parceleQuery.data) : null), [parceleQuery.data])
  const activitati = activitatiQuery.data ?? EMPTY_LIST
  const tratamenteQuery = useAplicariTratament()
  const aplicariTratament = tratamenteQuery.data ?? EMPTY_LIST
  const vanzari = vanzariQuery.data ?? EMPTY_LIST
  const vanzariButasi = vanzariButasiQuery.data ?? EMPTY_LIST
  const comenzi = comenziQuery.data ?? EMPTY_LIST

  const todayIso = useMemo(() => toIsoDate(currentDay), [currentDay])
  const todayLabel = useMemo(
    () => capitalizeaza(new Intl.DateTimeFormat('ro-RO', { weekday: 'long', day: 'numeric', month: 'long' }).format(currentDateTime)),
    [currentDateTime],
  )

  const parceleRelevante = useMemo(() => parcele.filter((parcela) => isParcelaDashboardRelevant(parcela)), [parcele])
  const idParceleRelevante = useMemo(() => new Set(parceleRelevante.map((parcela) => parcela.id)), [parceleRelevante])
  const recoltariRelevante = useMemo(
    () => recoltari.filter((row) => row.parcela_id != null && idParceleRelevante.has(String(row.parcela_id))),
    [recoltari, idParceleRelevante],
  )
  const activitatiRelevante = useMemo(
    () => activitati.filter((row) => row.parcela_id != null && idParceleRelevante.has(String(row.parcela_id))),
    [activitati, idParceleRelevante],
  )

  const treatmentIntervalByParcela = useMemo(() => {
    const byParcela = new Map<string, number>()
    for (const cultura of treatmentIntervalsQuery.data ?? EMPTY_LIST) {
      if (!cultura?.solar_id || cultura.activa === false) continue
      const interval = Number(cultura.interval_tratament_zile)
      if (!Number.isFinite(interval) || interval <= 0) continue
      const previous = byParcela.get(cultura.solar_id)
      if (!previous || interval < previous) byParcela.set(cultura.solar_id, interval)
    }
    return byParcela
  }, [treatmentIntervalsQuery.data])

  // Pauza din sursa unică (aplicările noi + activitățile vechi) și tratamentele planificate azi.
  const pauzePeParcela = useMemo(() => pauzeActive({ aplicari: aplicariTratament, activitati, ziua: todayIso }), [activitati, aplicariTratament, todayIso])
  const numeParcele = useMemo(() => new Map(parcele.map((parcela) => [parcela.id, parcela.nume_parcela?.trim() || 'Parcelă'])), [parcele])
  const tratamenteAzi = useMemo(
    () => planificateInZi(construiesteJurnal({ aplicari: aplicariTratament, activitati: [] }).planificate, todayIso),
    [aplicariTratament, todayIso],
  )
  const acasaPauze = useMemo(
    () => pauzeOrdonate(pauzePeParcela).map((pauza) => ({ ...pauza, nume: numeParcele.get(pauza.parcelaId) ?? 'Parcelă' })),
    [numeParcele, pauzePeParcela],
  )
  const lucrariAzi = useMemo(
    () => lucrariPlanificateInZi(construiesteJurnalLucrari(lucrariQuery.data ?? [], todayIso).planificate, todayIso),
    [lucrariQuery.data, todayIso],
  )
  const acasaLucrariAzi = useMemo(
    () =>
      lucrariAzi.map((rand) => ({
        key: rand.key,
        titlu: `${titluLucrare(rand)} planificată`,
        detaliu: [textParcele(rand.parcelaIds, numeParcele), textCine(rand.cine, memberRole !== 'operator')].filter(Boolean).join(' · '),
        ids: rand.randuri.map((row) => row.id),
      })),
    [lucrariAzi, memberRole, numeParcele],
  )
  const acasaTratamenteAzi = useMemo(
    () =>
      tratamenteAzi.map((rand) => ({
        key: rand.key,
        titlu: `${ETICHETA_TIP[rand.tip]} planificată`,
        detaliu: [textParcele(rand.parcelaIds, numeParcele), textProduse(rand.produse, false)].filter(Boolean).join(' · '),
        aplicareIds: rand.aplicari.map((aplicare) => aplicare.id),
        areProduseCuPauza: rand.pauza !== null,
        parceleText: textParcele(rand.parcelaIds, numeParcele),
      })),
    [numeParcele, tratamenteAzi],
  )

  const parcelStates = useMemo(
    () =>
      buildParcelDashboardStates({
        currentDay,
        parceleDashboard: parceleRelevante,
        activitatiDashboard: activitatiRelevante,
        recoltariDashboard: recoltariRelevante,
        treatmentIntervalByParcela,
        pauzePeParcela,
      }),
    [activitatiRelevante, currentDay, parceleRelevante, pauzePeParcela, recoltariRelevante, treatmentIntervalByParcela],
  )

  const vede = useMemo(() => {
    const poate = (href: string) => proprietar || isPathAllowedForAccess(href, memberAccess ?? [])
    return {
      recoltari: poate('/recoltari'),
      comenzi: poate('/comenzi'),
      stocuri: proprietar,
      parcele: proprietar || (memberAccess ?? []).some((item) => item.module === 'parcele'),
      tratamente: proprietar || (memberAccess ?? []).some((item) => item.module === 'tratamente'),
      lucrari: poate('/lucrari'),
    }
  }, [memberAccess, proprietar])

  return (
    <AppShell header={<PageHeader title="Acasă" subtitle={todayLabel} />}>
      <div className="mx-auto w-full max-w-modul space-y-3 pb-6">
        {hasError ? <ErrorState title="Acasă nu s-a încărcat" message={errorMessage ?? 'Verifică internetul și deschide din nou pagina.'} /> : null}
        {isLoading ? (
          <div className="space-y-3 pt-3" aria-busy="true" aria-label="Se încarcă Acasă">
            <div className="h-10 animate-pulse rounded-box bg-surface-muted" />
            <div className="h-28 animate-pulse rounded-box bg-surface-muted" />
            <div className="h-40 animate-pulse rounded-box bg-surface-muted" />
          </div>
        ) : null}

        {!isLoading && !hasError ? (
          <>
            {esteDesktop ? (
              <AcasaDesktop
                todayIso={todayIso}
                proprietar={proprietar}
                vede={vede}
                comenzi={comenzi}
                recoltari={recoltari}
                vanzari={proprietar ? vanzari : EMPTY_LIST}
                vanzariButasi={proprietar ? vanzariButasi : EMPTY_LIST}
                cheltuieli={proprietar ? (cheltuieliQuery.data ?? EMPTY_LIST) : EMPTY_LIST}
                parcele={parcele}
                aplicari={aplicariTratament}
                lucrari={lucrariQuery.data ?? EMPTY_LIST}
                stocKg={stocuriQuery.data ? stocuriQuery.data.disponibilCal1Kg : null}
                culturi={culturiFerma}
                meteoZile={meteo.data?.forecastZile}
                faraLoc={faraLocFerma}
                deFacut={
                  <>
                    <div className="empty:hidden">
                      <PrimiiPasi />
                    </div>
                    <div className="space-y-3 empty:hidden">
                      <Suspense fallback={null}>
                        <MementoAcasa azi={todayIso} proprietar={proprietar} />
                      </Suspense>
                      <MementoCapcaneAcasa azi={todayIso} />
                      <NeincasatePeste30Acasa comenzi={comenzi} azi={todayIso} proprietar={proprietar} />
                    </div>
                    <Acasa
                      doarDeFacut
                      todayIso={todayIso}
                      comenzi={comenzi}
                      recoltari={recoltari}
                      activitati={activitati}
                      vanzari={vanzari}
                      vanzariButasi={vanzariButasi}
                      stocDisponibilKg={stocuriQuery.data ? stocuriQuery.data.disponibilCal1Kg : null}
                      culturi={culturiFerma}
                      parcelStates={parcelStates}
                      meteo={meteo.data}
                      faraLoc={faraLocFerma}
                      pauze={acasaPauze}
                      tratamenteAzi={acasaTratamenteAzi}
                      lucrariAzi={acasaLucrariAzi}
                      lucrari={lucrariQuery.data}
                    />
                  </>
                }
              />
            ) : (
            <>
            {/* „Primii pași” (promptul 31): doar fermă reală, proprietar. */}
            <div className="empty:hidden">
              <PrimiiPasi />
            </div>

            {/* Analiza la fructe, capcanele și banii neîncasați de peste 30 de zile. */}
            <div className="space-y-3 empty:hidden">
              <Suspense fallback={null}>
                <MementoAcasa azi={todayIso} proprietar={proprietar} />
              </Suspense>
              <MementoCapcaneAcasa azi={todayIso} />
              <NeincasatePeste30Acasa comenzi={comenzi} azi={todayIso} proprietar={proprietar} />
            </div>

            {/* Promptul 34, §4: „Pune Caietul pe ecranul telefonului”, doar pe telefon, doar aici. */}
            <BandaInstalare />

            <Acasa
              todayIso={todayIso}
              comenzi={comenzi}
              recoltari={recoltari}
              activitati={activitati}
              vanzari={vanzari}
              vanzariButasi={vanzariButasi}
              stocDisponibilKg={stocuriQuery.data ? stocuriQuery.data.disponibilCal1Kg : null}
              culturi={culturiFerma}
              parcelStates={parcelStates}
              meteo={meteo.data}
              faraLoc={faraLocFerma}
              pauze={acasaPauze}
              tratamenteAzi={acasaTratamenteAzi}
              lucrariAzi={acasaLucrariAzi}
              lucrari={lucrariQuery.data}
            />
            </>
            )}
          </>
        ) : null}

      </div>
    </AppShell>
  )
}
