'use client'

import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'

import { queryKeys } from '@/lib/query-keys'
import { getActivitatiAgricole, type ActivitateAgricola } from '@/lib/supabase/queries/activitati-agricole'
import { getAplicariTratament } from '@/lib/supabase/queries/tratamente'

import type { AplicareRow } from './model'
import { pauzeActive, type PauzaParcela } from './pauza'

const EMPTY_APLICARI: AplicareRow[] = []
const EMPTY_ACTIVITATI: ActivitateAgricola[] = []

/** Aplicările din modulul Tratamente (aceeași cheie peste tot: jurnal, Acasă, Recoltări, Mai mult). */
export function useAplicariTratament(enabled = true) {
  return useQuery({
    queryKey: queryKeys.tratamente,
    queryFn: getAplicariTratament,
    enabled,
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  })
}

/**
 * Pauzele active în ziua `ziua` (de obicei azi), din aplicările noi și activitățile vechi.
 * `ziua = null` (încă necunoscută, la prima randare pe server) → nicio pauză.
 */
export function usePauzeActive(ziua: string | null, options: { enabled?: boolean } = {}): {
  pauze: ReadonlyMap<string, PauzaParcela>
  aplicari: AplicareRow[]
  activitati: ActivitateAgricola[]
  loading: boolean
} {
  const enabled = options.enabled ?? true
  const aplicariQuery = useAplicariTratament(enabled)
  const activitatiQuery = useQuery({
    queryKey: queryKeys.activitati,
    queryFn: getActivitatiAgricole,
    enabled,
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  })
  const aplicari = aplicariQuery.data ?? EMPTY_APLICARI
  const activitati = activitatiQuery.data ?? EMPTY_ACTIVITATI
  const pauze = useMemo(
    () => (ziua ? pauzeActive({ aplicari, activitati, ziua }) : new Map<string, PauzaParcela>()),
    [aplicari, activitati, ziua],
  )
  return { pauze, aplicari, activitati, loading: aplicariQuery.isLoading || activitatiQuery.isLoading }
}
