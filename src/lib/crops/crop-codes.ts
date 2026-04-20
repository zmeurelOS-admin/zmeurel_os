import { normalizeForSearch } from '@/lib/utils/string'

export type CropCod =
  | 'alun'
  | 'agris'
  | 'afin'
  | 'ardei'
  | 'aronia'
  | 'broccoli'
  | 'busuioc'
  | 'cais'
  | 'cartof'
  | 'capsun'
  | 'castravete'
  | 'catina'
  | 'ceapa'
  | 'cires'
  | 'coacaz'
  | 'conopida'
  | 'dovlecel'
  | 'fasole'
  | 'goji'
  | 'gulie'
  | 'mar'
  | 'mazare'
  | 'morcov'
  | 'mur'
  | 'nuc'
  | 'par'
  | 'patrunjel'
  | 'piersic'
  | 'praz'
  | 'prun'
  | 'ridiche'
  | 'rosie'
  | 'rucola'
  | 'salata'
  | 'sfecla'
  | 'spanac'
  | 'telina'
  | 'usturoi'
  | 'vanata'
  | 'varza'
  | 'visin'
  | 'zmeur'

export const CROP_CODES = [
  'alun',
  'agris',
  'afin',
  'ardei',
  'aronia',
  'broccoli',
  'busuioc',
  'cais',
  'cartof',
  'capsun',
  'castravete',
  'catina',
  'ceapa',
  'cires',
  'coacaz',
  'conopida',
  'dovlecel',
  'fasole',
  'goji',
  'gulie',
  'mar',
  'mazare',
  'morcov',
  'mur',
  'nuc',
  'par',
  'patrunjel',
  'piersic',
  'praz',
  'prun',
  'ridiche',
  'rosie',
  'rucola',
  'salata',
  'sfecla',
  'spanac',
  'telina',
  'usturoi',
  'vanata',
  'varza',
  'visin',
  'zmeur',
] as const satisfies readonly CropCod[]

const CROP_CODE_SET = new Set<string>(CROP_CODES)

const LEGACY_CROP_CODE_MAP: Record<string, CropCod> = {
  alun: 'alun',
  agris: 'agris',
  afin: 'afin',
  afine: 'afin',
  ardei: 'ardei',
  aronia: 'aronia',
  broccoli: 'broccoli',
  brocoli: 'broccoli',
  busuioc: 'busuioc',
  cais: 'cais',
  cartof: 'cartof',
  cartofi: 'cartof',
  capsun: 'capsun',
  capsuni: 'capsun',
  castravete: 'castravete',
  castraveti: 'castravete',
  catina: 'catina',
  catină: 'catina',
  ceapa: 'ceapa',
  ceapă: 'ceapa',
  cires: 'cires',
  coacaz: 'coacaz',
  coacaze: 'coacaz',
  conopida: 'conopida',
  conopidă: 'conopida',
  dovlecel: 'dovlecel',
  fasole: 'fasole',
  goji: 'goji',
  gulie: 'gulie',
  mar: 'mar',
  mazare: 'mazare',
  morcov: 'morcov',
  morcovi: 'morcov',
  mur: 'mur',
  mure: 'mur',
  nuc: 'nuc',
  par: 'par',
  patrunjel: 'patrunjel',
  pătrunjel: 'patrunjel',
  piersic: 'piersic',
  praz: 'praz',
  prun: 'prun',
  ridiche: 'ridiche',
  ridichi: 'ridiche',
  rosie: 'rosie',
  rosii: 'rosie',
  rucola: 'rucola',
  salata: 'salata',
  sfecla: 'sfecla',
  spanac: 'spanac',
  telina: 'telina',
  țelina: 'telina',
  usturoi: 'usturoi',
  vanata: 'vanata',
  varza: 'varza',
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
