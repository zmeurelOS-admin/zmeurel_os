/**
 * Mementoul „Verifică capcanele” din verificarea de dimineață (`/api/cron/notificari-dimineata`, fără cron nou):
 * în ziua în care un grup ajunge la `data_urmatoarea_verificare` (și după, până se face verificarea), cu
 * „Schimbă atractantul” în același mesaj când e scadent. Primesc proprietarul și operatorii activi cu „Scrie” pe
 * Tratamente (`destinatariMementoCapcane`); push-ul trece prin comutatorul „Verifică capcanele” și liniștea 22–6
 * (`createNotification` → `permitePush`). Funcții pure.
 */
import { TIPURI_ZILNICE, type NotificareZilnica } from '@/lib/notifications/zilnice/common'

import { capcaneText, totalBucati, type GrupCapcane } from './model'
import { atractantScadent, verificareScadenta } from './scadenta'

export const TIP_MEMENTO_CAPCANE = TIPURI_ZILNICE.capcane_verificare
export const TIP_ALERTA_CAPCANE = TIPURI_ZILNICE.capcane_peste_prag

export const LINK_CAPCANE = '/tratamente?tab=capcane'

/** Grupurile de verificat azi și câte capcane au atractantul scadent. */
export function capcaneDeVerificat(grupuri: ReadonlyArray<GrupCapcane>, azi: string): { grupuri: GrupCapcane[]; capcane: number; atractant: number } {
  const scadente = grupuri.filter((grup) => verificareScadenta(grup, azi))
  const atractant = totalBucati(grupuri.filter((grup) => atractantScadent(grup, azi)))
  return { grupuri: scadente, capcane: totalBucati(scadente), atractant }
}

/** „Atractantul se schimbă azi la 2.” (sau nimic). */
export function textAtractant(capcane: number): string | null {
  if (capcane <= 0) return null
  return `Atractantul se schimbă azi la ${capcane}.`
}

/** Titlul cardului și al notificării: „Verificare azi · 6 capcane”. */
export function titluVerificare(capcane: number): string {
  return `Verificare azi · ${capcaneText(capcane)}`
}

/**
 * Notificarea pentru un utilizator, sau `null` dacă nu e nimic de verificat. Cheia (`capcane:<fermă>:<zi>:<user>`)
 * e pe utilizator: același memento nu pleacă de două ori aceluiași om, dar pleacă fiecăruia.
 */
export function notificareMementoCapcane(input: {
  tenantId: string
  userId: string
  azi: string
  grupuri: ReadonlyArray<GrupCapcane>
  numeParcele: ReadonlyMap<string, string>
}): NotificareZilnica | null {
  const deVerificat = capcaneDeVerificat(input.grupuri, input.azi)
  if (deVerificat.grupuri.length === 0) return null
  const parcele = [...new Set(deVerificat.grupuri.map((grup) => input.numeParcele.get(grup.parcela_id) ?? 'Parcelă'))]
  const parceleText = parcele.length > 3 ? `${parcele.slice(0, 3).join(', ')} și încă ${parcele.length - 3}` : parcele.join(', ')
  const atractant = textAtractant(deVerificat.atractant)
  return {
    tenantId: input.tenantId,
    type: TIP_MEMENTO_CAPCANE,
    title: `Verifică capcanele · ${capcaneText(deVerificat.capcane)}`,
    body: `${parceleText}.${atractant ? ` ${atractant}` : ''}`,
    reminderKey: `capcane:${input.tenantId}:${input.azi}:${input.userId}`,
    data: { zi: input.azi, grup_ids: deVerificat.grupuri.map((grup) => grup.id), capcane: deVerificat.capcane, atractant: deVerificat.atractant },
    entityType: 'capcane',
    entityId: null,
  }
}
