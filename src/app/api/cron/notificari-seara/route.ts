import { NextResponse } from 'next/server'

import { captureApiError } from '@/lib/monitoring/report-error'
import {
  STATUSURI_DE_PUS_IN_LIVRARE,
  TIPURI_ZILNICE,
  adaugaZile,
  comenziMaine,
  ziuaInBucuresti,
  type ComandaPentruMaine,
} from '@/lib/notifications/zilnice'
import {
  citesteFermeleReale,
  contorNou,
  hasValidCronSecret,
  numara,
  trimiteNotificareZilnica,
} from '@/lib/notifications/zilnice/server'
import { getSupabaseAdmin } from '@/lib/supabase/admin'

export const runtime = 'nodejs'

const ROUTE = '/api/cron/notificari-seara'

/**
 * Seara (17:00 UTC: 19:00 iarna, 20:00 vara, ora României). „Comenzi de mâine”: pentru fiecare fermă reală,
 * o notificare cu comenzile de fructe de mâine încă nepuse în livrare.
 * Doar citește comenzile și inserează în `notifications`.
 */
export async function GET(request: Request) {
  if (!hasValidCronSecret(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const admin = getSupabaseAdmin()
    const azi = ziuaInBucuresti(new Date())
    const maine = adaugaZile(azi, 1)
    const ferme = await citesteFermeleReale(admin)
    const contor = contorNou([TIPURI_ZILNICE.comenzi_maine])

    for (const ferma of ferme) {
      try {
        const { data, error } = await admin
          .from('comenzi')
          .select('id, tenant_id, data_livrare, status, cantitate_kg')
          .eq('tenant_id', ferma.id)
          .eq('data_livrare', maine)
          .in('status', [...STATUSURI_DE_PUS_IN_LIVRARE] as Array<'noua' | 'confirmata' | 'programata'>)
        if (error) throw error
        contor.fermeVerificate += 1

        for (const notificare of comenziMaine((data ?? []) as ComandaPentruMaine[], azi)) {
          numara(contor, notificare.type, await trimiteNotificareZilnica(admin, notificare))
        }
      } catch (error) {
        contor.erori += 1
        captureApiError(error, { route: ROUTE, tenantId: ferma.id })
      }
    }

    return NextResponse.json({ ok: true, azi, ...contor })
  } catch (error) {
    captureApiError(error, { route: ROUTE })
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Verificarea de seară a eșuat' },
      { status: 500 },
    )
  }
}
