import { NextResponse } from 'next/server'
import { z } from 'zod'

import { apiError, validateSameOriginMutation } from '@/lib/api/route-security'
import { isSuperAdmin } from '@/lib/auth/isSuperAdmin'
import { getAssociationRole } from '@/lib/association/auth'
import { captureApiError } from '@/lib/monitoring/sentry'
import { createNotification, NOTIFICATION_TYPES } from '@/lib/notifications/create'
import { createClient } from '@/lib/supabase/server'
import type { Database } from '@/types/supabase'

export const runtime = 'nodejs'

const patchBodySchema = z.object({
  tenantId: z.string().uuid(),
  approved: z.boolean(),
})

const postBodySchema = z.object({
  tenantId: z.string().uuid(),
  listed: z.boolean(),
})

type TenantRow = Database['public']['Tables']['tenants']['Row']

export async function PATCH(request: Request) {
  let userId: string | null = null
  let tenantIdForSentry: string | null = null

  try {
    const invalidOriginResponse = validateSameOriginMutation(request)
    if (invalidOriginResponse) {
      return invalidOriginResponse
    }

    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user?.id) {
      return apiError(401, 'UNAUTHORIZED', 'Trebuie să fii autentificat.')
    }
    userId = user.id

    const superadmin = await isSuperAdmin(supabase, user.id)
    if (!superadmin) {
      return apiError(
        403,
        'FORBIDDEN',
        'Doar administratorul Zmeurel.ro poate aproba fermieri pentru asociație'
      )
    }

    const json = await request.json()
    const parsed = patchBodySchema.safeParse(json)
    if (!parsed.success) {
      return apiError(400, 'INVALID_BODY', 'Date invalide.')
    }

    const { tenantId, approved } = parsed.data
    tenantIdForSentry = tenantId

    const { data: tenant, error: fetchErr } = await supabase
      .from('tenants')
      .select('id')
      .eq('id', tenantId)
      .maybeSingle()

    if (fetchErr || !tenant) {
      return apiError(404, 'NOT_FOUND', 'Ferma nu a fost găsită.')
    }

    if (!approved) {
      const { error: unlistErr } = await supabase
        .from('produse')
        .update({
          association_listed: false,
          updated_at: new Date().toISOString(),
        })
        .eq('tenant_id', tenantId)

      if (unlistErr) {
        return apiError(400, 'UNLIST_FAILED', 'Nu am putut retrage produsele din listă înainte de suspendare.')
      }
    }

    const { data: updated, error: upErr } = await supabase
      .from('tenants')
      .update({
        is_association_approved: approved,
        updated_at: new Date().toISOString(),
      })
      .eq('id', tenantId)
      .select('*')
      .single()

    if (upErr || !updated) {
      return apiError(400, 'UPDATE_FAILED', 'Nu am putut actualiza ferma.')
    }

    const u = updated as TenantRow
    if (u.owner_user_id) {
      try {
        void createNotification(
          u.owner_user_id,
          approved ? NOTIFICATION_TYPES.producer_approved : NOTIFICATION_TYPES.producer_suspended,
          approved ? 'Fermă aprobată în asociație' : 'Fermă suspendată din asociație',
          approved
            ? 'Ferma ta apare în magazinul asociației.'
            : 'Produsele tale au fost retrase din listarea asociației.',
          { tenantId, approved },
          'producer',
          tenantId,
        )
      } catch (e) {
        console.error('[association/producers] notification', e)
      }
    }

    return NextResponse.json({
      ok: true,
      data: u,
    })
  } catch (error) {
    captureApiError(error, {
      route: '/api/association/producers',
      userId,
      tenantId: tenantIdForSentry,
    })
    return apiError(500, 'INTERNAL_ERROR', 'Eroare la actualizare.')
  }
}

export async function POST(request: Request) {
  let userId: string | null = null
  let tenantIdForSentry: string | null = null

  try {
    const invalidOriginResponse = validateSameOriginMutation(request)
    if (invalidOriginResponse) {
      return invalidOriginResponse
    }

    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user?.id) {
      return apiError(401, 'UNAUTHORIZED', 'Trebuie să fii autentificat.')
    }
    userId = user.id

    const role = await getAssociationRole(user.id)
    if (role !== 'admin' && role !== 'moderator') {
      return apiError(403, 'FORBIDDEN', 'Doar administratorii și moderatorii pot lista produsele în lot.')
    }

    const json = await request.json()
    const parsed = postBodySchema.safeParse(json)
    if (!parsed.success) {
      return apiError(400, 'INVALID_BODY', 'Date invalide.')
    }

    const { tenantId, listed } = parsed.data
    tenantIdForSentry = tenantId

    const { data: tenant, error: tErr } = await supabase
      .from('tenants')
      .select('id, is_association_approved')
      .eq('id', tenantId)
      .maybeSingle()

    if (tErr || !tenant) {
      return apiError(404, 'NOT_FOUND', 'Ferma nu a fost găsită.')
    }

    if (!tenant.is_association_approved) {
      return apiError(403, 'NOT_APPROVED', 'Ferma nu este aprobată pentru magazinul asociației.')
    }

    const { data: rows, error: upErr } = await supabase
      .from('produse')
      .update({
        association_listed: listed,
        updated_at: new Date().toISOString(),
      })
      .eq('tenant_id', tenantId)
      .eq('status', 'activ')
      .select('id')

    if (upErr) {
      return apiError(400, 'BATCH_UPDATE_FAILED', 'Nu am putut actualiza produsele.')
    }

    return NextResponse.json({
      ok: true,
      data: { updatedCount: rows?.length ?? 0 },
    })
  } catch (error) {
    captureApiError(error, {
      route: '/api/association/producers',
      userId,
      tenantId: tenantIdForSentry,
    })
    return apiError(500, 'INTERNAL_ERROR', 'Eroare la actualizare în lot.')
  }
}
