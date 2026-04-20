import { normalizeStadiu } from '@/lib/tratamente/stadii-canonic'

import type { Cohorta } from '@/lib/tratamente/configurare-sezon'

import type { LinieCuData, PlanLinie, StadiuInregistrat } from './types'

export interface StadiuMatcherContext {
  isRubusMixt: boolean
  stadiuFloricane: string | null
  stadiuPrimocane: string | null
  stadiu: string | null
}

function toDateOnly(value: string): Date {
  const parsed = new Date(`${value}T00:00:00.000Z`)
  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`Data stadiului ${value} este invalidă.`)
  }

  return parsed
}

function addDays(value: string, offsetZile: number): string {
  const date = toDateOnly(value)
  date.setUTCDate(date.getUTCDate() + offsetZile)
  return date.toISOString().slice(0, 10)
}

function earliestDataForStage(
  stadii: StadiuInregistrat[],
  stadiuCautat: string,
  cohorta?: Cohorta
): string | null {
  let current: string | null = null

  for (const stadiu of stadii) {
    const normalizedStage = normalizeStadiu(stadiu.stadiu)
    if (normalizedStage !== stadiuCautat) continue
    if (cohorta && stadiu.cohort !== cohorta) continue

    if (!current || toDateOnly(stadiu.dataObservata).getTime() < toDateOnly(current).getTime()) {
      current = stadiu.dataObservata
    }
  }

  return current
}

function resolveDateForMixedLine(
  stadii: StadiuInregistrat[],
  stadiuTrigger: string,
  cohortTrigger: Cohorta | null
): { dataObservata: string | null; cohortLaAplicare: Cohorta | null } {
  if (cohortTrigger === 'floricane' || cohortTrigger === 'primocane') {
    return {
      dataObservata: earliestDataForStage(stadii, stadiuTrigger, cohortTrigger),
      cohortLaAplicare: cohortTrigger,
    }
  }

  const dataFloricane = earliestDataForStage(stadii, stadiuTrigger, 'floricane')
  const dataPrimocane = earliestDataForStage(stadii, stadiuTrigger, 'primocane')

  if (!dataFloricane && !dataPrimocane) {
    return { dataObservata: null, cohortLaAplicare: null }
  }

  if (!dataFloricane) {
    return { dataObservata: dataPrimocane, cohortLaAplicare: null }
  }

  if (!dataPrimocane) {
    return { dataObservata: dataFloricane, cohortLaAplicare: null }
  }

  return toDateOnly(dataFloricane).getTime() <= toDateOnly(dataPrimocane).getTime()
    ? { dataObservata: dataFloricane, cohortLaAplicare: null }
    : { dataObservata: dataPrimocane, cohortLaAplicare: null }
}

/**
 * Potrivește liniile planului cu stadiile deja atinse și calculează data planificată.
 * Exemplu: `matchLiniiCuStadii(linii, stadii, { isRubusMixt: true, stadiuFloricane: 'inflorit', stadiuPrimocane: 'crestere_vegetativa', stadiu: null }, 3)`
 */
export function matchLiniiCuStadii(
  linii: PlanLinie[],
  stadii: StadiuInregistrat[],
  context: StadiuMatcherContext,
  offsetZile = 0
): LinieCuData[] {
  const stadiuSingle = context.stadiu ? normalizeStadiu(context.stadiu) : null
  const stadiuFloricane = context.stadiuFloricane ? normalizeStadiu(context.stadiuFloricane) : null
  const stadiuPrimocane = context.stadiuPrimocane ? normalizeStadiu(context.stadiuPrimocane) : null

  return linii.flatMap((linie) => {
    const stadiuTrigger = normalizeStadiu(linie.stadiuTrigger)
    if (!stadiuTrigger) {
      return []
    }

    if (!context.isRubusMixt) {
      if (!stadiuSingle || stadiuTrigger !== stadiuSingle) {
        return []
      }

      const dataObservata = earliestDataForStage(stadii, stadiuTrigger, linie.cohortTrigger ?? undefined)
      if (!dataObservata) {
        return []
      }

      return [
        {
          ...linie,
          stadiuTrigger,
          dataPlanificata: addDays(dataObservata, offsetZile),
          cohortLaAplicare: null,
        },
      ]
    }

    if (linie.cohortTrigger === 'floricane') {
      if (stadiuFloricane !== stadiuTrigger) {
        return []
      }
    } else if (linie.cohortTrigger === 'primocane') {
      if (stadiuPrimocane !== stadiuTrigger) {
        return []
      }
    } else if (stadiuFloricane !== stadiuTrigger && stadiuPrimocane !== stadiuTrigger) {
      return []
    }

    const match = resolveDateForMixedLine(stadii, stadiuTrigger, linie.cohortTrigger ?? null)
    if (!match.dataObservata) {
      return []
    }

    return [
      {
        ...linie,
        stadiuTrigger,
        dataPlanificata: addDays(match.dataObservata, offsetZile),
        cohortLaAplicare: match.cohortLaAplicare,
      },
    ]
  })
}
