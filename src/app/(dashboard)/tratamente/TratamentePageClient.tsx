'use client'

import { useEffect, useMemo, useState, useSyncExternalStore } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Droplets, FlaskConical, Mountain, Plus, SprayCan } from 'lucide-react'
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
import { AnalizeTab } from '@/components/analize/AnalizeTab'
import { RezultatStepForm } from '@/components/analize/RezultatStepForm'
import { esteParcelaDeVanzare, laboratoareFolosite, type AnalizaRow } from '@/lib/analize/model'
import { getAnalize } from '@/lib/supabase/queries/analize'
import { PauzeNotice } from '@/components/tratamente/PauzeNotice'
import { TratamentStepForm, type ParcelaTratament } from '@/components/tratamente/TratamentStepForm'
import { useTrackModuleView } from '@/lib/analytics/useTrackModuleView'
import { useMeteo } from '@/hooks/useMeteo'
import { queryKeys } from '@/lib/query-keys'
import { getParcele } from '@/lib/supabase/queries/parcele'
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

  // ─── Tab-ul „Analize” (`?tab=analize`; `&noua=1&parcele=<id,id>` deschide „Analiză nouă”, din memento) ───
  const [tab, setTab] = useState<'aplicari' | 'analize'>(() => (searchParams.get('tab') === 'analize' ? 'analize' : 'aplicari'))
  const [analizaNouaOpen, setAnalizaNouaOpen] = useState(false)
  const [analizaEditata, setAnalizaEditata] = useState<AnalizaRow | null>(null)
  const [parceleAnalizaInitiale, setParceleAnalizaInitiale] = useState<string[]>([])
  const [rezultatOpen, setRezultatOpen] = useState(false)
  const [analizaRezultat, setAnalizaRezultat] = useState<AnalizaRow | null>(null)
  const [raportDeschis, setRaportDeschis] = useState<string | null>(null)
  const analizeQuery = useQuery({ queryKey: queryKeys.analize, queryFn: getAnalize, staleTime: 30_000, enabled: tab === 'analize', retry: false })

  const { pauze, aplicari, activitati, loading } = usePauzeActive(azi)
  const parceleQuery = useQuery({ queryKey: queryKeys.parcele, queryFn: getParcele, staleTime: 30_000, refetchOnWindowFocus: false })
  const catalogQuery = useQuery({ queryKey: queryKeys.produseFitosanitare, queryFn: getProduseFitosanitare, staleTime: 5 * 60_000, refetchOnWindowFocus: false })
  const volumeQuery = useQuery({ queryKey: queryKeys.volumeParcele, queryFn: getVolumeParcele, staleTime: 60_000, refetchOnWindowFocus: false })
  const meteo = useMeteo()

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

  const deschideAnalizaNoua = (parceleAlese: string[] = []) => {
    setAnalizaEditata(null)
    setParceleAnalizaInitiale(parceleAlese)
    setAnalizaNouaOpen(true)
  }

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

  const schimbaTab = (next: 'aplicari' | 'analize') => {
    setTab(next)
    router.replace(next === 'analize' ? '/tratamente?tab=analize' : '/tratamente', { scroll: false })
  }

  const dupaAnaliza = (analiza: AnalizaRow) => {
    void queryClient.invalidateQueries({ queryKey: queryKeys.analize })
    void queryClient.invalidateQueries({ queryKey: ['memento-analize'] })
    return analiza
  }

  const deschideFormular = (ciorna: CiornaTratament | null) => {
    setInitial(ciorna)
    setParcelaInitiala(null)
    setFormOpen(true)
  }

  // „+ Tratament” din fișa parcelei: `/tratamente?parcela=<id>` deschide formularul cu parcela aleasă.
  const parcelaDinUrl = searchParams.get('parcela')?.trim() ?? ''
  useEffect(() => {
    if (!parcelaDinUrl || !azi || parceleQuery.isLoading) return
    const exista = (parceleQuery.data ?? []).some((parcela) => parcela.id === parcelaDinUrl)
    queueMicrotask(() => {
      if (exista && poateScrie) {
        setInitial(null)
        setParcelaInitiala(parcelaDinUrl)
        setFormOpen(true)
      }
      router.replace('/tratamente', { scroll: false })
    })
  }, [azi, parcelaDinUrl, parceleQuery.data, parceleQuery.isLoading, poateScrie, router])

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

  const addButton =
    tab === 'analize' ? (
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
  const eroare = parceleQuery.isError
  const loadingAll = loading || parceleQuery.isLoading

  return (
    <AppShell
      header={<ScreenHeader title="Tratamente" backHref="/mai-mult" />}
      bottomBarFixed
      bottomBar={
        !loadingAll && poateScrie ? (
          <div className="mx-auto w-full max-w-md pl-18 pr-4">
            <div className="rounded-box shadow-2">{addButton}</div>
          </div>
        ) : undefined
      }
    >
      <ScreenBody className="space-y-3.5 pb-28">
        <Segments
          aria-label="Tratamente"
          options={[
            { value: 'aplicari', label: 'Aplicări' },
            { value: 'analize', label: 'Analize' },
          ]}
          value={tab}
          onValueChange={schimbaTab}
        />

        {tab === 'analize' && azi ? (
          <>
            <div className="hidden md:block">{poateScrie ? addButton : null}</div>
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
        />
      ) : null}
    </AppShell>
  )
}
