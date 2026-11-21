/**
 * Registrul de vânzări: rândurile cu numele clientului și banii lor, cardurile de sus și listele.
 * Funcții pure, peste `lib/vanzari/incasari` (aceeași socoteală ca în Acasă și în fișa clientului).
 */
import { monthPrefix, type MonthRef } from '@/lib/financial/view'
import { round2, searchKey } from '@/lib/format-ro'
import type { Comanda } from '@/lib/supabase/queries/comenzi'
import type { Vanzare } from '@/lib/supabase/queries/vanzari'

import { isVanzareIncasata, vanzarePrimit, vanzareRest, vanzareTotal, ziuaVenitului } from './incasari'

/** Nota pusă pe comanda din spatele unei vânzări rapide: după ea se recunoaște în registru. */
export const VANZARE_RAPIDA_NOTA = 'Vânzare rapidă'
/** Numele afișat când vânzarea rapidă nu are client. */
export const VANZARE_RAPIDA_FARA_CLIENT = 'La poartă'

export interface VanzareRow extends Vanzare {
  clientNume: string
  telefon: string | null
  total: number
  incasata: boolean
  /** Cât a dat clientul dintr-o vânzare încă neîncasată. */
  primit: number
  /** Cât mai e de primit (0 la cele încasate). */
  rest: number
  /** Făcută din „Vânzare rapidă”, nu dintr-o comandă livrată. */
  rapida: boolean
}

type ClientLite = { id: string; nume_client: string | null; telefon: string | null }
type ComandaLite = Pick<Comanda, 'id' | 'client_nume' | 'client_nume_manual' | 'telefon' | 'observatii'>

const dayOf = (value: string | null | undefined) => String(value ?? '').slice(0, 10)

export function isVanzareRapida(observatii: string | null | undefined): boolean {
  return String(observatii ?? '').includes(VANZARE_RAPIDA_NOTA)
}

/** Vânzările cu numele și telefonul clientului (din fișă, altfel de pe comandă) și banii lor. */
export function buildVanzareRows(
  vanzari: readonly Vanzare[],
  clienti: readonly ClientLite[],
  comenzi: readonly ComandaLite[],
): VanzareRow[] {
  const clientById = new Map(clienti.map((client) => [client.id, client]))
  const comandaById = new Map(comenzi.map((comanda) => [comanda.id, comanda]))

  return vanzari.map((vanzare) => {
    const client = vanzare.client_id ? clientById.get(vanzare.client_id) : undefined
    const comanda = vanzare.comanda_id ? comandaById.get(vanzare.comanda_id) : undefined
    const rapida = isVanzareRapida(vanzare.observatii_ladite) || isVanzareRapida(comanda?.observatii)
    const clientNume =
      client?.nume_client?.trim() ||
      comanda?.client_nume?.trim() ||
      comanda?.client_nume_manual?.trim() ||
      (rapida ? VANZARE_RAPIDA_FARA_CLIENT : 'Client necunoscut')

    return {
      ...vanzare,
      clientNume,
      telefon: client?.telefon?.trim() || comanda?.telefon?.trim() || null,
      total: vanzareTotal(vanzare),
      incasata: isVanzareIncasata(vanzare.status_plata),
      primit: vanzarePrimit(vanzare),
      rest: vanzareRest(vanzare),
      rapida,
    }
  })
}

/** Cele mai noi întâi; la aceeași zi, ultima făcută întâi. */
export function sortVanzari<T extends Pick<Vanzare, 'data' | 'created_at'>>(rows: readonly T[]): T[] {
  return [...rows].sort(
    (left, right) =>
      dayOf(right.data).localeCompare(dayOf(left.data)) ||
      String(right.created_at ?? '').localeCompare(String(left.created_at ?? '')),
  )
}

/** Vânzările făcute într-o lună (după data vânzării). */
export function vanzariDinLuna<T extends Pick<Vanzare, 'data'>>(rows: readonly T[], month: MonthRef): T[] {
  const prefix = monthPrefix(month)
  return rows.filter((row) => dayOf(row.data).startsWith(prefix))
}

export interface IncasatInLuna {
  lei: number
  kg: number
  count: number
}

/**
 * Cardul „Încasat în <lună>”: vânzările încasate în luna aceea, după `data_incasare`
 * (dacă lipsește, după data vânzării). Suma întreagă intră o singură dată, la încasarea restului.
 */
export function incasatInLuna(
  rows: readonly Pick<Vanzare, 'data' | 'data_incasare' | 'cantitate_kg' | 'pret_lei_kg' | 'status_plata'>[],
  month: MonthRef,
): IncasatInLuna {
  const prefix = monthPrefix(month)
  let lei = 0
  let kg = 0
  let count = 0
  for (const row of rows) {
    if (!(ziuaVenitului(row) ?? '').startsWith(prefix)) continue
    lei += vanzareTotal(row)
    kg += Number(row.cantitate_kg) || 0
    count += 1
  }
  return { lei: round2(lei), kg: round2(kg), count }
}

/** Toate vânzările cu ceva de primit, din orice lună. */
export function vanzariNeincasate<T extends Pick<VanzareRow, 'rest'>>(rows: readonly T[]): T[] {
  return rows.filter((row) => row.rest > 0)
}

/** Căutare după numele clientului sau după notă, fără diacritice. */
export function searchVanzari<T extends Pick<VanzareRow, 'clientNume' | 'observatii_ladite'>>(rows: readonly T[], query: string): T[] {
  const text = searchKey(query)
  if (!text) return [...rows]
  return rows.filter((row) => searchKey(row.clientNume).includes(text) || searchKey(row.observatii_ladite).includes(text))
}
