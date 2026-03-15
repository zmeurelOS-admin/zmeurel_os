'use client'

import type { User } from '@supabase/supabase-js'
import { useEffect } from 'react'
import { setSentryTenantTag } from '@/lib/monitoring/sentry'
import { getSupabase } from '@/lib/supabase/client'
import { getTenantIdByUserIdOrNull } from '@/lib/tenant/get-tenant'

export function useSentryUser() {
  useEffect(() => {
    const supabase = getSupabase()

    async function syncSentryUser(user: User | null) {
      try {
        const Sentry = await import('@sentry/nextjs')

        if (!user) {
          Sentry.setUser(null)
          setSentryTenantTag(null)
          return
        }

        Sentry.setUser({
          id: user.id,
          email: user.email ?? undefined,
        })

        const tenantId = await getTenantIdByUserIdOrNull(supabase, user.id)
        setSentryTenantTag(tenantId)
      } catch {
        // monitoring must never affect app runtime
      }
    }

    void supabase.auth.getUser().then(({ data }) => syncSentryUser(data.user ?? null))

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      void syncSentryUser(session?.user ?? null)
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [])
}
