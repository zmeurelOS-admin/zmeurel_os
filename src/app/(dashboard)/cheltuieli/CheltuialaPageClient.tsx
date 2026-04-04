'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { ColumnDef } from '@tanstack/react-table'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { Pencil, Trash2 } from 'lucide-react'
import { toast } from '@/lib/ui/toast'

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
import { AddCheltuialaDialog } from '@/components/cheltuieli/AddCheltuialaDialog'
import { EditCheltuialaDialog } from '@/components/cheltuieli/EditCheltuialaDialog'
import { Button } from '@/components/ui/button'
import {
  DesktopInspectorPanel,
  DesktopInspectorSection,
  DesktopSplitPane,
  DesktopToolbar,
} from '@/components/ui/desktop'
import { MobileEntityCard } from '@/components/ui/MobileEntityCard'
import { ResponsiveDataView } from '@/components/ui/ResponsiveDataView'
import { SearchField } from '@/components/ui/SearchField'
import StatusBadge from '@/components/ui/StatusBadge'
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

function cheltuialaCategoryEmoji(category: string | null | undefined): string {
  const n = normalizeText(category)
  if (n.includes('combustibil') || n.includes('carburant') || n.includes('motorina') || n.includes('benzina')) return '⛽'
  if (n.includes('material')) return '🧱'
  if (n.includes('manopera') || n.includes('munca') || n.includes('forta')) return '👷'
  if (n.includes('trat') || n.includes('chimic') || n.includes('pesticid') || n.includes('fitosanitar')) return '🧪'
  return '💸'
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

function formatCheltuialaStatusLabel(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)

  const diffDays = Math.round((today.getTime() - d.getTime()) / (1000 * 60 * 60 * 24))
  if (diffDays === 0) return 'Azi'
  if (diffDays === 1) return 'Ieri'
  if (diffDays > 1 && diffDays <= 14) return `Acum ${diffDays} zile`

  return date.toLocaleDateString('ro-RO', { month: 'short', year: 'numeric' })
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
  const emoji = cheltuialaCategoryEmoji(cheltuiala.categorie)
  const isAuto = isAutoManoperaCheltuiala(cheltuiala)

  const categorie = (cheltuiala.categorie ?? '').trim()
  const descriere = (cheltuiala.descriere ?? '').trim()
  const furnizor = (cheltuiala.furnizor ?? '').trim()

  const titleText = categorie || 'Altele'
  const subtitleText = furnizor || 'Furnizor nespecificat'
  const dateLabel = cheltuiala.data ? formatCheltuialaStatusLabel(cheltuiala.data) : undefined
  const metaText =
    descriere.length > 0 ? `${descriere.slice(0, 72)}${descriere.length > 72 ? '…' : ''}` : undefined
  const autoLabel = isAuto ? 'Automat' : 'Manual'

  return (
    <MobileEntityCard
      title={titleText}
      icon={<span aria-hidden>{emoji}</span>}
      mainValue={`${formatRon(suma)} RON`}
      subtitle={subtitleText}
      secondaryValue={dateLabel}
      meta={metaText}
      statusLabel={autoLabel}
      statusTone={isAuto ? 'warning' : 'neutral'}
      showChevron
      onClick={onToggle}
      bottomSlot={isExpanded ? (
        <>
          <div className="flex flex-wrap gap-2 text-xs text-[var(--text-primary)]">
            <span>
              <span className="text-[var(--text-secondary)]">Categorie: </span>
              <span className="font-semibold">{cheltuiala.categorie || 'Altele'}</span>
            </span>
            <span>
              <span className="text-[var(--text-secondary)]">Sumă: </span>
              <span className="font-semibold text-[var(--danger-text)]">{formatRon(suma)} RON</span>
            </span>
            <span>
              <span className="text-[var(--text-secondary)]">Data: </span>
              <span className="font-semibold">{new Date(cheltuiala.data).toLocaleDateString('ro-RO')}</span>
            </span>
            {cheltuiala.furnizor ? (
              <span>
                <span className="text-[var(--text-secondary)]">Furnizor: </span>
                <span className="font-semibold">{cheltuiala.furnizor}</span>
              </span>
            ) : null}
            {cheltuiala.descriere ? (
              <span>
                <span className="text-[var(--text-secondary)]">Observații: </span>
                <span className="font-semibold">{cheltuiala.descriere}</span>
              </span>
            ) : null}
          </div>

          <div className="mt-3 flex justify-center gap-2 border-t border-[var(--surface-divider)] pt-3">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                onEdit()
              }}
              className="min-h-9 rounded-lg border border-[var(--button-muted-border)] bg-[var(--button-muted-bg)] px-3 text-[11px] font-semibold text-[var(--button-muted-text)]"
            >
              Editează
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                onDelete()
              }}
              className="min-h-9 rounded-lg border border-[var(--status-danger-border)] bg-[var(--status-danger-bg)] px-3 text-[11px] font-semibold text-[var(--status-danger-text)]"
            >
              Șterge
            </button>
          </div>
        </>
      ) : undefined}
    />
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
  const autoFilterAdjustedRef = useRef(false)

  const [search, setSearch] = useState('')
  const [temporalFilter, setTemporalFilter] = useState<TemporalFilter>('luna')
  const [addOpen, setAddOpen] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [editing, setEditing] = useState<Cheltuiala | null>(null)
  const [deleting, setDeleting] = useState<Cheltuiala | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [desktopSelectedCheltuialaId, setDesktopSelectedCheltuialaId] = useState<string | null>(null)

  const addFromQuery = searchParams.get('add') === '1'
  const openFormFromQuery = searchParams.get('openForm') === '1'
  const isAddDialogOpen = addOpen || addFromQuery || openFormFromQuery
  const prefillSuma = searchParams.get('suma') ?? undefined
  const prefillData = searchParams.get('data') ?? undefined
  const prefillDescriereRaw = searchParams.get('descriere') ?? undefined
  const prefillCategorie = searchParams.get('categorie') ?? undefined

  const clearCheltuialaFormQueryParams = useCallback(() => {
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
  }, [pathname, router, searchParams])

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

  const desktopSelectedCheltuiala =
    filtered.find((row) => row.id === desktopSelectedCheltuialaId) ?? filtered[0] ?? null

  const filteredTotalRon = useMemo(
    () => filtered.reduce((sum, row) => sum + Number(row.suma_lei || 0), 0),
    [filtered],
  )

  useEffect(() => {
    if (autoFilterAdjustedRef.current) return
    if (isLoading || isError) return
    if (search.trim()) return
    if (temporalFilter !== 'luna') return
    if (cheltuieli.length === 0) return
    if (filtered.length > 0) return

    // Dacă există date, dar "Luna" nu are rezultate, evităm impresia că datele lipsesc.
    const timer = window.setTimeout(() => {
      setTemporalFilter('toate')
    }, 0)
    autoFilterAdjustedRef.current = true
    return () => window.clearTimeout(timer)
  }, [cheltuieli.length, filtered.length, isError, isLoading, search, temporalFilter])

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
          <span>{cheltuialaCategoryEmoji(row.original.categorie)}</span>
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
        numeric: true,
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
      <div className="mx-auto mt-2 w-full max-w-4xl space-y-3 py-3 sm:mt-0 sm:py-3 md:max-w-7xl">

        {/* SCOREBOARD */}
        {scoreboard.totalLuna > 0 ? (
          <ModuleScoreboard className="mb-2">
            <span>
              <span className="text-[22px] font-extrabold tracking-[-0.03em] text-[var(--danger-text)]">
                {formatRon(scoreboard.totalLuna)}
              </span>
              <span className="ml-1 text-[10px] font-medium text-[var(--text-secondary)]">RON</span>
            </span>
            {scoreboard.topCategorie ? (
              <span className="text-[11px]">
                <span className="text-[var(--text-secondary)]">Top: </span>
                <strong className="text-[var(--text-primary)]">{scoreboard.topCategorie}</strong>
              </span>
            ) : null}
          </ModuleScoreboard>
        ) : null}

        <ModulePillRow className="mb-2.5">
          {PILL_FILTERS.map(({ key, label }) => (
            <ModulePillFilterButton
              key={key}
              active={temporalFilter === key}
              onClick={() => setTemporalFilter(key)}
            >
              {label}
            </ModulePillFilterButton>
          ))}
        </ModulePillRow>

        {/* SEARCH mobil */}
        {cheltuieli.length > 5 ? (
          <div className="mb-2.5 md:hidden">
            <SearchField
              placeholder="Caută categorie, descriere, furnizor..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              aria-label="Caută cheltuieli"
            />
          </div>
        ) : null}

        {!isLoading && !isError && cheltuieli.length > 0 ? (
          <DesktopToolbar
            className="hidden md:flex"
            trailing={
              <div className="flex flex-wrap items-center justify-end gap-x-2 text-sm text-[var(--text-secondary)]">
                <span>
                  <span className="font-semibold text-[var(--danger-text)]">{formatRon(filteredTotalRon)}</span>
                  <span className="ml-1 text-xs text-[var(--text-tertiary)]">RON în filtru</span>
                </span>
                <span className="text-[var(--text-tertiary)]">·</span>
                <span>
                  {filtered.length} {filtered.length === 1 ? 'înregistrare' : 'înregistrări'}
                </span>
              </div>
            }
          >
            <SearchField
              containerClassName="w-full max-w-md min-w-[200px]"
              placeholder="Caută categorie, descriere, furnizor..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              aria-label="Caută cheltuieli (desktop)"
            />
          </DesktopToolbar>
        ) : null}

        {isError ? <ErrorState title="Eroare" message={(error as Error).message} /> : null}
        {isLoading ? <EntityListSkeleton /> : null}

        {/* EMPTY STATE */}
        {!isLoading && !isError && filtered.length === 0 ? (
          <ModuleEmptyCard
            emoji="📉"
            title={cheltuieli.length > 0 ? 'Nu există rezultate pentru filtrele curente' : 'Nicio cheltuială înregistrată'}
            hint={
              cheltuieli.length > 0
                ? 'Schimbă perioada sau caută după alt termen'
                : 'Adaugă prima cheltuială cu butonul +'
            }
          />
        ) : null}

        {/* LIST */}
        {!isLoading && !isError && filtered.length > 0 ? (
          <DesktopSplitPane
            master={
              <ResponsiveDataView
                columns={desktopColumns}
                data={filtered}
                getRowId={(row) => row.id}
                mobileContainerClassName="grid-cols-1"
                searchPlaceholder="Caută în cheltuieli..."
                emptyMessage="Nu am găsit cheltuieli pentru filtrele curente."
                desktopContainerClassName="md:min-w-0"
                skipDesktopDataFilter
                hideDesktopSearchRow
                onDesktopRowClick={(row) => setDesktopSelectedCheltuialaId(row.id)}
                isDesktopRowSelected={(row) => desktopSelectedCheltuiala?.id === row.id}
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
            }
            detail={
              <DesktopInspectorPanel
                title="Detalii cheltuială"
                description={
                  desktopSelectedCheltuiala
                    ? `${desktopSelectedCheltuiala.id_cheltuiala || desktopSelectedCheltuiala.id.slice(0, 8)}`
                    : undefined
                }
                footer={
                  desktopSelectedCheltuiala ? (
                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        className="agri-cta"
                        onClick={() => {
                          setEditing(desktopSelectedCheltuiala)
                          setEditOpen(true)
                        }}
                      >
                        Editează
                      </Button>
                      <Button
                        type="button"
                        variant="destructive"
                        className="agri-cta"
                        onClick={() => setDeleting(desktopSelectedCheltuiala)}
                      >
                        Șterge
                      </Button>
                    </div>
                  ) : null
                }
              >
                {desktopSelectedCheltuiala ? (
                  (() => {
                    const c = desktopSelectedCheltuiala
                    const suma = Number(c.suma_lei || 0)
                    const isAuto = isAutoManoperaCheltuiala(c)
                    const emoji = cheltuialaCategoryEmoji(c.categorie)

                    return (
                      <>
                        <DesktopInspectorSection label="Sumar">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-lg" aria-hidden>
                              {emoji}
                            </span>
                            <span className="text-lg font-bold text-[var(--danger-text)]">
                              {formatRon(suma)} RON
                            </span>
                            <StatusBadge
                              text={isAuto ? 'Automat (manoperă)' : 'Manual'}
                              variant={isAuto ? 'warning' : 'neutral'}
                            />
                          </div>
                        </DesktopInspectorSection>
                        <DesktopInspectorSection label="Categorie / dată / tip">
                          <p>
                            <span className="font-medium text-[var(--text-primary)]">Categorie: </span>
                            {c.categorie || 'Altele'}
                          </p>
                          <p>
                            <span className="font-medium text-[var(--text-primary)]">Data: </span>
                            {c.data
                              ? new Date(c.data).toLocaleDateString('ro-RO', {
                                  day: '2-digit',
                                  month: 'long',
                                  year: 'numeric',
                                })
                              : '—'}
                          </p>
                          <p className="text-xs text-[var(--text-tertiary)]">
                            {formatCheltuialaStatusLabel(c.data) || '—'}
                          </p>
                        </DesktopInspectorSection>
                        <DesktopInspectorSection label="Furnizor / descriere">
                          <p>
                            <span className="font-medium text-[var(--text-primary)]">Furnizor: </span>
                            {c.furnizor?.trim() || '—'}
                          </p>
                          <p>
                            <span className="font-medium text-[var(--text-primary)]">Descriere: </span>
                            {c.descriere?.trim() || '—'}
                          </p>
                        </DesktopInspectorSection>
                        <DesktopInspectorSection label="Valoare / context">
                          <p>
                            <span className="font-medium text-[var(--text-primary)]">Sumă: </span>
                            {formatRon(suma)} RON
                          </p>
                          {c.document_url ? (
                            <p>
                              <span className="font-medium text-[var(--text-primary)]">Document: </span>
                              <a
                                href={c.document_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-[var(--focus-ring)] underline underline-offset-2"
                              >
                                Deschide link
                              </a>
                            </p>
                          ) : null}
                          {c.sync_status ? (
                            <p className="text-xs text-[var(--text-tertiary)]">
                              Sincronizare: {c.sync_status}
                            </p>
                          ) : null}
                        </DesktopInspectorSection>
                      </>
                    )
                  })()
                ) : (
                  <p className="text-sm text-[var(--text-secondary)]">
                    Selectează o cheltuială din tabel pentru a vedea detaliile.
                  </p>
                )}
              </DesktopInspectorPanel>
            }
          />
        ) : null}

      </div>

      <AddCheltuialaDialog
        open={isAddDialogOpen}
        onOpenChange={(open) => {
          if (!open) {
            setAddOpen(false)
            clearCheltuialaFormQueryParams()
            return
          }
          setAddOpen(true)
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
