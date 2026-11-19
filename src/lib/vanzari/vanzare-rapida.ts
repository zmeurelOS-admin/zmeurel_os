/**
 * Vânzarea rapidă (la poartă, la piață): o comandă pentru azi, livrată și încasată pe loc.
 *
 * Trece prin aceeași cale ca o livrare (`set_comanda_delivered`), deci scade din stocul cal. 1 derivat și
 * refuză cu `STOC_INSUFICIENT` dacă nu ajunge marfa. RPC-ul vechi `create_vanzare_with_stock` nu se folosește:
 * scrie în registrul vechi `miscari_stoc`, paralel cu disponibilul derivat (vezi `queries/vanzari.ts`).
 */
import { round2 } from '@/lib/format-ro'
import { createComanda, deleteComanda, deliverComanda, updateComanda } from '@/lib/supabase/queries/comenzi'
import type { Vanzare } from '@/lib/supabase/queries/vanzari'

import { VANZARE_RAPIDA_FARA_CLIENT, VANZARE_RAPIDA_NOTA } from './view'

export interface VanzareRapidaInput {
  /** Clientul ales; `null` = fără client, la poartă. */
  clientId: string | null
  kg: number
  pretLeiKg: number
  todayIso: string
  /**
   * Comanda rămasă de la o încercare nereușită a aceluiași formular. `comenzi` nu are cheie de idempotență,
   * deci formularul ține minte comanda creată: o reîncercare o refolosește, nu face alta.
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
  if (comandaId) {
    // Reîncercare: comanda există deja; îi aducem la zi clientul, cantitatea și prețul.
    await updateComanda(comandaId, fields)
  } else {
    const comanda = await createComanda({
      ...fields,
      data_comanda: input.todayIso,
      data_livrare: input.todayIso,
      status: 'confirmata',
      observatii: VANZARE_RAPIDA_NOTA,
    })
    comandaId = comanda.id
    input.onPendingChange(comandaId)
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
