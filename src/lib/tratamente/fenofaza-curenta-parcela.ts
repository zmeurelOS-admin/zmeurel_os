import {
  getStadiiCanoniceParcela,
  normalizeCohort,
  type ParcelaStadiuCanonic,
} from '@/lib/supabase/queries/parcela-stadii'
import type { Cohorta } from '@/lib/tratamente/configurare-sezon'
import {
  normalizeStadiu,
  type GrupBiologic,
  type StadiuCod,
} from '@/lib/tratamente/stadii-canonic'

function filterStadiiByCohort(stadii: ParcelaStadiuCanonic[], cohort?: Cohorta): ParcelaStadiuCanonic[] {
  if (!cohort) return stadii
  return stadii.filter((stadiu) => normalizeCohort(stadiu.cohort) === cohort)
}

function isValidStadiuRow(stadiu: ParcelaStadiuCanonic): boolean {
  return normalizeStadiu(stadiu.stadiu) !== null
}

function compareByRegistrationMoment(a: ParcelaStadiuCanonic, b: ParcelaStadiuCanonic): number {
  const createdDiff = new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  if (createdDiff !== 0) return createdDiff

  const observedDiff = new Date(b.data_observata).getTime() - new Date(a.data_observata).getTime()
  if (observedDiff !== 0) return observedDiff

  return b.id.localeCompare(a.id)
}

/**
 * Stadiul curent = ultima înregistrare VALIDĂ a utilizatorului (created_at desc),
 * indiferent de ordinea fenologică — permite corecții „înapoi”.
 */
export function resolveStadiuFenologicCurentParcela(
  stadii: ParcelaStadiuCanonic[],
  _grupBiologic: GrupBiologic | null,
  cohort?: Cohorta
): ParcelaStadiuCanonic | null {
  const stadiiValide = filterStadiiByCohort(stadii, cohort).filter(isValidStadiuRow)
  if (stadiiValide.length === 0) return null

  return [...stadiiValide].sort(compareByRegistrationMoment)[0] ?? null
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
