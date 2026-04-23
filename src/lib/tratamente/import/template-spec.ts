import { CROP_CODES, normalizeCropCod, type CropCod } from '@/lib/crops/crop-codes'
import {
  getLabelRo,
  listAllStadiiCanonice,
  normalizeStadiu,
  type StadiuCod,
} from '@/lib/tratamente/stadii-canonic'
import { normalizeForSearch } from '@/lib/utils/string'

const IMPORT_CROP_CODES = [...CROP_CODES] as const

const IMPORT_CROP_LABELS: Record<(typeof IMPORT_CROP_CODES)[number], string> = {
  agris: 'Agriș',
  afin: 'Afin',
  ardei: 'Ardei',
  alun: 'Alun',
  aronia: 'Aronia',
  cais: 'Cais',
  broccoli: 'Broccoli',
  busuioc: 'Busuioc',
  cartof: 'Cartof',
  capsun: 'Căpșun',
  castravete: 'Castravete',
  catina: 'Cătină',
  ceapa: 'Ceapă',
  cires: 'Cireș',
  coacaz: 'Coacăz',
  conopida: 'Conopidă',
  dovlecel: 'Dovlecel',
  fasole: 'Fasole',
  goji: 'Goji',
  gulie: 'Gulie',
  mar: 'Măr',
  mazare: 'Mazăre',
  morcov: 'Morcov',
  mur: 'Mur',
  nuc: 'Nuc',
  par: 'Păr',
  patrunjel: 'Pătrunjel',
  piersic: 'Piersic',
  praz: 'Praz',
  prun: 'Prun',
  ridiche: 'Ridiche',
  rosie: 'Roșie',
  rucola: 'Rucola',
  salata: 'Salată',
  sfecla: 'Sfeclă',
  spanac: 'Spanac',
  telina: 'Țelină',
  usturoi: 'Usturoi',
  vanata: 'Vânătă',
  varza: 'Varză',
  visin: 'Vișin',
  zmeur: 'Zmeur',
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

export const TIP_INTERVENTIE_VALUES = [
  'protectie',
  'nutritie',
  'biostimulare',
  'erbicidare',
  'igiena',
  'monitorizare',
  'altul',
] as const

export type TipInterventieImport = (typeof TIP_INTERVENTIE_VALUES)[number]

export const TIP_INTERVENTIE_LABELS: Record<TipInterventieImport, string> = {
  protectie: 'Protecție',
  nutritie: 'Nutriție',
  biostimulare: 'Biostimulare',
  erbicidare: 'Erbicidare',
  igiena: 'Igienă',
  monitorizare: 'Monitorizare',
  altul: 'Altul',
}

export const REGULA_REPETARE_VALUES = ['fara_repetare', 'interval'] as const

export type RegulaRepetareImport = (typeof REGULA_REPETARE_VALUES)[number]

export const REGULA_REPETARE_LABELS: Record<RegulaRepetareImport, string> = {
  fara_repetare: 'Fără repetare',
  interval: 'Interval',
}

export const TIP_PRODUS_VALUES = [
  'fungicid',
  'insecticid',
  'erbicid',
  'acaricid',
  'foliar',
  'ingrasamant',
  'bioregulator',
  'altul',
] as const

export const SHEET_NAMES_RESERVED = [
  'Instructions',
  'Interventii',
  'Produse interventii',
  'Stadii valide',
  'Culturi acceptate',
  'Cohorte valide',
  'Tipuri interventie',
  'Reguli repetare',
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

export function mapImportTipInterventie(value: string | null | undefined): TipInterventieImport | null {
  const normalized = normalizeForSearch(value)
  if (!normalized) return null
  const lookup = buildLookup(TIP_INTERVENTIE_VALUES, TIP_INTERVENTIE_LABELS)
  return lookup[normalized] ?? null
}

export function mapImportRegulaRepetare(value: string | null | undefined): RegulaRepetareImport | null {
  const normalized = normalizeForSearch(value)
  if (!normalized) return 'fara_repetare'
  const lookup = buildLookup(REGULA_REPETARE_VALUES, REGULA_REPETARE_LABELS)
  return lookup[normalized] ?? null
}

export function mapImportCulture(value: string | null | undefined): CulturaImport | null {
  const normalizedCrop = normalizeCropCod(value)
  if (normalizedCrop) {
    return normalizedCrop as Extract<CulturaImport, CropCod>
  }

  const normalized = normalizeForSearch(value)
  if (!normalized) return null
  return CULTURA_LOOKUP_MAP[normalized] ?? null
}

export function mapImportStage(value: string | null | undefined): StadiuImport | null {
  if (!value) return null
  return normalizeStadiu(value)
}
