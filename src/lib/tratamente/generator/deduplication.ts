import type { AplicareExistenta, PlanLinie } from './types'

/**
 * Separă liniile noi de cele deja materializate în aplicări planificate sau aplicate.
 * Exemplu: `detectDuplicates(linii, aplicariExistente)`
 */
export function detectDuplicates<T extends PlanLinie>(
  linii: T[],
  aplicariExistente: AplicareExistenta[]
): { noi: T[]; duplicate: T[] } {
  const duplicatePlanLinieIds = new Set(
    aplicariExistente
      .filter(
        (aplicare) =>
          typeof aplicare.planLinieId === 'string' &&
          (
            aplicare.status === 'planificata' ||
            aplicare.status === 'reprogramata' ||
            aplicare.status === 'aplicata'
          )
      )
      .map((aplicare) => aplicare.planLinieId as string)
  )

  return linii.reduce<{ noi: T[]; duplicate: T[] }>(
    (accumulator, linie) => {
      if (duplicatePlanLinieIds.has(linie.id)) {
        accumulator.duplicate.push(linie)
      } else {
        accumulator.noi.push(linie)
      }

      return accumulator
    },
    { noi: [], duplicate: [] }
  )
}
