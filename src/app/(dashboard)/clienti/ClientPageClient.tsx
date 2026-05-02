'use client'

import { useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react'
import type { ColumnDef } from '@tanstack/react-table'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Pencil, Trash2, Users } from 'lucide-react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'

import { AppDialog } from '@/components/app/AppDialog'
import { DashboardContentShell } from '@/components/app/DashboardContentShell'
import { AppShell } from '@/components/app/AppShell'
import {
  ModuleEmptyCard,
  ModulePillFilterButton,
  ModulePillRow,
  ModuleScoreboard,
} from '@/components/app/module-list-chrome'
import { ConfirmDeleteDialog } from '@/components/app/ConfirmDeleteDialog'
import { ErrorState } from '@/components/app/ErrorState'
import { EntityListSkeleton } from '@/components/app/ListSkeleton'
import { PageHeader } from '@/components/app/PageHeader'
import { useMobileScrollRestore } from '@/components/app/useMobileScrollRestore'
import { AddClientDialog } from '@/components/clienti/AddClientDialog'
import { EditClientDialog } from '@/components/clienti/EditClientDialog'
import { MobileEntityCard } from '@/components/ui/MobileEntityCard'
import { ResponsiveDataView } from '@/components/ui/ResponsiveDataView'
import { SearchField } from '@/components/ui/SearchField'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useAddAction } from '@/contexts/AddActionContext'
import { queryKeys } from '@/lib/query-keys'
import { getSupabase } from '@/lib/supabase/client'
import {
  createClienți as createClienti,
  deleteClienți as deleteClienti,
  getClienți as getClienti,
  updateClienți as updateClienti,
  type Client,
  type ClientDuplicateWarning,
} from '@/lib/supabase/queries/clienti'
import { getComenzi } from '@/lib/supabase/queries/comenzi'
import { getVanzari } from '@/lib/supabase/queries/vanzari'
import { getTenantId } from '@/lib/tenant/get-tenant'
import { toast } from '@/lib/ui/toast'
type CreateClientMutationVariables = {
  input: Parameters<typeof createClienti>[0]
  onDuplicateWarning?: (existing: ClientDuplicateWarning) => void
}

interface ClientPageClientProps {
  initialClienți: Client[]
}

export function hasAiClientOpenForm(searchParams: Pick<URLSearchParams, 'get'>): boolean {
  return searchParams.get('openForm') === '1'
}

export function parseAiClientPrefill(searchParams: Pick<URLSearchParams, 'get'>): {
  nume_client: string
  telefon: string
  email: string
  adresa: string
  observatii: string
} | null {
  if (!hasAiClientOpenForm(searchParams)) return null
  return {
    nume_client: searchParams.get('nume_client')?.trim() ?? '',
    telefon: searchParams.get('telefon')?.trim() ?? '',
    email: searchParams.get('email')?.trim() ?? '',
    adresa: searchParams.get('adresa')?.trim() ?? '',
    observatii: searchParams.get('observatii')?.trim() ?? '',
  }
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
  rows: ParsedClientRow[]
  totalParsed: number
  skippedNoName: number
  formulaFixCount: number
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

  const nameIndex = pick(
    'display_name', 'displayname', 'full_name', 'fullname',
    'nume_complet', 'nume_client', 'client', 'contact', 'persoana',
    'name', 'denumire', 'nume'
  )
  const firstNameIndex = pick('first_name', 'given_name', 'prenume', 'firstname')
  const lastNameIndex  = pick('last_name', 'family_name', 'surname', 'lastname', 'nume_familie')

  const phoneIndex = pick(
    'phone_1_value', 'phone', 'phone_number', 'phonenumber', 'mobile', 'nr_telefon',
    'nr_tel', 'numar_telefon', 'numar_tel', 'telefon', 'tel', 'mobil'
  )
  const phone2Index = pick('phone_2_value', 'phone2', 'mobile2', 'telefon_alt', 'alt_telefon')

  const emailIndex = pick('email', 'e_mail', 'email_address', 'mail', 'adresa_email', 'email_1_value')
  const addressIndex = pick(
    'delivery_location', 'location', 'city', 'oras', 'localitate',
    'adresa', 'address', 'locatie', 'locatie_livrare', 'loc', 'sat', 'comuna'
  )
  const notesIndex = pick('notes', 'observatii', 'observatii_client', 'note', 'obs', 'detalii', 'comments')

  const hasNameColumn = nameIndex >= 0 || firstNameIndex >= 0 || lastNameIndex >= 0
  const hasPhoneColumn = phoneIndex >= 0 || phone2Index >= 0

  const mappedIndices = new Set(
    [nameIndex, firstNameIndex, lastNameIndex, phoneIndex, phone2Index, emailIndex, addressIndex, notesIndex]
      .filter((i) => i >= 0)
  )

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
  'display_name', 'displayname', 'full_name', 'fullname', 'first_name', 'last_name',
  'given_name', 'family_name', 'surname', 'firstname', 'lastname', 'nume_familie',
  'nume_complet', 'nume_client', 'client', 'contact', 'persoana', 'name', 'denumire', 'prenume', 'nume',
  'telefon', 'phone', 'phone_1_value', 'phone_2_value', 'phone_number', 'phonenumber',
  'tel', 'mobil', 'mobile', 'mobile2', 'nr_telefon', 'numar_telefon',
  'email', 'e_mail', 'email_1_value', 'email_address', 'mail', 'adresa_email',
  'adresa', 'address', 'delivery_location', 'location', 'localitate', 'oras', 'city', 'loc', 'sat', 'comuna',
  'notes', 'note', 'observatii', 'obs', 'detalii', 'comments',
])

function parseClientCsv(content: string): ImportPreview {
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

function ClientCardNew({
  client,
  metrics,
  onEdit,
}: {
  client: Client
  metrics: {
    totalRon: number
    vanzariCount: number
    unpaidRon: number
    comenziCount: number
  }
  onEdit: () => void
}) {
  const mainValue = metrics.totalRon > 0 ? `${metrics.totalRon.toFixed(0)} RON` : `${metrics.comenziCount} comenzi`
  const subtitle = client.telefon || client.email || 'Fără contact'
  const secondaryValue = [
    metrics.comenziCount > 0 ? `${metrics.comenziCount} comenzi` : null,
    metrics.vanzariCount > 0 ? `${metrics.vanzariCount} vânzări` : null,
  ].filter(Boolean).join(' • ') || undefined
  const statusLabel =
    metrics.unpaidRon > 0
      ? `Neîncasat ${metrics.unpaidRon.toFixed(0)} RON`
      : metrics.comenziCount > 0 || metrics.vanzariCount > 0
        ? 'Activ'
        : 'Fără activitate'
  const statusTone =
    metrics.unpaidRon > 0
      ? 'warning'
      : metrics.comenziCount > 0 || metrics.vanzariCount > 0
        ? 'success'
        : 'neutral'

  return (
    <MobileEntityCard
      title={client.nume_client}
      mainValue={mainValue}
      subtitle={subtitle}
      secondaryValue={secondaryValue}
      statusLabel={statusLabel}
      statusTone={statusTone}
      showChevron
      onClick={onEdit}
    />
  )
}

// ─── Page component ───────────────────────────────────────────────────────────

export function ClientPageClient({ initialClienți }: ClientPageClientProps) {
  const queryClient = useQueryClient()
  const { registerAddAction } = useAddAction()
  const pathname = usePathname()
  const router = useRouter()
  const searchParams = useSearchParams()

  const [searchTerm, setSearchTerm] = useState('')
  const [showOnlyUnpaid, setShowOnlyUnpaid] = useState(false)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [editingClient, setEditingClient] = useState<Client | null>(null)
  const [deletingClient, setDeletingClient] = useState<Client | null>(null)
  const [importingCsv, setImportingCsv] = useState(false)
  const [importPreview, setImportPreview] = useState<ImportPreview | null>(null)
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false)
  const [isDeletingAll, setIsDeletingAll] = useState(false)
  const [importHelpOpen, setImportHelpOpen] = useState(false)
  const [importProgress, setImportProgress] = useState<{ done: number; total: number; phase: 'ids' | 'insert' } | null>(null)
  const [importResult, setImportResult] = useState<ImportResult | null>(null)
  const [showFailedRows, setShowFailedRows] = useState(false)
  const [bulkDeleteProgress, setBulkDeleteProgress] = useState<{ done: number; total: number } | null>(null)
  const [addClientInitialValues, setAddClientInitialValues] = useState<{
    nume_client: string
    telefon: string
    email: string
    adresa: string
    observatii: string
  } | null>(null)
  const addFromQuery = searchParams.get('add') === '1'
  const openFormFromQuery = hasAiClientOpenForm(searchParams)

  const pendingDeleteTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({})
  const pendingDeletedItems = useRef<Record<string, Client>>({})
  const deleteMutateRef = useRef<(id: string) => void>(() => {})
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

  const { data: comenzi = [] } = useQuery({
    queryKey: queryKeys.comenzi,
    queryFn: getComenzi,
  })

  const { data: vanzari = [] } = useQuery({
    queryKey: queryKeys.vanzari,
    queryFn: getVanzari,
  })

  const createMutation = useMutation({
    mutationFn: ({
      input,
      onDuplicateWarning,
    }: CreateClientMutationVariables) => createClienti(input, { onDuplicateWarning }),
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
    deleteMutateRef.current = (id) => deleteMutation.mutate(id)
  }, [deleteMutation])
  useEffect(() => {
    const pendingTimersRef = pendingDeleteTimers
    const pendingItemsRef = pendingDeletedItems
    return () => {
      Object.keys(pendingTimersRef.current).forEach((id) => {
        clearTimeout(pendingTimersRef.current[id])
        if (pendingItemsRef.current[id]) {
          delete pendingItemsRef.current[id]
          deleteMutateRef.current(id)
        }
      })
      pendingTimersRef.current = {}
    }
  }, [])

  useEffect(() => {
    const unregister = registerAddAction(() => {
      setAddClientInitialValues(null)
      setDialogOpen(true)
    }, 'Adaugă client')
    return unregister
  }, [registerAddAction])

  useEffect(() => {
    if (!addFromQuery) return
    setAddClientInitialValues(null)
    setDialogOpen(true)
    const nextParams = new URLSearchParams(searchParams.toString())
    nextParams.delete('add')
    const query = nextParams.toString()
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false })
  }, [addFromQuery, pathname, router, searchParams])

  useEffect(() => {
    if (!openFormFromQuery) return
    setAddClientInitialValues(parseAiClientPrefill(searchParams))
    setDialogOpen(true)
    const nextParams = new URLSearchParams(searchParams.toString())
    nextParams.delete('openForm')
    nextParams.delete('nume_client')
    nextParams.delete('telefon')
    nextParams.delete('email')
    nextParams.delete('adresa')
    nextParams.delete('observatii')
    const query = nextParams.toString()
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false })
  }, [openFormFromQuery, pathname, router, searchParams])

  const handleFileSelect = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file || importingCsv) return

    const MAX_FILE_SIZE = 10 * 1024 * 1024
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

      const { data: existingData } = await supabase
        .from('clienti')
        .select('nume_client,telefon,id_client')
        .eq('tenant_id', tenantId)
      const existingSet = new Set(
        (existingData ?? []).map(
          (c) => `${normalizeText(c.nume_client)}|${normalizeText(c.telefon ?? '')}`
        )
      )

      let idCounter = 0
      for (const row of existingData ?? []) {
        const match = row.id_client?.match(/(\d+)$/)
        if (match) {
          const num = parseInt(match[1], 10)
          if (num > idCounter) idCounter = num
        }
      }
      idCounter++

      const makeClientId = (): string => {
        const n = idCounter++
        return `C${String(n).padStart(3, '0')}`
      }

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

      const CHUNK_SIZE = 50
      for (let i = 0; i < records.length; i += CHUNK_SIZE) {
        const chunk = records.slice(i, i + CHUNK_SIZE)
        const { error } = await supabase.from('clienti').insert(chunk.map((r) => r.supabaseRow))

        if (error) {
          const pgError = error as unknown as Record<string, unknown>
          
          for (const record of chunk) {
            const { error: rowErr } = await supabase.from('clienti').insert([record.supabaseRow])
            if (rowErr) {
              const rowPg = rowErr as unknown as Record<string, unknown>
              
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

      const { error } = await supabase
        .from('clienti')
        .delete()
        .eq('tenant_id', tenantId)
        .in('id', ids)

      if (error) {
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

  // ── Computed data ──────────────────────────────────────────────────────────

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
        totalRon: 0, totalKg: 0, vanzariCount: 0, unpaidRon: 0,
        hasRecentSales: false, lastVanzare: null, comenziCount: 0, lastComanda: null,
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
        entry.lastVanzare = { data: vanzare.data, kg: Number(vanzare.cantitate_kg || 0), totalRon }
      }
    }

    for (const comanda of comenzi) {
      if (!comanda.client_id || !map[comanda.client_id]) continue
      const entry = map[comanda.client_id]
      entry.comenziCount += 1
      const date = comanda.data_livrare || comanda.data_comanda
      if (!entry.lastComanda || date > entry.lastComanda.data) {
        entry.lastComanda = { data: date, kg: Number(comanda.cantitate_kg || 0), status: comanda.status }
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

  const desktopColumns = useMemo<ColumnDef<Client>[]>(() => [
    {
      accessorKey: 'nume_client',
      header: 'Nume',
      cell: ({ row }) => <span className="font-medium">{row.original.nume_client}</span>,
    },
    {
      accessorKey: 'telefon',
      header: 'Telefon',
      cell: ({ row }) => row.original.telefon || '-',
    },
    {
      accessorKey: 'email',
      header: 'Email',
      cell: ({ row }) => row.original.email || '-',
    },
    {
      id: 'comenziCount',
      header: 'Nr. comenzi',
      accessorFn: (row) => metricsByClient[row.id]?.comenziCount ?? 0,
      cell: ({ row }) => metricsByClient[row.original.id]?.comenziCount ?? 0,
      meta: {
        searchValue: (row: Client) => metricsByClient[row.id]?.comenziCount ?? 0,
        numeric: true,
      },
    },
    {
      id: 'actions',
      header: 'Acțiuni',
      enableSorting: false,
      cell: ({ row }) => (
        <div className="flex items-center justify-end gap-1">
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            aria-label="Editează clientul"
            onClick={(event) => {
              event.stopPropagation()
              setEditingClient(row.original)
              setEditOpen(true)
            }}
          >
            <Pencil className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            aria-label="Șterge clientul"
            onClick={(event) => {
              event.stopPropagation()
              setDeletingClient(row.original)
            }}
          >
            <Trash2 className="h-4 w-4 text-[var(--soft-danger-text)]" />
          </Button>
        </div>
      ),
      meta: {
        searchable: false,
        sticky: 'right',
        headerClassName: 'w-[104px] text-right',
        cellClassName: 'w-[104px] text-right',
      },
    },
  ], [metricsByClient])

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <AppShell
      header={
        <PageHeader
          title="Clienți"
          subtitle="Administrare clienți"
          contentVariant="centered"
          rightSlot={<Users className="h-5 w-5 shrink-0 text-[var(--agri-text-muted)]" aria-hidden />}
        />
      }
    >
      <DashboardContentShell variant="centered" className="mt-2 space-y-3 py-3 sm:mt-0 sm:py-3">
        <input ref={csvInputRef} type="file" accept=".csv,.xlsx,.xls,text/csv" className="hidden" onChange={handleFileSelect} />

        <ModuleScoreboard tone="tinted" className="gap-x-3.5 gap-y-1">
          <span className="text-[15px] font-bold text-[var(--pill-active-text)]">{clienti.length} clienți</span>
          {totalOpenOrders > 0 ? (
            <>
              <span className="text-[color-mix(in_srgb,var(--pill-active-text)_25%,transparent)]">·</span>
              <span className="text-[13px] text-[color-mix(in_srgb,var(--pill-active-text)_72%,transparent)]">
                {totalOpenOrders} comenzi deschise
              </span>
            </>
          ) : null}
          {totalUnpaidRon > 0 ? (
            <>
              <span className="text-[color-mix(in_srgb,var(--pill-active-text)_25%,transparent)]">·</span>
              <span className="text-[13px] font-semibold text-[var(--status-danger-text)]">
                {totalUnpaidRon.toFixed(0)} RON neîncasat
              </span>
            </>
          ) : null}
        </ModuleScoreboard>

        <div className="flex flex-col gap-2">
          <SearchField
            containerClassName="md:hidden"
            placeholder="Caută după nume, telefon sau email"
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            aria-label="Caută clienți"
          />
          <ModulePillRow className="gap-2">
            <ModulePillFilterButton active={!showOnlyUnpaid} onClick={() => setShowOnlyUnpaid(false)}>
              Toți
            </ModulePillFilterButton>
            <ModulePillFilterButton
              active={showOnlyUnpaid}
              activeTone="danger"
              onClick={() => setShowOnlyUnpaid(true)}
            >
              💸 Neîncasat
            </ModulePillFilterButton>
          </ModulePillRow>
        </div>

        {/* Import buttons */}
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
          Acceptă fișiere CSV sau Excel (.xlsx).{' '}
          <button
            type="button"
            className="inline text-[var(--agri-primary)] underline-offset-2 hover:underline"
            onClick={() => setImportHelpOpen(true)}
          >
            ℹ️ Cum trebuie să arate fișierul?
          </button>
        </p>

        {/* Import preview */}
        {importPreview && (
          <div className="space-y-3 rounded-xl border border-[var(--soft-success-border)] bg-[var(--soft-success-bg)] p-4">
            <div className="space-y-1">
              <p className="text-sm font-semibold text-[var(--soft-success-text)]">
                {importPreview.totalParsed} contacte găsite
                {importPreview.skippedNoName > 0
                  ? `, ${importPreview.rows.length} cu nume valid, ${importPreview.skippedNoName} fără nume (vor fi sărite)`
                  : `, ${importPreview.rows.length} cu nume valid`}
              </p>
              {!importPreview.hasPhoneColumn && (
                <p className="text-xs font-medium text-[var(--soft-warning-text)]">⚠️ Nu s-a detectat coloana de telefon</p>
              )}
              {importPreview.formulaFixCount > 0 && (
                <p className="text-xs font-medium text-[var(--soft-info-text)]">
                  ℹ️ {importPreview.formulaFixCount} {importPreview.formulaFixCount === 1 ? 'contact are' : 'contacte au'} nume din formulă Excel — s-a folosit coloana &ldquo;First Name&rdquo;
                </p>
              )}
            </div>
            {importPreview.mappingSummary.length > 0 && (
              <div className="space-y-0.5">
                <p className="text-xs font-medium uppercase tracking-wide text-[var(--soft-success-text)]">Coloane detectate</p>
                {importPreview.mappingSummary.map((line) => (
                  <p key={line} className="text-xs text-[var(--soft-success-text)]">{line}</p>
                ))}
              </div>
            )}
            {importPreview.unmappedColumns.length > 0 && (
              <div className="space-y-0.5">
                <p className="text-xs font-medium uppercase tracking-wide text-gray-400 dark:text-zinc-400">Coloane nerecunoscute (ignorate)</p>
                <p className="text-xs text-gray-400 dark:text-zinc-400">{importPreview.unmappedColumns.join(', ')}</p>
              </div>
            )}
            <div className="space-y-1.5">
              <p className="text-xs font-medium uppercase tracking-wide text-[var(--soft-success-text)]">Primele rânduri</p>
              {importPreview.rows.slice(0, 5).map((row, i) => (
                <div key={i} className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-[var(--agri-text)]">
                  <span className="font-semibold">{row.nume_client}</span>
                  {row.telefon ? <span className="text-[var(--agri-text-muted)]">{row.telefon}</span> : null}
                  {row.email ? <span className="text-[var(--agri-text-muted)]">{row.email}</span> : null}
                  {row.adresa ? <span className="text-[var(--agri-text-muted)]">{row.adresa}</span> : null}
                </div>
              ))}
              {importPreview.rows.length > 5 ? (
                <p className="text-xs text-[var(--agri-text-muted)]">...și încă {importPreview.rows.length - 5} contacte</p>
              ) : null}
            </div>
            <div className="flex gap-2">
              <Button
                type="button"
                size="sm"
                className="bg-emerald-600 text-white hover:bg-emerald-700 dark:bg-green-700 dark:text-white dark:hover:bg-green-600"
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
              <Button type="button" size="sm" variant="outline" onClick={() => setImportPreview(null)} disabled={importingCsv}>
                Anulează
              </Button>
            </div>
          </div>
        )}

        {/* Error */}
        {isError ? (
          <ErrorState
            title="Eroare la încărcare"
            message={(error as Error).message}
            onRetry={() => queryClient.invalidateQueries({ queryKey: queryKeys.clienti })}
          />
        ) : null}

        {/* Loading skeleton */}
        {isLoading ? <EntityListSkeleton /> : null}

        {!isLoading && !isError && filteredClienti.length === 0 ? (
          <ModuleEmptyCard emoji="🤝" title="Niciun client adăugat" hint="Adaugă primul client pentru a începe" />
        ) : null}

        {/* Cards */}
        {!isLoading && !isError && filteredClienti.length > 0 ? (
          <ResponsiveDataView
            columns={desktopColumns}
            data={filteredClienti}
            getRowId={(row) => row.id}
            searchPlaceholder="Caută în clienți..."
            emptyMessage="Nu am găsit clienți pentru filtrele curente."
            renderCard={(client) => {
              const metrics = metricsByClient[client.id]
              return (
                <ClientCardNew
                  client={client}
                  metrics={{
                    totalRon: metrics?.totalRon ?? 0,
                    vanzariCount: metrics?.vanzariCount ?? 0,
                    unpaidRon: metrics?.unpaidRon ?? 0,
                    comenziCount: metrics?.comenziCount ?? 0,
                  }}
                  onEdit={() => {
                    setEditingClient(client)
                    setEditOpen(true)
                  }}
                />
              )
            }}
          />
        ) : null}
      </DashboardContentShell>

      {/* Dialogs */}
      <AddClientDialog
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open)
          if (!open) setAddClientInitialValues(null)
        }}
        initialValues={addClientInitialValues ?? undefined}
        onSubmit={async (data) => {
          await createMutation.mutateAsync({
            input: {
              nume_client: data.nume_client,
              telefon: data.telefon || null,
              email: data.email || null,
              adresa: data.adresa || null,
              pret_negociat_lei_kg: data.pret_negociat_lei_kg ? Number(data.pret_negociat_lei_kg) : null,
              observatii: data.observatii || null,
            },
            onDuplicateWarning: (existing) => {
              toast.warning(`Un client cu un nume similar există deja: ${existing.nume_client}. Continui.`)
            },
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
            <div className="overflow-hidden rounded-xl border border-[var(--agri-border)] bg-[var(--agri-surface)]">
              <Table className="text-xs">
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    {['Nume client', 'Telefon', 'Email', 'Adresă'].map((h) => (
                      <TableHead key={h}>{h}</TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow>
                    <TableCell className="text-xs text-[var(--agri-text)]">Ion Popescu</TableCell>
                    <TableCell className="text-xs text-[var(--agri-text)]">0745123456</TableCell>
                    <TableCell className="text-xs text-[var(--agri-text)]">ion@email.com</TableCell>
                    <TableCell className="text-xs text-[var(--agri-text)]">Suceava</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="text-xs text-[var(--agri-text)]">Maria Ionescu</TableCell>
                    <TableCell className="text-xs text-[var(--agri-text)]">0722334455</TableCell>
                    <TableCell className="text-xs text-[var(--agri-text-muted)]">—</TableCell>
                    <TableCell className="text-xs text-[var(--agri-text)]">Fălticeni</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
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
                <p className="flex items-center gap-2 text-gray-500 dark:text-zinc-400">
                  <span className="text-base">⏭️</span>
                  <span><strong>{importResult.skippedNoName}</strong> fără nume — săriți</span>
                </p>
              )}
              {importResult.skippedDuplicate > 0 && (
                <p className="flex items-center gap-2 text-gray-500 dark:text-zinc-400">
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


