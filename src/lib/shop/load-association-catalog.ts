import { cache } from 'react'

import { getSupabaseAdmin } from '@/lib/supabase/admin'
import { normalizeOptionalText, resolveProducerLogoUrl } from '@/lib/shop/producer-media'
import type { PublicShopProduct } from '@/lib/shop/load-public-shop'

/** `produse` / join — client relaxat ca în `load-public-shop.ts`. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyAdmin = any

function parseCsvEnv(rawValue: string | undefined): string[] {
  if (!rawValue) return []
  return rawValue
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean)
}

/**
 * Email-uri permise în magazinul asociației (normalizate lowercase) — fallback de tranziție.
 * Prioritate: `ASSOCIATION_ALLOWED_EMAILS` (env, separate prin virgulă).
 * Sursa principală: `tenants.is_association_approved = true` (setat din admin).
 */
/** Exportat pentru eligibilitate magazin asociație (ex. profil producător public). */
export function getAssociationAllowedEmails(): string[] {
  return parseCsvEnv(process.env.ASSOCIATION_ALLOWED_EMAILS?.trim())
}

/**
 * Fallback recomandat pentru tranziție: allowlist explicit pe owner user IDs (UUID-uri).
 * Preferat față de email allowlist deoarece evită comparații pe identități personale.
 */
export function getAssociationAllowedOwnerUserIds(): string[] {
  return parseCsvEnv(process.env.ASSOCIATION_ALLOWED_OWNER_USER_IDS?.trim())
}

export type AssociationProduct = PublicShopProduct & {
  tenantId: string
  association_category: string | null
  createdAt: string
  orderCount: number
  farmName: string
  /** Regiune afișată opțional (v1: branding asociație). */
  farmRegion: string | null
  producerLogoUrl: string | null
  producerDescription: string | null
  producerLocation: string | null
  producerWebsite: string | null
  producerFacebook: string | null
  producerInstagram: string | null
  producerWhatsapp: string | null
  producerEmailPublic: string | null
  producerProgramPiata: string | null
  /**
   * Preț afișat și folosit la coș / checkout: `association_price` dacă e setat, altfel `pret_unitar`.
   */
  displayPrice: number
}

/**
 * Catalog public multi-fermier pentru magazinul asociației.
 * - Produse `status = activ` și `association_listed = true`
 * - Tenants cu `is_association_approved` (DB) **sau** owner în allowlist env (fallback tranziție).
 * - Preț afișat: `association_price ?? pret_unitar` (`displayPrice`).
 */
export async function loadAssociationCatalog(): Promise<AssociationProduct[]> {
  try {
    const admin = getSupabaseAdmin() as AnyAdmin
    const allowedOwnerUserIds = new Set(getAssociationAllowedOwnerUserIds())
    const allowedEmails = new Set(getAssociationAllowedEmails())

    /** Dacă migrarea `is_association_approved` nu e aplicată încă, PostgREST respinge coloana — folosim fallback. */
    let rows: {
      id: string
      owner_user_id: string | null
      is_association_approved: boolean | null
      is_demo: boolean | null
    }[]

    const withFlag = await admin
      .from('tenants')
      .select('id, owner_user_id, is_association_approved, is_demo')
    if (withFlag.error) {
      const fallback = await admin.from('tenants').select('id, owner_user_id, is_association_approved')
      if (!fallback.error) {
        rows = ((fallback.data ?? []) as {
          id: string
          owner_user_id: string | null
          is_association_approved: boolean | null
        }[]).map((t) => ({
          ...t,
          is_demo: t.id.startsWith('tenant_demo_'),
        }))
      } else {
        const legacy = await admin.from('tenants').select('id, owner_user_id')
        if (legacy.error) {
          return []
        }
        rows = ((legacy.data ?? []) as { id: string; owner_user_id: string | null }[]).map((t) => ({
          ...t,
          is_association_approved: null,
          is_demo: t.id.startsWith('tenant_demo_'),
        }))
      }
    } else {
      rows = (withFlag.data ?? []) as {
        id: string
        owner_user_id: string | null
        is_association_approved: boolean | null
        is_demo: boolean | null
      }[]
    }

    const eligibleRows = rows.filter((t) => t.is_demo !== true && !t.id.startsWith('tenant_demo_'))
    const fromDb = eligibleRows.filter((t) => t.is_association_approved === true).map((t) => t.id)

    const fromAllowlist = (
      await Promise.all(
        eligibleRows.map(async (t) => {
          if (!t.owner_user_id) return null
          if (allowedOwnerUserIds.has(t.owner_user_id.toLowerCase())) {
            return t.id
          }
          if (allowedEmails.size === 0) return null
          const { data: userData, error: userErr } = await admin.auth.admin.getUserById(t.owner_user_id)
          if (userErr || !userData.user?.email) {
            
            return null
          }
          const email = userData.user.email.trim().toLowerCase()
          if (!allowedEmails.has(email)) return null
          return t.id
        }),
      )
    ).filter((id): id is string => id != null)

    const eligibleIds = [...new Set([...fromDb, ...fromAllowlist])]

    if (eligibleIds.length === 0) return []

    const { data: prodRows, error: prodError } = await admin
      .from('produse')
      .select(
        'id,tenant_id,nume,descriere,categorie,unitate_vanzare,gramaj_per_unitate,approximate_weight,association_category,pret_unitar,moneda,poza_1_url,poza_2_url,status,created_at,association_listed,association_price,ingrediente,alergeni,conditii_pastrare,termen_valabilitate,tip_produs,assoc_ingrediente,assoc_alergeni,assoc_pastrare,assoc_valabilitate,assoc_tip_produs',
      )
      .eq('status', 'activ')
      .eq('association_listed', true)
      .in('tenant_id', eligibleIds)
      .order('nume', { ascending: true })

    if (prodError) {
      
      return []
    }

    type ProdRow = PublicShopProduct & {
      tenant_id: string
      association_price?: number | null
      association_listed?: boolean | null
      association_category?: string | null
      ingrediente?: string | null
      alergeni?: string | null
      conditii_pastrare?: string | null
      termen_valabilitate?: string | null
      tip_produs?: string | null
      assoc_ingrediente?: string | null
      assoc_alergeni?: string | null
      assoc_pastrare?: string | null
      assoc_valabilitate?: string | null
      assoc_tip_produs?: string | null
      created_at: string
    }

    const list = (prodRows ?? []) as ProdRow[]
    if (list.length === 0) return []

    const productIds = list.map((r) => r.id)
    const { data: orderRows } = await admin
      .from('comenzi')
      .select('produs_id')
      .eq('data_origin', 'magazin_asociatie')
      .in('produs_id', productIds)

    const orderCountByProduct = new Map<string, number>()
    for (const row of (orderRows ?? []) as Array<{ produs_id: string | null }>) {
      if (!row.produs_id) continue
      orderCountByProduct.set(row.produs_id, (orderCountByProduct.get(row.produs_id) ?? 0) + 1)
    }

    const tenantIds = [...new Set(list.map((r) => r.tenant_id))]
    const { data: tnames, error: nameErr } = await admin
      .from('tenants')
      .select(
        'id, nume_ferma, logo_url, descriere_publica, localitate, website, facebook, instagram, whatsapp, email_public, program_piata',
      )
      .in('id', tenantIds)

    if (nameErr) {
      
      return []
    }

    const tenantById = new Map<
      string,
      {
        name: string
        logoUrl: string | null
        description: string | null
        location: string | null
        website: string | null
        facebook: string | null
        instagram: string | null
        whatsapp: string | null
        emailPublic: string | null
        programPiata: string | null
      }
    >(
      (
        tnames as
          | {
              id: string
              nume_ferma: string
              logo_url?: string | null
              descriere_publica?: string | null
              localitate?: string | null
              website?: string | null
              facebook?: string | null
              instagram?: string | null
              whatsapp?: string | null
              email_public?: string | null
              program_piata?: string | null
            }[]
          | null
          | undefined
      )?.map((t) => [
        t.id,
        {
          name: t.nume_ferma,
          logoUrl: resolveProducerLogoUrl(admin, t.logo_url),
          description: normalizeOptionalText(t.descriere_publica),
          location: normalizeOptionalText(t.localitate),
          website: normalizeOptionalText(t.website),
          facebook: normalizeOptionalText(t.facebook),
          instagram: normalizeOptionalText(t.instagram),
          whatsapp: normalizeOptionalText(t.whatsapp),
          emailPublic: normalizeOptionalText(t.email_public),
          programPiata: normalizeOptionalText(t.program_piata),
        },
      ]) ?? [],
    )

    return list
      .map((r) => {
        const basePret = r.pret_unitar != null ? Number(r.pret_unitar) : NaN
        const displayPrice =
          r.association_price != null ? Number(r.association_price) : basePret
        if (!Number.isFinite(displayPrice) || displayPrice <= 0) return null
        const row: AssociationProduct = {
          id: r.id,
          nume: r.nume,
          descriere: r.descriere,
          categorie: r.categorie,
          unitate_vanzare: r.unitate_vanzare,
          gramaj_per_unitate: r.gramaj_per_unitate,
          approximate_weight: r.approximate_weight ?? null,
          association_category: r.association_category ?? null,
          pret_unitar: r.pret_unitar,
          moneda: r.moneda,
          poza_1_url: r.poza_1_url,
          poza_2_url: r.poza_2_url,
          createdAt: r.created_at,
          orderCount: orderCountByProduct.get(r.id) ?? 0,
          ingrediente: r.assoc_ingrediente ?? r.ingrediente ?? null,
          alergeni: r.assoc_alergeni ?? r.alergeni ?? null,
          conditii_pastrare: r.assoc_pastrare ?? r.conditii_pastrare ?? null,
          termen_valabilitate: r.assoc_valabilitate ?? r.termen_valabilitate ?? null,
          tip_produs: r.assoc_tip_produs ?? r.tip_produs ?? 'standard',
          tenantId: r.tenant_id,
          farmName: tenantById.get(r.tenant_id)?.name ?? 'Fermă',
          farmRegion: null as string | null,
          producerLogoUrl: tenantById.get(r.tenant_id)?.logoUrl ?? null,
          producerDescription: tenantById.get(r.tenant_id)?.description ?? null,
          producerLocation: tenantById.get(r.tenant_id)?.location ?? null,
          producerWebsite: tenantById.get(r.tenant_id)?.website ?? null,
          producerFacebook: tenantById.get(r.tenant_id)?.facebook ?? null,
          producerInstagram: tenantById.get(r.tenant_id)?.instagram ?? null,
          producerWhatsapp: tenantById.get(r.tenant_id)?.whatsapp ?? null,
          producerEmailPublic: tenantById.get(r.tenant_id)?.emailPublic ?? null,
          producerProgramPiata: tenantById.get(r.tenant_id)?.programPiata ?? null,
          displayPrice,
        }
        return row
      })
      .filter((p): p is AssociationProduct => p != null)
  } catch (e) {
    console.error('[loadAssociationCatalog]', e)
    return []
  }
}

export const loadAssociationCatalogCached = cache(loadAssociationCatalog)
