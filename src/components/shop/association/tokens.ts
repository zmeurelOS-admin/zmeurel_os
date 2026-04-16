/** Branding magazin asociație — folosit doar sub `/magazin/asociatie`. */
export const ASSOC = {
  green: '#0D6342',
  orange: '#FF9E1B',
  cream: '#FFF9E3',
  creamMid: '#F5EDCA',
  text: '#3D4543',
  textMuted: '#6B7A72',
  border: '#E8E0C4',
} as const

export const PAGE_PX = 'px-4 md:px-6 lg:px-8'

export const ASSOCIATION_CATEGORY_KEYS = [
  'fructe_legume',
  'lactate_branzeturi',
  'carne_mezeluri',
  'miere_apicole',
  'conserve_muraturi',
  'panificatie_patiserie',
  'bauturi',
  'oua',
  'altele',
] as const

export type AssociationCategoryKey = (typeof ASSOCIATION_CATEGORY_KEYS)[number]
export type AssociationCategoryDefinition = {
  key: AssociationCategoryKey
  label: string
  sortOrder: number
}

export const ASSOCIATION_CATEGORY_LABELS: Record<AssociationCategoryKey, string> = {
  fructe_legume: 'Fructe și legume',
  lactate_branzeturi: 'Lactate și brânzeturi',
  carne_mezeluri: 'Carne și mezeluri',
  miere_apicole: 'Miere și produse apicole',
  conserve_muraturi: 'Conserve și murături',
  panificatie_patiserie: 'Panificație și patiserie',
  bauturi: 'Băuturi (sucuri, siropuri)',
  oua: 'Ouă',
  altele: 'Altele',
}

export const DEFAULT_ASSOCIATION_CATEGORY_DEFINITIONS: AssociationCategoryDefinition[] = [
  { key: 'fructe_legume', label: 'Fructe și legume', sortOrder: 10 },
  { key: 'lactate_branzeturi', label: 'Lactate și brânzeturi', sortOrder: 20 },
  { key: 'carne_mezeluri', label: 'Carne și mezeluri', sortOrder: 30 },
  { key: 'miere_apicole', label: 'Miere și produse apicole', sortOrder: 40 },
  { key: 'conserve_muraturi', label: 'Conserve și murături', sortOrder: 50 },
  { key: 'panificatie_patiserie', label: 'Panificație și patiserie', sortOrder: 60 },
  { key: 'bauturi', label: 'Băuturi (sucuri, siropuri)', sortOrder: 70 },
  { key: 'oua', label: 'Ouă', sortOrder: 80 },
  { key: 'altele', label: 'Altele', sortOrder: 90 },
]

const LEGACY_TO_ASSOCIATION_CATEGORY: Record<string, AssociationCategoryKey> = {
  fruct: 'fructe_legume',
  leguma: 'fructe_legume',
  procesat: 'altele',
  altele: 'altele',
}

/** Mapare pentru valorile uzuale din `produse.categorie`; orice altă valoare din DB e afișată human-readable. */
export const CATEGORIE_LABEL: Record<string, string> = {
  fruct: 'Fructe',
  leguma: 'Legume',
  procesat: 'Procesate',
  altele: 'Altele',
}

export function resolveAssociationCategory(
  associationCategory: string | null | undefined,
  legacyCategory?: string | null | undefined,
): AssociationCategoryKey {
  const assocKey = associationCategory?.trim() as AssociationCategoryKey | undefined
  if (assocKey && assocKey in ASSOCIATION_CATEGORY_LABELS) return assocKey

  const legacyKey = legacyCategory?.trim().toLowerCase()
  if (legacyKey && legacyKey in LEGACY_TO_ASSOCIATION_CATEGORY) {
    return LEGACY_TO_ASSOCIATION_CATEGORY[legacyKey]
  }

  return 'altele'
}

/** Etichetă afișată în UI — derivată din câmpul real `categorie`, fără date demo. */
export function labelForCategory(categorie: string): string {
  const key = categorie.trim()
  if (!key) return '—'
  if (key in ASSOCIATION_CATEGORY_LABELS) {
    return ASSOCIATION_CATEGORY_LABELS[key as AssociationCategoryKey]
  }
  if (CATEGORIE_LABEL[key]) return CATEGORIE_LABEL[key]
  return key.charAt(0).toUpperCase() + key.slice(1).toLowerCase().replace(/_/g, ' ')
}

export function labelForAssociationCategoryKey(
  key: string,
  definitions: readonly Pick<AssociationCategoryDefinition, 'key' | 'label'>[] = DEFAULT_ASSOCIATION_CATEGORY_DEFINITIONS,
): string {
  const normalized = key.trim() as AssociationCategoryKey
  const match = definitions.find((row) => row.key === normalized)
  if (match?.label?.trim()) return match.label.trim()
  return labelForCategory(key)
}

export type SortKey = 'name' | 'recommended' | 'newest' | 'most-ordered' | 'price-asc' | 'price-desc'
