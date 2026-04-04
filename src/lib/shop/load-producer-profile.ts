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
  localitate: string
  specialitate: string | null
  pozeFerma: string[]
}

async function tenantEligibleForAssociationShop(
  admin: AnyAdmin,
  tenant: { owner_user_id: string | null; is_association_approved: boolean | null }
): Promise<boolean> {
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
    }
  >,
  farmName: string
): AssociationProduct[] {
  return list
    .map((r) => {
      const basePret = r.pret_unitar != null ? Number(r.pret_unitar) : NaN
      const displayPrice =
        r.association_price != null ? Number(r.association_price) : basePret
      if (!Number.isFinite(displayPrice) || displayPrice <= 0) return null
      return {
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
        tenantId: r.tenant_id,
        farmName,
        farmRegion: null as string | null,
        displayPrice,
      }
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
        'id, nume_ferma, owner_user_id, is_association_approved, descriere_publica, poze_ferma, localitate, specialitate'
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
      descriere_publica?: string | null
      poze_ferma?: string[] | null
      localitate?: string | null
      specialitate?: string | null
    }

    const eligible = await tenantEligibleForAssociationShop(admin, {
      owner_user_id: row.owner_user_id,
      is_association_approved: row.is_association_approved,
    })
    if (!eligible) return null

    const farmName = row.nume_ferma?.trim() || 'Fermă locală'
    const rawPoze = Array.isArray(row.poze_ferma) ? row.poze_ferma : []
    const pozeFerma = rawPoze.filter((u): u is string => typeof u === 'string' && u.trim().length > 0)

    const farm: ProducerFarmPublic = {
      numeFerma: farmName,
      descrierePublica: row.descriere_publica?.trim() || null,
      localitate: (row.localitate?.trim() || 'Suceava') as string,
      specialitate: row.specialitate?.trim() || null,
      pozeFerma,
    }

    const { data: prodRows, error: prodError } = await admin
      .from('produse')
      .select(
        'id,tenant_id,nume,descriere,categorie,unitate_vanzare,gramaj_per_unitate,pret_unitar,association_price,moneda,poza_1_url,poza_2_url,status,association_listed'
      )
      .eq('tenant_id', tenantId)
      .eq('status', 'activ')
      .eq('association_listed', true)
      .order('nume', { ascending: true })

    if (prodError) {
      console.error('[loadProducerProfile] produse', prodError)
      return { farm, products: [] }
    }

    type ProdRow = PublicShopProduct & { tenant_id: string; association_price?: number | null }
    const list = (prodRows ?? []) as ProdRow[]
    const products = mapRowsToAssociationProducts(list, farmName)

    return { farm, products }
  } catch (e) {
    console.error('[loadProducerProfile]', e)
    return null
  }
}

export const loadProducerProfileCached = cache(loadProducerProfile)
