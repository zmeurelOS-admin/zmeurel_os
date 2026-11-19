import { createClient } from '@/lib/supabase/server'

import { createOptimizeHandler } from './optimize-handler'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export const POST = createOptimizeHandler({
  getUserId: async () => {
    const supabase = await createClient()
    const { data } = await supabase.auth.getUser()
    return data.user?.id ?? null
  },
  // Citite la fiecare cerere, doar pe server.
  getApiKey: () => process.env.ORS_API_KEY,
  getServiceUrl: () => process.env.ORS_OPTIMIZATION_URL,
  fetchImpl: (...args) => fetch(...args),
})
