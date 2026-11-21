import { NextResponse } from 'next/server'

import { apiError, validateSameOriginMutation } from '@/lib/api/route-security'
import { createLegalDocSignedUrl, getTenantLegalDocs } from '@/lib/legal-docs/server'
import {
  buildLegalDocsStatus,
  legalDocsFormSchema,
  mapLegalDocsMissingSummary,
  normalizeLegalDocsPayload,
} from '@/lib/legal-docs/shared'
import { captureApiError } from '@/lib/monitoring/report-error'
import { getSupabaseAdmin } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { isFarmOwner } from '@/lib/tenant/account-deletion'
import { getTenantIdByUserId } from '@/lib/tenant/get-tenant'

export const runtime = 'nodejs'

/** Actele fermei sunt ale proprietarului: un operator primește aici ferma în care lucrează, dar nu le vede și nu le schimbă. */
function notOwnerResponse() {
  return apiError(403, 'NOT_FARM_OWNER', 'Doar proprietarul fermei poate vedea și schimba actele.')
}

export async function GET() {
  let userId: string | null = null
  let tenantIdForSentry: string | null = null

  try {
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user?.id) {
      return apiError(401, 'UNAUTHORIZED', 'Trebuie să fii autentificat.')
    }

    userId = user.id
    const tenantId = await getTenantIdByUserId(supabase, user.id)
    tenantIdForSentry = tenantId
    if (!(await isFarmOwner(getSupabaseAdmin(), tenantId, user.id))) {
      return notOwnerResponse()
    }

    const { doc, status } = await getTenantLegalDocs(supabase, tenantId)
    const signedPhotoUrl = await createLegalDocSignedUrl(supabase, doc?.certificate_photo_url)

    return NextResponse.json({
      ok: true,
      data: {
        document: doc,
        signedPhotoUrl,
        status: {
          ...status,
          summary: mapLegalDocsMissingSummary(status),
        },
      },
    })
  } catch (error) {
    captureApiError(error, {
      route: '/api/legal-docs',
      userId,
      tenantId: tenantIdForSentry,
      tags: { http_method: 'GET' },
    })
    return apiError(500, 'INTERNAL_ERROR', 'Nu am putut încărca documentele legale.')
  }
}

export async function PUT(request: Request) {
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
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user?.id) {
      return apiError(401, 'UNAUTHORIZED', 'Trebuie să fii autentificat.')
    }

    userId = user.id
    const tenantId = await getTenantIdByUserId(supabase, user.id)
    tenantIdForSentry = tenantId
    if (!(await isFarmOwner(getSupabaseAdmin(), tenantId, user.id))) {
      return notOwnerResponse()
    }

    const json = await request.json()
    const parsed = legalDocsFormSchema.safeParse(json)
    if (!parsed.success) {
      return apiError(400, 'INVALID_BODY', parsed.error.issues[0]?.message ?? 'Date invalide.')
    }

    const payload = normalizeLegalDocsPayload(parsed.data)
    const { data, error } = await supabase
      .from('farmer_legal_docs')
      .upsert({
        tenant_id: tenantId,
        ...payload,
      })
      .select('*')
      .single()

    if (error || !data) {
      return apiError(400, 'SAVE_FAILED', 'Nu am putut salva documentele legale.')
    }

    const status = buildLegalDocsStatus(data)

    return NextResponse.json({
      ok: true,
      data: {
        document: data,
        status: {
          ...status,
          summary: mapLegalDocsMissingSummary(status),
        },
      },
    })
  } catch (error) {
    captureApiError(error, {
      route: '/api/legal-docs',
      userId,
      tenantId: tenantIdForSentry,
      tags: { http_method: 'PUT' },
    })
    return apiError(500, 'INTERNAL_ERROR', 'Nu am putut salva documentele legale.')
  }
}
