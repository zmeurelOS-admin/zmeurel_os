/**
 * Rutele mementoului („Amână”, „Nu fac analize anul acesta”): POST cu cookie-ul sesiunii, doar proprietarul.
 * Butonul „Amână 3 zile” din notificare cheamă aceeași rută din service worker (`public/push-handlers.js`),
 * fără niciun token în URL.
 */
import { NextResponse } from 'next/server'

import { apiError, validateSameOriginMutation } from '@/lib/api/route-security'
import { isMissingTableError } from '@/lib/notifications/preferinte'
import { getSupabaseAdmin } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { isFarmOwner } from '@/lib/tenant/account-deletion'
import { getTenantIdOrNull } from '@/lib/tenant/get-tenant'
import { aziRo } from '@/lib/tratamente/zile'

export const MEMENTO_INDISPONIBIL = 'Mementoul se poate salva după actualizarea bazei de date.'

type Scriere = { amanat_pana?: string | null; dezactivat?: boolean }

export async function scrieStareMemento(request: Request, valori: (azi: string) => Scriere) {
  const origin = validateSameOriginMutation(request)
  if (origin) return origin

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user?.id) return apiError(401, 'UNAUTHORIZED', 'Autentificare necesară.')

  const tenantId = await getTenantIdOrNull(supabase)
  if (!tenantId || !(await isFarmOwner(getSupabaseAdmin(), tenantId, user.id))) {
    return apiError(403, 'FORBIDDEN', 'Doar proprietarul fermei primește mementoul.')
  }

  const azi = aziRo()
  const an = Number(azi.slice(0, 4))
  const scriere = valori(azi)
  // Tabelul nu e încă în tipurile generate.
  const { error } = await (supabase as unknown as {
    from: (t: string) => { upsert: (row: unknown, o: { onConflict: string }) => PromiseLike<{ error: { code?: string; message?: string } | null }> }
  })
    .from('memento_analize_sezon')
    .upsert({ tenant_id: tenantId, an, ...scriere, updated_at: new Date().toISOString() }, { onConflict: 'tenant_id,an' })
  if (error) {
    if (isMissingTableError(error)) return apiError(503, 'MEMENTO_INDISPONIBIL', MEMENTO_INDISPONIBIL)
    return apiError(500, 'MEMENTO_EROARE', 'Nu s-a salvat. Încearcă din nou.')
  }
  return NextResponse.json({ ok: true, data: { an, amanatPana: scriere.amanat_pana ?? null, dezactivat: scriere.dezactivat } })
}
