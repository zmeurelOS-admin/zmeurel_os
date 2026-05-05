import type { CropCod } from '@/lib/crops/crop-codes'
import { normalizeForSearch } from '@/lib/utils/string'

export type StadiuCod =
  | 'rasad'
  | 'semanat'
  | 'repaus_vegetativ'
  | 'transplant'
  | 'umflare_muguri'
  | 'crestere_vegetativa'
  | 'formare_rozeta'
  | 'buton_verde'
  | 'etaj_floral'
  | 'buton_roz'
  | 'inflorit'
  | 'scuturare_petale'
  | 'legare_fruct'
  | 'fruct_verde'
  | 'formare_capatana'
  | 'bulbificare'
  | 'umplere_pastaie'
  | 'ingrosare_radacina'
  | 'parga'
  | 'maturitate'
  | 'bolting'
  | 'post_recoltare'

export type ManagementCategory =
  | 'repaus'
  | 'vegetativ'
  | 'prefloral'
  | 'inflorit'
  | 'fruct_mic'
  | 'coacere'
  | 'post_recoltare'

export type GrupBiologic =
  | 'rubus'
  | 'arbusti_fara_cane'
  | 'pomi_samanoase'
  | 'pomi_samburoase'
  | 'nucifere'
  | 'solanacee'
  | 'cucurbitacee'
  | 'brassicaceae'
  | 'allium'
  | 'leguminoase'
  | 'radacinoase'
  | 'frunzoase'

export type StadiuMetaEntry = {
  cod: StadiuCod
  label_ro: string
  ordine: number
  management_category: ManagementCategory
}

export type StadiuLabelCohorta = 'floricane' | 'primocane'

const DEFAULT_GRUP_BIOLOGIC: GrupBiologic = 'rubus'

const RUBUS_STADII_IN_ORDINE: readonly StadiuCod[] = [
  'repaus_vegetativ',
  'umflare_muguri',
  'buton_verde',
  'buton_roz',
  'inflorit',
  'scuturare_petale',
  'legare_fruct',
  'fruct_verde',
  'parga',
  'maturitate',
  'post_recoltare',
]

const DEFAULT_STADII_IN_ORDINE: readonly StadiuCod[] = RUBUS_STADII_IN_ORDINE

const MANAGEMENT_CATEGORY_ORDER: readonly ManagementCategory[] = [
  'repaus',
  'vegetativ',
  'prefloral',
  'inflorit',
  'fruct_mic',
  'coacere',
  'post_recoltare',
]

export const STADII_META: Record<StadiuCod, StadiuMetaEntry> = {
  rasad: {
    cod: 'rasad',
    label_ro: 'Răsad',
    ordine: 0,
    management_category: 'vegetativ',
  },
  semanat: {
    cod: 'semanat',
    label_ro: 'Semănat / răsărire',
    ordine: 0,
    management_category: 'vegetativ',
  },
  repaus_vegetativ: {
    cod: 'repaus_vegetativ',
    label_ro: 'Repaus vegetativ',
    ordine: 1,
    management_category: 'repaus',
  },
  transplant: {
    cod: 'transplant',
    label_ro: 'Transplant / prindere',
    ordine: 1,
    management_category: 'vegetativ',
  },
  umflare_muguri: {
    cod: 'umflare_muguri',
    label_ro: 'Umflare muguri',
    ordine: 2,
    management_category: 'vegetativ',
  },
  crestere_vegetativa: {
    cod: 'crestere_vegetativa',
    label_ro: 'Creștere vegetativă',
    ordine: 2,
    management_category: 'vegetativ',
  },
  formare_rozeta: {
    cod: 'formare_rozeta',
    label_ro: 'Formare rozetă',
    ordine: 2,
    management_category: 'vegetativ',
  },
  buton_verde: {
    cod: 'buton_verde',
    label_ro: 'Buton verde',
    ordine: 3,
    management_category: 'vegetativ',
  },
  etaj_floral: {
    cod: 'etaj_floral',
    label_ro: 'Apariție etaj floral',
    ordine: 3,
    management_category: 'prefloral',
  },
  buton_roz: {
    cod: 'buton_roz',
    label_ro: 'Buton roz',
    ordine: 4,
    management_category: 'prefloral',
  },
  inflorit: {
    cod: 'inflorit',
    label_ro: 'Înflorit',
    ordine: 5,
    management_category: 'inflorit',
  },
  scuturare_petale: {
    cod: 'scuturare_petale',
    label_ro: 'Scuturare petale',
    ordine: 6,
    management_category: 'inflorit',
  },
  legare_fruct: {
    cod: 'legare_fruct',
    label_ro: 'Legare fruct',
    ordine: 6,
    management_category: 'fruct_mic',
  },
  fruct_verde: {
    cod: 'fruct_verde',
    label_ro: 'Fruct verde',
    ordine: 7,
    management_category: 'fruct_mic',
  },
  formare_capatana: {
    cod: 'formare_capatana',
    label_ro: 'Formare căpățână',
    ordine: 6,
    management_category: 'fruct_mic',
  },
  bulbificare: {
    cod: 'bulbificare',
    label_ro: 'Bulbificare',
    ordine: 6,
    management_category: 'fruct_mic',
  },
  umplere_pastaie: {
    cod: 'umplere_pastaie',
    label_ro: 'Umplere păstaie',
    ordine: 6,
    management_category: 'fruct_mic',
  },
  ingrosare_radacina: {
    cod: 'ingrosare_radacina',
    label_ro: 'Îngroșare rădăcină',
    ordine: 6,
    management_category: 'fruct_mic',
  },
  parga: {
    cod: 'parga',
    label_ro: 'Pârgă',
    ordine: 8,
    management_category: 'coacere',
  },
  maturitate: {
    cod: 'maturitate',
    label_ro: 'Maturitate',
    ordine: 9,
    management_category: 'post_recoltare',
  },
  bolting: {
    cod: 'bolting',
    label_ro: 'Înspicuire (bolting)',
    ordine: 10,
    management_category: 'post_recoltare',
  },
  post_recoltare: {
    cod: 'post_recoltare',
    label_ro: 'Post-recoltare',
    ordine: 10,
    management_category: 'post_recoltare',
  },
}

export const PROFILURI_STADII_PER_GRUP: Record<GrupBiologic, readonly StadiuCod[]> = {
  rubus: RUBUS_STADII_IN_ORDINE,
  arbusti_fara_cane: [
    'repaus_vegetativ',
    'umflare_muguri',
    'buton_verde',
    'inflorit',
    'scuturare_petale',
    'fruct_verde',
    'parga',
    'maturitate',
    'post_recoltare',
  ],
  pomi_samanoase: [
    'repaus_vegetativ',
    'umflare_muguri',
    'buton_verde',
    'buton_roz',
    'inflorit',
    'scuturare_petale',
    'legare_fruct',
    'fruct_verde',
    'parga',
    'maturitate',
    'post_recoltare',
  ],
  pomi_samburoase: [
    'repaus_vegetativ',
    'umflare_muguri',
    'buton_verde',
    'buton_roz',
    'inflorit',
    'scuturare_petale',
    'legare_fruct',
    'fruct_verde',
    'parga',
    'maturitate',
    'post_recoltare',
  ],
  nucifere: [
    'repaus_vegetativ',
    'umflare_muguri',
    'buton_verde',
    'inflorit',
    'legare_fruct',
    'fruct_verde',
    'maturitate',
    'post_recoltare',
  ],
  solanacee: [
    'rasad',
    'transplant',
    'crestere_vegetativa',
    'etaj_floral',
    'inflorit',
    'legare_fruct',
    'fruct_verde',
    'parga',
    'maturitate',
    'post_recoltare',
  ],
  cucurbitacee: [
    'rasad',
    'transplant',
    'crestere_vegetativa',
    'inflorit',
    'legare_fruct',
    'fruct_verde',
    'maturitate',
    'post_recoltare',
  ],
  brassicaceae: [
    'rasad',
    'transplant',
    'crestere_vegetativa',
    'formare_rozeta',
    'formare_capatana',
    'maturitate',
    'post_recoltare',
  ],
  allium: [
    'semanat',
    'crestere_vegetativa',
    'bulbificare',
    'parga',
    'maturitate',
    'post_recoltare',
  ],
  leguminoase: [
    'semanat',
    'crestere_vegetativa',
    'inflorit',
    'legare_fruct',
    'umplere_pastaie',
    'maturitate',
    'post_recoltare',
  ],
  radacinoase: [
    'semanat',
    'crestere_vegetativa',
    'formare_rozeta',
    'ingrosare_radacina',
    'maturitate',
    'post_recoltare',
  ],
  frunzoase: [
    'semanat',
    'crestere_vegetativa',
    'maturitate',
    'bolting',
    'post_recoltare',
  ],
}

export const GRUP_BIOLOGIC_BY_CROP_COD: Record<CropCod, GrupBiologic> = {
  alun: 'nucifere',
  zmeur: 'rubus',
  mur: 'rubus',
  afin: 'arbusti_fara_cane',
  coacaz: 'arbusti_fara_cane',
  agris: 'arbusti_fara_cane',
  capsun: 'arbusti_fara_cane',
  goji: 'arbusti_fara_cane',
  aronia: 'arbusti_fara_cane',
  catina: 'arbusti_fara_cane',
  mar: 'pomi_samanoase',
  par: 'pomi_samanoase',
  prun: 'pomi_samburoase',
  cires: 'pomi_samburoase',
  visin: 'pomi_samburoase',
  cais: 'pomi_samburoase',
  piersic: 'pomi_samburoase',
  nuc: 'nucifere',
  rosie: 'solanacee',
  ardei: 'solanacee',
  vanata: 'solanacee',
  cartof: 'solanacee',
  castravete: 'cucurbitacee',
  dovlecel: 'cucurbitacee',
  varza: 'brassicaceae',
  broccoli: 'brassicaceae',
  conopida: 'brassicaceae',
  gulie: 'brassicaceae',
  ceapa: 'allium',
  usturoi: 'allium',
  praz: 'allium',
  fasole: 'leguminoase',
  mazare: 'leguminoase',
  morcov: 'radacinoase',
  patrunjel: 'radacinoase',
  telina: 'radacinoase',
  sfecla: 'radacinoase',
  salata: 'frunzoase',
  spanac: 'frunzoase',
  ridiche: 'radacinoase',
  rucola: 'frunzoase',
  busuioc: 'frunzoase',
}

const RUBUS_LABELS: Partial<Record<StadiuCod, string>> = {
  repaus_vegetativ: 'Repausul tufei',
  umflare_muguri: 'Pornire în vegetație',
  buton_verde: 'Inflorescențe vizibile',
  buton_roz: 'Boboci florali',
  inflorit: 'Înflorit',
  scuturare_petale: 'Sfârșit de înflorit',
  fruct_verde: 'Fructe verzi în creștere',
  parga: 'Început de coacere',
  maturitate: 'Recoltare / fruct copt',
  post_recoltare: 'După recoltare',
}

const RUBUS_LABELS_BY_COHORT: Record<StadiuLabelCohorta, Partial<Record<StadiuCod, string>>> = {
  floricane: {
    repaus_vegetativ: 'Floricane în repaus',
    umflare_muguri: 'Pornire muguri pe floricane',
    buton_verde: 'Inflorescențe pe floricane',
    buton_roz: 'Boboci pe floricane',
    inflorit: 'Înflorit pe floricane',
    scuturare_petale: 'Sfârșit înflorit pe floricane',
    fruct_verde: 'Fructe verzi pe floricane',
    parga: 'Primele fructe colorate',
    maturitate: 'Recoltare pe floricane',
    post_recoltare: 'După recoltare floricane',
  },
  primocane: {
    repaus_vegetativ: 'Primocane în repaus',
    umflare_muguri: 'Pornire lăstari noi',
    buton_verde: 'Creștere lăstari primocane',
    buton_roz: 'Boboci pe primocane',
    inflorit: 'Înflorit pe primocane',
    scuturare_petale: 'Sfârșit înflorit pe primocane',
    fruct_verde: 'Fructe verzi pe primocane',
    parga: 'Primele fructe colorate',
    maturitate: 'Recoltare pe primocane',
    post_recoltare: 'După recoltare primocane',
  },
}

const ALL_STADII_CANONICE: readonly StadiuCod[] = [
  'rasad',
  'semanat',
  'repaus_vegetativ',
  'transplant',
  'umflare_muguri',
  'crestere_vegetativa',
  'formare_rozeta',
  'buton_verde',
  'etaj_floral',
  'buton_roz',
  'inflorit',
  'scuturare_petale',
  'legare_fruct',
  'fruct_verde',
  'formare_capatana',
  'bulbificare',
  'umplere_pastaie',
  'ingrosare_radacina',
  'parga',
  'maturitate',
  'bolting',
  'post_recoltare',
]

const STADII_LEGACY_ALIAS_MAP: Record<string, StadiuCod> = {
  rasad: 'rasad',
  semanat: 'semanat',
  rasarire: 'semanat',
  repaus: 'repaus_vegetativ',
  repaus_vegetativ: 'repaus_vegetativ',
  transplant: 'transplant',
  prindere: 'transplant',
  umflare_muguri: 'umflare_muguri',
  dezmugurire: 'umflare_muguri',
  crestere_vegetativa: 'crestere_vegetativa',
  crestere_vegetativ: 'crestere_vegetativa',
  vegetativ: 'crestere_vegetativa',
  formare_rozeta: 'formare_rozeta',
  rozeta: 'formare_rozeta',
  inmugurire: 'buton_verde',
  buton_verde: 'buton_verde',
  etaj_floral: 'etaj_floral',
  aparitie_etaj_floral: 'etaj_floral',
  prefloral: 'buton_roz',
  buton_roz: 'buton_roz',
  inflorit: 'inflorit',
  inflorire: 'inflorit',
  scuturare_petale: 'scuturare_petale',
  cadere_petale: 'scuturare_petale',
  legare_fruct: 'legare_fruct',
  fruct_verde: 'fruct_verde',
  crestere_fruct: 'fruct_verde',
  formare_capatana: 'formare_capatana',
  capatana: 'formare_capatana',
  bulbificare: 'bulbificare',
  umplere_pastaie: 'umplere_pastaie',
  ingrosare_radacina: 'ingrosare_radacina',
  radacina: 'ingrosare_radacina',
  parga: 'parga',
  parguire: 'parga',
  maturitate: 'maturitate',
  maturare: 'maturitate',
  bolting: 'bolting',
  inspicuire: 'bolting',
  post_recoltare: 'post_recoltare',
}

function toLookupKey(value: string): string {
  return normalizeForSearch(value)
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
}

const STADII_LOOKUP = (() => {
  const entries = new Map<string, StadiuCod>()

  for (const cod of ALL_STADII_CANONICE) {
    const meta = STADII_META[cod]
    entries.set(toLookupKey(cod), cod)
    entries.set(toLookupKey(meta.label_ro), cod)
  }

  for (const [legacy, cod] of Object.entries(STADII_LEGACY_ALIAS_MAP)) {
    entries.set(toLookupKey(legacy), cod)
  }

  return entries
})()

export function getLabelRo(cod: StadiuCod): string {
  return STADII_META[cod].label_ro
}

export function getLabelPentruGrup(
  cod: StadiuCod,
  grup: GrupBiologic | null | undefined,
  options?: { cohort?: string | null }
): string {
  if (grup !== 'rubus') return getLabelRo(cod)

  const cohort = options?.cohort === 'floricane' || options?.cohort === 'primocane' ? options.cohort : null
  const cohortLabel = cohort ? RUBUS_LABELS_BY_COHORT[cohort][cod] : null
  return cohortLabel ?? RUBUS_LABELS[cod] ?? getLabelRo(cod)
}

export function getOrdine(cod: StadiuCod): number {
  return STADII_META[cod].ordine
}

export function getManagementCategory(cod: StadiuCod): ManagementCategory {
  return STADII_META[cod].management_category
}

export function listStadiiInOrdine(): StadiuCod[] {
  return [...DEFAULT_STADII_IN_ORDINE]
}

export function listAllStadiiCanonice(): StadiuCod[] {
  return [...ALL_STADII_CANONICE]
}

export function listStadiiByCategory(cat: ManagementCategory): StadiuCod[] {
  return ALL_STADII_CANONICE.filter((cod) => STADII_META[cod].management_category === cat)
}

export function isCategoryAtLeast(current: StadiuCod, threshold: ManagementCategory): boolean {
  const currentIndex = MANAGEMENT_CATEGORY_ORDER.indexOf(getManagementCategory(current))
  const thresholdIndex = MANAGEMENT_CATEGORY_ORDER.indexOf(threshold)

  return currentIndex >= thresholdIndex
}

export function listStadiiPentruGrup(grup: GrupBiologic | null | undefined): StadiuCod[] {
  return [...PROFILURI_STADII_PER_GRUP[grup ?? DEFAULT_GRUP_BIOLOGIC]]
}

export function isStadiuValidPentruGrup(cod: StadiuCod, grup: GrupBiologic): boolean {
  return PROFILURI_STADII_PER_GRUP[grup].includes(cod)
}

export function getOrdineInGrup(cod: StadiuCod, grup: GrupBiologic): number {
  return PROFILURI_STADII_PER_GRUP[grup].indexOf(cod)
}

export function getStadiuUrmatorInGrup(cod: StadiuCod, grup: GrupBiologic): StadiuCod | null {
  const profile = PROFILURI_STADII_PER_GRUP[grup]
  const currentIndex = profile.indexOf(cod)
  if (currentIndex === -1 || currentIndex === profile.length - 1) {
    return null
  }

  return profile[currentIndex + 1] ?? null
}

export function getGrupBiologicForCropCod(cod: CropCod | null | undefined): GrupBiologic | null {
  if (!cod) return null
  return GRUP_BIOLOGIC_BY_CROP_COD[cod] ?? null
}

export function normalizeStadiu(raw: string): StadiuCod | null {
  const key = toLookupKey(raw)
  if (!key) return null
  return STADII_LOOKUP.get(key) ?? null
}
