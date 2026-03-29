'use client'

import { useEffect, useState } from 'react'
import { Pencil, Trash2 } from 'lucide-react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { AppShell } from '@/components/app/AppShell'
import { ConfirmDeleteDialog } from '@/components/app/ConfirmDeleteDialog'
import { ErrorState } from '@/components/app/ErrorState'
import { ListSkeletonCard } from '@/components/app/ListSkeleton'
import { PageHeader } from '@/components/app/PageHeader'
import { AddProdusDialog } from '@/components/produse/AddProdusDialog'
import { EditProdusDialog } from '@/components/produse/EditProdusDialog'
import { useAddAction } from '@/contexts/AddActionContext'
import { queryKeys } from '@/lib/query-keys'
import { deleteProdus, getProduse, type Produs } from '@/lib/supabase/queries/produse'
import { toast } from '@/lib/ui/toast'

const FILTER_OPTIONS = [
  { value: 'all', label: 'Toate' },
  { value: 'activ', label: 'Active' },
  { value: 'inactiv', label: 'Inactive' },
]

const CATEGORIE_LABELS: Record<string, string> = {
  fruct: 'Fruct',
  leguma: 'Legumă',
  procesat: 'Procesat',
  altele: 'Altele',
}

export function ProdusePageClient() {
  const [addOpen, setAddOpen] = useState(false)
  const [editProdus, setEditProdus] = useState<Produs | null>(null)
  const [deleteProdusItem, setDeleteProdusItem] = useState<Produs | null>(null)
  const [filter, setFilter] = useState<'all' | 'activ' | 'inactiv'>('all')
  const [search, setSearch] = useState('')

  const queryClient = useQueryClient()
  const { registerAddAction } = useAddAction()

  useEffect(() => {
    const unregister = registerAddAction(() => setAddOpen(true), '+ Produs nou')
    return unregister
  }, [registerAddAction])

  const { data: produse = [], isLoading, isError } = useQuery({
    queryKey: queryKeys.produse,
    queryFn: getProduse,
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  })

  const deleteM = useMutation({
    mutationFn: (id: string) => deleteProdus(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.produse })
      queryClient.invalidateQueries({ queryKey: queryKeys.produseActiv })
      toast.success('Produs șters.')
      setDeleteProdusItem(null)
    },
    onError: () => {
      toast.error('Eroare la ștergere.')
    },
  })

  const handleSuccess = () => {
    queryClient.invalidateQueries({ queryKey: queryKeys.produse })
    queryClient.invalidateQueries({ queryKey: queryKeys.produseActiv })
  }

  const normalizeText = (s: string) =>
    s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')

  const filtered = produse.filter((p) => {
    if (filter !== 'all' && p.status !== filter) return false
    if (search.trim()) {
      const q = normalizeText(search.trim())
      return normalizeText(p.nume).includes(q) || normalizeText(p.descriere ?? '').includes(q)
    }
    return true
  })

  return (
    <AppShell header={<PageHeader title="Produse" />}>
      <div className="space-y-4 py-4">
        {/* Search + filters */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <input
            type="search"
            placeholder="Caută produs..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="agri-control h-10 flex-1 px-3 text-sm"
          />
          <div className="flex gap-2">
            {FILTER_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setFilter(opt.value as 'all' | 'activ' | 'inactiv')}
                className={`h-8 rounded-full px-4 text-xs font-semibold transition ${
                  filter === opt.value
                    ? 'bg-[var(--agri-primary)] text-white'
                    : 'border border-[var(--agri-border)] bg-[var(--agri-surface-muted)] text-[var(--agri-text)]'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        {isLoading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <ListSkeletonCard key={i} />
            ))}
          </div>
        ) : isError ? (
          <ErrorState title="Eroare" message="Nu am putut încărca produsele." />
        ) : filtered.length === 0 ? (
          <div className="py-16 text-center text-[var(--agri-text-muted)]">
            {search ? 'Niciun produs găsit.' : 'Nu ai produse adăugate încă.'}
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {filtered.map((p) => (
              <ProdusCard
                key={p.id}
                produs={p}
                onEdit={() => setEditProdus(p)}
                onDelete={() => setDeleteProdusItem(p)}
              />
            ))}
          </div>
        )}
      </div>

      <AddProdusDialog open={addOpen} onOpenChange={setAddOpen} onSuccess={handleSuccess} />

      <EditProdusDialog
        produs={editProdus}
        open={editProdus !== null}
        onOpenChange={(open) => { if (!open) setEditProdus(null) }}
        onSuccess={handleSuccess}
      />

      <ConfirmDeleteDialog
        open={deleteProdusItem !== null}
        onOpenChange={(open) => { if (!open) setDeleteProdusItem(null) }}
        title="Șterge produs"
        description={`Ești sigur că vrei să ștergi produsul "${deleteProdusItem?.nume}"? Acțiunea nu poate fi anulată.`}
        onConfirm={() => {
          if (deleteProdusItem) deleteM.mutate(deleteProdusItem.id)
        }}
        loading={deleteM.isPending}
      />
    </AppShell>
  )
}

interface ProdusCardProps {
  produs: Produs
  onEdit: () => void
  onDelete: () => void
}

function ProdusCard({ produs, onEdit, onDelete }: ProdusCardProps) {
  const primaryPhoto = produs.poza_1_url ?? produs.poza_2_url

  return (
    <div className="agri-card flex flex-col overflow-hidden rounded-2xl border border-[var(--agri-border)] bg-white dark:bg-zinc-900">
      {/* Photo */}
      <div className="relative h-40 bg-[var(--agri-surface-muted)]">
        {primaryPhoto ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={primaryPhoto} alt={produs.nume} className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full items-center justify-center text-4xl">🛒</div>
        )}
        {/* Status badge */}
        {produs.status === 'inactiv' ? (
          <span className="absolute left-2 top-2 rounded-full bg-zinc-700/80 px-2 py-0.5 text-[10px] font-semibold text-white">
            Inactiv
          </span>
        ) : null}
      </div>

      {/* Body */}
      <div className="flex flex-1 flex-col gap-1.5 p-3">
        <p className="text-sm font-semibold leading-tight text-[var(--agri-text)]">{produs.nume}</p>
        <div className="flex flex-wrap gap-1.5">
          <span className="rounded-md bg-[var(--agri-surface-muted)] px-2 py-0.5 text-[11px] font-medium text-[var(--agri-text-muted)]">
            {CATEGORIE_LABELS[produs.categorie] ?? produs.categorie}
          </span>
          <span className="rounded-md bg-[var(--agri-surface-muted)] px-2 py-0.5 text-[11px] font-medium text-[var(--agri-text-muted)]">
            {produs.unitate_vanzare}
          </span>
        </div>
        {produs.pret_unitar != null ? (
          <p className="text-base font-bold text-[var(--agri-primary)]">
            {produs.pret_unitar.toFixed(2)} {produs.moneda}
            <span className="ml-1 text-xs font-normal text-[var(--agri-text-muted)]">/ {produs.unitate_vanzare}</span>
          </p>
        ) : null}
        {produs.descriere ? (
          <p className="line-clamp-2 text-xs text-[var(--agri-text-muted)]">{produs.descriere}</p>
        ) : null}
      </div>

      {/* Actions */}
      <div className="flex gap-2 border-t border-[var(--agri-border)] p-2">
        <button
          type="button"
          onClick={onEdit}
          className="flex h-8 flex-1 items-center justify-center gap-1.5 rounded-xl text-xs font-semibold text-[var(--agri-text)] transition hover:bg-[var(--agri-surface-muted)]"
        >
          <Pencil className="h-3.5 w-3.5" />
          Editează
        </button>
        <button
          type="button"
          onClick={onDelete}
          className="flex h-8 flex-1 items-center justify-center gap-1.5 rounded-xl text-xs font-semibold text-[var(--soft-danger-text)] transition hover:bg-[var(--soft-danger-bg)]"
        >
          <Trash2 className="h-3.5 w-3.5" />
          Șterge
        </button>
      </div>
    </div>
  )
}
