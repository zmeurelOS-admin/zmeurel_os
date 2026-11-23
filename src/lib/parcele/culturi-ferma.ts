/**
 * Culturile fermei: regula „cultura vine din parcele” (promptul 31). Nicăieri nu se scrie „zmeură” fix:
 * fructul fermei se ia doar din parcelele ei (`parcele.cultura`, altfel `tip_fruct`).
 *
 * Funcții pure, testate. Denumirile se normalizează: „Zmeure Delniwa”, „Zmeură” și „zmeura” sunt aceeași
 * cultură (codul din `lib/crops/crop-codes`, încercat și pe primul cuvânt, ca `grupBiologicParcela`).
 * O cultură necunoscută („Mix fructe”) rămâne cultura ei, după textul fără diacritice și majuscule.
 */
import { normalizeCropCod } from '@/lib/crops/crop-codes'
import { normalizeForSearch } from '@/lib/utils/string'

/** Genul și numărul fructului, pentru acord: „Zmeură … disponibilă”, „Afine … disponibile”, „Ardei … disponibili”. */
export type FormaCultura = 'f-sg' | 'm-sg' | 'f-pl' | 'm-pl'

interface DenumireFruct {
  /** Cum se scrie fructul (ce se vinde): „Zmeură”, „Afine”, „Mere”. */
  nume: string
  forma: FormaCultura
}

/**
 * Codul culturii → numele fructului vândut. Codurile sunt cele din `crop-codes`, plus câteva culturi mari.
 * „m-sg” acoperă și neutrul la singular („Spanac proaspăt”), „f-pl” și neutrul la plural („Mere proaspete”).
 */
const FRUCTE: Record<string, DenumireFruct> = {
  zmeur: { nume: 'Zmeură', forma: 'f-sg' },
  mur: { nume: 'Mure', forma: 'f-pl' },
  afin: { nume: 'Afine', forma: 'f-pl' },
  capsun: { nume: 'Căpșuni', forma: 'f-pl' },
  coacaz: { nume: 'Coacăze', forma: 'f-pl' },
  agris: { nume: 'Agrișe', forma: 'f-pl' },
  goji: { nume: 'Goji', forma: 'f-pl' },
  aronia: { nume: 'Aronia', forma: 'f-sg' },
  catina: { nume: 'Cătină', forma: 'f-sg' },
  rosie: { nume: 'Roșii', forma: 'f-pl' },
  castravete: { nume: 'Castraveți', forma: 'm-pl' },
  ardei: { nume: 'Ardei', forma: 'm-pl' },
  vanata: { nume: 'Vinete', forma: 'f-pl' },
  salata: { nume: 'Salată', forma: 'f-sg' },
  spanac: { nume: 'Spanac', forma: 'm-sg' },
  fasole: { nume: 'Fasole', forma: 'f-sg' },
  dovlecel: { nume: 'Dovlecei', forma: 'm-pl' },
  mazare: { nume: 'Mazăre', forma: 'f-sg' },
  cartof: { nume: 'Cartofi', forma: 'm-pl' },
  ceapa: { nume: 'Ceapă', forma: 'f-sg' },
  usturoi: { nume: 'Usturoi', forma: 'm-sg' },
  morcov: { nume: 'Morcovi', forma: 'm-pl' },
  varza: { nume: 'Varză', forma: 'f-sg' },
  conopida: { nume: 'Conopidă', forma: 'f-sg' },
  broccoli: { nume: 'Broccoli', forma: 'm-sg' },
  ridiche: { nume: 'Ridichi', forma: 'f-pl' },
  sfecla: { nume: 'Sfeclă', forma: 'f-sg' },
  telina: { nume: 'Țelină', forma: 'f-sg' },
  praz: { nume: 'Praz', forma: 'm-sg' },
  patrunjel: { nume: 'Pătrunjel', forma: 'm-sg' },
  busuioc: { nume: 'Busuioc', forma: 'm-sg' },
  rucola: { nume: 'Rucola', forma: 'f-sg' },
  gulie: { nume: 'Gulii', forma: 'f-pl' },
  mar: { nume: 'Mere', forma: 'f-pl' },
  par: { nume: 'Pere', forma: 'f-pl' },
  cires: { nume: 'Cireșe', forma: 'f-pl' },
  visin: { nume: 'Vișine', forma: 'f-pl' },
  prun: { nume: 'Prune', forma: 'f-pl' },
  cais: { nume: 'Caise', forma: 'f-pl' },
  piersic: { nume: 'Piersici', forma: 'f-pl' },
  nuc: { nume: 'Nuci', forma: 'f-pl' },
  alun: { nume: 'Alune', forma: 'f-pl' },
  grau: { nume: 'Grâu', forma: 'm-sg' },
  porumb: { nume: 'Porumb', forma: 'm-sg' },
  'floarea soarelui': { nume: 'Floarea-soarelui', forma: 'f-sg' },
  rapita: { nume: 'Rapiță', forma: 'f-sg' },
  soia: { nume: 'Soia', forma: 'f-sg' },
  orz: { nume: 'Orz', forma: 'm-sg' },
  ovaz: { nume: 'Ovăz', forma: 'm-sg' },
}

/** Pluralul pomilor și alte forme pe care `crop-codes` nu le știe („Meri” → mere, „Pruni” → prune). */
const ALIASURI: Record<string, string> = {
  meri: 'mar',
  mere: 'mar',
  mar: 'mar',
  peri: 'par',
  pere: 'par',
  ciresi: 'cires',
  cirese: 'cires',
  visini: 'visin',
  visine: 'visin',
  pruni: 'prun',
  prune: 'prun',
  caisi: 'cais',
  caise: 'cais',
  piersici: 'piersic',
  nuci: 'nuc',
  aluni: 'alun',
  alune: 'alun',
  dovlecei: 'dovlecel',
  vinete: 'vanata',
  gulii: 'gulie',
  'floarea-soarelui': 'floarea soarelui',
  'floarea soarelui': 'floarea soarelui',
  grau: 'grau',
  porumb: 'porumb',
  rapita: 'rapita',
  soia: 'soia',
  orz: 'orz',
  ovaz: 'ovaz',
}

function codDin(text: string): string | null {
  const curat = normalizeForSearch(text).replace(/\s+/g, ' ')
  if (!curat) return null
  return ALIASURI[curat] ?? normalizeCropCod(curat)
}

/**
 * Cheia culturii dintr-un text („Zmeure Delniwa” → `zmeur`, „Mix fructe” → `mix fructe`), `null` dacă textul e gol.
 * Se încearcă textul întreg, apoi primul cuvânt (cultura scrisă împreună cu soiul), apoi primele două
 * („Floarea soarelui”).
 */
export function cheieCultura(text: string | null | undefined): string | null {
  const curat = normalizeForSearch(text).replace(/\s+/g, ' ')
  if (!curat) return null
  const cuvinte = curat.split(' ')
  return codDin(curat) ?? codDin(cuvinte.slice(0, 2).join(' ')) ?? codDin(cuvinte[0] ?? '') ?? curat
}

function majusculaInitiala(text: string): string {
  return text ? text.charAt(0).toLocaleUpperCase('ro-RO') + text.slice(1) : text
}

/** Forma unei culturi necunoscute, după terminație: „…ă/a” = feminin singular, „…e/i” = plural, altfel singular. */
function formaGhicita(text: string): FormaCultura {
  const ultima = normalizeForSearch(text).slice(-1)
  if (ultima === 'a') return 'f-sg'
  if (ultima === 'e' || ultima === 'i') return 'f-pl'
  return 'm-sg'
}

export interface CulturaFerma {
  /** Cheia normalizată (`zmeur`, `afin`, `mix fructe`): după ea se grupează parcelele, recoltările și produsele. */
  cheie: string
  /** Numele fructului, cu majusculă: „Zmeură”, „Afine”. */
  nume: string
  forma: FormaCultura
  /** Câte parcele active are cultura. */
  parcele: number
}

/** Denumirea culturii după cheie; pentru o cultură necunoscută, textul scris pe parcelă. */
export function denumireCultura(cheie: string, textOriginal?: string | null): Pick<CulturaFerma, 'nume' | 'forma'> {
  const cunoscut = FRUCTE[cheie]
  if (cunoscut) return { nume: cunoscut.nume, forma: cunoscut.forma }
  const nume = majusculaInitiala(String(textOriginal ?? cheie).trim().replace(/\s+/g, ' '))
  return { nume, forma: formaGhicita(nume) }
}

export interface ParcelaCuCultura {
  cultura?: string | null
  tip_fruct?: string | null
  status?: string | null
  status_operational?: string | null
}

const STARI_INACTIVE = new Set(['inactiv', 'inactiva', 'arhivat', 'arhivata', 'desfiintat', 'desfiintata'])

/** Parcela e activă: nici `status`, nici `status_operational` nu spun „inactiv” / „arhivat”. */
export function esteParcelaActiva(parcela: Pick<ParcelaCuCultura, 'status' | 'status_operational'>): boolean {
  return ![parcela.status, parcela.status_operational].some((stare) => STARI_INACTIVE.has(normalizeForSearch(stare)))
}

/** Textul culturii unei parcele: `cultura`, altfel `tip_fruct`. */
export function textCulturaParcela(parcela: Pick<ParcelaCuCultura, 'cultura' | 'tip_fruct'>): string | null {
  return parcela.cultura?.trim() || parcela.tip_fruct?.trim() || null
}

/**
 * Culturile fermei = culturile distincte din parcelele active, cele cu mai multe parcele întâi, apoi după nume.
 * Zero parcele = listă goală (nicio cultură scrisă nicăieri).
 */
export function culturileFermei(parcele: readonly ParcelaCuCultura[]): CulturaFerma[] {
  const peCheie = new Map<string, { text: string; parcele: number }>()
  for (const parcela of parcele) {
    if (!esteParcelaActiva(parcela)) continue
    const text = textCulturaParcela(parcela)
    const cheie = cheieCultura(text)
    if (!cheie || !text) continue
    const existent = peCheie.get(cheie)
    if (existent) existent.parcele += 1
    else peCheie.set(cheie, { text, parcele: 1 })
  }
  return [...peCheie.entries()]
    .map(([cheie, { text, parcele: numar }]) => ({ cheie, ...denumireCultura(cheie, text), parcele: numar }))
    .sort((a, b) => b.parcele - a.parcele || a.nume.localeCompare(b.nume, 'ro'))
}

const ACORD: Record<FormaCultura, { disponibil: string; proaspat: string }> = {
  'f-sg': { disponibil: 'disponibilă', proaspat: 'proaspătă' },
  'm-sg': { disponibil: 'disponibil', proaspat: 'proaspăt' },
  'f-pl': { disponibil: 'disponibile', proaspat: 'proaspete' },
  'm-pl': { disponibil: 'disponibili', proaspat: 'proaspeți' },
}

/** „Zmeură cal. I disponibilă”, „Afine cal. I disponibile”, „Ardei cal. I disponibili”. */
export function etichetaStocCal1(cultura: Pick<CulturaFerma, 'nume' | 'forma'>): string {
  return `${cultura.nume} cal. I ${ACORD[cultura.forma].disponibil}`
}

/** Numele produsului pentru comenzi: „Zmeură proaspătă”, „Afine proaspete”, „Castraveți proaspeți”. */
export function numeProdusProaspat(cultura: Pick<CulturaFerma, 'nume' | 'forma'>): string {
  return `${cultura.nume} ${ACORD[cultura.forma].proaspat}`
}

/** Numele culturii cu literă mică, în mijlocul frazei: „Pune prețul la afine”. */
export function numeMic(cultura: Pick<CulturaFerma, 'nume'>): string {
  return cultura.nume.toLocaleLowerCase('ro-RO')
}

/**
 * Cultura unui produs (după nume): „Zmeură proaspătă” → `zmeur`, „Afine” → `afin`. Se potrivește doar cu o
 * cultură a fermei (prin cheie sau prin numele culturii la începutul numelui produsului); altfel `null`.
 */
export function culturaProdusului(numeProdus: string | null | undefined, culturi: readonly Pick<CulturaFerma, 'cheie' | 'nume'>[]): string | null {
  const nume = normalizeForSearch(numeProdus).replace(/\s+/g, ' ')
  if (!nume) return null
  const cheie = cheieCultura(nume)
  if (cheie && culturi.some((cultura) => cultura.cheie === cheie)) return cheie
  const potrivita = culturi.find((cultura) => {
    const prefix = normalizeForSearch(cultura.nume)
    return prefix.length > 0 && (nume === prefix || nume.startsWith(`${prefix} `))
  })
  return potrivita?.cheie ?? null
}

/**
 * Cultura „principală”, căreia îi revin rândurile fără cultură (comenzi fără produs, ajustări vechi, magazin):
 * zmeura, dacă ferma are zmeură (așa număra stocul și până acum), altfel prima cultură a fermei.
 */
export function culturaPrincipala(culturi: readonly CulturaFerma[]): CulturaFerma | null {
  return culturi.find((cultura) => cultura.cheie === 'zmeur') ?? culturi[0] ?? null
}

const LEGUME = new Set([
  'rosie', 'castravete', 'ardei', 'vanata', 'salata', 'spanac', 'fasole', 'dovlecel', 'mazare', 'cartof', 'ceapa',
  'usturoi', 'morcov', 'varza', 'conopida', 'broccoli', 'ridiche', 'sfecla', 'telina', 'praz', 'patrunjel', 'busuioc',
  'rucola', 'gulie',
])
const CEREALE = new Set(['grau', 'porumb', 'floarea soarelui', 'rapita', 'soia', 'orz', 'ovaz'])

/** Categoria produsului pentru o cultură (`produse.categorie`: fruct / leguma / altele). */
export function categorieProdus(cheie: string): 'fruct' | 'leguma' | 'altele' {
  if (LEGUME.has(cheie)) return 'leguma'
  if (CEREALE.has(cheie)) return 'altele'
  return 'fruct'
}
