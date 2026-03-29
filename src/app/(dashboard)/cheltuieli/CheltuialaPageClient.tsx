'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import type { ColumnDef } from '@tanstack/react-table'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { Pencil, Trash2 } from 'lucide-react'
import { toast } from '@/lib/ui/toast'

import { AppShell } from '@/components/app/AppShell'
import { ConfirmDeleteDialog } from '@/components/app/ConfirmDeleteDialog'
import { ErrorState } from '@/components/app/ErrorState'
import { TableCardsSkeleton } from '@/components/app/ModuleSkeletons'
import { PageHeader } from '@/components/app/PageHeader'
import { useMobileScrollRestore } from '@/components/app/useMobileScrollRestore'
import { AddCheltuialaDialog } from '@/components/cheltuieli/AddCheltuialaDialog'
import { getCheltuialaCategoryEmoji } from '@/components/cheltuieli/CheltuialaCard'
import { EditCheltuialaDialog } from '@/components/cheltuieli/EditCheltuialaDialog'
import { Button } from '@/components/ui/button'
import { ResponsiveDataView } from '@/components/ui/ResponsiveDataView'
import { SearchField } from '@/components/ui/SearchField'
import { track } from '@/lib/analytics/track'
import { trackEvent } from '@/lib/analytics/trackEvent'
import { useTrackModuleView } from '@/lib/analytics/useTrackModuleView'
import { useAddAction } from '@/contexts/AddActionContext'
import { captureReactError } from '@/lib/monitoring/sentry'
import { createCheltuiala, deleteCheltuiala, getCheltuieli, updateCheltuiala, type Cheltuiala } from '@/lib/supabase/queries/cheltuieli'
import { isAutoManoperaCheltuiala } from '@/lib/supabase/queries/manopera-auto'
import { buildCheltuialaDeleteLabel } from '@/lib/ui/delete-labels'
import { hapticError, hapticSuccess } from '@/lib/utils/haptic'
import { queryKeys } from '@/lib/query-keys'

interface CheltuialaFormData {
  client_sync_id?: string
  data: string
  categorie: string
  suma_lei: number | string
  furnizor?: string
  descriere?: string
}

interface CheltuialaPageClientProps {
  initialCheltuieli: Cheltuiala[]
}

type TemporalFilter = 'luna' | 'sapt' | 'toate'

function toIsoDate(value: Date): string {
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`
}

function toDateOnly(value: string | null | undefined): string {
  return (value ?? '').slice(0, 10)
}

function getStartOfWeek(value: Date): Date {
  const date = new Date(value)
  date.setHours(0, 0, 0, 0)
  const weekday = date.getDay()
  const shift = weekday === 0 ? 6 : weekday - 1
  date.setDate(date.getDate() - shift)
  return date
}

function getStartOfMonth(value: Date): Date {
  const date = new Date(value)
  date.setHours(0, 0, 0, 0)
  date.setDate(1)
  return date
}

function normalizeText(value: string | null | undefined): string {
  return (value ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
}

function isSchemaCacheError(error: unknown): boolean {
  const message = String((error as { message?: string })?.message ?? '').toLowerCase()
  return message.includes('schema cache') || message.includes('could not find the')
}

function handleCheltuialaError(error: unknown, fallbackMessage: string) {
  const message = String((error as { message?: string })?.message ?? fallbackMessage)
  const schemaIssue = isSchemaCacheError(error)

  captureReactError(error, {
    component: 'CheltuialaPageClient',
    tags: { module: 'cheltuieli', table: 'cheltuieli_diverse' },
    extra: { originalMessage: message, schemaIssue },
  })

  if (schemaIssue) {
    hapticError()
    toast.error('Schema DB nu e sincronizat. Reîncarcă aplicația sau rulează reload schema în Supabase.')
    return
  }

  hapticError()
  toast.error(message || fallbackMessage)
}

function formatData(value: string): string {
  return new Date(value).toLocaleDateString('ro-RO', { day: '2-digit', month: 'short' })
}

function formatRon(value: number): string {
  return new Intl.NumberFormat('ro-RO', { maximumFractionDigits: 0 }).format(value)
}

interface CheltuialaCardNewProps {
  cheltuiala: Cheltuiala
  isExpanded: boolean
  onToggle: () => void
  onEdit: () => void
  onDelete: () => void
}

function CheltuialaCardNew({ cheltuiala, isExpanded, onToggle, onEdit, onDelete }: CheltuialaCardNewProps) {
  const suma = Number(cheltuiala.suma_lei || 0)
  const emoji = getCheltuialaCategoryEmoji(cheltuiala.categorie)
  const isAuto = isAutoManoperaCheltuiala(cheltuiala)

  return (
    <div
      style={{
        background: 'var(--agri-surface)',
        borderRadius: 14,
        border: '1px solid var(--agri-border)',
        borderLeft: '4px solid var(--value-negative)',
        overflow: 'hidden',
        marginBottom: 8,
      }}
    >
      {/* COLLAPSED ROW */}
      <button
        type="button"
        onClick={onToggle}
        style={{
          width: '100%',
          background: 'none',
          border: 'none',
          padding: '11px 14px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          cursor: 'pointer',
          textAlign: 'left',
        }}
      >
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 2 }}>
            <span style={{ fontSize: 14 }}>{emoji}</span>
            <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--agri-text)' }}>
              {cheltuiala.descriere || cheltuiala.categorie || 'Cheltuială'}
            </span>
            {isAuto ? (
              <span style={{
                fontSize: 8, fontWeight: 600, color: 'var(--soft-info-text)',
                background: 'var(--soft-info-bg)', padding: '2px 5px', borderRadius: 8,
              }}>auto</span>
            ) : null}
          </div>
          <div style={{ fontSize: 10, color: 'var(--agri-text-muted)' }}>
            {cheltuiala.categorie || 'Altele'} · {formatData(cheltuiala.data)}
          </div>
        </div>
        <div style={{ textAlign: 'right', flexShrink: 0, marginLeft: 10 }}>
          <span style={{ fontSize: 16, fontWeight: 800, color: 'var(--value-negative)' }}>{formatRon(suma)}</span>
          <span style={{ fontSize: 10, fontWeight: 500, color: 'var(--text-hint)', marginLeft: 2 }}>RON</span>
        </div>
      </button>

      {/* DRAG INDICATOR */}
      <div style={{ display: 'flex', justifyContent: 'center', paddingBottom: isExpanded ? 0 : 4 }}>
        <div style={{ width: 40, height: 2, borderRadius: 999, background: 'var(--surface-divider)' }} />
      </div>

      {/* EXPANDED */}
      {isExpanded ? (
        <div style={{ borderTop: '1px solid var(--agri-border)', padding: '10px 14px 14px' }}>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', fontSize: 11, marginBottom: 8 }}>
            <span><span style={{ color: 'var(--agri-text-muted)' }}>Categorie: </span><strong>{cheltuiala.categorie || 'Altele'}</strong></span>
            <span><span style={{ color: 'var(--agri-text-muted)' }}>Sumă: </span><strong style={{ color: 'var(--value-negative)' }}>{formatRon(suma)} RON</strong></span>
            <span><span style={{ color: 'var(--agri-text-muted)' }}>Data: </span><strong>{new Date(cheltuiala.data).toLocaleDateString('ro-RO')}</strong></span>
            {cheltuiala.furnizor ? (
              <span><span style={{ color: 'var(--agri-text-muted)' }}>Furnizor: </span><strong>{cheltuiala.furnizor}</strong></span>
            ) : null}
            {cheltuiala.descriere ? (
              <span><span style={{ color: 'var(--agri-text-muted)' }}>Observații: </span><strong>{cheltuiala.descriere}</strong></span>
            ) : null}
          </div>

          <div style={{ display: 'flex', justifyContent: 'center', gap: 10, marginTop: 10 }}>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onEdit() }}
              style={{
                border: '1px solid var(--button-muted-border)', background: 'var(--button-muted-bg)', color: 'var(--button-muted-text)',
                borderRadius: 8, padding: '6px 14px', fontSize: 11, fontWeight: 600, cursor: 'pointer',
              }}
            >
              ✏️ Editează
            </button>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onDelete() }}
              style={{
                border: '1px solid var(--status-danger-border)', background: 'var(--status-danger-bg)', color: 'var(--status-danger-text)',
                borderRadius: 8, padding: '6px 14px', fontSize: 11, fontWeight: 600, cursor: 'pointer',
              }}
            >
              🗑️ Șterge
            </button>
          </div>
        </div>
      ) : null}
    </div>
  )
}

export function CheltuialaPageClient({ initialCheltuieli }: CheltuialaPageClientProps) {
  useTrackModuleView('cheltuieli')
  const queryClient = useQueryClient()
  const { registerAddAction } = useAddAction()
  const pathname = usePathname()
  const router = useRouter()
  const searchParams = useSearchParams()
  const pendingDeleteTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({})
  const pendingDeletedItems = useRef<Record<string, { item: Cheltuiala; index: number }>>({})
  const deleteMutateRef = useRef<(id: string) => void>(() => {})

  const [search, setSearch] = useState('')
  const [temporalFilter, setTemporalFilter] = useState<TemporalFilter>('luna')
  const [addOpen, setAddOpen] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [editing, setEditing] = useState<Cheltuiala | null>(null)
  const [deleting, setDeleting] = useState<Cheltuiala | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const addFromQuery = searchParams.get('add') === '1'
  const openFormFromQuery = searchParams.get('openForm') === '1'
  const prefillSuma = searchParams.get('suma') ?? undefined
  const prefillData = searchParams.get('data') ?? undefined
  const prefillDescriereRaw = searchParams.get('descriere') ?? undefined
  const prefillCategorie = searchParams.get('categorie') ?? undefined

  const clearCheltuialaFormQueryParams = () => {
    const nextParams = new URLSearchParams(searchParams.toString())
    nextParams.delete('add')
    nextParams.delete('openForm')
    nextParams.delete('edit')
    nextParams.delete('suma')
    nextParams.delete('data')
    nextParams.delete('descriere')
    nextParams.delete('categorie')
    const query = nextParams.toString()
    const nextUrl = query ? `${pathname}?${query}` : pathname

    if (typeof window !== 'undefined') {
      const currentUrl = `${window.location.pathname}${window.location.search}`
      if (currentUrl !== nextUrl) {
        window.history.replaceState(window.history.state, '', nextUrl)
      }
    }

    router.replace(nextUrl, { scroll: false })
  }

  const {
    data: cheltuieli = initialCheltuieli,
    isLoading,
    isError,
    error,
  } = useQuery({
    queryKey: queryKeys.cheltuieli,
    queryFn: getCheltuieli,
    initialData: initialCheltuieli,
    staleTime: 30000,
    refetchOnWindowFocus: false,
    refetchOnReconnect: true,
  })

  useMobileScrollRestore({
    storageKey: 'scroll:cheltuieli',
    ready: !isLoading,
  })

  const createMutation = useMutation({
    mutationFn: (data: CheltuialaFormData) =>
      createCheltuiala({
        client_sync_id: data.client_sync_id,
        data: data.data,
        categorie: data.categorie,
        suma_lei: Number(data.suma_lei),
        furnizor: data.furnizor || undefined,
        descriere: data.descriere || undefined,
        document_url: undefined,
      }),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.cheltuieli, exact: true })
      track('cheltuiala_add', { suma: Number(variables.suma_lei || 0), categorie: variables.categorie })
      hapticSuccess()
      toast.success('Cheltuială adăugată')
    },
    onError: (err: Error & { status?: number; code?: string }) => {
      const conflict = err?.status === 409 || err?.code === '23505'
      if (conflict) {
        toast.info('Înregistrarea era deja sincronizată.')
        return
      }
      handleCheltuialaError(err, 'Nu am putut salva cheltuiala.')
    },
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: CheltuialaFormData }) =>
      updateCheltuiala(id, {
        data: payload.data,
        categorie: payload.categorie,
        suma_lei: Number(payload.suma_lei),
        furnizor: payload.furnizor || undefined,
        descriere: payload.descriere || undefined,
      }),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.cheltuieli, exact: true })
      track('cheltuiala_edit', { id: variables.id })
      hapticSuccess()
      toast.success('Cheltuială actualizată')
    },
    onError: (err: Error) => {
      handleCheltuialaError(err, 'Nu am putut actualiza cheltuiala.')
    },
  })

  const deleteMutation = useMutation({
    mutationFn: deleteCheltuiala,
    onSuccess: (_, deletedId) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.cheltuieli, exact: true })
      trackEvent('delete_item', 'cheltuieli')
      track('cheltuiala_delete', { id: deletedId })
      hapticSuccess()
      toast.success('Cheltuială ștearsă')
      setDeleting(null)
    },
    onError: (err: Error) => {
      handleCheltuialaError(err, 'Nu am putut șterge cheltuiala.')
    },
  })

  useEffect(() => { deleteMutateRef.current = (id) => deleteMutation.mutate(id) })
  useEffect(() => {
    return () => {
      Object.keys(pendingDeleteTimers.current).forEach((id) => {
        clearTimeout(pendingDeleteTimers.current[id])
        if (pendingDeletedItems.current[id]) {
          delete pendingDeletedItems.current[id]
          deleteMutateRef.current(id)
        }
      })
      pendingDeleteTimers.current = {}
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!addFromQuery) return
    setAddOpen(true)
    clearCheltuialaFormQueryParams()
  }, [addFromQuery, pathname, router, searchParams])

  useEffect(() => {
    if (!openFormFromQuery) return
    clearCheltuialaFormQueryParams()
    setAddOpen(true)
  }, [openFormFromQuery, pathname, router, searchParams])

  useEffect(() => {
    const unregister = registerAddAction(() => setAddOpen(true), 'Adaugă cheltuială')
    return unregister
  }, [registerAddAction])

  useEffect(() => {
    const query = search.trim()
    if (!query) return
    const timer = setTimeout(() => {
      track('search', { module: 'cheltuieli', query })
    }, 500)
    return () => clearTimeout(timer)
  }, [search])

  const scheduleDelete = (cheltuiala: Cheltuiala) => {
    const cheltuialaId = cheltuiala.id
    const currentItems = queryClient.getQueryData<Cheltuiala[]>(queryKeys.cheltuieli) ?? []
    const deleteIndex = currentItems.findIndex((item) => item.id === cheltuialaId)

    pendingDeletedItems.current[cheltuialaId] = { item: cheltuiala, index: deleteIndex }
    queryClient.setQueryData<Cheltuiala[]>(queryKeys.cheltuieli, (current = []) => current.filter((item) => item.id !== cheltuialaId))

    const timer = setTimeout(() => {
      delete pendingDeleteTimers.current[cheltuialaId]
      delete pendingDeletedItems.current[cheltuialaId]
      deleteMutation.mutate(cheltuialaId)
    }, 5000)

    pendingDeleteTimers.current[cheltuialaId] = timer

    toast('Element șters', {
      duration: 5000,
      action: {
        label: 'Undo',
        onClick: () => {
          const pendingTimer = pendingDeleteTimers.current[cheltuialaId]
          if (!pendingTimer) return
          clearTimeout(pendingTimer)
          delete pendingDeleteTimers.current[cheltuialaId]

          const pendingItem = pendingDeletedItems.current[cheltuialaId]
          delete pendingDeletedItems.current[cheltuialaId]
          if (!pendingItem) return

          queryClient.setQueryData<Cheltuiala[]>(queryKeys.cheltuieli, (current = []) => {
            if (current.some((item) => item.id === cheltuialaId)) return current
            const next = [...current]
            const insertAt = pendingItem.index >= 0 ? Math.min(pendingItem.index, next.length) : next.length
            next.splice(insertAt, 0, pendingItem.item)
            return next
          })
        },
      },
    })
  }

  const today = useMemo(() => {
    const d = new Date()
    d.setHours(0, 0, 0, 0)
    return d
  }, [])

  const todayIso = useMemo(() => toIsoDate(today), [today])
  const monthStartIso = useMemo(() => toIsoDate(getStartOfMonth(today)), [today])
  const weekStartIso = useMemo(() => toIsoDate(getStartOfWeek(today)), [today])

  const cheltuieliLuna = useMemo(
    () => cheltuieli.filter((row) => toDateOnly(row.data) >= monthStartIso && toDateOnly(row.data) <= todayIso),
    [cheltuieli, monthStartIso, todayIso]
  )

  const scoreboard = useMemo(() => {
    const totalLuna = cheltuieliLuna.reduce((sum, row) => sum + Number(row.suma_lei || 0), 0)

    const catMap = new Map<string, number>()
    for (const row of cheltuieliLuna) {
      const key = row.categorie || 'Altele'
      catMap.set(key, (catMap.get(key) ?? 0) + Number(row.suma_lei || 0))
    }
    let topCategorie = ''
    let topSum = 0
    catMap.forEach((sum, cat) => {
      if (sum > topSum) { topSum = sum; topCategorie = cat }
    })

    return { totalLuna, topCategorie }
  }, [cheltuieliLuna])

  const searched = useMemo(() => {
    const term = normalizeText(search)
    if (!term) return cheltuieli
    return cheltuieli.filter((row) =>
      normalizeText(row.categorie).includes(term) ||
      normalizeText(row.descriere).includes(term) ||
      normalizeText(row.furnizor).includes(term)
    )
  }, [cheltuieli, search])

  const filtered = useMemo(() => {
    if (temporalFilter === 'toate') return searched

    return searched.filter((row) => {
      const date = toDateOnly(row.data)
      if (temporalFilter === 'sapt') return date >= weekStartIso && date <= todayIso
      return date >= monthStartIso && date <= todayIso
    })
  }, [searched, temporalFilter, todayIso, weekStartIso, monthStartIso])

  const PILL_FILTERS: { key: TemporalFilter; label: string }[] = [
    { key: 'luna', label: 'Luna' },
    { key: 'sapt', label: 'Săpt.' },
    { key: 'toate', label: 'Toate' },
  ]
  const desktopColumns = useMemo<ColumnDef<Cheltuiala>[]>(() => [
    {
      accessorKey: 'data',
      header: 'Data',
      cell: ({ row }) => formatData(row.original.data),
      meta: {
        searchValue: (row: Cheltuiala) => row.data,
      },
    },
    {
      accessorKey: 'categorie',
      header: 'Categorie',
      cell: ({ row }) => (
        <span className="inline-flex items-center gap-2 font-medium">
          <span>{getCheltuialaCategoryEmoji(row.original.categorie)}</span>
          <span>{row.original.categorie || 'Altele'}</span>
        </span>
      ),
    },
    {
      accessorKey: 'descriere',
      header: 'Descriere',
      cell: ({ row }) => row.original.descriere || '-',
      meta: {
        searchValue: (row: Cheltuiala) => row.descriere,
      },
    },
    {
      accessorKey: 'suma_lei',
      header: 'Cost',
      cell: ({ row }) => `${formatRon(Number(row.original.suma_lei || 0))} RON`,
      meta: {
        searchValue: (row: Cheltuiala) => row.suma_lei,
      },
    },
    {
      accessorKey: 'furnizor',
      header: 'Furnizor',
      cell: ({ row }) => row.original.furnizor || '-',
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
            aria-label="Editează cheltuiala"
            onClick={(event) => {
              event.stopPropagation()
              setEditing(row.original)
              setEditOpen(true)
            }}
          >
            <Pencil className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            aria-label="Șterge cheltuiala"
            onClick={(event) => {
              event.stopPropagation()
              setDeleting(row.original)
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
  ], [])

  return (
    <AppShell
      header={<PageHeader title="Cheltuieli" subtitle="Monitorizare costuri operaționale" />}
      bottomBar={null}
    >
      <div className="mx-auto mt-3 w-full max-w-4xl py-3 sm:mt-0 sm:py-4">

        {/* SCOREBOARD */}
        {scoreboard.totalLuna > 0 ? (
          <div style={{
            background: 'var(--agri-surface)', borderRadius: 12, padding: '10px 14px',
            border: '1px solid var(--agri-border)', marginBottom: 8,
            display: 'flex', alignItems: 'baseline', gap: 12, flexWrap: 'wrap',
          }}>
            <span>
              <span style={{ fontSize: 22, fontWeight: 800, color: 'var(--value-negative)', letterSpacing: '-0.03em' }}>
                {formatRon(scoreboard.totalLuna)}
              </span>
              <span style={{ fontSize: 10, fontWeight: 500, color: 'var(--text-hint)', marginLeft: 4 }}>RON</span>
            </span>
            {scoreboard.topCategorie ? (
              <span style={{ fontSize: 11 }}>
                <span style={{ color: 'var(--agri-text-muted)' }}>Top: </span>
                <strong style={{ color: 'var(--agri-text)' }}>{scoreboard.topCategorie}</strong>
              </span>
            ) : null}
          </div>
        ) : null}

        {/* PILLS */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 10, flexWrap: 'wrap' }}>
          {PILL_FILTERS.map(({ key, label }) => {
            const active = temporalFilter === key
            return (
              <button
                key={key}
                type="button"
                onClick={() => setTemporalFilter(key)}
                style={{
                  padding: '6px 14px', fontSize: 11, fontWeight: 600,
                  borderRadius: 20, border: 'none', cursor: 'pointer',
                  background: active ? 'var(--pill-active-bg)' : 'var(--pill-inactive-bg)',
                  color: active ? 'var(--pill-active-text)' : 'var(--pill-inactive-text)',
                }}
              >
                {label}
              </button>
            )
          })}
        </div>

        {/* SEARCH */}
        {cheltuieli.length > 5 ? (
          <div style={{ marginBottom: 10 }}>
            <SearchField
              containerClassName="md:hidden"
              placeholder="Caută categorie, descriere, furnizor..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              aria-label="Caută cheltuieli"
            />
          </div>
        ) : null}

        {isError ? <ErrorState title="Eroare" message={(error as Error).message} /> : null}
        {isLoading ? <TableCardsSkeleton /> : null}

        {/* EMPTY STATE */}
        {!isLoading && !isError && filtered.length === 0 ? (
          <div style={{
            background: 'var(--agri-surface)', borderRadius: 14, padding: '36px 20px',
            textAlign: 'center', border: '1px solid var(--agri-border)',
          }}>
            <div style={{ fontSize: 36, marginBottom: 8 }}>📉</div>
            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--agri-text)', marginBottom: 6 }}>Nicio cheltuială înregistrată</div>
            <div style={{ fontSize: 12, color: 'var(--text-hint)' }}>Adaugă prima cheltuială cu butonul +</div>
          </div>
        ) : null}

        {/* LIST */}
        {!isLoading && !isError && filtered.length > 0 ? (
          <ResponsiveDataView
            columns={desktopColumns}
            data={filtered}
            getRowId={(row) => row.id}
            searchPlaceholder="Caută în cheltuieli..."
            emptyMessage="Nu am găsit cheltuieli pentru filtrele curente."
            renderCard={(cheltuiala) => (
              <CheltuialaCardNew
                cheltuiala={cheltuiala}
                isExpanded={expandedId === cheltuiala.id}
                onToggle={() => setExpandedId(expandedId === cheltuiala.id ? null : cheltuiala.id)}
                onEdit={() => {
                  setEditing(cheltuiala)
                  setEditOpen(true)
                }}
                onDelete={() => setDeleting(cheltuiala)}
              />
            )}
          />
        ) : null}

      </div>

      <AddCheltuialaDialog
        open={addOpen}
        onOpenChange={(open) => {
          setAddOpen(open)
          if (!open) {
            clearCheltuialaFormQueryParams()
          }
        }}
        initialValues={{
          suma_lei: prefillSuma,
          data: prefillData,
          descriere: prefillDescriereRaw,
          categorie: prefillCategorie,
        }}
        onSubmit={async (data) => {
          await createMutation.mutateAsync({
            client_sync_id: data.client_sync_id,
            data: data.data,
            categorie: data.categorie,
            suma_lei: data.suma_lei,
            furnizor: data.furnizor || undefined,
            descriere: data.descriere || undefined,
          })
        }}
      />

      <EditCheltuialaDialog
        cheltuiala={editing}
        open={editOpen}
        onOpenChange={(open) => {
          setEditOpen(open)
          if (!open) setEditing(null)
        }}
        onSubmit={async (id, data) => {
          await updateMutation.mutateAsync({
            id,
            payload: {
              data: data.data,
              categorie: data.categorie,
              suma_lei: data.suma_lei,
              furnizor: data.furnizor || undefined,
              descriere: data.descriere || undefined,
            },
          })
        }}
      />

      <ConfirmDeleteDialog
        open={!!deleting}
        onOpenChange={(open) => {
          if (!open) setDeleting(null)
        }}
        itemType="Cheltuială"
        itemName={buildCheltuialaDeleteLabel(deleting)}
        description={
          deleting && isAutoManoperaCheltuiala(deleting)
            ? `Atenție: această cheltuială este generată automat din recoltări. Dacă o ștergi, va fi recreată la următoarea recoltare.\n\nȘtergi cheltuiala ${deleting?.categorie || deleting?.furnizor || deleting?.descriere || 'necunoscută'} din ${deleting?.data ? new Date(deleting.data).toLocaleDateString('ro-RO') : 'data necunoscută'} - ${Number(deleting?.suma_lei ?? 0).toFixed(2)} lei?`
            : `Ștergi cheltuiala ${deleting?.categorie || deleting?.furnizor || deleting?.descriere || 'necunoscută'} din ${deleting?.data ? new Date(deleting.data).toLocaleDateString('ro-RO') : 'data necunoscută'} - ${Number(deleting?.suma_lei ?? 0).toFixed(2)} lei?`
        }
        loading={deleteMutation.isPending}
        onConfirm={() => {
          if (!deleting) return
          scheduleDelete(deleting)
          setDeleting(null)
        }}
      />
    </AppShell>
  )
}
