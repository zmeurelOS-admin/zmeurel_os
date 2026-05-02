'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import type { ColumnDef } from '@tanstack/react-table'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Copy, ExternalLink, Pencil, Trash2 } from 'lucide-react'

import { AppShell } from '@/components/app/AppShell'
import { ConfirmDeleteDialog } from '@/components/app/ConfirmDeleteDialog'
import { DashboardContentShell } from '@/components/app/DashboardContentShell'
import { ErrorState } from '@/components/app/ErrorState'
import { EntityListSkeleton, ListSkeletonCard } from '@/components/app/ListSkeleton'
import { ModuleEmptyCard } from '@/components/app/module-list-chrome'
import { PageHeader } from '@/components/app/PageHeader'
import { AddProdusDialog } from '@/components/produse/AddProdusDialog'
import { EditProdusDialog } from '@/components/produse/EditProdusDialog'
import { ProductAssociationOfferBlock } from '@/components/produse/ProductAssociationOfferBlock'
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
import { useAddAction } from '@/contexts/AddActionContext'
import { useDashboardAuth } from '@/components/app/DashboardAuthContext'
import { useMediaQuery } from '@/hooks/useMediaQuery'
import { useTrackModuleView } from '@/lib/analytics/useTrackModuleView'
import {
  buildOfferStateMap,
  fetchTenantProductOffers,
  type ProductOfferUiState,
} from '@/lib/association/offer-queries'
import { queryKeys } from '@/lib/query-keys'
import {
  CATEGORII_PRODUSE,
  deleteProdus,
  getProduse,
  type CategorieProdus,
  type Produs,
} from '@/lib/supabase/queries/produse'
import { toast } from '@/lib/ui/toast'

const STATUS_FILTER = [
  { value: 'all' as const, label: 'Toate' },
  { value: 'activ' as const, label: 'Active' },
  { value: 'inactiv' as const, label: 'Inactive' },
]

const CATEGORIE_LABELS: Record<CategorieProdus, string> = {
  fruct: 'Fruct',
  leguma: 'Legumă',
  procesat: 'Procesat',
  altele: 'Altele',
}

function normalizeText(s: string) {
  return s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
}

function formatPret(produs: Produs): string {
  if (produs.pret_unitar == null) return '—'
  return `${Number(produs.pret_unitar).toFixed(2)} ${produs.moneda || 'RON'}`
}

export function ProdusePageClient() {
  useTrackModuleView('produse')
  const { tenantId, associationShopApproved } = useDashboardAuth()
  const isDesktop = useMediaQuery('(min-width: 768px)')
  const [addOpen, setAddOpen] = useState(false)
  const [editProdus, setEditProdus] = useState<Produs | null>(null)
  const [deleteProdusItem, setDeleteProdusItem] = useState<Produs | null>(null)
  const [filterStatus, setFilterStatus] = useState<'all' | 'activ' | 'inactiv'>('all')
  const [filterCategorie, setFilterCategorie] = useState<'all' | CategorieProdus>('all')
  const [search, setSearch] = useState('')
  const [desktopSelectedProdusId, setDesktopSelectedProdusId] = useState<string | null>(null)

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

  const productStatusById = useMemo(() => {
    const m: Record<string, 'activ' | 'inactiv'> = {}
    for (const p of produse) {
      m[p.id] = p.status
    }
    return m
  }, [produse])

  const { data: offerRows = [] } = useQuery({
    queryKey: queryKeys.associationProductOffers(tenantId),
    queryFn: fetchTenantProductOffers,
    enabled: Boolean(tenantId && associationShopApproved),
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  })

  const offerStateMap = useMemo(
    () => buildOfferStateMap(
      produse.map((p) => p.id),
      offerRows,
      productStatusById
    ),
    [produse, offerRows, productStatusById],
  )

  const refreshOffers = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: queryKeys.associationProductOffers(tenantId) })
  }, [queryClient, tenantId])

  const shopPath = tenantId ? `/magazin/${tenantId}` : null
  const hasActiveForShop = useMemo(
    () => produse.some((p) => p.status === 'activ'),
    [produse],
  )
  const magazinCtaEnabled = Boolean(tenantId && shopPath && hasActiveForShop)

  const copyMagazinLink = useCallback(async () => {
    if (!shopPath || !tenantId) return
    const url = `${typeof window !== 'undefined' ? window.location.origin : ''}${shopPath}`
    try {
      await navigator.clipboard.writeText(url)
      toast.success('Link copiat')
    } catch {
      toast.error('Nu am putut copia linkul.')
    }
  }, [shopPath, tenantId])

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
    void queryClient.invalidateQueries({ queryKey: queryKeys.associationProductOffers(tenantId) })
  }

  const filtered = useMemo(() => {
    return produse.filter((p) => {
      if (filterStatus !== 'all' && p.status !== filterStatus) return false
      if (filterCategorie !== 'all' && p.categorie !== filterCategorie) return false
      if (search.trim()) {
        const q = normalizeText(search.trim())
        return normalizeText(p.nume).includes(q) || normalizeText(p.descriere ?? '').includes(q)
      }
      return true
    })
  }, [produse, filterStatus, filterCategorie, search])

  const resolvedDesktopSelectedId = useMemo(() => {
    if (!isDesktop || filtered.length === 0) return null
    if (desktopSelectedProdusId && filtered.some((p) => p.id === desktopSelectedProdusId)) {
      return desktopSelectedProdusId
    }
    return filtered[0].id
  }, [isDesktop, filtered, desktopSelectedProdusId])

  const desktopSelectedProdus = useMemo(
    () => (resolvedDesktopSelectedId ? filtered.find((p) => p.id === resolvedDesktopSelectedId) ?? null : null),
    [filtered, resolvedDesktopSelectedId],
  )

  const desktopColumns = useMemo<ColumnDef<Produs>[]>(() => [
    {
      accessorKey: 'nume',
      header: 'Produs',
      cell: ({ row }) => <span className="font-medium text-[var(--text-primary)]">{row.original.nume}</span>,
      meta: {
        searchValue: (row: Produs) => row.nume,
      },
    },
    {
      accessorKey: 'categorie',
      header: 'Categorie',
      cell: ({ row }) => CATEGORIE_LABELS[row.original.categorie] ?? row.original.categorie,
      meta: {
        searchValue: (row: Produs) => CATEGORIE_LABELS[row.categorie],
      },
    },
    {
      accessorKey: 'unitate_vanzare',
      header: 'Unitate',
    },
    {
      id: 'pret',
      header: 'Preț',
      cell: ({ row }) => formatPret(row.original),
      meta: { numeric: true, searchValue: (row: Produs) => row.pret_unitar },
    },
    {
      accessorKey: 'status',
      header: 'Status',
      cell: ({ row }) => (
        <StatusBadge
          text={row.original.status === 'activ' ? 'Activ' : 'Inactiv'}
          variant={row.original.status === 'activ' ? 'success' : 'neutral'}
        />
      ),
      meta: {
        searchValue: (row: Produs) => row.status,
      },
    },
    {
      id: 'asociatie',
      header: 'Asociație',
      enableSorting: false,
      cell: ({ row }) => {
        const p = row.original
        const st = offerStateMap[p.id]
        if (!associationShopApproved) {
          return <span className="text-xs text-[var(--text-tertiary)]">—</span>
        }
        return (
          <ProductAssociationOfferBlock
            variant="inline"
            productId={p.id}
            productName={p.nume}
            pretUnitar={p.pret_unitar}
            moneda={p.moneda || 'RON'}
            unitate={p.unitate_vanzare}
            status={p.status}
            associationShopApproved={associationShopApproved}
            offerState={st}
            onChanged={refreshOffers}
          />
        )
      },
      meta: {
        searchable: false,
        headerClassName: 'min-w-[140px]',
        cellClassName: 'align-top',
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
            aria-label="Editează produsul"
            onClick={(e) => {
              e.stopPropagation()
              setEditProdus(row.original)
            }}
          >
            <Pencil className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            aria-label="Șterge produsul"
            onClick={(e) => {
              e.stopPropagation()
              setDeleteProdusItem(row.original)
            }}
          >
            <Trash2 className="h-4 w-4 text-[var(--soft-danger-text)]" />
          </Button>
        </div>
      ),
      meta: {
        searchable: false,
        sticky: 'right',
        headerClassName: 'w-[96px] text-right',
        cellClassName: 'w-[96px] text-right',
      },
    },
  ], [associationShopApproved, offerStateMap, refreshOffers])

  const onDesktopRowClick = useCallback((row: Produs) => {
    setDesktopSelectedProdusId(row.id)
  }, [])

  const isDesktopRowSelected = useCallback(
    (row: Produs) => resolvedDesktopSelectedId === row.id,
    [resolvedDesktopSelectedId],
  )

  return (
    <AppShell header={<PageHeader title="Produse" subtitle="Catalog intern fermă" contentVariant="workspace" />}>
      <DashboardContentShell variant="workspace" className="mt-2 space-y-3 py-3 sm:mt-0">
        {!isLoading && !isError && tenantId && shopPath ? (
          <div
            className={`rounded-2xl border border-[var(--agri-border)] bg-[var(--agri-surface-muted)]/80 px-3 py-3 md:px-4 ${
              produse.length > 0 ? 'md:hidden' : ''
            }`}
          >
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between md:gap-4">
              <p className="text-xs leading-snug text-[var(--text-secondary)] md:text-sm">
                {magazinCtaEnabled ? (
                  <span>
                    <span className="font-semibold text-[var(--text-primary)]">Magazin public: </span>
                    clienții văd doar produsele marcate „Activ”.
                  </span>
                ) : produse.length === 0 ? (
                  <span>Adaugă produse pentru a activa magazinul.</span>
                ) : (
                  <span>Activează cel puțin un produs ca să apară în magazinul public.</span>
                )}
              </p>
              <div className="flex flex-wrap items-stretch gap-2 sm:flex-nowrap md:shrink-0">
                {magazinCtaEnabled ? (
                  <Button type="button" variant="outline" size="sm" className="min-h-10 flex-1 gap-1.5 sm:flex-initial" asChild>
                    <a href={shopPath} target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="h-3.5 w-3.5 shrink-0" aria-hidden />
                      Vezi magazin
                    </a>
                  </Button>
                ) : (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="min-h-10 flex-1 gap-1.5 sm:flex-initial"
                    disabled
                    title="Adaugă cel puțin un produs activ"
                  >
                    <ExternalLink className="h-3.5 w-3.5 shrink-0 opacity-50" aria-hidden />
                    Vezi magazin
                  </Button>
                )}
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  className="min-h-10 flex-1 gap-1.5 sm:flex-initial"
                  disabled={!magazinCtaEnabled}
                  title={
                    magazinCtaEnabled
                      ? 'Copiază linkul complet (cu domeniu) în clipboard'
                      : 'Adaugă cel puțin un produs activ pentru a activa magazinul'
                  }
                  onClick={() => void copyMagazinLink()}
                >
                  <Copy className="h-3.5 w-3.5 shrink-0" aria-hidden />
                  Copiază link magazin
                </Button>
              </div>
            </div>
          </div>
        ) : null}

        {/* Mobil: căutare */}
        {produse.length > 3 ? (
          <div className="md:hidden">
            <SearchField
              placeholder="Caută produs..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              aria-label="Caută produse"
            />
          </div>
        ) : null}

        {/* Mobil: filtre status */}
        <div className="flex flex-wrap gap-2 md:hidden">
          {STATUS_FILTER.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setFilterStatus(opt.value)}
              className={`h-8 rounded-full px-3 text-xs font-semibold transition ${
                filterStatus === opt.value
                  ? 'bg-[var(--agri-primary)] text-white'
                  : 'border border-[var(--agri-border)] bg-[var(--agri-surface-muted)] text-[var(--agri-text)]'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {/* Mobil: filtre categorie */}
        <div className="flex flex-wrap items-center gap-2 md:hidden">
          <button
            type="button"
            onClick={() => setFilterCategorie('all')}
            className={`h-8 rounded-full px-3 text-xs font-semibold transition ${
              filterCategorie === 'all'
                ? 'bg-[var(--brand-blue)] text-white'
                : 'border border-[var(--agri-border)] bg-[var(--agri-surface-muted)] text-[var(--agri-text)]'
            }`}
          >
            Toate categoriile
          </button>
          {CATEGORII_PRODUSE.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setFilterCategorie(c)}
              className={`h-8 rounded-full px-3 text-xs font-semibold transition ${
                filterCategorie === c
                  ? 'bg-[var(--brand-blue)] text-white'
                  : 'border border-[var(--agri-border)] bg-[var(--agri-surface-muted)] text-[var(--agri-text)]'
              }`}
            >
              {CATEGORIE_LABELS[c]}
            </button>
          ))}
        </div>

        {!isLoading && !isError && produse.length > 0 ? (
          <DesktopToolbar
            className="hidden md:flex"
            trailing={
              <div className="flex flex-wrap items-center justify-end gap-2">
                <span className="text-sm text-[var(--text-secondary)]">
                  <span className="font-semibold text-[var(--text-primary)]">{filtered.length}</span>
                  <span className="ml-1 text-xs text-[var(--text-tertiary)]">
                    {filtered.length === 1 ? 'produs în filtru' : 'produse în filtru'}
                  </span>
                </span>
                {shopPath ? (
                  <>
                    {magazinCtaEnabled ? (
                      <Button type="button" variant="outline" size="sm" className="shrink-0 gap-1.5" asChild>
                        <a href={shopPath} target="_blank" rel="noopener noreferrer">
                          <ExternalLink className="h-3.5 w-3.5" aria-hidden />
                          Vezi magazin
                        </a>
                      </Button>
                    ) : (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="shrink-0 gap-1.5"
                        disabled
                        title="Adaugă cel puțin un produs activ"
                      >
                        <ExternalLink className="h-3.5 w-3.5 opacity-50" aria-hidden />
                        Vezi magazin
                      </Button>
                    )}
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      className="shrink-0 gap-1.5"
                      disabled={!magazinCtaEnabled}
                      title={
                        magazinCtaEnabled
                          ? 'Copiază linkul complet (cu domeniu)'
                          : 'Adaugă cel puțin un produs activ pentru magazin'
                      }
                      onClick={() => void copyMagazinLink()}
                    >
                      <Copy className="h-3.5 w-3.5" aria-hidden />
                      Copiază link magazin
                    </Button>
                  </>
                ) : null}
                <Button type="button" className="agri-cta shrink-0" onClick={() => setAddOpen(true)}>
                  Adaugă produs
                </Button>
              </div>
            }
          >
            <SearchField
              containerClassName="w-full max-w-md min-w-[200px]"
              placeholder="Caută după nume sau descriere..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              aria-label="Caută produse (desktop)"
            />
            <div className="flex flex-wrap items-center gap-2">
              <label htmlFor="produse_filter_cat" className="sr-only">
                Categorie
              </label>
              <select
                id="produse_filter_cat"
                value={filterCategorie}
                onChange={(e) => setFilterCategorie(e.target.value as 'all' | CategorieProdus)}
                className="agri-control h-9 min-w-[10rem] rounded-xl px-2 text-sm"
              >
                <option value="all">Toate categoriile</option>
                {CATEGORII_PRODUSE.map((c) => (
                  <option key={c} value={c}>
                    {CATEGORIE_LABELS[c]}
                  </option>
                ))}
              </select>
              <label htmlFor="produse_filter_status" className="sr-only">
                Status
              </label>
              <select
                id="produse_filter_status"
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value as 'all' | 'activ' | 'inactiv')}
                className="agri-control h-9 min-w-[8rem] rounded-xl px-2 text-sm"
              >
                {STATUS_FILTER.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          </DesktopToolbar>
        ) : null}

        {isLoading ? (
          <>
            <div className="hidden md:block">
              <EntityListSkeleton />
            </div>
            <div className="grid gap-4 sm:grid-cols-2 md:hidden lg:grid-cols-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <ListSkeletonCard key={i} />
              ))}
            </div>
          </>
        ) : null}

        {isError ? <ErrorState title="Eroare" message="Nu am putut încărca produsele." /> : null}

        {!isLoading && !isError && filtered.length === 0 ? (
          <ModuleEmptyCard
            emoji="📦"
            title={produse.length > 0 ? 'Niciun produs pentru filtrele curente' : 'Niciun produs în catalog'}
            hint={produse.length > 0 ? 'Modifică căutarea sau filtrele.' : 'Adaugă primul produs cu butonul + sau „Adaugă produs” pe desktop.'}
          />
        ) : null}

        {!isLoading && !isError && filtered.length > 0 ? (
          <DesktopSplitPane
            master={
              <ResponsiveDataView
                columns={desktopColumns}
                data={filtered}
                getRowId={(row) => row.id}
                mobileContainerClassName="grid-cols-1"
                searchPlaceholder="Caută în produse..."
                emptyMessage="Nu am găsit produse."
                desktopContainerClassName="md:min-w-0"
                skipDesktopDataFilter
                hideDesktopSearchRow
                onDesktopRowClick={onDesktopRowClick}
                isDesktopRowSelected={isDesktopRowSelected}
                renderCard={(p) => (
                  <ProdusCard
                    produs={p}
                    associationShopApproved={associationShopApproved}
                    offerState={offerStateMap[p.id]}
                    onOfferChanged={refreshOffers}
                    onEdit={() => setEditProdus(p)}
                  />
                )}
              />
            }
            detail={
              <DesktopInspectorPanel
                title="Detalii produs"
                description={
                  desktopSelectedProdus
                    ? desktopSelectedProdus.id.slice(0, 8)
                    : undefined
                }
                footer={
                  desktopSelectedProdus ? (
                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        className="agri-cta"
                        onClick={() => setEditProdus(desktopSelectedProdus)}
                      >
                        Editează
                      </Button>
                      <Button
                        type="button"
                        variant="destructive"
                        className="agri-cta"
                        onClick={() => setDeleteProdusItem(desktopSelectedProdus)}
                      >
                        Șterge
                      </Button>
                    </div>
                  ) : null
                }
              >
                {desktopSelectedProdus ? (
                  <>
                    <DesktopInspectorSection label="Nume / categorie">
                      <p className="text-base font-semibold text-[var(--text-primary)]">{desktopSelectedProdus.nume}</p>
                      <p>
                        <span className="text-[var(--text-tertiary)]">Categorie: </span>
                        {CATEGORIE_LABELS[desktopSelectedProdus.categorie]}
                      </p>
                    </DesktopInspectorSection>
                    <DesktopInspectorSection label="Comercial">
                      <p>
                        <span className="text-[var(--text-tertiary)]">Preț: </span>
                        <span className="font-semibold text-[var(--text-primary)]">{formatPret(desktopSelectedProdus)}</span>
                        <span className="text-[var(--text-tertiary)]"> / {desktopSelectedProdus.unitate_vanzare}</span>
                      </p>
                      {desktopSelectedProdus.gramaj_per_unitate != null ? (
                        <p>
                          <span className="text-[var(--text-tertiary)]">Gramaj / unitate: </span>
                          {Number(desktopSelectedProdus.gramaj_per_unitate)} g
                        </p>
                      ) : null}
                    </DesktopInspectorSection>
                    <DesktopInspectorSection label="Status">
                      <StatusBadge
                        text={desktopSelectedProdus.status === 'activ' ? 'Activ' : 'Inactiv'}
                        variant={desktopSelectedProdus.status === 'activ' ? 'success' : 'neutral'}
                      />
                    </DesktopInspectorSection>
                    {associationShopApproved ? (
                      <DesktopInspectorSection label="Asociație (Gustă din Bucovina)">
                        <ProductAssociationOfferBlock
                          productId={desktopSelectedProdus.id}
                          productName={desktopSelectedProdus.nume}
                          pretUnitar={desktopSelectedProdus.pret_unitar}
                          moneda={desktopSelectedProdus.moneda || 'RON'}
                          unitate={desktopSelectedProdus.unitate_vanzare}
                          status={desktopSelectedProdus.status}
                          associationShopApproved={associationShopApproved}
                          offerState={offerStateMap[desktopSelectedProdus.id]}
                          onChanged={refreshOffers}
                        />
                      </DesktopInspectorSection>
                    ) : null}
                    {desktopSelectedProdus.descriere ? (
                      <DesktopInspectorSection label="Descriere">
                        <p className="whitespace-pre-wrap text-[var(--text-primary)]">{desktopSelectedProdus.descriere}</p>
                      </DesktopInspectorSection>
                    ) : null}
                    {(desktopSelectedProdus.poza_1_url || desktopSelectedProdus.poza_2_url) ? (
                      <DesktopInspectorSection label="Imagini">
                        <div className="flex gap-2">
                          {desktopSelectedProdus.poza_1_url ? (
                            <div className="relative h-20 w-20 overflow-hidden rounded-lg border border-[var(--divider)]">
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img src={desktopSelectedProdus.poza_1_url} alt="" className="h-full w-full object-cover" />
                            </div>
                          ) : null}
                          {desktopSelectedProdus.poza_2_url ? (
                            <div className="relative h-20 w-20 overflow-hidden rounded-lg border border-[var(--divider)]">
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img src={desktopSelectedProdus.poza_2_url} alt="" className="h-full w-full object-cover" />
                            </div>
                          ) : null}
                        </div>
                      </DesktopInspectorSection>
                    ) : null}
                  </>
                ) : (
                  <p className="text-sm text-[var(--text-tertiary)]">Selectează un produs din listă.</p>
                )}
              </DesktopInspectorPanel>
            }
          />
        ) : null}
      </DashboardContentShell>

      <AddProdusDialog open={addOpen} onOpenChange={setAddOpen} onSuccess={handleSuccess} />

      <EditProdusDialog
        produs={editProdus}
        open={editProdus !== null}
        onOpenChange={(open) => {
          if (!open) setEditProdus(null)
        }}
        onSuccess={handleSuccess}
      />

      <ConfirmDeleteDialog
        open={deleteProdusItem !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteProdusItem(null)
        }}
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
  associationShopApproved: boolean
  offerState: ProductOfferUiState
  onOfferChanged: () => void
  onEdit: () => void
}

function ProdusCard({
  produs,
  associationShopApproved,
  offerState,
  onOfferChanged,
  onEdit,
}: ProdusCardProps) {
  const title = produs.nume || 'Produs'
  const subtitle = produs.categorie ? (CATEGORIE_LABELS[produs.categorie] ?? produs.categorie) : 'Categorie nedefinită'
  const pretValue = produs.pret_unitar != null ? `${produs.pret_unitar.toFixed(2)} ${produs.moneda}/${produs.unitate_vanzare}` : undefined
  const meta = produs.descriere ? `${produs.descriere.slice(0, 64)}${produs.descriere.length > 64 ? '…' : ''}` : undefined
  const statusLabel = produs.status === 'inactiv' ? 'Inactiv' : 'Activ'
  const statusTone = produs.status === 'inactiv' ? 'neutral' : 'success'

  return (
    <MobileEntityCard
      title={title}
      mainValue={pretValue || 'Preț indisponibil'}
      subtitle={subtitle}
      secondaryValue={produs.unitate_vanzare || undefined}
      meta={meta}
      statusLabel={statusLabel}
      statusTone={statusTone}
      showChevron
      onClick={onEdit}
      bottomSlot={
        associationShopApproved ? (
          <ProductAssociationOfferBlock
            variant="inline"
            productId={produs.id}
            productName={produs.nume}
            pretUnitar={produs.pret_unitar}
            moneda={produs.moneda || 'RON'}
            unitate={produs.unitate_vanzare}
            status={produs.status}
            associationShopApproved={associationShopApproved}
            offerState={offerState}
            onChanged={onOfferChanged}
          />
        ) : null
      }
    />
  )
}
