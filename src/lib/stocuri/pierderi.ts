/**
 * Pierderile din stoc cu motiv (promptul 33): „Pierdere” din Stocuri, pe cultură. Motivul e obligatoriu (stricat,
 * consum propriu, donat, altul cu text); nu e venit și nu e cheltuială, doar scade stocul culturii. Se scrie prin
 * `create_pierdere_stoc` (migrarea 20261125100000); `consum_propriu` cu tipul `consum_propriu`, restul cu `pierdere`,
 * motivul în `ajustari_stoc.categorie_pierdere`. Funcții pure.
 */
import { round2 } from '@/lib/format-ro'

export const MOTIVE_PIERDERE = ['stricat', 'consum_propriu', 'donat', 'altul'] as const

export type MotivPierdere = (typeof MOTIVE_PIERDERE)[number]

/** Valorile coloanei: motivele plus `nespecificat` (rânduri vechi și ajustări care nu sunt pierderi). */
export type CategoriePierdere = MotivPierdere | 'nespecificat'

export const ETICHETA_MOTIV_PIERDERE: Record<MotivPierdere, string> = {
  stricat: 'Stricat',
  consum_propriu: 'Consum propriu',
  donat: 'Donat',
  altul: 'Altul',
}

export function esteMotivPierdere(value: unknown): value is MotivPierdere {
  return typeof value === 'string' && (MOTIVE_PIERDERE as readonly string[]).includes(value)
}

/** Tipul rândului din `ajustari_stoc`: consumul propriu își păstrează tipul vechi, restul sunt pierderi. */
export function tipPentruMotiv(motiv: MotivPierdere): 'pierdere' | 'consum_propriu' {
  return motiv === 'consum_propriu' ? 'consum_propriu' : 'pierdere'
}

/** Textul salvat în `motiv`: la „Altul”, ce s-a întâmplat; nota, dacă e, după el. */
export function detaliuPierdere(motiv: MotivPierdere, textAltul: string, nota: string): string | null {
  const parti = [motiv === 'altul' ? textAltul.trim() : '', nota.trim()].filter(Boolean)
  return parti.length > 0 ? parti.join(' · ') : null
}

/** De ce nu se poate salva pierderea, sau `null`. Trecerea sub zero nu e aici: cere doar confirmare. */
export function problemaPierdere(input: { motiv: MotivPierdere | null; kg: number | null; textAltul: string; zi: string; azi: string }): string | null {
  if (!input.motiv) return 'Alege motivul.'
  if (input.motiv === 'altul' && !input.textAltul.trim()) return 'Scrie ce s-a întâmplat.'
  if (!input.kg || input.kg <= 0) return 'Scrie câte kilograme.'
  if (input.zi > input.azi) return 'Ziua nu poate fi în viitor.'
  return null
}

/** Pierderea duce stocul culturii sub zero: se cere confirmarea omului (și pe server, `p_sub_zero_confirmat`). */
export function trecePesteStoc(kg: number | null, disponibil: number): boolean {
  if (!kg || kg <= 0) return false
  return round2(disponibil - kg) < 0
}

export type RandPierdere = {
  data: string
  delta_kg: number | string
  tip: string
  categorie_pierdere?: string | null
}

export type SumarPierderi = {
  totalKg: number
  /** Pe motiv; rândurile vechi (`nespecificat`) intră doar în total. */
  peMotiv: Record<MotivPierdere, number>
}

/** Motivul unui rând din istoric: cel salvat; la rândurile vechi, `consum_propriu` după tip, altfel `null`. */
export function motivRand(rand: Pick<RandPierdere, 'tip' | 'categorie_pierdere'>): MotivPierdere | null {
  if (esteMotivPierdere(rand.categorie_pierdere)) return rand.categorie_pierdere
  if (rand.tip === 'consum_propriu') return 'consum_propriu'
  return null
}

/** E o pierdere (tipul `pierdere` sau `consum_propriu`, ca scădere)? */
export function estePierdere(rand: Pick<RandPierdere, 'tip' | 'delta_kg'>): boolean {
  return (rand.tip === 'pierdere' || rand.tip === 'consum_propriu') && Number(rand.delta_kg) < 0
}

/** „Pierderi în sezon”: rândurile de pierdere din ziua `deLa` încolo (inclusiv), în kg pozitive. */
export function sumarPierderiSezon(randuri: readonly RandPierdere[], deLa: string): SumarPierderi {
  const peMotiv: Record<MotivPierdere, number> = { stricat: 0, consum_propriu: 0, donat: 0, altul: 0 }
  let totalKg = 0
  for (const rand of randuri) {
    if (!estePierdere(rand)) continue
    if (String(rand.data).slice(0, 10) < deLa) continue
    const kg = Math.abs(Number(rand.delta_kg) || 0)
    totalKg = round2(totalKg + kg)
    const motiv = motivRand(rand)
    if (motiv) peMotiv[motiv] = round2(peMotiv[motiv] + kg)
  }
  return { totalKg, peMotiv }
}

/** Eticheta rândului din istoric: „Pierdere · stricat”, „Consum propriu”, „Pierdere” (rând vechi). */
export function etichetaRandPierdere(rand: Pick<RandPierdere, 'tip' | 'categorie_pierdere'>): string | null {
  if (rand.tip !== 'pierdere' && rand.tip !== 'consum_propriu') return null
  const motiv = motivRand(rand)
  if (motiv === 'consum_propriu') return 'Consum propriu'
  if (motiv) return `Pierdere · ${ETICHETA_MOTIV_PIERDERE[motiv].toLocaleLowerCase('ro-RO')}`
  return 'Pierdere'
}
