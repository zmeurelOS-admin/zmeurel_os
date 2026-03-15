/**
 * Strips Romanian diacritics and common accent marks.
 * ă→a, â→a, î→i, ș→s, ț→t (and uppercase equivalents).
 */
export function removeDiacritics(value: string): string {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
}

/**
 * Normalizes a string for case-insensitive, diacritics-insensitive search.
 * "Sălişte" → "saliste", "Cătălina" → "catalina", "Ștefan" → "stefan"
 */
export function normalizeForSearch(value: string | null | undefined): string {
  return removeDiacritics((value ?? '').trim().toLowerCase())
}
