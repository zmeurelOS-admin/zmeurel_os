/**
 * Analizele la fructe: forma rândurilor, etichetele și opțiunile raportului public.
 * Fără React și fără Supabase (se folosește în aplicație, pe pagina publică și în teste).
 */

export type StatusAnaliza = 'la_laborator' | 'conform' | 'neconform'
export type PrelevatDe = 'dsvsa' | 'laborator' | 'eu'

export interface SubstantaAnaliza {
  id?: string
  substanta: string
  valoare_mg_kg: number | null
  lmr_mg_kg: number | null
  ordine: number
}

/** Ce apare în raportul public. Numărul atestatului, poza PV-ului și numele inspectorului nu apar niciodată. */
export interface OptiuniPublice {
  substante: boolean
  tratamente: boolean
  numere: boolean
  /** Poza buletinului: poate conține nume și adrese, oprită implicit. */
  poza_buletin: boolean
  telefon: boolean
}

export const OPTIUNI_PUBLICE_IMPLICITE: OptiuniPublice = {
  substante: true,
  tratamente: true,
  numere: true,
  poza_buletin: false,
  telefon: true,
}

export const CHEI_OPTIUNI: readonly (keyof OptiuniPublice)[] = ['substante', 'tratamente', 'numere', 'poza_buletin', 'telefon']

export const ETICHETA_OPTIUNE: Record<keyof OptiuniPublice, { titlu: string; detaliu?: string }> = {
  substante: { titlu: 'Substanțele găsite' },
  tratamente: { titlu: 'Tratamentele din ultimele 30 de zile' },
  numere: { titlu: 'Numărul PV și al buletinului' },
  poza_buletin: { titlu: 'Poza buletinului', detaliu: 'poate conține nume și adrese' },
  telefon: { titlu: 'Telefonul pentru comenzi' },
}

/** Doar valorile booleene cunoscute; restul se ignoră. */
export function normalizeazaOptiuni(raw: unknown): Partial<OptiuniPublice> {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {}
  const rezultat: Partial<OptiuniPublice> = {}
  for (const cheie of CHEI_OPTIUNI) {
    const valoare = (raw as Record<string, unknown>)[cheie]
    if (typeof valoare === 'boolean') rezultat[cheie] = valoare
  }
  return rezultat
}

/** Implicitele aplicației ← implicitele fermei ← suprascrierea pe analiză. */
export function optiuniEfective(ferma: unknown, analiza: unknown): OptiuniPublice {
  return { ...OPTIUNI_PUBLICE_IMPLICITE, ...normalizeazaOptiuni(ferma), ...normalizeazaOptiuni(analiza) }
}

export interface AnalizaRow {
  id: string
  tenant_id: string
  client_sync_id: string | null
  created_at: string
  updated_at: string
  data_prelevare: string
  pv_numar: string | null
  pv_poza_path: string | null
  prelevat_de: PrelevatDe | null
  laborator: string | null
  data_predare: string | null
  nota: string | null
  status: StatusAnaliza
  buletin_numar: string | null
  buletin_data: string | null
  buletin_path: string | null
  ce_s_a_analizat: string | null
  rest_nedetectate: boolean | null
  public_token: string
  public_activ: boolean
  public_optiuni: unknown
  parcele: string[]
  substante: SubstantaAnaliza[]
}

export const ETICHETA_PRELEVAT: Record<PrelevatDe, string> = {
  dsvsa: 'DSVSA',
  laborator: 'Laboratorul',
  eu: 'Eu',
}

/** „de DSVSA”, „de laborator”, „de fermier” (textul din raport). */
export const PRELEVAT_IN_RAPORT: Record<PrelevatDe, string> = {
  dsvsa: 'DSVSA',
  laborator: 'laborator',
  eu: 'fermier',
}

export const ETICHETA_STATUS: Record<StatusAnaliza, string> = {
  la_laborator: 'La laborator',
  conform: 'Conform',
  neconform: 'Neconform',
}

/** Parcelele pe care se poate face o analiză: doar cele de vânzare (nu „Personal”). */
export function esteParcelaDeVanzare(parcela: { rol?: string | null }): boolean {
  return (parcela.rol ?? 'comercial') !== 'personal'
}

/** Laboratoarele folosite înainte (distinct, fără majuscule/spații diferite), cele mai recente întâi. */
export function laboratoareFolosite(analize: ReadonlyArray<{ laborator: string | null; data_prelevare: string }>): string[] {
  const vazute = new Map<string, string>()
  const ordonate = [...analize].sort((a, b) => b.data_prelevare.localeCompare(a.data_prelevare))
  for (const analiza of ordonate) {
    const nume = analiza.laborator?.trim().replace(/\s+/g, ' ')
    if (!nume) continue
    const cheie = nume.toLocaleLowerCase('ro-RO')
    if (!vazute.has(cheie)) vazute.set(cheie, nume)
  }
  return [...vazute.values()]
}

/** O substanță depășește limita (ambele valori știute). */
export function depasesteLimita(substanta: Pick<SubstantaAnaliza, 'valoare_mg_kg' | 'lmr_mg_kg'>): boolean {
  return substanta.valoare_mg_kg !== null && substanta.lmr_mg_kg !== null && substanta.valoare_mg_kg > substanta.lmr_mg_kg
}
