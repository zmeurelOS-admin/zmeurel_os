'use client'

import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'

import { culesConteaza } from '@/lib/analize/cules'
import { grupBiologicParcela, stadiuCurentParcela, type StadiuCurentParcela } from '@/lib/parcele/stadiu-curent'
import { queryKeys } from '@/lib/query-keys'
import {
  getConfigurariSezonFerma,
  getModLastariFerma,
  getStadiiCanoniceFermaDoiAni,
  type ParcelaStadiuCanonic,
} from '@/lib/supabase/queries/parcela-stadii'
import { getParcele, type Parcela } from '@/lib/supabase/queries/parcele'

const GOL: ParcelaStadiuCanonic[] = []

/** Cererea stadiilor pe doi ani (aceeași cheie în listă, fișă și Acasă): anul trecut + anul `an`, cu configurările. */
export function stadiiDoiAniQueryOptions(an: number) {
  return {
    queryKey: [...queryKeys.stadiiFerma(an), 'doi-ani'] as const,
    queryFn: async () => ({ stadii: await getStadiiCanoniceFermaDoiAni(an), configurari: await getConfigurariSezonFerma(an) }),
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  }
}

/** „Cum lucrezi lăstarii” pe parcele; `null` = migrarea 20261125110000 nu e aplicată. */
export function modLastariQueryOptions() {
  return {
    queryKey: [...queryKeys.parcele, 'mod-lastari'] as const,
    queryFn: getModLastariFerma,
    staleTime: 30_000,
    refetchOnWindowFocus: false,
    retry: false,
  }
}

/**
 * Stadiul curent pe parcele (promptul 33: pe lăstari, peste ani) și unde contează data culesului (9.2), pentru
 * parcelele date. `enabled: false` = nu cere nimic.
 */
export function useStadiiParcele(parcele: readonly Parcela[], an: number, options: { enabled?: boolean } = {}) {
  const enabled = options.enabled !== false
  const stadiiQuery = useQuery({ ...stadiiDoiAniQueryOptions(an), enabled })
  const modQuery = useQuery({ ...modLastariQueryOptions(), enabled })
  const stadii = stadiiQuery.data?.stadii ?? GOL

  const stadiuPeParcela = useMemo(() => {
    const map = new Map<string, StadiuCurentParcela>()
    const configPe = new Map((stadiiQuery.data?.configurari ?? []).map((config) => [config.parcela_id, config]))
    const stadiiPe = new Map<string, ParcelaStadiuCanonic[]>()
    for (const stadiu of stadii) stadiiPe.set(stadiu.parcela_id, [...(stadiiPe.get(stadiu.parcela_id) ?? []), stadiu])
    for (const parcela of parcele) {
      map.set(
        parcela.id,
        stadiuCurentParcela({
          stadii: stadiiPe.get(parcela.id) ?? [],
          grup: grupBiologicParcela(parcela),
          config: configPe.get(parcela.id) ?? null,
          modSalvat: modQuery.data?.get(parcela.id) ?? null,
        }),
      )
    }
    return map
  }, [modQuery.data, parcele, stadii, stadiiQuery.data?.configurari])

  /** Parcela e într-un stadiu (din anul acesta) în care lipsa datei culesului contează. */
  const culesConteazaPe = useMemo(() => {
    const ids = new Set<string>()
    for (const [parcelaId, stadiu] of stadiuPeParcela) if (culesConteaza(stadiu.peLastari, an)) ids.add(parcelaId)
    return ids
  }, [an, stadiuPeParcela])

  return {
    stadii,
    configurari: stadiiQuery.data?.configurari ?? [],
    stadiuPeParcela,
    culesConteazaPe,
    modLastariDisponibil: modQuery.data !== null && modQuery.data !== undefined,
    gata: stadiiQuery.isSuccess,
    loading: stadiiQuery.isLoading,
  }
}

const GOL_PARCELE: Parcela[] = []

/**
 * Unde contează data culesului (9.2), pentru mesajul „Pune data culesului pe parcele…” (fișă, Acasă, foaia analizei).
 * Folosește aceleași cereri ca lista de parcele (din memorie, dacă lista a fost deschisă).
 */
export function useCulesConteaza(azi: string | null, options: { enabled?: boolean } = {}) {
  const enabled = options.enabled !== false && Boolean(azi)
  const an = Number((azi ?? new Date().toISOString()).slice(0, 4))
  const parceleQuery = useQuery({ queryKey: queryKeys.parcele, queryFn: getParcele, staleTime: 30_000, refetchOnWindowFocus: false, enabled })
  const { culesConteazaPe, gata } = useStadiiParcele(parceleQuery.data ?? GOL_PARCELE, an, { enabled })
  return { culesConteazaPe, gata: gata && parceleQuery.isSuccess }
}
