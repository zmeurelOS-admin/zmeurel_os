/**
 * Mesajele WhatsApp trimise clientului despre o comandă. Textele sunt cele de dinaintea refacerii
 * (erau în `UnifiedOrderCard`); s-a schimbat doar locul din care se trimit: foaia comenzii și meniul opririi.
 */
import type { Comanda } from '@/lib/supabase/queries/comenzi'

import { phoneForLinks } from './display'

type MessageComanda = Pick<Comanda, 'cantitate_kg' | 'total' | 'created_at' | 'locatie_livrare' | 'order_kind'>

function firstName(name: string): string {
  const trimmed = name.trim()
  return trimmed.split(/\s+/)[0] || trimmed
}

function parts(comanda: MessageComanda) {
  const quantity = `${new Intl.NumberFormat('ro-RO', { maximumFractionDigits: 2 }).format(Number(comanda.cantitate_kg) || 0)} kg`
  const total = new Intl.NumberFormat('ro-RO', { maximumFractionDigits: 0 }).format(Math.round(Number(comanda.total) || 0))
  const orderDate = new Intl.DateTimeFormat('ro-RO', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'Europe/Bucharest',
  }).format(new Date(comanda.created_at))
  return { quantity, total, orderDate }
}

/** Cadourile și consumul propriu nu primesc mesaje despre bani și livrare. */
export function canSendOrderMessage(comanda: Pick<Comanda, 'order_kind'>): boolean {
  return comanda.order_kind !== 'cadou' && comanda.order_kind !== 'consum_propriu'
}

/** „Am primit comanda dvs.” */
export function orderConfirmationMessage(comanda: MessageComanda, clientName: string): string {
  const { quantity, total, orderDate } = parts(comanda)
  return `Bună ziua, ${firstName(clientName)}! 🍓\n\nAm primit comanda dvs. din ${orderDate}: ${quantity} (${total} lei).\n\nVă vom contacta cu detaliile livrării.\n\nMulțumim că ați ales Ferma Zmeurel! 🌿`
}

/** „Comanda dvs. va fi livrată la adresa…” */
export function deliveryAnnouncementMessage(comanda: MessageComanda, clientName: string): string {
  const { quantity, total, orderDate } = parts(comanda)
  const address = comanda.locatie_livrare?.trim() || 'adresa comunicată'
  return `Bună ziua, ${firstName(clientName)}! 🍓\n\nComanda dvs. de ${quantity} (${total} lei), plasată pe ${orderDate}, va fi livrată la adresa: ${address}.\n\nVeți fi sunat cu puțin timp înainte de sosire.\n\nMulțumim! — Ferma Zmeurel 🌿`
}

/** Legătura `wa.me` cu mesajul pus. `null` dacă numărul nu e folosibil. */
export function whatsappMessageUrl(phone: string | null | undefined, message: string): string | null {
  const links = phoneForLinks(phone)
  return links ? `https://wa.me/${links.wa}?text=${encodeURIComponent(message)}` : null
}
