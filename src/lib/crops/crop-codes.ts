import { normalizeForSearch } from '@/lib/utils/string'

export type CropCod =
  | 'agris'
  | 'afin'
  | 'ardei'
  | 'cais'
  | 'capsun'
  | 'castravete'
  | 'cires'
  | 'coacaz'
  | 'dovlecel'
  | 'mar'
  | 'mur'
  | 'nuc'
  | 'par'
  | 'piersic'
  | 'prun'
  | 'ridiche'
  | 'rosie'
  | 'salata'
  | 'spanac'
  | 'vanata'
  | 'visin'
  | 'zmeur'

export const CROP_CODES = [
  'agris',
  'afin',
  'ardei',
  'cais',
  'capsun',
  'castravete',
  'cires',
  'coacaz',
  'dovlecel',
  'mar',
  'mur',
  'nuc',
  'par',
  'piersic',
  'prun',
  'ridiche',
  'rosie',
  'salata',
  'spanac',
  'vanata',
  'visin',
  'zmeur',
] as const satisfies readonly CropCod[]

const CROP_CODE_SET = new Set<string>(CROP_CODES)

const LEGACY_CROP_CODE_MAP: Record<string, CropCod> = {
  agris: 'agris',
  afin: 'afin',
  afine: 'afin',
  ardei: 'ardei',
  cais: 'cais',
  capsun: 'capsun',
  capsuni: 'capsun',
  castravete: 'castravete',
  castraveti: 'castravete',
  cires: 'cires',
  coacaz: 'coacaz',
  coacaze: 'coacaz',
  dovlecel: 'dovlecel',
  mar: 'mar',
  mur: 'mur',
  mure: 'mur',
  nuc: 'nuc',
  par: 'par',
  piersic: 'piersic',
  prun: 'prun',
  ridiche: 'ridiche',
  ridichi: 'ridiche',
  rosie: 'rosie',
  rosii: 'rosie',
  salata: 'salata',
  spanac: 'spanac',
  vanata: 'vanata',
  vinete: 'vanata',
  visin: 'visin',
  zmeur: 'zmeur',
  zmeura: 'zmeur',
}

export function isValidCropCod(value: string): value is CropCod {
  return CROP_CODE_SET.has(value)
}

export function normalizeCropCod(raw: string | null | undefined): CropCod | null {
  const normalized = normalizeForSearch(raw)
  if (!normalized) return null
  return LEGACY_CROP_CODE_MAP[normalized] ?? null
}
