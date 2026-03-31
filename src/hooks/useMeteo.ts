'use client'

import { useQuery } from '@tanstack/react-query'

import { useDashboardAuth } from '@/components/app/DashboardAuthContext'
import { queryKeys } from '@/lib/query-keys'
import { getSupabase } from '@/lib/supabase/client'

const THREE_HOURS_MS = 3 * 60 * 60 * 1000

type MeteoResponse = {
  available: boolean
  /** Mesaj de la Edge Function (meteo indisponibil, API key, etc.) */
  error?: string
  source?: 'cache' | 'fresh'
  tenantId?: string
  lat?: number
  lon?: number
  fetchedAt?: string
  expiryAt?: string
  current?: {
    temp: number | null
    icon: string | null
    description: string | null
    windSpeed: number | null
    humidity: number | null
  }
  forecastTomorrow?: {
    tempMin: number | null
    tempMax: number | null
    icon: string | null
    pop: number | null
  }
  spray?: {
    canSpray: boolean
    reason?: string
  }
}

async function fetchMeteo(tenantId: string | null): Promise<MeteoResponse> {
  const supabase = getSupabase()
  const {
    data: { session },
  } = await supabase.auth.getSession()

  let resolvedTenantId = tenantId
  if (!resolvedTenantId && session?.user?.id) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('tenant_id')
      .eq('id', session.user.id)
      .maybeSingle()
    if (profile && typeof profile.tenant_id === 'string' && profile.tenant_id) {
      resolvedTenantId = profile.tenant_id
    }
  }

  const headers: Record<string, string> = {}
  if (session?.access_token) {
    headers.Authorization = `Bearer ${session.access_token}`
  }

  const body: { tenant_id?: string } = {}
  if (resolvedTenantId) {
    body.tenant_id = resolvedTenantId
  }

  const tryInvoke = async (name: 'get-meteo' | 'fetch-meteo') => {
    return supabase.functions.invoke(name, { body, headers })
  }

  const primary = await tryInvoke('fetch-meteo')
  if (!primary.error && primary.data) {
    return primary.data as MeteoResponse
  }

  const fallback = await tryInvoke('get-meteo')
  if (!fallback.error && fallback.data) {
    return fallback.data as MeteoResponse
  }

  const err = primary.error ?? fallback.error
  const msg =
    err && typeof err === 'object' && 'message' in err
      ? String((err as { message?: string }).message ?? '')
      : err
        ? String(err)
        : ''
  console.warn('[useMeteo] invoke failed', msg || err)

  return {
    available: false,
    error: msg || 'Apelul către serviciul meteo a eșuat. Verifică deploy-ul Edge Functions (fetch-meteo).',
  }
}

export function useMeteo() {
  const { tenantId } = useDashboardAuth()

  const query = useQuery({
    queryKey: [...queryKeys.meteo, tenantId],
    queryFn: () => fetchMeteo(tenantId),
    staleTime: THREE_HOURS_MS,
    gcTime: THREE_HOURS_MS,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    retry: 1,
  })

  return {
    data: query.data ?? null,
    loading: query.isLoading,
    error: query.error instanceof Error ? query.error.message : null,
    available: query.data?.available ?? false,
  }
}
