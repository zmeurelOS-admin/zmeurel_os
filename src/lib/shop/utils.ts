/**
 * Returnează step-ul și cantitatea minimă pe baza unității de vânzare.
 * Unitățile discrete merg în pași de 1, cele continue în pași de 0.5.
 */
export function getQuantityStep(unit: string | null | undefined): { step: number; min: number } {
  const normalized = (unit || '').toLowerCase().trim()

  const discreteUnits = [
    'casoleta',
    'casoletă',
    'bucata',
    'bucată',
    'buc',
    'pachet',
    'pach',
    'borcan',
    'sticla',
    'sticlă',
    'punga',
    'pungă',
    'cutie',
    'set',
    'legatura',
    'legătură',
    'fiola',
    'fiolă',
    'doza',
    'doză',
    'portie',
    'porție',
    'unitate',
    'unit',
  ]

  if (discreteUnits.some((value) => normalized.includes(value))) {
    return { step: 1, min: 1 }
  }

  return { step: 0.5, min: 0.5 }
}

export function getInitialQuantityForUnit(unit: string | null | undefined): number {
  const { min } = getQuantityStep(unit)
  return Math.max(1, min)
}

export function formatQuantityForDisplay(qty: number, unit: string | null | undefined): string {
  const { step } = getQuantityStep(unit)
  if (step >= 1) {
    return String(Math.round(qty))
  }
  return Number.isInteger(qty) ? String(qty) : qty.toFixed(1)
}
