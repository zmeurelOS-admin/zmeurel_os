import { NextResponse } from 'next/server'
import { z } from 'zod'

import { apiError, validateSameOriginMutation } from '@/lib/api/route-security'
import { getAssociationRole } from '@/lib/association/auth'
import { captureApiError } from '@/lib/monitoring/sentry'
import { createClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'

const patchBodySchema = z.object({
  tenantId: z.string().uuid(),
  descriere_publica: z.string().max(500).optional(),
  specialitate: z.string().max(120).optional(),
  localitate: z.string().max(120).optional(),
  poze_ferma: z.array(z.string().url()).max(3).optional(),
})

function normalizePhotos(values: string[] | undefined): string[] | undefined {
  if (!values) return undefined
  return [...new Set(values.map((value) => value.trim()).filter((value) => value.length > 0))].slice(0, 3)
}

export async function PATCH(request: Request) {
  let userId: string | null = null
  let tenantIdForSentry: string | null = null

  try {
    const invalidOrigin = validateSameOriginMutation(request)
    if (invalidOrigin) return invalidOrigin

    const supabase = await createClient()
    const {
      data: { user },
      error: authErr,
    } = await supabase.auth.getUser()

    if (authErr || !user?.id) {
      return apiError(401, 'UNAUTHORIZED', 'Trebuie să fii autentificat.')
    }
    userId = user.id

    const role = await getAssociationRole(user.id)
    if (role !== 'admin' && role !== 'moderator') {
      return apiError(403, 'FORBIDDEN', 'Doar administratorii și moderatorii pot edita profilul public.')
    }

    const json = await request.json()
    const parsed = patchBodySchema.safeParse(json)
    if (!parsed.success) {
      return apiError(400, 'INVALID_BODY', 'Date invalide.')
    }

    const { tenantId, descriere_publica, specialitate, localitate, poze_ferma } = parsed.data
    tenantIdForSentry = tenantId

    const { data: tenant, error: tenantErr } = await supabase
      .from('tenants')
      .select('id, nume_ferma, is_association_approved')
      .eq('id', tenantId)
      .maybeSingle()

    if (tenantErr || !tenant) {
      return apiError(404, 'NOT_FOUND', 'Producătorul nu a fost găsit.')
    }

    if (!tenant.is_association_approved) {
      return apiError(403, 'NOT_APPROVED', 'Ferma nu este aprobată pentru magazinul asociației.')
    }

    const patch: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    }

    if (descriere_publica !== undefined) {
      patch.descriere_publica = descriere_publica.trim() || null
    }
    if (specialitate !== undefined) {
      patch.specialitate = specialitate.trim() || null
    }
    if (localitate !== undefined) {
      patch.localitate = localitate.trim() || 'Suceava'
    }
    if (poze_ferma !== undefined) {
      patch.poze_ferma = normalizePhotos(poze_ferma)
    }

    const { data: updated, error: updateErr } = await supabase
      .from('tenants')
      .update(patch)
      .eq('id', tenantId)
      .select(
        'id, nume_ferma, is_association_approved, descriere_publica, specialitate, localitate, poze_ferma, updated_at'
      )
      .single()

    if (updateErr || !updated) {
      return apiError(400, 'UPDATE_FAILED', 'Nu am putut actualiza profilul producătorului.')
    }

    return NextResponse.json({
      ok: true,
      data: {
        tenant: updated,
      },
    })
  } catch (error) {
    captureApiError(error, {
      route: '/api/association/producer-profile',
      userId,
      tenantId: tenantIdForSentry,
      tags: { http_method: 'PATCH' },
    })
    return apiError(500, 'INTERNAL_ERROR', 'Eroare la actualizarea profilului.')
  }
}
