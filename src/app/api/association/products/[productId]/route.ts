import { NextResponse } from 'next/server'
import { z } from 'zod'

import { apiError, validateSameOriginMutation } from '@/lib/api/route-security'
import { getAssociationRole } from '@/lib/association/auth'
import { captureApiError } from '@/lib/monitoring/sentry'
import { getSupabaseAdmin } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'

const paramsSchema = z.object({
  productId: z.string().uuid(),
})

const bodySchema = z.object({
  assoc_ingrediente: z.string().max(4000).nullable().optional(),
  assoc_alergeni: z.string().max(2000).nullable().optional(),
  assoc_pastrare: z.string().max(1000).nullable().optional(),
  assoc_valabilitate: z.string().max(1000).nullable().optional(),
  assoc_tip_produs: z.enum(['standard', 'bio', 'traditional', 'ecologic']).nullable().optional(),
})

function normalizeOptionalText(value: string | null | undefined): string | null | undefined {
  if (value === undefined) return undefined
  if (value === null) return null
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ productId: string }> },
) {
  let userId: string | null = null
  let productIdForSentry: string | null = null

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
      return apiError(403, 'FORBIDDEN', 'Doar administratorii și moderatorii pot modifica produsele.')
    }

    const params = paramsSchema.safeParse(await context.params)
    if (!params.success) {
      return apiError(400, 'INVALID_PARAMS', 'Produs invalid.')
    }

    const parsed = bodySchema.safeParse(await request.json())
    if (!parsed.success) {
      return apiError(400, 'INVALID_BODY', 'Date invalide.')
    }

    const productId = params.data.productId
    productIdForSentry = productId
    const admin = getSupabaseAdmin()

    const { data: existing, error: fetchError } = await admin
      .from('produse')
      .select(
        `
        id,
        tenant_id,
        tenants!inner (
          is_association_approved,
          is_demo
        )
      `,
      )
      .eq('id', productId)
      .single()

    if (fetchError || !existing) {
      return apiError(404, 'NOT_FOUND', 'Produsul nu a fost găsit.')
    }

    const tenantEmbed = existing.tenants as
      | { is_association_approved: boolean | null; is_demo: boolean | null }
      | Array<{ is_association_approved: boolean | null; is_demo: boolean | null }>
      | null
    const tenant = Array.isArray(tenantEmbed) ? tenantEmbed[0] : tenantEmbed
    if (!tenant?.is_association_approved || tenant.is_demo === true) {
      return apiError(403, 'FORBIDDEN', 'Produsul nu aparține unui fermier real aprobat în asociație.')
    }

    const payload = {
      assoc_ingrediente: normalizeOptionalText(parsed.data.assoc_ingrediente),
      assoc_alergeni: normalizeOptionalText(parsed.data.assoc_alergeni),
      assoc_pastrare: normalizeOptionalText(parsed.data.assoc_pastrare),
      assoc_valabilitate: normalizeOptionalText(parsed.data.assoc_valabilitate),
      assoc_tip_produs: parsed.data.assoc_tip_produs ?? null,
      updated_at: new Date().toISOString(),
    }

    const { data: updated, error: updateError } = await admin
      .from('produse')
      .update(payload)
      .eq('id', productId)
      .select(
        'id, assoc_ingrediente, assoc_alergeni, assoc_pastrare, assoc_valabilitate, assoc_tip_produs, updated_at',
      )
      .single()

    if (updateError || !updated) {
      return apiError(400, 'UPDATE_FAILED', 'Nu am putut salva informațiile alimentare.')
    }

    return NextResponse.json({
      ok: true,
      data: updated,
    })
  } catch (error) {
    captureApiError(error, {
      route: '/api/association/products/[productId]',
      userId,
      extra: { product_id: productIdForSentry },
    })
    return apiError(500, 'INTERNAL_ERROR', 'Eroare la salvare.')
  }
}
