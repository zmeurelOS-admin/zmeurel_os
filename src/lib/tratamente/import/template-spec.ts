import { CROP_CODES, normalizeCropCod, type CropCod } from '@/lib/crops/crop-codes'
import {
  getLabelRo,
  listAllStadiiCanonice,
  normalizeStadiu,
  type StadiuCod,
} from '@/lib/tratamente/stadii-canonic'
import { normalizeForSearch } from '@/lib/utils/string'

const IMPORT_CROP_CODES = [...CROP_CODES, 'aronia', 'catina'] as const

const IMPORT_CROP_LABELS: Record<(typeof IMPORT_CROP_CODES)[number], string> = {
  agris: 'Agriș',
  afin: 'Afin',
  ardei: 'Ardei',
  aronia: 'Aronia',
  cais: 'Cais',
  capsun: 'Căpșun',
  castravete: 'Castravete',
  catina: 'Cătină',
  cires: 'Cireș',
  coacaz: 'Coacăz',
  dovlecel: 'Dovlecel',
  mar: 'Măr',
  mur: 'Mur',
  nuc: 'Nuc',
  par: 'Păr',
  piersic: 'Piersic',
  prun: 'Prun',
  ridiche: 'Ridiche',
  rosie: 'Roșie',
  salata: 'Salată',
  spanac: 'Spanac',
  vanata: 'Vânătă',
  visin: 'Vișin',
  zmeur: 'Zmeur',
}

const LEGACY_IMPORT_CULTURE_MAP: Record<string, CulturaImport> = {
  aronia: 'aronia',
  catina: 'catina',
}

export const CULTURI_ACCEPTATE = IMPORT_CROP_CODES
export const STADII_VALIDE = listAllStadiiCanonice() as readonly StadiuCod[]

export type CulturaImport = (typeof CULTURI_ACCEPTATE)[number]
export type StadiuImport = StadiuCod
export type CohortTriggerImport = 'floricane' | 'primocane'

export const STADIU_LABELS: Record<StadiuImport, string> = STADII_VALIDE.reduce<Record<StadiuImport, string>>(
  (accumulator, stadiu) => {
    accumulator[stadiu] = getLabelRo(stadiu)
    return accumulator
  },
  {} as Record<StadiuImport, string>
)

export const CULTURA_LABELS: Record<CulturaImport, string> = IMPORT_CROP_CODES.reduce<Record<CulturaImport, string>>(
  (accumulator, cultura) => {
    accumulator[cultura] = IMPORT_CROP_LABELS[cultura]
    return accumulator
  },
  {} as Record<CulturaImport, string>
)

export const COHORT_TRIGGER_VALUES = ['floricane', 'primocane'] as const
export const COHORT_TRIGGER_LABELS: Record<CohortTriggerImport, string> = {
  floricane: 'floricane',
  primocane: 'primocane',
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

export const CULTURA_LOOKUP_MAP: Record<string, CulturaImport> = {
  ...buildLookup(CULTURI_ACCEPTATE, CULTURA_LABELS),
  rosii: 'rosie',
  castraveti: 'castravete',
  vinete: 'vanata',
  ridichi: 'ridiche',
  afine: 'afin',
  capsuni: 'capsun',
  coacaze: 'coacaz',
  mure: 'mur',
  zmeura: 'zmeur',
}

export function mapImportCohortTrigger(value: string | null | undefined): CohortTriggerImport | null {
  const normalized = normalizeForSearch(value)
  if (!normalized) return null
  if (normalized === 'floricane') return 'floricane'
  if (normalized === 'primocane') return 'primocane'
  return null
}

export function mapImportCulture(value: string | null | undefined): CulturaImport | null {
  const normalizedCrop = normalizeCropCod(value)
  if (normalizedCrop) {
    return normalizedCrop as Extract<CulturaImport, CropCod>
  }

  const normalized = normalizeForSearch(value)
  if (!normalized) return null
  return LEGACY_IMPORT_CULTURE_MAP[normalized] ?? CULTURA_LOOKUP_MAP[normalized] ?? null
}

export function mapImportStage(value: string | null | undefined): StadiuImport | null {
  if (!value) return null
  return normalizeStadiu(value)
}
