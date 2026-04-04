'use client'

import { useCallback, useMemo, useState } from 'react'
import { motion } from 'framer-motion'

import { GustProductCard } from '@/components/shop/association/catalog/GustProductCard'
import { labelForCategory } from '@/components/shop/association/tokens'
import { gustaBrandColors, gustaBrandShadows, gustaPrimaryTints } from '@/lib/shop/association/brand-tokens'
import type { AssociationProduct } from '@/lib/shop/load-association-catalog'
import { cn } from '@/lib/utils'

function normalizeForSearch(s: string): string {
  return s
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .trim()
}

export type GustCatalogSort = 'recommended' | 'price-asc' | 'price-desc' | 'newest'

export type GustCatalogCartLine = {
  productId: string
  qty: number
}

export type GustCatalogPageProps = {
  products: AssociationProduct[]
  selectedCategory: string | null
  onCategoryChange: (category: string | null) => void
  searchQuery: string
  onAddToCart: (product: AssociationProduct) => void
  onOpenDetail: (product: AssociationProduct) => void
  cart: GustCatalogCartLine[]
  /** Filtru activ pe producător (catalogul primește deja `products` filtrate). */
  farmerFilter?: { farmName: string; onClear: () => void } | null
}

const SORT_OPTIONS: { value: GustCatalogSort; label: string }[] = [
  { value: 'recommended', label: 'Recomandate' },
  { value: 'price-asc', label: 'Preț crescător' },
  { value: 'price-desc', label: 'Preț descrescător' },
  { value: 'newest', label: 'Cele mai noi' },
]

export function GustCatalogPage({
  products,
  selectedCategory,
  onCategoryChange,
  searchQuery,
  onAddToCart,
  onOpenDetail,
  cart,
  farmerFilter,
}: GustCatalogPageProps) {
  const [sort, setSort] = useState<GustCatalogSort>('recommended')

  const orderIndex = useMemo(() => {
    const m = new Map<string, number>()
    products.forEach((p, i) => m.set(p.id, i))
    return m
  }, [products])

  const categories = useMemo(() => {
    const s = new Set<string>()
    for (const p of products) {
      if (p.categorie?.trim()) s.add(p.categorie.trim())
    }
    return Array.from(s).sort((a, b) => a.localeCompare(b, 'ro'))
  }, [products])

  const searchNorm = normalizeForSearch(searchQuery)

  const filtered = useMemo(() => {
    return products.filter((p) => {
      if (selectedCategory != null) {
        if (normalizeForSearch(p.categorie) !== normalizeForSearch(selectedCategory)) return false
      }
      if (searchNorm) {
        const inName = normalizeForSearch(p.nume).includes(searchNorm)
        const inFarm = normalizeForSearch(p.farmName ?? '').includes(searchNorm)
        if (!inName && !inFarm) return false
      }
      return true
    })
  }, [products, selectedCategory, searchNorm])

  const sorted = useMemo(() => {
    const arr = [...filtered]
    // „Cele mai noi”: fără `created_at` în payload, păstrăm aceeași ordine ca serverul (ca „Recomandate”).
    if (sort === 'recommended' || sort === 'newest') {
      arr.sort((a, b) => (orderIndex.get(a.id) ?? 0) - (orderIndex.get(b.id) ?? 0))
      return arr
    }
    if (sort === 'price-asc') {
      arr.sort((a, b) => Number(a.displayPrice) - Number(b.displayPrice))
      return arr
    }
    arr.sort((a, b) => Number(b.displayPrice) - Number(a.displayPrice))
    return arr
  }, [filtered, sort, orderIndex])

  const cartQtyById = useMemo(() => {
    const m = new Map<string, number>()
    for (const line of cart) {
      m.set(line.productId, (m.get(line.productId) ?? 0) + line.qty)
    }
    return m
  }, [cart])

  const headerTitle =
    selectedCategory == null ? 'Toate produsele' : labelForCategory(selectedCategory)

  const handleCardOpen = useCallback(
    (productId: string) => {
      const p = sorted.find((x) => x.id === productId)
      if (p) onOpenDetail(p)
    },
    [sorted, onOpenDetail],
  )

  const handleCardAdd = useCallback(
    (productId: string) => {
      const p = sorted.find((x) => x.id === productId)
      if (p) onAddToCart(p)
    },
    [sorted, onAddToCart],
  )

  return (
    <section id="catalog" className="scroll-mt-[52px] px-4 pb-14 pt-6 md:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="assoc-heading text-xl font-extrabold md:text-2xl" style={{ color: gustaBrandColors.primary }}>
              {headerTitle}
            </h2>
            <p className="assoc-body mt-1 text-sm" style={{ color: '#5a6563' }}>
              {sorted.length} {sorted.length === 1 ? 'produs' : 'produse'}
            </p>
          </div>
          <label className="assoc-body flex min-w-[200px] flex-col gap-1 text-xs font-bold sm:max-w-xs" style={{ color: gustaBrandColors.text }}>
            Sortare
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as GustCatalogSort)}
              className="rounded-xl border-[1.5px] bg-white px-3 py-2 text-sm font-semibold outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
              style={{
                borderColor: gustaPrimaryTints[40],
                color: gustaBrandColors.text,
                ['--tw-ring-color' as string]: `${gustaBrandColors.primary}33`,
              }}
            >
              {SORT_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
        </div>

        {farmerFilter ? (
          <div
            className="mt-4 flex flex-wrap items-center justify-between gap-2 rounded-2xl border px-4 py-3"
            style={{
              borderColor: gustaPrimaryTints[40],
              backgroundColor: '#fff',
              boxShadow: gustaBrandShadows.sm,
            }}
          >
            <p className="assoc-body text-sm font-semibold" style={{ color: gustaBrandColors.text }}>
              Produse de la:{' '}
              <span style={{ color: gustaBrandColors.primary }}>{farmerFilter.farmName}</span>
            </p>
            <button
              type="button"
              onClick={farmerFilter.onClear}
              className="assoc-heading shrink-0 rounded-full border px-3 py-1.5 text-xs font-bold transition hover:opacity-90 active:scale-[0.98]"
              style={{
                borderColor: gustaPrimaryTints[40],
                color: gustaBrandColors.primary,
                backgroundColor: gustaBrandColors.secondary,
              }}
            >
              Toți producătorii
            </button>
          </div>
        ) : null}

        <div
          className={cn(
            'mt-5 flex gap-2 overflow-x-auto pb-1',
            '[-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden',
          )}
        >
          <button
            type="button"
            onClick={() => onCategoryChange(null)}
            className="assoc-heading shrink-0 rounded-full px-4 py-2 text-sm font-bold transition hover:opacity-95 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 active:scale-[0.98]"
            style={
              selectedCategory == null
                ? { backgroundColor: gustaBrandColors.primary, color: '#fff' }
                : {
                    backgroundColor: '#fff',
                    color: gustaBrandColors.text,
                    border: `1px solid ${gustaPrimaryTints[40]}`,
                  }
            }
          >
            Toate ({products.length})
          </button>
          {categories.map((cat) => {
            const active = selectedCategory != null && normalizeForSearch(selectedCategory) === normalizeForSearch(cat)
            return (
              <button
                key={cat}
                type="button"
                onClick={() => onCategoryChange(cat)}
                className="assoc-heading shrink-0 rounded-full px-4 py-2 text-sm font-bold transition hover:opacity-95 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 active:scale-[0.98]"
                style={
                  active
                    ? { backgroundColor: gustaBrandColors.primary, color: '#fff' }
                    : {
                        backgroundColor: '#fff',
                        color: gustaBrandColors.text,
                        border: `1px solid ${gustaPrimaryTints[40]}`,
                      }
                }
              >
                {labelForCategory(cat)} (
                {products.filter((p) => normalizeForSearch(p.categorie) === normalizeForSearch(cat)).length})
              </button>
            )
          })}
        </div>

        {sorted.length === 0 ? (
          <div className="mx-auto mt-16 max-w-md rounded-2xl border bg-white px-6 py-14 text-center" style={{ borderColor: gustaPrimaryTints[40] }}>
            <p className="text-4xl" aria-hidden>
              🔍
            </p>
            <p className="assoc-heading mt-4 text-lg font-bold" style={{ color: gustaBrandColors.text }}>
              Niciun produs găsit
            </p>
            <p className="assoc-body mt-2 text-sm leading-relaxed" style={{ color: '#5a6563' }}>
              Încearcă altă categorie sau șterge termenii din căutare pentru a vedea mai multe rezultate.
            </p>
          </div>
        ) : (
          <ul className="mt-8 grid grid-cols-2 gap-3 md:grid-cols-[repeat(auto-fill,minmax(240px,1fr))] md:gap-5">
            {sorted.map((p, index) => {
              const q = cartQtyById.get(p.id) ?? 0
              const badge = q > 0 ? `În coș · ${q % 1 === 0 ? q : q.toFixed(1)}` : undefined
              return (
                <motion.li
                  key={p.id}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4, ease: 'easeOut', delay: Math.min(index, 24) * 0.05 }}
                >
                  <GustProductCard
                    product={p}
                    farmName={p.farmName}
                    onOpenDetail={handleCardOpen}
                    onAddToCart={handleCardAdd}
                    badge={badge}
                  />
                </motion.li>
              )
            })}
          </ul>
        )}
      </div>
    </section>
  )
}
