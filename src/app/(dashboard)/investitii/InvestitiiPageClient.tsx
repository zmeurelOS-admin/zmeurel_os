'use client'

import { useEffect, useMemo, useState } from 'react'
import type { ColumnDef } from '@tanstack/react-table'
import { Pencil, Trash2, Landmark } from 'lucide-react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from '@/lib/ui/toast'

import { AppShell } from '@/components/app/AppShell'
import {
  ModuleEmptyCard,
  ModulePillFilterButton,
  ModulePillRow,
  ModuleScoreboard,
} from '@/components/app/module-list-chrome'
import { ErrorState } from '@/components/app/ErrorState'
import { ListSkeletonCard } from '@/components/app/ListSkeleton'
import { PageHeader } from '@/components/app/PageHeader'
import { DeleteConfirmDialog } from '@/components/parcele/DeleteConfirmDialog'
import { AddInvestitieDialog } from '@/components/investitii/AddInvestitieDialog'
import { EditInvestitieDialog } from '@/components/investitii/EditInvestitieDialog'
import { Button } from '@/components/ui/button'
import { ResponsiveDataView } from '@/components/ui/ResponsiveDataView'
import { SearchField } from '@/components/ui/SearchField'
import { useAddAction } from '@/contexts/AddActionContext'
import { deleteInvestitie, getInvestitii, type Investitie } from '@/lib/supabase/queries/investitii'
import { buildInvestitieDeleteLabel } from '@/lib/ui/delete-labels'
import { queryKeys } from '@/lib/query-keys'

interface Parcela {
  id: string
  nume_parcela: string
}

interface InvestitiiPageClientProps {
  initialInvestitii: Investitie[]
  parcele: Parcela[]
}

function normalizeText(value: string | null | undefined): string {
  return (value ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
}

function formatData(value: string): string {
  return new Date(value).toLocaleDateString('ro-RO', { day: '2-digit', month: 'short' })
}

function formatRon(value: number): string {
  return new Intl.NumberFormat('ro-RO', { maximumFractionDigits: 0 }).format(value)
}

// ─── Inline card component ────────────────────────────────────────────────────

function investitieCategoryIcon(category: string | null | undefined): { emoji: string; className: string } {
  const value = normalizeText(category)
  if (value.includes('utilaj') || value.includes('echip')) {
    return { emoji: '🔧', className: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300' }
  }
  if (value.includes('saditor') || value.includes('butas')) {
    return { emoji: '🌱', className: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300' }
  }
  if (value.includes('infra') || value.includes('construct') || value.includes('depoz') || value.includes('sustinere') || value.includes('utilitat')) {
    return { emoji: '🏗️', className: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300' }
  }
  if (value.includes('it') || value.includes('automatiz') || value.includes('tech')) {
    return { emoji: '💻', className: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' }
  }
  return { emoji: '📦', className: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300' }
}

function InvestitieCardNew({
  investitie,
  parcelaName,
  isExpanded,
  onToggle,
  onEdit,
  onDelete,
}: {
  investitie: Investitie
  parcelaName: string
  isExpanded: boolean
  onToggle: () => void
  onEdit: () => void
  onDelete: () => void
}) {
  const suma = Number(investitie.suma_lei || 0)
  const icon = investitieCategoryIcon(investitie.categorie)
  const title = investitie.categorie || 'Alte investiții'
  const subtitle = investitie.furnizor || investitie.descriere || undefined
  const dateLabel = investitie.data
    ? formatData(investitie.data)
    : '-'

  return (
    <div className="rounded-[var(--agri-radius-lg)] border border-[var(--agri-border-card)] bg-[var(--agri-surface)] p-3.5 shadow-[var(--agri-shadow)] dark:bg-slate-800">
      <button type="button" onClick={onToggle} className="w-full text-left" aria-expanded={isExpanded}>
        <div className="flex items-center gap-3">
          <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-lg ${icon.className}`}>
            <span aria-hidden>{icon.emoji}</span>
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-semibold text-[var(--agri-text)]">{title}</div>
            <div className="truncate text-xs text-[var(--agri-text-muted)]">{subtitle || 'Fără detalii'}</div>
          </div>
          <div className="shrink-0 text-right">
            <div className="text-base font-bold text-[var(--agri-text)]">{Math.round(suma)} lei</div>
            <div className="text-[10px] text-[var(--agri-text-muted)]">{dateLabel}</div>
          </div>
        </div>
      </button>

      {isExpanded ? (
        <div className="mt-3 space-y-2 border-t border-[var(--surface-divider)] pt-3 text-xs text-[var(--agri-text-muted)] dark:border-slate-700">
          <p><span className="font-semibold text-[var(--agri-text)]">Descriere completă:</span> {investitie.descriere || '—'}</p>
          <p><span className="font-semibold text-[var(--agri-text)]">Furnizor:</span> {investitie.furnizor || '—'}</p>
          <p><span className="font-semibold text-[var(--agri-text)]">Sumă:</span> {Math.round(suma)} RON</p>
          <p><span className="font-semibold text-[var(--agri-text)]">Dată:</span> {investitie.data ? new Date(investitie.data).toLocaleDateString('ro-RO') : '-'}</p>
          <p><span className="font-semibold text-[var(--agri-text)]">Categorie:</span> {investitie.categorie || 'Alte investiții'}</p>
          <p><span className="font-semibold text-[var(--agri-text)]">Parcelă:</span> {parcelaName}</p>
          <p><span className="font-semibold text-[var(--agri-text)]">Observații:</span> {investitie.descriere || '—'}</p>

          <div className="mt-2 flex justify-center gap-2 border-t border-[var(--surface-divider)] pt-3 dark:border-slate-700">
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation()
                onEdit()
              }}
              className="min-h-9 rounded-lg border border-[var(--button-muted-border)] bg-[var(--button-muted-bg)] px-3 text-[11px] font-semibold text-[var(--button-muted-text)]"
            >
              Editează
            </button>
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation()
                onDelete()
              }}
              className="min-h-9 rounded-lg border border-[var(--status-danger-border)] bg-[var(--status-danger-bg)] px-3 text-[11px] font-semibold text-[var(--status-danger-text)]"
            >
              Șterge
            </button>
          </div>
        </div>
      ) : null}
    </div>
  )
}

// ─── Page component ───────────────────────────────────────────────────────────

export function InvestitiiPageClient({ initialInvestitii, parcele }: InvestitiiPageClientProps) {
  const queryClient = useQueryClient()
  const { registerAddAction } = useAddAction()
  const searchParams = useSearchParams()
  const pathname = usePathname()
  const router = useRouter()

  const [searchTerm, setSearchTerm] = useState('')
  const [addOpen, setAddOpen] = useState(false)
  const [categoryFilter, setCategoryFilter] = useState<string>('Toate')
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const openFormFromQuery = searchParams.get('openForm') === '1'
  const prefillSuma = searchParams.get('suma') ?? undefined
  const prefillData = searchParams.get('data') ?? undefined
  const prefillCategorie = searchParams.get('categorie') ?? undefined
  const prefillDescriere = searchParams.get('descriere') ?? undefined
  const [editingInvestitie, setEditingInvestitie] = useState<Investitie | null>(null)
  const [deletingInvestitie, setDeletingInvestitie] = useState<Investitie | null>(null)

  const {
    data: investitii = initialInvestitii,
    isLoading,
    isError,
    error,
  } = useQuery({
    queryKey: queryKeys.investitii,
    queryFn: getInvestitii,
    initialData: initialInvestitii,
  })

  const deleteMutation = useMutation({
    mutationFn: deleteInvestitie,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.investitii })
      toast.success('Investiție ștearsă')
      setDeletingInvestitie(null)
    },
    onError: (err: Error) => {
      toast.error(err.message)
    },
  })

  const parcelaMap = useMemo(() => {
    const map: Record<string, string> = {}
    parcele.forEach((p) => { map[p.id] = p.nume_parcela || 'Parcela' })
    return map
  }, [parcele])

  const yearNow = new Date().getFullYear()
  const stats = useMemo(() => {
    const totalInvestit = investitii.reduce((sum, inv) => sum + Number(inv.suma_lei || 0), 0)
    const totalAnulAsta = investitii.reduce((sum, inv) => {
      const year = inv.data ? new Date(inv.data).getFullYear() : 0
      return year === yearNow ? sum + Number(inv.suma_lei || 0) : sum
    }, 0)
    return { totalInvestit, totalAnulAsta, count: investitii.length }
  }, [investitii, yearNow])

  const filteredInvestitii = useMemo(() => {
    const term = normalizeText(searchTerm)
    const bySearch = !term
      ? investitii
      : investitii.filter((inv) =>
      [inv.categorie, inv.furnizor, inv.descriere].filter(Boolean).some((value) => normalizeText(value).includes(term))
    )
    if (categoryFilter === 'Toate') return bySearch
    return bySearch.filter((inv) => (inv.categorie || 'Alte investiții') === categoryFilter)
  }, [categoryFilter, investitii, searchTerm])

  const desktopData = useMemo(
    () =>
      [...filteredInvestitii].sort((a, b) => {
        const dateA = new Date(a.data ?? '').getTime()
        const dateB = new Date(b.data ?? '').getTime()
        return (Number.isNaN(dateB) ? 0 : dateB) - (Number.isNaN(dateA) ? 0 : dateA)
      }),
    [filteredInvestitii]
  )

  const categoryPills = useMemo(() => {
    const categories = Array.from(new Set(investitii.map((inv) => inv.categorie || 'Alte investiții')))
    return ['Toate', ...categories]
  }, [investitii])

  const desktopColumns = useMemo<ColumnDef<Investitie>[]>(() => [
    {
      accessorKey: 'data',
      header: 'Data',
      cell: ({ row }) => (row.original.data ? formatData(row.original.data) : '-'),
      meta: {
        searchValue: (row: Investitie) => row.data,
      },
    },
    {
      accessorKey: 'categorie',
      header: 'Categorie',
      cell: ({ row }) => {
        const icon = investitieCategoryIcon(row.original.categorie)
        return (
          <span className="inline-flex items-center gap-2 font-medium">
            <span>{icon.emoji}</span>
            <span>{row.original.categorie || 'Alte investiții'}</span>
          </span>
        )
      },
      meta: {
        searchValue: (row: Investitie) => row.categorie,
      },
    },
    {
      accessorKey: 'descriere',
      header: 'Descriere',
      cell: ({ row }) => row.original.descriere || '-',
      meta: {
        searchValue: (row: Investitie) => row.descriere,
      },
    },
    {
      accessorKey: 'suma_lei',
      header: 'Cost',
      cell: ({ row }) => `${formatRon(Number(row.original.suma_lei || 0))} RON`,
      meta: {
        searchValue: (row: Investitie) => row.suma_lei,
        numeric: true,
      },
    },
    {
      accessorKey: 'furnizor',
      header: 'Furnizor',
      cell: ({ row }) => row.original.furnizor || '-',
      meta: {
        searchValue: (row: Investitie) => row.furnizor,
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
            aria-label="Editează investiția"
            onClick={(event) => {
              event.stopPropagation()
              setEditingInvestitie(row.original)
            }}
          >
            <Pencil className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            aria-label="Șterge investiția"
            onClick={(event) => {
              event.stopPropagation()
              setDeletingInvestitie(row.original)
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

  useEffect(() => {
    if (!openFormFromQuery) return
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setAddOpen(true)
    const nextParams = new URLSearchParams(searchParams.toString())
    nextParams.delete('openForm')
    nextParams.delete('suma')
    nextParams.delete('data')
    nextParams.delete('categorie')
    nextParams.delete('descriere')
    const query = nextParams.toString()
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false })
  }, [openFormFromQuery, pathname, router, searchParams])

  useEffect(() => {
    const unregister = registerAddAction(() => setAddOpen(true), 'Adaugă investiție')
    return unregister
  }, [registerAddAction])

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <AppShell
      header={
        <PageHeader
          title="Investiții"
          subtitle="Evidența investițiilor"
          rightSlot={<Landmark className="h-5 w-5 shrink-0 text-[var(--agri-text-muted)]" aria-hidden />}
        />
      }
    >
      <div className="mx-auto mt-2 w-full max-w-4xl space-y-3 px-0 py-3 sm:mt-0 sm:px-3">

        <ModuleScoreboard className="mb-2">
          <span>
            <span className="text-[22px] font-extrabold tracking-[-0.03em] text-[var(--agri-text)]">
              {Math.round(stats.totalInvestit)}
            </span>
            <span className="ml-1 text-[10px] font-medium text-[var(--text-hint)]">RON</span>
          </span>
          <span className="text-[11px] text-[var(--agri-text-muted)]">total investit</span>
          {stats.totalAnulAsta > 0 ? (
            <span className="text-[11px] text-[var(--agri-text-muted)]">
              · {Math.round(stats.totalAnulAsta)} RON în {yearNow}
            </span>
          ) : null}
        </ModuleScoreboard>

        <ModulePillRow className="mb-2.5">
          {categoryPills.map((pill) => (
            <ModulePillFilterButton
              key={pill}
              active={categoryFilter === pill}
              onClick={() => setCategoryFilter(pill)}
            >
              {pill}
            </ModulePillFilterButton>
          ))}
        </ModulePillRow>

        {/* Search */}
        <SearchField
          containerClassName="md:hidden"
          placeholder="Caută investiție..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          aria-label="Caută investiții"
        />

        {/* Error */}
        {isError ? <ErrorState title="Eroare" message={(error as Error).message} /> : null}

        {/* Loading */}
        {isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <ListSkeletonCard key={i} className="min-h-[72px]" />
            ))}
          </div>
        ) : null}

        {/* Empty state */}
        {!isLoading && !isError && filteredInvestitii.length === 0 ? (
          <ModuleEmptyCard
            emoji="🏗️"
            title="Nicio investiție adăugată"
            hint="Adaugă prima investiție pentru a o urmări"
          />
        ) : null}

        {/* Cards */}
        {!isLoading && !isError && filteredInvestitii.length > 0 ? (
          <ResponsiveDataView
            columns={desktopColumns}
            data={desktopData}
            getRowId={(row) => row.id}
            mobileContainerClassName="grid-cols-1"
            searchPlaceholder="Caută în investiții..."
            emptyMessage="Nu am găsit investiții pentru filtrele curente."
            renderCard={(investitie) => (
              <InvestitieCardNew
                investitie={investitie}
                parcelaName={investitie.parcela_id ? (parcelaMap[investitie.parcela_id] || 'Parcela') : 'Parcela'}
                isExpanded={expandedId === investitie.id}
                onToggle={() => setExpandedId(expandedId === investitie.id ? null : investitie.id)}
                onEdit={() => setEditingInvestitie(investitie)}
                onDelete={() => setDeletingInvestitie(investitie)}
              />
            )}
          />
        ) : null}
      </div>

      <AddInvestitieDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        hideTrigger
        initialValues={{
          suma_lei: prefillSuma,
          data: prefillData,
          categorie: prefillCategorie,
          descriere: prefillDescriere,
        }}
      />

      <EditInvestitieDialog
        investitie={editingInvestitie}
        open={!!editingInvestitie}
        onOpenChange={(open) => { if (!open) setEditingInvestitie(null) }}
      />

      <DeleteConfirmDialog
        open={!!deletingInvestitie}
        onOpenChange={(open) => { if (!open) setDeletingInvestitie(null) }}
        onConfirm={() => {
          if (deletingInvestitie) deleteMutation.mutate(deletingInvestitie.id)
        }}
        itemName={buildInvestitieDeleteLabel(deletingInvestitie, deletingInvestitie?.parcela_id ? parcelaMap[deletingInvestitie.parcela_id] : '')}
        itemType="investitie"
        description={`Ștergi investiția ${deletingInvestitie?.categorie || 'necunoscută'} din ${deletingInvestitie?.data ? new Date(deletingInvestitie.data).toLocaleDateString('ro-RO') : 'data necunoscută'} - ${Number(deletingInvestitie?.suma_lei ?? 0).toFixed(2)} lei?`}
      />
    </AppShell>
  )
}
