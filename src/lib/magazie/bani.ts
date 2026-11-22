/**
 * Banii magaziei (doar proprietarul îi vede): prețul pe unitate la „Am cumpărat”, categoria cheltuielii create
 * odată cu intrarea și linia informativă din Rapoarte. Funcții pure.
 */
import { formatNumber } from '@/lib/format-ro'

import { pretMediu, type MiscareStoc } from './stoc'
import type { UnitateStoc } from './unitati'

/** 412 lei pe 25 kg → 16,48. `null` dacă lipsește prețul sau cantitatea. */
export function pretPeUnitate(pretTotal: number | null, cantitate: number | null): number | null {
  const pret = Number(pretTotal)
  const c = Number(cantitate)
  if (pretTotal === null || cantitate === null || !Number.isFinite(pret) || !(c > 0) || pret < 0) return null
  return pret / c
}

/** „16,48 lei/kg”. */
export function textPretPeUnitate(pret: number, unitate: UnitateStoc): string {
  return `${pret.toLocaleString('ro-RO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} lei/${unitate}`
}

/**
 * Categoria cheltuielii pentru o cumpărătură: îngrășămintele merg la „Îngrășăminte” (categoria existentă care se
 * potrivește), restul la „Tratamente”. Ambele sunt în `CATEGORII_CHELTUIELI`.
 */
export function categorieCheltuiala(tipProdus: string | null | undefined): 'Îngrășăminte' | 'Tratamente' {
  return tipProdus === 'ingrasamant' ? 'Îngrășăminte' : 'Tratamente'
}

/** Descrierea cheltuielii: „Magazie: Kristalon Galben 25 kg”. */
export function descriereCheltuiala(nume: string, cantitate: number, unitate: UnitateStoc): string {
  return `Magazie: ${nume} ${formatNumber(cantitate)} ${unitate}`
}

/**
 * „Tratamente: X lei în sezon” (Rapoarte): prețul mediu al fiecărui produs × cantitățile scăzute de tratamentele
 * din perioadă. E informativ: cumpărăturile trecute la cheltuieli sunt deja în profit, deci linia NU scade din
 * profit a doua oară. Produsele fără nicio intrare cu preț nu intră (nu se știe cât au costat).
 */
export function costTratamentePerioada(input: {
  miscari: readonly MiscareStoc[]
  start: string
  end: string
}): { lei: number; produseFaraPret: number } {
  const peProdus = new Map<string, MiscareStoc[]>()
  for (const miscare of input.miscari) {
    const lista = peProdus.get(miscare.produs_id) ?? []
    lista.push(miscare)
    peProdus.set(miscare.produs_id, lista)
  }
  let lei = 0
  let produseFaraPret = 0
  for (const miscari of peProdus.values()) {
    const scazut = miscari
      .filter((miscare) => miscare.tip === 'iesire_tratament' && miscare.data >= input.start && miscare.data <= input.end)
      .reduce((sum, miscare) => sum + -(Number(miscare.cantitate) || 0), 0)
    if (!(scazut > 0)) continue
    const pret = pretMediu(miscari)
    if (pret === null) {
      produseFaraPret += 1
      continue
    }
    lei += scazut * pret
  }
  return { lei, produseFaraPret }
}

/** Textul liniei din Rapoarte. */
export const TEXT_INCLUS_IN_CHELTUIELI = 'inclus în cheltuieli: nu scade încă o dată din profit'

/**
 * A doua cheie de idempotență (cheltuiala creată odată cu intrarea), din cheia formularului: aceeași la reîncercare,
 * alta la un formular nou. Fiecare cifră hexazecimală din ultimele 12 devine 15 − cifra (mereu alta); forma UUID rămâne.
 */
export function cheieDerivata(key: string): string {
  const coada = key.slice(-12).replace(/[0-9a-f]/gi, (cifra) => (15 - parseInt(cifra, 16)).toString(16))
  return `${key.slice(0, -12)}${coada}`
}
