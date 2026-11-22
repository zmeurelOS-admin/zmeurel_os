/**
 * Mementoul „analiza dinainte de cules”: când pleacă notificarea, ce scrie, ce produse sunt de evitat,
 * când apare cardul din Acasă și avertizarea din formularul de tratament. Funcții pure, testate.
 *
 * Reguli (mockup-ul `analize-fructe.html`, aprobat):
 *   - la 21, 14, 7 și 3 zile înainte de cel mai apropiat început de cules (zilele se schimbă din Setări),
 *     apoi zilnic din ziua culesului (comutatorul „Zilnic din ziua culesului”);
 *   - o singură notificare, cu parcelele care încep în aceeași săptămână (7 zile de la cel mai apropiat început);
 *   - se oprește: o analiză cu prelevarea în fereastra sezonului pe acele parcele, „Nu fac analize anul acesta”
 *     (doar sezonul curent), comutatorul general;
 *   - „Amână” 1, 3 sau 7 zile: nimic până la acea zi; în ziua ei pleacă din nou;
 *   - liniștea 22–6 rămâne (o aplică `permitePush`, la trimitere).
 */
import { insiruire } from '@/lib/acte/stare'
import { adaugaZile, zileIntre, zileText } from '@/lib/tratamente/zile'

import { dataScurtaAnaliza } from './lista'

export const ZILE_MEMENTO_POSIBILE = [21, 14, 7, 3, 1] as const
export const ZILE_MEMENTO_IMPLICITE: readonly number[] = [21, 14, 7, 3]
export const AMANARI_POSIBILE = [1, 3, 7] as const
export const AMANARE_IMPLICITA = 3
/** O analiză prelevată cu cel mult atâtea zile înainte de începutul culesului (sau după, în același an) îl oprește. */
export const FEREASTRA_SEZON_INAINTE_ZILE = 60
/** „Zilnic din ziua culesului” se oprește singur după atâtea zile de cules fără analiză. */
export const ZILNIC_CEL_MULT_ZILE = 45
/** Parcelele care încep în aceeași săptămână merg în aceeași notificare. */
export const ZILE_GRUPARE = 7

export const TIP_MEMENTO_ANALIZE = 'analize_memento'

export interface SetariMemento {
  pornit: boolean
  zile: readonly number[]
  zilnic: boolean
}

export const SETARI_MEMENTO_IMPLICITE: SetariMemento = { pornit: true, zile: ZILE_MEMENTO_IMPLICITE, zilnic: true }

export interface StareSezonMemento {
  dezactivat: boolean
  amanatPana: string | null
}

export interface ParcelaCules {
  parcelaId: string
  nume: string
  /** Începutul culesului estimat; `null` = nu știm (nu intră în memento). */
  dataCules: string | null
}

export type MotivMemento = 'oprit' | 'dezactivat' | 'fara_data' | 'trimisa' | 'departe' | 'amanat' | 'activ'

export interface CalculMemento {
  motiv: MotivMemento
  /** Cardul din Acasă (și foaia) se arată. */
  activ: boolean
  /** Azi pleacă notificarea. */
  trimiteAzi: boolean
  dataCules: string | null
  /** Zile până la cel mai apropiat început (0 = azi, negativ = a început). */
  zileRamase: number | null
  parcele: ParcelaCules[]
}

/** Zilele alese, curate: doar 21 / 14 / 7 / 3 / 1, fără dubluri, descrescător. */
export function normalizeazaZileMemento(valori: unknown): number[] {
  if (!Array.isArray(valori)) return [...ZILE_MEMENTO_IMPLICITE]
  const permise = new Set<number>(ZILE_MEMENTO_POSIBILE)
  return [...new Set(valori.map(Number).filter((n) => permise.has(n)))].sort((a, b) => b - a)
}

/** Analiza acoperă parcela în sezonul culesului care începe pe `dataCules`. */
export function analizaAcoperaParcela(
  analiza: { parcele: readonly string[]; data_prelevare: string },
  parcelaId: string,
  dataCules: string,
): boolean {
  if (!analiza.parcele.includes(parcelaId)) return false
  const an = dataCules.slice(0, 4)
  const de = adaugaZile(dataCules, -FEREASTRA_SEZON_INAINTE_ZILE)
  return analiza.data_prelevare >= de && analiza.data_prelevare.startsWith(an)
}

export function calculeazaMemento(input: {
  azi: string
  parcele: readonly ParcelaCules[]
  analize: ReadonlyArray<{ parcele: readonly string[]; data_prelevare: string }>
  setari: SetariMemento
  stare: StareSezonMemento | null
}): CalculMemento {
  const gol = (motiv: MotivMemento): CalculMemento => ({ motiv, activ: false, trimiteAzi: false, dataCules: null, zileRamase: null, parcele: [] })
  if (!input.setari.pornit) return gol('oprit')
  if (input.stare?.dezactivat) return gol('dezactivat')

  const an = input.azi.slice(0, 4)
  const cuData = input.parcele.filter((parcela) => parcela.dataCules?.startsWith(an))
  if (cuData.length === 0) return gol('fara_data')

  const candidate = cuData.filter((parcela) => {
    const data = parcela.dataCules as string
    if (zileIntre(input.azi, data) < -ZILNIC_CEL_MULT_ZILE) return false
    return !input.analize.some((analiza) => analizaAcoperaParcela(analiza, parcela.parcelaId, data))
  })
  if (candidate.length === 0) return gol('trimisa')

  const dataCules = candidate.reduce((min, parcela) => ((parcela.dataCules as string) < min ? (parcela.dataCules as string) : min), candidate[0].dataCules as string)
  const pana = adaugaZile(dataCules, ZILE_GRUPARE - 1)
  const grup = candidate
    .filter((parcela) => (parcela.dataCules as string) <= pana)
    .sort((a, b) => (a.dataCules as string).localeCompare(b.dataCules as string) || a.nume.localeCompare(b.nume, 'ro'))
  const zileRamase = zileIntre(input.azi, dataCules)
  const zile = input.setari.zile.length > 0 ? input.setari.zile : ZILE_MEMENTO_IMPLICITE
  const fereastra = Math.max(...zile)

  const baza = { dataCules, zileRamase, parcele: grup }
  if (zileRamase > fereastra) return { ...baza, motiv: 'departe', activ: false, trimiteAzi: false }

  const amanatPana = input.stare?.amanatPana ?? null
  if (amanatPana && input.azi < amanatPana) return { ...baza, motiv: 'amanat', activ: false, trimiteAzi: false }

  const trimiteAzi =
    zile.includes(zileRamase) || (input.setari.zilnic && zileRamase <= 0) || (amanatPana !== null && input.azi === amanatPana)
  return { ...baza, motiv: 'activ', activ: true, trimiteAzi }
}

/** „Maravilla 1 și 2”, „Maravilla 1 și DELNIWA”, „A, B și C”. */
export function textParceleMemento(nume: readonly string[]): string {
  if (nume.length === 0) return ''
  const prefix = /^(.*\S)\s+(\d+)$/
  const potriviri = nume.map((text) => prefix.exec(text))
  if (nume.length > 1 && potriviri.every((m) => m && m[1] === potriviri[0]![1])) {
    return `${potriviri[0]![1]} ${insiruire(potriviri.map((m) => m![2]))}`
  }
  return insiruire(nume)
}

export interface ProdusDeEvitat {
  nume: string
  pauzaZile: number
  /** Pauza e exact cât zilele rămase: aplicat azi, se termină în ziua culesului. */
  laLimita: boolean
}

/**
 * Produsele fermei (catalogul fermei + produsele folosite) cu pauza cel puțin cât zilele rămase până la cules.
 * Cele cu pauza mai lungă sunt „de evitat”; cele cu pauza egală sunt „la limită” (aplicate azi, pauza se termină
 * chiar în ziua culesului). Din ziua culesului, orice produs cu pauză.
 */
export function produseDeEvitat(produse: ReadonlyArray<{ nume: string | null | undefined; pauzaZile: number | null | undefined }>, zileRamase: number): ProdusDeEvitat[] {
  const prag = Math.max(1, zileRamase)
  const maxPeNume = new Map<string, { nume: string; pauzaZile: number }>()
  for (const produs of produse) {
    const nume = produs.nume?.trim()
    const pauza = Math.floor(Number(produs.pauzaZile) || 0)
    if (!nume || pauza <= 0) continue
    const cheie = nume.toLocaleLowerCase('ro-RO')
    const existent = maxPeNume.get(cheie)
    if (!existent || pauza > existent.pauzaZile) maxPeNume.set(cheie, { nume, pauzaZile: pauza })
  }
  return [...maxPeNume.values()]
    .filter((produs) => produs.pauzaZile >= prag)
    .map((produs) => ({ ...produs, laLimita: zileRamase > 0 && produs.pauzaZile === zileRamase }))
    .sort((a, b) => b.pauzaZile - a.pauzaZile || a.nume.localeCompare(b.nume, 'ro'))
}

/** „pauză 28 de zile: mai lungă decât zilele rămase” / „pauză 21 de zile: la limită”. */
export function textProdusDeEvitat(produs: ProdusDeEvitat): string {
  return `pauză ${zileText(produs.pauzaZile)}: ${produs.laLimita ? 'la limită' : 'mai lungă decât zilele rămase'}`
}

/** Titlul și textul notificării (și al cardului din Acasă). */
export function textNotificareMemento(input: { zileRamase: number; parcele: readonly string[]; produseDeEvitat: number }): { title: string; body: string } {
  const parcele = textParceleMemento(input.parcele)
  if (input.zileRamase > 0) {
    const produse = input.produseDeEvitat > 0 ? ` și evită acum produsele cu pauză lungă (${input.produseDeEvitat} în fermă)` : ''
    return {
      title: `Peste ${zileText(input.zileRamase)} începe culesul`,
      body: `${parcele}. Programează analiza la fructe${produse}.`,
    }
  }
  if (input.zileRamase === 0) {
    return { title: 'Culesul începe azi. Analiza nu e trimisă', body: `${parcele}. Îți amintesc în fiecare dimineață, până o trimiți.` }
  }
  return {
    title: `Culesul a început de ${zileText(-input.zileRamase)}. Analiza nu e trimisă`,
    body: `${parcele}. Îți amintesc în fiecare dimineață, până o trimiți.`,
  }
}

/** „Culesul începe în ~21 de zile” / „Culesul începe azi” / „Culesul a început de 3 zile” (foaia și cardul). */
export function titluFoaieMemento(zileRamase: number): string {
  if (zileRamase > 0) return `Culesul începe în ~${zileText(zileRamase)}`
  if (zileRamase === 0) return 'Culesul începe azi'
  return `Culesul a început de ${zileText(-zileRamase)}`
}

/** „Analiza la fructe · culesul în 7 zile” (cardul din Acasă). */
export function titluCardMemento(zileRamase: number): string {
  if (zileRamase > 0) return `Analiza la fructe · culesul în ${zileText(zileRamase)}`
  if (zileRamase === 0) return 'Analiza la fructe · culesul începe azi'
  return 'Analiza la fructe · culesul a început'
}

/** Deep link-ul „Am trimis”: „Analiză nouă” cu parcelele alese. */
export function linkAnalizaNoua(parcelaIds: readonly string[]): string {
  const parcele = parcelaIds.length ? `&parcele=${parcelaIds.map(encodeURIComponent).join(',')}` : ''
  return `/tratamente?tab=analize&noua=1${parcele}`
}

/** Ziua de amânare (azi + N). */
export function ziAmanare(azi: string, zile: number): string {
  return adaugaZile(azi, zile)
}

// ─── Avertizarea din formularul de tratament ─────────────────────────────────────────────────────────

export interface AvertizareCules {
  titlu: string
  text: string
  /** Prima zi în care fructele se pot culege și analiza. */
  pana: string
  parcelaIds: string[]
}

/**
 * Pauza produsului ales trece de începutul culesului estimat al unei parcele alese → avertizare (nu blochează).
 * `ziAplicare` = ziua tratamentului (azi sau ziua aleasă). Parcelele cu culesul deja început nu intră aici
 * (acolo pauza obișnuită oprește recoltarea).
 */
export function avertizareCulesLaTratament(input: {
  pauzaZile: number
  ziAplicare: string
  parcele: readonly ParcelaCules[]
}): AvertizareCules | null {
  const pauza = Math.floor(Number(input.pauzaZile) || 0)
  if (pauza <= 0) return null
  const pana = adaugaZile(input.ziAplicare, pauza)
  const afectate = input.parcele
    .filter((parcela) => parcela.dataCules && parcela.dataCules >= input.ziAplicare && pana > parcela.dataCules)
    .sort((a, b) => (a.dataCules as string).localeCompare(b.dataCules as string))
  if (afectate.length === 0) return null
  const prima = afectate[0]
  const zile = zileIntre(input.ziAplicare, prima.dataCules as string)
  const unde = textParceleMemento(afectate.map((parcela) => parcela.nume))
  const cand = zile === 0 ? 'azi' : `peste ${zileText(zile)}`
  return {
    titlu: 'Pauza trece de începutul culesului',
    text: `Culesul la ${unde} e estimat ${cand}; pauza ține ${pauza}. Poți salva, dar fructele n-ar trebui culese și analizate înainte de ${dataLungaRo(pana)}.`,
    pana,
    parcelaIds: afectate.map((parcela) => parcela.parcelaId),
  }
}

const LUNI_LUNG = ['ianuarie', 'februarie', 'martie', 'aprilie', 'mai', 'iunie', 'iulie', 'august', 'septembrie', 'octombrie', 'noiembrie', 'decembrie']

/** „29 iunie”. */
export function dataLungaRo(ziua: string): string {
  return `${Number(ziua.slice(8, 10))} ${LUNI_LUNG[Number(ziua.slice(5, 7)) - 1]}`
}

/** „estimat pe 22 iunie” (foaia). */
export function textEstimat(dataCules: string): string {
  return `estimat pe ${dataLungaRo(dataCules)}`
}

export { dataScurtaAnaliza }
