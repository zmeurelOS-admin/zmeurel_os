/** Numere cu virgulă zecimală (scrierea românească), pentru câmpurile kitului. */

export function roundTo(value: number, decimals: number): number {
  const factor = 10 ** Math.max(0, decimals)
  return Math.round((value + Number.EPSILON) * factor) / factor
}

export function clampNumber(value: number, min?: number, max?: number): number {
  let next = value
  if (min !== undefined && next < min) next = min
  if (max !== undefined && next > max) next = max
  return next
}

/** „27,35” sau „27.35” → 27.35. Text gol sau nevalid → `null`. */
export function parseDecimal(text: string): number | null {
  const normalized = text.trim().replace(',', '.')
  if (!normalized || normalized === '.') return null
  if (!/^\d*\.?\d*$/.test(normalized)) return null
  const value = Number(normalized)
  return Number.isFinite(value) ? value : null
}

/** 27.35 → „27,35”; 5 → „5”. `null` → text gol. Fără separator de mii (textul ajunge într-un câmp). */
export function formatDecimal(value: number | null, decimals = 2): string {
  if (value === null || !Number.isFinite(value)) return ''
  return String(roundTo(value, decimals)).replace('.', ',')
}

/**
 * Curăță ce s-a tastat într-un câmp numeric: doar cifre, o singură virgulă (punctul devine virgulă),
 * cel mult `decimals` zecimale. Cu `decimals = 0` virgula e ignorată.
 */
export function sanitizeDecimalInput(text: string, decimals = 2): string {
  let result = ''
  let hasSeparator = false
  let decimalCount = 0
  for (const char of text) {
    if (char >= '0' && char <= '9') {
      if (hasSeparator) {
        if (decimalCount >= decimals) continue
        decimalCount += 1
      }
      result += char
    } else if ((char === ',' || char === '.') && decimals > 0 && !hasSeparator) {
      hasSeparator = true
      result += result === '' ? '0,' : ','
    }
  }
  return result
}

export interface StepOptions {
  min?: number
  max?: number
  decimals?: number
}

/** Valoarea după un pas (`delta` pozitiv sau negativ), rotunjită și ținută între limite. `null` pornește de la 0. */
export function stepValue(current: number | null, delta: number, { min, max, decimals = 0 }: StepOptions = {}): number {
  return clampNumber(roundTo((current ?? 0) + delta, decimals), min, max)
}
