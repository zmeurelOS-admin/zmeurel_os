'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'

import { Button, CalendarPanel, Notice, StepForm, StepFormTitle, SuccessScreen, addDaysIso, kitText, useStepForm } from '@/components/kit'
import { useDashboardAuth } from '@/components/app/DashboardAuthContext'
import { queryKeys } from '@/lib/query-keys'
import { getMagazieStocSauNimic } from '@/lib/supabase/queries/magazie'
import { costEstimat, verificaMagazie } from '@/lib/magazie/formular'
import { creeazaProdusFerma, salveazaTratament, salveazaVolumeParcele, type TipProdusNou } from '@/lib/supabase/queries/tratamente'
import { avertizareCulesLaTratament } from '@/lib/analize/memento'
import { useMementoAnalize } from '@/lib/analize/useMementoAnalize'
import { avertismentMeteo, avertismenteStropire, type AplicareIstoric, type Avertisment } from '@/lib/tratamente/avertismente'
import {
  cantitateStropire,
  dozaDinCatalog,
  formatCantitate,
  formatKgTratament,
  kgFertirigare,
  modImplicit,
  suprafataHa,
  unitateImplicita,
  volumeDeSalvat,
  volumPropus,
  type ModDoza,
} from '@/lib/tratamente/doze'
import {
  aplicariDeSalvat,
  ceLipseste,
  ciornaDinTratament,
  pauzaCiorna,
  produsDinCatalog,
  cheieNoua,
  type CandTratament,
  type CiornaTratament,
  type ParcelaFormular,
  type ProdusCiorna,
} from '@/lib/tratamente/formular'
import { construiesteJurnal, textParcele, textProduse, type RandJurnal } from '@/lib/tratamente/jurnal'
import { ETICHETA_TIP, type AplicareRow, type MetodaFormular, type ProdusCatalog } from '@/lib/tratamente/model'
import { adaugaZile, ziCuDataRo, ziRelativaRo, ziuaRo } from '@/lib/tratamente/zile'
import { getParcelaCropRows } from '@/lib/parcele/crop-config'
import { searchKey } from '@/lib/format-ro'
import { hapticError, hapticSuccess } from '@/lib/utils/haptic'
import { cn } from '@/lib/utils'

import { AlegeProdus, ProdusNou, type ProdusRecent } from './AlegeProdus'
import { PasCand, type CandTip, type MagazieTratament, type RezumatTratament } from './PasCand'
import { PasDetalii } from './PasDetalii'
import { PasMetoda, type RepetaOptiune } from './PasMetoda'

export type ParcelaTratament = ParcelaFormular & {
  cultura?: string | null
  tip_fruct?: string | null
  soi?: string | null
  soi_plantat?: string | null
  observatii?: string | null
  rol?: string | null
}

export interface TratamentStepFormProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  parcele: readonly ParcelaTratament[]
  catalog: readonly ProdusCatalog[]
  aplicari: readonly AplicareRow[]
  todayIso: string
  /** „Repetă” din jurnal: formularul pornește direct la pasul 2, cu ciorna asta. */
  initial: CiornaTratament | null
  /** Din fișa parcelei („+ Tratament”): parcela vine aleasă, oricare ar fi metoda. */
  parcelaInitiala?: string | null
  meteo: {
    spray?: { canSpray: boolean; reason?: string } | null
    current?: { temp: number | null; windSpeed: number | null } | null
  } | null
}

const STEPS = ['metoda', 'detalii', 'cand'] as const
const NETWORK_ERROR = /failed to fetch|networkerror|network request failed|load failed|fetch failed/i

function mesajEroare(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error ?? '')
  const code = (error as { code?: string } | null)?.code
  if (NETWORK_ERROR.test(message)) return 'Nu există conexiune la internet. Când revine, apasă din nou „Salvează”: tratamentul nu se dublează.'
  if (code === '42501' || /row-level security/i.test(message)) return 'Nu ai drept de scriere pe tratamente. Cere-i proprietarului fermei acces.'
  return message || 'Tratamentul nu s-a salvat. Încearcă din nou.'
}

const EMPTY: CiornaTratament = { metoda: 'stropire', parcelaIds: [], produse: [], mod: 'hl', volumL: null }

const esteZmeura = (parcela: ParcelaTratament) => {
  const culturi = [parcela.cultura, parcela.tip_fruct, ...getParcelaCropRows(parcela).map((row) => row.culture)]
  return culturi.some((cultura) => searchKey(cultura).startsWith('zmeur'))
}

/** Istoricul aplicărilor făcute, pentru avertismente. */
function istoricDin(aplicari: readonly AplicareRow[]): AplicareIstoric[] {
  return aplicari
    .filter((aplicare) => aplicare.status === 'aplicata')
    .map((aplicare) => ({
      parcelaId: aplicare.parcela_id,
      zi: ziuaRo(aplicare.data_aplicata) ?? '',
      produse:
        aplicare.produse.length > 0
          ? aplicare.produse.map((produs) => ({ produsId: produs.produs_id, nume: produs.produs_nume_snapshot, frac: produs.frac_irac_snapshot }))
          : aplicare.produs
            ? [{ produsId: aplicare.produs.id, nume: aplicare.produs.nume_comercial ?? 'Produs', frac: aplicare.produs.frac_irac }]
            : [],
    }))
    .filter((item) => item.zi !== '')
}

/**
 * Tratament nou, pe pași: ce faci (sau „Repetă”) → unde și cu ce → când, cu pauza rezultată.
 * Alegerea produsului și calendarul țin locul conținutului pasului (nimic nu se deschide peste formular).
 * Cheia formularului (`form.clientSyncId`) e lotul aplicărilor: aceeași la reîncercare, deci fără dublare.
 */
export function TratamentStepForm({ open, onOpenChange, parcele, catalog, aplicari, todayIso, initial, parcelaInitiala = null, meteo }: TratamentStepFormProps) {
  const queryClient = useQueryClient()
  const { memberRole } = useDashboardAuth()
  const esteProprietar = memberRole !== 'operator'
  // Magazia (promptul 28): stocul, pentru „în magazie X · rămân Y”. Fără migrare: `null`, formularul merge ca azi.
  const magazieQuery = useQuery({ queryKey: queryKeys.magazieStoc, queryFn: getMagazieStocSauNimic, enabled: open, staleTime: 30_000, retry: false })
  const form = useStepForm({
    steps: STEPS,
    open,
    initialStep: initial ? 'detalii' : undefined,
    analytics: { moduleName: 'tratamente' },
  })

  const [ciorna, setCiorna] = useState<CiornaTratament>(EMPTY)
  const [volumEditat, setVolumEditat] = useState(false)
  const [vedere, setVedere] = useState<null | 'produs' | 'produs-nou' | 'calendar' | 'renunta'>(null)
  const [cand, setCand] = useState<CandTip>('acum')
  const [zi, setZi] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [saved, setSaved] = useState<{ titlu: string; detaliu: string } | null>(null)

  // ─── Reset la o cheie nouă (aceleași intrări → același rezultat, chiar dacă rulează de două ori) ───
  const [sessionKey, setSessionKey] = useState<string | null>(null)
  if (!open && sessionKey !== null) setSessionKey(null)
  if (open && sessionKey !== form.clientSyncId) {
    setSessionKey(form.clientSyncId)
    setCiorna(initial ?? (parcelaInitiala ? { ...EMPTY, parcelaIds: [parcelaInitiala] } : EMPTY))
    setVolumEditat(false)
    setVedere(null)
    setCand('acum')
    setZi(null)
    setSaving(false)
    setSaveError(null)
    setSaved(null)
  }

  const liveKeyRef = useRef<string | null>(null)
  useEffect(() => {
    liveKeyRef.current = open ? form.clientSyncId : null
  }, [open, form.clientSyncId])

  // ─── Derivate ───
  const parceleSortate = useMemo(
    () => [...parcele].sort((a, b) => Number(b.rol === 'comercial') - Number(a.rol === 'comercial')),
    [parcele],
  )
  const numeParcele = useMemo(() => new Map(parcele.map((parcela) => [parcela.id, parcela.nume_parcela?.trim() || 'Parcelă'])), [parcele])
  const alese = parceleSortate.filter((parcela) => ciorna.parcelaIds.includes(parcela.id))
  const propus = volumPropus(alese)
  const volumL = volumEditat ? ciorna.volumL : propus
  const ciornaEfectiva = useMemo(() => ({ ...ciorna, volumL }), [ciorna, volumL])
  const lipsa = ceLipseste(ciornaEfectiva, parceleSortate)
  const catalogPeId = useMemo(() => new Map(catalog.map((produs) => [produs.id, produs])), [catalog])

  const jurnal = useMemo(() => construiesteJurnal({ aplicari, activitati: [] }), [aplicari])
  const istoric = useMemo(() => istoricDin(aplicari), [aplicari])
  const ziTratament = cand === 'acum' ? todayIso : (zi ?? todayIso)

  // Culesul estimat pe parcele (data pusă de mână sau prima recoltare de anul trecut), pentru avertizarea
  // „Pauza trece de începutul culesului”. Doar avertizează, nu blochează (ca la recoltarea în pauză).
  const cules = useMementoAnalize(todayIso, { proprietar: false, enabled: open })
  const pauzaProduse = pauzaCiorna(ciorna.produse).zile
  const avertizareCules: Avertisment | null = useMemo(() => {
    if (cand === 'planifica' && !zi) return null
    const a = avertizareCulesLaTratament({
      pauzaZile: pauzaProduse,
      ziAplicare: ziTratament,
      parcele: alese.map((parcela) => ({
        parcelaId: parcela.id,
        nume: numeParcele.get(parcela.id) ?? 'Parcelă',
        dataCules: cules.estimari.get(parcela.id)?.data ?? null,
      })),
    })
    return a ? { tip: 'cules', titlu: a.titlu, detaliu: a.text } : null
  }, [alese, cand, cules.estimari, numeParcele, pauzaProduse, zi, ziTratament])

  const avertismenteBaza = useMemo(
    () =>
      ciorna.metoda === 'stropire'
        ? avertismenteStropire({
            produse: ciorna.produse.map((produs) => ({
              produsId: produs.produsId,
              nume: produs.nume,
              frac: produs.frac,
              nrMaxPeSezon: produs.nrMaxPeSezon,
              intervalMinZile: produs.intervalMinZile,
            })),
            parcele: alese.map((parcela) => ({ id: parcela.id, nume: numeParcele.get(parcela.id) ?? 'Parcelă' })),
            istoric,
            zi: ziTratament,
            azi: todayIso,
          })
        : [],
    [alese, ciorna.metoda, ciorna.produse, istoric, numeParcele, todayIso, ziTratament],
  )
  const avertismente = useMemo(() => (avertizareCules ? [avertizareCules, ...avertismenteBaza] : avertismenteBaza), [avertismenteBaza, avertizareCules])
  const meteoAvertisment = ciorna.metoda === 'stropire' ? avertismentMeteo(meteo?.spray) : null

  // „Repetă”: ultimul tratament făcut, pe fiecare metodă.
  const repetaGrupuri = useMemo(() => {
    const result: RandJurnal[] = []
    const vazute = new Set<string>()
    for (const rand of jurnal.facute) {
      if (rand.importat || rand.aplicari.length === 0 || rand.tip === 'altele' || vazute.has(rand.tip)) continue
      if (!rand.aplicari[0].produse.length) continue
      vazute.add(rand.tip)
      result.push(rand)
      if (result.length === 3) break
    }
    return result
  }, [jurnal.facute])
  const repetaOptiuni: RepetaOptiune[] = repetaGrupuri.map((rand) => ({
    key: rand.key,
    titlu: `${ETICHETA_TIP[rand.tip]} · ${rand.zi ? ziRelativaRo(rand.zi, todayIso).toLocaleLowerCase('ro-RO') : 'fără dată'}`,
    detaliu: `${textProduse(rand.produse, false)} · ${textParcele(rand.parcelaIds, numeParcele, parcele.length)}`,
    metoda: rand.tip === 'fertirigare' ? 'fertirigare' : rand.tip === 'sol' ? 'sol' : 'stropire',
  }))

  // „Folosite recent” în alegerea produsului.
  const recente: ProdusRecent[] = useMemo(() => {
    const vazute = new Set<string>()
    const result: ProdusRecent[] = []
    for (const rand of jurnal.facute) {
      for (const aplicare of rand.aplicari.slice(0, 1)) {
        for (const produs of aplicare.produse) {
          const nume = produs.produs_nume_snapshot
          if (vazute.has(nume)) continue
          vazute.add(nume)
          result.push({
            produs: produs.produs_id ? (catalogPeId.get(produs.produs_id) ?? null) : null,
            nume,
            ultima: `Ultima: ${rand.zi ? ziRelativaRo(rand.zi, todayIso).toLocaleLowerCase('ro-RO') : '—'}, ${textParcele(rand.parcelaIds, numeParcele)}`,
          })
        }
      }
      if (result.length >= 5) break
    }
    return result.slice(0, 5)
  }, [catalogPeId, jurnal.facute, numeParcele, todayIso])

  // ─── Acțiuni pe ciornă ───
  const alegeMetoda = (metoda: MetodaFormular) => {
    setCiorna({
      ...EMPTY,
      metoda,
      // Fertirigarea pornește pe toate parcelele (bifezi doar ce uzi azi); stropirea, cu una dacă e singura.
      parcelaIds:
        parcelaInitiala && parceleSortate.some((parcela) => parcela.id === parcelaInitiala)
          ? [parcelaInitiala]
          : metoda === 'fertirigare'
            ? parceleSortate.map((parcela) => parcela.id)
            : parceleSortate.length === 1
              ? [parceleSortate[0].id]
              : [],
    })
    setVolumEditat(false)
    form.next()
  }

  const repeta = (key: string) => {
    const rand = repetaGrupuri.find((item) => item.key === key)
    if (!rand) return
    const next = ciornaDinTratament(rand.aplicari, new Set(parcele.map((parcela) => parcela.id)), catalogPeId)
    if (!next) return
    setCiorna(next)
    setVolumEditat(false)
    form.next()
  }

  const patchProdus = (key: string, patch: Partial<ProdusCiorna>) =>
    setCiorna((previous) => ({ ...previous, produse: previous.produse.map((produs) => (produs.key === key ? { ...produs, ...patch } : produs)) }))

  const schimbaMod = (mod: ModDoza) =>
    setCiorna((previous) => ({
      ...previous,
      mod,
      // Doza din etichetă în noul mod; produsele scrise de mână pornesc goale.
      produse: previous.produse.map((produs) => ({
        ...produs,
        doza: produs.produsId ? dozaDinCatalog(catalogPeId.get(produs.produsId), mod) : null,
      })),
    }))

  const adaugaProdus = (produs: ProdusCatalog | null, numeManual?: string) => {
    setCiorna((previous) => {
      const rezervor: 'A' | 'B' = /calcinit|calciu|azotat de calc|nitrat de calc/i.test(produs?.nume_comercial ?? numeManual ?? '') ? 'B' : 'A'
      const nou: ProdusCiorna = produs
        ? produsDinCatalog(produs, unitateImplicita(produs), rezervor)
        : {
            key: cheieNoua(),
            produsId: null,
            nume: numeManual ?? 'Produs',
            substanta: null,
            tip: null,
            frac: null,
            phi: null,
            nrMaxPeSezon: null,
            intervalMinZile: null,
            unitate: previous.metoda === 'sol' || previous.metoda === 'fertirigare' ? 'g' : 'ml',
            doza: null,
            gPePlanta: null,
            rezervor,
          }
      // Primul produs al unei stropiri alege modul dozei după etichetă (la ha dacă eticheta are doar doza pe hectar).
      const mod = previous.metoda === 'stropire' && previous.produse.length === 0 && produs ? modImplicit(produs) : previous.mod
      if (previous.metoda === 'stropire' && produs) nou.doza = dozaDinCatalog(produs, mod)
      return { ...previous, mod, produse: [...previous.produse, nou] }
    })
    setVedere(null)
  }

  const salveazaProdusNou = async (input: { nume: string; tip: TipProdusNou; phiZile: number | null }) => {
    try {
      const produs = await creeazaProdusFerma(input)
      void queryClient.invalidateQueries({ queryKey: queryKeys.produseFitosanitare })
      adaugaProdus(produs)
      return null
    } catch (error) {
      return mesajEroare(error)
    }
  }

  // ─── Rezumatul ───
  const pauza = pauzaCiorna(ciorna.produse)
  const ha = suprafataHa(alese)
  const produseRezumat = ciorna.produse
    .map((produs) => {
      if (ciorna.metoda === 'fertirigare') {
        const kg = alese.reduce((sum, parcela) => sum + (kgFertirigare(produs.gPePlanta, parcela.nr_plante) ?? 0), 0)
        return `${produs.nume} ${formatKgTratament(kg)} (${produs.rezervor})`
      }
      if (ciorna.metoda === 'sol') return `${produs.nume} ${produs.doza ?? '—'} ${produs.unitate === 'ml' ? 'l' : 'kg'}`
      const total = cantitateStropire({ doza: produs.doza, mod: ciorna.mod, volumL, suprafataHa: ha })
      return `${produs.nume} ${total !== null ? formatCantitate(total, produs.unitate) : '—'}`
    })
  const plante = alese.reduce((sum, parcela) => sum + (Number(parcela.nr_plante) || 0), 0)
  const zileBaza = cand === 'acum' ? todayIso : zi
  const rezumat: RezumatTratament = {
    unde: `${textParcele(ciorna.parcelaIds, numeParcele)}${plante > 0 ? ` · ${new Intl.NumberFormat('ro-RO').format(plante)} plante` : ''}`,
    solutie: ciorna.metoda === 'stropire' && volumL ? `${new Intl.NumberFormat('ro-RO').format(volumL)} l` : null,
    produse: produseRezumat,
    pauza,
    panaLa: pauza.zile > 0 && cand !== 'planifica' && zileBaza ? adaugaZile(zileBaza, pauza.zile) : null,
    parceleText: textParcele(ciorna.parcelaIds, numeParcele),
  }
  const meteoRezumat =
    ciorna.metoda === 'stropire' && meteo?.spray
      ? {
          bun: meteo.spray.canSpray,
          detaliu: [
            meteo.spray.reason?.trim() || null,
            meteo.current?.windSpeed !== null && meteo.current?.windSpeed !== undefined ? `vânt ${Math.round(meteo.current.windSpeed * 3.6)} km/h` : null,
            meteo.current?.temp !== null && meteo.current?.temp !== undefined ? `${Math.round(meteo.current.temp)} °C` : null,
          ]
            .filter(Boolean)
            .join(' · ') || 'Prognoza fermei nu arată ploaie sau vânt.',
        }
      : null

  // ─── Salvarea ───
  const candObj: CandTratament | null =
    cand === 'acum' ? { tip: 'acum' } : zi ? (cand === 'alta_zi' ? { tip: 'alta_zi', zi } : { tip: 'planifica', zi }) : null
  const canSave = lipsa === null && candObj !== null && !saving

  // ─── Magazia: cât cere tratamentul din fiecare produs, pe toate parcelele ───
  const magazie: MagazieTratament | null = useMemo(() => {
    const stoc = magazieQuery.data
    if (!stoc || stoc.length === 0 || lipsa !== null) return null
    // Cantitățile nu depind de „când”; starea (făcut / planificat) se judecă mai jos.
    const rows = aplicariDeSalvat({ ciorna: ciornaEfectiva, parcele: parceleSortate, cand: { tip: 'acum' }, meteo: null })
    const necesar = ciornaEfectiva.produse.map((produs, index) => {
      let total = 0
      let unitate: string | null = null
      let are = false
      for (const row of rows) {
        const rand = row.produse[index]
        if (rand && rand.cantitate_totala !== null) {
          total += Number(rand.cantitate_totala) || 0
          unitate = rand.unitate_cantitate
          are = true
        }
      }
      return { produsId: produs.produsId, nume: produs.nume, cantitate: are ? total : null, unitate }
    })
    const verificari = verificaMagazie({
      produse: necesar,
      stoc: stoc.map((rand) => ({ produs_id: rand.produs_id, unitate: rand.unitate, stoc: rand.stoc, pret_mediu: esteProprietar ? rand.pret_mediu : null, start: rand.inceput })),
      facut: cand !== 'planifica',
      zi: ziTratament,
    })
    if (verificari.every((verificare) => verificare.tip === 'neurmarit')) return null
    return { verificari, cost: esteProprietar ? costEstimat(verificari) : null }
  }, [cand, ciornaEfectiva, esteProprietar, lipsa, magazieQuery.data, parceleSortate, ziTratament])

  const save = async () => {
    if (!canSave || !candObj) return
    const key = form.clientSyncId
    setSaving(true)
    setSaveError(null)
    try {
      const rows = aplicariDeSalvat({
        ciorna: ciornaEfectiva,
        parcele: parceleSortate,
        cand: candObj,
        meteo:
          candObj.tip === 'acum' && meteo
            ? { spray: meteo.spray ?? null, current: meteo.current ?? null, salvat_la: new Date().toISOString() }
            : null,
      })
      await salveazaTratament({ lotId: key, aplicari: rows })
      // Volumul se învață la primul tratament pe parcelă (doar unde lipsește). Nu oprește salvarea.
      if (ciorna.metoda === 'stropire' && ciorna.mod === 'hl') {
        await salveazaVolumeParcele(volumeDeSalvat(alese, volumL)).catch(() => undefined)
      }
      void queryClient.invalidateQueries({ queryKey: queryKeys.tratamente })
      void queryClient.invalidateQueries({ queryKey: queryKeys.volumeParcele })
      hapticSuccess()
      if (liveKeyRef.current !== key) return
      setSaving(false)
      setSaved(
        candObj.tip === 'planifica'
          ? { titlu: 'Planificat', detaliu: `${ETICHETA_TIP[ciorna.metoda]} ${ziCuDataRo(candObj.zi)} · ${rezumat.parceleText}` }
          : {
              titlu: 'Salvat',
              detaliu: rezumat.panaLa ? `Nu recolta din ${rezumat.parceleText} până ${ziCuDataRo(rezumat.panaLa)}.` : `${ETICHETA_TIP[ciorna.metoda]} · fără pauză.`,
            },
      )
      form.markSuccess({ metoda: ciorna.metoda, parcele: rows.length, produse: ciorna.produse.length, cand: candObj.tip })
    } catch (error) {
      hapticError()
      if (liveKeyRef.current !== key) return
      setSaving(false)
      setSaveError(mesajEroare(error))
      form.markFailed()
    }
  }

  // ─── Navigare ───
  const close = () => onOpenChange(false)
  const dirty = ciorna.produse.length > 0
  const closeGuard = () => {
    if (form.done) return false
    if (saving) return true
    if (!dirty) return false
    setVedere('renunta')
    return true
  }
  const handleBack = () => {
    if (vedere === 'produs-nou') {
      setVedere('produs')
      return true
    }
    if (vedere) {
      setVedere(null)
      return true
    }
    return false
  }

  const alegeCand = (next: CandTip) => {
    setCand(next)
    if (next === 'acum') return
    // O zi propusă: ieri pentru „altă zi”, mâine pentru „planifică”.
    setZi((previous) => {
      if (next === 'alta_zi') return previous && previous <= todayIso ? previous : addDaysIso(todayIso, -1)
      return previous && previous >= todayIso ? previous : addDaysIso(todayIso, 1)
    })
  }

  const doarZmeur = alese.length > 0 ? alese.every(esteZmeura) : parcele.some(esteZmeura)
  const dejaAlese = new Set(ciorna.produse.map((produs) => produs.nume))

  let content: React.ReactNode = null
  let stepLabel: string | undefined
  if (vedere === 'renunta') {
    stepLabel = 'Nesalvat'
    content = (
      <div className="flex min-h-full flex-col justify-center gap-3 py-6 text-center">
        <StepFormTitle>Renunți la tratament?</StepFormTitle>
        <p className={cn('text-fg-muted', kitText.base)}>Ce ai ales nu a fost salvat.</p>
        <div className="mt-3 flex flex-col gap-2.5">
          <Button type="button" variant="primary" size="touch-lg" className="w-full" onClick={() => setVedere(null)}>
            Continuă
          </Button>
          <Button type="button" variant="neutral" size="touch-lg" className="w-full" onClick={close}>
            Renunță
          </Button>
        </div>
      </div>
    )
  } else if (vedere === 'produs') {
    stepLabel = 'Adaugă produs'
    content = (
      <AlegeProdus
        catalog={catalog}
        recente={recente}
        doarZmeur={ciorna.metoda === 'stropire' && doarZmeur}
        dejaAlese={dejaAlese}
        onAlege={adaugaProdus}
        onProdusNou={() => setVedere('produs-nou')}
      />
    )
  } else if (vedere === 'produs-nou') {
    stepLabel = 'Produs nou'
    content = <ProdusNou tipImplicit={ciorna.metoda === 'stropire' ? 'fungicid' : 'ingrasamant'} onSalveaza={salveazaProdusNou} />
  } else if (vedere === 'calendar') {
    stepLabel = 'Ziua'
    content = (
      <div className="space-y-4">
        <StepFormTitle>{cand === 'planifica' ? 'Ce zi îl faci?' : 'Ce zi l-ai făcut?'}</StepFormTitle>
        <CalendarPanel
          value={zi}
          onChange={(iso) => {
            setZi(iso)
            setVedere(null)
          }}
          min={cand === 'planifica' ? todayIso : undefined}
          max={cand === 'alta_zi' ? todayIso : undefined}
          shortcuts={
            cand === 'planifica'
              ? [
                  { label: 'Azi', value: todayIso },
                  { label: 'Mâine', value: addDaysIso(todayIso, 1) },
                  { label: 'Poimâine', value: addDaysIso(todayIso, 2) },
                ]
              : [
                  { label: 'Azi', value: todayIso },
                  { label: 'Ieri', value: addDaysIso(todayIso, -1) },
                  { label: 'Alaltăieri', value: addDaysIso(todayIso, -2) },
                ]
          }
        />
      </div>
    )
  } else if (form.stepKey === 'metoda') {
    content = <PasMetoda repeta={repetaOptiuni} onRepeta={repeta} onMetoda={alegeMetoda} />
  } else if (form.stepKey === 'detalii') {
    content = (
      <PasDetalii
        ciorna={ciorna}
        parcele={parceleSortate}
        volumL={volumL}
        volumPropus={propus}
        onVolum={(volum) => {
          setVolumEditat(true)
          setCiorna((previous) => ({ ...previous, volumL: volum }))
        }}
        onParcele={(parcelaIds) => setCiorna((previous) => ({ ...previous, parcelaIds }))}
        onMod={schimbaMod}
        onProdus={patchProdus}
        onScoate={(key) => setCiorna((previous) => ({ ...previous, produse: previous.produse.filter((produs) => produs.key !== key) }))}
        onAdauga={() => setVedere('produs')}
        avertismente={avertismente}
        lipsa={lipsa}
      />
    )
  } else if (form.stepKey === 'cand') {
    content = (
      <div className="space-y-4">
        {saveError ? (
          <Notice tone="danger" title="Nu s-a salvat">
            {saveError}
          </Notice>
        ) : null}
        <PasCand
          cand={cand}
          onCand={alegeCand}
          zi={zi}
          onAlegeZi={() => setVedere('calendar')}
          meteo={meteoRezumat}
          avertismentMeteo={meteoAvertisment}
          rezumat={rezumat}
          magazie={magazie}
        />
      </div>
    )
  }

  const titlu = form.stepKey === 'metoda' ? 'Tratament nou' : ETICHETA_TIP[ciorna.metoda]

  return (
    <StepForm
      form={form}
      open={open}
      onOpenChange={onOpenChange}
      closeGuard={closeGuard}
      title={titlu}
      description="Notezi o stropire, o fertirigare sau un tratament la sol."
      stepLabel={stepLabel}
      onBack={handleBack}
      footer={
        vedere !== null
          ? null
          : form.stepKey === 'detalii'
            ? { primary: { label: 'Continuă', onClick: () => form.next(), disabled: lipsa !== null } }
            : form.stepKey === 'cand'
              ? {
                  primary: {
                    label: saving ? 'Se salvează…' : cand === 'planifica' ? 'Planifică tratamentul' : 'Salvează tratamentul',
                    onClick: () => void save(),
                    loading: saving,
                    disabled: !canSave,
                  },
                }
              : null
      }
      success={saved ? <SuccessScreen title={saved.titlu} description={saved.detaliu} primaryAction={{ label: 'Gata', onClick: close }} /> : undefined}
    >
      {content}
    </StepForm>
  )
}
