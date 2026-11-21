/**
 * „Tratamente planificate”: dimineața, în ziua lor, o singură notificare pe fermă
 * („2 tratamente planificate azi”). Comutatorul din „Ce primești”: `tratamente`.
 */
import { TIPURI_ZILNICE, numarRo, type NotificareZilnica } from './common'

export type AplicarePlanificata = {
  id: string
  tenant_id: string
  status: string
  data_planificata: string | null
  /** Lotul (salvate împreună pe mai multe parcele); `null` pentru cele vechi sau dinainte de migrare. */
  lot_id?: string | null
}

/** `azi` = ziua din București. Un tratament = un lot (sau o aplicare fără lot). */
export function tratamentePlanificateAzi(aplicari: readonly AplicarePlanificata[], azi: string): NotificareZilnica[] {
  const peFerma = new Map<string, Set<string>>()
  const idsPeFerma = new Map<string, string[]>()
  for (const aplicare of aplicari) {
    if (aplicare.status !== 'planificata') continue
    if (String(aplicare.data_planificata ?? '').slice(0, 10) !== azi) continue
    const tratamente = peFerma.get(aplicare.tenant_id) ?? new Set<string>()
    tratamente.add(aplicare.lot_id ? `lot:${aplicare.lot_id}` : `id:${aplicare.id}`)
    peFerma.set(aplicare.tenant_id, tratamente)
    idsPeFerma.set(aplicare.tenant_id, [...(idsPeFerma.get(aplicare.tenant_id) ?? []), aplicare.id])
  }

  const rezultat: NotificareZilnica[] = []
  for (const [tenantId, tratamente] of peFerma) {
    const n = tratamente.size
    rezultat.push({
      tenantId,
      type: TIPURI_ZILNICE.tratament_planificat,
      title: `${numarRo(n, 'tratament planificat', 'tratamente planificate')} azi`,
      body: n === 1 ? 'Deschide Tratamente și marchează-l făcut după stropire.' : 'Deschide Tratamente și marchează-le făcute pe rând.',
      reminderKey: `tratament:${tenantId}:${azi}`,
      data: { zi: azi, aplicare_ids: idsPeFerma.get(tenantId) ?? [] },
      entityType: 'tratamente',
      entityId: null,
    })
  }
  return rezultat
}
