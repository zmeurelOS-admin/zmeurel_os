/**
 * Profitul ESTIMAT pe parcelă (promptul 35, §6 și §8). Vânzările și cheltuielile nu au parcelă în bază, deci:
 *
 * - venitul estimat = kg recoltate pe parcelă × prețul mediu încasat pe kg în perioadă (aceeași regulă de venit ca
 *   Rapoartele: suma intră la `data_incasare`);
 * - cheltuielile directe = plata culesului din recoltările parcelei (`valoare_munca_lei`) + tratamentele din Magazie
 *   (cât a scăzut fiecare aplicare de pe parcelă × prețul mediu al produsului);
 * - restul cheltuielilor din perioadă (cheltuieli − cules − tratamente, cel puțin 0) stă pe rândul „Comune,
 *   neîmpărțite pe parcele” — nu se repartizează în ascuns.
 *
 * Funcții pure, testate. Textele de mai jos (`TITLU_PROFIT_PARCELA`, `REGULA_PROFIT_PARCELA`) apar peste tot unde e
 * tabelul, ca să nu fie citit drept cifră exactă.
 */
import { round2 } from '@/lib/format-ro'
import { pretMediu, type MiscareStoc } from '@/lib/magazie/stoc'
import { isVanzareIncasata, vanzareTotal } from '@/lib/vanzari/incasari'

import type { CheltuialaRaport, ParcelaRaport, RecoltareRaport, VanzareRaport } from './raport'
import { esteParcelaPersonala } from './raport'

export const TITLU_PROFIT_PARCELA = 'Profit pe parcelă (estimat)'
export const ETICHETA_COMUNE = 'Comune, neîmpărțite pe parcele'
export const REGULA_PROFIT_PARCELA =
  'Estimat: venitul = kg recoltate pe parcelă × prețul mediu încasat pe kg în perioadă; cheltuielile directe = plata culesului (din recoltări) + tratamentele din Magazie (preț mediu × cât a scăzut aplicarea). Restul cheltuielilor din perioadă stă pe rândul „Comune, neîmpărțite pe parcele”. Vânzările și cheltuielile nu au parcelă în caiet, de aceea cifrele sunt aproximative.'

/** O ieșire din Magazie cu parcela aplicării (aplicarea de tratament e câte una pe parcelă). */
export interface IesireMagazieParcela extends Pick<MiscareStoc, 'produs_id' | 'cantitate' | 'data'> {
  parcela_id: string | null
}

export interface RandProfitParcela {
  id: string
  nume: string
  kg: number
  venit: number | null
  cules: number
  tratamente: number
  directe: number
  rezultat: number | null
}

export interface ProfitPeParcele {
  /** Prețul mediu încasat pe kg în perioadă; `null` = nicio vânzare încasată (venitul nu se poate estima). */
  pretMediuKg: number | null
  parcele: RandProfitParcela[]
  /** Rândul obligatoriu „Comune, neîmpărțite pe parcele”. */
  comune: number
  totalCheltuieli: number
  /** Suma rezultatelor pe parcele − comune; `null` fără preț mediu. */
  total: number | null
}

const zi = (value: string | null | undefined) => String(value ?? '').slice(0, 10)
const inInterval = (day: string, start: string, end: string) => Boolean(day) && day >= start && day <= end

/** Prețul mediu încasat pe kg: vânzările cu ziua încasării în perioadă (suma întreagă / kg). */
export function pretMediuIncasat(vanzari: readonly VanzareRaport[], start: string, end: string): number | null {
  let lei = 0
  let kg = 0
  for (const vanzare of vanzari) {
    if (!isVanzareIncasata(vanzare.status_plata)) continue
    const ziua = zi(vanzare.data_incasare) || zi(vanzare.data)
    if (!inInterval(ziua, start, end)) continue
    const cantitate = Number(vanzare.cantitate_kg) || 0
    if (cantitate <= 0) continue
    lei += vanzareTotal({ cantitate_kg: cantitate, pret_lei_kg: Number(vanzare.pret_lei_kg) || 0 })
    kg += cantitate
  }
  return kg > 0 ? round2(lei / kg) : null
}

export function profitPeParcele(input: {
  recoltari: readonly RecoltareRaport[]
  parcele: readonly ParcelaRaport[]
  vanzari: readonly VanzareRaport[]
  cheltuieli: readonly CheltuialaRaport[]
  /** Toate mișcările din Magazie (pentru prețul mediu al produselor). */
  miscariMagazie: readonly MiscareStoc[]
  /** Ieșirile din Magazie cu parcela aplicării. */
  iesiri: readonly IesireMagazieParcela[]
  start: string
  end: string
}): ProfitPeParcele {
  const { start, end } = input
  const pretKg = pretMediuIncasat(input.vanzari, start, end)
  const comerciale = input.parcele.filter((parcela) => !esteParcelaPersonala(parcela))

  const preturi = new Map<string, number | null>()
  const pretProdus = (produsId: string) => {
    if (!preturi.has(produsId)) preturi.set(produsId, pretMediu(input.miscariMagazie.filter((miscare) => miscare.produs_id === produsId)))
    return preturi.get(produsId) ?? null
  }

  const randuri = comerciale.map<RandProfitParcela>((parcela) => {
    let kg = 0
    let cules = 0
    for (const recoltare of input.recoltari) {
      if (recoltare.parcela_id !== parcela.id || !inInterval(zi(recoltare.data), start, end)) continue
      kg += (Number(recoltare.kg_cal1) || 0) + (Number(recoltare.kg_cal2) || 0)
      cules += Number(recoltare.valoare_munca_lei) || 0
    }
    let tratamente = 0
    for (const iesire of input.iesiri) {
      if (iesire.parcela_id !== parcela.id || !inInterval(zi(iesire.data), start, end)) continue
      const pret = pretProdus(iesire.produs_id)
      if (pret !== null) tratamente += Math.abs(Number(iesire.cantitate) || 0) * pret
    }
    const venit = pretKg === null ? null : round2(kg * pretKg)
    const directe = round2(cules + tratamente)
    return {
      id: parcela.id,
      nume: parcela.nume_parcela?.trim() || 'Parcelă',
      kg: round2(kg),
      venit,
      cules: round2(cules),
      tratamente: round2(tratamente),
      directe,
      rezultat: venit === null ? null : round2(venit - directe),
    }
  })

  const totalCheltuieli = round2(input.cheltuieli.filter((cheltuiala) => inInterval(zi(cheltuiala.data), start, end)).reduce((sum, cheltuiala) => sum + (Number(cheltuiala.suma_lei) || 0), 0))
  const directeToate = randuri.reduce((sum, rand) => sum + rand.directe, 0)
  const comune = round2(Math.max(0, totalCheltuieli - directeToate))
  const parcele = randuri.filter((rand) => rand.kg > 0 || rand.directe > 0).sort((a, b) => (b.rezultat ?? -Infinity) - (a.rezultat ?? -Infinity) || b.kg - a.kg)
  return {
    pretMediuKg: pretKg,
    parcele,
    comune,
    totalCheltuieli,
    total: pretKg === null ? null : round2(parcele.reduce((sum, rand) => sum + (rand.rezultat ?? 0), 0) - comune),
  }
}
