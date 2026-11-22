/**
 * Stocul magaziei, fără React și fără Supabase. Aceleași reguli ca RPC-ul `magazie_stoc()` (migrarea
 * `20261122130000_magazia.sql`); le folosesc și notificarea de luni (cron, service role) și Rapoartele.
 *
 * - stocul = suma mișcărilor (+ intrări, − ieșiri din tratamente, ± corecții);
 * - doza ultimei aplicări = tot ce a scos ultimul tratament făcut cu produsul (lotul, pe toate parcelele);
 * - „ajunge pentru ~N aplicări” = stoc / doza ultimei aplicări;
 * - „pe terminate” = stoc ≤ 0, sau sub prag, sau (fără prag) sub doza ultimei aplicări;
 * - prețul mediu ponderat = Σ preț / Σ cantitate, doar din intrările cu preț; valoarea = stoc × preț mediu.
 *   Le vede doar proprietarul.
 */
import type { UnitateStoc } from './unitati'

export type TipMiscare = 'intrare' | 'iesire_tratament' | 'corectie'

export interface MiscareStoc {
  produs_id: string
  tip: TipMiscare
  /** Cu semn, în unitatea produsului. */
  cantitate: number
  data: string
  created_at?: string | null
  pret_total_lei?: number | null
  /** Doar la ieșiri: tratamentul (lotul sau aplicarea) care a scos cantitatea. */
  grup?: string | null
}

export interface ProdusMagazie {
  produs_id: string
  nume: string
  tip: string | null
  unitate: UnitateStoc
  prag: number | null
}

export interface StocProdus {
  produs_id: string
  nume: string
  tip: string | null
  unitate: UnitateStoc
  stoc: number
  prag: number | null
  doza_ultima: number | null
  aplicari_ramase: number | null
  pe_terminate: boolean
  /** `null` pentru operator sau fără intrări cu preț. */
  pret_mediu: number | null
  valoare: number | null
  ultima_miscare: string | null
}

const num = (value: unknown) => {
  const n = Number(value)
  return Number.isFinite(n) ? n : 0
}

/** Prețul mediu ponderat din intrările cu preț. `null` dacă nu e nicio intrare cu preț. */
export function pretMediu(miscari: readonly Pick<MiscareStoc, 'tip' | 'cantitate' | 'pret_total_lei'>[]): number | null {
  let lei = 0
  let cantitate = 0
  for (const miscare of miscari) {
    if (miscare.tip !== 'intrare' || miscare.pret_total_lei === null || miscare.pret_total_lei === undefined) continue
    const c = num(miscare.cantitate)
    if (!(c > 0)) continue
    lei += num(miscare.pret_total_lei)
    cantitate += c
  }
  return cantitate > 0 ? lei / cantitate : null
}

/** Cât a scos ultimul tratament făcut (suma pe lot). `null` dacă produsul n-a ieșit niciodată într-un tratament. */
export function dozaUltimaAplicare(miscari: readonly MiscareStoc[]): number | null {
  const grupuri = new Map<string, { zi: string; creat: string; cantitate: number }>()
  for (const miscare of miscari) {
    if (miscare.tip !== 'iesire_tratament') continue
    const cheie = miscare.grup ?? `${miscare.data}|${miscare.created_at ?? ''}`
    const curent = grupuri.get(cheie) ?? { zi: '', creat: '', cantitate: 0 }
    curent.cantitate += -num(miscare.cantitate)
    if (miscare.data > curent.zi) curent.zi = miscare.data
    const creat = miscare.created_at ?? ''
    if (creat > curent.creat) curent.creat = creat
    grupuri.set(cheie, curent)
  }
  let ultim: { zi: string; creat: string; cantitate: number } | null = null
  for (const grup of grupuri.values()) {
    if (!ultim || grup.zi > ultim.zi || (grup.zi === ultim.zi && grup.creat > ultim.creat)) ultim = grup
  }
  return ultim && ultim.cantitate > 0 ? ultim.cantitate : null
}

/** De câte ori mai ajunge stocul, la doza ultimei aplicări (cu zecimale; afișarea rotunjește). */
export function aplicariRamase(stoc: number, doza: number | null): number | null {
  if (doza === null || !(doza > 0)) return null
  return Math.max(stoc, 0) / doza
}

/** Pe terminate: nimic în magazie, sub prag, sau (fără prag) sub cât a cerut ultima aplicare. */
export function estePeTerminate(stoc: number, prag: number | null, doza: number | null): boolean {
  if (stoc <= 0) return true
  if (prag !== null && prag !== undefined) return stoc < prag
  if (doza !== null && doza > 0) return stoc < doza
  return false
}

/** Stocul pe produs, din mișcări. `esteProprietar = false` → fără preț și valoare (ca RPC-ul). */
export function calculeazaStoc(input: {
  produse: readonly ProdusMagazie[]
  miscari: readonly MiscareStoc[]
  esteProprietar: boolean
}): StocProdus[] {
  const peProdus = new Map<string, MiscareStoc[]>()
  for (const miscare of input.miscari) {
    const lista = peProdus.get(miscare.produs_id) ?? []
    lista.push(miscare)
    peProdus.set(miscare.produs_id, lista)
  }
  return input.produse
    .map((produs) => {
      const miscari = peProdus.get(produs.produs_id) ?? []
      const stoc = miscari.reduce((sum, miscare) => sum + num(miscare.cantitate), 0)
      const doza = dozaUltimaAplicare(miscari)
      const pret = input.esteProprietar ? pretMediu(miscari) : null
      const ultima = miscari.reduce<string | null>((max, miscare) => (!max || miscare.data > max ? miscare.data : max), null)
      return {
        produs_id: produs.produs_id,
        nume: produs.nume,
        tip: produs.tip,
        unitate: produs.unitate,
        stoc,
        prag: produs.prag,
        doza_ultima: doza,
        aplicari_ramase: aplicariRamase(stoc, doza),
        pe_terminate: estePeTerminate(stoc, produs.prag, doza),
        pret_mediu: pret,
        valoare: pret === null ? null : Math.max(stoc, 0) * pret,
        ultima_miscare: ultima,
      }
    })
    .sort((a, b) => a.nume.localeCompare(b.nume, 'ro-RO'))
}

/** Ce vede operatorul: aceleași cantități, fără bani (plasă de siguranță peste RPC). */
export function faraPreturi<T extends { pret_mediu?: number | null; valoare?: number | null }>(rand: T, esteProprietar: boolean): T {
  if (esteProprietar) return rand
  return { ...rand, pret_mediu: null, valoare: null }
}

/** „~1 aplicare”, „~9 aplicări”, „nu mai ajunge”; `null` când nu se știe doza (produs neaplicat încă). */
export function textAplicariRamase(aplicari: number | null): string | null {
  if (aplicari === null) return null
  if (aplicari < 0.5) return 'nu mai ajunge pentru o aplicare'
  const n = Math.round(aplicari)
  return n === 1 ? 'ajunge pentru ~1 aplicare' : `ajunge pentru ~${n} aplicări`
}

/** Fracția barei de nivel (0–1): stocul față de pragul „pe terminate” × 3, altfel față de 3 aplicări. */
export function nivelBara(stoc: number, prag: number | null, doza: number | null): number {
  if (stoc <= 0) return 0
  const referinta = prag && prag > 0 ? prag * 3 : doza && doza > 0 ? doza * 3 : null
  if (!referinta) return 1
  return Math.min(1, stoc / referinta)
}

export type FiltruMagazie = 'toate' | 'pe_terminate' | 'fertilizanti' | 'protectie'

const TIPURI_FERTILIZANTI = new Set(['ingrasamant', 'foliar', 'bioregulator'])
const TIPURI_PROTECTIE = new Set(['fungicid', 'insecticid', 'acaricid', 'erbicid'])

export function esteFertilizant(tip: string | null | undefined): boolean {
  return TIPURI_FERTILIZANTI.has(tip ?? '')
}

export function potrivesteFiltruMagazie(rand: Pick<StocProdus, 'tip' | 'pe_terminate'>, filtru: FiltruMagazie): boolean {
  if (filtru === 'pe_terminate') return rand.pe_terminate
  if (filtru === 'fertilizanti') return TIPURI_FERTILIZANTI.has(rand.tip ?? '')
  if (filtru === 'protectie') return TIPURI_PROTECTIE.has(rand.tip ?? '')
  return true
}

/** „Magazia: 15 produse · 2 pe terminate”. */
export function rezumatMagazie(stoc: readonly Pick<StocProdus, 'pe_terminate'>[]): { produse: number; peTerminate: number; text: string } {
  const produse = stoc.length
  const peTerminate = stoc.filter((rand) => rand.pe_terminate).length
  const textProduse = produse === 1 ? '1 produs' : `${produse} produse`
  return { produse, peTerminate, text: peTerminate > 0 ? `${textProduse} · ${peTerminate} pe terminate` : textProduse }
}
