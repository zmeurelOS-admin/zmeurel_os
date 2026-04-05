import { cache } from 'react'

import { getSupabaseAdmin } from '@/lib/supabase/admin'
import {
  getAssociationAllowedEmails,
  type AssociationProduct,
} from '@/lib/shop/load-association-catalog'
import type { PublicShopProduct } from '@/lib/shop/load-public-shop'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyAdmin = any

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export type ProducerFarmPublic = {
  numeFerma: string
  descrierePublica: string | null
  emailPublic: string | null
  facebook: string | null
  instagram: string | null
  localitate: string
  logoUrl: string | null
  specialitate: string | null
  pozeFerma: string[]
  programPiata: string | null
  website: string | null
  whatsapp: string | null
}

async function tenantEligibleForAssociationShop(
  admin: AnyAdmin,
  tenant: { id?: string; owner_user_id: string | null; is_association_approved: boolean | null; is_demo?: boolean | null }
): Promise<boolean> {
  if (tenant.is_demo === true || tenant.id?.startsWith('tenant_demo_')) return false
  if (tenant.is_association_approved === true) return true
  const allowed = new Set(getAssociationAllowedEmails().map((e) => e.toLowerCase()))
  if (!tenant.owner_user_id) return false
  const { data: userData, error } = await admin.auth.admin.getUserById(tenant.owner_user_id)
  if (error || !userData.user?.email) return false
  return allowed.has(userData.user.email.trim().toLowerCase())
}

function mapRowsToAssociationProducts(
  list: Array<
    PublicShopProduct & {
      tenant_id: string
      association_price?: number | null
      assoc_ingrediente?: string | null
      assoc_alergeni?: string | null
      assoc_pastrare?: string | null
      assoc_valabilitate?: string | null
      assoc_tip_produs?: string | null
      producer_logo_url?: string | null
    }
  >,
  farmName: string,
  producerLogoUrl: string | null
): AssociationProduct[] {
  return list
    .map((r) => {
      const basePret = r.pret_unitar != null ? Number(r.pret_unitar) : NaN
      const displayPrice =
        r.association_price != null ? Number(r.association_price) : basePret
      if (!Number.isFinite(displayPrice) || displayPrice <= 0) return null
      const product: AssociationProduct = {
        id: r.id,
        nume: r.nume,
        descriere: r.descriere,
        categorie: r.categorie,
        unitate_vanzare: r.unitate_vanzare,
        gramaj_per_unitate: r.gramaj_per_unitate,
        pret_unitar: r.pret_unitar,
        moneda: r.moneda,
        poza_1_url: r.poza_1_url,
        poza_2_url: r.poza_2_url,
        ingrediente: r.assoc_ingrediente ?? r.ingrediente ?? null,
        alergeni: r.assoc_alergeni ?? r.alergeni ?? null,
        conditii_pastrare: r.assoc_pastrare ?? r.conditii_pastrare ?? null,
        termen_valabilitate: r.assoc_valabilitate ?? r.termen_valabilitate ?? null,
        tip_produs: r.assoc_tip_produs ?? r.tip_produs ?? 'standard',
        tenantId: r.tenant_id,
        farmName,
        farmRegion: null as string | null,
        producerLogoUrl: r.producer_logo_url?.trim() || producerLogoUrl,
        producerDescription: null,
        producerLocation: null,
        producerWebsite: null,
        producerFacebook: null,
        producerInstagram: null,
        producerWhatsapp: null,
        producerEmailPublic: null,
        producerProgramPiata: null,
        displayPrice,
      }
      return product
    })
    .filter((p): p is AssociationProduct => p != null)
}

/**
 * Date pentru pagina publică de profil producător (magazin asociație).
 * Service role — fără sesiune utilizator.
 */
export async function loadProducerProfile(
  tenantId: string
): Promise<{ farm: ProducerFarmPublic; products: AssociationProduct[] } | null> {
  if (!UUID_RE.test(tenantId)) return null

  try {
    const admin = getSupabaseAdmin() as AnyAdmin

    const { data: tenant, error: tErr } = await admin
      .from('tenants')
      .select(
        'id, nume_ferma, owner_user_id, is_association_approved, is_demo, descriere_publica, poze_ferma, localitate, specialitate, logo_url, website, facebook, instagram, whatsapp, email_public, program_piata'
      )
      .eq('id', tenantId)
      .maybeSingle()

    if (tErr || !tenant) {
      return null
    }

    const row = tenant as {
      id: string
      nume_ferma: string
      owner_user_id: string | null
      is_association_approved: boolean | null
      is_demo?: boolean | null
      descriere_publica?: string | null
      email_public?: string | null
      facebook?: string | null
      instagram?: string | null
      poze_ferma?: string[] | null
      localitate?: string | null
      logo_url?: string | null
      program_piata?: string | null
      specialitate?: string | null
      website?: string | null
      whatsapp?: string | null
    }

    const eligible = await tenantEligibleForAssociationShop(admin, {
      id: row.id,
      owner_user_id: row.owner_user_id,
      is_association_approved: row.is_association_approved,
      is_demo: row.is_demo ?? false,
    })
    if (!eligible) return null

    const farmName = row.nume_ferma?.trim() || 'Fermă locală'
    const rawPoze = Array.isArray(row.poze_ferma) ? row.poze_ferma : []
    const pozeFerma = rawPoze.filter((u): u is string => typeof u === 'string' && u.trim().length > 0)

    const farm: ProducerFarmPublic = {
      numeFerma: farmName,
      descrierePublica: row.descriere_publica?.trim() || null,
      emailPublic: row.email_public?.trim() || null,
      facebook: row.facebook?.trim() || null,
      instagram: row.instagram?.trim() || null,
      localitate: (row.localitate?.trim() || 'Suceava') as string,
      logoUrl: row.logo_url?.trim() || null,
      specialitate: row.specialitate?.trim() || null,
      pozeFerma,
      programPiata: row.program_piata?.trim() || null,
      website: row.website?.trim() || null,
      whatsapp: row.whatsapp?.trim() || null,
    }

    const { data: prodRows, error: prodError } = await admin
      .from('produse')
      .select(
        'id,tenant_id,nume,descriere,categorie,unitate_vanzare,gramaj_per_unitate,pret_unitar,association_price,moneda,poza_1_url,poza_2_url,status,association_listed,ingrediente,alergeni,conditii_pastrare,termen_valabilitate,tip_produs,assoc_ingrediente,assoc_alergeni,assoc_pastrare,assoc_valabilitate,assoc_tip_produs'
      )
      .eq('tenant_id', tenantId)
      .eq('status', 'activ')
      .eq('association_listed', true)
      .order('nume', { ascending: true })

    if (prodError) {
      console.error('[loadProducerProfile] produse', prodError)
      return { farm, products: [] }
    }

    type ProdRow = PublicShopProduct & {
      tenant_id: string
      association_price?: number | null
      assoc_ingrediente?: string | null
      assoc_alergeni?: string | null
      assoc_pastrare?: string | null
      assoc_valabilitate?: string | null
      assoc_tip_produs?: string | null
    }
    const list = (prodRows ?? []) as ProdRow[]
    const products = mapRowsToAssociationProducts(list, farmName, farm.logoUrl)

    return { farm, products }
  } catch (e) {
    console.error('[loadProducerProfile]', e)
    return null
  }
}

export const loadProducerProfileCached = cache(loadProducerProfile)
