/**
 * „Sigur?” la „Am cumpărat” (promptul 34, §9): o cantitate peste prag cere o confirmare înainte de salvare (o cifră
 * în plus, ca 846488, intră altfel în magazie fără să observe nimeni). Pragurile sunt pe unitatea magaziei.
 */
import type { UnitateStoc } from './unitati'

export const PRAG_SIGUR: Record<UnitateStoc, number> = { kg: 2000, l: 500, buc: 500 }

/** Cantitatea cere confirmare: strict peste prag. */
export function cereConfirmare(cantitate: number | null, unitate: UnitateStoc): boolean {
  return cantitate !== null && Number.isFinite(cantitate) && cantitate > PRAG_SIGUR[unitate]
}
