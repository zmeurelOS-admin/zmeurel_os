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
  logo_url: z.string().url().optional().or(z.literal('')),
  website: z.string().max(200).optional(),
  facebook: z.string().max(200).optional(),
  instagram: z.string().max(200).optional(),
  whatsapp: z.string().max(40).optional(),
  email_public: z.string().email().max(200).optional().or(z.literal('')),
  program_piata: z.string().max(200).optional(),
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

    const {
      tenantId,
      descriere_publica,
      specialitate,
      localitate,
      poze_ferma,
      logo_url,
      website,
      facebook,
      instagram,
      whatsapp,
      email_public,
      program_piata,
    } = parsed.data
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
    if (logo_url !== undefined) {
      patch.logo_url = logo_url.trim() || null
    }
    if (website !== undefined) {
      patch.website = website.trim() || null
    }
    if (facebook !== undefined) {
      patch.facebook = facebook.trim() || null
    }
    if (instagram !== undefined) {
      patch.instagram = instagram.trim() || null
    }
    if (whatsapp !== undefined) {
      patch.whatsapp = whatsapp.trim() || null
    }
    if (email_public !== undefined) {
      patch.email_public = email_public.trim() || null
    }
    if (program_piata !== undefined) {
      patch.program_piata = program_piata.trim() || null
    }

    const { data: updated, error: updateErr } = await supabase
      .from('tenants')
      .update(patch)
      .eq('id', tenantId)
      .select(
        'id, nume_ferma, is_association_approved, descriere_publica, specialitate, localitate, poze_ferma, logo_url, website, facebook, instagram, whatsapp, email_public, program_piata, updated_at'
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
