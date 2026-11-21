/**
 * Cum se arată o comandă în modulele refăcute (Comenzi, Livrări, Acasă, Clienți): nume, status, plată.
 * Funcții pure.
 */
import { relativeDayRo, shortDateRo } from '@/lib/format-ro'
import type { Client } from '@/lib/supabase/queries/clienti'
import type { Comanda } from '@/lib/supabase/queries/comenzi'
import { isVanzareIncasata, vanzareRest } from '@/lib/vanzari/incasari'

import { getDisplayOrderObservatii } from './shop-observations'
import { isShopOrderOrigin } from './unified-orders'

export type ComandaTone = 'neutral' | 'info' | 'success' | 'warning' | 'danger'

type ClientLookup = ReadonlyMap<string, Pick<Client, 'nume_client'>> | Readonly<Record<string, Pick<Client, 'nume_client'>>>

function lookupClient(clients: ClientLookup | undefined, id: string | null): Pick<Client, 'nume_client'> | undefined {
  if (!clients || !id) return undefined
  return clients instanceof Map ? clients.get(id) : (clients as Record<string, Pick<Client, 'nume_client'>>)[id]
}

/** Numele clientului: din fișa lui, altfel cel scris de mână pe comandă. */
export function comandaClientName(
  comanda: Pick<Comanda, 'client_id' | 'client_nume' | 'client_nume_manual'>,
  clients?: ClientLookup,
): string {
  return (
    lookupClient(clients, comanda.client_id)?.nume_client?.trim() ||
    comanda.client_nume?.trim() ||
    comanda.client_nume_manual?.trim() ||
    'Client fără nume'
  )
}

/**
 * Statusul afișat. Pentru comenzile deschise contează ziua, nu câmpul `status`
 * (o comandă „confirmată” cu dată e, pentru fermier, „Programată”).
 */
export function comandaStatus(
  comanda: Pick<Comanda, 'status' | 'data_livrare'>,
  todayIso: string,
): { label: string; tone: ComandaTone } {
  if (comanda.status === 'livrata') return { label: 'Livrată', tone: 'success' }
  if (comanda.status === 'anulata') return { label: 'Anulată', tone: 'neutral' }
  if (comanda.status === 'in_livrare') return { label: 'În livrare', tone: 'info' }
  const day = comanda.data_livrare?.slice(0, 10) || null
  if (!day) return { label: 'Nouă · fără dată', tone: 'warning' }
  if (day < todayIso) return { label: `Restantă · ${shortDateRo(day)}`, tone: 'danger' }
  return { label: 'Programată', tone: 'neutral' }
}

/**
 * Cât mai e de încasat dintr-o comandă livrată, după vânzarea ei (aceeași regulă ca în Vânzări, Clienți și
 * Acasă: `vanzareRest`). Fără vânzare sau nelivrată: 0. Dacă vânzarea a venit fără sume (citire veche),
 * totalul comenzii.
 */
export function comandaRestDeIncasat(comanda: Pick<Comanda, 'status' | 'linked_vanzare' | 'total'>): number {
  const vanzare = comanda.linked_vanzare
  if (comanda.status !== 'livrata' || !vanzare) return 0
  if (isVanzareIncasata(vanzare.status_plata)) return 0
  if (vanzare.cantitate_kg == null || vanzare.pret_lei_kg == null) return Number(comanda.total) || 0
  return vanzareRest({
    cantitate_kg: Number(vanzare.cantitate_kg),
    pret_lei_kg: Number(vanzare.pret_lei_kg),
    status_plata: vanzare.status_plata ?? 'neplatit',
    suma_incasata_partial_lei: vanzare.suma_incasata_partial_lei ?? null,
  })
}

/** Comanda livrată are încă bani de primit. */
export function comandaNeincasata(comanda: Pick<Comanda, 'status' | 'linked_vanzare' | 'total'>): boolean {
  return comandaRestDeIncasat(comanda) > 0
}

/** Plata, doar pentru comenzile livrate (vânzarea se creează la livrare). */
export function comandaPlata(
  comanda: Pick<Comanda, 'status' | 'linked_vanzare'>,
): { label: string; tone: ComandaTone; incasata: boolean } | null {
  if (comanda.status !== 'livrata' || !comanda.linked_vanzare) return null
  // „avans” și „restanță” nu sunt încasate: potrivire exactă pe statusurile de încasat, ca în Vânzări.
  const incasata = isVanzareIncasata(comanda.linked_vanzare.status_plata)
  return incasata
    ? { label: 'Încasat', tone: 'success', incasata }
    : { label: 'Neîncasat', tone: 'warning', incasata }
}

export function comandaKindLabel(comanda: Pick<Comanda, 'order_kind'>): string | null {
  if (comanda.order_kind === 'cadou') return 'Cadou'
  if (comanda.order_kind === 'consum_propriu') return 'Consum propriu'
  return null
}

/** Comanda a venit din magazinul online (nu a fost notată de mână). */
export function comandaDinMagazin(comanda: Pick<Comanda, 'data_origin'>): boolean {
  return isShopOrderOrigin(comanda.data_origin)
}

/** Telefonul de sunat: cel scris pe comandă, altfel cel din fișa clientului. */
export function comandaTelefon(
  comanda: Pick<Comanda, 'telefon'>,
  client?: Pick<Client, 'telefon'> | null,
): string | null {
  return comanda.telefon?.trim() || client?.telefon?.trim() || null
}

/** Nota comenzii, fără metadatele tehnice puse de magazinul online. */
export function comandaNota(comanda: Pick<Comanda, 'observatii' | 'data_origin'>): string {
  return getDisplayOrderObservatii(comanda.observatii, comandaDinMagazin(comanda))
}

/** „Azi”, „Mâine”, „joi, 21 nov.” sau „Fără dată”. */
export function comandaDayLabel(comanda: Pick<Comanda, 'data_livrare'>, todayIso: string): string {
  return relativeDayRo(comanda.data_livrare, todayIso)
}

/** Numărul pentru `tel:` și WhatsApp: doar cifre, cu prefixul țării. Gol dacă nu e un număr folosibil. */
export function phoneForLinks(raw: string | null | undefined): { tel: string; wa: string } | null {
  const text = String(raw ?? '').trim()
  const digits = text.replace(/\D/g, '')
  if (digits.length < 9) return null
  let international = digits
  if (text.startsWith('+')) international = digits
  else if (digits.startsWith('0040')) international = digits.slice(2)
  else if (digits.startsWith('0') && digits.length === 10) international = `4${digits}`
  else if (digits.length === 9) international = `40${digits}`
  return { tel: `+${international}`, wa: international }
}
