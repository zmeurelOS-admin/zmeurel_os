import type { PlanTratamentLinie } from '@/lib/supabase/queries/tratamente'

export type LiniePlan = Pick<PlanTratamentLinie, 'doza_ml_per_hl' | 'doza_l_per_ha'>

function roundQuantity(value: number): number {
  return Math.round(value * 1000) / 1000
}

/**
 * Calculează cantitatea totală necesară pentru o linie de plan și o suprafață dată.
 * Exemplu: `calculeazaCantitateTotala({ doza_l_per_ha: 1.5, doza_ml_per_hl: null }, 0.8)`
 */
export function calculeazaCantitateTotala(
  linie: LiniePlan,
  suprafataHa: number,
  volumApaHlPerHa = 10
): { cantitateMl: number; cantitateG?: number } | null {
  if (!Number.isFinite(suprafataHa) || suprafataHa <= 0) {
    return null
  }

  if (
    typeof linie.doza_l_per_ha === 'number' &&
    Number.isFinite(linie.doza_l_per_ha) &&
    linie.doza_l_per_ha > 0
  ) {
    return {
      cantitateMl: roundQuantity(linie.doza_l_per_ha * suprafataHa * 1000),
    }
  }

  if (
    typeof linie.doza_ml_per_hl === 'number' &&
    Number.isFinite(linie.doza_ml_per_hl) &&
    linie.doza_ml_per_hl > 0 &&
    Number.isFinite(volumApaHlPerHa) &&
    volumApaHlPerHa > 0
  ) {
    return {
      cantitateMl: roundQuantity(linie.doza_ml_per_hl * volumApaHlPerHa * suprafataHa),
    }
  }

  return null
}
