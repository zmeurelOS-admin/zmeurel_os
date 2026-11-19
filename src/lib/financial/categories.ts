/**
 * Categoriile de cheltuieli și investiții.
 *
 * Din 20.11.2026 sunt 8 categorii de cheltuieli și 6 de investiții. **Datele vechi nu se modifică în baza de date**:
 * categoriile vechi se afișează sub cele noi prin maparea de mai jos. Înregistrările noi se scriu cu numele noi.
 *
 * Orice cititor de categorii (liste, rapoarte, exporturi) trece valoarea din bază prin
 * `resolveCheltuialaCategorie` / `resolveInvestitieCategorie`, altfel aceeași categorie apare de două ori
 * (o dată cu numele vechi, o dată cu cel nou).
 */

// ─── Cheltuieli (OPEX) ────────────────────────────────────────────────────────

export const CATEGORII_CHELTUIELI = [
  'Îngrășăminte',
  'Tratamente',
  'Manoperă',
  'Ambalaje',
  'Motorină și curent',
  'Reparații și consumabile',
  'Taxe și servicii',
  'Altele',
] as const

export type CategorieCheltuiala = (typeof CATEGORII_CHELTUIELI)[number]

/** Numele de dinainte de 20.11.2026. Există în baza de date și le mai trimite chatul AI. */
export const CATEGORII_CHELTUIELI_VECHI = [
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

export type CategorieCheltuialaVeche = (typeof CATEGORII_CHELTUIELI_VECHI)[number]

// ─── Investiții (CAPEX) ───────────────────────────────────────────────────────

export const CATEGORII_INVESTITII = [
  'Plantație',
  'Irigație',
  'Spalier și plase',
  'Utilaje și unelte',
  'Construcții și depozitare',
  'Altele',
] as const

export type CategorieInvestitie = (typeof CATEGORII_INVESTITII)[number]

/** Numele de dinainte de 20.11.2026. */
export const CATEGORII_INVESTITII_VECHI = [
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

export type CategorieInvestitieVeche = (typeof CATEGORII_INVESTITII_VECHI)[number]

function unique<T extends string>(values: readonly T[]): [T, ...T[]] {
  return [...new Set(values)] as [T, ...T[]]
}

/** Tot ce e acceptat la intrare (nume noi și vechi), pentru validarea a ceea ce vine din chatul AI. */
export const CATEGORII_CHELTUIELI_ACCEPTATE = unique<string>([...CATEGORII_CHELTUIELI_VECHI, ...CATEGORII_CHELTUIELI])
export const CATEGORII_INVESTITII_ACCEPTATE = unique<string>([...CATEGORII_INVESTITII_VECHI, ...CATEGORII_INVESTITII])

// ─── Mapare vechi → nou ───────────────────────────────────────────────────────

export const CHELTUIELI_LEGACY_MAP: Record<string, CategorieCheltuiala> = {
  // Cele 10 categorii de până la 20.11.2026.
  Fertilizanți: 'Îngrășăminte',
  'Tratamente fitosanitare': 'Tratamente',
  'Forță de muncă': 'Manoperă',
  'Combustibil și energie': 'Motorină și curent',
  Consumabile: 'Reparații și consumabile',
  'Transport și livrare': 'Motorină și curent',
  'Reparații și întreținere': 'Reparații și consumabile',
  'Servicii și taxe': 'Taxe și servicii',
  'Diverse operaționale': 'Altele',
  // Categoriile și mai vechi (dinainte de martie 2026).
  Electricitate: 'Motorină și curent',
  'Motorina Transport': 'Motorină și curent',
  Etichete: 'Ambalaje',
  'Reparatii Utilaje': 'Reparații și consumabile',
  'Intretinere Curenta': 'Reparații și consumabile',
  Scule: 'Reparații și consumabile',
  Fertilizare: 'Îngrășăminte',
  Pesticide: 'Tratamente',
  Cules: 'Manoperă',
  // Scrisă de generatorul automat din Recoltări (`queries/manopera-auto.ts`), care rămâne neschimbat.
  'Manoperă cules': 'Manoperă',
  'Material Saditor': 'Altele',
  'Sistem Sustinere': 'Altele',
  'Sistem Irigatie': 'Altele',
  Transport: 'Motorină și curent',
  Diverse: 'Altele',
}

export const INVESTITII_LEGACY_MAP: Record<string, CategorieInvestitie> = {
  // Cele 9 categorii de până la 20.11.2026.
  'Material săditor': 'Plantație',
  'Irigații și fertigare': 'Irigație',
  'Sisteme de susținere și protecție': 'Spalier și plase',
  'Construcții și amenajări': 'Construcții și depozitare',
  'Utilaje și echipamente': 'Utilaje și unelte',
  'Depozitare și răcire': 'Construcții și depozitare',
  'Infrastructură și utilități': 'Altele',
  'IT și automatizări': 'Altele',
  'Alte investiții': 'Altele',
  // Categoriile și mai vechi.
  Butași: 'Plantație',
  'Sistem Irigație': 'Irigație',
  'Solar / Tunel': 'Spalier și plase',
  Utilaje: 'Utilaje și unelte',
  Depozitare: 'Construcții și depozitare',
  Ambalaje: 'Altele',
}

function normalizeCategoryKey(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, ' ')
}

function normalizedMap<T extends string>(canonical: readonly T[], legacy: Record<string, T>): Map<string, T> {
  const map = new Map<string, T>()
  for (const [key, value] of Object.entries(legacy)) map.set(normalizeCategoryKey(key), value)
  // Numele noi au întâietate: „Ambalaje” (cheltuială) rămâne „Ambalaje”, „Altele” rămâne „Altele”.
  for (const name of canonical) map.set(normalizeCategoryKey(name), name)
  return map
}

const CHELTUIELI_BY_KEY = normalizedMap(CATEGORII_CHELTUIELI, CHELTUIELI_LEGACY_MAP)
const INVESTITII_BY_KEY = normalizedMap(CATEGORII_INVESTITII, INVESTITII_LEGACY_MAP)

/**
 * Text liber (scris de mână sau ales de AI în rutele `paste-to-*`): ghicim categoria după cuvinte.
 * Ordinea contează: primul cuvânt găsit câștigă.
 */
const CHELTUIELI_KEYWORDS: ReadonlyArray<[RegExp, CategorieCheltuiala]> = [
  [/ingras|fertiliz|azot|npk|gunoi/, 'Îngrășăminte'],
  [/tratament|pesticid|fungicid|insecticid|erbicid|stropi/, 'Tratamente'],
  [/manoper|cules|zilier|salari|munca|muncitor/, 'Manoperă'],
  [/ambalaj|caserol|ladit|etichet|pung|cutii/, 'Ambalaje'],
  [/motorin|benzin|combustibil|carburant|curent|electric|energie|transport|livrare/, 'Motorină și curent'],
  [/repara|intretin|consumabil|scule|piese|service/, 'Reparații și consumabile'],
  [/tax|impozit|servici|contabil|asigur|abonament|comision/, 'Taxe și servicii'],
]

const INVESTITII_KEYWORDS: ReadonlyArray<[RegExp, CategorieInvestitie]> = [
  [/butas|rasad|puiet|plantat|material sadit/, 'Plantație'],
  [/irig|picurare|fertigare|pompa|furtun/, 'Irigație'],
  [/spalier|plas|sustinere|stalp|sarma|solar|tunel|folie/, 'Spalier și plase'],
  [/utilaj|tractor|motocultor|unelt|echipament|atomizor/, 'Utilaje și unelte'],
  [/construc|depozit|hala|magazie|camera frig|racire|amenajar/, 'Construcții și depozitare'],
]

function byKeyword<T extends string>(normalized: string, keywords: ReadonlyArray<[RegExp, T]>): T | null {
  for (const [pattern, category] of keywords) {
    if (pattern.test(normalized)) return category
  }
  return null
}

/**
 * Categoria nouă a unei cheltuieli, pentru orice valoare din bază: nume nou, nume vechi sau text liber.
 * Întoarce mereu una dintre cele 8.
 */
export function resolveCheltuialaCategorie(raw: string | null | undefined): CategorieCheltuiala {
  if (!raw || !raw.trim()) return 'Altele'
  const normalized = normalizeCategoryKey(raw)
  return CHELTUIELI_BY_KEY.get(normalized) ?? byKeyword(normalized, CHELTUIELI_KEYWORDS) ?? 'Altele'
}

/** Categoria nouă a unei investiții. Întoarce mereu una dintre cele 6. */
export function resolveInvestitieCategorie(raw: string | null | undefined): CategorieInvestitie {
  if (!raw || !raw.trim()) return 'Altele'
  const normalized = normalizeCategoryKey(raw)
  return INVESTITII_BY_KEY.get(normalized) ?? byKeyword(normalized, INVESTITII_KEYWORDS) ?? 'Altele'
}
