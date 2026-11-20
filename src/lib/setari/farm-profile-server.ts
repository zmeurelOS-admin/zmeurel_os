import 'server-only'

import { createClient } from '@/lib/supabase/server'
import { getTenantIdOrNull } from '@/lib/tenant/get-tenant'

export type FarmProfile = {
  tenantId: string
  numeFerma: string
  localitate: string | null
  contactPhone: string | null
  plan: string | null
}

/**
 * Datele fermei pentru Mai mult și Setări (cardul fermei, rândul „Ferma”).
 * Nu aruncă: fără fermă sau la eroare întoarce `null` (paginile merg mai departe cu ce au).
 */
export async function getFarmProfileOrNull(): Promise<FarmProfile | null> {
  try {
    const supabase = await createClient()
    const tenantId = await getTenantIdOrNull(supabase)
    if (!tenantId) return null
    const { data, error } = await supabase
      .from('tenants')
      .select('id, nume_ferma, localitate, contact_phone, plan')
      .eq('id', tenantId)
      .maybeSingle()
    if (error || !data) return null
    return {
      tenantId: data.id,
      numeFerma: data.nume_ferma,
      localitate: data.localitate?.trim() || null,
      contactPhone: data.contact_phone?.trim() || null,
      plan: data.plan,
    }
  } catch (error) {
    console.error('[setari] datele fermei nu s-au putut citi', error)
    return null
  }
}
