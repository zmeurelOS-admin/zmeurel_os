export type UnitateTip = 'camp' | 'solar' | 'livada'

export function normalizeUnitateTip(value: string | null | undefined): UnitateTip {
  const normalized = String(value ?? '').trim().toLowerCase()
  if (normalized === 'solar') return 'solar'
  if (normalized === 'livada') return 'livada'
  return 'camp'
}

export function getUnitateTipLabel(value: string | null | undefined): 'Camp' | 'Solar' | 'Livada' {
  const tip = normalizeUnitateTip(value)
  if (tip === 'solar') return 'Solar'
  if (tip === 'livada') return 'Livada'
  return 'Camp'
}

export function getUnitateFilterLabel(value: UnitateTip | 'toate'): string {
  if (value === 'solar') return 'Solarii'
  if (value === 'livada') return 'Livada'
  if (value === 'camp') return 'Camp'
  return 'Toate'
}

export function formatUnitateDisplayName(
  nume: string | null | undefined,
  tip: string | null | undefined,
  fallback = 'Parcela'
): string {
  const baseName = (nume ?? '').trim() || fallback
  return `${baseName} (${getUnitateTipLabel(tip)})`
}
