'use client'

import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'

import { usePreferinteNotificari } from '@/lib/notifications/preferinte-client'
import { NOTIFICARI_PREFERINTE_IMPLICITE, setariAnalize } from '@/lib/notifications/preferinte'
import { queryKeys } from '@/lib/query-keys'
import { AnalizeIndisponibileError, getAnalize, getDateCules, getStareMemento } from '@/lib/supabase/queries/analize'
import { getParcele } from '@/lib/supabase/queries/parcele'
import { getRecoltari } from '@/lib/supabase/queries/recoltari'
import { getProduseFitosanitare } from '@/lib/supabase/queries/tratamente'
import { useAplicariTratament } from '@/lib/tratamente/hooks'

import { estimeazaCules, type EstimareCules } from './cules'
import { calculeazaMemento, produseDeEvitat, type CalculMemento, type ProdusDeEvitat } from './memento'
import { esteParcelaDeVanzare, type AnalizaRow } from './model'

export interface MementoAnalize {
  /** Parcelele și recoltările sunt încărcate (estimarea culesului merge și fără tabelele analizelor). */
  gata: boolean
  /** Tabelele analizelor există (migrarea 20261122110000). Fără ele: fără card, fără rândul analizei. */
  analizeDisponibile: boolean
  calcul: CalculMemento | null
  produse: ProdusDeEvitat[]
  analize: AnalizaRow[]
  estimari: Map<string, EstimareCules>
  /** Data culesului pusă de mână se poate salva (migrarea 20261122111000). */
  culesDisponibil: boolean
  numeParcele: Map<string, string>
}

const GOL: AnalizaRow[] = []

/**
 * Mementoul „analiza dinainte de cules”, în aplicație (cardul din Acasă, foaia, fișa parcelei, avertizarea din
 * tratament). Aceeași funcție pură ca cronul (`calculeazaMemento`), cu datele din cache-ul React Query.
 * `proprietar = false` (operator): nimic din memento (doar proprietarul îl primește); analizele se citesc oricum.
 */
export function useMementoAnalize(azi: string | null, options: { proprietar: boolean; enabled?: boolean }): MementoAnalize {
  const enabled = (options.enabled ?? true) && Boolean(azi)
  const an = azi ? Number(azi.slice(0, 4)) : new Date().getFullYear()
  const memento = enabled && options.proprietar

  const parceleQuery = useQuery({ queryKey: queryKeys.parcele, queryFn: getParcele, staleTime: 30_000, enabled })
  const recoltariQuery = useQuery({ queryKey: queryKeys.recoltari, queryFn: getRecoltari, staleTime: 30_000, enabled })
  const culesQuery = useQuery({ queryKey: queryKeys.culesSezon(an), queryFn: () => getDateCules(an), staleTime: 60_000, enabled })
  const analizeQuery = useQuery({
    queryKey: queryKeys.analize,
    queryFn: getAnalize,
    staleTime: 30_000,
    enabled,
    retry: (n, error) => !(error instanceof AnalizeIndisponibileError) && n < 1,
  })
  const stareQuery = useQuery({ queryKey: queryKeys.mementoAnalize(an), queryFn: () => getStareMemento(an), staleTime: 60_000, enabled: memento })
  const preferinteQuery = usePreferinteNotificari()
  const catalogQuery = useQuery({ queryKey: queryKeys.produseFitosanitare, queryFn: getProduseFitosanitare, staleTime: 5 * 60_000, enabled: memento })
  const aplicariQuery = useAplicariTratament(memento)

  const analize = analizeQuery.data ?? GOL

  return useMemo(() => {
    const parcele = (parceleQuery.data ?? []).filter(esteParcelaDeVanzare)
    const numeParcele = new Map((parceleQuery.data ?? []).map((p) => [p.id, p.nume_parcela?.trim() || 'Parcelă']))
    const recoltari = recoltariQuery.data ?? []
    const manuale = culesQuery.data?.date ?? {}
    const estimari = new Map<string, EstimareCules>()
    for (const parcela of parcele) {
      estimari.set(parcela.id, estimeazaCules({ parcelaId: parcela.id, an, manual: manuale[parcela.id] ?? null, recoltari }))
    }
    const culesDisponibil = culesQuery.data?.disponibil ?? false
    const analizeDisponibile = analizeQuery.isSuccess
    const gata = Boolean(azi) && parceleQuery.isSuccess && recoltariQuery.isSuccess && (analizeDisponibile || analizeQuery.isError)

    if (!memento || !gata || !analizeDisponibile || !azi || !stareQuery.isSuccess) {
      return { gata, analizeDisponibile, calcul: null, produse: [], analize, estimari, culesDisponibil, numeParcele }
    }
    const calcul = calculeazaMemento({
      azi,
      parcele: parcele.map((p) => ({ parcelaId: p.id, nume: numeParcele.get(p.id) ?? 'Parcelă', dataCules: estimari.get(p.id)?.data ?? null })),
      analize,
      setari: setariAnalize(preferinteQuery.data ?? NOTIFICARI_PREFERINTE_IMPLICITE),
      stare: { dezactivat: stareQuery.data.dezactivat, amanatPana: stareQuery.data.amanatPana },
    })
    const produseFerma = [
      ...(catalogQuery.data ?? []).filter((p) => p.tenant_id).map((p) => ({ nume: p.nume_comercial, pauzaZile: p.phi_zile })),
      ...(aplicariQuery.data ?? []).flatMap((a) => a.produse.map((p) => ({ nume: p.produs_nume_snapshot, pauzaZile: p.phi_zile_snapshot }))),
    ]
    return {
      gata,
      analizeDisponibile,
      calcul,
      produse: calcul.zileRamase === null ? [] : produseDeEvitat(produseFerma, calcul.zileRamase),
      analize,
      estimari,
      culesDisponibil,
      numeParcele,
    }
  }, [
    an,
    analize,
    analizeQuery.isError,
    analizeQuery.isSuccess,
    aplicariQuery.data,
    azi,
    catalogQuery.data,
    culesQuery.data,
    memento,
    parceleQuery.data,
    parceleQuery.isSuccess,
    preferinteQuery.data,
    recoltariQuery.data,
    recoltariQuery.isSuccess,
    stareQuery.data,
    stareQuery.isSuccess,
  ])
}
