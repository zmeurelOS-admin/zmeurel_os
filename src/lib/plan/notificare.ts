/**
 * Notificarea planului în verificarea de dimineață (`/api/cron/notificari-dimineata`, fără cron nou):
 * „E timpul pentru <stadiu> la <parcele> · N intervenții”, o singură dată pe linie, parcelă și repetare (ce s-a anunțat
 * se ține în `planuri_anuntate`). Primesc proprietarul și operatorii activi cu „Scrie” pe Tratamente; push-ul trece
 * prin comutatorul „Planul de tratamente” și liniștea 22–6 (`createNotification` → `permitePush`). Funcții pure.
 */
import { destinatariMementoCapcane, type MembruFerma } from '@/lib/capcane/destinatari'
import { TIPURI_ZILNICE, type NotificareZilnica } from '@/lib/notifications/zilnice/common'
import type { StadiuCod } from '@/lib/parcele/stadii-canonic'

import { eticheta, interventiiText } from './model'
import type { InterventieDeFacut } from './urmeaza'

export const TIP_NOTIFICARE_PLAN = TIPURI_ZILNICE.plan_tratament
export const LINK_PLAN = '/tratamente?tab=plan'

export interface Anunt {
  plan_linie_id: string
  parcela_id: string
  an: number
  repetare: number
}

export const cheieAnunt = (a: Anunt) => `${a.plan_linie_id}:${a.parcela_id}:${a.an}:${a.repetare}`

/** Intervențiile de făcut care n-au fost anunțate încă (linie × parcelă × an × repetare). */
export function anunturiNoi(deFacut: readonly InterventieDeFacut[], anuntate: readonly Anunt[], an: number): Array<InterventieDeFacut & { an: number }> {
  const deja = new Set(anuntate.map(cheieAnunt))
  const vazute = new Set<string>()
  const rezultat: Array<InterventieDeFacut & { an: number }> = []
  for (const item of deFacut) {
    const cheie = cheieAnunt({ plan_linie_id: item.linie.id, parcela_id: item.parcelaId, an, repetare: item.repetare })
    if (deja.has(cheie) || vazute.has(cheie)) continue
    vazute.add(cheie)
    rezultat.push({ ...item, an })
  }
  return rezultat
}

/** Rândurile de scris în `planuri_anuntate` după trimitere. */
export function randuriAnuntate(tenantId: string, noi: ReadonlyArray<InterventieDeFacut & { an: number }>): Array<Anunt & { tenant_id: string }> {
  return noi.map((item) => ({ tenant_id: tenantId, plan_linie_id: item.linie.id, parcela_id: item.parcelaId, an: item.an, repetare: item.repetare }))
}

const textParcele = (nume: readonly string[]) => (nume.length > 3 ? `${nume.slice(0, 3).join(', ')} și încă ${nume.length - 3}` : nume.join(', '))

/**
 * Notificarea pentru un utilizator, sau `null` dacă nu e nimic nou. Titlul spune primul stadiu (cel mai devreme în
 * an); celelalte stadii, dacă sunt, intră în text. Cheia (`plan:<fermă>:<zi>:<utilizator>`) e pe utilizator.
 */
export function notificarePlan(input: {
  tenantId: string
  userId: string
  azi: string
  noi: ReadonlyArray<InterventieDeFacut>
  culturaTip?: ReadonlyMap<string, string>
  numeParcele: ReadonlyMap<string, string>
}): NotificareZilnica | null {
  if (input.noi.length === 0) return null
  const peStadiu = new Map<StadiuCod, { parcele: Set<string>; linii: Set<string>; planId: string }>()
  for (const item of input.noi) {
    const grup = peStadiu.get(item.linie.stadiu) ?? { parcele: new Set<string>(), linii: new Set<string>(), planId: item.planId }
    grup.parcele.add(item.parcelaId)
    grup.linii.add(item.linie.id)
    peStadiu.set(item.linie.stadiu, grup)
  }
  const grupuri = [...peStadiu.entries()]
  const [stadiu, primul] = grupuri[0]
  const nume = (ids: Iterable<string>) => [...ids].map((id) => input.numeParcele.get(id) ?? 'Parcelă')
  const label = (s: StadiuCod, planId: string) => eticheta(s, input.culturaTip?.get(planId))
  const total = new Set(input.noi.map((item) => `${item.linie.id}`)).size
  const restul = grupuri.slice(1).map(([s, g]) => `${label(s, g.planId)} la ${textParcele(nume(g.parcele))}`)
  return {
    tenantId: input.tenantId,
    type: TIP_NOTIFICARE_PLAN,
    title: `E timpul pentru ${label(stadiu, primul.planId)} la ${textParcele(nume(primul.parcele))} · ${interventiiText(total)}`,
    body: restul.length > 0 ? `Și: ${restul.join('; ')}.` : 'Deschide planul: un atins completează tratamentul.',
    reminderKey: `plan:${input.tenantId}:${input.azi}:${input.userId}`,
    data: {
      zi: input.azi,
      linii: [...new Set(input.noi.map((item) => item.linie.id))],
      parcele: [...new Set(input.noi.map((item) => item.parcelaId))],
    },
    entityType: 'plan_tratament',
    entityId: primul.planId,
  }
}

/** Cine primește: proprietarul și operatorii activi cu „Scrie” pe Tratamente (aceeași regulă ca la capcane). */
export function destinatariPlan(input: { ownerUserId: string | null; membri: readonly MembruFerma[] }): string[] {
  return destinatariMementoCapcane(input)
}
