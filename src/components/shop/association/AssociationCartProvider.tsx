'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'

import { collectProductImageUrls } from '@/components/shop/association/catalog/gustProductTypes'
import type { GustCatalogProduct } from '@/components/shop/association/catalog/gustProductTypes'
import {
  gustCartItemsFromAssociationLines,
  type GustCartItem,
} from '@/components/shop/association/cart/gustCartTypes'
import type { AssociationProduct } from '@/lib/shop/load-association-catalog'

const STORAGE_KEY = 'zmeurel-association-cart-v1'

export type AssociationCartLine = {
  product: AssociationProduct
  qty: number
}

function roundQty(n: number): number {
  return Math.round((Number(n) || 0) * 100) / 100
}

function readStorage(): AssociationCartLine[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as AssociationCartLine[] | null
    if (!Array.isArray(parsed)) return []
    return parsed.filter(
      (x): x is AssociationCartLine =>
        Boolean(x?.product?.id && typeof x.qty === 'number' && Number.isFinite(x.qty)),
    )
  } catch {
    return []
  }
}

function writeStorage(lines: AssociationCartLine[]) {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(lines))
  } catch {
    /* quota / private mode */
  }
}

export type AssociationCartContextValue = {
  lines: AssociationCartLine[]
  addToCart: (product: AssociationProduct, qty?: number) => void
  removeFromCart: (productId: string) => void
  updateQty: (productId: string, qty: number) => void
  /** Adaugă delta la cantitatea existentă; elimină linia dacă cantitatea ≤ 0. */
  bumpQty: (productId: string, delta: number) => void
  clearCart: () => void
  cartLineCount: number
  cartTotalQty: number
  estimatedTotal: number
  totalLeiLabel: string
  gustCartItems: GustCartItem[]
  gustCatalogCartLines: { productId: string; qty: number }[]
  getProductImageUrlsForCart: (productId: string) => string[]
}

const AssociationCartContext = createContext<AssociationCartContextValue | null>(null)

export function useAssociationCart(): AssociationCartContextValue {
  const v = useContext(AssociationCartContext)
  if (!v) throw new Error('useAssociationCart trebuie folosit în AssociationCartProvider')
  return v
}

/** Alias cerut de UX — același context ca `useAssociationCart`. */
export const useCart = useAssociationCart

export function AssociationCartProvider({ children }: { children: ReactNode }) {
  const [lines, setLines] = useState<AssociationCartLine[]>([])
  const canPersist = useRef(false)
  const skipNextPersist = useRef(true)

  useEffect(() => {
    const stored = readStorage()
    if (stored.length > 0) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- coș din sessionStorage (client-only, după mount)
      setLines(stored)
    }
    canPersist.current = true
  }, [])

  useEffect(() => {
    if (!canPersist.current) return
    if (skipNextPersist.current) {
      skipNextPersist.current = false
      return
    }
    writeStorage(lines)
  }, [lines])

  const removeFromCart = useCallback((productId: string) => {
    setLines((prev) => prev.filter((l) => l.product.id !== productId))
  }, [])

  const addToCart = useCallback((product: AssociationProduct, qty = 1) => {
    const q = Math.max(0.01, roundQty(qty))
    setLines((prev) => {
      const idx = prev.findIndex((l) => l.product.id === product.id)
      if (idx === -1) return [...prev, { product, qty: q }]
      const next = [...prev]
      next[idx] = { product, qty: roundQty(next[idx].qty + q) }
      return next
    })
  }, [])

  const updateQty = useCallback(
    (productId: string, qty: number) => {
      const q = roundQty(qty)
      if (q <= 0) {
        removeFromCart(productId)
        return
      }
      setLines((prev) => {
        const idx = prev.findIndex((l) => l.product.id === productId)
        if (idx === -1) return prev
        const next = [...prev]
        next[idx] = { ...next[idx], qty: q }
        return next
      })
    },
    [removeFromCart],
  )

  const bumpQty = useCallback((productId: string, delta: number) => {
    setLines((prev) => {
      const idx = prev.findIndex((l) => l.product.id === productId)
      if (idx === -1) return prev
      const nextQty = roundQty(prev[idx].qty + delta)
      if (nextQty <= 0) return prev.filter((_, i) => i !== idx)
      const next = [...prev]
      next[idx] = { ...next[idx], qty: nextQty }
      return next
    })
  }, [])

  const clearCart = useCallback(() => setLines([]), [])

  const cartTotalQty = useMemo(() => lines.reduce((s, l) => s + l.qty, 0), [lines])
  const cartLineCount = lines.length

  const gustCatalogCartLines = useMemo(
    () => lines.map((l) => ({ productId: l.product.id, qty: l.qty })),
    [lines],
  )

  const gustCartItems = useMemo(() => gustCartItemsFromAssociationLines(lines), [lines])

  const estimatedTotal = useMemo(
    () => lines.reduce((sum, { product: p, qty }) => sum + Number(p.displayPrice) * qty, 0),
    [lines],
  )

  const totalLeiLabel = useMemo(
    () =>
      new Intl.NumberFormat('ro-RO', {
        minimumFractionDigits: 0,
        maximumFractionDigits: 2,
      }).format(estimatedTotal),
    [estimatedTotal],
  )

  const getProductImageUrlsForCart = useCallback((productId: string) => {
    const p = lines.find((l) => l.product.id === productId)?.product
    if (!p) return []
    return collectProductImageUrls(p as GustCatalogProduct)
  }, [lines])

  const value = useMemo(
    (): AssociationCartContextValue => ({
      lines,
      addToCart,
      removeFromCart,
      updateQty,
      bumpQty,
      clearCart,
      cartLineCount,
      cartTotalQty,
      estimatedTotal,
      totalLeiLabel,
      gustCartItems,
      gustCatalogCartLines,
      getProductImageUrlsForCart,
    }),
    [
      lines,
      addToCart,
      removeFromCart,
      updateQty,
      bumpQty,
      clearCart,
      cartLineCount,
      cartTotalQty,
      estimatedTotal,
      totalLeiLabel,
      gustCartItems,
      gustCatalogCartLines,
      getProductImageUrlsForCart,
    ],
  )

  return <AssociationCartContext.Provider value={value}>{children}</AssociationCartContext.Provider>
}
