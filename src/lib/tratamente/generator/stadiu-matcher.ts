import type { LinieCuData, PlanLinie, StadiuInregistrat } from './types'

function normalizeStadiu(value: string): string {
  return value.trim()
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

/**
 * Potrivește liniile planului cu stadiile deja atinse și calculează data planificată.
 * Exemplu: `matchLiniiCuStadii(linii, stadii, 'inflorit', 3)`
 */
export function matchLiniiCuStadii(
  linii: PlanLinie[],
  stadii: StadiuInregistrat[],
  stadiuFiltru?: string,
  offsetZile = 0
): LinieCuData[] {
  const filtruNormalizat = stadiuFiltru ? normalizeStadiu(stadiuFiltru) : null
  const earliestByStadiu = new Map<string, StadiuInregistrat>()

  for (const stadiu of stadii) {
    const key = normalizeStadiu(stadiu.stadiu)
    const current = earliestByStadiu.get(key)

    if (!current || toDateOnly(stadiu.dataObservata).getTime() < toDateOnly(current.dataObservata).getTime()) {
      earliestByStadiu.set(key, stadiu)
    }
  }

  return linii.flatMap((linie) => {
    const stadiuTrigger = normalizeStadiu(linie.stadiuTrigger)
    if (filtruNormalizat && stadiuTrigger !== filtruNormalizat) {
      return []
    }

    const stadiuAtins = earliestByStadiu.get(stadiuTrigger)
    if (!stadiuAtins) {
      return []
    }

    return [
      {
        ...linie,
        stadiuTrigger,
        dataPlanificata: addDays(stadiuAtins.dataObservata, offsetZile),
      },
    ]
  })
}
