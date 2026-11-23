'use client'

import { useMemo } from 'react'
import { useQuery, type UseQueryResult } from '@tanstack/react-query'

import { culturileFermei, type CulturaFerma } from '@/lib/parcele/culturi-ferma'
import { queryKeys } from '@/lib/query-keys'
import { etichetaStocFerma, stocPeCultura, type StocCultura } from '@/lib/stocuri/pe-cultura'
import { getSellableCal1StockSummary } from '@/lib/supabase/queries/miscari-stoc'
import { getParcele } from '@/lib/supabase/queries/parcele'
import { getStocCal1PeCultura } from '@/lib/supabase/queries/stoc-pe-cultura'

type Summary = Awaited<ReturnType<typeof getSellableCal1StockSummary>>

export type StareStocFerma =
  | { mod: 'incarca' }
  /** Fără parcele: nicio cultură; ecranele arată „Adaugă întâi o parcelă”. */
  | { mod: 'fara-parcele' }
  /** O cifră (sumarul de azi), cu eticheta din cultura parcelelor. */
  | { mod: 'unic'; eticheta: string; disponibil: number }
  /** Mai multe culturi, cu migrarea stocului pe cultură: o filă pe cultură. */
  | { mod: 'pe-cultura'; culturi: StocCultura[] }

/**
 * Stocul fermei pentru ecrane (promptul 31): cultura vine din parcele. `pecultura: true` (Stocuri) cere și stocul
 * pe fiecare cultură, când ferma are mai multe și funcția există; Acasă și Comenzile folosesc cifra de azi.
 */
export function useStocFerma(options: { peCultura?: boolean } = {}): {
  stare: StareStocFerma
  culturi: CulturaFerma[] | null
  summary: Summary | undefined
  summaryQuery: UseQueryResult<Summary>
} {
  const parceleQuery = useQuery({ queryKey: queryKeys.parcele, queryFn: getParcele })
  const summaryQuery = useQuery({ queryKey: queryKeys.stocGlobalCal1, queryFn: getSellableCal1StockSummary })
  const culturi = useMemo(() => (parceleQuery.data ? culturileFermei(parceleQuery.data) : null), [parceleQuery.data])
  const vreaPeCultura = Boolean(options.peCultura) && (culturi?.length ?? 0) > 1
  const peCulturaQuery = useQuery({ queryKey: queryKeys.stocPeCultura, queryFn: getStocCal1PeCultura, enabled: vreaPeCultura })

  const stare: StareStocFerma = useMemo(() => {
    if (!culturi) return parceleQuery.isError ? { mod: 'fara-parcele' } : { mod: 'incarca' }
    if (culturi.length === 0) return { mod: 'fara-parcele' }
    if (vreaPeCultura) {
      if (peCulturaQuery.data === undefined && !peCulturaQuery.isError) return { mod: 'incarca' }
      if (Array.isArray(peCulturaQuery.data)) return { mod: 'pe-cultura', culturi: stocPeCultura(peCulturaQuery.data, culturi) }
    }
    if (!summaryQuery.data) return { mod: 'incarca' }
    return { mod: 'unic', eticheta: etichetaStocFerma(culturi) ?? 'Cal. I disponibil', disponibil: summaryQuery.data.disponibilCal1Kg }
  }, [culturi, parceleQuery.isError, peCulturaQuery.data, peCulturaQuery.isError, summaryQuery.data, vreaPeCultura])

  return { stare, culturi, summary: summaryQuery.data, summaryQuery }
}
