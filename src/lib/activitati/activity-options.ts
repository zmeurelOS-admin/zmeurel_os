export type TipUnitate = 'camp' | 'solar' | 'livada' | 'cultura_mare'

export interface ActivityOption {
  value: string
  label: string
}

export const ACTIVITATI_PER_TIP: Record<TipUnitate, string[]> = {
  camp: [
    'Tăiere lăstari',
    'Palisare',
    'Fertilizare foliară',
    'Fertirigare',
    'Fertilizare de bază',
    'Fungicide/Pesticide',
    'Irigație',
    'Prășit',
    'Erbicidat',
    'Mulcire',
    'Recoltare',
    'Altele',
  ],
  solar: [
    'Semănat',
    'Răsădit',
    'Palisare',
    'Fertilizare foliară',
    'Fertirigare',
    'Fungicide/Pesticide',
    'Irigație',
    'Aerisire',
    'Ciupire/Cârnire',
    'Recoltare',
    'Altele',
  ],
  livada: [
    'Tăiere de formare',
    'Tăiere de fructificare',
    'Stropire',
    'Fertilizare',
    'Erbicidat',
    'Cosire',
    'Recoltare',
    'Altele',
  ],
  cultura_mare: [
    'Arat',
    'Discuit',
    'Semănat',
    'Erbicidat',
    'Fertilizare',
    'Tratament fitosanitar',
    'Irigație',
    'Recoltare',
    'Transport',
    'Altele',
  ],
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
  if (normalized === 'cultura_mare') return 'cultura_mare'
  return 'camp'
}

export function getActivityOptionsForUnitate(tipUnitate: string | null | undefined): ActivityOption[] {
  return ACTIVITATI_PER_TIP[normalizeTipUnitate(tipUnitate)].map((label) => ({
    value: label,
    label,
  }))
}

export function withCurrentActivityOption(
  options: ActivityOption[],
  currentValue: string | null | undefined
): ActivityOption[] {
  const value = (currentValue ?? '').trim()
  if (!value) return options
  if (options.some((option) => option.value === value)) return options

  return [...options, { value, label: formatActivityLabel(value) }]
}
