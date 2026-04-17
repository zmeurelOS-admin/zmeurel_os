import type { ProdusFitosanitar } from '@/lib/supabase/queries/tratamente'

export interface AplicareCupru {
  aplicareId: string
  produsId?: string | null
  produsNume?: string | null
  dataAplicata: Date | string
  dozaMlPerHl?: number | null
  dozaLPerHa?: number | null
  cantitateTotalaMl?: number | null
  suprafataHa?: number | null
}

const CUPRU_KEYWORDS = ['cupru', 'copper', 'hidroxid de cupru', 'sulfat de cupru']

// Conversii orientative către kg Cu metal / litru formulat.
// Sunt intenționat locale în helper până când compoziția va fi modelată explicit în DB.
const CUPRU_METAL_KG_PER_LITRU: Record<string, number> = {
  'kocide 2000': 0.35,
  'hidroxid de cupru': 0.35,
  'sulfat de cupru': 0.25,
}

function toDate(value: Date | string): Date {
  const parsed = value instanceof Date ? new Date(value) : new Date(value)
  if (Number.isNaN(parsed.getTime())) {
    throw new Error('Data aplicării este invalidă.')
  }

  return parsed
}

function normalize(value: string | null | undefined): string {
  return value?.trim().toLowerCase() ?? ''
}

function containsCopper(text: string | null | undefined): boolean {
  const value = normalize(text)
  return CUPRU_KEYWORDS.some((keyword) => value.includes(keyword))
}

function resolveCopperKgPerLiter(produs: ProdusFitosanitar | null): number | null {
  if (!produs) return null

  const byName = CUPRU_METAL_KG_PER_LITRU[normalize(produs.nume_comercial)]
  if (typeof byName === 'number') return byName

  const active = normalize(produs.substanta_activa)
  const byActive = Object.entries(CUPRU_METAL_KG_PER_LITRU).find(([key]) => active.includes(key))
  return byActive?.[1] ?? null
}

function resolveLitersPerHa(aplicare: AplicareCupru): number | null {
  if (typeof aplicare.dozaLPerHa === 'number' && aplicare.dozaLPerHa > 0) {
    return aplicare.dozaLPerHa
  }

  if (
    typeof aplicare.cantitateTotalaMl === 'number' &&
    aplicare.cantitateTotalaMl > 0 &&
    typeof aplicare.suprafataHa === 'number' &&
    aplicare.suprafataHa > 0
  ) {
    return aplicare.cantitateTotalaMl / 1000 / aplicare.suprafataHa
  }

  if (typeof aplicare.dozaMlPerHl === 'number' && aplicare.dozaMlPerHl > 0) {
    const volumStandardHlPerHa = 10
    return (aplicare.dozaMlPerHl * volumStandardHlPerHa) / 1000
  }

  return null
}

/**
 * Calculează încărcarea anuală de cupru/ha și o compară cu pragul UE de 4 kg/ha.
 * Exemplu: `calculeazaCupruCumulatAnual(aplicari, produse, 2026)`
 */
export function calculeazaCupruCumulatAnual(
  aplicari: AplicareCupru[],
  produse: ProdusFitosanitar[],
  an: number
): { totalKgHa: number; limitaUE: 4; procentDinLimita: number; alertLevel: 'ok' | 'warning' | 'exceeded' } {
  const produseById = new Map(produse.map((produs) => [produs.id, produs]))
  const produseByName = new Map(produse.map((produs) => [normalize(produs.nume_comercial), produs]))

  const totalKgHa = aplicari.reduce((sum, aplicare) => {
    const date = toDate(aplicare.dataAplicata)
    if (date.getUTCFullYear() !== an) return sum

    const produs =
      (aplicare.produsId ? produseById.get(aplicare.produsId) : null) ??
      (aplicare.produsNume ? produseByName.get(normalize(aplicare.produsNume)) : null) ??
      null

    if (!containsCopper(produs?.substanta_activa ?? aplicare.produsNume)) {
      return sum
    }

    const copperKgPerLiter = resolveCopperKgPerLiter(produs)
    const litersPerHa = resolveLitersPerHa(aplicare)
    if (!copperKgPerLiter || !litersPerHa) return sum

    return sum + copperKgPerLiter * litersPerHa
  }, 0)

  const limitaUE = 4 as const
  const procentDinLimita = (totalKgHa / limitaUE) * 100
  const alertLevel =
    totalKgHa > limitaUE ? 'exceeded' : procentDinLimita >= 80 ? 'warning' : 'ok'

  return {
    totalKgHa,
    limitaUE,
    procentDinLimita,
    alertLevel,
  }
}
