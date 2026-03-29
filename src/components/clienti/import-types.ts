export type ParsedClientRow = {
  nume_client: string
  telefon?: string | null
  email?: string | null
  adresa?: string | null
  observatii?: string | null
}

export type ImportPreview = {
  rows: ParsedClientRow[]
  totalParsed: number
  skippedNoName: number
  formulaFixCount: number
  mappingSummary: string[]
  unmappedColumns: string[]
  hasNameColumn: boolean
  hasPhoneColumn: boolean
}

export type ImportResult = {
  imported: number
  skippedNoName: number
  skippedDuplicate: number
  failed: number
  failedRows: Array<{ name: string; error: string }>
}

export type ImportProgress = {
  done: number
  total: number
  phase: 'ids' | 'insert'
}
