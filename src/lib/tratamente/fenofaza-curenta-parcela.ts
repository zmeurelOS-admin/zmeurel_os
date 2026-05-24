import {
  getStadiiCanoniceParcela,
  normalizeCohort,
  type ParcelaStadiuCanonic,
} from '@/lib/supabase/queries/parcela-stadii'
import type { Cohorta } from '@/lib/tratamente/configurare-sezon'
import {
  getOrdine,
  getOrdineInGrup,
  normalizeStadiu,
  type GrupBiologic,
  type StadiuCod,
} from '@/lib/tratamente/stadii-canonic'

function resolveStadiuOrder(cod: StadiuCod, grupBiologic: GrupBiologic | null): number {
  if (grupBiologic) {
    const inGroup = getOrdineInGrup(cod, grupBiologic)
    if (inGroup >= 0) return inGroup
  }
  return getOrdine(cod) + 100
}

function filterStadiiByCohort(stadii: ParcelaStadiuCanonic[], cohort?: Cohorta): ParcelaStadiuCanonic[] {
  if (!cohort) return stadii
  return stadii.filter((stadiu) => normalizeCohort(stadiu.cohort) === cohort)
}

/**
 * Aceeași regulă ca header-ul Tratamente (`getStadiuCurent` din pagina parcelei):
 * data observată desc, apoi ordinea fenologică, apoi created_at.
 */
export function resolveStadiuFenologicCurentParcela(
  stadii: ParcelaStadiuCanonic[],
  grupBiologic: GrupBiologic | null,
  cohort?: Cohorta
): ParcelaStadiuCanonic | null {
  const stadiiFiltrate = filterStadiiByCohort(stadii, cohort)
  if (stadiiFiltrate.length === 0) return null

  return (
    [...stadiiFiltrate].sort((a, b) => {
      const observedDiff = new Date(b.data_observata).getTime() - new Date(a.data_observata).getTime()
      if (observedDiff !== 0) return observedDiff

      const codA = normalizeStadiu(a.stadiu)
      const codB = normalizeStadiu(b.stadiu)
      const ordineA = codA ? resolveStadiuOrder(codA, grupBiologic) : Number.MIN_SAFE_INTEGER
      const ordineB = codB ? resolveStadiuOrder(codB, grupBiologic) : Number.MIN_SAFE_INTEGER
      const ordineDiff = ordineB - ordineA
      if (ordineDiff !== 0) return ordineDiff

      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    })[0] ?? null
  )
}

/** Client: citește toate stadiile sezonului și rezolvă fenofaza curentă (ca header-ul Tratamente). */
export async function fetchStadiuFenologicCurentParcelaClient(params: {
  parcelaId: string
  an: number
  grupBiologic: GrupBiologic | null
  cohort?: Cohorta | null
}): Promise<StadiuCod | null> {
  const cohort = params.cohort ? normalizeCohort(params.cohort) : null
  const stadii = await getStadiiCanoniceParcela(params.parcelaId, params.an, 50)
  const current = resolveStadiuFenologicCurentParcela(stadii, params.grupBiologic, cohort ?? undefined)
  return current ? normalizeStadiu(current.stadiu) : null
}
