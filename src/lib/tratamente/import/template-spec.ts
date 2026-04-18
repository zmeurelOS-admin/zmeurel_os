import { normalizeForSearch } from '@/lib/utils/string'

export const CULTURI_ACCEPTATE = ['zmeur', 'capsun', 'mur', 'afin', 'aronia', 'catina'] as const

export const STADII_VALIDE = [
  'repaus_vegetativ',
  'umflare_muguri',
  'dezmugurire',
  'inmugurire',
  'prefloral',
  'inflorire',
  'cadere_petale',
  'legare_fruct',
  'crestere_fruct',
  'parguire',
  'maturare',
  'post_recoltare',
] as const

export type CulturaImport = (typeof CULTURI_ACCEPTATE)[number]
export type StadiuImport = (typeof STADII_VALIDE)[number]

export const STADIU_LABELS: Record<StadiuImport, string> = {
  repaus_vegetativ: 'Repaus vegetativ',
  umflare_muguri: 'Umflare muguri',
  dezmugurire: 'Dezmugurire',
  inmugurire: 'Înmugurire',
  prefloral: 'Prefloral',
  inflorire: 'Înflorire',
  cadere_petale: 'Cădere petale',
  legare_fruct: 'Legare fruct',
  crestere_fruct: 'Creștere fruct',
  parguire: 'Pârguire',
  maturare: 'Maturare',
  post_recoltare: 'Post-recoltare',
}

export const CULTURA_LABELS: Record<CulturaImport, string> = {
  zmeur: 'Zmeur',
  capsun: 'Căpșun',
  mur: 'Mur',
  afin: 'Afin',
  aronia: 'Aronia',
  catina: 'Cătină',
}

export const SHEET_NAMES_RESERVED = [
  'Instructions',
  'Stadii valide',
  'Culturi acceptate',
  'Produse standard',
  'Exemplu zmeur',
] as const

function buildLookup<const T extends readonly string[]>(
  values: T,
  labels: Record<T[number], string>
) {
  return values.reduce<Record<string, T[number]>>((accumulator, value) => {
    const typedValue = value as T[number]
    accumulator[normalizeForSearch(typedValue)] = typedValue
    accumulator[normalizeForSearch(labels[typedValue])] = typedValue
    return accumulator
  }, {})
}

export const CULTURA_LOOKUP_MAP = buildLookup(CULTURI_ACCEPTATE, CULTURA_LABELS)
export const STADIU_LOOKUP_MAP = buildLookup(STADII_VALIDE, STADIU_LABELS)

export function mapImportCulture(value: string | null | undefined): CulturaImport | null {
  const normalized = normalizeForSearch(value)
  return normalized ? CULTURA_LOOKUP_MAP[normalized] ?? null : null
}

export function mapImportStage(value: string | null | undefined): StadiuImport | null {
  const normalized = normalizeForSearch(value)
  return normalized ? STADIU_LOOKUP_MAP[normalized] ?? null : null
}
