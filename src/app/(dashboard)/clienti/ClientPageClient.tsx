'use client'

import { useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Trash2, UserCheck, Users, X } from 'lucide-react'
import { useRouter } from 'next/navigation'

import { AppDialog } from '@/components/app/AppDialog'
import { AppShell } from '@/components/app/AppShell'
import { ConfirmDeleteDialog } from '@/components/app/ConfirmDeleteDialog'
import { ErrorState } from '@/components/app/ErrorState'
import { ListSkeletonCard } from '@/components/app/ListSkeleton'
import { PageHeader } from '@/components/app/PageHeader'
import { StickyActionBar } from '@/components/app/StickyActionBar'
import { useMobileScrollRestore } from '@/components/app/useMobileScrollRestore'
import { SectionTitle } from '@/components/dashboard/SectionTitle'
import { AddClientDialog } from '@/components/clienti/AddClientDialog'
import { ClientCard } from '@/components/clienti/ClientCard'
import { ClientDetailsDrawer } from '@/components/clienti/ClientDetailsDrawer'
import { EditClientDialog } from '@/components/clienti/EditClientDialog'
import { EmptyState } from '@/components/ui/EmptyState'
import { SearchField } from '@/components/ui/SearchField'
import AlertCard from '@/components/ui/AlertCard'
import MiniCard from '@/components/ui/MiniCard'
import { Button } from '@/components/ui/button'
import { useAddAction } from '@/contexts/AddActionContext'
import { colors, radius, shadows, spacing } from '@/lib/design-tokens'
import { queryKeys } from '@/lib/query-keys'
import { getSupabase } from '@/lib/supabase/client'
import {
  createClienți as createClienti,
  deleteClienți as deleteClienti,
  getClienți as getClienti,
  updateClienți as updateClienti,
  type Client,
} from '@/lib/supabase/queries/clienti'
import { getComenzi } from '@/lib/supabase/queries/comenzi'
import { getVanzari } from '@/lib/supabase/queries/vanzari'
import { getTenantId } from '@/lib/tenant/get-tenant'
import { toast } from '@/lib/ui/toast'

interface ClientPageClientProps {
  initialClienți: Client[]
}

type ParsedClientRow = {
  nume_client: string
  telefon?: string | null
  email?: string | null
  adresa?: string | null
  observatii?: string | null
}

function normalizeText(value: string | null | undefined): string {
  return (value ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
}

function isIncasata(status: string | null | undefined): boolean {
  const normalized = normalizeText(status)
  return (
    normalized.includes('incasata') ||
    normalized.includes('incasat') ||
    normalized.includes('platit') ||
    normalized.includes('achitat')
  )
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

type ImportPreview = {
  rows: ParsedClientRow[]          // rows with non-empty name only
  totalParsed: number              // total rows in file (including empty names)
  skippedNoName: number            // rows dropped because name was empty
  formulaFixCount: number          // rows where Display Name was a formula/placeholder — fixed via First+Last
  mappingSummary: string[]
  unmappedColumns: string[]
  hasNameColumn: boolean
  hasPhoneColumn: boolean
}

type ImportResult = {
  imported: number
  skippedNoName: number
  skippedDuplicate: number
  failed: number
  failedRows: Array<{ name: string; error: string }>
}

function normalizeHeader(value: string): string {
  return normalizeText(value)
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
}

function mapHeadersToClients(
  normalizedHeaders: string[],
  originalHeaders: string[],
  dataRows: string[][]
): ImportPreview {
  const pick = (...aliases: string[]) =>
    normalizedHeaders.findIndex((h) => aliases.includes(h))

  // Nume client — Google Contacts: "Display Name"; standard: "Nume", "Name" etc.
  const nameIndex = pick(
    'display_name', 'displayname', 'full_name', 'fullname',
    'nume_complet', 'nume_client', 'client', 'contact', 'persoana',
    'name', 'denumire', 'nume'
  )
  // First + Last fallback for Google Contacts
  const firstNameIndex = pick('first_name', 'given_name', 'prenume', 'firstname')
  const lastNameIndex  = pick('last_name', 'family_name', 'surname', 'lastname', 'nume_familie')

  // Primary phone — "Phone 1 - Value" → phone_1_value after normalization
  const phoneIndex = pick(
    'phone_1_value', 'phone', 'phone_number', 'phonenumber', 'mobile', 'nr_telefon',
    'nr_tel', 'numar_telefon', 'numar_tel', 'telefon', 'tel', 'mobil'
  )
  // Secondary phone fallback
  const phone2Index = pick('phone_2_value', 'phone2', 'mobile2', 'telefon_alt', 'alt_telefon')

  const emailIndex = pick('email', 'e_mail', 'email_address', 'mail', 'adresa_email', 'email_1_value')
  const addressIndex = pick(
    'delivery_location', 'location', 'city', 'oras', 'localitate',
    'adresa', 'address', 'locatie', 'locatie_livrare', 'loc', 'sat', 'comuna'
  )
  const notesIndex = pick('notes', 'observatii', 'observatii_client', 'note', 'obs', 'detalii', 'comments')

  const hasNameColumn = nameIndex >= 0 || firstNameIndex >= 0 || lastNameIndex >= 0
  const hasPhoneColumn = phoneIndex >= 0 || phone2Index >= 0

  console.log('[clienti import] headers (normalized):', normalizedHeaders)
  console.log('[clienti import] column map:', { nameIndex, firstNameIndex, lastNameIndex, phoneIndex, phone2Index, emailIndex, addressIndex, notesIndex })

  // Track which header indices are mapped
  const mappedIndices = new Set(
    [nameIndex, firstNameIndex, lastNameIndex, phoneIndex, phone2Index, emailIndex, addressIndex, notesIndex]
      .filter((i) => i >= 0)
  )

  // Build human-readable mapping summary for preview
  const mappingSummary: string[] = []
  if (nameIndex >= 0) {
    mappingSummary.push(`"${originalHeaders[nameIndex]}" → Nume client ✓`)
  } else if (firstNameIndex >= 0 || lastNameIndex >= 0) {
    const parts = [
      firstNameIndex >= 0 ? `"${originalHeaders[firstNameIndex]}"` : null,
      lastNameIndex  >= 0 ? `"${originalHeaders[lastNameIndex]}"` : null,
    ].filter(Boolean)
    mappingSummary.push(`${parts.join(' + ')} → Nume client ✓`)
  }
  if (phoneIndex   >= 0) mappingSummary.push(`"${originalHeaders[phoneIndex]}" → Telefon ✓`)
  if (phone2Index  >= 0) mappingSummary.push(`"${originalHeaders[phone2Index]}" → Telefon (rezervă) ✓`)
  if (emailIndex   >= 0) mappingSummary.push(`"${originalHeaders[emailIndex]}" → Email ✓`)
  if (addressIndex >= 0) mappingSummary.push(`"${originalHeaders[addressIndex]}" → Adresă ✓`)
  if (notesIndex   >= 0) mappingSummary.push(`"${originalHeaders[notesIndex]}" → Observații ✓`)

  const unmappedColumns = originalHeaders.filter((h, i) => !mappedIndices.has(i) && h.trim().length > 0)

  let formulaFixCount = 0
  const allRows = dataRows.map((columns) => {
    let numeName = nameIndex >= 0 ? (columns[nameIndex] ?? '').trim() : ''

    // Detect raw Excel formula text or "Gospodar Nou" auto-generated placeholders.
    // When found, fall back to First + Last Name columns.
    const isRawFormula = numeName.startsWith('=')
    const isPlaceholder = /^Gospodar\s*Nou\b/i.test(numeName)
    if (!numeName || isRawFormula || isPlaceholder) {
      const first = firstNameIndex >= 0 ? (columns[firstNameIndex] ?? '').trim() : ''
      const last  = lastNameIndex  >= 0 ? (columns[lastNameIndex]  ?? '').trim() : ''
      const combined = [first, last].filter(Boolean).join(' ')
      if (combined) {
        formulaFixCount++
        numeName = combined
      } else {
        numeName = ''
      }
    }

    // Use primary phone; fall back to secondary if primary is empty
    let phoneVal = phoneIndex >= 0 ? (columns[phoneIndex] ?? '').trim() : ''
    if (!phoneVal && phone2Index >= 0) {
      phoneVal = (columns[phone2Index] ?? '').trim()
    }
    return {
      nume_client: numeName,
      telefon:     phoneVal || null,
      email:       emailIndex   >= 0 ? (columns[emailIndex]   ?? '').trim() || null : null,
      adresa:      addressIndex >= 0 ? (columns[addressIndex] ?? '').trim() || null : null,
      observatii:  notesIndex   >= 0 ? (columns[notesIndex]   ?? '').trim() || null : null,
    }
  })

  const rows = allRows.filter((row) => row.nume_client.length > 0)
  const totalParsed = allRows.length
  const skippedNoName = totalParsed - rows.length

  return { rows, totalParsed, skippedNoName, formulaFixCount, mappingSummary, unmappedColumns, hasNameColumn, hasPhoneColumn }
}

const HEADER_DETECTION_ALIASES = new Set([
  // name
  'display_name', 'displayname', 'full_name', 'fullname', 'first_name', 'last_name',
  'given_name', 'family_name', 'surname', 'firstname', 'lastname', 'nume_familie',
  'nume_complet', 'nume_client', 'client', 'contact', 'persoana', 'name', 'denumire', 'prenume', 'nume',
  // phone
  'telefon', 'phone', 'phone_1_value', 'phone_2_value', 'phone_number', 'phonenumber',
  'tel', 'mobil', 'mobile', 'mobile2', 'nr_telefon', 'numar_telefon',
  // email
  'email', 'e_mail', 'email_1_value', 'email_address', 'mail', 'adresa_email',
  // address
  'adresa', 'address', 'delivery_location', 'location', 'localitate', 'oras', 'city', 'loc', 'sat', 'comuna',
  // notes
  'notes', 'note', 'observatii', 'obs', 'detalii', 'comments',
])

function parseClientCsv(content: string): ImportPreview {
  // Strip UTF-8 BOM
  const raw = content.replace(/^\uFEFF/, '')
  const lines = raw.split(/\r?\n/).map((l) => l.trim()).filter(Boolean)
  if (!lines.length) return { rows: [], totalParsed: 0, skippedNoName: 0, formulaFixCount: 0, mappingSummary: [], unmappedColumns: [], hasNameColumn: false, hasPhoneColumn: false }

  const firstRow     = parseCsvLine(lines[0])
  const normalizedH  = firstRow.map(normalizeHeader)
  const hasHeader    = normalizedH.some((h) => HEADER_DETECTION_ALIASES.has(h))

  const originalHeaders = hasHeader ? firstRow : ['Nume', 'Telefon', 'Email', 'Adresa', 'Observatii']
  const normalizedHeaders = hasHeader ? normalizedH : ['nume_client', 'telefon', 'email', 'adresa', 'observatii']
  const dataLines = hasHeader ? lines.slice(1) : lines

  return mapHeadersToClients(normalizedHeaders, originalHeaders, dataLines.map(parseCsvLine))
}

async function parseClientXlsx(buffer: ArrayBuffer): Promise<ImportPreview> {
  const XLSX = await import('xlsx')
  // cellFormula: false → use cached computed values instead of formula strings
  const workbook = XLSX.read(buffer, { type: 'array', cellFormula: false })
  const firstSheetName = workbook.SheetNames[0]
  if (!firstSheetName) throw new Error('Fișierul Excel nu conține foi de calcul.')

  const sheet  = workbook.Sheets[firstSheetName]
  const rawRows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: '' }) as unknown[][]
  if (rawRows.length === 0) return { rows: [], totalParsed: 0, skippedNoName: 0, formulaFixCount: 0, mappingSummary: [], unmappedColumns: [], hasNameColumn: false, hasPhoneColumn: false }

  const originalHeaders  = (rawRows[0] as unknown[]).map((c) => String(c ?? '').trim())
  const normalizedHeaders = originalHeaders.map(normalizeHeader)
  const dataRows = rawRows.slice(1).map((row) =>
    (row as unknown[]).map((c) => String(c ?? '').trim())
  )

  return mapHeadersToClients(normalizedHeaders, originalHeaders, dataRows)
}

async function downloadImportTemplate() {
  const XLSX = await import('xlsx')
  const rows = [
    ['Nume client', 'Telefon', 'Email', 'Adresă', 'Observații'],
    ['Ion Popescu', '0745123456', 'ion@email.com', 'Suceava', ''],
    ['Maria Ionescu', '0722334455', '', 'Fălticeni', 'Client fidel'],
  ]
  const ws = XLSX.utils.aoa_to_sheet(rows)
  // Set column widths
  ws['!cols'] = [{ wch: 20 }, { wch: 15 }, { wch: 22 }, { wch: 16 }, { wch: 20 }]
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Clienți')
  XLSX.writeFile(wb, 'model-import-clienti.xlsx')
}

async function parseClientFile(file: File): Promise<ImportPreview> {
  const ext = file.name.split('.').pop()?.toLowerCase()
  if (ext === 'xlsx' || ext === 'xls') {
    const buffer = await file.arrayBuffer()
    return parseClientXlsx(buffer)
  }
  const content = await file.text()
  return parseClientCsv(content)
}

export function ClientPageClient({ initialClienți }: ClientPageClientProps) {
  const router = useRouter()
  const queryClient = useQueryClient()
  const { registerAddAction } = useAddAction()

  const [searchTerm, setSearchTerm] = useState('')
  const [showOnlyUnpaid, setShowOnlyUnpaid] = useState(false)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [selectedClient, setSelectedClient] = useState<Client | null>(null)
  const [desktopSelectedClientId, setDesktopSelectedClientId] = useState<string | null>(null)
  const [editingClient, setEditingClient] = useState<Client | null>(null)
  const [deletingClient, setDeletingClient] = useState<Client | null>(null)
  const [focusClientId, setFocusClientId] = useState<string | null>(null)
  const [focusTick, setFocusTick] = useState(0)
  const [importingCsv, setImportingCsv] = useState(false)
  const [importPreview, setImportPreview] = useState<ImportPreview | null>(null)
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false)
  const [isDeletingAll, setIsDeletingAll] = useState(false)
  const [importHelpOpen, setImportHelpOpen] = useState(false)
  const [importProgress, setImportProgress] = useState<{ done: number; total: number; phase: 'ids' | 'insert' } | null>(null)
  const [importResult, setImportResult] = useState<ImportResult | null>(null)
  const [showFailedRows, setShowFailedRows] = useState(false)
  const [bulkDeleteProgress, setBulkDeleteProgress] = useState<{ done: number; total: number } | null>(null)

  const pendingDeleteTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({})
  const pendingDeletedItems = useRef<Record<string, Client>>({})
  const csvInputRef = useRef<HTMLInputElement | null>(null)

  const {
    data: clienti = initialClienți,
    isLoading,
    isError,
    error,
  } = useQuery({
    queryKey: queryKeys.clienti,
    queryFn: getClienti,
    initialData: initialClienți,
  })

  useMobileScrollRestore({
    storageKey: 'scroll:clienti',
    ready: !isLoading,
  })

  const { data: comenzi = [], isLoading: isLoadingComenzi } = useQuery({
    queryKey: queryKeys.comenzi,
    queryFn: getComenzi,
  })

  const { data: vanzari = [] } = useQuery({
    queryKey: queryKeys.vanzari,
    queryFn: getVanzari,
  })

  const createMutation = useMutation({
    mutationFn: createClienti,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.clienti })
      toast.success('Client adăugat cu succes.')
      setDialogOpen(false)
    },
    onError: (err: Error) => {
      toast.error(err.message)
    },
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Parameters<typeof updateClienti>[1] }) =>
      updateClienti(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.clienti })
      toast.success('Client actualizat.')
      setEditOpen(false)
      setEditingClient(null)
    },
    onError: (err: Error) => {
      toast.error(err.message)
    },
  })

  const deleteMutation = useMutation({
    mutationFn: deleteClienti,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.clienti })
      toast.success('Client șters.')
    },
    onError: (err: Error) => {
      toast.error(err.message)
      queryClient.invalidateQueries({ queryKey: queryKeys.clienti })
    },
  })

  useEffect(() => {
    return () => {
      Object.values(pendingDeleteTimers.current).forEach((timer) => clearTimeout(timer))
    }
  }, [])

  useEffect(() => {
    const unregister = registerAddAction(() => setDialogOpen(true), 'Adaugă client')
    return unregister
  }, [registerAddAction])

  const handleFileSelect = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file || importingCsv) return

    const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB
    if (file.size > MAX_FILE_SIZE) {
      toast.error('Fișierul este prea mare. Limita este 10MB.')
      return
    }

    const ext = file.name.split('.').pop()?.toLowerCase()
    if (!ext || !['csv', 'xlsx', 'xls'].includes(ext)) {
      toast.error('Format neacceptat. Folosește Excel (.xlsx) sau CSV.')
      return
    }

    try {
      const preview = await parseClientFile(file)

      if (preview.totalParsed === 0) {
        toast.error('Fișierul nu conține date.')
        return
      }
      if (!preview.hasNameColumn) {
        toast.error('Nicio coloană cu numele clientului nu a fost detectată. Verifică fișierul.')
        return
      }
      if (!preview.rows.length) {
        toast.error('Fișierul conține doar antetul, fără date valide cu nume de client.')
        return
      }

      setImportPreview(preview)
    } catch (parseError) {
      console.error('[clienti import] parse error:', parseError)
      const message = parseError instanceof Error ? parseError.message : 'Nu am putut citi fișierul.'
      toast.error(message)
    }
  }

  const handleConfirmImport = async () => {
    if (!importPreview?.rows.length || importingCsv) return

    const { rows: validRows, skippedNoName } = importPreview
    setImportingCsv(true)
    setImportProgress({ done: 0, total: validRows.length, phase: 'ids' })

    const failedRows: ImportResult['failedRows'] = []
    let importedCount = 0
    let duplicateCount = 0

    try {
      const supabase = getSupabase()
      const tenantId = await getTenantId(supabase)

      // Load existing clients once: for duplicate detection AND to find max id_client number
      const { data: existingData } = await supabase
        .from('clienti')
        .select('nume_client,telefon,id_client')
        .eq('tenant_id', tenantId)
      const existingSet = new Set(
        (existingData ?? []).map(
          (c) => `${normalizeText(c.nume_client)}|${normalizeText(c.telefon ?? '')}`
        )
      )

      // Find the highest numeric suffix among existing id_client values for this tenant.
      // This prevents collisions caused by a reset or out-of-sync global sequence.
      // E.g. existing "C001"…"C038" → idCounter starts at 39.
      let idCounter = 0
      for (const row of existingData ?? []) {
        const match = row.id_client?.match(/(\d+)$/)
        if (match) {
          const num = parseInt(match[1], 10)
          if (num > idCounter) idCounter = num
        }
      }
      idCounter++ // start one above the current max

      // Generate IDs locally (no RPC per-row) — avoids global-sequence/reset collisions
      const makeClientId = (): string => {
        const n = idCounter++
        return `C${String(n).padStart(3, '0')}`
      }

      // Build records, skipping duplicates
      type ImportRecord = {
        supabaseRow: {
          tenant_id: string; id_client: string; nume_client: string
          telefon: string | null; email: string | null; adresa: string | null; observatii: string | null
        }
        sourceRow: ParsedClientRow
      }
      const records: ImportRecord[] = []

      for (let i = 0; i < validRows.length; i++) {
        const row = validRows[i]
        const dupKey = `${normalizeText(row.nume_client)}|${normalizeText(row.telefon ?? '')}`
        if (existingSet.has(dupKey)) {
          duplicateCount++
          setImportProgress({ done: i + 1, total: validRows.length, phase: 'ids' })
          continue
        }
        records.push({
          supabaseRow: {
            tenant_id: tenantId,
            id_client: makeClientId(),
            nume_client: row.nume_client.trim(),
            telefon: row.telefon || null,
            email: row.email || null,
            adresa: row.adresa || null,
            observatii: row.observatii || null,
          },
          sourceRow: row,
        })
        setImportProgress({ done: i + 1, total: validRows.length, phase: 'ids' })
      }

      // Batch insert in chunks of 50; fall back to row-by-row if a batch fails
      const CHUNK_SIZE = 50
      for (let i = 0; i < records.length; i += CHUNK_SIZE) {
        const chunk = records.slice(i, i + CHUNK_SIZE)
        const { error } = await supabase.from('clienti').insert(chunk.map((r) => r.supabaseRow))

        if (error) {
          // Batch failed — try each row individually to isolate bad rows
          const pgError = error as unknown as Record<string, unknown>
          console.error('[clienti import] batch insert failed, retrying row-by-row:', {
            message: error.message, details: pgError.details, hint: pgError.hint, code: pgError.code,
          })
          for (const record of chunk) {
            const { error: rowErr } = await supabase.from('clienti').insert([record.supabaseRow])
            if (rowErr) {
              const rowPg = rowErr as unknown as Record<string, unknown>
              console.error('[clienti import] row error:', { name: record.sourceRow.nume_client, message: rowErr.message, details: rowPg.details })
              failedRows.push({ name: record.sourceRow.nume_client, error: rowErr.message })
            } else {
              importedCount++
            }
          }
        } else {
          importedCount += chunk.length
        }

        setImportProgress({ done: Math.min(i + CHUNK_SIZE, records.length), total: records.length, phase: 'insert' })
        if (i + CHUNK_SIZE < records.length) {
          await new Promise<void>((resolve) => setTimeout(resolve, 50))
        }
      }

      queryClient.invalidateQueries({ queryKey: queryKeys.clienti })
      setImportPreview(null)
      setImportResult({ imported: importedCount, skippedNoName, skippedDuplicate: duplicateCount, failed: failedRows.length, failedRows })
    } catch (importError) {
      console.error('[clienti import] fatal error:', importError)
      const message = importError instanceof Error ? importError.message : 'Nu am putut salva clienții.'
      toast.error(`Eroare: ${message}`)
    } finally {
      setImportingCsv(false)
      setImportProgress(null)
    }
  }

  const scheduleDelete = (client: Client) => {
    const clientId = client.id
    pendingDeletedItems.current[clientId] = client
    queryClient.setQueryData<Client[]>(
      queryKeys.clienti,
      (current = []) => current.filter((item) => item.id !== clientId)
    )

    const timer = setTimeout(() => {
      delete pendingDeleteTimers.current[clientId]
      delete pendingDeletedItems.current[clientId]
      deleteMutation.mutate(clientId)
    }, 5000)

    pendingDeleteTimers.current[clientId] = timer

    toast.warning('Client programat pentru ștergere.', {
      duration: 5000,
      action: {
        label: 'Undo',
        onClick: () => {
          const pendingTimer = pendingDeleteTimers.current[clientId]
          if (!pendingTimer) return
          clearTimeout(pendingTimer)
          delete pendingDeleteTimers.current[clientId]
          delete pendingDeletedItems.current[clientId]
          queryClient.invalidateQueries({ queryKey: queryKeys.clienti })
          toast.success('Ștergerea a fost anulată.')
        },
      },
    })
  }

  const handleBulkDelete = async () => {
    const toDelete = [...clienti]
    if (!toDelete.length) return

    setBulkDeleteOpen(false)
    setIsDeletingAll(true)
    setBulkDeleteProgress({ done: 0, total: toDelete.length })

    const supabase = getSupabase()
    const tenantId = await getTenantId(supabase)

    let deletedCount = 0
    const failedNames: string[] = []
    const CHUNK = 50

    for (let i = 0; i < toDelete.length; i += CHUNK) {
      const chunk = toDelete.slice(i, i + CHUNK)
      const ids = chunk.map((c) => c.id)

      // Batch delete — fast path (no FK check). Fails if clients have related records.
      const { error } = await supabase
        .from('clienti')
        .delete()
        .eq('tenant_id', tenantId)
        .in('id', ids)

      if (error) {
        // Fall back to individual deletes (which check FK constraints properly)
        for (const client of chunk) {
          try {
            await deleteClienti(client.id)
            deletedCount++
          } catch {
            failedNames.push(client.nume_client)
          }
        }
      } else {
        deletedCount += chunk.length
      }

      setBulkDeleteProgress({ done: Math.min(i + CHUNK, toDelete.length), total: toDelete.length })
      if (i + CHUNK < toDelete.length) {
        await new Promise<void>((resolve) => setTimeout(resolve, 50))
      }
    }

    queryClient.invalidateQueries({ queryKey: queryKeys.clienti })

    if (failedNames.length) {
      toast.warning(`${deletedCount} șterși. ${failedNames.length} nu pot fi șterși (au date asociate).`)
    } else {
      toast.success(`${deletedCount} clienți șterși.`)
    }

    setIsDeletingAll(false)
    setBulkDeleteProgress(null)
  }

  const metricsByClient = useMemo(() => {
    const map: Record<
      string,
      {
        totalRon: number
        totalKg: number
        vanzariCount: number
        unpaidRon: number
        hasRecentSales: boolean
        lastVanzare?: { data: string; kg: number; totalRon: number } | null
        comenziCount: number
        lastComanda?: { data: string; kg: number; status: string } | null
      }
    > = {}

    const now = Date.now()
    for (const client of clienti) {
      map[client.id] = {
        totalRon: 0,
        totalKg: 0,
        vanzariCount: 0,
        unpaidRon: 0,
        hasRecentSales: false,
        lastVanzare: null,
        comenziCount: 0,
        lastComanda: null,
      }
    }

    for (const vanzare of vanzari) {
      if (!vanzare.client_id || !map[vanzare.client_id]) continue
      const totalRon = Number(vanzare.cantitate_kg || 0) * Number(vanzare.pret_lei_kg || 0)
      const entry = map[vanzare.client_id]
      entry.totalRon += totalRon
      entry.totalKg += Number(vanzare.cantitate_kg || 0)
      entry.vanzariCount += 1
      if (!isIncasata(vanzare.status_plata)) entry.unpaidRon += totalRon
      const saleDate = new Date(vanzare.data)
      if (!Number.isNaN(saleDate.getTime())) {
        const daysDiff = (now - saleDate.getTime()) / (1000 * 60 * 60 * 24)
        if (daysDiff <= 30) entry.hasRecentSales = true
      }
      if (!entry.lastVanzare || vanzare.data > entry.lastVanzare.data) {
        entry.lastVanzare = {
          data: vanzare.data,
          kg: Number(vanzare.cantitate_kg || 0),
          totalRon,
        }
      }
    }

    for (const comanda of comenzi) {
      if (!comanda.client_id || !map[comanda.client_id]) continue
      const entry = map[comanda.client_id]
      entry.comenziCount += 1
      const date = comanda.data_livrare || comanda.data_comanda
      if (!entry.lastComanda || date > entry.lastComanda.data) {
        entry.lastComanda = {
          data: date,
          kg: Number(comanda.cantitate_kg || 0),
          status: comanda.status,
        }
      }
    }

    return map
  }, [clienti, comenzi, vanzari])

  const totalOpenOrders = useMemo(
    () => comenzi.filter((row) => row.status !== 'livrata' && row.status !== 'anulata').length,
    [comenzi]
  )

  const totalUnpaidRon = useMemo(
    () =>
      vanzari.reduce((sum, row) => {
        const value = Number(row.cantitate_kg || 0) * Number(row.pret_lei_kg || 0)
        return isIncasata(row.status_plata) ? sum : sum + value
      }, 0),
    [vanzari]
  )

  const clientsWithUnpaid = useMemo(
    () => clienti.filter((client) => (metricsByClient[client.id]?.unpaidRon ?? 0) > 0),
    [clienti, metricsByClient]
  )

  const ranking = useMemo(
    () =>
      clienti
        .map((client) => ({
          client,
          totalRon: metricsByClient[client.id]?.totalRon ?? 0,
          totalKg: metricsByClient[client.id]?.totalKg ?? 0,
        }))
        .filter((row) => row.totalRon > 0)
        .sort((a, b) => b.totalRon - a.totalRon)
        .slice(0, 5),
    [clienti, metricsByClient]
  )

  const rankingMaxRon = useMemo(
    () => ranking.reduce((max, row) => (row.totalRon > max ? row.totalRon : max), 0),
    [ranking]
  )

  const filteredClienti = useMemo(() => {
    const term = normalizeText(searchTerm.trim())
    let rows = clienti

    if (term) {
      rows = rows.filter((client) =>
        [client.nume_client, client.telefon, client.email, client.adresa, client.observatii]
          .filter(Boolean)
          .some((value) => normalizeText(value).includes(term))
      )
    }

    if (showOnlyUnpaid) {
      rows = rows.filter((client) => (metricsByClient[client.id]?.unpaidRon ?? 0) > 0)
    }

    return rows
  }, [clienti, metricsByClient, searchTerm, showOnlyUnpaid])

  const selectedClientComenzi = useMemo(() => {
    if (!selectedClient) return []
    return comenzi.filter((comanda) => comanda.client_id === selectedClient.id)
  }, [comenzi, selectedClient])

  const focusKeyByClient = useMemo(() => {
    if (!focusClientId) return {}
    return { [focusClientId]: focusTick }
  }, [focusClientId, focusTick])

  const desktopSelectedClient =
    filteredClienti.find((item) => item.id === desktopSelectedClientId) ?? filteredClienti[0] ?? null

  return (
    <AppShell
      header={<PageHeader title="Clienți" subtitle="Administrare clienți" rightSlot={<UserCheck className="h-5 w-5" />} />}
      bottomBar={
        <StickyActionBar>
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-medium text-[var(--agri-text-muted)]">Total clienți: {clienti.length}</p>
          </div>
        </StickyActionBar>
      }
    >
      <div className="mx-auto mt-3 w-full max-w-4xl space-y-3 px-0 py-3 sm:mt-0 sm:px-3 lg:max-w-7xl">
        <input ref={csvInputRef} type="file" accept=".csv,.xlsx,.xls,text/csv" className="hidden" onChange={handleFileSelect} />

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <MiniCard icon="👤" value={String(clienti.length)} sub="clienți" label="" />
          <MiniCard icon="📦" value={String(totalOpenOrders)} sub="comenzi active" label="" onClick={() => router.push('/comenzi')} />
          <MiniCard icon="💸" value={`${totalUnpaidRon.toFixed(0)} RON`} sub="RON de colectat" label="Neîncasat" className="col-span-2 sm:col-span-1" />
        </div>

        <div
          style={{
            background: colors.white,
            borderRadius: radius.xl,
            boxShadow: shadows.card,
            padding: spacing.lg,
          }}
        >
          <SectionTitle className="mb-2" title="Top clienți (valoare)" />
          {ranking.length === 0 ? (
            <p style={{ fontSize: 11, color: colors.gray }}>Nu există vânzări pentru clasament.</p>
          ) : (
            <div style={{ display: 'grid', gap: spacing.xs }}>
              {ranking.map((row, index) => {
                const progress = rankingMaxRon > 0 ? Math.max(6, (row.totalRon / rankingMaxRon) * 100) : 0
                const rankBg = [colors.greenLight, colors.blueLight, colors.yellowLight, colors.coralLight][index % 4]

                return (
                  <button
                    key={row.client.id}
                    type="button"
                    onClick={() => {
                      setFocusClientId(row.client.id)
                      setFocusTick((current) => current + 1)
                    }}
                    style={{
                      border: 'none',
                      background: colors.white,
                      borderRadius: radius.md,
                      width: '100%',
                      textAlign: 'left',
                      padding: `${spacing.xs + 2}px ${spacing.sm}px`,
                      cursor: 'pointer',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: spacing.sm }}>
                      <div
                        style={{
                          width: 24,
                          height: 24,
                          borderRadius: radius.sm,
                          background: rankBg,
                          color: colors.dark,
                          fontSize: 11,
                          fontWeight: 700,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0,
                        }}
                      >
                        {index + 1}
                      </div>
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div
                          style={{
                            fontSize: 12,
                            fontWeight: 700,
                            color: colors.dark,
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                          }}
                        >
                          {row.client.nume_client}
                        </div>
                        <div
                          style={{
                            marginTop: 3,
                            height: 5,
                            borderRadius: radius.full,
                            background: colors.grayLight,
                            overflow: 'hidden',
                          }}
                        >
                          <div
                            style={{
                              width: `${progress}%`,
                              height: '100%',
                              borderRadius: radius.full,
                              background: colors.green,
                            }}
                          />
                        </div>
                      </div>
                      <div style={{ textAlign: 'right', flexShrink: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 700, color: colors.dark }}>{row.totalRon.toFixed(0)} RON</div>
                        <div style={{ fontSize: 10, color: colors.gray }}>{row.totalKg.toFixed(1)} kg</div>
                      </div>
                    </div>
                  </button>
                )
              })}
            </div>
          )}
        </div>

        {clientsWithUnpaid.length > 0 ? (
          <AlertCard
            icon="💸"
            label={`${clientsWithUnpaid.length} clienți cu sold neîncasat`}
            value={`${totalUnpaidRon.toFixed(0)} RON`}
            sub="RON de colectat"
            variant="warning"
            onClick={() => setShowOnlyUnpaid(true)}
          />
        ) : null}

        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <SearchField
              containerClassName="flex-1"
              placeholder="Caută după nume, telefon sau email"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              aria-label="Caută clienți"
            />
            {showOnlyUnpaid ? (
              <Button type="button" variant="outline" className="h-12 shrink-0" onClick={() => setShowOnlyUnpaid(false)}>
                Reset
              </Button>
            ) : null}
          </div>

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            <Button type="button" variant="outline" className="h-11" disabled={importingCsv || isDeletingAll} onClick={() => csvInputRef.current?.click()}>
              {importProgress?.phase === 'insert'
                ? `Import ${importProgress.done}/${importProgress.total}...`
                : importProgress?.phase === 'ids'
                  ? `Pregătire ${importProgress.done}/${importProgress.total}...`
                  : importingCsv
                    ? 'Se importă...'
                    : 'Importă din fișier'}
            </Button>
            <Button type="button" variant="outline" className="h-11" onClick={() => setDialogOpen(true)} disabled={isDeletingAll}>
              Client nou
            </Button>
            <Button
              type="button"
              variant="outline"
              className="col-span-2 h-11 border-red-200 text-red-700 hover:bg-red-50 sm:col-span-1"
              disabled={clienti.length === 0 || isDeletingAll || importingCsv}
              onClick={() => setBulkDeleteOpen(true)}
            >
              <Trash2 className="h-4 w-4" />
              {bulkDeleteProgress
                ? `Se șterge... ${bulkDeleteProgress.done}/${bulkDeleteProgress.total}`
                : isDeletingAll
                  ? 'Se șterge...'
                  : 'Șterge toți'}
            </Button>
          </div>

          <p className="text-xs text-[var(--agri-text-muted)]">
            Acceptă fișiere CSV sau Excel (.xlsx). În fișa clientului poți salva rapid contactul în telefon.{' '}
            <button
              type="button"
              className="inline text-[var(--agri-primary)] underline-offset-2 hover:underline"
              onClick={() => setImportHelpOpen(true)}
            >
              ℹ️ Cum trebuie să arate fișierul?
            </button>
          </p>

          {importPreview && (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 space-y-3">
              {/* Count summary */}
              <div className="space-y-1">
                <p className="text-sm font-semibold text-emerald-800">
                  {importPreview.totalParsed} contacte găsite
                  {importPreview.skippedNoName > 0
                    ? `, ${importPreview.rows.length} cu nume valid, ${importPreview.skippedNoName} fără nume (vor fi sărite)`
                    : `, ${importPreview.rows.length} cu nume valid`}
                </p>
                {!importPreview.hasPhoneColumn && (
                  <p className="text-xs font-medium text-amber-700">⚠️ Nu s-a detectat coloana de telefon</p>
                )}
                {importPreview.formulaFixCount > 0 && (
                  <p className="text-xs font-medium text-blue-700">
                    ℹ️ {importPreview.formulaFixCount} {importPreview.formulaFixCount === 1 ? 'contact are' : 'contacte au'} nume din formulă Excel — s-a folosit coloana "First Name"
                  </p>
                )}
              </div>

              {/* Mapped columns */}
              {importPreview.mappingSummary.length > 0 && (
                <div className="space-y-0.5">
                  <p className="text-xs font-medium uppercase tracking-wide text-emerald-700">Coloane detectate</p>
                  {importPreview.mappingSummary.map((line) => (
                    <p key={line} className="text-xs text-emerald-700">{line}</p>
                  ))}
                </div>
              )}

              {/* Unmapped columns */}
              {importPreview.unmappedColumns.length > 0 && (
                <div className="space-y-0.5">
                  <p className="text-xs font-medium uppercase tracking-wide text-gray-400">Coloane nerecunoscute (ignorate)</p>
                  <p className="text-xs text-gray-400">{importPreview.unmappedColumns.join(', ')}</p>
                </div>
              )}

              {/* Row preview */}
              <div className="space-y-1.5">
                <p className="text-xs font-medium uppercase tracking-wide text-emerald-700">Primele rânduri</p>
                {importPreview.rows.slice(0, 5).map((row, i) => (
                  <div key={i} className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-emerald-800">
                    <span className="font-semibold">{row.nume_client}</span>
                    {row.telefon ? <span className="text-emerald-600">{row.telefon}</span> : null}
                    {row.email ? <span className="text-emerald-600">{row.email}</span> : null}
                    {row.adresa ? <span className="text-emerald-600">{row.adresa}</span> : null}
                  </div>
                ))}
                {importPreview.rows.length > 5 ? (
                  <p className="text-xs text-emerald-600">...și încă {importPreview.rows.length - 5} contacte</p>
                ) : null}
              </div>

              <div className="flex gap-2">
                <Button
                  type="button"
                  size="sm"
                  className="bg-emerald-600 text-white hover:bg-emerald-700"
                  onClick={handleConfirmImport}
                  disabled={importingCsv || !importPreview.rows.length}
                >
                  {importProgress
                    ? importProgress.phase === 'ids'
                      ? `Pregătire ${importProgress.done}/${importProgress.total}...`
                      : `Import ${importProgress.done}/${importProgress.total}...`
                    : importingCsv
                      ? 'Se importă...'
                      : `Importă ${importPreview.rows.length} contacte`}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => setImportPreview(null)}
                  disabled={importingCsv}
                >
                  Anulează
                </Button>
              </div>
            </div>
          )}
        </div>

        {isError ? (
          <ErrorState
            title="Eroare la încărcare"
            message={(error as Error).message}
            onRetry={() => queryClient.invalidateQueries({ queryKey: queryKeys.clienti })}
          />
        ) : null}

        {isLoading ? (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {Array.from({ length: 4 }).map((_, index) => (
              <ListSkeletonCard key={index} className="min-h-[146px] sm:min-h-[208px]" />
            ))}
          </div>
        ) : null}

        {!isLoading && !isError && filteredClienti.length === 0 ? (
          <EmptyState icon={<Users className="h-16 w-16" />} title="Niciun client încă" description="Adaugă primul client pentru a începe" />
        ) : null}

        {!isLoading && !isError && filteredClienti.length > 0 ? (
          <>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:hidden">
              {filteredClienti.map((client) => {
                const metrics = metricsByClient[client.id]
                return (
                  <ClientCard
                    key={client.id}
                    client={client}
                    totalRon={metrics?.totalRon ?? 0}
                    totalKg={metrics?.totalKg ?? 0}
                    comenziCount={metrics?.comenziCount ?? 0}
                    vanzariCount={metrics?.vanzariCount ?? 0}
                    unpaidRon={metrics?.unpaidRon ?? 0}
                    hasRecentSales={metrics?.hasRecentSales ?? false}
                    lastComanda={metrics?.lastComanda}
                    lastVanzare={metrics?.lastVanzare}
                    focusKey={focusKeyByClient[client.id] ?? 0}
                    onEdit={(item) => {
                      setEditingClient(item)
                      setEditOpen(true)
                    }}
                    onDelete={(id) => {
                      const target = clienti.find((item) => item.id === id) ?? null
                      setDeletingClient(target)
                    }}
                    onOpenDetails={(item) => {
                      setSelectedClient(item)
                      setDrawerOpen(true)
                    }}
                  />
                )
              })}
            </div>

            <div className="hidden lg:grid lg:grid-cols-[minmax(0,1.9fr)_minmax(360px,1fr)] lg:gap-4">
              <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
                <table className="min-w-full text-left text-sm">
                  <thead className="bg-gray-100 text-xs uppercase tracking-wide text-gray-500">
                    <tr>
                      <th className="px-4 py-3 font-semibold">Client</th>
                      <th className="px-4 py-3 font-semibold">Telefon</th>
                      <th className="px-4 py-3 font-semibold">Vânzări</th>
                      <th className="px-4 py-3 font-semibold">Comenzi</th>
                      <th className="px-4 py-3 font-semibold">Neîncasat</th>
                      <th className="w-8 px-2 py-3" />
                    </tr>
                  </thead>
                  <tbody>
                    {filteredClienti.map((client) => {
                      const metrics = metricsByClient[client.id]
                      const isSelected = desktopSelectedClient?.id === client.id
                      return (
                        <tr
                          key={client.id}
                          className={`cursor-pointer border-t border-gray-100 transition-colors ${isSelected ? 'bg-blue-50' : 'hover:bg-gray-50'}`}
                          onClick={() => setDesktopSelectedClientId(client.id)}
                        >
                          <td className="px-4 py-3 font-medium text-gray-900">{client.nume_client}</td>
                          <td className="px-4 py-3 text-gray-700">{client.telefon || '-'}</td>
                          <td className="px-4 py-3 text-gray-700">{metrics?.vanzariCount ?? 0}</td>
                          <td className="px-4 py-3 text-gray-700">{metrics?.comenziCount ?? 0}</td>
                          <td className="px-4 py-3 text-gray-900">{(metrics?.unpaidRon ?? 0).toFixed(0)} RON</td>
                          <td className="px-2 py-3">
                            <button
                              type="button"
                              aria-label={`Șterge ${client.nume_client}`}
                              className="rounded p-1 text-gray-300 opacity-0 transition-all hover:bg-red-50 hover:text-red-600 group-hover:opacity-100 [tr:hover_&]:opacity-100"
                              onClick={(e) => {
                                e.stopPropagation()
                                setDeletingClient(client)
                              }}
                            >
                              <X className="h-3.5 w-3.5" />
                            </button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>

              <aside className="sticky top-6 self-start max-h-[calc(100vh-5rem)] overflow-y-auto rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
                <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-500">Profil client</h3>
                {desktopSelectedClient ? (
                  <div className="mt-4 space-y-3 text-sm text-gray-700">
                    <p><span className="font-medium text-gray-900">Nume:</span> {desktopSelectedClient.nume_client}</p>
                    <p><span className="font-medium text-gray-900">Telefon:</span> {desktopSelectedClient.telefon || '-'}</p>
                    <p><span className="font-medium text-gray-900">Email:</span> {desktopSelectedClient.email || '-'}</p>
                    <p><span className="font-medium text-gray-900">Adresă:</span> {desktopSelectedClient.adresa || '-'}</p>
                    <p><span className="font-medium text-gray-900">Vânzări:</span> {metricsByClient[desktopSelectedClient.id]?.vanzariCount ?? 0}</p>
                    <p><span className="font-medium text-gray-900">Comenzi:</span> {metricsByClient[desktopSelectedClient.id]?.comenziCount ?? 0}</p>
                    <p><span className="font-medium text-gray-900">Sold neîncasat:</span> {(metricsByClient[desktopSelectedClient.id]?.unpaidRon ?? 0).toFixed(0)} RON</p>
                    <div className="flex flex-wrap gap-2 pt-2">
                      <button
                        type="button"
                        className="rounded-md bg-gray-900 px-3 py-2 text-xs font-semibold text-white hover:bg-gray-800"
                        onClick={() => {
                          setSelectedClient(desktopSelectedClient)
                          setDrawerOpen(true)
                        }}
                      >
                        Vezi detalii
                      </button>
                      <button
                        type="button"
                        className="rounded-md border border-gray-300 px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-100"
                        onClick={() => {
                          setEditingClient(desktopSelectedClient)
                          setEditOpen(true)
                        }}
                      >
                        Editează
                      </button>
                      <button
                        type="button"
                        className="rounded-md border border-red-200 px-3 py-2 text-xs font-semibold text-red-700 hover:bg-red-50"
                        onClick={() => setDeletingClient(desktopSelectedClient)}
                      >
                        Șterge
                      </button>
                    </div>
                  </div>
                ) : (
                  <p className="mt-4 text-sm text-gray-600">Selectează un client pentru detalii.</p>
                )}
              </aside>
            </div>
          </>
        ) : null}
      </div>

      <AddClientDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onSubmit={async (data) => {
          await createMutation.mutateAsync({
            nume_client: data.nume_client,
            telefon: data.telefon || null,
            email: data.email || null,
            adresa: data.adresa || null,
            pret_negociat_lei_kg: data.pret_negociat_lei_kg ? Number(data.pret_negociat_lei_kg) : null,
            observatii: data.observatii || null,
          })
        }}
      />

      <EditClientDialog
        client={editingClient}
        open={editOpen}
        onOpenChange={(open) => {
          setEditOpen(open)
          if (!open) setEditingClient(null)
        }}
        onSubmit={async (id, data) => {
          await updateMutation.mutateAsync({
            id,
            payload: {
              nume_client: data.nume_client,
              telefon: data.telefon || null,
              email: data.email || null,
              adresa: data.adresa || null,
              pret_negociat_lei_kg: data.pret_negociat_lei_kg ? Number(data.pret_negociat_lei_kg) : null,
              observatii: data.observatii || null,
            },
          })
        }}
      />

      <ClientDetailsDrawer
        open={drawerOpen}
        onOpenChange={(open) => {
          setDrawerOpen(open)
          if (!open) setSelectedClient(null)
        }}
        client={selectedClient}
        comenzi={selectedClientComenzi}
        isLoadingComenzi={isLoadingComenzi}
        onEdit={(client) => {
          setSelectedClient(client)
          setDrawerOpen(false)
          setEditingClient(client)
          setEditOpen(true)
        }}
        onDelete={(client) => {
          setDrawerOpen(false)
          setDeletingClient(client)
        }}
      />

      <ConfirmDeleteDialog
        open={Boolean(deletingClient)}
        onOpenChange={(open) => {
          if (!open) setDeletingClient(null)
        }}
        itemType="Client"
        itemName={deletingClient?.nume_client}
        description={`Ștergi clientul ${deletingClient?.nume_client || 'selectat'}?`}
        loading={deleteMutation.isPending}
        onConfirm={() => {
          if (!deletingClient) return
          scheduleDelete(deletingClient)
          setDeletingClient(null)
        }}
      />

      <AppDialog
        open={importHelpOpen}
        onOpenChange={setImportHelpOpen}
        title="Format fișier import clienți"
        footer={
          <Button
            type="button"
            variant="outline"
            className="gap-2"
            onClick={() => { void downloadImportTemplate() }}
          >
            ⬇️ Descarcă model .xlsx
          </Button>
        }
      >
        <div className="space-y-4 text-sm text-[var(--agri-text-muted)]">
          <p>
            Poți importa clienți dintr-un fișier <strong className="text-[var(--agri-text)]">Excel (.xlsx)</strong> sau{' '}
            <strong className="text-[var(--agri-text)]">CSV</strong>.
          </p>
          <p>
            Fișierul trebuie să aibă un <strong className="text-[var(--agri-text)]">rând de antet</strong> (header)
            pe prima linie cu numele coloanelor.
          </p>

          <div className="space-y-2">
            <p className="font-medium text-[var(--agri-text)]">Coloane recunoscute:</p>
            <ul className="space-y-1.5 pl-1">
              {[
                { field: 'Nume client (obligatoriu)', aliases: 'Display Name, Name, Nume, Nume client' },
                { field: 'Telefon', aliases: 'Phone, Phone 1 - Value, Telefon, Tel, Mobil, Nr telefon' },
                { field: 'Email', aliases: 'Email, E-mail' },
                { field: 'Adresă', aliases: 'Adresa, Address, Localitate, City, Delivery Location' },
                { field: 'Observații', aliases: 'Observatii, Notes, Note' },
              ].map(({ field, aliases }) => (
                <li key={field} className="flex flex-col gap-0.5">
                  <span className="font-medium text-[var(--agri-text)]">{field}</span>
                  <span className="text-xs text-[var(--agri-text-muted)]">acceptă: {aliases}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="space-y-2">
            <p className="font-medium text-[var(--agri-text)]">Exemplu:</p>
            <div className="overflow-x-auto rounded-lg border border-[var(--agri-border)]">
              <table className="min-w-full text-xs">
                <thead className="bg-[var(--agri-surface-muted)]">
                  <tr>
                    {['Nume client', 'Telefon', 'Email', 'Adresă'].map((h) => (
                      <th key={h} className="px-3 py-2 text-left font-semibold text-[var(--agri-text)]">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--agri-border)]">
                  <tr>
                    <td className="px-3 py-2">Ion Popescu</td>
                    <td className="px-3 py-2">0745123456</td>
                    <td className="px-3 py-2">ion@email.com</td>
                    <td className="px-3 py-2">Suceava</td>
                  </tr>
                  <tr>
                    <td className="px-3 py-2">Maria Ionescu</td>
                    <td className="px-3 py-2">0722334455</td>
                    <td className="px-3 py-2 text-[var(--agri-text-muted)]">—</td>
                    <td className="px-3 py-2">Fălticeni</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <p className="rounded-lg bg-[var(--agri-surface-muted)] px-3 py-2 text-xs">
            Fișierele exportate din <strong className="text-[var(--agri-text)]">Google Contacts</strong> sau din{' '}
            <strong className="text-[var(--agri-text)]">agenda telefonului</strong> sunt recunoscute automat.
          </p>
        </div>
      </AppDialog>

      <AppDialog
        open={Boolean(importResult)}
        onOpenChange={(open) => {
          if (!open) { setImportResult(null); setShowFailedRows(false) }
        }}
        title="Import finalizat!"
        footer={
          <Button type="button" onClick={() => { setImportResult(null); setShowFailedRows(false) }}>
            OK
          </Button>
        }
      >
        {importResult && (
          <div className="space-y-3 text-sm">
            <div className="space-y-2">
              <p className="flex items-center gap-2 text-emerald-700">
                <span className="text-base">✅</span>
                <span><strong>{importResult.imported}</strong> clienți importați</span>
              </p>
              {importResult.skippedNoName > 0 && (
                <p className="flex items-center gap-2 text-gray-500">
                  <span className="text-base">⏭️</span>
                  <span><strong>{importResult.skippedNoName}</strong> fără nume — săriți</span>
                </p>
              )}
              {importResult.skippedDuplicate > 0 && (
                <p className="flex items-center gap-2 text-gray-500">
                  <span className="text-base">⏭️</span>
                  <span><strong>{importResult.skippedDuplicate}</strong> {importResult.skippedDuplicate === 1 ? 'duplicat' : 'duplicate'} — sărite</span>
                </p>
              )}
              {importResult.failed > 0 && (
                <p className="flex items-center gap-2 text-red-600">
                  <span className="text-base">❌</span>
                  <span><strong>{importResult.failed}</strong> erori</span>
                </p>
              )}
            </div>
            {importResult.failed > 0 && (
              <div className="space-y-2">
                <button
                  type="button"
                  className="text-xs text-[var(--agri-primary)] underline-offset-2 hover:underline"
                  onClick={() => setShowFailedRows((v) => !v)}
                >
                  {showFailedRows ? 'Ascunde detalii' : 'Vezi detalii erori'}
                </button>
                {showFailedRows && (
                  <div className="max-h-40 space-y-1 overflow-y-auto rounded-lg bg-red-50 p-3 text-xs text-red-700">
                    {importResult.failedRows.map((r, i) => (
                      <p key={i}><strong>{r.name}</strong>: {r.error}</p>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </AppDialog>

      <ConfirmDeleteDialog
        open={bulkDeleteOpen}
        onOpenChange={(open) => {
          if (!isDeletingAll) setBulkDeleteOpen(open)
        }}
        title="Ștergi toți clienții?"
        description={`Ești sigur că vrei să ștergi toți cei ${clienti.length} clienți? Acțiunea nu poate fi anulată.`}
        confirmText="Șterge toți"
        loading={isDeletingAll}
        onConfirm={handleBulkDelete}
      />
    </AppShell>
  )
}
