/**
 * Ecranul Produse (prompt 19): lista, formularul și regula de ștergere. Funcții pure.
 * Câmpurile de magazin și asociație (poze, categoria de asociație, greutatea aproximativă) nu se mai
 * afișează până la magazinul nou; datele lor din bază rămân neatinse (formularul nu le trimite).
 */
import { formatLei, formatNumber, searchKey } from '@/lib/format-ro'
import type { CategorieProdus, Produs } from '@/lib/supabase/queries/produse'

/** Valorile permise de `produse_unitate_vanzare_check`: kg, buc, ladă, casoletă, palet, cutie. */
export const UNITATI_PRINCIPALE = ['kg', 'casoletă', 'ladă', 'buc'] as const
export const UNITATI_PERMISE = ['kg', 'casoletă', 'ladă', 'buc', 'cutie', 'palet'] as const
export type UnitateProdus = (typeof UNITATI_PERMISE)[number]

export const ETICHETA_UNITATE: Record<UnitateProdus, string> = {
  kg: 'kg',
  casoletă: 'casoletă',
  ladă: 'ladă',
  buc: 'bucată',
  cutie: 'cutie',
  palet: 'palet',
}

export const CATEGORII_AFISATE: readonly CategorieProdus[] = ['fruct', 'leguma', 'procesat', 'altele']

export const ETICHETA_CATEGORIE: Record<CategorieProdus, string> = {
  fruct: 'Fruct',
  leguma: 'Legumă',
  procesat: 'Procesat',
  altele: 'Altele',
}

export function esteUnitate(value: string | null | undefined): value is UnitateProdus {
  return (UNITATI_PERMISE as readonly string[]).includes(String(value ?? ''))
}

/** Plăcile „Se vinde la”: cele 4 principale, plus valoarea produsului dacă e alta (cutie, palet). */
export function unitatiDeAles(curenta: string | null | undefined): UnitateProdus[] {
  const lista: UnitateProdus[] = [...UNITATI_PRINCIPALE]
  if (esteUnitate(curenta) && !lista.includes(curenta)) lista.push(curenta)
  return lista
}

/** „Casoletă 500 g · fruct”, „kg · fruct”. */
export function detaliuProdus(produs: Pick<Produs, 'unitate_vanzare' | 'gramaj_per_unitate' | 'categorie'>): string {
  const unitate = esteUnitate(produs.unitate_vanzare) ? ETICHETA_UNITATE[produs.unitate_vanzare] : produs.unitate_vanzare || 'kg'
  const gramaj = Number(produs.gramaj_per_unitate)
  const cuGramaj = unitate !== 'kg' && Number.isFinite(gramaj) && gramaj > 0 ? `${unitate} ${formatNumber(gramaj)} g` : unitate
  const prima = cuGramaj.charAt(0).toLocaleUpperCase('ro-RO') + cuGramaj.slice(1)
  const categorie = ETICHETA_CATEGORIE[produs.categorie]?.toLocaleLowerCase('ro-RO') ?? produs.categorie
  return `${prima} · ${categorie}`
}

/** „18 lei” sau „—” când produsul nu are preț. */
export function pretProdus(produs: Pick<Produs, 'pret_unitar'>): string {
  return produs.pret_unitar == null ? '—' : formatLei(Number(produs.pret_unitar))
}

export type FilaProduse = 'activ' | 'inactiv'

export function produseAfisate<T extends Pick<Produs, 'nume' | 'descriere' | 'status'>>(produse: readonly T[], fila: FilaProduse, cautare: string): T[] {
  const q = searchKey(cautare)
  return produse
    .filter((produs) => produs.status === fila)
    .filter((produs) => !q || searchKey(produs.nume).includes(q) || searchKey(produs.descriere).includes(q))
}

// ─── Formularul ───────────────────────────────────────────────────────────────

export interface CiornaProdus {
  nume: string
  unitate: UnitateProdus
  /** Text, cu virgulă sau punct. Gol = fără. */
  gramaj: string
  pret: string
  categorie: CategorieProdus
  activ: boolean
}

export const CIORNA_GOALA: CiornaProdus = { nume: '', unitate: 'kg', gramaj: '', pret: '', categorie: 'fruct', activ: true }

export function ciornaDinProdus(produs: Produs): CiornaProdus {
  return {
    nume: produs.nume ?? '',
    unitate: esteUnitate(produs.unitate_vanzare) ? produs.unitate_vanzare : 'kg',
    gramaj: produs.gramaj_per_unitate != null ? String(produs.gramaj_per_unitate).replace('.', ',') : '',
    pret: produs.pret_unitar != null ? String(produs.pret_unitar).replace('.', ',') : '',
    categorie: CATEGORII_AFISATE.includes(produs.categorie) ? produs.categorie : 'altele',
    activ: produs.status !== 'inactiv',
  }
}

/** Text → număr; gol → `null`; nevalid → `NaN`. */
export function numarDinText(text: string): number | null {
  const curat = text.trim().replace(/\s/g, '').replace(',', '.')
  if (!curat) return null
  if (!/^\d+(\.\d+)?$/.test(curat)) return Number.NaN
  return Number(curat)
}

export interface EroriProdus {
  nume?: string
  gramaj?: string
  pret?: string
}

export function eroriProdus(ciorna: CiornaProdus): EroriProdus {
  const erori: EroriProdus = {}
  if (!ciorna.nume.trim()) erori.nume = 'Scrie numele produsului.'
  const gramaj = numarDinText(ciorna.gramaj)
  if (ciorna.unitate !== 'kg' && gramaj !== null && (!Number.isFinite(gramaj) || gramaj <= 0)) erori.gramaj = 'Scrie gramajul în grame (ex. 500).'
  const pret = numarDinText(ciorna.pret)
  if (pret !== null && !Number.isFinite(pret)) erori.pret = 'Scrie prețul în lei (ex. 18 sau 18,50).'
  return erori
}

/** Ce se trimite la salvare. Câmpurile de magazin / asociație lipsesc: rămân cum sunt în bază. */
export function payloadProdus(ciorna: CiornaProdus) {
  const gramaj = numarDinText(ciorna.gramaj)
  const pret = numarDinText(ciorna.pret)
  return {
    nume: ciorna.nume.trim(),
    unitate_vanzare: ciorna.unitate,
    gramaj_per_unitate: ciorna.unitate !== 'kg' && gramaj !== null && Number.isFinite(gramaj) ? gramaj : null,
    pret_unitar: pret !== null && Number.isFinite(pret) ? Math.round(pret * 100) / 100 : null,
    categorie: ciorna.categorie,
    status: (ciorna.activ ? 'activ' : 'inactiv') as 'activ' | 'inactiv',
  }
}

export function ciornaSchimbata(a: CiornaProdus, b: CiornaProdus): boolean {
  return JSON.stringify(payloadProdus(a)) !== JSON.stringify(payloadProdus(b))
}

// ─── Ștergerea ────────────────────────────────────────────────────────────────

export interface UtilizareProdus {
  comenzi: number
  vanzari: number
}

/**
 * Un produs folosit în comenzi sau vânzări nu se șterge (cheile `comenzi.produs_id` / `vanzari.produs_id`
 * ar rămâne goale și istoricul și-ar pierde produsul): se poate doar dezactiva. `null` = se poate șterge.
 */
export function motivFaraStergere(utilizare: UtilizareProdus): string | null {
  const parti: string[] = []
  if (utilizare.comenzi > 0) parti.push(utilizare.comenzi === 1 ? 'o comandă' : `${utilizare.comenzi} comenzi`)
  if (utilizare.vanzari > 0) parti.push(utilizare.vanzari === 1 ? 'o vânzare' : `${utilizare.vanzari} vânzări`)
  if (parti.length === 0) return null
  return `Produsul apare în ${parti.join(' și ')}. Nu se poate șterge; îl poți doar dezactiva.`
}
