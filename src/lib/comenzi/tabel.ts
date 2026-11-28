/**
 * Comenzile pe desktop (promptul 35, §5): filtrele listei, ordinea, cine poate intra în „Pune în livrare” în bloc,
 * clientul pe scurt și livrările de azi. Pur, testat; aceleași reguli ca pe telefon (`day-view`, `display`).
 */
import { bucketOfComanda, compareComenziForDay, deliveryCandidates, isComandaDeschisa, splitComenziByBucket } from '@/lib/comenzi/day-view'
import { comandaNeincasata, comandaRestDeIncasat } from '@/lib/comenzi/display'
import type { Comanda } from '@/lib/supabase/queries/comenzi'

export type FiltruComenziDesktop = 'toate' | 'azi' | 'maine' | 'saptamana' | 'de-pregatit' | 'in-livrare' | 'neincasate'

export const FILTRE_COMENZI_DESKTOP: ReadonlyArray<{ value: FiltruComenziDesktop; label: string }> = [
  { value: 'toate', label: 'Toate' },
  { value: 'azi', label: 'Azi' },
  { value: 'maine', label: 'Mâine' },
  { value: 'saptamana', label: 'Săptămâna' },
  { value: 'de-pregatit', label: 'De pregătit' },
  { value: 'in-livrare', label: 'În livrare' },
  { value: 'neincasate', label: 'Neîncasate' },
]

const zi = (value: string | null | undefined) => {
  const day = String(value ?? '').slice(0, 10)
  return /^\d{4}-\d{2}-\d{2}$/.test(day) ? day : null
}

export function adaugaZile(iso: string, zile: number): string {
  const [an, luna, z] = iso.split('-').map(Number)
  const data = new Date(Date.UTC(an, luna - 1, z + zile))
  return data.toISOString().slice(0, 10)
}

/** Se potrivește comanda cu filtrul? */
export function inFiltru(comanda: Comanda, filtru: FiltruComenziDesktop, todayIso: string): boolean {
  const deschisa = isComandaDeschisa(comanda)
  switch (filtru) {
    case 'toate':
      return comanda.status !== 'anulata'
    case 'azi':
      return bucketOfComanda(comanda, todayIso) === 'azi'
    case 'maine':
      return bucketOfComanda(comanda, todayIso) === 'maine'
    case 'saptamana': {
      if (!deschisa) return false
      const ziua = zi(comanda.data_livrare)
      // „Azi” cuprinde și restantele și pe cele în livrare, ca pe telefon.
      return bucketOfComanda(comanda, todayIso) === 'azi' || (ziua !== null && ziua <= adaugaZile(todayIso, 6))
    }
    case 'de-pregatit':
      return deschisa && comanda.status !== 'in_livrare'
    case 'in-livrare':
      return comanda.status === 'in_livrare'
    case 'neincasate':
      return comandaNeincasata(comanda)
  }
}

/**
 * Ordinea listei: deschisele întâi (prioritarele, apoi ziua livrării, ca pe telefon), apoi livratele de la cea mai
 * nouă la cea mai veche.
 */
export function ordoneazaComenzi(comenzi: readonly Comanda[]): Comanda[] {
  return [...comenzi].sort((a, b) => {
    const deschisaA = isComandaDeschisa(a)
    const deschisaB = isComandaDeschisa(b)
    if (deschisaA !== deschisaB) return deschisaA ? -1 : 1
    if (deschisaA) return compareComenziForDay(a, b)
    const ziA = zi(a.data_livrare) ?? zi(a.data_comanda) ?? ''
    const ziB = zi(b.data_livrare) ?? zi(b.data_comanda) ?? ''
    return ziB.localeCompare(ziA) || String(b.created_at).localeCompare(String(a.created_at))
  })
}

export function filtreazaComenzi(comenzi: readonly Comanda[], filtru: FiltruComenziDesktop, todayIso: string): Comanda[] {
  return ordoneazaComenzi(comenzi.filter((comanda) => inFiltru(comanda, filtru, todayIso)))
}

export function numarPeFiltre(comenzi: readonly Comanda[], todayIso: string): Record<FiltruComenziDesktop, number> {
  const rezultat = { toate: 0, azi: 0, maine: 0, saptamana: 0, 'de-pregatit': 0, 'in-livrare': 0, neincasate: 0 }
  for (const comanda of comenzi) {
    for (const { value } of FILTRE_COMENZI_DESKTOP) if (inFiltru(comanda, value, todayIso)) rezultat[value] += 1
  }
  return rezultat
}

/**
 * Cine poate intra în „Pune în livrare” în bloc: aceleași comenzi ca butonul „Pune în livrare azi” de pe telefon
 * (de pe „Azi”, inclusiv restantele, care nu sunt deja în livrare). Livratele, anulatele și cele din alte zile, nu.
 */
export function eligibilePentruLivrare(comenzi: readonly Comanda[], todayIso: string): Comanda[] {
  return deliveryCandidates(splitComenziByBucket(comenzi, todayIso).azi)
}

/** Clientul pe scurt, din comenzile lui de anul acesta. */
export function clientPeScurt(
  comenzi: readonly Comanda[],
  comanda: Pick<Comanda, 'id' | 'client_id'>,
  todayIso: string,
): { comenziAn: number; kgAn: number; ultima: Comanda | null; deIncasat: number } | null {
  if (!comanda.client_id) return null
  const an = todayIso.slice(0, 4)
  const ale = comenzi.filter((item) => item.client_id === comanda.client_id && item.status !== 'anulata')
  const anulAcesta = ale.filter((item) => (zi(item.data_livrare) ?? zi(item.data_comanda) ?? '').startsWith(an))
  const livrate = ale.filter((item) => item.status === 'livrata' && item.id !== comanda.id)
  const ultima = ordoneazaComenzi(livrate)[0] ?? null
  return {
    comenziAn: anulAcesta.length,
    kgAn: Math.round(anulAcesta.reduce((sum, item) => sum + (Number(item.cantitate_kg) || 0), 0) * 100) / 100,
    ultima,
    deIncasat: Math.round(ale.reduce((sum, item) => sum + comandaRestDeIncasat(item), 0) * 100) / 100,
  }
}

/** Livrările de azi, în ordinea traseului (`ordine_livrare`, altfel ordinea în care au fost notate). */
export function livrariAzi(comenzi: readonly Comanda[]): Comanda[] {
  return comenzi
    .filter((comanda) => comanda.status === 'in_livrare')
    .sort((a, b) => {
      const ordineA = a.ordine_livrare ?? Number.MAX_SAFE_INTEGER
      const ordineB = b.ordine_livrare ?? Number.MAX_SAFE_INTEGER
      return ordineA - ordineB || String(a.created_at).localeCompare(String(b.created_at))
    })
}

export interface PasIstoric {
  eticheta: string
  ziua: string
}

/** Istoricul comenzii din coloanele existente (fără tabel de istoric). */
export function istoricComanda(comanda: Pick<Comanda, 'created_at' | 'updated_at' | 'status' | 'data_livrare'>): PasIstoric[] {
  const pasi: PasIstoric[] = [{ eticheta: 'Notată', ziua: String(comanda.created_at).slice(0, 10) }]
  const modificata = String(comanda.updated_at ?? '').slice(0, 10)
  if (comanda.status === 'in_livrare') pasi.push({ eticheta: 'Pusă în livrare', ziua: modificata })
  else if (comanda.status === 'livrata') pasi.push({ eticheta: 'Livrată', ziua: zi(comanda.data_livrare) ?? modificata })
  else if (comanda.status === 'anulata') pasi.push({ eticheta: 'Anulată', ziua: modificata })
  else if (modificata && modificata !== pasi[0].ziua) pasi.push({ eticheta: 'Modificată', ziua: modificata })
  return pasi.filter((pas) => Boolean(pas.ziua))
}
