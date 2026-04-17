export interface AplicareAplicata {
  aplicareId: string
  produsNume: string
  dataAplicata: Date | string
  phiZile: number | null
}

export interface PhiConflict {
  aplicareId: string
  produsNume: string
  phiEnd: Date
}

function toDate(value: Date | string): Date {
  const parsed = value instanceof Date ? new Date(value) : new Date(value)
  if (Number.isNaN(parsed.getTime())) {
    throw new Error('Data aplicării este invalidă.')
  }

  return parsed
}

/**
 * Calculează prima zi sigură de recoltare pentru o aplicare cu PHI.
 * Exemplu: `calculatePhiDeadline(new Date('2026-05-10'), 7)`
 */
export function calculatePhiDeadline(dataAplicata: Date, phiZile: number): Date {
  const baseDate = new Date(dataAplicata)
  return new Date(baseDate.getTime() + phiZile * 24 * 60 * 60 * 1000)
}

/**
 * Verifică dacă toate aplicările efectuate respectă PHI până la data recoltării.
 * Exemplu: `isAplicareSafeForRecoltare(aplicari, new Date('2026-05-20'))`
 */
export function isAplicareSafeForRecoltare(
  aplicari: AplicareAplicata[],
  dataRecoltare: Date
): { safe: boolean; conflicts: PhiConflict[] } {
  const target = new Date(dataRecoltare)
  const conflicts = aplicari
    .filter((aplicare) => typeof aplicare.phiZile === 'number' && aplicare.phiZile >= 0)
    .map((aplicare) => ({
      aplicareId: aplicare.aplicareId,
      produsNume: aplicare.produsNume,
      phiEnd: calculatePhiDeadline(toDate(aplicare.dataAplicata), aplicare.phiZile ?? 0),
    }))
    .filter((conflict) => target < conflict.phiEnd)
    .sort((a, b) => b.phiEnd.getTime() - a.phiEnd.getTime())

  return {
    safe: conflicts.length === 0,
    conflicts,
  }
}

/**
 * Returnează cea mai devreme dată sigură de recoltare după toate aplicările.
 * Exemplu: `getEarliestSafeRecoltare(aplicari)`
 */
export function getEarliestSafeRecoltare(aplicari: AplicareAplicata[]): Date | null {
  const deadlines = aplicari
    .filter((aplicare) => typeof aplicare.phiZile === 'number' && aplicare.phiZile >= 0)
    .map((aplicare) => calculatePhiDeadline(toDate(aplicare.dataAplicata), aplicare.phiZile ?? 0))

  if (deadlines.length === 0) return null

  return deadlines.reduce((latest, current) =>
    current.getTime() > latest.getTime() ? current : latest
  )
}
