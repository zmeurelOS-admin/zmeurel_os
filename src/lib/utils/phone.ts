/**
 * Normalize a Romanian phone number to 10-digit 07xxxxxxxx format.
 * Accepts: 07xx xxx xxx, 07xxxxxxxx, +40xxxxxxxxx, 0040xxxxxxxxx
 * Returns null if unrecognizable.
 */
export function normalizePhone(raw: string): string | null {
  const digits = raw.replace(/\D/g, '')
  if (!digits) return null

  // 0040xxxxxxxxx → strip 004, slice(3) already starts with '0'
  if (digits.startsWith('0040') && digits.length === 13) {
    return digits.slice(3) // '0040712345678'.slice(3) = '0712345678' ✓
  }
  // +40xxxxxxxxx → digits after stripping + → 40xxxxxxxxx (11 digits)
  if (digits.startsWith('40') && digits.length === 11) {
    return '0' + digits.slice(2) // → 07xxxxxxxx
  }
  // 07xxxxxxxx (10 digits starting with 07)
  if (digits.startsWith('07') && digits.length === 10) {
    return digits
  }
  return null
}

export function isValidRomanianPhone(raw: string): boolean {
  return normalizePhone(raw) !== null
}

/** Human-readable display: 07XX XXX XXX */
export function formatPhoneDisplay(raw: string): string {
  const n = normalizePhone(raw)
  if (!n) return raw
  return `${n.slice(0, 4)} ${n.slice(4, 7)} ${n.slice(7)}`
}
