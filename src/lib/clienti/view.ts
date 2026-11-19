/**
 * Clienți: cifrele unui client (neîncasat, anul curent, ultima comandă), filtrele listei și etichetele.
 * Funcții pure. „Neîncasat” e aceeași socoteală ca în Vânzări și în Acasă (`lib/vanzari/incasari`).
 */
import { formatLeiKg, phoneDigits, round2, searchKey } from '@/lib/format-ro'
import type { Client } from '@/lib/supabase/queries/clienti'
import type { Comanda } from '@/lib/supabase/queries/comenzi'
import type { Vanzare } from '@/lib/supabase/queries/vanzari'
import { isVanzareIncasata, vanzareRest, vanzareTotal } from '@/lib/vanzari/incasari'

export type ClientFilter = 'toti' | 'persoane' | 'patiserii' | 'magazine' | 'neincasat'

export interface ClientMetrics {
  neincasatLei: number
  /** Comenzile din anul curent, fără cele anulate. */
  comenziAn: number
  /** Kilogramele vândute (livrate) în anul curent. */
  kgAn: number
  /** Încasat în anul curent, pe data încasării. */
  incasatAn: number
  ultimaComanda: { data: string; kg: number; status: Comanda['status'] } | null
}

const EMPTY_METRICS: ClientMetrics = { neincasatLei: 0, comenziAn: 0, kgAn: 0, incasatAn: 0, ultimaComanda: null }

const dayOf = (value: string | null | undefined) => String(value ?? '').slice(0, 10)

export function buildClientMetrics(
  clienti: readonly Pick<Client, 'id'>[],
  comenzi: readonly Pick<Comanda, 'client_id' | 'status' | 'data_livrare' | 'data_comanda' | 'cantitate_kg'>[],
  vanzari: readonly Vanzare[],
  year: number,
): Map<string, ClientMetrics> {
  const map = new Map<string, ClientMetrics>()
  for (const client of clienti) map.set(client.id, { ...EMPTY_METRICS })
  const yearPrefix = String(year)

  for (const vanzare of vanzari) {
    const entry = vanzare.client_id ? map.get(vanzare.client_id) : undefined
    if (!entry) continue
    entry.neincasatLei = round2(entry.neincasatLei + vanzareRest(vanzare))
    if (dayOf(vanzare.data).startsWith(yearPrefix)) {
      entry.kgAn = round2(entry.kgAn + (Number(vanzare.cantitate_kg) || 0))
    }
    if (isVanzareIncasata(vanzare.status_plata) && dayOf(vanzare.data_incasare ?? vanzare.data).startsWith(yearPrefix)) {
      entry.incasatAn = round2(entry.incasatAn + vanzareTotal(vanzare))
    }
  }

  for (const comanda of comenzi) {
    const entry = comanda.client_id ? map.get(comanda.client_id) : undefined
    if (!entry) continue
    const day = dayOf(comanda.data_livrare) || dayOf(comanda.data_comanda)
    if (comanda.status !== 'anulata' && day.startsWith(yearPrefix)) entry.comenziAn += 1
    if (!entry.ultimaComanda || day > entry.ultimaComanda.data) {
      entry.ultimaComanda = { data: day, kg: Number(comanda.cantitate_kg) || 0, status: comanda.status }
    }
  }

  return map
}

export function metricsOf(metrics: ReadonlyMap<string, ClientMetrics>, clientId: string): ClientMetrics {
  return metrics.get(clientId) ?? EMPTY_METRICS
}

function matchesFilter(client: Pick<Client, 'tip'>, metrics: ClientMetrics, filter: ClientFilter): boolean {
  if (filter === 'persoane') return client.tip === 'standard'
  if (filter === 'patiserii') return client.tip === 'patiserie'
  if (filter === 'magazine') return client.tip === 'magazin'
  if (filter === 'neincasat') return metrics.neincasatLei > 0
  return true
}

/** Căutare după nume (fără diacritice) sau după cifrele telefonului, peste filtrul ales. */
export function filterClients<T extends Pick<Client, 'id' | 'tip' | 'nume_client' | 'telefon'>>(
  clienti: readonly T[],
  metrics: ReadonlyMap<string, ClientMetrics>,
  filter: ClientFilter,
  query: string,
): T[] {
  const text = searchKey(query)
  const digits = phoneDigits(query).replace(/^0+/, '')
  return clienti.filter((client) => {
    if (!matchesFilter(client, metricsOf(metrics, client.id), filter)) return false
    if (!text) return true
    if (searchKey(client.nume_client).includes(text)) return true
    return digits.length >= 3 && phoneDigits(client.telefon).includes(digits)
  })
}

export function clientFilterCounts(
  clienti: readonly Pick<Client, 'id' | 'tip'>[],
  metrics: ReadonlyMap<string, ClientMetrics>,
): Record<ClientFilter, number> {
  const counts: Record<ClientFilter, number> = { toti: clienti.length, persoane: 0, patiserii: 0, magazine: 0, neincasat: 0 }
  for (const client of clienti) {
    if (client.tip === 'patiserie') counts.patiserii += 1
    else if (client.tip === 'magazin') counts.magazine += 1
    else counts.persoane += 1
    if (metricsOf(metrics, client.id).neincasatLei > 0) counts.neincasat += 1
  }
  return counts
}

export const CLIENT_TIP_LABEL: Record<Client['tip'], string> = {
  standard: 'Persoană',
  patiserie: 'Patiserie',
  magazin: 'Magazin',
}

/** „Patiserie · 25 lei/kg”, „Magazin · 22 lei/kg”; `null` pentru persoane fără preț negociat. */
export function clientPretLabel(client: Pick<Client, 'tip' | 'pret_negociat_lei_kg'>): string | null {
  const price = Number(client.pret_negociat_lei_kg ?? 0)
  const hasPrice = Number.isFinite(price) && price > 0
  if (client.tip === 'standard') return hasPrice ? `Preț negociat · ${formatLeiKg(price)}` : null
  return hasPrice ? `${CLIENT_TIP_LABEL[client.tip]} · ${formatLeiKg(price)}` : CLIENT_TIP_LABEL[client.tip]
}

/** Ultimele comenzi ale unui client, cele mai noi întâi. */
export function clientOrders<T extends Pick<Comanda, 'client_id' | 'data_livrare' | 'data_comanda' | 'created_at'>>(
  comenzi: readonly T[],
  clientId: string,
  limit = 6,
): T[] {
  return comenzi
    .filter((comanda) => comanda.client_id === clientId)
    .sort((left, right) => {
      const leftDay = dayOf(left.data_livrare) || dayOf(left.data_comanda)
      const rightDay = dayOf(right.data_livrare) || dayOf(right.data_comanda)
      return rightDay.localeCompare(leftDay) || String(right.created_at ?? '').localeCompare(String(left.created_at ?? ''))
    })
    .slice(0, limit)
}
