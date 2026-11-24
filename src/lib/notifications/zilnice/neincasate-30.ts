/**
 * „Neîncasate de peste 30 de zile” (promptul 33): comenzile livrate care au încă rest de încasat și au fost livrate
 * acum cel puțin 30 de zile. Un singur mesaj pe zi, cumulat, doar proprietarului, în verificarea de dimineață; a doua
 * oară abia după 7 zile, dacă tot există. Același rând apare și în Acasă. Funcții pure.
 *
 * Restul comenzii e cel din Comenzi (`comandaRestDeIncasat`: vânzarea legată, `vanzareRest`; anulată / nelivrată /
 * încasată = 0). Ziua livrării = ziua vânzării (vânzarea se creează la livrare), altfel `data_livrare`.
 */
import { comandaRestDeIncasat } from '@/lib/comenzi/display'
import { formatLei, round2 } from '@/lib/format-ro'
import type { Comanda } from '@/lib/supabase/queries/comenzi'

import { TIPURI_ZILNICE, numarRo, zileIntre, type NotificareZilnica } from './common'

/** De la câte zile de la livrare intră comanda (≥ 30: ziua a 30-a intră). */
export const ZILE_NEINCASATE = 30

/** După câte zile se trimite din nou, dacă tot există comenzi neîncasate. */
export const ZILE_REPETARE_NEINCASATE = 7

/** Lista filtrată din Comenzi (arhiva, „Neîncasate de peste 30 de zile”). */
export const LINK_NEINCASATE_30 = '/comenzi?filter=neincasat30'

export type ComandaPentruNeincasate = Pick<Comanda, 'id' | 'tenant_id' | 'status' | 'total' | 'data_livrare' | 'linked_vanzare'>

export type NeincasatePeste30 = {
  numar: number
  lei: number
  comandaIds: string[]
}

/** Ziua livrării (`YYYY-MM-DD`): ziua vânzării, altfel `data_livrare`; `null` dacă lipsesc amândouă. */
export function ziuaLivrarii(comanda: Pick<Comanda, 'data_livrare' | 'linked_vanzare'>): string | null {
  const zi = String(comanda.linked_vanzare?.data ?? comanda.data_livrare ?? '').slice(0, 10)
  return /^\d{4}-\d{2}-\d{2}$/.test(zi) ? zi : null
}

/** Comanda e livrată, are rest și a fost livrată acum cel puțin 30 de zile (față de `azi`, ziua din București). */
export function esteNeincasataPeste30(comanda: ComandaPentruNeincasate, azi: string): boolean {
  if (comandaRestDeIncasat(comanda) <= 0) return false
  const zi = ziuaLivrarii(comanda)
  if (!zi) return false
  const zile = zileIntre(zi, azi)
  return zile !== null && zile >= ZILE_NEINCASATE
}

/** Comenzile fermei (`tenantId`, dacă e dat) neîncasate de peste 30 de zile: câte, câți lei, care. */
export function neincasatePeste30(
  comenzi: readonly ComandaPentruNeincasate[],
  azi: string,
  tenantId?: string,
): NeincasatePeste30 {
  let lei = 0
  const comandaIds: string[] = []
  for (const comanda of comenzi) {
    if (tenantId && comanda.tenant_id !== tenantId) continue
    if (!esteNeincasataPeste30(comanda, azi)) continue
    lei = round2(lei + comandaRestDeIncasat(comanda))
    comandaIds.push(comanda.id)
  }
  return { numar: comandaIds.length, lei, comandaIds }
}

/** Textul comun (notificare și Acasă): „3 comenzi neîncasate de peste 30 de zile · total 450 lei”. */
export function textNeincasatePeste30(rezultat: Pick<NeincasatePeste30, 'numar' | 'lei'>): string {
  return `${numarRo(rezultat.numar, 'comandă neîncasată', 'comenzi neîncasate')} de peste 30 de zile · total ${formatLei(rezultat.lei)}`
}

/**
 * Se trimite azi? Da dacă n-a mai plecat niciuna sau ultima a plecat acum cel puțin 7 zile.
 * `ultimaTrimitere` = ziua (`YYYY-MM-DD`, București) ultimei notificări de acest tip pentru fermă.
 */
export function trebuieTrimisNeincasate(ultimaTrimitere: string | null, azi: string): boolean {
  if (!ultimaTrimitere) return true
  const zile = zileIntre(ultimaTrimitere, azi)
  return zile === null || zile >= ZILE_REPETARE_NEINCASATE
}

/**
 * Notificarea de azi pentru fermă, sau `null`: nimic neîncasat de peste 30 de zile, sau a plecat una în ultimele
 * 7 zile. Cheia `neincasate30:<fermă>:<zi>`: rularea de două ori în aceeași zi nu trimite de două ori.
 */
export function notificareNeincasatePeste30(input: {
  tenantId: string
  azi: string
  comenzi: readonly ComandaPentruNeincasate[]
  ultimaTrimitere: string | null
}): NotificareZilnica | null {
  if (!trebuieTrimisNeincasate(input.ultimaTrimitere, input.azi)) return null
  const rezultat = neincasatePeste30(input.comenzi, input.azi, input.tenantId)
  if (rezultat.numar === 0) return null
  return {
    tenantId: input.tenantId,
    type: TIPURI_ZILNICE.incasari_peste_30,
    title: textNeincasatePeste30(rezultat),
    body: 'Deschide lista din Comenzi și notează ce ai încasat.',
    reminderKey: `neincasate30:${input.tenantId}:${input.azi}`,
    data: { tenant_id: input.tenantId, zi: input.azi, comanda_ids: rezultat.comandaIds, total_lei: rezultat.lei, link: LINK_NEINCASATE_30 },
    entityType: 'comenzi',
    entityId: null,
  }
}
