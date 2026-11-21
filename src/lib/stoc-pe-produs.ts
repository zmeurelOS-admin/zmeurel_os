/**
 * Regula stocului cal. 1 pe produsul vândut, în oglindă cu `get_sellable_cal1_stock_summary`
 * (migrarea 20261121150000). Serverul e sursa adevărului; aici e regula scrisă și testată.
 *
 * - Cultura unei recoltări vine din `resolve_recoltare_stock_identity` (alegerea din recoltare, apoi
 *   prima cultură a parcelei, apoi cultura parcelei), normalizată: fără diacritice și majuscule.
 * - Dacă ferma are cel puțin o recoltare de zmeură (cultura începe cu „zmeur”), stocul numără doar zmeura.
 * - Altfel (nicio zmeură), stocul numără toate recoltările, ca înainte. O fermă cu o singură cultură are
 *   deci același stoc ca înainte.
 */
import { round2 } from '@/lib/format-ro'

const DIACRITICE: Record<string, string> = { ă: 'a', â: 'a', î: 'i', ș: 's', ş: 's', ț: 't', ţ: 't' }

/** Ca `translate(lower(btrim(...)), 'ăâîșşțţ', 'aaissttt')` din SQL; gol → `null`. */
export function culturaNormalizata(cultura: string | null | undefined): string | null {
  const text = String(cultura ?? '')
    .trim()
    .toLowerCase()
    .replace(/[ăâîșşțţ]/g, (char) => DIACRITICE[char] ?? char)
  return text || null
}

export function esteZmeura(cultura: string | null | undefined): boolean {
  return culturaNormalizata(cultura)?.startsWith('zmeur') ?? false
}

export function recoltatCal1PentruStoc(recoltari: readonly { kg_cal1: number | null; cultura: string | null }[]): number {
  let toate = 0
  let zmeura = 0
  let areZmeura = false
  for (const recoltare of recoltari) {
    const kg = Number(recoltare.kg_cal1) || 0
    toate += kg
    if (esteZmeura(recoltare.cultura)) {
      areZmeura = true
      zmeura += kg
    }
  }
  return round2(areZmeura ? zmeura : toate)
}
