import {
  getStadiiCanoniceParcela,
  normalizeCohort,
  type ParcelaStadiuCanonic,
} from '@/lib/supabase/queries/parcela-stadii'
import type { Cohorta } from '@/lib/parcele/configurare-sezon'
import { STADIU_TAIAT, comparaRanduri } from '@/lib/parcele/lastari'
import {
  normalizeStadiu,
  type GrupBiologic,
  type StadiuCod,
} from '@/lib/parcele/stadii-canonic'

function filterStadiiByCohort(stadii: ParcelaStadiuCanonic[], cohort?: Cohorta): ParcelaStadiuCanonic[] {
  if (!cohort) return stadii
  return stadii.filter((stadiu) => normalizeCohort(stadiu.cohort) === cohort)
}

function isValidStadiuRow(stadiu: ParcelaStadiuCanonic): boolean {
  return normalizeStadiu(stadiu.stadiu) !== null
}

export function getStadiuRegistrationTimestamp(stadiu: ParcelaStadiuCanonic): number {
  const created = new Date(stadiu.created_at).getTime()
  const updated = new Date(stadiu.updated_at).getTime()
  const createdSafe = Number.isFinite(created) ? created : 0
  const updatedSafe = Number.isFinite(updated) ? updated : createdSafe
  return Math.max(createdSafe, updatedSafe)
}

/**
 * Stadiul curent = ultimul rând VALID după ziua notată (`data_observata`), iar la aceeași zi ultimul înregistrat
 * (max(created_at, updated_at)), indiferent de ordinea fenologică (promptul 33, `comparaRanduri`). Un `taiat` ca ultim
 * rând înseamnă fără stadiu.
 */
export function resolveStadiuFenologicCurentParcela(
  stadii: ParcelaStadiuCanonic[],
  _grupBiologic: GrupBiologic | null,
  cohort?: Cohorta
): ParcelaStadiuCanonic | null {
  const stadiiValide = filterStadiiByCohort(stadii, cohort).filter(isValidStadiuRow)
  if (stadiiValide.length === 0) return null

  const ultim = [...stadiiValide].sort(comparaRanduri)[0] ?? null
  return ultim && normalizeStadiu(ultim.stadiu) === STADIU_TAIAT ? null : ultim
}

export function hasCanonicalCohortStages(stadii: ParcelaStadiuCanonic[]): boolean {
  return stadii.some((entry) => entry.cohort === 'floricane' || entry.cohort === 'primocane')
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
