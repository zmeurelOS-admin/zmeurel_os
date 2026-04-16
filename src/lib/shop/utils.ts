/**
 * Magazinul asociației vinde doar unități fixe.
 * Coșul trebuie să lucreze exclusiv cu cantități întregi.
 */
export function getQuantityStep(unit: string | null | undefined): { step: number; min: number } {
  void unit
  return { step: 1, min: 1 }
}

export function getInitialQuantityForUnit(unit: string | null | undefined): number {
  const { min } = getQuantityStep(unit)
  return Math.max(1, min)
}

export function formatQuantityForDisplay(qty: number, unit: string | null | undefined): string {
  void unit
  return String(Math.max(1, Math.round(Number(qty) || 0)))
}
