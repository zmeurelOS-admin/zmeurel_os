import { cache } from 'react'

import { getSupabaseAdmin } from '@/lib/supabase/admin'
import type { PublicShopProduct } from '@/lib/shop/load-public-shop'

/** `produse` / join — client relaxat ca în `load-public-shop.ts`. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyAdmin = any

/** Fallback când lipsește `process.env.ASSOCIATION_ALLOWED_EMAILS`. */
const DEFAULT_ASSOCIATION_ALLOWED_EMAILS = ['popa.andrei.sv@gmail.com'] as const

/**
 * Email-uri permise în magazinul asociației (normalizate lowercase) — fallback de tranziție.
 * Prioritate: `ASSOCIATION_ALLOWED_EMAILS` (env, separate prin virgulă) → constanta de mai sus.
 * Sursa principală: `tenants.is_association_approved = true` (setat din admin).
 */
/** Exportat pentru eligibilitate magazin asociație (ex. profil producător public). */
export function getAssociationAllowedEmails(): string[] {
  const raw = process.env.ASSOCIATION_ALLOWED_EMAILS?.trim()
  if (raw) {
    const fromEnv = raw
      .split(',')
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean)
    if (fromEnv.length > 0) return fromEnv
  }
  return [...DEFAULT_ASSOCIATION_ALLOWED_EMAILS]
}

export type AssociationProduct = PublicShopProduct & {
  tenantId: string
  farmName: string
  /** Regiune afișată opțional (v1: branding asociație). */
  farmRegion: string | null
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
    const allowed = new Set(getAssociationAllowedEmails())

    /** Dacă migrarea `is_association_approved` nu e aplicată încă, PostgREST respinge coloana — folosim fallback. */
    let rows: {
      id: string
      owner_user_id: string | null
      is_association_approved: boolean | null
    }[]

    const withFlag = await admin.from('tenants').select('id, owner_user_id, is_association_approved')
    if (withFlag.error) {
      const legacy = await admin.from('tenants').select('id, owner_user_id')
      if (legacy.error) {
        const e = legacy.error as { message?: string; code?: string; details?: string }
        console.error(
          '[loadAssociationCatalog] tenants',
          e.code ?? '',
          e.message ?? '',
          e.details ?? '',
        )
        return []
      }
      rows = ((legacy.data ?? []) as { id: string; owner_user_id: string | null }[]).map((t) => ({
        ...t,
        is_association_approved: null,
      }))
    } else {
      rows = (withFlag.data ?? []) as {
        id: string
        owner_user_id: string | null
        is_association_approved: boolean | null
      }[]
    }

    const fromDb = rows.filter((t) => t.is_association_approved === true).map((t) => t.id)

    const fromAllowlist = (
      await Promise.all(
        rows.map(async (t) => {
          if (!t.owner_user_id) return null
          const { data: userData, error: userErr } = await admin.auth.admin.getUserById(t.owner_user_id)
          if (userErr || !userData.user?.email) {
            if (userErr) console.warn('[loadAssociationCatalog] getUserById', t.id, userErr.message)
            return null
          }
          const email = userData.user.email.trim().toLowerCase()
          if (!allowed.has(email)) return null
          return t.id
        }),
      )
    ).filter((id): id is string => id != null)

    const eligibleIds = [...new Set([...fromDb, ...fromAllowlist])]

    if (eligibleIds.length === 0) return []

    const { data: prodRows, error: prodError } = await admin
      .from('produse')
      .select(
        'id,tenant_id,nume,descriere,categorie,unitate_vanzare,gramaj_per_unitate,pret_unitar,association_price,moneda,poza_1_url,poza_2_url,status,association_listed,ingrediente,alergeni,conditii_pastrare,termen_valabilitate,tip_produs',
      )
      .eq('status', 'activ')
      .eq('association_listed', true)
      .in('tenant_id', eligibleIds)
      .order('nume', { ascending: true })

    if (prodError) {
      console.error('[loadAssociationCatalog] produse', prodError)
      return []
    }

    type ProdRow = PublicShopProduct & {
      tenant_id: string
      association_price?: number | null
      association_listed?: boolean | null
      ingrediente?: string | null
      alergeni?: string | null
      conditii_pastrare?: string | null
      termen_valabilitate?: string | null
      tip_produs?: string | null
    }

    const list = (prodRows ?? []) as ProdRow[]
    if (list.length === 0) return []

    const tenantIds = [...new Set(list.map((r) => r.tenant_id))]
    const { data: tnames, error: nameErr } = await admin
      .from('tenants')
      .select('id, nume_ferma')
      .in('id', tenantIds)

    if (nameErr) {
      console.error('[loadAssociationCatalog] tenant names', nameErr)
      return []
    }

    const nameById = new Map<string, string>(
      (tnames as { id: string; nume_ferma: string }[] | null | undefined)?.map((t) => [t.id, t.nume_ferma]) ?? [],
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
          pret_unitar: r.pret_unitar,
          moneda: r.moneda,
          poza_1_url: r.poza_1_url,
          poza_2_url: r.poza_2_url,
          ingrediente: r.ingrediente ?? null,
          alergeni: r.alergeni ?? null,
          conditii_pastrare: r.conditii_pastrare ?? null,
          termen_valabilitate: r.termen_valabilitate ?? null,
          tip_produs: r.tip_produs ?? 'standard',
          tenantId: r.tenant_id,
          farmName: nameById.get(r.tenant_id) ?? 'Fermă',
          farmRegion: null as string | null,
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
