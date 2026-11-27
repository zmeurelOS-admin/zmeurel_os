'use client'

import { useEffect, useMemo, useState, useSyncExternalStore } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Droplets, FlaskConical, Mountain, Package, Plus, SprayCan } from 'lucide-react'
import { useRouter, useSearchParams } from 'next/navigation'

import { AppShell } from '@/components/app/AppShell'
import { useDashboardAuth } from '@/components/app/DashboardAuthContext'
import { accessLevelForModule } from '@/lib/farm-members/access'
import {
  BottomSheet,
  Button,
  EmptyState,
  FilterPills,
  ListRow,
  Notice,
  Segments,
  StatusPill,
  SummaryList,
  SummaryRow,
  kitText,
  type StatusTone,
} from '@/components/kit'
import { ScreenBody, ScreenHeader } from '@/components/setari/SetariUi'
import { AnalizaNouaStepForm } from '@/components/analize/AnalizaNouaStepForm'
import { CapcaneTab } from '@/components/capcane/CapcaneTab'
import { MonteazaStepForm } from '@/components/capcane/MonteazaStepForm'
import { VerificaStepForm } from '@/components/capcane/VerificaStepForm'
import { capcaneDeVerificat } from '@/lib/capcane'
import { useCapcane } from '@/lib/capcane/useCapcane'
import { AnalizeTab } from '@/components/analize/AnalizeTab'
import { RezultatStepForm } from '@/components/analize/RezultatStepForm'
import { esteParcelaDeVanzare, laboratoareFolosite, type AnalizaRow } from '@/lib/analize/model'
import { AnalizeIndisponibileError, getAnalize } from '@/lib/supabase/queries/analize'
import { PauzeNotice } from '@/components/tratamente/PauzeNotice'
import { PlanTab, type DeschideLinie } from '@/components/plan/PlanTab'
import { PlanNouStepForm, type VariantaPlan } from '@/components/plan/PlanNouStepForm'
import { anPlanNou, ciornaDinLinie, eticheta, interventiiText } from '@/lib/plan'
import { usePlan } from '@/lib/plan/usePlan'
import { sarLinie } from '@/lib/supabase/queries/plan'
import { TratamentStepForm, type ParcelaTratament } from '@/components/tratamente/TratamentStepForm'
import { useTrackModuleView } from '@/lib/analytics/useTrackModuleView'
import { useMeteo } from '@/hooks/useMeteo'
import { queryKeys } from '@/lib/query-keys'
import { getParcele } from '@/lib/supabase/queries/parcele'
import { getIesiriAplicari, getMagazieStocSauNimic } from '@/lib/supabase/queries/magazie'
import { iesiriPeLot, textIesiri } from '@/lib/magazie/formular'
import { rezumatMagazie } from '@/lib/magazie/stoc'
import { anuleazaPlanificare, getProduseFitosanitare, getVolumeParcele, marcheazaFacut } from '@/lib/supabase/queries/tratamente'
import { ciornaDinTratament, type CiornaTratament } from '@/lib/tratamente/formular'
import { usePauzeActive } from '@/lib/tratamente/hooks'
import {
  construiesteJurnal,
  potrivesteFiltru,
  textParcele,
  textProduse,
  type FiltruJurnal,
  type RandJurnal,
} from '@/lib/tratamente/jurnal'
import { ETICHETA_TIP, type TipJurnal } from '@/lib/tratamente/model'
import { pauzeOrdonate } from '@/lib/tratamente/pauza'
import { aziRo, ziCuDataRo, zileText, ZiCuDataRo, ziRelativaRo } from '@/lib/tratamente/zile'
import { toast } from '@/lib/ui/toast'
import { cn } from '@/lib/utils'

// ─── Ziua de azi, în ora României (se schimbă singură peste noapte) ───────────

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
const readToday = () => aziRo()
const noServerDay = () => null

const ICON_TIP: Record<TipJurnal, React.ReactNode> = {
  stropire: <SprayCan aria-hidden />,
  fertirigare: <Droplets aria-hidden />,
  sol: <Mountain aria-hidden />,
  altele: <FlaskConical aria-hidden />,
}

type TabTratamente = 'aplicari' | 'plan' | 'capcane' | 'analize'
const tabDinUrl = (value: string | null): TabTratamente => (value === 'analize' || value === 'capcane' || value === 'plan' ? value : 'aplicari')

const LUNI = ['Ianuarie', 'Februarie', 'Martie', 'Aprilie', 'Mai', 'Iunie', 'Iulie', 'August', 'Septembrie', 'Octombrie', 'Noiembrie', 'Decembrie']

function stareRand(rand: RandJurnal, azi: string): { text: string; tone: StatusTone } {
  if (rand.importat) return { text: 'Importat', tone: 'neutral' }
  if (rand.stare === 'planificat') {
    if (rand.zi && rand.zi < azi) return { text: 'Planificat, întârziat', tone: 'warning' }
    return { text: 'Planificat', tone: 'info' }
  }
  if (!rand.pauza) return { text: 'Fără pauză', tone: 'success' }
  if (rand.pauza.panaLa && rand.pauza.panaLa > azi) return { text: `Pauză până ${ziCuDataRo(rand.pauza.panaLa)}`, tone: 'warning' }
  return { text: `Pauză ${zileText(rand.pauza.zile)}, încheiată`, tone: 'neutral' }
}

function TipIcon({ tip }: { tip: TipJurnal }) {
  return (
    <span
      className={cn(
        'flex size-11 shrink-0 items-center justify-center rounded-full [&_svg]:size-5',
        tip === 'stropire' && 'bg-primary-soft text-primary',
        tip === 'fertirigare' && 'bg-info-bg text-info-text',
        (tip === 'sol' || tip === 'altele') && 'bg-surface-muted text-fg',
      )}
      aria-hidden
    >
      {ICON_TIP[tip]}
    </span>
  )
}

export function TratamentePageClient() {
  useTrackModuleView('tratamente')
  const queryClient = useQueryClient()
  const searchParams = useSearchParams()
  const router = useRouter()
  const { memberRole, memberAccess } = useDashboardAuth()
  const esteProprietar = memberRole !== 'operator'
  // Operatorul cu `tratamente: read` doar vede jurnalul; baza de date refuză oricum scrierea (`operator_can_write('tratamente')`).
  const isOperator = memberRole === 'operator'
  const poateScrie = !isOperator || accessLevelForModule(memberAccess, 'tratamente') === 'write'

  const azi = useSyncExternalStore(subscribeToDayChange, readToday, noServerDay)
  const [fila, setFila] = useState<'facute' | 'planificate'>(() => (searchParams.get('fila') === 'planificate' ? 'planificate' : 'facute'))
  const [filtru, setFiltru] = useState<FiltruJurnal>('toate')
  const [deschis, setDeschis] = useState<RandJurnal | null>(null)
  const [sheetOpen, setSheetOpen] = useState(false)
  const [formOpen, setFormOpen] = useState(false)
  const [initial, setInitial] = useState<CiornaTratament | null>(null)
  const [busy, setBusy] = useState<'facut' | 'anulat' | null>(null)
  const [parcelaInitiala, setParcelaInitiala] = useState<string | null>(null)

  // ─── Taburile: Aplicări · Plan (`?tab=plan`) · Capcane (`?tab=capcane`) · Analize (`?tab=analize`;
  // `&noua=1&parcele=<id,id>` deschide „Analiză nouă”, din memento). ───
  const [tab, setTab] = useState<TabTratamente>(() => tabDinUrl(searchParams.get('tab')))
  const [analizaNouaOpen, setAnalizaNouaOpen] = useState(false)
  const [analizaEditata, setAnalizaEditata] = useState<AnalizaRow | null>(null)
  const [parceleAnalizaInitiale, setParceleAnalizaInitiale] = useState<string[]>([])
  const [rezultatOpen, setRezultatOpen] = useState(false)
  const [analizaRezultat, setAnalizaRezultat] = useState<AnalizaRow | null>(null)
  const [raportDeschis, setRaportDeschis] = useState<string | null>(null)
  const analizeQuery = useQuery({ queryKey: queryKeys.analize, queryFn: getAnalize, staleTime: 30_000, enabled: tab === 'analize', retry: false })

  // ─── Planul pe stadii (promptul 30): tab-ul Plan și rândul „Plan: …” din Aplicări ───
  const plan = usePlan(azi, { enabled: tab === 'plan' || tab === 'aplicari' })
  const [planNouOpen, setPlanNouOpen] = useState(false)
  const [planVarianta, setPlanVarianta] = useState<VariantaPlan | null>(null)
  const [dinPlan, setDinPlan] = useState<{ linieId: string; sursa: string; onSarPeste: ((motiv: string | null) => Promise<void>) | null } | null>(null)

  // ─── Capcanele (promptul 29) ───
  const capcane = useCapcane(azi, { enabled: tab === 'capcane' })
  const [monteazaOpen, setMonteazaOpen] = useState(false)
  const [verificaOpen, setVerificaOpen] = useState(false)
  const grupuriDeVerificat = useMemo(() => {
    if (!azi) return []
    const active = capcane.grupuri.filter((grup) => grup.status === 'activa')
    const scadente = capcaneDeVerificat(active, azi).grupuri
    // Nimic scadent azi: „Verifică acum” verifică toate grupurile montate.
    return scadente.length > 0 ? scadente : active
  }, [azi, capcane.grupuri])

  const { pauze, aplicari, activitati, loading } = usePauzeActive(azi)
  const parceleQuery = useQuery({ queryKey: queryKeys.parcele, queryFn: getParcele, staleTime: 30_000, refetchOnWindowFocus: false })
  const catalogQuery = useQuery({ queryKey: queryKeys.produseFitosanitare, queryFn: getProduseFitosanitare, staleTime: 5 * 60_000, refetchOnWindowFocus: false })
  const volumeQuery = useQuery({ queryKey: queryKeys.volumeParcele, queryFn: getVolumeParcele, staleTime: 60_000, refetchOnWindowFocus: false })
  const meteo = useMeteo()
  // Magazia (promptul 28): rândul de sus și „−1,2 kg din magazie” pe aplicări. Fără migrare: `null` / listă goală.
  const magazieQuery = useQuery({ queryKey: queryKeys.magazieStoc, queryFn: getMagazieStocSauNimic, staleTime: 30_000, enabled: tab === 'aplicari' })
  const iesiriQuery = useQuery({ queryKey: queryKeys.magazieIesiri, queryFn: getIesiriAplicari, staleTime: 30_000, enabled: tab === 'aplicari' })
  const rezumatMag = magazieQuery.data ? rezumatMagazie(magazieQuery.data) : null

  const parcele: ParcelaTratament[] = useMemo(
    () =>
      (parceleQuery.data ?? []).map((parcela) => ({
        ...parcela,
        volum_solutie_l: volumeQuery.data?.[parcela.id] ?? null,
      })),
    [parceleQuery.data, volumeQuery.data],
  )
  const numeParcele = useMemo(() => new Map(parcele.map((parcela) => [parcela.id, parcela.nume_parcela?.trim() || 'Parcelă'])), [parcele])
  const catalog = useMemo(() => catalogQuery.data ?? [], [catalogQuery.data])
  const catalogPeId = useMemo(() => new Map(catalog.map((produs) => [produs.id, produs])), [catalog])

  const jurnal = useMemo(() => construiesteJurnal({ aplicari, activitati }), [aplicari, activitati])
  const lista = (fila === 'facute' ? jurnal.facute : jurnal.planificate).filter((rand) => potrivesteFiltru(rand, filtru))
  const pauzeLista = pauzeOrdonate(pauze)

  const subtitlu = useMemo(() => {
    if (!azi) return undefined
    const luna = azi.slice(0, 7)
    const facuteLuna = jurnal.facute.filter((rand) => rand.zi?.startsWith(luna)).length
    return `${LUNI[Number(azi.slice(5, 7)) - 1]} · ${facuteLuna} ${facuteLuna === 1 ? 'făcut' : 'făcute'} · ${jurnal.planificate.length} ${jurnal.planificate.length === 1 ? 'planificat' : 'planificate'}`
  }, [azi, jurnal])

  const parceleDeVanzare = useMemo(
    () => parcele.filter(esteParcelaDeVanzare).map((parcela) => ({ id: parcela.id, nume: parcela.nume_parcela?.trim() || 'Parcelă' })),
    [parcele],
  )
  const laboratoare = useMemo(() => laboratoareFolosite(analizeQuery.data ?? []), [analizeQuery.data])
  // Fără migrarea analizelor nu se poate salva nimic: fără „Analiză nouă”.
  const analizeIndisponibile = analizeQuery.error instanceof AnalizeIndisponibileError

  const deschideAnalizaNoua = (parceleAlese: string[] = []) => {
    setAnalizaEditata(null)
    setParceleAnalizaInitiale(parceleAlese)
    setAnalizaNouaOpen(true)
  }

  // Din fișa parcelei: `/tratamente?tab=analize&raport=<id>` deschide raportul analizei.
  const raportDinUrl = searchParams.get('raport')?.trim() ?? ''
  useEffect(() => {
    if (!raportDinUrl) return
    queueMicrotask(() => {
      setTab('analize')
      setRaportDeschis(raportDinUrl)
      router.replace('/tratamente?tab=analize', { scroll: false })
    })
  }, [raportDinUrl, router])

  // Deep link-ul „Am trimis” din memento: `/tratamente?tab=analize&noua=1&parcele=a,b`.
  const nouaDinUrl = searchParams.get('noua') === '1'
  const parceleDinUrl = searchParams.get('parcele') ?? ''
  useEffect(() => {
    if (!nouaDinUrl || !azi || parceleQuery.isLoading) return
    queueMicrotask(() => {
      setTab('analize')
      if (poateScrie) deschideAnalizaNoua(parceleDinUrl.split(',').map((id) => id.trim()).filter(Boolean))
      router.replace('/tratamente?tab=analize', { scroll: false })
    })
  }, [azi, nouaDinUrl, parceleDinUrl, parceleQuery.isLoading, poateScrie, router])

  const schimbaTab = (next: TabTratamente) => {
    setTab(next)
    router.replace(next === 'aplicari' ? '/tratamente' : `/tratamente?tab=${next}`, { scroll: false })
  }

  // „Fă un tratament pe …” din verificarea capcanelor: formularul de tratament cu parcela aleasă.
  const tratamentPeParcela = (parcelaId: string) => {
    if (!poateScrie) return
    setDinPlan(null)
    setInitial(null)
    setParcelaInitiala(parcelaId)
    setFormOpen(true)
  }

  const dupaAnaliza = (analiza: AnalizaRow) => {
    void queryClient.invalidateQueries({ queryKey: queryKeys.analize })
    void queryClient.invalidateQueries({ queryKey: ['memento-analize'] })
    return analiza
  }

  const deschideFormular = (ciorna: CiornaTratament | null) => {
    setInitial(ciorna)
    setParcelaInitiala(null)
    setDinPlan(null)
    setFormOpen(true)
  }

  // Atingerea unei intervenții din plan: formularul de tratament completat (parcele, produse, doze, metodă, linia).
  const deschideDinPlan = ({ plan: p, linie, parcelaIds, stadiuLabel }: DeschideLinie) => {
    if (!poateScrie || !azi) return
    const an = Number(azi.slice(0, 4))
    setInitial(ciornaDinLinie(linie, parcelaIds, catalogPeId))
    setParcelaInitiala(null)
    setDinPlan({
      linieId: linie.id,
      sursa: `${p.nume} · ${stadiuLabel}`,
      onSarPeste: plan.disponibil
        ? async (motiv) => {
            await sarLinie({ linieId: linie.id, parcelaIds, an, motiv })
            await queryClient.invalidateQueries({ queryKey: queryKeys.plan })
            toast.success('Sărit. Linia rămâne în plan, tăiată.')
          }
        : null,
    })
    setFormOpen(true)
  }

  const deschidePlanNou = (varianta: VariantaPlan | null) => {
    setPlanVarianta(varianta)
    setPlanNouOpen(true)
  }

  // Din Acasă: `/tratamente?tab=capcane&verifica=1` deschide „Verifică acum”.
  const verificaDinUrl = searchParams.get('verifica') === '1'
  useEffect(() => {
    if (!verificaDinUrl || !azi || capcane.loading) return
    queueMicrotask(() => {
      setTab('capcane')
      if (poateScrie && grupuriDeVerificat.length > 0) setVerificaOpen(true)
      router.replace('/tratamente?tab=capcane', { scroll: false })
    })
  }, [azi, capcane.loading, grupuriDeVerificat.length, poateScrie, router, verificaDinUrl])

  // „+ Tratament” din fișa parcelei: `/tratamente?parcela=<id>` deschide formularul cu parcela aleasă.
  const parcelaDinUrl = searchParams.get('parcela')?.trim() ?? ''
  useEffect(() => {
    if (!parcelaDinUrl || !azi || parceleQuery.isLoading) return
    const exista = (parceleQuery.data ?? []).some((parcela) => parcela.id === parcelaDinUrl)
    queueMicrotask(() => {
      if (exista && poateScrie) {
        setDinPlan(null)
        setInitial(null)
        setParcelaInitiala(parcelaDinUrl)
        setFormOpen(true)
      }
      router.replace('/tratamente', { scroll: false })
    })
  }, [azi, parcelaDinUrl, parceleQuery.data, parceleQuery.isLoading, poateScrie, router])

  // Din fișa unui produs din Magazie: `/tratamente?aplicare=<id>` deschide tratamentul acelei aplicări.
  const aplicareDinUrl = searchParams.get('aplicare')?.trim() ?? ''
  useEffect(() => {
    if (!aplicareDinUrl || loading) return
    const rand = [...jurnal.facute, ...jurnal.planificate].find((item) => item.aplicari.some((aplicare) => aplicare.id === aplicareDinUrl))
    queueMicrotask(() => {
      if (rand) {
        setTab('aplicari')
        setFila(rand.stare === 'planificat' ? 'planificate' : 'facute')
        setDeschis(rand)
        setSheetOpen(true)
      }
      router.replace('/tratamente', { scroll: false })
    })
  }, [aplicareDinUrl, jurnal, loading, router])

  const repeta = (rand: RandJurnal) => {
    const ciorna = ciornaDinTratament(rand.aplicari, new Set(parcele.map((parcela) => parcela.id)), catalogPeId)
    setSheetOpen(false)
    // Foaia se închide înainte să se deschidă formularul (nimic peste un formular pe pași).
    window.setTimeout(() => deschideFormular(ciorna), 180)
  }

  const schimbaStarea = async (rand: RandJurnal, actiune: 'facut' | 'anulat') => {
    if (busy) return
    setBusy(actiune)
    try {
      const ids = rand.aplicari.map((aplicare) => aplicare.id)
      if (actiune === 'facut') await marcheazaFacut(ids)
      else await anuleazaPlanificare(ids)
      await queryClient.invalidateQueries({ queryKey: queryKeys.tratamente })
      setSheetOpen(false)
      toast.success(
        actiune === 'facut'
          ? rand.pauza
            ? `Notat ca făcut azi. Pauza pentru ${textParcele(rand.parcelaIds, numeParcele)} a pornit.`
            : 'Notat ca făcut azi.'
          : 'Planificarea a fost anulată.',
      )
    } catch (error) {
      const message = error instanceof Error ? error.message : ''
      toast.error(/row-level security|42501/i.test(message) ? 'Nu ai drept de scriere pe tratamente.' : message || 'Nu s-a salvat. Încearcă din nou.')
    } finally {
      setBusy(null)
    }
  }

  // Rândurile, cu ziua deasupra când se schimbă.
  let ziAnterioara: string | null | undefined
  const randuri = lista.map((rand) => {
    const antet = rand.zi !== ziAnterioara ? (rand.zi ? ziRelativaRo(rand.zi, azi ?? rand.zi) : 'Fără dată') : null
    ziAnterioara = rand.zi
    const stare = azi ? stareRand(rand, azi) : null
    const dinMagazie =
      rand.stare !== 'planificat' && !rand.importat
        ? textIesiri(iesiriPeLot(rand.aplicari.map((aplicare) => aplicare.id), iesiriQuery.data ?? []))
        : null
    return (
      <li key={rand.key} className="space-y-2">
        {antet ? <h3 className={cn('px-1 pt-1 font-bold uppercase tracking-wide text-fg-subtle', kitText.helper)}>{antet}</h3> : null}
        <ListRow
          avatar={false}
          leading={<TipIcon tip={rand.tip} />}
          title={ETICHETA_TIP[rand.tip]}
          detail={
            <span className="flex flex-col gap-1.5">
              <span>{textProduse(rand.produse) || '—'}</span>
              {dinMagazie ? <span className="font-semibold text-fg">{dinMagazie}</span> : null}
              <span className="flex flex-wrap gap-1.5">
                <StatusPill tone="neutral">{textParcele(rand.parcelaIds, numeParcele, parcele.length)}</StatusPill>
                {stare ? <StatusPill tone={stare.tone}>{stare.text}</StatusPill> : null}
              </span>
            </span>
          }
          onClick={() => {
            setDeschis(rand)
            setSheetOpen(true)
          }}
        />
      </li>
    )
  })

  const capcaneButoane = (
    <div className="grid grid-cols-2 gap-2.5">
      <Button type="button" variant="primary" size="touch-lg" className="w-full" disabled={grupuriDeVerificat.length === 0} onClick={() => setVerificaOpen(true)}>
        Verifică acum
      </Button>
      <Button type="button" variant="neutral" size="touch-lg" className="w-full" onClick={() => setMonteazaOpen(true)}>
        <Plus aria-hidden />
        Montează
      </Button>
    </div>
  )
  const addButton =
    tab === 'plan' ? (
      <Button type="button" variant="primary" size="touch-lg" className="w-full" onClick={() => deschidePlanNou(null)}>
        <Plus aria-hidden />
        Plan nou
      </Button>
    ) : tab === 'capcane' ? (
      capcaneButoane
    ) : tab === 'analize' ? (
      <Button type="button" variant="primary" size="touch-lg" className="w-full" onClick={() => deschideAnalizaNoua()}>
        <Plus aria-hidden />
        Analiză nouă
      </Button>
    ) : (
      <Button type="button" variant="primary" size="touch-lg" className="w-full" onClick={() => deschideFormular(null)}>
        <Plus aria-hidden />
        Tratament nou
      </Button>
    )
  // „Plan: la Maravilla urmează „Înflorit”, cu 2 intervenții.” (rândul din Aplicări, primul grup de făcut).
  const planRezumat = (() => {
    for (const c of plan.calculate) {
      const grup = c.grupuri[0]
      if (!grup) continue
      const unde = grup.parcelaIds.map((id) => numeParcele.get(id) ?? 'Parcelă').slice(0, 2).join(', ')
      return `Plan: la ${unde} e timpul pentru „${eticheta(grup.stadiu, c.plan.cultura_tip)}”, cu ${interventiiText(grup.linii.length)}.`
    }
    return null
  })()
  const eroare = parceleQuery.isError
  const loadingAll = loading || parceleQuery.isLoading

  return (
    <AppShell
      header={<ScreenHeader title="Tratamente" backHref="/mai-mult" />}
      bottomBarFixed
      bottomBar={
        !loadingAll && poateScrie && !(tab === 'analize' && analizeIndisponibile) && !(tab === 'capcane' && (capcane.indisponibil || capcane.loading)) && !(tab === 'plan' && plan.loading) ? (
          <div className="mx-auto w-full max-w-md px-4">
            <div className={cn('rounded-box', tab === 'capcane' ? 'bg-surface p-2 shadow-2' : 'shadow-2')}>{addButton}</div>
          </div>
        ) : undefined
      }
    >
      <ScreenBody className="space-y-3.5 pb-28">
        <Segments
          aria-label="Tratamente"
          options={[
            { value: 'aplicari', label: 'Aplicări' },
            { value: 'plan', label: 'Plan' },
            { value: 'capcane', label: 'Capcane' },
            { value: 'analize', label: 'Analize' },
          ]}
          value={tab}
          onValueChange={schimbaTab}
        />

        {tab === 'plan' && azi ? (
          <>
            <div className="hidden md:block">{poateScrie && !plan.loading ? addButton : null}</div>
            <PlanTab azi={azi} data={plan} poateScrie={poateScrie} onDeschideLinie={deschideDinPlan} onPlanNou={(varianta) => deschidePlanNou(varianta)} />
          </>
        ) : null}

        {tab === 'capcane' && azi ? (
          <>
            <div className="hidden md:block">{poateScrie && !capcane.indisponibil && !capcane.loading ? capcaneButoane : null}</div>
            <CapcaneTab
              azi={azi}
              grupuri={capcane.grupuri}
              starePeGrup={capcane.starePeGrup}
              numeParcele={numeParcele}
              loading={capcane.loading}
              error={capcane.error}
              indisponibil={capcane.indisponibil}
              poateScrie={poateScrie}
            />
          </>
        ) : null}

        {tab === 'analize' && azi ? (
          <>
            <div className="hidden md:block">{poateScrie && !analizeIndisponibile ? addButton : null}</div>
            <AnalizeTab
              azi={azi}
              parcele={parceleDeVanzare}
              numeParcele={numeParcele}
              aplicari={aplicari}
              activitati={activitati}
              poateScrie={poateScrie}
              esteProprietar={esteProprietar}
              onAnalizaNoua={() => deschideAnalizaNoua()}
              onEditeazaPrelevarea={(analiza) => {
                setAnalizaEditata(analiza)
                setParceleAnalizaInitiale([])
                setAnalizaNouaOpen(true)
              }}
              onAdaugaRezultat={(analiza) => {
                setAnalizaRezultat(analiza)
                setRezultatOpen(true)
              }}
              raportDeschis={raportDeschis}
              onRaportDeschisChange={setRaportDeschis}
            />
          </>
        ) : null}

        {tab === 'aplicari' ? (
          <>
        {subtitlu && !loadingAll ? <p className={cn('-mt-2 text-fg-muted', kitText.secondary)}>{subtitlu}</p> : null}

        <ListRow
          avatar={false}
          leading={
            <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-primary-soft text-primary [&_svg]:size-5" aria-hidden>
              <Package />
            </span>
          }
          title="Magazia"
          detail={
            magazieQuery.isLoading
              ? 'Se încarcă…'
              : rezumatMag
                ? rezumatMag.produse > 0
                  ? rezumatMag.text
                  : 'Notează ce ai cumpărat; tratamentele făcute scad singure'
                : 'Va merge după actualizarea bazei de date'
          }
          trailing={rezumatMag && rezumatMag.peTerminate > 0 ? <StatusPill tone="warning">{rezumatMag.peTerminate}</StatusPill> : undefined}
          onClick={() => router.push('/tratamente/magazie')}
        />

        {planRezumat ? (
          <Notice
            tone="info"
            title={planRezumat}
            action={
              <Button type="button" variant="neutral" size="touch" onClick={() => schimbaTab('plan')}>
                Vezi planul
              </Button>
            }
          />
        ) : null}

        {azi ? (
          <PauzeNotice pauze={pauzeLista.map((pauza) => ({ ...pauza, nume: numeParcele.get(pauza.parcelaId) ?? 'Parcelă' }))} azi={azi} />
        ) : null}

        {eroare ? (
          <Notice tone="danger" title="Parcelele nu s-au încărcat">
            Verifică internetul și deschide din nou pagina.
          </Notice>
        ) : null}

        {/* Pe desktop bara de jos nu există: butonul stă în pagină (ca la Recoltări). */}
        <div className="hidden md:block">{addButton}</div>

        <Segments
          aria-label="Ce tratamente arăt"
          options={[
            { value: 'facute', label: 'Făcute' },
            { value: 'planificate', label: 'Planificate', count: jurnal.planificate.length > 0 ? jurnal.planificate.length : undefined },
          ]}
          value={fila}
          onValueChange={setFila}
        />
        <FilterPills
          aria-label="Filtrează după metodă"
          options={[
            { value: 'toate', label: 'Toate' },
            { value: 'stropire', label: 'Stropiri' },
            { value: 'fertirigare', label: 'Fertirigare' },
            { value: 'altele', label: 'Altele' },
          ]}
          value={filtru}
          onValueChange={setFiltru}
        />

        {loadingAll ? (
          <div className="space-y-2" aria-busy="true" aria-label="Se încarcă tratamentele">
            <div className="h-[88px] animate-pulse rounded-box bg-surface-muted" />
            <div className="h-[88px] animate-pulse rounded-box bg-surface-muted" />
            <div className="h-[88px] animate-pulse rounded-box bg-surface-muted" />
          </div>
        ) : lista.length > 0 ? (
          <ul className="space-y-2">{randuri}</ul>
        ) : (
          <EmptyState
            icon={<SprayCan />}
            title={fila === 'facute' ? 'Niciun tratament notat' : 'Nimic planificat'}
            description={
              filtru !== 'toate'
                ? 'Nimic pentru filtrul ales.'
                : fila === 'facute'
                  ? 'Notează stropirile și fertirigările: pauza apare singură în Acasă și în Recoltări.'
                  : 'Planifică un tratament pe o zi: apare în Acasă la „De făcut azi”.'
            }
          />
        )}
          </>
        ) : null}
      </ScreenBody>

      <BottomSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        title={deschis ? `${ETICHETA_TIP[deschis.tip]}${deschis.zi ? ` · ${ZiCuDataRo(deschis.zi)}` : ''}` : 'Tratament'}
        footer={
          deschis && !deschis.importat && poateScrie ? (
            deschis.stare === 'planificat' ? (
              <div className="flex flex-col gap-2.5">
                <Button type="button" variant="primary" size="touch-lg" className="w-full" loading={busy === 'facut'} onClick={() => void schimbaStarea(deschis, 'facut')}>
                  Marchează făcut
                </Button>
                <Button type="button" variant="quiet" size="touch" className="w-full" loading={busy === 'anulat'} onClick={() => void schimbaStarea(deschis, 'anulat')}>
                  Anulează planificarea
                </Button>
              </div>
            ) : deschis.aplicari[0]?.produse.length ? (
              <Button type="button" variant="primary" size="touch-lg" className="w-full" onClick={() => repeta(deschis)}>
                Repetă tratamentul
              </Button>
            ) : null
          ) : null
        }
      >
        {deschis ? (
          <div className="space-y-3">
            {deschis.importat ? (
              <Notice tone="info" title="Importat din Activități">
                Notat înainte de modulul Tratamente. Se vede aici doar pentru citire; îl schimbi din Activități.
              </Notice>
            ) : null}
            <SummaryList>
              <SummaryRow label="Unde" value={textParcele(deschis.parcelaIds, numeParcele)} />
              <SummaryRow
                label={deschis.stare === 'planificat' ? 'Planificat' : 'Când'}
                value={deschis.zi ? ZiCuDataRo(deschis.zi) : 'Fără dată'}
              />
              {deschis.produse.map((produs, index) => (
                <SummaryRow key={`${produs.nume}-${index}`} label={index === 0 ? 'Produse' : ''} value={produs.cantitate ? `${produs.nume} · ${produs.cantitate}` : produs.nume} />
              ))}
              {(() => {
                const text = deschis.stare !== 'planificat' && !deschis.importat
                  ? textIesiri(iesiriPeLot(deschis.aplicari.map((aplicare) => aplicare.id), iesiriQuery.data ?? []))
                  : null
                return text ? <SummaryRow label="Magazia" value={text} /> : null
              })()}
              <SummaryRow
                label="Pauză"
                value={
                  deschis.pauza
                    ? `${zileText(deschis.pauza.zile)}${deschis.pauza.produs ? ` (${deschis.pauza.produs})` : ''}${deschis.pauza.panaLa ? ` · până ${ziCuDataRo(deschis.pauza.panaLa)}` : ''}`
                    : 'Fără pauză'
                }
              />
            </SummaryList>
            {!poateScrie && !deschis.importat ? (
              <p className={cn('text-fg-muted', kitText.helper)}>Ai doar citire pe tratamente. Proprietarul fermei îți poate da și scriere.</p>
            ) : null}
          </div>
        ) : null}
      </BottomSheet>

      {azi ? (
        <AnalizaNouaStepForm
          open={analizaNouaOpen}
          onOpenChange={setAnalizaNouaOpen}
          parcele={parceleDeVanzare}
          laboratoare={laboratoare}
          todayIso={azi}
          analiza={analizaEditata}
          parceleInitiale={parceleAnalizaInitiale}
          onSaved={dupaAnaliza}
        />
      ) : null}
      {azi ? (
        <RezultatStepForm
          open={rezultatOpen}
          onOpenChange={setRezultatOpen}
          analiza={analizaRezultat}
          todayIso={azi}
          onSaved={(analiza) => {
            dupaAnaliza(analiza)
            // „Salvează și fă raportul”: raportul se deschide după ce formularul s-a închis.
            if (analiza.status === 'conform') window.setTimeout(() => setRaportDeschis(analiza.id), 220)
          }}
        />
      ) : null}

      {azi ? (
        <MonteazaStepForm
          open={monteazaOpen}
          onOpenChange={setMonteazaOpen}
          todayIso={azi}
          parcele={parcele.map((parcela) => ({ id: parcela.id, nume: parcela.nume_parcela?.trim() || 'Parcelă' }))}
        />
      ) : null}
      {azi ? (
        <VerificaStepForm
          open={verificaOpen}
          onOpenChange={setVerificaOpen}
          todayIso={azi}
          grupuri={grupuriDeVerificat}
          verificari={capcane.verificari}
          numeParcele={numeParcele}
          praguri={capcane.praguri}
          inCoacere={capcane.inCoacere}
          onTratament={tratamentPeParcela}
        />
      ) : null}

      {azi ? (
        <TratamentStepForm
          open={formOpen}
          onOpenChange={setFormOpen}
          parcele={parcele}
          catalog={catalog}
          aplicari={aplicari}
          todayIso={azi}
          initial={initial}
          parcelaInitiala={parcelaInitiala}
          meteo={meteo.data ?? null}
          plan={dinPlan}
        />
      ) : null}

      {azi ? (
        <PlanNouStepForm
          open={planNouOpen}
          onOpenChange={setPlanNouOpen}
          todayIso={azi}
          varianta={planVarianta}
          parcele={parcele}
          aplicari={aplicari}
          stadiiSursa={anPlanNou(azi) - 1 === plan.an ? plan.stadiiAn : plan.stadiiTrecut}
          catalog={catalog}
        />
      ) : null}
    </AppShell>
  )
}
