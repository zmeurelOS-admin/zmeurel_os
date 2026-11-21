/**
 * Banii unei vânzări: total, cât s-a primit, cât a rămas. Aceeași socoteală pentru „Neîncasat” din Vânzări,
 * „Rest de încasat” din Acasă și „Neîncasat” din fișa clientului. Funcții pure.
 *
 * Regula de venit: suma întreagă intră o singură dată, la `data_incasare`. O plată parțială nu e venit încă:
 * doar se notează, ca să se vadă cât mai e de primit.
 */
import { formatLei, round2 } from '@/lib/format-ro'
import type { Vanzare } from '@/lib/supabase/queries/vanzari'

type MoneyVanzare = Pick<Vanzare, 'cantitate_kg' | 'pret_lei_kg' | 'status_plata'> &
  Partial<Pick<Vanzare, 'suma_incasata_partial_lei' | 'data_incasare' | 'data' | 'data_incasare_partiala'>>

const PAID_STATUSES = new Set(['platit', 'platita', 'incasat', 'incasata', 'achitat', 'achitata'])

/**
 * Vânzarea e încasată. Potrivire exactă pe status (fără diacritice și majuscule): „neplatit” și „neincasat”
 * conțin „platit” / „incasat”, deci o căutare „conține” le-ar lua drept încasate.
 */
export function isVanzareIncasata(status: string | null | undefined): boolean {
  const normalized = String(status ?? '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
  return PAID_STATUSES.has(normalized)
}

export function vanzareTotal(vanzare: Pick<Vanzare, 'cantitate_kg' | 'pret_lei_kg'>): number {
  return round2((Number(vanzare.cantitate_kg) || 0) * (Number(vanzare.pret_lei_kg) || 0))
}

/** Cât a dat clientul până acum dintr-o vânzare neîncasată (0 dacă nu s-a notat nimic). */
export function vanzarePrimit(vanzare: MoneyVanzare): number {
  if (isVanzareIncasata(vanzare.status_plata)) return vanzareTotal(vanzare)
  const partial = Number(vanzare.suma_incasata_partial_lei ?? 0)
  if (!Number.isFinite(partial) || partial <= 0) return 0
  return round2(Math.min(partial, vanzareTotal(vanzare)))
}

/** Cât mai e de primit: 0 pentru vânzările încasate. */
export function vanzareRest(vanzare: MoneyVanzare): number {
  if (isVanzareIncasata(vanzare.status_plata)) return 0
  return round2(Math.max(0, vanzareTotal(vanzare) - vanzarePrimit(vanzare)))
}

export interface RestDeIncasat {
  lei: number
  count: number
}

/** Totalul de primit și numărul vânzărilor neîncasate. */
export function restDeIncasat(vanzari: readonly MoneyVanzare[]): RestDeIncasat {
  let lei = 0
  let count = 0
  for (const vanzare of vanzari) {
    const rest = vanzareRest(vanzare)
    if (rest <= 0) continue
    lei += rest
    count += 1
  }
  return { lei: round2(lei), count }
}

/**
 * Ziua în care vânzarea devine venit (`YYYY-MM-DD`): `data_incasare` (dacă lipsește, data vânzării), doar
 * pentru vânzările încasate integral. Neîncasată sau parțial încasată: `null` (nu e venit încă).
 * Singura regulă de venit: o folosesc Acasă, Vânzări, Clienți și Rapoarte.
 */
export function ziuaVenitului(
  vanzare: Pick<Vanzare, 'status_plata'> & Partial<Pick<Vanzare, 'data_incasare' | 'data'>>,
): string | null {
  if (!isVanzareIncasata(vanzare.status_plata)) return null
  const day = String(vanzare.data_incasare ?? vanzare.data ?? '').slice(0, 10)
  return day || null
}

/**
 * Venitul încasat într-un interval de zile (`2026-11-01` … `2026-11-30`, capetele incluse):
 * suma întreagă a vânzărilor încasate, după `data_incasare` (dacă lipsește, după data vânzării).
 */
export function venitIncasat(vanzari: readonly MoneyVanzare[], startIso: string, endIso: string): number {
  let total = 0
  for (const vanzare of vanzari) {
    const day = ziuaVenitului(vanzare)
    if (!day || day < startIso || day > endIso) continue
    total += vanzareTotal(vanzare)
  }
  return round2(total)
}

export type RezultatPlata<T extends MoneyVanzare> =
  | { ok: true; vanzare: T; primit: number; rest: number; completeaza: boolean }
  | { ok: false; motiv: string }

/**
 * O plată nouă adunată la ce s-a primit deja (aceeași regulă ca RPC-ul `adauga_plata_vanzare`, care face
 * adunarea atomic în baza de date; aici e pentru validarea din formular și pentru teste).
 * Plata e > 0 și cel mult restul. Când suma primită ajunge la total, vânzarea devine încasată la ziua plății.
 */
export function aplicaPlata<T extends MoneyVanzare>(vanzare: T, sumaLei: number, ziuaIso: string): RezultatPlata<T> {
  if (isVanzareIncasata(vanzare.status_plata)) return { ok: false, motiv: 'Vânzarea e deja încasată.' }
  const suma = round2(Number(sumaLei))
  if (!Number.isFinite(suma) || suma <= 0) return { ok: false, motiv: 'Suma primită trebuie să fie mai mare decât 0.' }
  const total = vanzareTotal(vanzare)
  const primit = vanzarePrimit(vanzare)
  const rest = round2(total - primit)
  if (suma > rest) return { ok: false, motiv: `Plata depășește restul de plată (rest ${formatLei(rest)}).` }
  const nou = round2(primit + suma)
  const completeaza = nou >= total
  const next: T = {
    ...vanzare,
    suma_incasata_partial_lei: nou,
    data_incasare_partiala: ziuaIso,
    ...(completeaza ? { status_plata: 'platit', data_incasare: ziuaIso } : {}),
  }
  return { ok: true, vanzare: next, primit: nou, rest: round2(total - nou), completeaza }
}
