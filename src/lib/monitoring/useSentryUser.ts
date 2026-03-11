'use client'

import { useEffect } from 'react'
import { setSentryTenantTag } from '@/lib/monitoring/sentry'
import { getSupabase } from '@/lib/supabase/client'
import { getTenantIdByUserIdOrNull } from '@/lib/tenant/get-tenant'

export function useSentryUser() {
  useEffect(() => {
    const supabase = getSupabase()

    void (async () => {
      try {
        const [{ data }, Sentry] = await Promise.all([
          supabase.auth.getUser(),
          import('@sentry/nextjs'),
        ])

        if (!data?.user) return

        Sentry.setUser({
          id: data.user.id,
          email: data.user.email ?? undefined,
        })

        const tenantId = await getTenantIdByUserIdOrNull(supabase, data.user.id)
        setSentryTenantTag(tenantId)
      } catch {
        // monitoring must never affect app runtime
      }
    })()
  }, [])
}
