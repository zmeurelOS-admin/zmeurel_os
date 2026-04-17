import { getEarliestSafeRecoltare, isAplicareSafeForRecoltare } from '@/lib/tratamente/phi-checker'
import { listAplicariParcela } from '@/lib/supabase/queries/tratamente'

import type { AplicareAplicata } from '@/lib/tratamente/phi-checker'
import type { PhiConflict, PhiGuardInput, PhiGuardResult } from './types'

const DAY_MS = 24 * 60 * 60 * 1000

function toDateOnly(value: string | Date): Date {
  const parsed =
    value instanceof Date
      ? new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()))
      : new Date(`${value}T00:00:00.000Z`)

  if (Number.isNaN(parsed.getTime())) {
    throw new Error('Data estimată pentru recoltare este invalidă.')
  }

  return parsed
}

function formatDateOnly(value: Date): string {
  return value.toISOString().slice(0, 10)
}

function subtractDays(value: Date, days: number): Date {
  return new Date(value.getTime() - days * DAY_MS)
}

interface PhiConflictSource {
  aplicareId: string
  produsNume: string
  dataAplicata: Date
  phiZile: number
  phiDeadline: Date
}

/**
 * Convertește sursele brute de conflict în shape-ul serializabil pentru guard-ul PHI.
 * Exemplu: `buildPhiConflicts([{ aplicareId: 'a1', produsNume: 'Switch', dataAplicata: new Date(), phiZile: 7, phiDeadline: new Date() }], '2026-05-20')`
 */
export function buildPhiConflicts(
  conflicts: PhiConflictSource[],
  dataRecoltare: string | Date
): PhiConflict[] {
  const recoltareDate = toDateOnly(dataRecoltare)

  return conflicts
    .map((conflict) => ({
      aplicareId: conflict.aplicareId,
      produsNume: conflict.produsNume,
      dataAplicata: formatDateOnly(conflict.dataAplicata),
      phiZile: conflict.phiZile,
      phiDeadline: formatDateOnly(conflict.phiDeadline),
      zilelamasepotDelay: Math.round((conflict.phiDeadline.getTime() - recoltareDate.getTime()) / DAY_MS),
    }))
    .sort((a, b) => a.phiDeadline.localeCompare(b.phiDeadline))
}

/**
 * Construiește răspunsul user-facing pentru guard-ul PHI.
 * Exemplu: `buildPhiGuardResult(conflicts, '2026-05-20')`
 */
export function buildPhiGuardResult(
  conflicts: PhiConflict[],
  dataRecoltare: string | Date
): PhiGuardResult {
  void dataRecoltare

  if (conflicts.length === 0) {
    return {
      safe: true,
      earliestSafeDate: null,
      conflicts: [],
      mesaj: 'Recoltarea poate fi efectuată. Nu există aplicări cu PHI activ.',
    }
  }

  const earliestSafeDate = conflicts.reduce((latest, conflict) =>
    conflict.phiDeadline > latest ? conflict.phiDeadline : latest
  , conflicts[0]!.phiDeadline)

  const produse = [...new Set(conflicts.map((conflict) => conflict.produsNume))].join(', ')

  return {
    safe: false,
    earliestSafeDate,
    conflicts,
    mesaj: `Atenție! ${conflicts.length} aplicări au PHI activ. Cea mai timpurie dată sigură: ${earliestSafeDate}. Produse în conflict: ${produse}.`,
  }
}

/**
 * Verifică server-side dacă o recoltare estimată intră în conflict cu PHI-ul aplicărilor recente pe parcelă.
 * Exemplu: `checkPhiForRecoltare({ parcelaId: 'uuid', dataRecoltareEstimata: '2026-05-20' })`
 */
export async function checkPhiForRecoltare(input: PhiGuardInput): Promise<PhiGuardResult> {
  const recoltareDate = toDateOnly(input.dataRecoltareEstimata)
  const fromDate = subtractDays(recoltareDate, 30)

  const aplicari = await listAplicariParcela(input.parcelaId, {
    status: 'aplicata',
    from: fromDate,
    to: recoltareDate,
  })

  const aplicariCuPhi = aplicari
    .filter((aplicare) => aplicare.data_aplicata)
    .map((aplicare) => {
      const phiZile = aplicare.produs?.phi_zile ?? null
      const produsNume =
        aplicare.produs?.nume_comercial ??
        aplicare.produs_nume_manual ??
        'Produs necunoscut'

      return {
        aplicareId: aplicare.id,
        produsNume,
        dataAplicata: aplicare.data_aplicata as string,
        phiZile,
      } satisfies AplicareAplicata
    })

  const result = isAplicareSafeForRecoltare(aplicariCuPhi, recoltareDate)
  const earliestSafe = getEarliestSafeRecoltare(aplicariCuPhi)

  const conflictSources: PhiConflictSource[] = result.conflicts.map((conflict) => {
    const sursa = aplicariCuPhi.find((aplicare) => aplicare.aplicareId === conflict.aplicareId)

    return {
      aplicareId: conflict.aplicareId,
      produsNume: conflict.produsNume,
      dataAplicata: toDateOnly(sursa?.dataAplicata ?? conflict.phiEnd),
      phiZile: sursa?.phiZile ?? 0,
      phiDeadline: conflict.phiEnd,
    }
  })

  const conflicts = buildPhiConflicts(conflictSources, recoltareDate)
  const guardResult = buildPhiGuardResult(conflicts, recoltareDate)

  if (guardResult.safe) {
    return guardResult
  }

  return {
    ...guardResult,
    earliestSafeDate: earliestSafe ? formatDateOnly(earliestSafe) : guardResult.earliestSafeDate,
    mesaj: `Atenție! ${conflicts.length} aplicări au PHI activ. Cea mai timpurie dată sigură: ${earliestSafe ? formatDateOnly(earliestSafe) : guardResult.earliestSafeDate}. Produse în conflict: ${[...new Set(conflicts.map((conflict) => conflict.produsNume))].join(', ')}.`,
  }
}

