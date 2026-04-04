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

/** Mapare pentru valorile uzuale din `produse.categorie`; orice altă valoare din DB e afișată human-readable. */
export const CATEGORIE_LABEL: Record<string, string> = {
  fruct: 'Fructe',
  leguma: 'Legume',
  procesat: 'Procesate',
  altele: 'Altele',
}

/** Etichetă afișată în UI — derivată din câmpul real `categorie`, fără date demo. */
export function labelForCategory(categorie: string): string {
  const key = categorie.trim()
  if (!key) return '—'
  if (CATEGORIE_LABEL[key]) return CATEGORIE_LABEL[key]
  return key.charAt(0).toUpperCase() + key.slice(1).toLowerCase().replace(/_/g, ' ')
}

export type SortKey = 'name' | 'price-asc' | 'price-desc'
