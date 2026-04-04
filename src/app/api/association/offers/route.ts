import { NextResponse } from 'next/server'
import { z } from 'zod'

import { apiError, validateSameOriginMutation } from '@/lib/api/route-security'
import { getAssociationRole } from '@/lib/association/auth'
import { captureApiError } from '@/lib/monitoring/sentry'
import {
  createNotification,
  createNotificationsForAssociationAdmins,
  NOTIFICATION_TYPES,
} from '@/lib/notifications/create'
import { createClient } from '@/lib/supabase/server'
import { getTenantIdByUserId } from '@/lib/tenant/get-tenant'

export const runtime = 'nodejs'

const postSchema = z.object({
  productId: z.string().uuid(),
  suggestedPrice: z.number().nonnegative().optional(),
  message: z.string().max(2000).optional().nullable(),
})

const patchSchema = z.object({
  offerId: z.string().uuid(),
  action: z.enum(['aproba', 'respinge']),
  reviewNote: z.string().max(2000).optional().nullable(),
  /** Preț final în magazinul asociației (opțional la aprobare). */
  finalPrice: z.number().nonnegative().optional().nullable(),
})

const deleteBodySchema = z.object({
  offerId: z.string().uuid(),
})

export async function GET(request: Request) {
  let userId: string | null = null
  try {
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
    if (!role) {
      return apiError(403, 'FORBIDDEN', 'Acces doar pentru membrii asociației.')
    }

    const url = new URL(request.url)
    if (url.searchParams.get('countOnly') === '1') {
      const { count, error } = await supabase
        .from('association_product_offers')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'trimisa')
      if (error) {
        return apiError(500, 'COUNT_FAILED', 'Nu am putut număra ofertele.')
      }
      return NextResponse.json({ ok: true, data: { pendingCount: count ?? 0 } })
    }

    const { data, error } = await supabase
      .from('association_product_offers')
      .select(
        `
        id,
        product_id,
        tenant_id,
        offered_by,
        status,
        suggested_price,
        message,
        review_note,
        reviewed_at,
        created_at,
        produse ( id, nume, categorie, pret_unitar, unitate_vanzare, moneda, status ),
        tenants ( id, nume_ferma )
      `
      )
      .order('created_at', { ascending: false })

    if (error) {
      return apiError(500, 'FETCH_FAILED', 'Nu am putut încărca ofertele.')
    }

    return NextResponse.json({ ok: true, data: { offers: data ?? [] } })
  } catch (error) {
    captureApiError(error, { route: '/api/association/offers', userId, tags: { http_method: 'GET' } })
    return apiError(500, 'INTERNAL_ERROR', 'Eroare la încărcare.')
  }
}

export async function POST(request: Request) {
  let userId: string | null = null
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

    const json = await request.json()
    const parsed = postSchema.safeParse(json)
    if (!parsed.success) {
      return apiError(400, 'INVALID_BODY', 'Date invalide.')
    }

    const { productId, suggestedPrice, message } = parsed.data
    const tenantId = await getTenantIdByUserId(supabase, user.id)

    const { data: tenant, error: tenantErr } = await supabase
      .from('tenants')
      .select('id, nume_ferma, is_association_approved')
      .eq('id', tenantId)
      .maybeSingle()

    if (tenantErr || !tenant) {
      return apiError(400, 'TENANT', 'Tenant indisponibil.')
    }

    if (!tenant.is_association_approved) {
      return apiError(
        403,
        'NOT_APPROVED',
        'Ferma ta nu este aprobată pentru magazinul asociației. Contactează echipa Gustă din Bucovina.',
      )
    }

    const { data: product, error: prodErr } = await supabase
      .from('produse')
      .select('id, tenant_id, nume, status, pret_unitar')
      .eq('id', productId)
      .maybeSingle()

    if (prodErr || !product) {
      return apiError(404, 'NOT_FOUND', 'Produsul nu a fost găsit.')
    }

    if (product.tenant_id !== tenantId) {
      return apiError(403, 'FORBIDDEN', 'Produsul nu aparține fermei tale.')
    }

    if (product.status !== 'activ') {
      return apiError(400, 'NOT_ACTIVE', 'Poți trimite oferte doar pentru produse active.')
    }

    const { data: pending, error: pendErr } = await supabase
      .from('association_product_offers')
      .select('id')
      .eq('product_id', productId)
      .eq('status', 'trimisa')
      .maybeSingle()

    if (pendErr) {
      return apiError(400, 'CHECK_FAILED', 'Nu am putut verifica ofertele existente.')
    }

    if (pending) {
      return apiError(409, 'PENDING_OFFER', 'Există deja o ofertă în așteptare pentru acest produs.')
    }

    const { data: inserted, error: insErr } = await supabase
      .from('association_product_offers')
      .insert({
        product_id: productId,
        tenant_id: tenantId,
        offered_by: user.id,
        status: 'trimisa',
        suggested_price: suggestedPrice ?? null,
        message: message ?? null,
      })
      .select(
        'id, product_id, tenant_id, offered_by, status, suggested_price, message, created_at, updated_at'
      )
      .single()

    if (insErr || !inserted) {
      return apiError(400, 'INSERT_FAILED', 'Nu am putut crea oferta.')
    }

    const farmName = tenant.nume_ferma?.trim() || 'O fermă'
    const productName = product.nume?.trim() || 'Produs'

    void createNotificationsForAssociationAdmins(
      NOTIFICATION_TYPES.offer_new,
      'Ofertă nouă',
      `${farmName} oferă ${productName}.`,
      {
        offerId: inserted.id,
        productId,
        tenantId,
      },
      'association_product_offer',
      inserted.id as string
    )

    return NextResponse.json({ ok: true, data: { offer: inserted } })
  } catch (error) {
    captureApiError(error, { route: '/api/association/offers', userId, tags: { http_method: 'POST' } })
    return apiError(500, 'INTERNAL_ERROR', 'Eroare la trimiterea ofertei.')
  }
}

export async function PATCH(request: Request) {
  let userId: string | null = null
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
      return apiError(403, 'FORBIDDEN', 'Doar administratorii și moderatorii pot revizui ofertele.')
    }

    const json = await request.json()
    const parsed = patchSchema.safeParse(json)
    if (!parsed.success) {
      return apiError(400, 'INVALID_BODY', 'Date invalide.')
    }

    const { offerId, action, reviewNote, finalPrice } = parsed.data

    const { data: offer, error: fetchErr } = await supabase
      .from('association_product_offers')
      .select(
        `
        id,
        product_id,
        tenant_id,
        offered_by,
        status,
        suggested_price,
        message,
        produse ( id, nume, pret_unitar, status )
      `
      )
      .eq('id', offerId)
      .maybeSingle()

    if (fetchErr || !offer) {
      return apiError(404, 'NOT_FOUND', 'Oferta nu a fost găsită.')
    }

    const row = offer as {
      id: string
      product_id: string
      tenant_id: string
      offered_by: string
      status: string
      suggested_price: number | null
      produse:
        | { id: string; nume: string; pret_unitar: number | null; status: string }
        | { id: string; nume: string; pret_unitar: number | null; status: string }[]
        | null
    }

    if (row.status !== 'trimisa') {
      return apiError(400, 'INVALID_STATUS', 'Oferta nu mai este în așteptare.')
    }

    const prodEmbed = row.produse
    const prod = Array.isArray(prodEmbed) ? prodEmbed[0] : prodEmbed
    const productName = prod?.nume?.trim() || 'Produsul tău'
    const nowIso = new Date().toISOString()

    if (action === 'respinge') {
      const { data: updated, error: upErr } = await supabase
        .from('association_product_offers')
        .update({
          status: 'respinsa',
          reviewed_by: user.id,
          reviewed_at: nowIso,
          review_note: reviewNote ?? null,
        })
        .eq('id', offerId)
        .select()
        .single()

      if (upErr || !updated) {
        return apiError(400, 'UPDATE_FAILED', 'Nu am putut respinge oferta.')
      }

      const bodyText =
        reviewNote?.trim() ||
        'Oferta ta a fost analizată și nu a fost acceptată pentru listare în acest moment.'

      void createNotification(
        row.offered_by,
        NOTIFICATION_TYPES.offer_rejected,
        'Oferta ta a fost respinsă',
        bodyText,
        { offerId, productId: row.product_id },
        'association_product_offer',
        offerId
      )

      return NextResponse.json({ ok: true, data: { offer: updated } })
    }

    const priceForShop =
      finalPrice != null && finalPrice !== undefined
        ? finalPrice
        : row.suggested_price != null
          ? Number(row.suggested_price)
          : prod?.pret_unitar != null
            ? Number(prod.pret_unitar)
            : null

    const { data: offerUpdated, error: offerUpErr } = await supabase
      .from('association_product_offers')
      .update({
        status: 'aprobata',
        reviewed_by: user.id,
        reviewed_at: nowIso,
        review_note: reviewNote ?? null,
      })
      .eq('id', offerId)
      .select()
      .single()

    if (offerUpErr || !offerUpdated) {
      return apiError(400, 'UPDATE_FAILED', 'Nu am putut aproba oferta.')
    }

    const prodUpdate: Record<string, unknown> = {
      association_listed: true,
      updated_at: nowIso,
    }
    if (priceForShop != null && !Number.isNaN(priceForShop)) {
      prodUpdate.association_price = priceForShop
    }

    const { error: pErr } = await supabase.from('produse').update(prodUpdate).eq('id', row.product_id)

    if (pErr) {
      return apiError(400, 'PRODUCT_UPDATE_FAILED', 'Oferta e aprobată, dar nu am putut actualiza produsul.')
    }

    void createNotification(
      row.offered_by,
      NOTIFICATION_TYPES.offer_approved,
      'Oferta ta a fost aprobată',
      `${productName} este acum listat în magazinul asociației.`,
      { offerId, productId: row.product_id },
      'association_product_offer',
      offerId
    )

    return NextResponse.json({ ok: true, data: { offer: offerUpdated } })
  } catch (error) {
    captureApiError(error, { route: '/api/association/offers', userId, tags: { http_method: 'PATCH' } })
    return apiError(500, 'INTERNAL_ERROR', 'Eroare la actualizarea ofertei.')
  }
}

export async function DELETE(request: Request) {
  let userId: string | null = null
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

    const json = await request.json()
    const parsed = deleteBodySchema.safeParse(json)
    if (!parsed.success) {
      return apiError(400, 'INVALID_BODY', 'Date invalide.')
    }

    const { offerId } = parsed.data
    const tenantId = await getTenantIdByUserId(supabase, user.id)

    const { data: offer, error: fetchErr } = await supabase
      .from('association_product_offers')
      .select('id, tenant_id, status')
      .eq('id', offerId)
      .maybeSingle()

    if (fetchErr || !offer) {
      return apiError(404, 'NOT_FOUND', 'Oferta nu a fost găsită.')
    }

    const o = offer as { id: string; tenant_id: string; status: string }
    if (o.tenant_id !== tenantId) {
      return apiError(403, 'FORBIDDEN', 'Nu poți modifica această ofertă.')
    }

    if (o.status !== 'trimisa') {
      return apiError(400, 'INVALID_STATUS', 'Poți retrage doar oferte în așteptare.')
    }

    const { error: upErr } = await supabase
      .from('association_product_offers')
      .update({ status: 'retrasa' })
      .eq('id', offerId)

    if (upErr) {
      return apiError(400, 'UPDATE_FAILED', 'Nu am putut retrage oferta.')
    }

    return NextResponse.json({ ok: true, data: { success: true } })
  } catch (error) {
    captureApiError(error, { route: '/api/association/offers', userId, tags: { http_method: 'DELETE' } })
    return apiError(500, 'INTERNAL_ERROR', 'Eroare la retragere.')
  }
}
