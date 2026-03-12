export type TipUnitate = 'camp' | 'solar' | 'livada'

export interface ActivityOption {
  value: string
  label: string
}

const DEFAULT_ACTIVITY_OPTIONS: ActivityOption[] = [
  { value: 'fertilizare_foliara', label: 'Fertilizare foliara' },
  { value: 'fertirigare', label: 'Fertirigare' },
  { value: 'fertilizare_baza', label: 'Fertilizare de baza' },
  { value: 'fungicide_pesticide', label: 'Fungicide/Pesticide' },
  { value: 'irigatie', label: 'Irigatie' },
  { value: 'altele', label: 'Altele' },
]

const SOLAR_ACTIVITY_OPTIONS: ActivityOption[] = [
  { value: 'plantare', label: 'Plantare' },
  { value: 'copilit', label: 'Copilit' },
  { value: 'palisat', label: 'Palisat' },
  { value: 'defoliere', label: 'Defoliere' },
  { value: 'fertigare', label: 'Fertigare' },
  { value: 'irigare', label: 'Irigare' },
  { value: 'tratament', label: 'Tratament' },
  { value: 'aerisire_solar', label: 'Aerisire solar' },
  { value: 'recoltare', label: 'Recoltare' },
  { value: 'curatare_solar', label: 'Curatare solar' },
]

const OPTIONS_BY_UNITATE: Record<TipUnitate, ActivityOption[]> = {
  camp: DEFAULT_ACTIVITY_OPTIONS,
  livada: DEFAULT_ACTIVITY_OPTIONS,
  solar: SOLAR_ACTIVITY_OPTIONS,
}

function formatActivityLabel(value: string): string {
  const normalized = value.trim().replace(/_/g, ' ')
  if (!normalized) return 'Activitate'
  return normalized.charAt(0).toUpperCase() + normalized.slice(1)
}

export function normalizeTipUnitate(value: string | null | undefined): TipUnitate {
  const normalized = (value ?? 'camp').trim().toLowerCase()
  if (normalized === 'solar') return 'solar'
  if (normalized === 'livada') return 'livada'
  return 'camp'
}

export function getActivityOptionsForUnitate(tipUnitate: string | null | undefined): ActivityOption[] {
  return OPTIONS_BY_UNITATE[normalizeTipUnitate(tipUnitate)]
}

export function withCurrentActivityOption(options: ActivityOption[], currentValue: string | null | undefined): ActivityOption[] {
  const value = (currentValue ?? '').trim()
  if (!value) return options
  if (options.some((option) => option.value === value)) return options

  return [...options, { value, label: formatActivityLabel(value) }]
}

