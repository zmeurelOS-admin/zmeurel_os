/**
 * Importul clienților din fișier (Excel sau CSV) și ștergerea tuturor clienților.
 * Logica e cea dinaintea refacerii paginii Clienți; a fost doar mutată aici din `ClientPageClient`.
 */
import { getSupabase } from '@/lib/supabase/client'
import { deleteClienți, type Client } from '@/lib/supabase/queries/clienti'
import { getTenantId } from '@/lib/tenant/get-tenant'
import { normalizePhoneNumber } from '@/lib/utils/normalize-phone'

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

export type ImportProgress = { done: number; total: number; phase: 'ids' | 'insert' }

const EMPTY_PREVIEW: ImportPreview = {
  rows: [],
  totalParsed: 0,
  skippedNoName: 0,
  formulaFixCount: 0,
  mappingSummary: [],
  unmappedColumns: [],
  hasNameColumn: false,
  hasPhoneColumn: false,
}

export const MAX_IMPORT_FILE_BYTES = 10 * 1024 * 1024
export const IMPORT_EXTENSIONS = ['csv', 'xlsx', 'xls'] as const

function normalizeText(value: string | null | undefined): string {
  return (value ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
}

function parseCsvLine(line: string): string[] {
  const values: string[] = []
  let current = ''
  let insideQuotes = false

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index]
    const next = line[index + 1]

    if (char === '"') {
      if (insideQuotes && next === '"') {
        current += '"'
        index += 1
      } else {
        insideQuotes = !insideQuotes
      }
      continue
    }

    if ((char === ',' || char === ';') && !insideQuotes) {
      values.push(current.trim())
      current = ''
      continue
    }

    current += char
  }

  values.push(current.trim())
  return values
}

function normalizeHeader(value: string): string {
  return normalizeText(value)
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
}

function mapHeadersToClients(
  normalizedHeaders: string[],
  originalHeaders: string[],
  dataRows: string[][],
): ImportPreview {
  const pick = (...aliases: string[]) => normalizedHeaders.findIndex((header) => aliases.includes(header))

  const nameIndex = pick(
    'display_name', 'displayname', 'full_name', 'fullname',
    'nume_complet', 'nume_client', 'client', 'contact', 'persoana',
    'name', 'denumire', 'nume',
  )
  const firstNameIndex = pick('first_name', 'given_name', 'prenume', 'firstname')
  const lastNameIndex = pick('last_name', 'family_name', 'surname', 'lastname', 'nume_familie')

  const phoneIndex = pick(
    'phone_1_value', 'phone', 'phone_number', 'phonenumber', 'mobile', 'nr_telefon',
    'nr_tel', 'numar_telefon', 'numar_tel', 'telefon', 'tel', 'mobil',
  )
  const phone2Index = pick('phone_2_value', 'phone2', 'mobile2', 'telefon_alt', 'alt_telefon')

  const emailIndex = pick('email', 'e_mail', 'email_address', 'mail', 'adresa_email', 'email_1_value')
  const addressIndex = pick(
    'delivery_location', 'location', 'city', 'oras', 'localitate',
    'adresa', 'address', 'locatie', 'locatie_livrare', 'loc', 'sat', 'comuna',
  )
  const notesIndex = pick('notes', 'observatii', 'observatii_client', 'note', 'obs', 'detalii', 'comments')

  const hasNameColumn = nameIndex >= 0 || firstNameIndex >= 0 || lastNameIndex >= 0
  const hasPhoneColumn = phoneIndex >= 0 || phone2Index >= 0

  const mappedIndices = new Set(
    [nameIndex, firstNameIndex, lastNameIndex, phoneIndex, phone2Index, emailIndex, addressIndex, notesIndex].filter(
      (index) => index >= 0,
    ),
  )

  const mappingSummary: string[] = []
  if (nameIndex >= 0) {
    mappingSummary.push(`„${originalHeaders[nameIndex]}” → Nume client`)
  } else if (firstNameIndex >= 0 || lastNameIndex >= 0) {
    const parts = [
      firstNameIndex >= 0 ? `„${originalHeaders[firstNameIndex]}”` : null,
      lastNameIndex >= 0 ? `„${originalHeaders[lastNameIndex]}”` : null,
    ].filter(Boolean)
    mappingSummary.push(`${parts.join(' + ')} → Nume client`)
  }
  if (phoneIndex >= 0) mappingSummary.push(`„${originalHeaders[phoneIndex]}” → Telefon`)
  if (phone2Index >= 0) mappingSummary.push(`„${originalHeaders[phone2Index]}” → Telefon (rezervă)`)
  if (emailIndex >= 0) mappingSummary.push(`„${originalHeaders[emailIndex]}” → Email`)
  if (addressIndex >= 0) mappingSummary.push(`„${originalHeaders[addressIndex]}” → Adresă`)
  if (notesIndex >= 0) mappingSummary.push(`„${originalHeaders[notesIndex]}” → Observații`)

  const unmappedColumns = originalHeaders.filter((header, index) => !mappedIndices.has(index) && header.trim().length > 0)

  let formulaFixCount = 0
  const allRows = dataRows.map((columns) => {
    let numeName = nameIndex >= 0 ? (columns[nameIndex] ?? '').trim() : ''

    const isRawFormula = numeName.startsWith('=')
    const isPlaceholder = /^Gospodar\s*Nou\b/i.test(numeName)
    if (!numeName || isRawFormula || isPlaceholder) {
      const first = firstNameIndex >= 0 ? (columns[firstNameIndex] ?? '').trim() : ''
      const last = lastNameIndex >= 0 ? (columns[lastNameIndex] ?? '').trim() : ''
      const combined = [first, last].filter(Boolean).join(' ')
      if (combined) {
        formulaFixCount += 1
        numeName = combined
      } else {
        numeName = ''
      }
    }

    let phoneValue = phoneIndex >= 0 ? (columns[phoneIndex] ?? '').trim() : ''
    if (!phoneValue && phone2Index >= 0) {
      phoneValue = (columns[phone2Index] ?? '').trim()
    }
    return {
      nume_client: numeName,
      telefon: phoneValue || null,
      email: emailIndex >= 0 ? (columns[emailIndex] ?? '').trim() || null : null,
      adresa: addressIndex >= 0 ? (columns[addressIndex] ?? '').trim() || null : null,
      observatii: notesIndex >= 0 ? (columns[notesIndex] ?? '').trim() || null : null,
    }
  })

  const rows = allRows.filter((row) => row.nume_client.length > 0)
  const totalParsed = allRows.length

  return {
    rows,
    totalParsed,
    skippedNoName: totalParsed - rows.length,
    formulaFixCount,
    mappingSummary,
    unmappedColumns,
    hasNameColumn,
    hasPhoneColumn,
  }
}

const HEADER_DETECTION_ALIASES = new Set([
  'display_name', 'displayname', 'full_name', 'fullname', 'first_name', 'last_name',
  'given_name', 'family_name', 'surname', 'firstname', 'lastname', 'nume_familie',
  'nume_complet', 'nume_client', 'client', 'contact', 'persoana', 'name', 'denumire', 'prenume', 'nume',
  'telefon', 'phone', 'phone_1_value', 'phone_2_value', 'phone_number', 'phonenumber',
  'tel', 'mobil', 'mobile', 'mobile2', 'nr_telefon', 'numar_telefon',
  'email', 'e_mail', 'email_1_value', 'email_address', 'mail', 'adresa_email',
  'adresa', 'address', 'delivery_location', 'location', 'localitate', 'oras', 'city', 'loc', 'sat', 'comuna',
  'notes', 'note', 'observatii', 'obs', 'detalii', 'comments',
])

/** Exportată pentru teste. */
export function parseClientCsv(content: string): ImportPreview {
  const raw = content.replace(/^﻿/, '')
  const lines = raw.split(/\r?\n/).map((line) => line.trim()).filter(Boolean)
  if (!lines.length) return EMPTY_PREVIEW

  const firstRow = parseCsvLine(lines[0])
  const normalizedFirstRow = firstRow.map(normalizeHeader)
  const hasHeader = normalizedFirstRow.some((header) => HEADER_DETECTION_ALIASES.has(header))

  const originalHeaders = hasHeader ? firstRow : ['Nume', 'Telefon', 'Email', 'Adresa', 'Observatii']
  const normalizedHeaders = hasHeader ? normalizedFirstRow : ['nume_client', 'telefon', 'email', 'adresa', 'observatii']
  const dataLines = hasHeader ? lines.slice(1) : lines

  return mapHeadersToClients(normalizedHeaders, originalHeaders, dataLines.map(parseCsvLine))
}

async function parseClientXlsx(buffer: ArrayBuffer): Promise<ImportPreview> {
  const XLSX = await import('xlsx')
  const workbook = XLSX.read(buffer, { type: 'array', cellFormula: false })
  const firstSheetName = workbook.SheetNames[0]
  if (!firstSheetName) throw new Error('Fișierul Excel nu conține foi de calcul.')

  const sheet = workbook.Sheets[firstSheetName]
  const rawRows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: '' }) as unknown[][]
  if (rawRows.length === 0) return EMPTY_PREVIEW

  const originalHeaders = (rawRows[0] as unknown[]).map((cell) => String(cell ?? '').trim())
  const normalizedHeaders = originalHeaders.map(normalizeHeader)
  const dataRows = rawRows.slice(1).map((row) => (row as unknown[]).map((cell) => String(cell ?? '').trim()))

  return mapHeadersToClients(normalizedHeaders, originalHeaders, dataRows)
}

export async function downloadImportTemplate(): Promise<void> {
  const XLSX = await import('xlsx')
  const rows = [
    ['Nume client', 'Telefon', 'Email', 'Adresă', 'Observații'],
    ['Ion Popescu', '0745123456', 'ion@email.com', 'Suceava', ''],
    ['Maria Ionescu', '0722334455', '', 'Fălticeni', 'Client fidel'],
  ]
  const sheet = XLSX.utils.aoa_to_sheet(rows)
  sheet['!cols'] = [{ wch: 20 }, { wch: 15 }, { wch: 22 }, { wch: 16 }, { wch: 20 }]
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, sheet, 'Clienți')
  XLSX.writeFile(workbook, 'model-import-clienti.xlsx')
}

/** Citește fișierul ales și spune ce a înțeles din el. Aruncă un mesaj pe înțeles dacă nu se poate folosi. */
export async function parseClientFile(file: File): Promise<ImportPreview> {
  if (file.size > MAX_IMPORT_FILE_BYTES) {
    throw new Error('Fișierul este prea mare. Limita este 10 MB.')
  }
  const ext = file.name.split('.').pop()?.toLowerCase()
  if (!ext || !(IMPORT_EXTENSIONS as readonly string[]).includes(ext)) {
    throw new Error('Format neacceptat. Folosește Excel (.xlsx) sau CSV.')
  }

  const preview = ext === 'csv' ? parseClientCsv(await file.text()) : await parseClientXlsx(await file.arrayBuffer())

  if (preview.totalParsed === 0) throw new Error('Fișierul nu conține date.')
  if (!preview.hasNameColumn) throw new Error('Nu am găsit nicio coloană cu numele clientului. Verifică fișierul.')
  if (!preview.rows.length) throw new Error('Fișierul are doar antetul, fără rânduri cu nume de client.')
  return preview
}

/** Salvează clienții din previzualizare, sărind peste cei care există deja (același nume și telefon). */
export async function importClients(
  preview: ImportPreview,
  onProgress?: (progress: ImportProgress) => void,
): Promise<ImportResult> {
  const { rows: validRows, skippedNoName } = preview
  const failedRows: ImportResult['failedRows'] = []
  let importedCount = 0
  let duplicateCount = 0

  const supabase = getSupabase()
  const tenantId = await getTenantId(supabase)

  const { data: existingData } = await supabase
    .from('clienti')
    .select('nume_client,telefon,id_client')
    .eq('tenant_id', tenantId)
  const existingSet = new Set(
    (existingData ?? []).map(
      (client) => `${normalizeText(client.nume_client)}|${normalizeText(client.telefon ? normalizePhoneNumber(client.telefon) : '')}`,
    ),
  )

  let idCounter = 0
  for (const row of existingData ?? []) {
    const match = row.id_client?.match(/(\d+)$/)
    if (match) {
      const num = parseInt(match[1], 10)
      if (num > idCounter) idCounter = num
    }
  }
  idCounter += 1

  const makeClientId = (): string => {
    const current = idCounter
    idCounter += 1
    return `C${String(current).padStart(3, '0')}`
  }

  type ImportRecord = {
    supabaseRow: {
      tenant_id: string
      id_client: string
      nume_client: string
      telefon: string | null
      email: string | null
      adresa: string | null
      observatii: string | null
    }
    sourceRow: ParsedClientRow
  }
  const records: ImportRecord[] = []

  for (let index = 0; index < validRows.length; index += 1) {
    const row = validRows[index]
    const normalizedRowPhone = row.telefon ? normalizePhoneNumber(row.telefon) : ''
    const duplicateKey = `${normalizeText(row.nume_client)}|${normalizeText(normalizedRowPhone)}`
    if (existingSet.has(duplicateKey)) {
      duplicateCount += 1
    } else {
      records.push({
        supabaseRow: {
          tenant_id: tenantId,
          id_client: makeClientId(),
          nume_client: row.nume_client.trim(),
          telefon: normalizedRowPhone || null,
          email: row.email || null,
          adresa: row.adresa || null,
          observatii: row.observatii || null,
        },
        sourceRow: row,
      })
    }
    onProgress?.({ done: index + 1, total: validRows.length, phase: 'ids' })
  }

  const CHUNK_SIZE = 50
  for (let index = 0; index < records.length; index += CHUNK_SIZE) {
    const chunk = records.slice(index, index + CHUNK_SIZE)
    const { error } = await supabase.from('clienti').insert(chunk.map((record) => record.supabaseRow))

    if (error) {
      // Un rând stricat nu trebuie să oprească restul: reluăm bucata rând cu rând.
      for (const record of chunk) {
        const { error: rowError } = await supabase.from('clienti').insert([record.supabaseRow])
        if (rowError) failedRows.push({ name: record.sourceRow.nume_client, error: rowError.message })
        else importedCount += 1
      }
    } else {
      importedCount += chunk.length
    }

    onProgress?.({ done: Math.min(index + CHUNK_SIZE, records.length), total: records.length, phase: 'insert' })
    if (index + CHUNK_SIZE < records.length) {
      await new Promise<void>((resolve) => setTimeout(resolve, 50))
    }
  }

  return {
    imported: importedCount,
    skippedNoName,
    skippedDuplicate: duplicateCount,
    failed: failedRows.length,
    failedRows,
  }
}

export interface DeleteAllClientsResult {
  deleted: number
  /** Clienții care nu pot fi șterși (au comenzi sau vânzări). */
  failedNames: string[]
}

/**
 * Șterge toți clienții primiți. O face fermierul, din Setări › Date, după o confirmare scrisă.
 * Clienții cu comenzi sau vânzări rămân (baza de date nu îi lasă șterși).
 */
export async function deleteAllClients(
  clients: readonly Pick<Client, 'id' | 'nume_client'>[],
  onProgress?: (progress: { done: number; total: number }) => void,
): Promise<DeleteAllClientsResult> {
  const supabase = getSupabase()
  const tenantId = await getTenantId(supabase)

  let deleted = 0
  const failedNames: string[] = []
  const CHUNK = 50

  for (let index = 0; index < clients.length; index += CHUNK) {
    const chunk = clients.slice(index, index + CHUNK)
    const { error } = await supabase
      .from('clienti')
      .delete()
      .eq('tenant_id', tenantId)
      .in(
        'id',
        chunk.map((client) => client.id),
      )

    if (error) {
      for (const client of chunk) {
        try {
          await deleteClienți(client.id)
          deleted += 1
        } catch {
          failedNames.push(client.nume_client)
        }
      }
    } else {
      deleted += chunk.length
    }

    onProgress?.({ done: Math.min(index + CHUNK, clients.length), total: clients.length })
    if (index + CHUNK < clients.length) {
      await new Promise<void>((resolve) => setTimeout(resolve, 50))
    }
  }

  return { deleted, failedNames }
}

// ─── Mesajul WhatsApp implicit (anunțuri către patiserii și magazine) ──────────

// Fără cultură scrisă fix (promptul 31): ferma poate vinde orice cultură.
export const DEFAULT_WA_MESSAGE = 'Bună ziua! Am început livrările. Vă așteptăm cu comanda!'

type WaSettingsTable = {
  select: (columns: string) => {
    eq: (column: string, value: string) => {
      maybeSingle: () => PromiseLike<{ data: { whatsapp_b2b_message?: string | null } | null; error: { message?: string } | null }>
    }
  }
  upsert: (values: Record<string, unknown>, options: { onConflict: string }) => PromiseLike<{ error: { message?: string } | null }>
}

function waSettingsTable(): WaSettingsTable {
  return (getSupabase() as unknown as { from: (table: string) => WaSettingsTable }).from('tenant_settings')
}

/**
 * Mesajul salvat pe fermă. Coloana `whatsapp_b2b_message` poate lipsi din baza de date: atunci
 * (și la orice altă eroare) rămâne mesajul implicit, ca până acum.
 */
export async function getWhatsappMessage(): Promise<string> {
  try {
    const tenantId = await getTenantId(getSupabase())
    const { data, error } = await waSettingsTable().select('whatsapp_b2b_message').eq('tenant_id', tenantId).maybeSingle()
    if (error) return DEFAULT_WA_MESSAGE
    return data?.whatsapp_b2b_message?.trim() || DEFAULT_WA_MESSAGE
  } catch {
    return DEFAULT_WA_MESSAGE
  }
}

export async function saveWhatsappMessage(message: string): Promise<string> {
  const text = message.trim() || DEFAULT_WA_MESSAGE
  const tenantId = await getTenantId(getSupabase())
  const { error } = await waSettingsTable().upsert({ tenant_id: tenantId, whatsapp_b2b_message: text }, { onConflict: 'tenant_id' })
  if (error) throw new Error(error.message || 'Mesajul nu s-a salvat.')
  return text
}
