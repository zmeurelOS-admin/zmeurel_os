'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import type { ColumnDef } from '@tanstack/react-table'
import { ExternalLink } from 'lucide-react'
import { useRouter, useSearchParams } from 'next/navigation'

import { AppShell } from '@/components/app/AppShell'
import { PageHeader } from '@/components/app/PageHeader'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { MobileEntityCard } from '@/components/ui/MobileEntityCard'
import { ResponsiveDataView } from '@/components/ui/ResponsiveDataView'
import { SearchField } from '@/components/ui/SearchField'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import { useMediaQuery } from '@/hooks/useMediaQuery'
import {
  type AssociationFoodType,
  type AssociationProducer,
  type AssociationProduct,
} from '@/lib/association/queries'
import { associationShopProdusePath } from '@/lib/shop/association-routes'
import {
  ASSOCIATION_CATEGORY_LABELS,
  type AssociationCategoryKey,
  resolveAssociationCategory,
} from '@/components/shop/association/tokens'
import {
  CATEGORII_PRODUSE,
  UNITATI_VANZARE,
  type CategorieProdus,
} from '@/lib/supabase/queries/produse'
import { toast } from '@/lib/ui/toast'
import { cn } from '@/lib/utils'

const CATEGORIE_LABELS: Record<CategorieProdus, string> = {
  fruct: 'Fruct',
  leguma: 'Legumă',
  procesat: 'Procesat',
  altele: 'Altele',
}

const CATEGORIE_EMOJI: Record<CategorieProdus, string> = {
  fruct: '🍓',
  leguma: '🥬',
  procesat: '🥫',
  altele: '📦',
}

const FILTER_TABS = [
  { id: 'all' as const, label: 'Toate' },
  { id: 'listate' as const, label: 'Listate' },
  { id: 'nelistate' as const, label: 'Nelistate' },
  { id: 'inactive' as const, label: 'Inactive' },
]

const FOOD_TYPE_LABELS: Record<AssociationFoodType, string> = {
  standard: 'Standard',
  bio: 'Bio',
  traditional: 'Tradițional',
  ecologic: 'Ecologic',
}

type ProductTab = 'pricing' | 'food'

type PatchBody = {
  productId: string
  association_listed?: boolean
  association_category?: AssociationCategoryKey | null
  association_price?: number | null
}

type FoodInfoDraft = {
  tip: AssociationFoodType
  ingrediente: string
  alergeni: string
  pastrare: string
  valabilitate: string
}

type AddProductDraft = {
  tenant_id: string
  nume: string
  categorie: CategorieProdus
  pret_unitar: string
  unitate_vanzare: string
  descriere: string
  association_price: string
  association_listed: boolean
}

type AddProductErrors = Partial<
  Record<'tenant_id' | 'nume' | 'categorie' | 'pret_unitar' | 'unitate_vanzare' | 'association_price', string>
>

function normalizeText(s: string) {
  return s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
}

function formatLei(n: number | null | undefined) {
  if (n == null) return '—'
  return `${Number(n).toFixed(2)} RON`
}

function parseLeiInput(raw: string): number | null {
  const t = raw.trim().replace(/\s/g, '').replace(',', '.')
  if (t === '') return null
  const n = Number(t)
  if (!Number.isFinite(n) || n < 0) return null
  return Math.round(n * 100) / 100
}

function listingStatusLabel(p: AssociationProduct): { text: string; tone: 'success' | 'neutral' | 'danger' } {
  if (p.status === 'inactiv') return { text: 'Inactiv', tone: 'danger' }
  if (p.association_listed) return { text: 'Listat', tone: 'success' }
  return { text: 'Nelistat', tone: 'neutral' }
}

function normalizeFoodType(value: string | null | undefined): AssociationFoodType {
  if (value === 'bio' || value === 'traditional' || value === 'ecologic') return value
  return 'standard'
}

function buildFoodDraft(product: AssociationProduct | null): FoodInfoDraft {
  return {
    tip: normalizeFoodType(product?.assoc_tip_produs ?? product?.tip_produs),
    ingrediente: product?.assoc_ingrediente ?? product?.ingrediente ?? '',
    alergeni: product?.assoc_alergeni ?? product?.alergeni ?? '',
    pastrare: product?.assoc_pastrare ?? product?.conditii_pastrare ?? '',
    valabilitate: product?.assoc_valabilitate ?? product?.termen_valabilitate ?? '',
  }
}

function buildDefaultAddDraft(): AddProductDraft {
  return {
    tenant_id: '',
    nume: '',
    categorie: 'fruct',
    pret_unitar: '',
    unitate_vanzare: 'kg',
    descriere: '',
    association_price: '',
    association_listed: false,
  }
}

function validateAddDraft(draft: AddProductDraft): AddProductErrors {
  const errors: AddProductErrors = {}

  if (!draft.tenant_id.trim()) errors.tenant_id = 'Selectează fermierul.'
  if (!draft.nume.trim()) errors.nume = 'Introdu numele produsului.'
  if (!draft.categorie) errors.categorie = 'Selectează categoria.'

  const pret = parseLeiInput(draft.pret_unitar)
  if (!draft.pret_unitar.trim()) {
    errors.pret_unitar = 'Introdu prețul.'
  } else if (pret == null || pret <= 0) {
    errors.pret_unitar = 'Introdu un preț pozitiv.'
  }

  if (!draft.unitate_vanzare.trim()) errors.unitate_vanzare = 'Selectează unitatea de măsură.'

  if (draft.association_price.trim()) {
    const override = parseLeiInput(draft.association_price)
    if (override == null || override <= 0) {
      errors.association_price = 'Introdu un preț asociație valid.'
    }
  }

  return errors
}

function ListedToggle({
  checked,
  disabled,
  busy,
  onToggle,
}: {
  checked: boolean
  disabled: boolean
  busy: boolean
  onToggle: () => void
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-busy={busy}
      disabled={disabled || busy}
      onClick={onToggle}
      className={cn(
        'relative h-8 w-14 shrink-0 rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] focus-visible:ring-offset-2',
        checked ? 'bg-[var(--agri-primary)]' : 'bg-[var(--surface-card-muted)]',
        disabled && 'cursor-not-allowed opacity-60'
      )}
    >
      <span
        className={cn(
          'absolute left-1 top-1 h-6 w-6 rounded-full bg-white shadow-md transition-transform duration-200',
          checked && 'translate-x-6'
        )}
      />
    </button>
  )
}

async function patchAssociationProduct(body: PatchBody): Promise<AssociationProduct> {
  const res = await fetch('/api/association/products', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const json = (await res.json().catch(() => null)) as
    | { ok?: boolean; data?: AssociationProduct; error?: { message?: string } }
    | null
  if (!res.ok || !json?.ok || !json.data) {
    const msg = json && typeof json === 'object' && 'error' in json && json.error?.message
    throw new Error(typeof msg === 'string' ? msg : 'Actualizare eșuată.')
  }
  return json.data
}

async function patchAssociationFoodInfo(
  productId: string,
  body: {
    assoc_ingrediente: string | null
    assoc_alergeni: string | null
    assoc_pastrare: string | null
    assoc_valabilitate: string | null
    assoc_tip_produs: AssociationFoodType | null
  },
): Promise<{
  assoc_ingrediente: string | null
  assoc_alergeni: string | null
  assoc_pastrare: string | null
  assoc_valabilitate: string | null
  assoc_tip_produs: AssociationFoodType | null
}> {
  const res = await fetch(`/api/association/products/${productId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const json = (await res.json().catch(() => null)) as
    | {
        ok?: boolean
        data?: {
          assoc_ingrediente: string | null
          assoc_alergeni: string | null
          assoc_pastrare: string | null
          assoc_valabilitate: string | null
          assoc_tip_produs: AssociationFoodType | null
        }
        error?: { message?: string }
      }
    | null
  if (!res.ok || !json?.ok || !json.data) {
    const msg = json && typeof json === 'object' && 'error' in json && json.error?.message
    throw new Error(typeof msg === 'string' ? msg : 'Nu am putut salva informațiile alimentare.')
  }
  return json.data
}

async function createAssociationProduct(body: {
  tenant_id: string
  nume: string
  categorie: CategorieProdus
  pret_unitar: number
  unitate_vanzare: string
  descriere?: string | null
  association_price?: number | null
  association_listed?: boolean
}): Promise<AssociationProduct> {
  const res = await fetch('/api/association/products/create', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const json = (await res.json().catch(() => null)) as
    | { ok?: boolean; data?: AssociationProduct; error?: { message?: string } }
    | null
  if (!res.ok || !json?.ok || !json.data) {
    const msg = json && typeof json === 'object' && 'error' in json && json.error?.message
    throw new Error(typeof msg === 'string' ? msg : 'Nu am putut crea produsul.')
  }
  return json.data
}

function FieldError({ message }: { message?: string }) {
  if (!message) return null
  return <p className="mt-1 text-xs text-[var(--status-danger-text)]">{message}</p>
}

export type AssociationProduseClientProps = {
  initialProducts: AssociationProduct[]
  initialProducers: AssociationProducer[]
  canManage: boolean
}

export function AssociationProduseClient({
  initialProducts,
  initialProducers,
  canManage,
}: AssociationProduseClientProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const isMobile = useMediaQuery('(max-width: 767px)')

  const [products, setProducts] = useState<AssociationProduct[]>(initialProducts)
  const [filterTab, setFilterTab] = useState<(typeof FILTER_TABS)[number]['id']>('all')
  const [search, setSearch] = useState('')
  const [filterCategorie, setFilterCategorie] = useState<'all' | CategorieProdus>('all')
  const [openProductId, setOpenProductId] = useState<string | null>(null)
  const [productTab, setProductTab] = useState<ProductTab>('pricing')
  const [toggleBusyId, setToggleBusyId] = useState<string | null>(null)
  const [priceBusy, setPriceBusy] = useState(false)
  const [priceDraft, setPriceDraft] = useState('')
  const [foodDraft, setFoodDraft] = useState<FoodInfoDraft>(() => buildFoodDraft(initialProducts[0] ?? null))
  const [savingFood, setSavingFood] = useState(false)
  const [removeConfirmOpen, setRemoveConfirmOpen] = useState(false)
  const [removingProduct, setRemovingProduct] = useState(false)
  const [addSheetOpen, setAddSheetOpen] = useState(false)
  const [addDraft, setAddDraft] = useState<AddProductDraft>(() => buildDefaultAddDraft())
  const [addErrors, setAddErrors] = useState<AddProductErrors>({})
  const [creatingProduct, setCreatingProduct] = useState(false)

  useEffect(() => {
    setProducts(initialProducts)
  }, [initialProducts])

  useEffect(() => {
    const f = searchParams.get('filter')
    if (f === 'nelistate') setFilterTab('nelistate')
  }, [searchParams])

  const producerFilterId = useMemo(() => {
    const raw = searchParams.get('producer')
    if (!raw) return null
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(raw) ? raw : null
  }, [searchParams])

  const filtered = useMemo(() => {
    return products.filter((p) => {
      if (producerFilterId && p.tenant_id !== producerFilterId) return false
      if (filterTab === 'listate') {
        if (p.status !== 'activ' || !p.association_listed) return false
      } else if (filterTab === 'nelistate') {
        if (p.status !== 'activ' || p.association_listed) return false
      } else if (filterTab === 'inactive') {
        if (p.status !== 'inactiv') return false
      }
      if (filterCategorie !== 'all' && p.categorie !== filterCategorie) return false
      if (search.trim()) {
        const q = normalizeText(search.trim())
        const farm = normalizeText(p.farmName ?? '')
        return normalizeText(p.nume).includes(q) || farm.includes(q)
      }
      return true
    })
  }, [products, filterTab, filterCategorie, search, producerFilterId])

  const openProduct = useMemo(
    () => (openProductId ? products.find((product) => product.id === openProductId) ?? null : null),
    [openProductId, products],
  )

  const approvedProducers = useMemo(
    () =>
      initialProducers
        .filter((producer) => producer.is_association_approved && producer.id.trim().length > 0)
        .sort((a, b) => a.nume_ferma.localeCompare(b.nume_ferma, 'ro')),
    [initialProducers],
  )

  useEffect(() => {
    if (!openProduct) return
    setPriceDraft(openProduct.association_price != null ? String(openProduct.association_price) : '')
    setFoodDraft(buildFoodDraft(openProduct))
  }, [openProduct])

  const mergeProduct = useCallback((updated: AssociationProduct) => {
    setProducts((prev) => prev.map((product) => (product.id === updated.id ? { ...product, ...updated } : product)))
  }, [])

  const refreshProducts = useCallback(() => {
    router.refresh()
  }, [router])

  const openProductSheet = useCallback((productId: string) => {
    setProductTab('pricing')
    setOpenProductId(productId)
  }, [])

  const closeProductSheet = useCallback(() => {
    setOpenProductId(null)
    setProductTab('pricing')
    setRemoveConfirmOpen(false)
  }, [])

  const resetAddForm = useCallback(() => {
    setAddDraft(buildDefaultAddDraft())
    setAddErrors({})
  }, [])

  const isPriceDirty = useCallback(
    (product: AssociationProduct) => {
      const parsed = parseLeiInput(priceDraft)
      const current = product.association_price
      if (priceDraft.trim() === '' && current == null) return false
      if (priceDraft.trim() === '' && current != null) return true
      if (parsed == null && current != null) return true
      if (parsed != null && current == null) return true
      if (parsed != null && current != null) return Math.abs(parsed - Number(current)) > 0.001
      return false
    },
    [priceDraft],
  )

  const handleToggleListed = useCallback(
    async (product: AssociationProduct, next: boolean) => {
      if (!canManage || product.status === 'inactiv' || !product.tenantIsAssociationApproved) return
      const prevListed = product.association_listed
      const fallbackCategory =
        next && !(product.association_category ?? '').trim()
          ? resolveAssociationCategory(product.association_category, product.categorie)
          : undefined

      mergeProduct({
        ...product,
        association_listed: next,
        association_category: fallbackCategory ?? product.association_category,
      })
      setToggleBusyId(product.id)
      try {
        const data = await patchAssociationProduct({
          productId: product.id,
          association_listed: next,
          association_category: fallbackCategory,
        })
        mergeProduct(data)
        toast.success(next ? 'Produs listat în magazin.' : 'Produs retras din magazin.')
        refreshProducts()
      } catch (error) {
        mergeProduct({ ...product, association_listed: prevListed })
        toast.error(error instanceof Error ? error.message : 'Nu am putut actualiza listarea.')
      } finally {
        setToggleBusyId(null)
      }
    },
    [canManage, mergeProduct, refreshProducts],
  )

  const handleSavePrice = useCallback(
    async (product: AssociationProduct) => {
      if (!canManage || !product.tenantIsAssociationApproved) return
      const parsed = priceDraft.trim() === '' ? null : parseLeiInput(priceDraft)
      if (priceDraft.trim() !== '' && (parsed == null || parsed <= 0)) {
        toast.error('Introdu un preț valid.')
        return
      }

      setPriceBusy(true)
      try {
        const data = await patchAssociationProduct({
          productId: product.id,
          association_price: parsed,
        })
        mergeProduct(data)
        toast.success('Prețul a fost salvat.')
        refreshProducts()
      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'Nu am putut salva prețul.')
      } finally {
        setPriceBusy(false)
      }
    },
    [canManage, mergeProduct, priceDraft, refreshProducts],
  )

  const handleSaveFoodInfo = useCallback(
    async (product: AssociationProduct) => {
      if (!canManage || !product.tenantIsAssociationApproved) return
      setSavingFood(true)
      try {
        const saved = await patchAssociationFoodInfo(product.id, {
          assoc_ingrediente: foodDraft.ingrediente.trim() || null,
          assoc_alergeni: foodDraft.alergeni.trim() || null,
          assoc_pastrare: foodDraft.pastrare.trim() || null,
          assoc_valabilitate: foodDraft.valabilitate.trim() || null,
          assoc_tip_produs: foodDraft.tip,
        })
        mergeProduct({
          ...product,
          ...saved,
        })
        toast.success('Informațiile alimentare au fost salvate.')
        refreshProducts()
      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'Nu am putut salva informațiile alimentare.')
      } finally {
        setSavingFood(false)
      }
    },
    [canManage, foodDraft, mergeProduct, refreshProducts],
  )

  const handleRemoveFromCatalog = useCallback(async () => {
    if (!openProduct || !canManage) return
    setRemovingProduct(true)
    try {
      const updated = await patchAssociationProduct({
        productId: openProduct.id,
        association_listed: false,
        association_price: null,
      })
      mergeProduct(updated)
      closeProductSheet()
      toast.success('Produs eliminat din catalog.')
      refreshProducts()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Nu am putut elimina produsul din catalog.')
    } finally {
      setRemovingProduct(false)
    }
  }, [canManage, closeProductSheet, mergeProduct, openProduct, refreshProducts])

  const handleAddDraftChange = useCallback(
    <K extends keyof AddProductDraft>(field: K, value: AddProductDraft[K]) => {
      setAddDraft((prev) => ({ ...prev, [field]: value }))
      setAddErrors((prev) => ({ ...prev, [field]: undefined }))
    },
    [],
  )

  const handleCreateProduct = useCallback(async () => {
    const errors = validateAddDraft(addDraft)
    setAddErrors(errors)
    if (Object.keys(errors).length > 0) return

    const pret = parseLeiInput(addDraft.pret_unitar)
    const associationPrice = addDraft.association_price.trim()
      ? parseLeiInput(addDraft.association_price)
      : null

    if (pret == null || pret <= 0) {
      setAddErrors((prev) => ({ ...prev, pret_unitar: 'Introdu un preț pozitiv.' }))
      return
    }

    if (addDraft.association_price.trim() && (associationPrice == null || associationPrice <= 0)) {
      setAddErrors((prev) => ({ ...prev, association_price: 'Introdu un preț asociație valid.' }))
      return
    }

    setCreatingProduct(true)
    try {
      const created = await createAssociationProduct({
        tenant_id: addDraft.tenant_id,
        nume: addDraft.nume.trim(),
        categorie: addDraft.categorie,
        pret_unitar: pret,
        unitate_vanzare: addDraft.unitate_vanzare,
        descriere: addDraft.descriere.trim() || null,
        association_price: associationPrice,
        association_listed: addDraft.association_listed,
      })
      setProducts((prev) => [created, ...prev.filter((product) => product.id !== created.id)])
      setAddSheetOpen(false)
      resetAddForm()
      toast.success('Produsul a fost adăugat.')
      refreshProducts()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Nu am putut crea produsul.')
    } finally {
      setCreatingProduct(false)
    }
  }, [addDraft, refreshProducts, resetAddForm])

  const desktopColumns = useMemo<ColumnDef<AssociationProduct>[]>(
    () => [
      {
        accessorKey: 'nume',
        header: 'Produs',
        cell: ({ row }) => {
          const category = row.original.categorie as CategorieProdus
          const emoji = CATEGORIE_EMOJI[category] ?? '📦'
          return (
            <div className="flex items-center gap-3">
              <span
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[var(--surface-card-muted)] text-lg"
                aria-hidden
              >
                {emoji}
              </span>
              <span className="font-semibold text-[var(--text-primary)]">{row.original.nume}</span>
            </div>
          )
        },
      },
      {
        id: 'farm',
        accessorFn: (row) => row.farmName ?? '',
        header: 'Producător',
        cell: ({ row }) => row.original.farmName ?? '—',
      },
      {
        accessorKey: 'categorie',
        header: 'Categorie ERP',
        cell: ({ row }) => CATEGORIE_LABELS[row.original.categorie as CategorieProdus] ?? row.original.categorie,
      },
      {
        id: 'pret',
        accessorFn: (row) => row.pret_unitar ?? -1,
        header: 'Preț fermier',
        meta: { numeric: true },
        cell: ({ row }) => formatLei(row.original.pret_unitar),
      },
      {
        id: 'pret_asoc',
        accessorFn: (row) => row.association_price ?? -1,
        header: 'Preț asociație',
        meta: { numeric: true },
        cell: ({ row }) => (row.original.association_price != null ? formatLei(row.original.association_price) : '—'),
      },
      {
        id: 'status_mag',
        header: 'Status',
        enableSorting: false,
        cell: ({ row }) => {
          const status = listingStatusLabel(row.original)
          const classes =
            status.tone === 'success'
              ? 'border-[var(--status-success-border)] bg-[var(--status-success-bg)] text-[var(--status-success-text)]'
              : status.tone === 'danger'
                ? 'border-[var(--status-danger-border)] bg-[var(--status-danger-bg)] text-[var(--status-danger-text)]'
                : 'border-[var(--status-neutral-border)] bg-[var(--status-neutral-bg)] text-[var(--status-neutral-text)]'

          return (
            <span className={cn('inline-flex rounded-lg border px-2 py-0.5 text-[10px] font-bold', classes)}>
              {status.text}
            </span>
          )
        },
      },
    ],
    [],
  )

  return (
    <AppShell
      header={
        <PageHeader
          title="Produse"
          subtitle="Catalog asociație — fermieri aprobați"
          rightSlot={
            canManage ? (
              <Button size="sm" type="button" onClick={() => setAddSheetOpen(true)}>
                + Adaugă produs
              </Button>
            ) : null
          }
          expandRightSlotOnMobile
          stackMobileRightSlotBelowTitle
        />
      }
    >
      <div className="mx-auto w-full max-w-7xl space-y-4 py-3">
        {!canManage ? (
          <p className="rounded-xl border border-[var(--border-default)] bg-[var(--surface-card-muted)] px-3 py-2 text-sm text-[var(--text-secondary)]">
            Poți vedea catalogul; doar administratorii și moderatorii pot modifica listarea și prețul pentru asociație.
          </p>
        ) : null}

        <div className="flex flex-wrap gap-2 md:hidden">
          {FILTER_TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setFilterTab(tab.id)}
              className={cn(
                'h-9 rounded-full px-3 text-xs font-semibold transition',
                filterTab === tab.id
                  ? 'bg-[var(--agri-primary)] text-white'
                  : 'border border-[var(--border-default)] bg-[var(--surface-card)] text-[var(--text-secondary)]'
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="md:hidden">
          <SearchField
            placeholder="Caută produs sau fermă..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            aria-label="Căutare catalog"
          />
        </div>

        <div className="flex flex-wrap gap-2 md:hidden">
          <button
            type="button"
            onClick={() => setFilterCategorie('all')}
            className={cn(
              'h-8 rounded-full px-3 text-xs font-semibold',
              filterCategorie === 'all'
                ? 'bg-[var(--brand-blue)] text-white'
                : 'border border-[var(--border-default)] bg-[var(--surface-card-muted)]'
            )}
          >
            Toate categoriile
          </button>
          {CATEGORII_PRODUSE.map((category) => (
            <button
              key={category}
              type="button"
              onClick={() => setFilterCategorie(category)}
              className={cn(
                'h-8 rounded-full px-3 text-xs font-semibold',
                filterCategorie === category
                  ? 'bg-[var(--brand-blue)] text-white'
                  : 'border border-[var(--border-default)] bg-[var(--surface-card-muted)]'
              )}
            >
              {CATEGORIE_LABELS[category]}
            </button>
          ))}
        </div>

        <div className="hidden rounded-[22px] border border-[var(--border-default)] bg-[var(--surface-card)] p-3 shadow-sm md:block">
          <div className="flex flex-wrap items-center gap-2">
            {FILTER_TABS.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setFilterTab(tab.id)}
                className={cn(
                  'h-9 rounded-full px-3 text-xs font-semibold transition',
                  filterTab === tab.id
                    ? 'bg-[var(--agri-primary)] text-white'
                    : 'border border-[var(--border-default)] bg-[var(--surface-card)] text-[var(--text-secondary)]'
                )}
              >
                {tab.label}
              </button>
            ))}

            <SearchField
              containerClassName="ml-auto w-full max-w-sm min-w-[180px]"
              placeholder="Produs sau producător..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              aria-label="Căutare desktop"
            />

            <label htmlFor="assoc_prod_cat" className="sr-only">
              Categorie
            </label>
            <select
              id="assoc_prod_cat"
              value={filterCategorie}
              onChange={(event) => setFilterCategorie(event.target.value as 'all' | CategorieProdus)}
              className="agri-control h-9 min-w-[10rem] rounded-xl px-2 text-sm"
            >
              <option value="all">Toate categoriile</option>
              {CATEGORII_PRODUSE.map((category) => (
                <option key={category} value={category}>
                  {CATEGORIE_LABELS[category]}
                </option>
              ))}
            </select>

            <span className="text-sm text-[var(--text-secondary)]">
              <strong className="text-[var(--text-primary)]">{filtered.length}</strong> în filtru
            </span>
          </div>
        </div>

        <ResponsiveDataView
          columns={desktopColumns}
          data={filtered}
          getRowId={(row) => row.id}
          skipDesktopDataFilter
          hideDesktopSearchRow
          mobileContainerClassName="grid-cols-1 gap-2"
          emptyMessage="Niciun produs în acest filtru."
          onDesktopRowClick={(row) => openProductSheet(row.id)}
          isDesktopRowSelected={(row) => openProductId === row.id}
          renderCard={(item) => {
            const status = listingStatusLabel(item)
            const tone = status.tone === 'success' ? 'success' : status.tone === 'danger' ? 'danger' : 'neutral'
            const emoji = CATEGORIE_EMOJI[item.categorie as CategorieProdus] ?? '📦'

            return (
              <MobileEntityCard
                title={item.nume}
                subtitle={item.farmName ?? ''}
                icon={<span aria-hidden>{emoji}</span>}
                mainValue={formatLei(item.association_price ?? item.pret_unitar)}
                secondaryValue={item.association_price != null ? 'Preț asociație' : 'Preț fermier'}
                statusLabel={status.text}
                statusTone={tone}
                interactive
                showChevron
                onClick={() => openProductSheet(item.id)}
                ariaLabel={`Produs ${item.nume}`}
              />
            )
          }}
        />
      </div>

      <Sheet
        open={openProduct != null}
        onOpenChange={(open) => {
          if (!open) closeProductSheet()
        }}
      >
        <SheetContent
          side={isMobile ? 'bottom' : 'right'}
          className={cn('overflow-y-auto', isMobile ? 'max-h-[92dvh]' : 'w-full md:max-w-[760px]')}
        >
          <SheetHeader>
            <SheetTitle>{openProduct?.nume ?? 'Produs'}</SheetTitle>
            <SheetDescription>
              {openProduct
                ? `${openProduct.farmName ?? 'Fermier'} · ${CATEGORIE_LABELS[openProduct.categorie as CategorieProdus]}`
                : ''}
            </SheetDescription>
          </SheetHeader>

          {openProduct ? (
            <div className="px-4 pb-4 sm:px-5">
              {!openProduct.tenantIsAssociationApproved ? (
                <p className="mb-4 rounded-xl border border-[var(--border-default)] bg-[var(--surface-card-muted)] px-3 py-2 text-sm text-[var(--text-secondary)]">
                  Ferma este suspendată în asociație. Reactivează fermierul înainte să modifici listarea produsului.
                </p>
              ) : null}

              <Tabs value={productTab} onValueChange={(value) => setProductTab(value as ProductTab)}>
                <TabsList className="grid h-auto w-full grid-cols-2 rounded-2xl bg-[var(--agri-surface-muted)] p-1">
                  <TabsTrigger value="pricing" className="rounded-xl text-sm">
                    Preț & Vizibilitate
                  </TabsTrigger>
                  <TabsTrigger value="food" className="rounded-xl text-sm">
                    Informații alimentare
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="pricing" className="mt-4 space-y-5">
                  <div className="rounded-2xl border border-[var(--border-default)] bg-[var(--surface-card)] p-4">
                    <p className="text-sm text-[var(--text-secondary)]">Preț fermier</p>
                    <p className="mt-1 text-lg font-semibold text-[var(--text-primary)]">
                      {formatLei(openProduct.pret_unitar)}
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor={`association-price-${openProduct.id}`}>Preț asociație</Label>
                    <Input
                      id={`association-price-${openProduct.id}`}
                      type="text"
                      inputMode="decimal"
                      value={priceDraft}
                      onChange={(event) => setPriceDraft(event.target.value)}
                      placeholder="Folosește prețul fermierului"
                      disabled={!canManage || !openProduct.tenantIsAssociationApproved || priceBusy}
                    />
                    <p className="text-xs text-[var(--text-secondary)]">
                      Lasă câmpul gol dacă vrei să păstrezi prețul fermierului.
                    </p>
                    <Button
                      type="button"
                      disabled={!canManage || !openProduct.tenantIsAssociationApproved || !isPriceDirty(openProduct) || priceBusy}
                      onClick={() => void handleSavePrice(openProduct)}
                    >
                      {priceBusy ? 'Se salvează...' : 'Salvează prețul'}
                    </Button>
                  </div>

                  <div className="rounded-2xl border border-[var(--border-default)] bg-[var(--surface-card)] p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="space-y-1">
                        <p className="font-semibold text-[var(--text-primary)]">Listat în magazin</p>
                        <p className="text-sm leading-relaxed text-[var(--text-secondary)]">
                          Produsul poate apărea în magazinul public al asociației dacă rămâne activ și fermierul este aprobat.
                        </p>
                      </div>
                      <ListedToggle
                        checked={openProduct.association_listed}
                        disabled={!canManage || !openProduct.tenantIsAssociationApproved || openProduct.status === 'inactiv'}
                        busy={toggleBusyId === openProduct.id}
                        onToggle={() => void handleToggleListed(openProduct, !openProduct.association_listed)}
                      />
                    </div>
                  </div>

                  <div className="rounded-2xl border border-[var(--border-default)] bg-[var(--surface-card)] p-4">
                    <p className="text-sm text-[var(--text-secondary)]">Categorie magazin</p>
                    <p className="mt-1 font-medium text-[var(--text-primary)]">
                      {
                        ASSOCIATION_CATEGORY_LABELS[
                          resolveAssociationCategory(openProduct.association_category, openProduct.categorie)
                        ]
                      }
                    </p>
                  </div>

                  <Button type="button" variant="outline" className="w-full gap-2" asChild>
                    <a
                      href={associationShopProdusePath({ produs: openProduct.id })}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <ExternalLink className="h-4 w-4" aria-hidden />
                      Vezi în magazin
                    </a>
                  </Button>
                </TabsContent>

                <TabsContent value="food" className="mt-4 space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor={`food-tip-${openProduct.id}`}>Tip</Label>
                    <select
                      id={`food-tip-${openProduct.id}`}
                      value={foodDraft.tip}
                      onChange={(event) =>
                        setFoodDraft((prev) => ({ ...prev, tip: event.target.value as AssociationFoodType }))
                      }
                      disabled={!canManage || !openProduct.tenantIsAssociationApproved || savingFood}
                      className="agri-control h-10 w-full rounded-xl px-3 text-sm"
                    >
                      {Object.entries(FOOD_TYPE_LABELS).map(([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor={`food-ingrediente-${openProduct.id}`}>Ingrediente</Label>
                    <Textarea
                      id={`food-ingrediente-${openProduct.id}`}
                      value={foodDraft.ingrediente}
                      onChange={(event) => setFoodDraft((prev) => ({ ...prev, ingrediente: event.target.value }))}
                      disabled={!canManage || !openProduct.tenantIsAssociationApproved || savingFood}
                      placeholder="Ex: zmeură 100% naturală, fără aditivi"
                      rows={4}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor={`food-alergeni-${openProduct.id}`}>Alergeni</Label>
                    <Textarea
                      id={`food-alergeni-${openProduct.id}`}
                      value={foodDraft.alergeni}
                      onChange={(event) => setFoodDraft((prev) => ({ ...prev, alergeni: event.target.value }))}
                      disabled={!canManage || !openProduct.tenantIsAssociationApproved || savingFood}
                      placeholder="Ex: poate conține urme de nuci"
                      rows={3}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor={`food-pastrare-${openProduct.id}`}>Păstrare</Label>
                    <Input
                      id={`food-pastrare-${openProduct.id}`}
                      value={foodDraft.pastrare}
                      onChange={(event) => setFoodDraft((prev) => ({ ...prev, pastrare: event.target.value }))}
                      disabled={!canManage || !openProduct.tenantIsAssociationApproved || savingFood}
                      placeholder="Ex: la frigider, 2-4°C"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor={`food-valabilitate-${openProduct.id}`}>Valabilitate</Label>
                    <Input
                      id={`food-valabilitate-${openProduct.id}`}
                      value={foodDraft.valabilitate}
                      onChange={(event) => setFoodDraft((prev) => ({ ...prev, valabilitate: event.target.value }))}
                      disabled={!canManage || !openProduct.tenantIsAssociationApproved || savingFood}
                      placeholder="Ex: 5 zile de la recoltare"
                    />
                  </div>

                  <Button
                    type="button"
                    disabled={!canManage || !openProduct.tenantIsAssociationApproved || savingFood}
                    onClick={() => void handleSaveFoodInfo(openProduct)}
                  >
                    {savingFood ? 'Se salvează...' : 'Salvează informații'}
                  </Button>
                </TabsContent>
              </Tabs>
            </div>
          ) : null}

          {openProduct && canManage ? (
            <SheetFooter className="justify-end">
              <Button type="button" variant="destructive" onClick={() => setRemoveConfirmOpen(true)}>
                Elimină din catalog
              </Button>
            </SheetFooter>
          ) : null}
        </SheetContent>
      </Sheet>

      <Sheet
        open={addSheetOpen}
        onOpenChange={(open) => {
          setAddSheetOpen(open)
          if (!open) resetAddForm()
        }}
      >
        <SheetContent
          side={isMobile ? 'bottom' : 'right'}
          className={cn('overflow-y-auto', isMobile ? 'max-h-[92dvh]' : 'w-full md:max-w-[760px]')}
        >
          <SheetHeader>
            <SheetTitle>Adaugă produs</SheetTitle>
            <SheetDescription>Produs nou pentru catalogul asociației</SheetDescription>
          </SheetHeader>

          <div className="space-y-4 px-4 pb-4 sm:px-5">
            <div className="space-y-2">
              <Label htmlFor="add-product-tenant">Fermier</Label>
              <select
                id="add-product-tenant"
                value={addDraft.tenant_id}
                onChange={(event) => handleAddDraftChange('tenant_id', event.target.value)}
                className="agri-control h-10 w-full rounded-xl px-3 text-sm"
                aria-invalid={Boolean(addErrors.tenant_id)}
              >
                <option value="">Selectează fermierul</option>
                {approvedProducers.map((producer) => (
                  <option key={producer.id} value={producer.id}>
                    {producer.nume_ferma}
                  </option>
                ))}
              </select>
              <FieldError message={addErrors.tenant_id} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="add-product-name">Nume produs</Label>
              <Input
                id="add-product-name"
                value={addDraft.nume}
                onChange={(event) => handleAddDraftChange('nume', event.target.value)}
                placeholder="Ex: Dulceață de zmeură"
                aria-invalid={Boolean(addErrors.nume)}
              />
              <FieldError message={addErrors.nume} />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="add-product-category">Categorie ERP</Label>
                <select
                  id="add-product-category"
                  value={addDraft.categorie}
                  onChange={(event) => handleAddDraftChange('categorie', event.target.value as CategorieProdus)}
                  className="agri-control h-10 w-full rounded-xl px-3 text-sm"
                  aria-invalid={Boolean(addErrors.categorie)}
                >
                  {CATEGORII_PRODUSE.map((category) => (
                    <option key={category} value={category}>
                      {CATEGORIE_LABELS[category]}
                    </option>
                  ))}
                </select>
                <FieldError message={addErrors.categorie} />
              </div>

              <div className="space-y-2">
                <Label htmlFor="add-product-unit">Unitate de măsură</Label>
                <select
                  id="add-product-unit"
                  value={addDraft.unitate_vanzare}
                  onChange={(event) => handleAddDraftChange('unitate_vanzare', event.target.value)}
                  className="agri-control h-10 w-full rounded-xl px-3 text-sm"
                  aria-invalid={Boolean(addErrors.unitate_vanzare)}
                >
                  {UNITATI_VANZARE.map((unit) => (
                    <option key={unit} value={unit}>
                      {unit}
                    </option>
                  ))}
                </select>
                <FieldError message={addErrors.unitate_vanzare} />
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="add-product-price">Preț (RON)</Label>
                <Input
                  id="add-product-price"
                  type="text"
                  inputMode="decimal"
                  value={addDraft.pret_unitar}
                  onChange={(event) => handleAddDraftChange('pret_unitar', event.target.value)}
                  placeholder="Ex: 18,50"
                  aria-invalid={Boolean(addErrors.pret_unitar)}
                />
                <FieldError message={addErrors.pret_unitar} />
              </div>

              <div className="space-y-2">
                <Label htmlFor="add-product-association-price">Preț asociație</Label>
                <Input
                  id="add-product-association-price"
                  type="text"
                  inputMode="decimal"
                  value={addDraft.association_price}
                  onChange={(event) => handleAddDraftChange('association_price', event.target.value)}
                  placeholder="Opțional"
                  aria-invalid={Boolean(addErrors.association_price)}
                />
                <FieldError message={addErrors.association_price} />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="add-product-description">Descriere</Label>
              <Textarea
                id="add-product-description"
                value={addDraft.descriere}
                onChange={(event) => handleAddDraftChange('descriere', event.target.value)}
                placeholder="Descriere opțională pentru catalog"
                rows={4}
              />
            </div>

            <div className="rounded-2xl border border-[var(--border-default)] bg-[var(--surface-card)] p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1">
                  <p className="font-semibold text-[var(--text-primary)]">Listat în magazin de la început</p>
                  <p className="text-sm leading-relaxed text-[var(--text-secondary)]">
                    Dacă este activ, produsul va apărea imediat în magazinul public al asociației.
                  </p>
                </div>
                <ListedToggle
                  checked={addDraft.association_listed}
                  disabled={creatingProduct}
                  busy={false}
                  onToggle={() => handleAddDraftChange('association_listed', !addDraft.association_listed)}
                />
              </div>
            </div>
          </div>

          <SheetFooter className="justify-end">
            <Button type="button" variant="outline" onClick={() => setAddSheetOpen(false)}>
              Anulează
            </Button>
            <Button type="button" disabled={creatingProduct} onClick={() => void handleCreateProduct()}>
              {creatingProduct ? 'Se adaugă...' : 'Adaugă produs'}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      <AlertDialog open={removeConfirmOpen} onOpenChange={setRemoveConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Ești sigur?</AlertDialogTitle>
            <AlertDialogDescription>
              Produsul va fi scos din catalogul asociației și nu va mai apărea în magazin.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Anulează</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-white hover:bg-destructive/90"
              onClick={() => void handleRemoveFromCatalog()}
              disabled={removingProduct}
            >
              {removingProduct ? 'Se elimină...' : 'Confirmă'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppShell>
  )
}
