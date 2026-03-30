'use client'

import { useQuery } from '@tanstack/react-query'

import { queryKeys } from '@/lib/query-keys'
import { getSupabase } from '@/lib/supabase/client'

const THREE_HOURS_MS = 3 * 60 * 60 * 1000

type MeteoResponse = {
  available: boolean
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

async function fetchMeteo(): Promise<MeteoResponse> {
  const supabase = getSupabase()
  const { data, error } = await supabase.functions.invoke('fetch-meteo', {
    body: {},
  })

  if (error) {
    throw new Error(error.message || 'Nu am putut încărca datele meteo.')
  }

  return (data ?? { available: false }) as MeteoResponse
}

export function useMeteo() {
  const query = useQuery({
    queryKey: queryKeys.meteo,
    queryFn: fetchMeteo,
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
