import { NextResponse } from 'next/server'
import { z } from 'zod'

import { apiError, validateSameOriginMutation } from '@/lib/api/route-security'
import { getAssociationRole } from '@/lib/association/auth'
import { captureApiError } from '@/lib/monitoring/sentry'
import { createNotificationForTenantOwner, NOTIFICATION_TYPES } from '@/lib/notifications/create'
import { createClient } from '@/lib/supabase/server'
import type { Database } from '@/types/supabase'

export const runtime = 'nodejs'

const patchBodySchema = z
  .object({
    productId: z.string().uuid(),
    association_listed: z.boolean().optional(),
    association_price: z.number().nonnegative().nullable().optional(),
  })
  .refine((b) => b.association_listed !== undefined || b.association_price !== undefined, {
    message: 'Cel puțin un câmp trebuie trimis.',
  })

type ProduseRow = Database['public']['Tables']['produse']['Row']

export async function PATCH(request: Request) {
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
      return apiError(403, 'FORBIDDEN', 'Doar administratorii și moderatorii pot modifica catalogul asociației.')
    }

    const json = await request.json()
    const parsed = patchBodySchema.safeParse(json)
    if (!parsed.success) {
      return apiError(400, 'INVALID_BODY', 'Date invalide.')
    }

    const { productId, association_listed, association_price } = parsed.data
    productIdForSentry = productId

    const { data: existing, error: fetchErr } = await supabase
      .from('produse')
      .select(
        `
        id,
        tenant_id,
        tenants!inner ( is_association_approved, is_demo )
      `
      )
      .eq('id', productId)
      .single()

    if (fetchErr || !existing) {
      return apiError(404, 'NOT_FOUND', 'Produsul nu a fost găsit.')
    }

    const tenantEmbed = existing.tenants as
      | { is_association_approved: boolean; is_demo?: boolean | null }
      | { is_association_approved: boolean; is_demo?: boolean | null }[]
      | null
    const tenant = Array.isArray(tenantEmbed) ? tenantEmbed[0] : tenantEmbed
    const approved = tenant?.is_association_approved
    if (!approved || tenant?.is_demo === true) {
      return apiError(403, 'FORBIDDEN', 'Produsul nu aparține unui fermier real aprobat în asociație.')
    }

    const updatePayload: Pick<
      Database['public']['Tables']['produse']['Update'],
      'association_listed' | 'association_price' | 'updated_at'
    > = {
      updated_at: new Date().toISOString(),
    }

    if (association_listed !== undefined) {
      updatePayload.association_listed = association_listed
    }
    if (association_price !== undefined) {
      updatePayload.association_price = association_price
    }

    const { data: updated, error: upErr } = await supabase
      .from('produse')
      .update(updatePayload)
      .eq('id', productId)
      .select(
        `
        *,
        tenants ( nume_ferma, is_association_approved )
      `
      )
      .single()

    if (upErr || !updated) {
      return apiError(400, 'UPDATE_FAILED', 'Nu am putut actualiza produsul.')
    }

    const row = updated as ProduseRow & {
      tenants?:
        | { nume_ferma: string; is_association_approved: boolean }
        | { nume_ferma: string; is_association_approved: boolean }[]
        | null
    }
    const tn = row.tenants
    const embed = Array.isArray(tn) ? tn[0] : tn
    const farmName = embed?.nume_ferma ?? null
    const tenantIsAssociationApproved = embed?.is_association_approved ?? false
    const { tenants: _relation, ...rest } = row
    void _relation

    if (association_listed !== undefined && rest.tenant_id) {
      try {
        void createNotificationForTenantOwner(
          rest.tenant_id,
          association_listed ? NOTIFICATION_TYPES.product_listed : NOTIFICATION_TYPES.product_unlisted,
          association_listed ? 'Produs listat în asociație' : 'Produs retras din asociație',
          association_listed
            ? `„${rest.nume}” este vizibil în magazinul asociației.`
            : `„${rest.nume}” nu mai este listat în magazinul asociației.`,
          { productId, association_listed, nume: rest.nume, navContext: 'farmer' },
          'product',
          productId,
        )
      } catch (e) {
        console.error('[association/products] notification', e)
      }
    }

    return NextResponse.json({
      ok: true,
      data: {
        ...(rest as ProduseRow),
        farmName,
        tenantIsAssociationApproved,
      },
    })
  } catch (error) {
    captureApiError(error, {
      route: '/api/association/products',
      userId,
      tenantId: productIdForSentry,
    })
    return apiError(500, 'INTERNAL_ERROR', 'Eroare la actualizare.')
  }
}
