'use client'

import { track } from '@/lib/analytics/track'
import { getSupabase } from '@/lib/supabase/client'
import { ziuaInRomania } from '@/lib/utils/bucharest-date'

/**
 * „Descarcă datele” (exportul GDPR), mutat neschimbat din vechea pagină Setări:
 * un fișier JSON cu tot, sau un CSV pe categorie.
 */

export type CsvModule = 'activitati' | 'cheltuieli' | 'vanzari' | 'recoltari' | 'clienti' | 'comenzi'

type TenantTable =
  | 'activitati_agricole'
  | 'cheltuieli_diverse'
  | 'vanzari'
  | 'recoltari'
  | 'clienti'
  | 'parcele'
  | 'culegatori'
  | 'investitii'
  | 'vanzari_butasi'
  | 'vanzari_butasi_items'
  | 'comenzi'
  | 'miscari_stoc'
  | 'alert_dismissals'

export const CSV_MODULES: Array<{ key: CsvModule; label: string; table: TenantTable }> = [
  { key: 'recoltari', label: 'Recoltări', table: 'recoltari' },
  { key: 'comenzi', label: 'Comenzi', table: 'comenzi' },
  { key: 'clienti', label: 'Clienți', table: 'clienti' },
  { key: 'vanzari', label: 'Vânzări', table: 'vanzari' },
  { key: 'cheltuieli', label: 'Cheltuieli', table: 'cheltuieli_diverse' },
  { key: 'activitati', label: 'Activități', table: 'activitati_agricole' },
]

export const GDPR_TABLES: TenantTable[] = [
  'activitati_agricole',
  'cheltuieli_diverse',
  'vanzari',
  'recoltari',
  'clienti',
  'parcele',
  'culegatori',
  'investitii',
  'vanzari_butasi',
  'vanzari_butasi_items',
  'comenzi',
  'miscari_stoc',
  'alert_dismissals',
]

const EXPORT_BATCH_SIZE = 1000

function escapeCsvValue(value: unknown): string {
  const raw = value === null || value === undefined ? '' : String(value)
  return `"${raw.replace(/"/g, '""')}"`
}

export function rowsToCsv(rows: Record<string, unknown>[]): string {
  if (!rows.length) return ''
  const headers = Array.from(new Set(rows.flatMap((row) => Object.keys(row))))
  const headerLine = headers.map(escapeCsvValue).join(',')
  const lines = rows.map((row) => headers.map((key) => escapeCsvValue(row[key])).join(','))
  return [headerLine, ...lines].join('\n')
}

function downloadFile(content: string, fileName: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = fileName
  anchor.click()
  URL.revokeObjectURL(url)
}

async function fetchTenantRowsBatched(
  table: TenantTable,
  tenantId: string,
  onRows?: (count: number) => void,
): Promise<Record<string, unknown>[]> {
  const supabase = getSupabase()
  const rows: Record<string, unknown>[] = []
  let from = 0
  while (true) {
    const { data, error } = await supabase
      .from(table)
      .select('*')
      .eq('tenant_id', tenantId)
      .range(from, from + EXPORT_BATCH_SIZE - 1)
    if (error) throw error
    const chunk = (data ?? []) as Record<string, unknown>[]
    if (!chunk.length) break
    rows.push(...chunk)
    onRows?.(rows.length)
    if (chunk.length < EXPORT_BATCH_SIZE) break
    from += EXPORT_BATCH_SIZE
  }
  return rows
}

/** Tot, într-un fișier JSON. */
export async function exportAllDataJson(input: {
  userId: string
  email: string
  tenantId: string
  onProgress?: (done: number, total: number) => void
}): Promise<void> {
  const supabase = getSupabase()
  const nowIso = new Date().toISOString()
  const { data: tenantRow } = await supabase.from('tenants').select('*').eq('id', input.tenantId).maybeSingle()
  const { data: profileRow } = await supabase.from('profiles').select('*').eq('id', input.userId).maybeSingle()

  const tables: Record<string, unknown[]> = {}
  const errors: Record<string, string> = {}
  for (let index = 0; index < GDPR_TABLES.length; index += 1) {
    const table = GDPR_TABLES[index]
    try {
      tables[table] = await fetchTenantRowsBatched(table, input.tenantId)
    } catch (error) {
      errors[table] = (error as { message?: string })?.message || 'Unknown error'
      tables[table] = []
    }
    input.onProgress?.(index + 1, GDPR_TABLES.length)
  }

  const payload = {
    exported_at: nowIso,
    compliance: 'Regulamentul (UE) 2016/679 (GDPR)',
    user: { id: input.userId, email: input.email },
    tenant: tenantRow,
    profile: profileRow,
    tables,
    errors,
  }
  downloadFile(JSON.stringify(payload, null, 2), `caietul-fermei-date-${nowIso.slice(0, 10)}.json`, 'application/json;charset=utf-8')
  track('export', {
    type: 'json',
    module: 'all',
    rows: Object.values(tables).reduce((sum, tableRows) => sum + (tableRows?.length ?? 0), 0),
  })
}

/** O categorie, ca tabel CSV. */
export async function exportModuleCsv(input: {
  module: CsvModule
  tenantId: string
  onRows?: (count: number) => void
}): Promise<void> {
  const config = CSV_MODULES.find((item) => item.key === input.module)
  if (!config) return
  const rows = await fetchTenantRowsBatched(config.table, input.tenantId, input.onRows)
  downloadFile(rowsToCsv(rows), `caietul-fermei-${input.module}-${ziuaInRomania()}.csv`, 'text/csv;charset=utf-8')
  track('export', { type: 'csv', module: input.module, rows: rows.length })
}
