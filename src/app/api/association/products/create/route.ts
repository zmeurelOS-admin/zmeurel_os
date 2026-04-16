import { NextResponse } from 'next/server'
import { z } from 'zod'

import { apiError, validateSameOriginMutation } from '@/lib/api/route-security'
import { getAssociationRole } from '@/lib/association/auth'
import { captureApiError } from '@/lib/monitoring/sentry'
import { getSupabaseAdmin } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import type { Database } from '@/types/supabase'

export const runtime = 'nodejs'

const CATEGORII_PRODUSE = ['fruct', 'leguma', 'procesat', 'altele'] as const
const UNITATI_VANZARE = [
  'kg',
  'kilogram',
  'buc',
  'ladă',
  'casoletă',
  'palet',
  'cutie',
  'borcan',
  'pachet',
  'pungă',
  'sticlă',
] as const

const ASSOCIATION_CATEGORY_BY_PRODUCT_CATEGORY: Record<(typeof CATEGORII_PRODUSE)[number], string> = {
  fruct: 'fructe_legume',
  leguma: 'fructe_legume',
  procesat: 'altele',
  altele: 'altele',
}

const bodySchema = z.object({
  tenant_id: z.string().uuid(),
  nume: z.string().trim().min(1).max(200),
  categorie: z.enum(CATEGORII_PRODUSE),
  pret_unitar: z.number().positive(),
  unitate_vanzare: z.enum(UNITATI_VANZARE),
  descriere: z.string().trim().max(4000).optional().nullable(),
  association_price: z.number().positive().optional().nullable(),
  association_listed: z.boolean().optional(),
})

type ProduseRow = Database['public']['Tables']['produse']['Row']

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
      return apiError(403, 'FORBIDDEN', 'Doar administratorii și moderatorii pot adăuga produse.')
    }

    const parsed = bodySchema.safeParse(await request.json())
    if (!parsed.success) {
      return apiError(400, 'INVALID_BODY', 'Date invalide.')
    }

    const {
      tenant_id,
      nume,
      categorie,
      pret_unitar,
      unitate_vanzare,
      descriere,
      association_price,
      association_listed,
    } = parsed.data
    tenantIdForSentry = tenant_id

    const { data: tenant, error: tenantError } = await supabase
      .from('tenants')
      .select('id, owner_user_id, nume_ferma, is_association_approved, is_demo')
      .eq('id', tenant_id)
      .maybeSingle()

    if (tenantError || !tenant) {
      return apiError(404, 'TENANT_NOT_FOUND', 'Fermierul nu a fost găsit.')
    }

    if (!tenant.is_association_approved || tenant.is_demo === true) {
      return apiError(403, 'TENANT_NOT_APPROVED', 'Poți adăuga produse doar pentru fermieri aprobați ai asociației.')
    }

    // Verificare cross-asociație: RLS filtrează association_members
    // la asociația staff-ului curent, deci dacă owner_user_id nu e
    // member al asociației noastre, associationMembership va fi null → 403
    const { data: associationMembership, error: membershipError } = await supabase
      .from('association_members')
      .select('id')
      .eq('user_id', tenant.owner_user_id ?? '')
      .maybeSingle()

    if (membershipError || !associationMembership) {
      return NextResponse.json({ error: 'Fermierul nu aparține asociației tale.' }, { status: 403 })
    }

    const { data: legalDocsComplete, error: legalError } = await supabase.rpc('is_legal_docs_complete', {
      p_tenant_id: tenant_id,
    })

    if (legalError) {
      return apiError(400, 'LEGAL_DOCS_CHECK_FAILED', 'Nu am putut verifica documentele legale ale fermierului.')
    }

    if (legalDocsComplete !== true) {
      return apiError(403, 'LEGAL_DOCS_INCOMPLETE', 'Fermierul nu are documentele legale complete pentru publicare.')
    }

    const admin = getSupabaseAdmin()
    const listed = association_listed === true

    const insertPayload: Database['public']['Tables']['produse']['Insert'] = {
      tenant_id,
      nume,
      descriere: descriere?.trim() || null,
      categorie,
      pret_unitar,
      unitate_vanzare,
      moneda: 'RON',
      status: 'activ',
      association_price: association_price ?? null,
      association_listed: listed,
      association_category: listed ? ASSOCIATION_CATEGORY_BY_PRODUCT_CATEGORY[categorie] : null,
      // TODO: decidere dacă produsul creat de asociație apare și în ERP-ul fermierului
    }

    const { data: created, error: createError } = await admin
      .from('produse')
      .insert(insertPayload)
      .select(
        `
        *,
        tenants (
          nume_ferma,
          is_association_approved
        )
      `,
      )
      .single()

    if (createError || !created) {
      return apiError(400, 'CREATE_FAILED', 'Nu am putut crea produsul.')
    }

    const row = created as ProduseRow & {
      assoc_ingrediente?: string | null
      assoc_alergeni?: string | null
      assoc_pastrare?: string | null
      assoc_valabilitate?: string | null
      assoc_tip_produs?: 'standard' | 'bio' | 'traditional' | 'ecologic' | null
      tenants?:
        | { nume_ferma: string | null; is_association_approved: boolean | null }
        | Array<{ nume_ferma: string | null; is_association_approved: boolean | null }>
        | null
    }
    const tenantEmbed = Array.isArray(row.tenants) ? row.tenants[0] : row.tenants
    const { tenants: _tenantRelation, ...rest } = row
    void _tenantRelation

    return NextResponse.json({
      ok: true,
      data: {
        ...(rest as ProduseRow),
        assoc_ingrediente: row.assoc_ingrediente ?? null,
        assoc_alergeni: row.assoc_alergeni ?? null,
        assoc_pastrare: row.assoc_pastrare ?? null,
        assoc_valabilitate: row.assoc_valabilitate ?? null,
        assoc_tip_produs: row.assoc_tip_produs ?? null,
        farmName: tenantEmbed?.nume_ferma ?? tenant.nume_ferma ?? null,
        tenantIsAssociationApproved: tenantEmbed?.is_association_approved ?? tenant.is_association_approved ?? false,
      },
    })
  } catch (error) {
    captureApiError(error, {
      route: '/api/association/products/create',
      userId,
      tenantId: tenantIdForSentry,
    })
    return apiError(500, 'INTERNAL_ERROR', 'Eroare la creare.')
  }
}
