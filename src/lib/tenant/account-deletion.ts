import type { getSupabaseAdmin } from '@/lib/supabase/admin'

type Admin = ReturnType<typeof getSupabaseAdmin>

/**
 * Ferma pe care „Șterge contul” are voie s-o șteargă: DOAR una al cărei proprietar e utilizatorul.
 * Nu se folosește `getTenantIdByUserId`: pentru un operator, acela întoarce ferma proprietarului (apartenența).
 */
export async function ownedTenantIdForDeletion(admin: Admin, userId: string): Promise<string | null> {
  const { data, error } = await admin
    .from('tenants')
    .select('id')
    .eq('owner_user_id', userId)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle()
  if (error) throw error
  return data?.id ?? null
}

/** Legăturile utilizatorului cu fermele altora (`farm_members`), care se șterg odată cu contul. */
export async function deleteFarmMemberships(admin: Admin, userId: string): Promise<void> {
  const { error } = await admin
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .from('farm_members' as any)
    .delete()
    .eq('user_id', userId)
  if (error) throw error
}

/**
 * `true` doar dacă utilizatorul e proprietarul fermei. Rutele care golesc, șterg sau redenumesc ferma o cer:
 * `getTenantId*` întoarce pentru un operator ferma în care lucrează, nu una a lui.
 */
export async function isFarmOwner(admin: Admin, tenantId: string, userId: string): Promise<boolean> {
  const { data, error } = await admin
    .from('tenants')
    .select('id')
    .eq('id', tenantId)
    .eq('owner_user_id', userId)
    .maybeSingle()
  if (error) throw error
  return Boolean(data?.id)
}
