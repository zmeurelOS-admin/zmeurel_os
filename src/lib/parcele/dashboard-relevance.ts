/** Relevanță parcele pentru dashboard-ul principal (context comercial implicit). */

export const PARCELA_SCOPURI = ['comercial', 'personal', 'experimental', 'inactiv'] as const
export type ParcelaScop = (typeof PARCELA_SCOPURI)[number]

export const STATUS_OPERATIONAL_VALUES = [
  'activ',
  'in_pauza',
  'neproductiv',
  'infiintare',
  'arhivat',
] as const
export type StatusOperational = (typeof STATUS_OPERATIONAL_VALUES)[number]

export function normalizeParcelaRol(rol: string | null | undefined): string {
  const raw = String(rol ?? '')
    .trim()
    .toLowerCase()
  if (raw === 'uz_propriu') return 'personal'
  return raw
}

export function parseParcelaScop(rol: string | null | undefined): ParcelaScop | null {
  const normalized = normalizeParcelaRol(rol)
  return (PARCELA_SCOPURI as readonly string[]).includes(normalized) ? (normalized as ParcelaScop) : null
}

export function coerceParcelaScopFromDb(rol: string | null | undefined): ParcelaScop {
  // Fallback sigur pentru valori neașteptate: nu le tratăm niciodată ca "comercial".
  return parseParcelaScop(rol) ?? 'personal'
}

export function coerceStatusOperationalFromDb(value: string | null | undefined): StatusOperational {
  const s = String(value ?? 'activ')
    .trim()
    .toLowerCase()
  return (STATUS_OPERATIONAL_VALUES as readonly string[]).includes(s)
    ? (s as StatusOperational)
    : 'activ'
}

export interface ParcelaDashboardFields {
  rol?: string | null
  apare_in_dashboard?: boolean | null
  contribuie_la_productie?: boolean | null
  status_operational?: string | null
}

/**
 * Regulă dashboard: scop comercial + operațional activ + ambele booleene true.
 * null/undefined la booleene = true (compat date vechi / default DB).
 * status_operational lipsă = tratat ca activ.
 */
export function isParcelaDashboardRelevant(parcel: ParcelaDashboardFields): boolean {
  if (parseParcelaScop(parcel.rol) !== 'comercial') return false
  if (parcel.apare_in_dashboard === false) return false
  if (parcel.contribuie_la_productie === false) return false
  const op = String(parcel.status_operational ?? 'activ')
    .trim()
    .toLowerCase()
  return op === 'activ'
}

export const SCOP_LABELS: Record<ParcelaScop, string> = {
  comercial: 'Producție comercială',
  personal: 'Uz personal / familie',
  experimental: 'Experimental / probă',
  inactiv: 'Marcat ca inactiv (scop)',
}

export const STATUS_OPERATIONAL_LABELS: Record<StatusOperational, string> = {
  activ: 'Activ — în exploatare',
  in_pauza: 'În pauză',
  neproductiv: 'Neproductiv',
  infiintare: 'În înființare',
  arhivat: 'Arhivat',
}
