'use client'

import { useCallback, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'

import { useEstimariCules } from '@/lib/analize/useEstimariCules'
import { grupBiologicParcela } from '@/lib/parcele/stadiu-curent'
import { queryKeys } from '@/lib/query-keys'
import { getMagazieStocSauNimic } from '@/lib/supabase/queries/magazie'
import { getConfigurariSezonFerma, getStadiiCanoniceFerma } from '@/lib/supabase/queries/parcela-stadii'
import { getParcele } from '@/lib/supabase/queries/parcele'
import { getParcelePlanuri, getPlanuri, getSariteSiExceptii } from '@/lib/supabase/queries/plan'
import { getProduseFitosanitare, getVolumeParcele } from '@/lib/supabase/queries/tratamente'
import { useAplicariTratament } from '@/lib/tratamente/hooks'
import type { AplicareRow } from '@/lib/tratamente/model'
import { ziuaRo } from '@/lib/tratamente/zile'

import type { LiniePlan, ParcelaPlan, PlanTratament } from './model'
import { intrebariParcela, ziAmanare, type IntrebareStadiu } from './intrebare'
import { stadiiCurentePeParcele, type StadiuCurent, type StadiuRand } from './stadii'
import {
  calculeazaPlan,
  grupeazaDeFacut,
  stadiiUrmatoare,
  type AplicarePlan,
  type CalculPlan,
  type ContextPlan,
  type GrupDeFacut,
  type StadiuUrmator,
} from './urmeaza'
import { verificariInterventie, type AplicareProdusFacuta, type ParcelaVerificare, type Verificare } from './verificari'

const GOL_PLANURI: PlanTratament[] = []
const GOL_ASOCIERI: ParcelaPlan[] = []
const GOL_STADII: StadiuRand[] = []

/** Aplicările din Tratamente, cât îi trebuie planului (ziua: făcută sau planificată, în ora României). */
export function aplicariPentruPlan(aplicari: readonly AplicareRow[]): AplicarePlan[] {
  return aplicari.map((a) => ({
    id: a.id,
    parcela_id: a.parcela_id,
    plan_linie_id: a.plan_linie_id ?? null,
    status: a.status,
    zi: a.status === 'aplicata' ? ziuaRo(a.data_aplicata) : ziuaRo(a.data_planificata),
  }))
}

/** Produsele aplicate (făcute), pentru maximul pe sezon și intervalul minim. */
export function produseFacute(aplicari: readonly AplicareRow[]): AplicareProdusFacuta[] {
  const rezultat: AplicareProdusFacuta[] = []
  for (const a of aplicari) {
    if (a.status !== 'aplicata') continue
    const zi = ziuaRo(a.data_aplicata)
    if (!zi) continue
    if (a.produse.length > 0) {
      for (const p of a.produse) rezultat.push({ parcela_id: a.parcela_id, zi, produs_id: p.produs_id, nume: p.produs_nume_snapshot })
    } else if (a.produs) {
      rezultat.push({ parcela_id: a.parcela_id, zi, produs_id: a.produs.id, nume: a.produs.nume_comercial ?? 'Produs' })
    }
  }
  return rezultat
}

const CHEIE_AMANATE = 'zmeurel:plan:intrebari-amanate'

function citesteAmanate(): Map<string, string> {
  if (typeof window === 'undefined') return new Map()
  try {
    const parsed: unknown = JSON.parse(window.localStorage.getItem(CHEIE_AMANATE) ?? '{}')
    if (!parsed || typeof parsed !== 'object') return new Map()
    return new Map(Object.entries(parsed as Record<string, unknown>).filter((e): e is [string, string] => typeof e[1] === 'string'))
  } catch {
    return new Map()
  }
}

function scrieAmanate(map: ReadonlyMap<string, string>) {
  try {
    window.localStorage.setItem(CHEIE_AMANATE, JSON.stringify(Object.fromEntries(map)))
  } catch {
    // Fără localStorage (fereastră privată): „Încă nu” ține doar cât e pagina deschisă.
  }
}

export interface PlanCalculat {
  plan: PlanTratament
  calcul: CalculPlan
  grupuri: GrupDeFacut[]
  urmeaza: StadiuUrmator[]
}

/**
 * Tot ce arată tab-ul Plan, „Planul întreg”, formularul completat și întrebarea „A început…?”: planurile (și cele
 * vechi), parcelele lor pe an, liniile sărite și excepțiile (după migrare), stadiile parcelelor (aceeași cheie și
 * același cache ca lista de parcele), aplicările, catalogul, magazia și culesul estimat.
 */
export function usePlan(azi: string | null, options: { enabled?: boolean } = {}) {
  const enabled = options.enabled !== false && Boolean(azi)
  const an = Number((azi ?? new Date().toISOString()).slice(0, 4))

  const planuriQuery = useQuery({ queryKey: queryKeys.planuri, queryFn: getPlanuri, staleTime: 30_000, enabled })
  const asocieriQuery = useQuery({ queryKey: queryKeys.planParcele, queryFn: getParcelePlanuri, staleTime: 30_000, enabled })
  const sariteQuery = useQuery({ queryKey: queryKeys.planSarite, queryFn: getSariteSiExceptii, staleTime: 30_000, enabled })
  // Aceeași cheie și aceeași formă ca `useParceleStare` / `useCapcane`.
  const stadiiQuery = useQuery({
    queryKey: queryKeys.stadiiFerma(an),
    queryFn: async () => ({ stadii: await getStadiiCanoniceFerma(an), configurari: await getConfigurariSezonFerma(an) }),
    staleTime: 30_000,
    enabled,
  })
  const stadiiTrecutQuery = useQuery({
    queryKey: queryKeys.stadiiFerma(an - 1),
    queryFn: async () => ({ stadii: await getStadiiCanoniceFerma(an - 1), configurari: await getConfigurariSezonFerma(an - 1) }),
    staleTime: 5 * 60_000,
    enabled,
  })
  const parceleQuery = useQuery({ queryKey: queryKeys.parcele, queryFn: getParcele, staleTime: 30_000, enabled })
  const volumeQuery = useQuery({ queryKey: queryKeys.volumeParcele, queryFn: getVolumeParcele, staleTime: 60_000, enabled })
  const catalogQuery = useQuery({ queryKey: queryKeys.produseFitosanitare, queryFn: getProduseFitosanitare, staleTime: 5 * 60_000, enabled })
  const magazieQuery = useQuery({ queryKey: queryKeys.magazieStoc, queryFn: getMagazieStocSauNimic, staleTime: 30_000, enabled, retry: false })
  const aplicariQuery = useAplicariTratament(enabled)
  const { estimari } = useEstimariCules(enabled ? azi : null)

  const [amanate, setAmanate] = useState<Map<string, string>>(() => citesteAmanate())

  const planuri = planuriQuery.data ?? GOL_PLANURI
  const asocieri = asocieriQuery.data ?? GOL_ASOCIERI
  const stadiiAn = (stadiiQuery.data?.stadii ?? GOL_STADII) as StadiuRand[]
  const stadiiTrecut = (stadiiTrecutQuery.data?.stadii ?? GOL_STADII) as StadiuRand[]
  const aplicariRows = aplicariQuery.data

  // Promptul 33: stadiul de acum se citește peste ani (un „Păstrez” din noiembrie e încă stadiul în martie); planul
  // folosește din anul trecut doar `pastrat` / `repaus_vegetativ` (`stadiuPentruPlan`).
  const stadii = useMemo(() => stadiiCurentePeParcele([...stadiiTrecut, ...stadiiAn], an), [an, stadiiAn, stadiiTrecut])
  const aplicari = useMemo(() => aplicariPentruPlan(aplicariRows ?? []), [aplicariRows])
  const facute = useMemo(() => produseFacute(aplicariRows ?? []), [aplicariRows])

  const ctx: ContextPlan | null = useMemo(
    () =>
      azi
        ? { azi, an, stadii, aplicari, sarite: sariteQuery.data?.sarite ?? [], exceptii: sariteQuery.data?.exceptii ?? [] }
        : null,
    [an, aplicari, azi, sariteQuery.data, stadii],
  )

  const calculate: PlanCalculat[] = useMemo(() => {
    if (!ctx) return []
    return planuri.map((plan) => {
      const calcul = calculeazaPlan(plan, asocieri, ctx)
      return { plan, calcul, grupuri: grupeazaDeFacut(plan, calcul.deFacut), urmeaza: stadiiUrmatoare(plan, calcul, stadii) }
    })
  }, [asocieri, ctx, planuri, stadii])

  const parcele = useMemo(
    () => (parceleQuery.data ?? []).map((p) => ({ ...p, volum_solutie_l: volumeQuery.data?.[p.id] ?? null })),
    [parceleQuery.data, volumeQuery.data],
  )
  const numeParcele = useMemo(() => new Map(parcele.map((p) => [p.id, p.nume_parcela?.trim() || 'Parcelă'])), [parcele])
  const catalog = useMemo(() => catalogQuery.data ?? [], [catalogQuery.data])
  const catalogInfo = useMemo(
    () => new Map(catalog.map((p) => [p.id, { phi: p.phi_zile, nrMaxPeSezon: p.nr_max_aplicari_per_sezon, intervalMinZile: p.interval_min_aplicari_zile }])),
    [catalog],
  )

  /** Verificările unei intervenții pe parcelele date (rândul din tab și formularul completat). */
  const verifica = useCallback(
    (linie: Pick<LiniePlan, 'produse'>, parcelaIds: readonly string[]): Verificare[] => {
      if (!azi) return []
      const alese: ParcelaVerificare[] = parcele.filter((p) => parcelaIds.includes(p.id))
      return verificariInterventie({
        produse: linie.produse,
        parcele: alese,
        zi: azi,
        an,
        catalog: catalogInfo,
        facute,
        stoc: (magazieQuery.data ?? []).map((s) => ({ produs_id: s.produs_id, unitate: s.unitate, stoc: s.stoc })),
        datesCules: parcelaIds.map((id) => estimari.get(id)?.data ?? null),
      })
    },
    [an, azi, catalogInfo, estimari, facute, magazieQuery.data, parcele],
  )

  /** „A început…?” pe o parcelă (fișa parcelei) sau pe parcelele cu plan activ (tab-ul Plan). */
  const intrebari = useCallback(
    (parcelaIds?: readonly string[]): IntrebareStadiu[] => {
      if (!azi) return []
      const ids = parcelaIds ?? [...new Set(calculate.flatMap((c) => c.calcul.parcelaIds))]
      return ids.flatMap((parcelaId) => {
        const parcela = parcele.find((p) => p.id === parcelaId)
        if (!parcela) return []
        return intrebariParcela({
          parcelaId,
          grup: grupBiologicParcela(parcela) ?? 'rubus',
          culturaTip: parcela.cultura,
          curente: stadii.get(parcelaId) ?? ([] as StadiuCurent[]),
          stadiiAnTrecut: stadiiTrecut,
          an,
          azi,
          dataCules: estimari.get(parcelaId)?.data ?? null,
          amanate,
        })
      })
    },
    [amanate, an, azi, calculate, estimari, parcele, stadii, stadiiTrecut],
  )

  const amana = useCallback(
    (cheie: string) => {
      if (!azi) return
      setAmanate((previous) => {
        const next = new Map(previous)
        next.set(cheie, ziAmanare(azi))
        scrieAmanate(next)
        return next
      })
    },
    [azi],
  )

  return {
    an,
    loading: planuriQuery.isLoading || asocieriQuery.isLoading || stadiiQuery.isLoading || aplicariQuery.isLoading,
    error: planuriQuery.error ?? asocieriQuery.error ?? null,
    planuri,
    asocieri,
    calculate,
    /** „Sar peste” și excepțiile (migrarea `20261123120000`). */
    disponibil: sariteQuery.data?.disponibil ?? false,
    stadii,
    stadiiAn,
    stadiiTrecut,
    aplicariRows: aplicariRows ?? [],
    parcele,
    numeParcele,
    catalog,
    estimari,
    verifica,
    intrebari,
    amana,
  }
}

export type PlanData = ReturnType<typeof usePlan>
