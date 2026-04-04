import type { AssociationRole } from '@/lib/association/auth'
import { getSupabaseAdmin } from '@/lib/supabase/admin'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyAdmin = any

/** Rol în `association_members` pentru un user (service role). */
export async function getAssociationRoleForUserId(userId: string): Promise<AssociationRole | null> {
  try {
    const admin = getSupabaseAdmin() as AnyAdmin
    const { data, error } = await admin
      .from('association_members')
      .select('role')
      .eq('user_id', userId)
      .maybeSingle()

    if (error || !data?.role) return null
    const r = data.role as string
    if (r === 'admin' || r === 'moderator' || r === 'viewer') {
      return r as AssociationRole
    }
    return null
  } catch {
    return null
  }
}
