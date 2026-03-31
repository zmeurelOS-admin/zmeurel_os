// ─── Cheltuieli (OPEX) ────────────────────────────────────────────────────────

export const CATEGORII_CHELTUIELI = [
  'Fertilizanți',
  'Tratamente fitosanitare',
  'Ambalaje',
  'Forță de muncă',
  'Combustibil și energie',
  'Consumabile',
  'Transport și livrare',
  'Reparații și întreținere',
  'Servicii și taxe',
  'Diverse operaționale',
] as const

export type CategorieCheltuiala = (typeof CATEGORII_CHELTUIELI)[number]

// ─── Investiții (CAPEX) ───────────────────────────────────────────────────────

export const CATEGORII_INVESTITII = [
  'Material săditor',
  'Irigații și fertigare',
  'Sisteme de susținere și protecție',
  'Construcții și amenajări',
  'Utilaje și echipamente',
  'Depozitare și răcire',
  'Infrastructură și utilități',
  'IT și automatizări',
  'Alte investiții',
] as const

export type CategorieInvestitie = (typeof CATEGORII_INVESTITII)[number]

// ─── Mapare categorii vechi → noi (pentru migrare afișaj + filtre) ────────────

export const CHELTUIELI_LEGACY_MAP: Record<string, string> = {
  Electricitate: 'Combustibil și energie',
  'Motorina Transport': 'Combustibil și energie',
  Etichete: 'Ambalaje',
  'Reparatii Utilaje': 'Reparații și întreținere',
  'Intretinere Curenta': 'Reparații și întreținere',
  Scule: 'Consumabile',
  Fertilizare: 'Fertilizanți',
  Pesticide: 'Tratamente fitosanitare',
  Cules: 'Forță de muncă',
  'Manoperă cules': 'Forță de muncă',
  'Material Saditor': 'Diverse operaționale',
  'Sistem Sustinere': 'Diverse operaționale',
  'Sistem Irigatie': 'Diverse operaționale',
  Altele: 'Diverse operaționale',
}

export const INVESTITII_LEGACY_MAP: Record<string, string> = {
  Butași: 'Material săditor',
  'Sistem Irigație': 'Irigații și fertigare',
  'Solar / Tunel': 'Sisteme de susținere și protecție',
  Utilaje: 'Utilaje și echipamente',
  Depozitare: 'Depozitare și răcire',
  Ambalaje: 'Alte investiții',
  Altele: 'Alte investiții',
}

function normalizeCategoryKey(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
}

const CHELTUIELI_CANONICAL_SET = new Set<string>(CATEGORII_CHELTUIELI)
const INVESTITII_CANONICAL_SET = new Set<string>(CATEGORII_INVESTITII)
const CHELTUIELI_LEGACY_MAP_NORMALIZED = new Map(
  Object.entries(CHELTUIELI_LEGACY_MAP).map(([key, value]) => [normalizeCategoryKey(key), value])
)
const INVESTITII_LEGACY_MAP_NORMALIZED = new Map(
  Object.entries(INVESTITII_LEGACY_MAP).map(([key, value]) => [normalizeCategoryKey(key), value])
)

// ─── Fallback display — rezolvă categorii vechi din DB ────────────────────────

/** Returnează categoria canonică pentru o cheltuială, inclusiv pentru valori legacy. */
export function resolveCheltuialaCategorie(raw: string | null | undefined): string {
  if (!raw) return 'Diverse operaționale'
  if (CHELTUIELI_CANONICAL_SET.has(raw)) return raw
  const normalized = normalizeCategoryKey(raw)
  const mapped = CHELTUIELI_LEGACY_MAP_NORMALIZED.get(normalized)
  return mapped ?? raw
}

/** Returnează categoria canonică pentru o investiție, inclusiv pentru valori legacy. */
export function resolveInvestitieCategorie(raw: string | null | undefined): string {
  if (!raw) return 'Alte investiții'
  if (INVESTITII_CANONICAL_SET.has(raw)) return raw
  const normalized = normalizeCategoryKey(raw)
  const mapped = INVESTITII_LEGACY_MAP_NORMALIZED.get(normalized)
  return mapped ?? raw
}
