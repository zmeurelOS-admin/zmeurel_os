/**
 * „Produse pe terminate”: o dată pe săptămână, luni dimineața, în verificarea de dimineață existentă
 * (`/api/cron/notificari-dimineata`, fără cron nou). Doar proprietarului (prin `createNotificationForTenantOwner`);
 * push-ul trece prin comutatorul „Produse pe terminate” (`magazie`) și liniștea de noapte. Funcții pure.
 */
import { calculeazaStoc, type MiscareStoc, type ProdusMagazie } from '@/lib/magazie/stoc'

import { TIPURI_ZILNICE, numarRo, type NotificareZilnica } from './common'

/** Luni, după ziua din București (`YYYY-MM-DD`). */
export function esteLuni(ziua: string): boolean {
  const [y, m, d] = ziua.split('-').map(Number)
  if (!y || !m || !d) return false
  return new Date(Date.UTC(y, m - 1, d, 12)).getUTCDay() === 1
}

/** Notificarea fermei, sau `null` dacă nu e luni ori niciun produs nu e pe terminate. */
export function produsePeTerminate(input: {
  tenantId: string
  azi: string
  produse: readonly ProdusMagazie[]
  miscari: readonly MiscareStoc[]
}): NotificareZilnica | null {
  if (!esteLuni(input.azi)) return null
  const peTerminate = calculeazaStoc({ produse: input.produse, miscari: input.miscari, esteProprietar: false }).filter((rand) => rand.pe_terminate)
  if (peTerminate.length === 0) return null
  const nume = peTerminate.slice(0, 3).map((rand) => rand.nume)
  const rest = peTerminate.length - nume.length
  return {
    tenantId: input.tenantId,
    type: TIPURI_ZILNICE.magazie_pe_terminate,
    title: `${numarRo(peTerminate.length, 'produs pe terminate', 'produse pe terminate')} în magazie`,
    body: `${nume.join(', ')}${rest > 0 ? ` și încă ${rest}` : ''}. Deschide Magazia și notează ce cumperi.`,
    reminderKey: `magazie:${input.tenantId}:${input.azi}`,
    data: { zi: input.azi, produs_ids: peTerminate.map((rand) => rand.produs_id) },
    entityType: 'magazie',
    entityId: null,
  }
}
