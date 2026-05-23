export type TipUnitate = 'camp' | 'solar' | 'livada' | 'cultura_mare'

export interface ActivityOption {
  value: string
  label: string
}

export const ACTIVITATI_PER_TIP: Record<TipUnitate, string[]> = {
  camp: [
    'Tăiere lăstari',
    'Palisare',
    'Irigație',
    'Prășit',
    'Mulcire',
    'Recoltare',
    'Altele',
  ],
  solar: [
    'Semănat',
    'Răsădit',
    'Palisare',
    'Irigație',
    'Aerisire',
    'Ciupire/Cârnire',
    'Recoltare',
    'Altele',
  ],
  livada: [
    'Tăiere de formare',
    'Tăiere de fructificare',
    'Cosire',
    'Recoltare',
    'Altele',
  ],
  cultura_mare: [
    'Arat',
    'Discuit',
    'Semănat',
    'Irigație',
    'Recoltare',
    'Transport',
    'Altele',
  ],
}

/** Toate tipurile canonice (pentru teste și validare mapare). */
export const ALL_ACTIVITY_TYPE_LABELS = Array.from(
  new Set(Object.values(ACTIVITATI_PER_TIP).flat())
) as readonly string[]

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

export const TIPURI_ACTIVITATE_DEPRECATE = new Set([
  'Fungicide/Pesticide',
  'Fertilizare foliară',
  'Fertilizare Foliara',
  'Fertilizare foliar',
  'Fertirigare',
  'fertigare',
  'Fertilizare de bază',
  'Fertilizare de baza',
  'Fertilizare',
  'Fertilizare Chimica',
  'Fertilizare Organica',
  'Tratament',
  'tratament',
  'Tratament fitosanitar',
  'Tratament Fungicid',
  'Tratament Insecticid',
  'Tratament Erbicid',
  'Erbicidat',
  'Stropire',
])

// Detectează variante legacy și free-text prin comparație lower/trim.
export function isTipActivitateDeprecata(tip: string): boolean {
  const normalized = tip.toLowerCase().trim()
  return [...TIPURI_ACTIVITATE_DEPRECATE].some(
    (value) => value.toLowerCase().trim() === normalized
  )
}

export function normalizeActivityText(value: string | null | undefined): string {
  return (value ?? '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
}

/** Emoji pentru tip operațiune — aceeași logică ca în dropdownul „Tip operațiune”. */
export function getActivityEmoji(value: string | null | undefined): string {
  const normalized = normalizeActivityText(value)
  if (!normalized) return '🔧'
  if (normalized.includes('lastar')) return '🌿'
  if (normalized.includes('palis')) return '🪢'
  if (normalized.includes('irig')) return '💧'
  if (normalized.includes('pras')) return '⛏️'
  if (normalized.includes('mulc')) return '🍂'
  if (normalized.includes('recolt') || normalized.includes('cules')) return '🧺'
  if (normalized.includes('formare') || normalized.includes('fructificare')) return '🌳'
  if (normalized.includes('copilit') || normalized.includes('ciup') || normalized.includes('carnir')) return '✂️'
  if (normalized.includes('curata') || normalized.includes('tund') || normalized.includes('tai')) return '✂️'
  if (normalized.includes('cosir')) return '✂️'
  if (normalized.includes('arat') || normalized.includes('discuit') || normalized.includes('transport')) return '🚜'
  if (normalized.includes('aeris') || normalized.includes('rasad') || normalized.includes('seman')) return '🏡'
  if (normalized === 'altele') return '🔧'
  return '🔧'
}

/** Label afișat în listă — valoarea salvată, fără remapare greșită la „Altele”. */
export function getActivityDisplayLabel(value: string | null | undefined): string {
  const current = (value ?? '').trim()
  if (!current) return 'Activitate'
  return current
}

/** Label cu emoji (dropdown, rezumat formular). */
export function formatActivityTypeLabel(value: string | null | undefined): string {
  const current = (value ?? '').trim()
  if (!current) return '—'
  return `${getActivityEmoji(current)} ${current}`
}
