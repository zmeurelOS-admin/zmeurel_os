import { NextResponse } from 'next/server'

import { capturiInSaptamana, inceputSaptamana, pestePrag, textAlertaPrag } from '@/lib/capcane'
import { TIP_ALERTA_CAPCANE } from '@/lib/capcane/memento'
import { grupuriCuVerificari, inCoacereParcele, praguriFerma } from '@/lib/capcane/server'
import { apiError, validateSameOriginMutation } from '@/lib/api/route-security'
import { actorCanWrite, resolveFarmActor } from '@/lib/farm-members/actor-auth'
import { captureApiError } from '@/lib/monitoring/report-error'
import { adaugaZile } from '@/lib/notifications/zilnice/common'
import { trimiteNotificareZilnica } from '@/lib/notifications/zilnice/server'
import { getSupabaseAdmin } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { aziRo } from '@/lib/tratamente/zile'

export const runtime = 'nodejs'

const ROUTE = '/api/capcane/alerta'
const ZI = /^\d{4}-\d{2}-\d{2}$/

/**
 * Alerta „Peste prag”, imediat după salvarea unei verificări (din formularul „Verifică acum”), doar proprietarului:
 * push + în aplicație, „Drosophila peste prag la Maravilla 1 (9 în 3 capcane)”, cu link spre graficul grupului.
 *
 * Nu are încredere în ce trimite browserul: citește cu service role grupurile fermei celui care cere (operatorul cu
 * „Scrie” pe Tratamente sau proprietarul), verificările din săptămâna aceea, pragul fermei și „în coacere”, și
 * recalculează. O singură alertă pe grup și săptămână (cheia `capcane-prag:<grup>:<luni>`). Push-ul trece prin
 * comutatorul „Capturi peste prag” și liniștea 22–6 (`createNotification`).
 */
export async function POST(request: Request) {
  const origin = validateSameOriginMutation(request)
  if (origin) return origin

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user?.id) return apiError(401, 'UNAUTHORIZED', 'Autentificare necesară.')

  const body = (await request.json().catch(() => null)) as { grup_ids?: unknown; data?: unknown } | null
  const grupIds = Array.isArray(body?.grup_ids) ? [...new Set(body.grup_ids.filter((id): id is string => typeof id === 'string' && id.length > 0 && id.length <= 64))].slice(0, 50) : []
  const azi = aziRo()
  const ziua = typeof body?.data === 'string' && ZI.test(body.data) && body.data <= azi ? body.data : azi
  if (grupIds.length === 0) return NextResponse.json({ ok: true, trimise: 0 })

  try {
    const admin = getSupabaseAdmin()
    const actor = await resolveFarmActor(admin, user)
    if (!actor || !actorCanWrite(actor, 'tratamente')) return apiError(403, 'FORBIDDEN', 'Nu ai drept de scriere pe tratamente.')

    const start = inceputSaptamana(ziua)
    const date = await grupuriCuVerificari(admin, actor.tenantId, grupIds, start, adaugaZile(start, 6))
    if (!date) return NextResponse.json({ ok: true, trimise: 0, indisponibil: true })
    if (date.grupuri.length === 0) return NextResponse.json({ ok: true, trimise: 0 })

    const praguri = await praguriFerma(admin, actor.tenantId)
    const inCoacere = await inCoacereParcele(admin, actor.tenantId, date.grupuri.map((g) => g.parcela_id), Number(ziua.slice(0, 4)))
    const { data: parcele } = await admin.from('parcele').select('id,nume_parcela').eq('tenant_id', actor.tenantId).in('id', date.grupuri.map((g) => g.parcela_id))
    const nume = new Map(((parcele ?? []) as Array<{ id: string; nume_parcela: string | null }>).map((p) => [p.id, p.nume_parcela?.trim() || 'Parcelă']))

    let trimise = 0
    for (const grup of date.grupuri) {
      const capturi = capturiInSaptamana(date.verificari.filter((v) => v.grup_id === grup.id), ziua)
      if (!pestePrag({ capturi, nrBucati: grup.nr_bucati, prag: praguri[grup.tip], inCoacere: inCoacere(grup.parcela_id, ziua) })) continue
      const parcela = nume.get(grup.parcela_id) ?? 'Parcelă'
      const titlu = textAlertaPrag({ tip: grup.tip, parcela, capturi: capturi ?? 0, nrBucati: grup.nr_bucati })
      const rezultat = await trimiteNotificareZilnica(admin, {
        tenantId: actor.tenantId,
        type: TIP_ALERTA_CAPCANE,
        title: titlu,
        body: `Deschide graficul și vezi dacă e nevoie de un tratament pe ${parcela}.`,
        reminderKey: `capcane-prag:${grup.id}:${start}`,
        data: { grup_id: grup.id, parcela_id: grup.parcela_id, zi: ziua, capturi, nr_bucati: grup.nr_bucati },
        entityType: 'capcane',
        entityId: grup.id,
      })
      if (rezultat === 'trimisa') trimise += 1
    }
    return NextResponse.json({ ok: true, trimise })
  } catch (error) {
    captureApiError(error, { route: ROUTE, tags: { pas: 'alerta' } })
    return apiError(500, 'ALERTA_EROARE', 'Alerta nu s-a trimis.')
  }
}
