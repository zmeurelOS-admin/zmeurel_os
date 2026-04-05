'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import type { ColumnDef } from '@tanstack/react-table'
import { ExternalLink, Store } from 'lucide-react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'

import { AppShell } from '@/components/app/AppShell'
import { AppDrawer } from '@/components/app/AppDrawer'
import { PageHeader } from '@/components/app/PageHeader'
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
import { type AssociationFoodType, type AssociationProduct } from '@/lib/association/queries'
import { CATEGORII_PRODUSE, type CategorieProdus } from '@/lib/supabase/queries/produse'
import { toast } from '@/lib/ui/toast'
import { associationShopProdusePath } from '@/lib/shop/association-routes'
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
          'absolute top-1 left-1 h-6 w-6 rounded-full bg-white shadow-md transition-transform duration-200',
          checked && 'translate-x-6'
        )}
      />
    </button>
  )
}

type PatchBody = {
  productId: string
  association_listed?: boolean
  association_price?: number | null
}

type FoodInfoDraft = {
  tip: AssociationFoodType
  ingrediente: string
  alergeni: string
  pastrare: string
  valabilitate: string
}

const FOOD_TYPE_LABELS: Record<AssociationFoodType, string> = {
  standard: 'Standard',
  bio: 'Bio',
  traditional: 'Tradițional',
  ecologic: 'Ecologic',
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

export type AssociationProduseClientProps = {
  initialProducts: AssociationProduct[]
  canManage: boolean
}

export function AssociationProduseClient({ initialProducts, canManage }: AssociationProduseClientProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [products, setProducts] = useState<AssociationProduct[]>(initialProducts)
  const [filterTab, setFilterTab] = useState<(typeof FILTER_TABS)[number]['id']>('all')
  const [search, setSearch] = useState('')
  const [filterCategorie, setFilterCategorie] = useState<'all' | CategorieProdus>('all')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [mobileDetailId, setMobileDetailId] = useState<string | null>(null)
  const [toggleBusyId, setToggleBusyId] = useState<string | null>(null)
  const [priceBusy, setPriceBusy] = useState(false)
  const [priceDraft, setPriceDraft] = useState('')
  const [foodDraft, setFoodDraft] = useState<FoodInfoDraft>(() => buildFoodDraft(initialProducts[0] ?? null))
  const [savingFood, setSavingFood] = useState(false)

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

  const resolvedSelectedId = useMemo(() => {
    if (filtered.length === 0) return null
    if (selectedId && filtered.some((p) => p.id === selectedId)) return selectedId
    return filtered[0].id
  }, [filtered, selectedId])

  const selected = useMemo(
    () => (resolvedSelectedId ? filtered.find((p) => p.id === resolvedSelectedId) ?? null : null),
    [filtered, resolvedSelectedId]
  )

  const mobileDetail = useMemo(
    () => (mobileDetailId ? products.find((p) => p.id === mobileDetailId) ?? null : null),
    [products, mobileDetailId]
  )

  useEffect(() => {
    const p = selected
    if (!p) return
    const ap = p.association_price
    setPriceDraft(ap != null ? String(ap) : '')
    setFoodDraft(buildFoodDraft(p))
  }, [selected])

  const isPriceDirty = useCallback((p: AssociationProduct) => {
    const parsed = parseLeiInput(priceDraft)
    const current = p.association_price
    if (priceDraft.trim() === '' && current == null) return false
    if (priceDraft.trim() === '' && current != null) return true
    if (parsed == null && current != null) return true
    if (parsed != null && current == null) return true
    if (parsed != null && current != null) return Math.abs(parsed - Number(current)) > 0.001
    return false
  }, [priceDraft])

  const mergeProduct = useCallback((updated: AssociationProduct) => {
    setProducts((prev) => prev.map((p) => (p.id === updated.id ? { ...p, ...updated } : p)))
  }, [])

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
        router.refresh()
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'Nu am putut salva informațiile alimentare.')
      } finally {
        setSavingFood(false)
      }
    },
    [canManage, foodDraft, mergeProduct, router],
  )

  const handleToggleListed = useCallback(
    async (p: AssociationProduct, next: boolean) => {
      if (!canManage || p.status === 'inactiv' || !p.tenantIsAssociationApproved) return
      const prevListed = p.association_listed
      mergeProduct({ ...p, association_listed: next })
      setToggleBusyId(p.id)
      try {
        const data = await patchAssociationProduct({ productId: p.id, association_listed: next })
        mergeProduct(data)
        toast.success(next ? 'Produs listat în magazin.' : 'Produs retras din magazin.')
        router.refresh()
      } catch (e) {
        mergeProduct({ ...p, association_listed: prevListed })
        toast.error(e instanceof Error ? e.message : 'Nu am putut actualiza.')
      } finally {
        setToggleBusyId(null)
      }
    },
    [canManage, mergeProduct, router]
  )

  const handleSavePrice = useCallback(
    async (p: AssociationProduct) => {
      if (!canManage || !p.tenantIsAssociationApproved) return
      const parsed = priceDraft.trim() === '' ? null : parseLeiInput(priceDraft)
      if (priceDraft.trim() !== '' && parsed == null) {
        toast.error('Introdu un preț valid.')
        return
      }
      setPriceBusy(true)
      try {
        const data = await patchAssociationProduct({
          productId: p.id,
          association_price: parsed,
        })
        mergeProduct(data)
        toast.success('Preț salvat.')
        router.refresh()
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'Nu am putut salva.')
      } finally {
        setPriceBusy(false)
      }
    },
    [canManage, priceDraft, mergeProduct, router]
  )

  const desktopColumns = useMemo<ColumnDef<AssociationProduct>[]>(
    () => [
      {
        accessorKey: 'nume',
        header: 'Produs',
        cell: ({ row }) => {
          const cat = row.original.categorie as CategorieProdus
          const em = CATEGORIE_EMOJI[cat] ?? '📦'
          return (
            <div className="flex items-center gap-3">
              <span
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[var(--surface-card-muted)] text-lg"
                aria-hidden
              >
                {em}
              </span>
              <span className="font-semibold text-[var(--text-primary)]">{row.original.nume}</span>
            </div>
          )
        },
      },
      {
        id: 'farm',
        accessorFn: (r) => r.farmName ?? '',
        header: 'Producător',
        cell: ({ row }) => row.original.farmName ?? '—',
      },
      {
        accessorKey: 'categorie',
        header: 'Categorie',
        cell: ({ row }) => CATEGORIE_LABELS[row.original.categorie as CategorieProdus] ?? row.original.categorie,
      },
      {
        id: 'pret',
        accessorFn: (r) => r.pret_unitar ?? -1,
        header: 'Preț original',
        meta: { numeric: true },
        cell: ({ row }) => formatLei(row.original.pret_unitar),
      },
      {
        id: 'pret_asoc',
        accessorFn: (r) => r.association_price ?? -1,
        header: 'Preț asociație',
        meta: { numeric: true },
        cell: ({ row }) =>
          row.original.association_price != null
            ? formatLei(row.original.association_price)
            : '—',
      },
      {
        id: 'status_mag',
        header: 'Status',
        enableSorting: false,
        cell: ({ row }) => {
          const st = listingStatusLabel(row.original)
          const cls =
            st.tone === 'success'
              ? 'border-[var(--status-success-border)] bg-[var(--status-success-bg)] text-[var(--status-success-text)]'
              : st.tone === 'danger'
                ? 'border-[var(--status-danger-border)] bg-[var(--status-danger-bg)] text-[var(--status-danger-text)]'
                : 'border-[var(--status-neutral-border)] bg-[var(--status-neutral-bg)] text-[var(--status-neutral-text)]'
          return (
            <span className={cn('inline-flex rounded-lg border px-2 py-0.5 text-[10px] font-bold', cls)}>
              {st.text}
            </span>
          )
        },
      },
    ],
    []
  )

  const onDesktopRowClick = useCallback((row: AssociationProduct) => setSelectedId(row.id), [])

  const isDesktopRowSelected = useCallback(
    (row: AssociationProduct) => resolvedSelectedId === row.id,
    [resolvedSelectedId]
  )

  const inspectorBody = (p: AssociationProduct) => {
    const magazinFarm = p.tenant_id ? `/magazin/${p.tenant_id}` : null
    const canEditAssocFields = canManage && p.tenantIsAssociationApproved

    return (
      <>
        {!p.tenantIsAssociationApproved ? (
          <p className="rounded-xl border border-[var(--border-default)] bg-[var(--surface-card-muted)] px-3 py-2 text-sm text-[var(--text-secondary)]">
            Ferma e suspendată în asociație — reactivează-o din <strong>Producători</strong> ca să poți modifica
            listarea și prețul pentru magazin.
          </p>
        ) : null}
        <DesktopInspectorSection label="Producător">
          <p className="font-medium text-[var(--text-primary)]">{p.farmName ?? '—'}</p>
          {magazinFarm ? (
            <Link
              href={magazinFarm}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-sm font-semibold text-[var(--agri-primary)] underline-offset-2 hover:underline"
            >
              <Store className="h-3.5 w-3.5" aria-hidden />
              Vezi ferma
            </Link>
          ) : null}
        </DesktopInspectorSection>

        <DesktopInspectorSection label="Preț">
          <p className="text-sm">
            <span className="text-[var(--text-secondary)]">Preț fermier: </span>
            <span className="font-semibold tabular-nums text-[var(--text-primary)]">
              {formatLei(p.pret_unitar)}
            </span>
          </p>
          <label htmlFor={`assoc-price-${p.id}`} className="mt-2 block text-xs font-semibold text-[var(--text-secondary)]">
            Preț asociație
          </label>
          <input
            id={`assoc-price-${p.id}`}
            type="text"
            inputMode="decimal"
            disabled={!canEditAssocFields || priceBusy}
            placeholder="Folosește prețul fermierului"
            value={priceDraft}
            onChange={(e) => setPriceDraft(e.target.value)}
            className="agri-control mt-1 h-10 w-full max-w-xs rounded-xl px-3 text-sm"
          />
          {canEditAssocFields ? (
            <Button
              type="button"
              size="sm"
              className="mt-2"
              disabled={!isPriceDirty(p) || priceBusy}
              onClick={() => void handleSavePrice(p)}
            >
              Salvează preț
            </Button>
          ) : null}
        </DesktopInspectorSection>

        <DesktopInspectorSection label="Vizibilitate magazin">
          <div className="flex items-start gap-3">
            <ListedToggle
              checked={p.association_listed}
              disabled={!canEditAssocFields || p.status === 'inactiv'}
              busy={toggleBusyId === p.id}
              onToggle={() => void handleToggleListed(p, !p.association_listed)}
            />
            <p className="text-sm leading-snug text-[var(--text-secondary)]">
              Listat în magazin — când e activ, produsul poate apărea în magazinul public al asociației (dacă și
              produsul e activ la fermier).
            </p>
          </div>
        </DesktopInspectorSection>

        <DesktopInspectorSection label="Informații alimentare">
          <p className="mb-3 text-xs leading-relaxed text-[var(--text-secondary)]">
            Editează informațiile afișate în vitrina magazinului. Valorile salvate aici au prioritate peste ce setează
            producătorul în ERP.
          </p>

          <div className="space-y-3">
            <div>
              <label
                htmlFor={`food-tip-${p.id}`}
                className="mb-1 block text-xs font-semibold uppercase tracking-wide text-[var(--text-secondary)]"
              >
                Tip
              </label>
              <select
                id={`food-tip-${p.id}`}
                value={foodDraft.tip}
                onChange={(e) => setFoodDraft((prev) => ({ ...prev, tip: e.target.value as AssociationFoodType }))}
                disabled={!canEditAssocFields || savingFood}
                className="agri-control h-10 w-full rounded-xl px-3 text-sm"
              >
                {Object.entries(FOOD_TYPE_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label
                htmlFor={`food-ingrediente-${p.id}`}
                className="mb-1 block text-xs font-semibold text-[var(--text-secondary)]"
              >
                Ingrediente
              </label>
              <textarea
                id={`food-ingrediente-${p.id}`}
                value={foodDraft.ingrediente}
                onChange={(e) => setFoodDraft((prev) => ({ ...prev, ingrediente: e.target.value }))}
                disabled={!canEditAssocFields || savingFood}
                placeholder="Ex: zmeură 100% naturală, fără aditivi"
                rows={3}
                className="agri-control min-h-[84px] w-full rounded-xl px-3 py-2 text-sm"
              />
            </div>

            <div>
              <label
                htmlFor={`food-alergeni-${p.id}`}
                className="mb-1 block text-xs font-semibold text-[var(--status-danger-text)]"
              >
                Alergeni
              </label>
              <textarea
                id={`food-alergeni-${p.id}`}
                value={foodDraft.alergeni}
                onChange={(e) => setFoodDraft((prev) => ({ ...prev, alergeni: e.target.value }))}
                disabled={!canEditAssocFields || savingFood}
                placeholder="Ex: poate conține urme de nuci"
                rows={2}
                className="agri-control min-h-[72px] w-full rounded-xl px-3 py-2 text-sm"
              />
            </div>

            <div>
              <label
                htmlFor={`food-pastrare-${p.id}`}
                className="mb-1 block text-xs font-semibold text-[var(--text-secondary)]"
              >
                Păstrare
              </label>
              <input
                id={`food-pastrare-${p.id}`}
                value={foodDraft.pastrare}
                onChange={(e) => setFoodDraft((prev) => ({ ...prev, pastrare: e.target.value }))}
                disabled={!canEditAssocFields || savingFood}
                placeholder="Ex: la frigider, 2-4°C"
                className="agri-control h-10 w-full rounded-xl px-3 text-sm"
              />
            </div>

            <div>
              <label
                htmlFor={`food-valabilitate-${p.id}`}
                className="mb-1 block text-xs font-semibold text-[var(--text-secondary)]"
              >
                Valabilitate
              </label>
              <input
                id={`food-valabilitate-${p.id}`}
                value={foodDraft.valabilitate}
                onChange={(e) => setFoodDraft((prev) => ({ ...prev, valabilitate: e.target.value }))}
                disabled={!canEditAssocFields || savingFood}
                placeholder="Ex: 5 zile de la recoltare"
                className="agri-control h-10 w-full rounded-xl px-3 text-sm"
              />
            </div>

            {canEditAssocFields ? (
              <Button
                type="button"
                className="w-full"
                disabled={savingFood}
                onClick={() => void handleSaveFoodInfo(p)}
              >
                {savingFood ? 'Se salvează...' : 'Salvează informații alimentare'}
              </Button>
            ) : (
              <p className="text-xs text-[var(--text-muted)]">
                Doar moderatorii și administratorii pot suprascrie informațiile alimentare din vitrină.
              </p>
            )}
          </div>
        </DesktopInspectorSection>

        <DesktopInspectorSection label="Detalii">
          <p className="text-sm text-[var(--text-primary)]">{p.descriere?.trim() || '—'}</p>
          <p className="text-sm">
            Unitate: <span className="font-medium">{p.unitate_vanzare}</span>
            {p.gramaj_per_unitate != null ? (
              <>
                {' '}
                · Gramaj: <span className="font-medium tabular-nums">{p.gramaj_per_unitate}</span>
              </>
            ) : null}
          </p>
          <p className="text-sm">
            Status fermier:{' '}
            <span className="font-medium">{p.status === 'activ' ? 'Activ' : 'Inactiv'}</span>
          </p>
          <p className="text-xs text-[var(--text-tertiary)]">
            Adăugat: {new Date(p.created_at).toLocaleString('ro-RO', { dateStyle: 'medium', timeStyle: 'short' })}
          </p>
        </DesktopInspectorSection>
      </>
    )
  }

  return (
    <AppShell header={<PageHeader title="Produse" subtitle="Catalog asociație — fermieri aprobați" />}>
      <div className="mx-auto w-full max-w-4xl space-y-4 py-3 md:max-w-7xl">
        {!canManage ? (
          <p className="rounded-xl border border-[var(--border-default)] bg-[var(--surface-card-muted)] px-3 py-2 text-sm text-[var(--text-secondary)]">
            Poți vedea catalogul; doar administratorii și moderatorii pot modifica listarea și prețul pentru asociație.
          </p>
        ) : null}

        <div className="flex flex-wrap gap-2 md:hidden">
          {FILTER_TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setFilterTab(t.id)}
              className={cn(
                'h-9 rounded-full px-3 text-xs font-semibold transition',
                filterTab === t.id
                  ? 'bg-[var(--agri-primary)] text-white'
                  : 'border border-[var(--border-default)] bg-[var(--surface-card)] text-[var(--text-secondary)]'
              )}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="md:hidden">
          <SearchField
            placeholder="Caută produs sau fermă..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
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
          {CATEGORII_PRODUSE.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setFilterCategorie(c)}
              className={cn(
                'h-8 rounded-full px-3 text-xs font-semibold',
                filterCategorie === c
                  ? 'bg-[var(--brand-blue)] text-white'
                  : 'border border-[var(--border-default)] bg-[var(--surface-card-muted)]'
              )}
            >
              {CATEGORIE_LABELS[c]}
            </button>
          ))}
        </div>

        <DesktopToolbar
          className="hidden md:flex"
          trailing={
            <span className="text-sm text-[var(--text-secondary)]">
              <strong className="text-[var(--text-primary)]">{filtered.length}</strong> în filtru
            </span>
          }
        >
          <div className="flex flex-wrap items-center gap-2">
            {FILTER_TABS.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setFilterTab(t.id)}
                className={cn(
                  'h-9 rounded-full px-3 text-xs font-semibold transition',
                  filterTab === t.id
                    ? 'bg-[var(--agri-primary)] text-white'
                    : 'border border-[var(--border-default)] bg-[var(--surface-card)] text-[var(--text-secondary)]'
                )}
              >
                {t.label}
              </button>
            ))}
          </div>
          <SearchField
            containerClassName="w-full max-w-sm min-w-[180px]"
            placeholder="Produs sau producător..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Căutare desktop"
          />
          <label htmlFor="assoc_prod_cat" className="sr-only">
            Categorie
          </label>
          <select
            id="assoc_prod_cat"
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
        </DesktopToolbar>

        <DesktopSplitPane
          master={
            <ResponsiveDataView
              columns={desktopColumns}
              data={filtered}
              getRowId={(row) => row.id}
              skipDesktopDataFilter
              hideDesktopSearchRow
              mobileContainerClassName="grid-cols-1 gap-2"
              emptyMessage="Niciun produs în acest filtru."
              onDesktopRowClick={onDesktopRowClick}
              isDesktopRowSelected={isDesktopRowSelected}
              renderCard={(item) => {
                const st = listingStatusLabel(item)
                const tone = st.tone === 'success' ? 'success' : st.tone === 'danger' ? 'danger' : 'neutral'
                const em = CATEGORIE_EMOJI[item.categorie as CategorieProdus] ?? '📦'
                return (
                  <MobileEntityCard
                    title={item.nume}
                    subtitle={item.farmName ?? ''}
                    icon={<span aria-hidden>{em}</span>}
                    mainValue={formatLei(item.association_price ?? item.pret_unitar)}
                    secondaryValue={item.association_price != null ? 'Preț asociație' : 'Preț fermier'}
                    statusLabel={st.text}
                    statusTone={tone}
                    interactive
                    showChevron
                    onClick={() => {
                      setSelectedId(item.id)
                      setMobileDetailId(item.id)
                    }}
                    ariaLabel={`Produs ${item.nume}`}
                  />
                )
              }}
            />
          }
          detail={
            selected ? (
              <DesktopInspectorPanel
                title={selected.nume}
                description={CATEGORIE_LABELS[selected.categorie as CategorieProdus] ?? selected.categorie}
                footer={
                  <Button type="button" variant="outline" className="w-full gap-2 rounded-xl" asChild>
                    <a
                      href={associationShopProdusePath({ produs: selected.id })}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <ExternalLink className="h-4 w-4" aria-hidden />
                      Vezi în magazin
                    </a>
                  </Button>
                }
              >
                {inspectorBody(selected)}
              </DesktopInspectorPanel>
            ) : (
              <aside className="hidden rounded-2xl border border-[var(--border-default)] bg-[var(--surface-card-muted)] p-6 text-center text-sm text-[var(--text-secondary)] md:block">
                Selectează un produs din listă.
              </aside>
            )
          }
        />
      </div>

      <AppDrawer
        open={mobileDetailId != null}
        onOpenChange={(open) => {
          if (!open) setMobileDetailId(null)
        }}
        title={mobileDetail?.nume ?? ''}
        description={
          mobileDetail
            ? (CATEGORIE_LABELS[mobileDetail.categorie as CategorieProdus] ?? mobileDetail.categorie)
            : undefined
        }
        footer={
          mobileDetail ? (
            <Button type="button" variant="outline" className="w-full gap-2" asChild>
              <a
                href={associationShopProdusePath({ produs: mobileDetail.id })}
                target="_blank"
                rel="noopener noreferrer"
              >
                <ExternalLink className="h-4 w-4" aria-hidden />
                Vezi în magazin
              </a>
            </Button>
          ) : null
        }
      >
        {mobileDetail ? (
          <div className="space-y-5 px-1 pb-2">{inspectorBody(mobileDetail)}</div>
        ) : null}
      </AppDrawer>
    </AppShell>
  )
}
