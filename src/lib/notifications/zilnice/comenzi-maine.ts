/**
 * „Comenzi de mâine”: seara, comenzile de fructe cu livrarea mâine care încă nu sunt puse în livrare.
 * Una singură pe fermă. Memento-ul pentru material săditor rămâne în cronul lui (`butasi-delivery-reminders`).
 */
import { formatKg, round2 } from '@/lib/format-ro'

import { TIPURI_ZILNICE, adaugaZile, numarRo, type NotificareZilnica } from './common'

export type ComandaPentruMaine = {
  id: string
  tenant_id: string
  data_livrare: string | null
  /** Enum `comanda_status`: noua, confirmata, programata, in_livrare, livrata, anulata. */
  status: string
  cantitate_kg: number | null
}

/**
 * Intră doar comenzile care mai așteaptă: noua, confirmata, programata.
 * Ies cele livrate, anulate și cele deja puse în livrare (`in_livrare`).
 */
export const STATUSURI_DE_PUS_IN_LIVRARE: ReadonlySet<string> = new Set(['noua', 'confirmata', 'programata'])

/** `azi` = ziua de azi în București (`YYYY-MM-DD`). Întoarce cel mult o notificare pe fermă. */
export function comenziMaine(comenzi: readonly ComandaPentruMaine[], azi: string): NotificareZilnica[] {
  const maine = adaugaZile(azi, 1)
  const peFerma = new Map<string, ComandaPentruMaine[]>()

  for (const comanda of comenzi) {
    if (String(comanda.data_livrare ?? '').slice(0, 10) !== maine) continue
    if (!STATUSURI_DE_PUS_IN_LIVRARE.has(comanda.status)) continue
    const lista = peFerma.get(comanda.tenant_id) ?? []
    lista.push(comanda)
    peFerma.set(comanda.tenant_id, lista)
  }

  const rezultat: NotificareZilnica[] = []
  for (const [tenantId, lista] of peFerma) {
    const kg = round2(lista.reduce((total, comanda) => total + (Number(comanda.cantitate_kg) || 0), 0))
    const n = lista.length
    const title = `${numarRo(n, 'comandă', 'comenzi')} de livrat mâine`
    const inca = n === 1 ? 'Încă nu e pusă în livrare.' : 'Încă nu sunt puse în livrare.'
    const body = kg > 0 ? `${inca} Total ${formatKg(kg)}.` : inca
    rezultat.push({
      tenantId,
      type: TIPURI_ZILNICE.comenzi_maine,
      title,
      body,
      reminderKey: `maine:${tenantId}:${azi}`,
      data: {
        delivery_date: maine,
        order_ids: lista.map((comanda) => comanda.id),
        total_kg: kg,
      },
      entityType: 'comenzi',
      entityId: n === 1 ? lista[0].id : null,
    })
  }
  return rezultat
}
