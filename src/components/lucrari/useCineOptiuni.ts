'use client'

import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'

import { useDashboardAuth } from '@/components/app/DashboardAuthContext'
import { CINE_PROPRIETAR } from '@/lib/lucrari/formular'
import { queryKeys } from '@/lib/query-keys'
import { getCulegatori } from '@/lib/supabase/queries/culegatori'

export interface CineOptiune {
  /** Ce se scrie în `operator`. */
  value: string
  /** Ce vede omul pe pastilă. */
  label: string
}

/**
 * Cine poate face o lucrare: proprietarul („Tu”, doar pentru proprietar), membrii echipei (lista o vede
 * doar proprietarul) și culegătorii activi. „Cine” rămâne opțional și se poate scrie și alt nume.
 */
export function useCineOptiuni(enabled: boolean): { optiuni: CineOptiune[]; vedeProprietarul: boolean } {
  const { memberRole } = useDashboardAuth()
  const vedeProprietarul = memberRole !== 'operator'

  const culegatori = useQuery({
    queryKey: queryKeys.culegatori,
    queryFn: getCulegatori,
    enabled,
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  })
  const membri = useQuery({
    queryKey: ['farm-members', 'nume'],
    enabled: enabled && vedeProprietarul,
    staleTime: 5 * 60_000,
    refetchOnWindowFocus: false,
    retry: false,
    queryFn: async (): Promise<string[]> => {
      const res = await fetch('/api/farm-members', { credentials: 'same-origin' })
      if (!res.ok) return []
      const body = (await res.json().catch(() => null)) as { members?: Array<{ name?: string | null; role?: string }> } | null
      return (body?.members ?? [])
        .filter((member) => member.role !== 'livrator')
        .map((member) => member.name?.trim() ?? '')
        .filter(Boolean)
    },
  })

  const optiuni = useMemo(() => {
    const result: CineOptiune[] = []
    const vazute = new Set<string>()
    const adauga = (value: string, label = value) => {
      const key = value.trim().toLocaleLowerCase('ro-RO')
      if (!key || vazute.has(key)) return
      vazute.add(key)
      result.push({ value: value.trim(), label })
    }
    if (vedeProprietarul) adauga(CINE_PROPRIETAR, 'Tu')
    for (const nume of membri.data ?? []) adauga(nume)
    for (const culegator of culegatori.data ?? []) {
      if (culegator.status_activ === false) continue
      adauga(culegator.nume_prenume ?? '')
    }
    return result
  }, [culegatori.data, membri.data, vedeProprietarul])

  return { optiuni, vedeProprietarul }
}
