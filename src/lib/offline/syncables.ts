export const SYNCABLE_TABLES = [
  'recoltari',
  'vanzari',
  'activitati_agricole',
  'cheltuieli_diverse',
] as const

export type SyncableTable = (typeof SYNCABLE_TABLES)[number]

export function isSyncableTable(value: string): value is SyncableTable {
  return SYNCABLE_TABLES.includes(value as SyncableTable)
}
