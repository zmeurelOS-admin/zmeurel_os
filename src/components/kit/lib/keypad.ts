/** Logica tastaturii numerice din aplicație (fără React). Valoarea e text, cu virgulă zecimală. */

export type KeypadDigit = '0' | '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9'
export type KeypadKey = KeypadDigit | ',' | 'backspace'

/** Ordinea tastelor pe grila de 3 coloane. */
export const KEYPAD_KEYS: readonly KeypadKey[] = ['1', '2', '3', '4', '5', '6', '7', '8', '9', ',', '0', 'backspace']

export interface KeypadOptions {
  /** Câte zecimale se pot scrie. Implicit 2 (cântarul dă ex. 27,35). Cu 0, virgula e ignorată. */
  maxDecimals?: number
  /** Câte cifre poate avea partea întreagă. Implicit 4. */
  maxIntegerDigits?: number
}

/** Valoarea câmpului după apăsarea unei taste. Pornește de la text gol. */
export function applyKeypadKey(current: string, key: KeypadKey, options: KeypadOptions = {}): string {
  const { maxDecimals = 2, maxIntegerDigits = 4 } = options

  if (key === 'backspace') return current.slice(0, -1)

  const separatorIndex = current.indexOf(',')

  if (key === ',') {
    if (maxDecimals <= 0 || separatorIndex >= 0) return current
    return current === '' ? '0,' : `${current},`
  }

  if (separatorIndex >= 0) {
    const decimals = current.length - separatorIndex - 1
    return decimals >= maxDecimals ? current : current + key
  }

  // Un zero de început nu se adună: „0” apoi „5” dă „5”, nu „05”.
  if (current === '0') return key
  if (current.length >= maxIntegerDigits) return current
  return current + key
}

/** „27,35” → 27.35; „27,” → 27. Text gol → `null` (câmp necompletat). */
export function parseKeypadValue(value: string): number | null {
  if (value === '') return null
  const parsed = Number(value.replace(',', '.'))
  return Number.isFinite(parsed) ? parsed : null
}

/** Apasă o tastă în câmpul activ; celelalte câmpuri rămân neschimbate. */
export function pressKeypadField<T extends Record<string, string>>(
  values: Readonly<T>,
  active: keyof T & string,
  key: KeypadKey,
  options?: KeypadOptions,
): T {
  return { ...values, [active]: applyKeypadKey(values[active] ?? '', key, options) }
}

/** Tasta de pe tastatura fizică → tasta din aplicație (punctul de pe blocul numeric devine virgulă). */
export function keypadKeyFromKeyboard(eventKey: string): KeypadKey | null {
  if (eventKey.length === 1 && eventKey >= '0' && eventKey <= '9') return eventKey as KeypadDigit
  if (eventKey === ',' || eventKey === '.') return ','
  if (eventKey === 'Backspace') return 'backspace'
  return null
}
