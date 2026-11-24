'use client'

import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'

import { construiesteJurnalLucrari } from '@/lib/lucrari/jurnal'
import { ETICHETA_LUCRARE } from '@/lib/lucrari/tipuri'
import { semnalParcela, type PlanificatParcela, type SemnalParcela } from '@/lib/parcele/semnal'
import { kgPeParcela } from '@/lib/parcele/sezon-parcela'
import { queryKeys } from '@/lib/query-keys'
import { inceputSezon } from '@/lib/sezon'
import { getLucrari } from '@/lib/supabase/queries/lucrari'
import { getParcele, type Parcela } from '@/lib/supabase/queries/parcele'
import { getRecoltari } from '@/lib/supabase/queries/recoltari'
import { usePauzeActive } from '@/lib/tratamente/hooks'
import { construiesteJurnal } from '@/lib/tratamente/jurnal'

import { useStadiiParcele } from './useStadiiParcele'

/**
 * Tot ce arată lista de parcele și fișa: parcelele, kg din sezon, pauzele (sursa unică), planificatele
 * (tratamente și lucrări), stadiul curent și semnalul de pe card.
 */
export function useParceleStare(azi: string | null) {
  const an = Number((azi ?? new Date().toISOString()).slice(0, 4))
  const parceleQuery = useQuery({ queryKey: queryKeys.parcele, queryFn: getParcele, staleTime: 30_000, refetchOnWindowFocus: false })
  const recoltariQuery = useQuery({ queryKey: queryKeys.recoltari, queryFn: getRecoltari, staleTime: 30_000, refetchOnWindowFocus: false })
  const lucrariQuery = useQuery({ queryKey: queryKeys.lucrari, queryFn: getLucrari, staleTime: 30_000, refetchOnWindowFocus: false })
  const { pauze, aplicari, activitati, loading: pauzeLoading } = usePauzeActive(azi)

  const parcele = useMemo<Parcela[]>(() => parceleQuery.data ?? [], [parceleQuery.data])
  const recoltari = useMemo(() => recoltariQuery.data ?? [], [recoltariQuery.data])
  const lucrari = useMemo(() => lucrariQuery.data ?? [], [lucrariQuery.data])
  // Promptul 33: stadiul pe lăstari, peste ani (anul trecut + anul acesta), și unde contează data culesului.
  const stadiiParcele = useStadiiParcele(parcele, an)
  const { stadii, stadiuPeParcela } = stadiiParcele

  const start = useMemo(() => (azi ? inceputSezon(azi, recoltari) : null), [azi, recoltari])
  const kg = useMemo(() => (azi && start ? kgPeParcela(recoltari, start, azi) : new Map<string, number>()), [azi, recoltari, start])

  const planificate = useMemo(() => {
    const map = new Map<string, PlanificatParcela[]>()
    const push = (parcelaId: string, item: PlanificatParcela) => {
      const lista = map.get(parcelaId) ?? []
      lista.push(item)
      map.set(parcelaId, lista)
    }
    for (const rand of construiesteJurnal({ aplicari, activitati: [] }).planificate) {
      if (!rand.zi) continue
      for (const parcelaId of rand.parcelaIds) push(parcelaId, { zi: rand.zi, tip: 'tratament' })
    }
    for (const rand of construiesteJurnalLucrari(lucrari, azi).planificate) {
      if (!rand.zi) continue
      for (const parcelaId of rand.parcelaIds) push(parcelaId, { zi: rand.zi, tip: 'lucrare', eticheta: ETICHETA_LUCRARE[rand.tip] })
    }
    return map
  }, [aplicari, azi, lucrari])

  const semnale = useMemo(() => {
    const map = new Map<string, SemnalParcela | null>()
    if (!azi) return map
    for (const parcela of parcele) {
      map.set(
        parcela.id,
        semnalParcela({
          pauza: pauze.get(parcela.id) ?? null,
          planificate: planificate.get(parcela.id) ?? [],
          stadiu: stadiuPeParcela.get(parcela.id)?.text ?? null,
          azi,
        }),
      )
    }
    return map
  }, [azi, parcele, pauze, planificate, stadiuPeParcela])

  return {
    an,
    parcele,
    recoltari,
    lucrari,
    aplicari,
    activitati,
    stadii,
    configurari: stadiiParcele.configurari,
    pauze,
    start,
    kg,
    planificate,
    stadiuPeParcela,
    /** „Cum lucrezi lăstarii” se poate schimba (migrarea 20261125110000 e aplicată). */
    modLastariDisponibil: stadiiParcele.modLastariDisponibil,
    /** Parcelele într-un stadiu (din anul acesta) în care lipsa datei culesului contează (9.2). */
    culesConteazaPe: stadiiParcele.culesConteazaPe,
    semnale,
    loading: parceleQuery.isLoading || !azi,
    detaliiLoading: recoltariQuery.isLoading || lucrariQuery.isLoading || stadiiParcele.loading || pauzeLoading,
    error: parceleQuery.isError,
  }
}
