'use client'

import { useCallback, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'

import { queryKeys } from '@/lib/query-keys'
import { CapcaneIndisponibileError, getCapcane, getPraguriCapcane } from '@/lib/supabase/queries/capcane'
import { getConfigurariSezonFerma, getStadiiCanoniceFerma } from '@/lib/supabase/queries/parcela-stadii'
import { useEstimariCules } from '@/lib/analize/useEstimariCules'

import { inCoacere as inCoacerePur, type StadiuObservat } from './coacere'
import { PRAGURI_IMPLICITE, type PraguriCapcane } from './prag'
import { stareGrup, type StareGrup } from './saptamani'
import type { GrupCapcane, VerificareCapcana } from './model'

const FARA_GRUPURI: GrupCapcane[] = []
const FARA_VERIFICARI: VerificareCapcana[] = []

/**
 * Tot ce arată tab-ul Capcane, fișa grupului și cardul din Acasă: grupurile, verificările, pragurile fermei și
 * „în coacere” pe parcelă (stadiul de pe fișa parcelei sau fereastra culesului estimat, aceleași interogări și
 * același cache ca lista de parcele și mementoul analizelor).
 */
export function useCapcane(azi: string | null, options: { enabled?: boolean } = {}) {
  const enabled = options.enabled !== false && Boolean(azi)
  const an = Number((azi ?? new Date().toISOString()).slice(0, 4))
  const dateQuery = useQuery({
    queryKey: queryKeys.capcaneDate,
    queryFn: getCapcane,
    staleTime: 30_000,
    enabled,
    retry: (n, error) => !(error instanceof CapcaneIndisponibileError) && n < 1,
  })
  const praguriQuery = useQuery({ queryKey: queryKeys.capcanePraguri, queryFn: getPraguriCapcane, staleTime: 60_000, enabled })
  // Aceeași cheie și aceeași formă ca `useParceleStare` (stadiile și configurările sezonului).
  const stadiiQuery = useQuery({
    queryKey: queryKeys.stadiiFerma(an),
    queryFn: async () => ({ stadii: await getStadiiCanoniceFerma(an), configurari: await getConfigurariSezonFerma(an) }),
    staleTime: 30_000,
    enabled,
  })
  const { estimari } = useEstimariCules(enabled ? azi : null)

  const indisponibil = dateQuery.error instanceof CapcaneIndisponibileError
  const grupuri = dateQuery.data?.grupuri ?? FARA_GRUPURI
  const verificari = dateQuery.data?.verificari ?? FARA_VERIFICARI
  const praguri: PraguriCapcane = praguriQuery.data?.praguri ?? PRAGURI_IMPLICITE

  const stadiiPeParcela = useMemo(() => {
    const map = new Map<string, StadiuObservat[]>()
    for (const stadiu of stadiiQuery.data?.stadii ?? []) {
      const lista = map.get(stadiu.parcela_id) ?? []
      lista.push({ stadiu: stadiu.stadiu, data_observata: stadiu.data_observata, cohort: stadiu.cohort })
      map.set(stadiu.parcela_id, lista)
    }
    return map
  }, [stadiiQuery.data])

  const inCoacere = useCallback(
    (parcelaId: string, zi: string) =>
      inCoacerePur({ stadii: stadiiPeParcela.get(parcelaId) ?? [], dataCules: estimari.get(parcelaId)?.data ?? null, zi }),
    [estimari, stadiiPeParcela],
  )

  const verificariPeGrup = useMemo(() => {
    const map = new Map<string, VerificareCapcana[]>()
    for (const verificare of verificari) {
      const lista = map.get(verificare.grup_id) ?? []
      lista.push(verificare)
      map.set(verificare.grup_id, lista)
    }
    return map
  }, [verificari])

  const starePeGrup = useMemo(() => {
    const map = new Map<string, StareGrup>()
    for (const grup of grupuri) {
      map.set(
        grup.id,
        stareGrup({
          verificari: verificariPeGrup.get(grup.id) ?? [],
          nrBucati: grup.nr_bucati,
          prag: praguri[grup.tip],
          inCoacere: (zi) => inCoacere(grup.parcela_id, zi),
        }),
      )
    }
    return map
  }, [grupuri, inCoacere, praguri, verificariPeGrup])

  return {
    loading: dateQuery.isLoading,
    error: dateQuery.isError && !indisponibil,
    indisponibil,
    grupuri,
    verificari,
    verificariPeGrup,
    starePeGrup,
    praguri,
    praguriDisponibile: praguriQuery.data?.disponibil ?? true,
    inCoacere,
  }
}
