/**
 * Vânzarea rapidă (la poartă, la piață): o comandă pentru azi, livrată și încasată pe loc.
 *
 * Trece prin aceeași cale ca o livrare (`set_comanda_delivered`), deci scade din stocul cal. 1 derivat și
 * refuză cu `STOC_INSUFICIENT` dacă nu ajunge marfa. RPC-ul vechi `create_vanzare_with_stock` nu se folosește:
 * scrie în registrul vechi `miscari_stoc`, paralel cu disponibilul derivat (vezi `queries/vanzari.ts`).
 */
import { round2 } from '@/lib/format-ro'
import {
  createComanda,
  deleteComanda,
  deliverComanda,
  getComandaStatus,
  updateComanda,
  type Comanda,
} from '@/lib/supabase/queries/comenzi'
import type { Vanzare } from '@/lib/supabase/queries/vanzari'

import { VANZARE_RAPIDA_FARA_CLIENT, VANZARE_RAPIDA_NOTA } from './view'

export interface VanzareRapidaInput {
  /** Clientul ales; `null` = fără client, la poartă. */
  clientId: string | null
  kg: number
  pretLeiKg: number
  todayIso: string
  /**
   * Cheia de idempotență a formularului (`form.clientSyncId`): aceeași la reîncercare. Pleacă drept
   * `client_sync_id` pe comanda „La poartă”; o cerere repetată primește comanda deja scrisă, nu face alta.
   * Vânzarea o scrie serverul la livrare, una singură pe comandă (`comenzi.linked_vanzare_id`), deci cheia
   * comenzii o acoperă și pe ea.
   */
  clientSyncId?: string | null
  /**
   * Comanda rămasă de la o încercare nereușită a aceluiași formular: o reîncercare o refolosește. Acoperă
   * și baza de date fără coloana cheii (unde `client_sync_id` nu se trimite).
   */
  pendingComandaId: string | null
  /** Anunță comanda creată (sau `null` după ce a fost ștearsă la eșec), ca formularul s-o țină minte. */
  onPendingChange: (comandaId: string | null) => void
}

export interface VanzareRapidaResult {
  vanzare: Vanzare
  comandaId: string
  deductedStockKg: number
}

/** Cât rămâne în stoc după o vânzare; `null` dacă stocul nu se știe încă. */
export function stocRamasDupa(disponibilKg: number | null | undefined, kg: number): number | null {
  if (disponibilKg === null || disponibilKg === undefined || !Number.isFinite(disponibilKg)) return null
  return round2(disponibilKg - (Number(kg) || 0))
}

type CampuriComanda = {
  client_id: string | null
  client_nume_manual: string | null
  cantitate_kg: number
  pret_per_kg: number
}

function difera(comanda: Pick<Comanda, 'client_id' | 'client_nume_manual' | 'cantitate_kg' | 'pret_per_kg'>, fields: CampuriComanda): boolean {
  return (
    (comanda.client_id ?? null) !== fields.client_id ||
    (comanda.client_nume_manual ?? null) !== fields.client_nume_manual ||
    round2(Number(comanda.cantitate_kg) || 0) !== fields.cantitate_kg ||
    round2(Number(comanda.pret_per_kg) || 0) !== fields.pret_per_kg
  )
}

export async function saveVanzareRapida(input: VanzareRapidaInput): Promise<VanzareRapidaResult> {
  const kg = round2(input.kg)
  const pret = round2(input.pretLeiKg)
  if (!(kg > 0)) throw new Error('Scrie câte kilograme ai vândut.')
  if (!(pret > 0)) throw new Error('Scrie prețul pe kilogram.')

  const fields = {
    client_id: input.clientId,
    client_nume_manual: input.clientId ? null : VANZARE_RAPIDA_FARA_CLIENT,
    cantitate_kg: kg,
    pret_per_kg: pret,
  }

  let comandaId = input.pendingComandaId
  // Reîncercare: livrarea de data trecută s-a putut face pe server deși răspunsul s-a pierdut. O comandă deja
  // livrată nu se mai rescrie (cantitatea ei trebuie să rămână cea din vânzare): `set_comanda_delivered`
  // întoarce vânzarea existentă.
  const statusAnterior = comandaId ? await getComandaStatus(comandaId) : null
  if (comandaId && statusAnterior === 'livrata') {
    const result = await deliverComanda({ comandaId, cantitateLivrataKg: kg, statusPlata: 'platit' })
    input.onPendingChange(null)
    return { vanzare: result.vanzare, comandaId, deductedStockKg: result.deductedStockKg }
  }
  if (comandaId && statusAnterior === null) comandaId = null

  if (comandaId) {
    // Reîncercare: comanda există deja, nelivrată; îi aducem la zi clientul, cantitatea și prețul.
    await updateComanda(comandaId, fields)
  } else {
    const comanda = await createComanda({
      ...fields,
      data_comanda: input.todayIso,
      data_livrare: input.todayIso,
      status: 'confirmata',
      observatii: VANZARE_RAPIDA_NOTA,
      client_sync_id: input.clientSyncId ?? null,
    })
    comandaId = comanda.id
    input.onPendingChange(comandaId)
    // Cheia a găsit comanda unei încercări al cărei răspuns s-a pierdut pe drum. Dacă între timp s-au schimbat
    // clientul, cantitatea sau prețul, o aducem la zi înainte de livrare (una deja livrată rămâne cum e).
    if (comanda.status !== 'livrata' && difera(comanda, fields)) {
      await updateComanda(comandaId, fields)
    }
  }

  try {
    const result = await deliverComanda({ comandaId, cantitateLivrataKg: kg, statusPlata: 'platit' })
    input.onPendingChange(null)
    return { vanzare: result.vanzare, comandaId, deductedStockKg: result.deductedStockKg }
  } catch (cause) {
    // Vânzarea nu s-a făcut: comanda abia creată nu trebuie să rămână în Comenzi ca o comandă obișnuită.
    try {
      await deleteComanda(comandaId)
      input.onPendingChange(null)
    } catch {
      // Rămâne ținută minte: următoarea apăsare pe „Salvează” o refolosește.
    }
    throw cause
  }
}
