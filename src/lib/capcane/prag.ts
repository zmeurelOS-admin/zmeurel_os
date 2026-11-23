/**
 * Pragul la capcane, pe fermă (`tenant_settings.prag_capcane`), pe tip de capcană.
 * Implicit: Drosophila 1 captură / capcană / săptămână, doar în coacere; celelalte tipuri fără prag.
 * „Peste prag” = în săptămâna verificării, capturile grupului ≥ prag × numărul de capcane din grup
 * (și, dacă pragul e „doar în coacere”, parcela e în coacere). Funcții pure.
 */
import { TIPURI_CAPCANA, type TipCapcana } from './model'

export interface PragTip {
  /** Capturi pe capcană, pe săptămână (> 0). */
  prag: number
  doar_in_coacere: boolean
}

/** `null` pe un tip = fără prag (nicio alertă). */
export type PraguriCapcane = Record<TipCapcana, PragTip | null>

export const PRAGURI_IMPLICITE: PraguriCapcane = {
  drosophila: { prag: 1, doar_in_coacere: true },
  lipicioasa_galbena: null,
  feromoni: null,
  alta: null,
}

const PRAG_MAXIM = 1000

function pragValid(value: unknown): PragTip | null | undefined {
  if (value === null) return null
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined
  const raw = value as Record<string, unknown>
  const prag = Number(raw.prag)
  if (!Number.isFinite(prag) || prag <= 0 || prag > PRAG_MAXIM) return null
  return { prag: Math.round(prag * 10) / 10, doar_in_coacere: raw.doar_in_coacere === true }
}

/**
 * Coloana din baza de date → pragurile pe toate tipurile. Un tip lipsă primește implicitul; `null` sau un prag
 * ciudat (0, negativ, text) pe un tip = fără prag (fermierul l-a oprit).
 */
export function normalizeazaPraguri(value: unknown): PraguriCapcane {
  const rezultat: PraguriCapcane = { ...PRAGURI_IMPLICITE }
  if (!value || typeof value !== 'object' || Array.isArray(value)) return rezultat
  for (const tip of TIPURI_CAPCANA) {
    if (!(tip in (value as Record<string, unknown>))) continue
    const prag = pragValid((value as Record<string, unknown>)[tip])
    if (prag !== undefined) rezultat[tip] = prag
  }
  return rezultat
}

/** Ce se scrie în `tenant_settings.prag_capcane` (toate tipurile, explicit). */
export function praguriDeSalvat(praguri: PraguriCapcane): Record<TipCapcana, PragTip | null> {
  return { ...praguri }
}

/** Câte capturi trebuie, pe săptămână, ca grupul să treacă de prag (`prag × bucăți`). */
export function capturiLaPrag(prag: PragTip, nrBucati: number): number {
  return prag.prag * Math.max(1, nrBucati)
}

/**
 * Grupul e peste prag în săptămâna dată? Fără prag, fără capturi sau (la „doar în coacere”) în afara coacerii: nu.
 */
export function pestePrag(input: { capturi: number | null; nrBucati: number; prag: PragTip | null; inCoacere: boolean }): boolean {
  const { capturi, prag } = input
  if (!prag || capturi === null || capturi <= 0) return false
  if (prag.doar_in_coacere && !input.inCoacere) return false
  return capturi >= capturiLaPrag(prag, input.nrBucati)
}

/** „1 captură / capcană / săptămână, în coacere”. */
export function textPrag(prag: PragTip | null): string {
  if (!prag) return 'fără prag'
  const valoare = String(prag.prag).replace('.', ',')
  return `${valoare} ${prag.prag === 1 ? 'captură' : 'capturi'} / capcană / săptămână${prag.doar_in_coacere ? ', în coacere' : ''}`
}
