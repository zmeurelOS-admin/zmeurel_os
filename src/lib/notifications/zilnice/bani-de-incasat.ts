/**
 * „Bani de încasat”: dimineața, clienții care au de plătit de 7 sau 14 zile. De la 30 de zile încolo, comenzile
 * neîncasate intră în mementoul cumulat „neîncasate de peste 30 de zile” (`neincasate-30.ts`, promptul 33).
 *
 * Restul unei vânzări e cel din Vânzări și din fișa clientului (`vanzareRest` din `lib/vanzari/incasari.ts`):
 * total − plata parțială, 0 pentru vânzările încasate.
 *
 * Pentru fiecare client se socotește de la cea mai veche vânzare (livrare) cu rest. Notificarea pleacă doar
 * în ziua în care aceasta împlinește 7 sau 14 zile, cu tot restul clientului. Peste 3 clienți în
 * aceeași zi: o singură notificare pentru toți.
 */
import { formatLei, round2 } from '@/lib/format-ro'
import { vanzareRest } from '@/lib/vanzari/incasari'

import { TIPURI_ZILNICE, numarRo, ziScurta, zileIntre, type NotificareZilnica } from './common'

export type VanzarePentruIncasare = {
  id: string
  tenant_id: string
  client_id: string | null
  /** `clienti.nume_client`, adus de cron. */
  client_nume: string | null
  /** Ziua vânzării (livrării), `YYYY-MM-DD`. */
  data: string
  cantitate_kg: number
  pret_lei_kg: number
  status_plata: string | null
  suma_incasata_partial_lei: number | null
}

/** Zilele (de la cea mai veche livrare neîncasată) în care te anunțăm. */
export const ZILE_RESTANTA: readonly number[] = [7, 14]

/** Peste atâția clienți în aceeași zi, o singură notificare. */
export const MAX_CLIENTI_SEPARAT = 3

type ClientRestant = {
  clientId: string
  nume: string
  lei: number
  ceaMaiVeche: string
  zile: number
  vanzari: string[]
}

function zileText(zile: number): string {
  return numarRo(zile, 'zi', 'zile')
}

/**
 * `azi` = ziua de azi în București (`YYYY-MM-DD`). Vânzările fără client nu intră: nu avem pe cine anunța
 * și nici fișa la care să ducem.
 */
export function baniDeIncasat(vanzari: readonly VanzarePentruIncasare[], azi: string): NotificareZilnica[] {
  // ferma → client → vânzări cu rest
  const peFerma = new Map<string, Map<string, { nume: string; lei: number; ceaMaiVeche: string; vanzari: string[] }>>()

  for (const vanzare of vanzari) {
    if (!vanzare.client_id) continue
    const ziua = String(vanzare.data ?? '').slice(0, 10)
    if (zileIntre(ziua, azi) === null) continue
    const rest = vanzareRest({ ...vanzare, status_plata: vanzare.status_plata ?? '' })
    if (rest <= 0) continue

    const clienti = peFerma.get(vanzare.tenant_id) ?? new Map()
    const client = clienti.get(vanzare.client_id) ?? {
      nume: vanzare.client_nume?.trim() || 'Un client',
      lei: 0,
      ceaMaiVeche: ziua,
      vanzari: [],
    }
    client.lei = round2(client.lei + rest)
    if (ziua < client.ceaMaiVeche) client.ceaMaiVeche = ziua
    client.vanzari.push(vanzare.id)
    clienti.set(vanzare.client_id, client)
    peFerma.set(vanzare.tenant_id, clienti)
  }

  const rezultat: NotificareZilnica[] = []
  for (const [tenantId, clienti] of peFerma) {
    const deAnuntat: ClientRestant[] = []
    for (const [clientId, client] of clienti) {
      const zile = zileIntre(client.ceaMaiVeche, azi)
      if (zile === null || !ZILE_RESTANTA.includes(zile)) continue
      deAnuntat.push({ clientId, ...client, zile })
    }
    if (deAnuntat.length === 0) continue

    if (deAnuntat.length > MAX_CLIENTI_SEPARAT) {
      const lei = round2(deAnuntat.reduce((total, client) => total + client.lei, 0))
      rezultat.push({
        tenantId,
        type: TIPURI_ZILNICE.incasari_restante,
        title: `${numarRo(deAnuntat.length, 'client are', 'clienți au')} de plătit ${formatLei(lei)}`,
        body: 'Au trecut 7 sau 14 zile de la livrare.',
        reminderKey: `rest:${tenantId}:grup:${azi}`,
        data: {
          grup: true,
          client_ids: deAnuntat.map((client) => client.clientId),
          total_lei: lei,
        },
        entityType: null,
        entityId: null,
      })
      continue
    }

    for (const client of deAnuntat) {
      rezultat.push({
        tenantId,
        type: TIPURI_ZILNICE.incasari_restante,
        title: `${client.nume}: ${formatLei(client.lei)} de ${zileText(client.zile)}`,
        body: `Cea mai veche livrare neîncasată e din ${ziScurta(client.ceaMaiVeche)}.`,
        reminderKey: `rest:${tenantId}:${client.clientId}:${client.zile}:${azi}`,
        data: {
          client_id: client.clientId,
          zile: client.zile,
          total_lei: client.lei,
          vanzare_ids: client.vanzari,
        },
        entityType: 'clienti',
        entityId: client.clientId,
      })
    }
  }
  return rezultat
}
