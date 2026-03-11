import type { SupabaseClient } from '@supabase/supabase-js'

import type { Database } from '@/types/supabase'

export async function isSuperAdmin(
  supabase: SupabaseClient<Database>,
  userId?: string | null
): Promise<boolean> {
  let resolvedUserId = userId ?? null

  if (!resolvedUserId) {
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser()

    if (error || !user?.id) {
      return false
    }

    resolvedUserId = user.id
  }

  const { data, error } = await supabase
    .from('profiles')
    .select('is_superadmin')
    .eq('id', resolvedUserId)
    .maybeSingle()

  if (error) {
    return false
  }

  if (!data) {
    return false
  }

  return Boolean(data.is_superadmin)
}
