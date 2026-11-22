'use client'

import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'

import { queryKeys } from '@/lib/query-keys'
import { getDateCules } from '@/lib/supabase/queries/analize'
import { getParcele } from '@/lib/supabase/queries/parcele'
import { getRecoltari } from '@/lib/supabase/queries/recoltari'

import { estimeazaCules, type EstimareCules } from './cules'
import { esteParcelaDeVanzare } from './model'

/**
 * Când începe culesul pe fiecare parcelă de vânzare (lista de parcele): aceleași interogări (și cache) ca
 * `useMementoAnalize`, fără analize și fără memento. `gata = false` până se încarcă tot, ca eticheta
 * „fără dată de cules” să nu clipească.
 */
export function useEstimariCules(azi: string | null): { gata: boolean; estimari: Map<string, EstimareCules> } {
  const enabled = Boolean(azi)
  const an = azi ? Number(azi.slice(0, 4)) : new Date().getFullYear()
  const parceleQuery = useQuery({ queryKey: queryKeys.parcele, queryFn: getParcele, staleTime: 30_000, enabled })
  const recoltariQuery = useQuery({ queryKey: queryKeys.recoltari, queryFn: getRecoltari, staleTime: 30_000, enabled })
  const culesQuery = useQuery({ queryKey: queryKeys.culesSezon(an), queryFn: () => getDateCules(an), staleTime: 60_000, enabled })

  return useMemo(() => {
    const estimari = new Map<string, EstimareCules>()
    const gata = parceleQuery.isSuccess && recoltariQuery.isSuccess && culesQuery.isSuccess
    if (!gata) return { gata, estimari }
    const manuale = culesQuery.data?.date ?? {}
    for (const parcela of (parceleQuery.data ?? []).filter(esteParcelaDeVanzare)) {
      estimari.set(parcela.id, estimeazaCules({ parcelaId: parcela.id, an, manual: manuale[parcela.id] ?? null, recoltari: recoltariQuery.data ?? [] }))
    }
    return { gata, estimari }
  }, [an, culesQuery.data, culesQuery.isSuccess, parceleQuery.data, parceleQuery.isSuccess, recoltariQuery.data, recoltariQuery.isSuccess])
}
