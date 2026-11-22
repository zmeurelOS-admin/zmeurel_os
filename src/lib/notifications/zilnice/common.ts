/**
 * Ce au în comun verificările zilnice (ger, comenzi de mâine, bani de încasat, tratamente planificate). Funcții pure.
 */

export const TIPURI_ZILNICE = {
  comenzi_maine: 'comenzi_maine',
  incasari_restante: 'incasari_restante',
  meteo_inghet: 'meteo_inghet',
  meteo_grindina: 'meteo_grindina',
  tratament_planificat: 'tratament_planificat',
  analize_memento: 'analize_memento',
  magazie_pe_terminate: 'magazie_pe_terminate',
} as const

export type TipZilnic = (typeof TIPURI_ZILNICE)[keyof typeof TIPURI_ZILNICE]

/** O notificare gata de trimis proprietarului fermei. Cronul doar verifică dublura și o inserează. */
export type NotificareZilnica = {
  tenantId: string
  type: TipZilnic
  title: string
  body: string
  /** Cheie de deduplicare (`data.reminder_key`): aceeași notificare nu pleacă de două ori. */
  reminderKey: string
  /** Se salvează în `notifications.data` (împreună cu `reminder_key`). */
  data: Record<string, unknown>
  entityType: string | null
  entityId: string | null
}

const FUS_ORAR = 'Europe/Bucharest'

/** Ziua (`YYYY-MM-DD`) în București pentru un moment dat. */
export function ziuaInBucuresti(moment: Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: FUS_ORAR,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(moment)
}

/** `2026-11-20` + 1 → `2026-11-21` (calcul pe zile calendaristice, fără ore). */
export function adaugaZile(ziua: string, zile: number): string {
  const [y, m, d] = ziua.split('-').map(Number)
  const date = new Date(Date.UTC(y, m - 1, d))
  date.setUTCDate(date.getUTCDate() + zile)
  return date.toISOString().slice(0, 10)
}

/** Câte zile calendaristice sunt de la `de` la `pana` (negativ = în urmă). `null` dacă una nu e o zi validă. */
export function zileIntre(de: string, pana: string): number | null {
  const a = Date.parse(`${String(de).slice(0, 10)}T00:00:00Z`)
  const b = Date.parse(`${String(pana).slice(0, 10)}T00:00:00Z`)
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null
  return Math.round((b - a) / 86_400_000)
}

/**
 * Numărul cu substantivul, ca în română: „1 comandă”, „4 comenzi”, „20 de comenzi”.
 * „de” apare când ultimele două cifre fac 0 sau cel puțin 20 (101 comenzi, 120 de comenzi).
 */
export function numarRo(n: number, singular: string, plural: string): string {
  if (n === 1) return `1 ${singular}`
  const rest = Math.abs(n) % 100
  const cuDe = n !== 0 && (rest === 0 || rest >= 20)
  return `${n} ${cuDe ? 'de ' : ''}${plural}`
}

/** „7 iunie” (fără an), pentru texte scurte. */
export function ziScurta(ziua: string): string {
  const [y, m, d] = ziua.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d, 12)).toLocaleDateString('ro-RO', {
    day: 'numeric',
    month: 'long',
    timeZone: 'UTC',
  })
}
