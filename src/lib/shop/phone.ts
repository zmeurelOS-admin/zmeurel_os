export const ROMANIAN_PHONE_ERROR = 'Introdu un număr de telefon valid (07xxxxxxxx)'

export function isValidRomanianPhone(phone: string): boolean {
  const digits = phone.replace(/\D/g, '')
  return /^(?:4)?07\d{8}$/.test(digits) || /^07\d{8}$/.test(digits)
}

export function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, '')
  if (digits.startsWith('407')) return `0${digits.slice(2)}`
  if (digits.startsWith('7')) return `0${digits}`
  return digits
}

export function normalizeRomanianMobilePhone(value: string): string | null {
  return isValidRomanianPhone(value) ? normalizePhone(value) : null
}
