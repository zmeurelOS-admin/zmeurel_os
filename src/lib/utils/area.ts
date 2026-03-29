export function parseLocalizedNumber(value: number | string | null | undefined): number {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0

  let normalized = String(value ?? '').trim().replace(/\s+/g, '')
  if (!normalized) return 0

  const commaCount = (normalized.match(/,/g) ?? []).length
  const dotCount = (normalized.match(/\./g) ?? []).length

  if (commaCount > 0 && dotCount > 0) {
    if (normalized.lastIndexOf(',') > normalized.lastIndexOf('.')) {
      normalized = normalized.replace(/\./g, '').replace(',', '.')
    } else {
      normalized = normalized.replace(/,/g, '')
    }
  } else if (commaCount > 0) {
    if (commaCount > 1 || /^\d{1,3}(,\d{3})+$/.test(normalized)) {
      normalized = normalized.replace(/,/g, '')
    } else {
      normalized = normalized.replace(',', '.')
    }
  } else if (dotCount > 0 && (dotCount > 1 || /^\d{1,3}(\.\d{3})+$/.test(normalized))) {
    normalized = normalized.replace(/\./g, '')
  }

  const parsed = Number.parseFloat(normalized)
  return Number.isFinite(parsed) ? parsed : 0
}

export function formatM2ToHa(value: number | string | null | undefined): string {
  const safe = parseLocalizedNumber(value)
  return `${(safe / 10000).toFixed(2)} ha`
}
