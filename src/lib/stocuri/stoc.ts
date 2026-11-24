/**
 * Ecranul Stocuri (prompt 19): cifra mare, descompunerea ei, rândul informativ „Cal. II” și istoricul ajustărilor.
 * Funcții pure. Stocul e cal. I (ce intră în comenzi), pe cultura fermei (`pe-cultura.ts`); serverul e sursa adevărului
 * (`get_sellable_cal1_stock_summary`), aici doar așezăm cifrele lui.
 */
import { round2 } from '@/lib/format-ro'
import { inceputSezon } from '@/lib/sezon'
import { esteZmeura } from '@/lib/stoc-pe-produs'
import { cheieCultura } from '@/lib/parcele/culturi-ferma'
import { AJUSTARE_STOC_TIPURI, type AjustareStocTip } from '@/lib/supabase/queries/ajustari-stoc'

export interface StocSummary {
  recoltatCal1Kg: number
  consumatDefinitivCal1Kg: number
  rezervatActivCal1Kg: number
  stocCal1LedgerKg: number
  disponibilCal1Kg: number
}

export interface DescompunereStoc {
  disponibil: number
  /** Tot cal. I recoltat al culturii (funcția din bază nu taie pe sezon). */
  recoltat: number
  livrat: number
  inLivrare: number
  /** Suma ajustărilor (semn inclus), scoasă din aceleași cifre ale funcției: stoc − recoltat + livrat. */
  ajustari: number
}

/**
 * Descompunerea cifrei mari, doar din ce dă `get_sellable_cal1_stock_summary`:
 * `disponibil = recoltat − livrat − în livrare + ajustări`. Fără formulă paralelă: ajustările se deduc din
 * `stoc_cal1_ledger_kg = recoltat − livrat + ajustări`, deci se leagă exact de cifra mare.
 */
export function descompunereStoc(summary: StocSummary): DescompunereStoc {
  const recoltat = round2(summary.recoltatCal1Kg)
  const livrat = round2(summary.consumatDefinitivCal1Kg)
  const inLivrare = round2(summary.rezervatActivCal1Kg)
  const ajustari = round2(summary.stocCal1LedgerKg - recoltat + livrat)
  return { disponibil: round2(summary.disponibilCal1Kg), recoltat, livrat, inLivrare, ajustari }
}

export interface RecoltareCal2 {
  data: string | null
  parcela_id: string | null
  kg_cal2: number | null
}

export interface ParcelaCultura {
  id: string
  cultura?: string | null
  tip_fruct?: string | null
}

/**
 * Cal. II din sezonul curent (regula unică `inceputSezon`), informativ: nu intră în disponibil.
 * Aceeași regulă de produs ca stocul: dacă ferma are recoltări de zmeură, numărăm doar zmeura; altfel tot.
 * Cultura vine din parcelă (`cultura`, altfel `tip_fruct`).
 */
export function cal2InSezon(
  recoltari: readonly RecoltareCal2[],
  parcele: readonly ParcelaCultura[],
  azi: string,
  /** Stocul pe cultură: doar recoltările culturii (cheia din `cheieCultura`). */
  cheie?: string | null,
): number {
  const culturaPeParcela = new Map(parcele.map((parcela) => [parcela.id, parcela.cultura?.trim() || parcela.tip_fruct?.trim() || null]))
  const culturaRecoltarii = (recoltare: RecoltareCal2) => (recoltare.parcela_id ? culturaPeParcela.get(recoltare.parcela_id) : null)
  const eZmeura = (recoltare: RecoltareCal2) => esteZmeura(culturaRecoltarii(recoltare))
  const areZmeura = !cheie && recoltari.some(eZmeura)
  const start = inceputSezon(azi, recoltari)
  let total = 0
  for (const recoltare of recoltari) {
    const zi = String(recoltare.data ?? '').slice(0, 10)
    if (!zi || zi < start || zi > azi) continue
    if (cheie && cheieCultura(culturaRecoltarii(recoltare)) !== cheie) continue
    if (areZmeura && !eZmeura(recoltare)) continue
    total += Number(recoltare.kg_cal2) || 0
  }
  return round2(total)
}

// ─── Ajustări ─────────────────────────────────────────────────────────────────

/** Textul plăcilor din „Ajustează stocul” (aceleași tipuri ca în bază, scrise ca în mockup). */
export const ETICHETA_AJUSTARE: Record<AjustareStocTip, string> = {
  congelat: 'Congelat',
  procesat: 'Procesat (gem, suc)',
  pierdere: 'Pierdere',
  consum_propriu: 'Consum propriu',
  corectie_plus: 'Corecție în plus',
  corectie_minus: 'Corecție în minus',
  altul: 'Altul',
}

export const TIPURI_AJUSTARE: readonly AjustareStocTip[] = AJUSTARE_STOC_TIPURI

/**
 * „Ajustează stocul” după migrarea pierderilor (promptul 33): pierderea și consumul propriu se notează din butonul
 * „Pierdere”, cu motiv; aici rămân congelat, procesat, corecțiile și altul.
 */
export const TIPURI_AJUSTARE_FARA_PIERDERI: readonly AjustareStocTip[] = AJUSTARE_STOC_TIPURI.filter(
  (tip) => tip !== 'pierdere' && tip !== 'consum_propriu',
)

export function esteTipAjustare(tip: string): tip is AjustareStocTip {
  return (AJUSTARE_STOC_TIPURI as readonly string[]).includes(tip)
}

/** Eticheta unui rând din istoric (un tip necunoscut rămâne cum e în bază). */
export function etichetaAjustare(tip: string): string {
  return esteTipAjustare(tip) ? ETICHETA_AJUSTARE[tip] : tip
}

/** Doar „Corecție în plus” adaugă; toate celelalte scad din stoc. */
export function ajustareAdauga(tip: AjustareStocTip): boolean {
  return tip === 'corectie_plus'
}

/**
 * De ce nu se poate salva ajustarea, sau `null`. O scădere nu poate duce disponibilul sub 0
 * (aceeași regulă ca în `create_ajustare_stoc`, care o verifică oricum pe server).
 */
export function problemaAjustare(tip: AjustareStocTip | null, kg: number | null, disponibil: number): string | null {
  if (!tip) return 'Alege motivul.'
  if (!kg || kg <= 0) return 'Scrie câte kilograme.'
  if (!ajustareAdauga(tip) && round2(kg) > round2(Math.max(disponibil, 0))) {
    return disponibil > 0
      ? `Ai doar ${formatKgScurt(disponibil)} disponibile. Nu poți scădea mai mult.`
      : 'Nu ai nimic disponibil la cal. I: nu ai ce scădea.'
  }
  return null
}

function formatKgScurt(kg: number): string {
  return `${round2(kg).toLocaleString('ro-RO', { maximumFractionDigits: 2 })} kg`
}

export interface AjustareRand {
  id: string
  data: string
  delta_kg: number
  tip: string
  motiv: string | null
  created_at?: string | null
}

/** Istoricul pe zile, cea mai nouă zi întâi; în aceeași zi, cea mai nouă ajustare întâi. */
export function ajustariPeZile<T extends AjustareRand>(ajustari: readonly T[]): { zi: string; randuri: T[] }[] {
  const sortate = [...ajustari].sort((a, b) => {
    const zi = String(b.data).slice(0, 10).localeCompare(String(a.data).slice(0, 10))
    return zi !== 0 ? zi : String(b.created_at ?? '').localeCompare(String(a.created_at ?? ''))
  })
  const grupe: { zi: string; randuri: T[] }[] = []
  for (const rand of sortate) {
    const zi = String(rand.data).slice(0, 10)
    const ultima = grupe[grupe.length - 1]
    if (ultima && ultima.zi === zi) ultima.randuri.push(rand)
    else grupe.push({ zi, randuri: [rand] })
  }
  return grupe
}

/** „− 10 kg” / „+ 4,5 kg” (cu spațiu, ca în mockup). */
export function deltaKgText(delta: number): string {
  const valoare = round2(Math.abs(delta)).toLocaleString('ro-RO', { maximumFractionDigits: 2 })
  return `${delta < 0 ? '−' : '+'} ${valoare} kg`
}
