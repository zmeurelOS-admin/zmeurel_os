/**
 * Unitățile magaziei: produsul se ține în kg, l sau bucăți, iar tratamentul salvează cantitatea în unitatea lui
 * (ml / g la stropire, kg la fertirigare, l / kg la sol). Aceeași regulă ca `magazie_converteste` din migrarea
 * `20261122130000_magazia.sql`: ml → l și g → kg (împărțit la 1000); restul nu se poate scădea.
 */
import { formatNumber } from '@/lib/format-ro'

export const UNITATI_STOC = ['kg', 'l', 'buc'] as const
export type UnitateStoc = (typeof UNITATI_STOC)[number]

export const ETICHETA_UNITATE: Record<UnitateStoc, string> = { kg: 'kg', l: 'l', buc: 'buc' }

export function esteUnitateStoc(value: unknown): value is UnitateStoc {
  return value === 'kg' || value === 'l' || value === 'buc'
}

/**
 * Cantitatea unei aplicări în unitatea magaziei. `null` = unitate incompatibilă (de ex. `buc` față de `l`,
 * `ml_10l`, `kg_parcela`) sau cantitate lipsă: tratamentul nu scade nimic.
 */
export function convertesteInStoc(cantitate: number | null | undefined, din: string | null | undefined, inUnitate: UnitateStoc): number | null {
  const valoare = Number(cantitate)
  if (cantitate === null || cantitate === undefined || !Number.isFinite(valoare)) return null
  if (inUnitate === 'kg') {
    if (din === 'kg') return valoare
    if (din === 'g') return valoare / 1000
    return null
  }
  if (inUnitate === 'l') {
    if (din === 'l') return valoare
    if (din === 'ml') return valoare / 1000
    return null
  }
  if (din === 'buc' || din === 'nr_bucati') return valoare
  return null
}

/** Unitatea propusă pentru un produs nou în magazie, după cum a fost aplicat (ml / l → l, g / kg → kg). */
export function unitateDinAplicare(unitate: string | null | undefined): UnitateStoc | null {
  if (unitate === 'ml' || unitate === 'l') return 'l'
  if (unitate === 'g' || unitate === 'kg') return 'kg'
  if (unitate === 'buc' || unitate === 'nr_bucati') return 'buc'
  return null
}

/** „0,8 kg”, „12 buc”, „−1,2 l”. Cel mult 2 zecimale (3 sub 1, ca 0,15 l să nu devină 0,2). */
export function formatCantitateStoc(valoare: number, unitate: UnitateStoc | string | null, cuSemn = false): string {
  const abs = Math.abs(valoare)
  const text = formatNumber(abs, abs > 0 && abs < 1 ? 3 : 2)
  const semn = cuSemn ? (valoare > 0 ? '+' : valoare < 0 ? '−' : '') : valoare < 0 ? '−' : ''
  return `${semn}${text}${unitate ? ` ${unitate}` : ''}`
}
