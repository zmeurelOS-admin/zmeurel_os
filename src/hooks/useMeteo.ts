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
    /** Intervalele de 3 ore de mâine cu furtună (cod 2xx); lipsește la răspunsurile vechi. */
    furtuni?: Array<{ ora: string; pop: number | null; cod: number | null; icon: string | null }> | null
  }
  spray?: {
    canSpray: boolean
    reason?: string
  }
  /** Următoarele 3 zile (promptul 33; după redeploy-ul `fetch-meteo`). */
  forecastZile?: Array<{ zi: string; tempMin: number | null; tempMax: number | null; ploaieMm: number | null; vantMaxKmh: number | null; icon: string | null }> | null
  /** `fara_loc` = ferma n-are loc salvat și nicio parcelă n-are coordonate. */
  motiv?: 'fara_loc'
}

interface MeteoCoords {
  lat?: number | null
  lon?: number | null
}

async function fetchMeteo(tenantId: string | null, coords?: MeteoCoords): Promise<MeteoResponse> {
  const supabase = getSupabase()
  const {
    data: { session },
  } = await supabase.auth.getSession()

  // Fără tenant din context nu-l mai căutăm aici în `profiles`: pentru un utilizator autentificat funcția
  // (`meteo-handler.ts`) îl ia singură din profil, iar `tenant_id` din corp e doar comparat cu acela.
  const resolvedTenantId = tenantId

  const headers: Record<string, string> = {}
  if (session?.access_token) {
    headers.Authorization = `Bearer ${session.access_token}`
  }

  const body: { tenant_id?: string; lat?: number; lon?: number } = {}
  if (resolvedTenantId) {
    body.tenant_id = resolvedTenantId
  }
  if (typeof coords?.lat === 'number' && Number.isFinite(coords.lat) && typeof coords?.lon === 'number' && Number.isFinite(coords.lon)) {
    body.lat = coords.lat
    body.lon = coords.lon
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
  

  return {
    available: false,
    error: msg || 'Apelul către serviciul meteo a eșuat. Verifică deploy-ul Edge Functions (fetch-meteo).',
  }
}

export function useMeteo(options?: {
  coords?: MeteoCoords
  enabled?: boolean
}) {
  const { tenantId } = useDashboardAuth()
  const lat = options?.coords?.lat ?? null
  const lon = options?.coords?.lon ?? null
  const enabled = options?.enabled ?? true

  const query = useQuery({
    queryKey: [...queryKeys.meteo, tenantId, lat, lon],
    queryFn: () => fetchMeteo(tenantId, { lat, lon }),
    staleTime: THREE_HOURS_MS,
    gcTime: THREE_HOURS_MS,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    retry: 1,
    enabled,
  })

  return {
    data: query.data ?? null,
    loading: query.isLoading,
    error: query.error instanceof Error ? query.error.message : null,
    available: query.data?.available ?? false,
  }
}
