'use client'

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react'

import {
  AssociationCartProvider,
  useAssociationCart,
  type AssociationCartLine,
} from '@/components/shop/association/AssociationCartProvider'
import { buildGustProducerCardsFromProducts } from '@/components/shop/association/producers/GustProducersPage'
import type { GustCartItem, GustCheckoutSuccess } from '@/components/shop/association/cart/gustCartTypes'
import type { AssociationCategoryDefinition } from '@/components/shop/association/tokens'
import type { AssociationPublicSettings } from '@/lib/association/public-settings'
import type { AssociationProduct } from '@/lib/shop/load-association-catalog'
import { getInitialQuantityForUnit } from '@/lib/shop/utils'

export type { AssociationCartLine }

function formatPrice(p: AssociationProduct): string {
  return new Intl.NumberFormat('ro-RO', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(Number(p.displayPrice))
}

export type AssociationShopContextValue = {
  products: AssociationProduct[]
  /** Setări publice asociație (Storage JSON) — identitate comerciant în magazin. */
  publicSettings: AssociationPublicSettings
  categoryDefinitions: AssociationCategoryDefinition[]
  searchQuery: string
  setSearchQuery: (s: string) => void
  showCart: boolean
  setShowCart: (v: boolean) => void
  selectedProduct: AssociationProduct | null
  detailQtyDraft: string
  setDetailQtyDraft: (s: string) => void
  orderSuccess: GustCheckoutSuccess | null
  categories: string[]
  sidebarCategories: string[]
  producerCards: ReturnType<typeof buildGustProducerCardsFromProducts>
  gustCatalogCartLines: { productId: string; qty: number }[]
  gustCartItems: GustCartItem[]
  cart: AssociationCartLine[]
  cartTotalQty: number
  cartLineCount: number
  estimatedTotal: number
  totalLeiLabel: string
  formatPrice: (p: AssociationProduct) => string
  openProductDetail: (p: AssociationProduct) => void
  closeProductDetail: () => void
  addFromDetail: () => void
  addQuickToCart: (p: AssociationProduct) => void
  adjustCartDelta: (productId: string, delta: number) => void
  handleGustCheckoutSuccess: (r: GustCheckoutSuccess) => void
  backToShopFromSuccess: () => void
  getProductImageUrlsForCart: (productId: string) => string[]
}

const AssociationShopContext = createContext<AssociationShopContextValue | null>(null)

export function useAssociationShop(): AssociationShopContextValue {
  const v = useContext(AssociationShopContext)
  if (!v) throw new Error('useAssociationShop trebuie folosit în interiorul AssociationShopProvider')
  return v
}

function AssociationShopProviderInner({
  products,
  publicSettings,
  categoryDefinitions,
  children,
}: {
  products: AssociationProduct[]
  publicSettings: AssociationPublicSettings
  categoryDefinitions: AssociationCategoryDefinition[]
  children: ReactNode
}) {
  const cartApi = useAssociationCart()
  const [searchQuery, setSearchQuery] = useState('')
  const [showCart, setShowCart] = useState(false)
  const [selectedProduct, setSelectedProduct] = useState<AssociationProduct | null>(null)
  const [detailQtyDraft, setDetailQtyDraft] = useState('1')
  const [orderSuccess, setOrderSuccess] = useState<GustCheckoutSuccess | null>(null)

  const categories = useMemo(
    () => categoryDefinitions.map((row) => row.key),
    [categoryDefinitions],
  )

  const sidebarCategories = useMemo(() => categories.slice(0, 9), [categories])

  const producerCards = useMemo(() => buildGustProducerCardsFromProducts(products), [products])

  const openProductDetail = useCallback(
    (p: AssociationProduct) => {
      setSelectedProduct(p)
      const line = cartApi.lines.find((l) => l.product.id === p.id)
      setDetailQtyDraft(String(line?.qty ?? getInitialQuantityForUnit(p.unitate_vanzare)))
    },
    [cartApi.lines],
  )

  const closeProductDetail = useCallback(() => {
    setSelectedProduct(null)
  }, [])

  const addFromDetail = useCallback(() => {
    if (!selectedProduct) return
    const q = Math.max(1, Math.round(Number(String(detailQtyDraft).replace(',', '.')) || 0))
    cartApi.addToCart(selectedProduct, q)
    setSelectedProduct(null)
  }, [selectedProduct, detailQtyDraft, cartApi])

  const addQuickToCart = useCallback(
    (p: AssociationProduct) => {
      const existing = cartApi.lines.find((line) => line.product.id === p.id)
      const initialQty = getInitialQuantityForUnit(p.unitate_vanzare)
      cartApi.addToCart(p, existing ? 1 : initialQty)
    },
    [cartApi],
  )

  const adjustCartDelta = useCallback(
    (productId: string, delta: number) => {
      cartApi.bumpQty(productId, delta)
    },
    [cartApi],
  )

  const handleGustCheckoutSuccess = useCallback(
    (r: GustCheckoutSuccess) => {
      cartApi.clearCart()
      setShowCart(false)
      setOrderSuccess(r)
    },
    [cartApi],
  )

  const backToShopFromSuccess = useCallback(() => {
    setOrderSuccess(null)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [])

  const value = useMemo(
    (): AssociationShopContextValue => ({
      products,
      publicSettings,
      categoryDefinitions,
      searchQuery,
      setSearchQuery,
      showCart,
      setShowCart,
      selectedProduct,
      detailQtyDraft,
      setDetailQtyDraft,
      orderSuccess,
      categories,
      sidebarCategories,
      producerCards,
      gustCatalogCartLines: cartApi.gustCatalogCartLines,
      gustCartItems: cartApi.gustCartItems,
      cart: cartApi.lines,
      cartTotalQty: cartApi.cartTotalQty,
      cartLineCount: cartApi.cartLineCount,
      estimatedTotal: cartApi.estimatedTotal,
      totalLeiLabel: cartApi.totalLeiLabel,
      formatPrice,
      openProductDetail,
      closeProductDetail,
      addFromDetail,
      addQuickToCart,
      adjustCartDelta,
      handleGustCheckoutSuccess,
      backToShopFromSuccess,
      getProductImageUrlsForCart: cartApi.getProductImageUrlsForCart,
    }),
    [
      products,
      publicSettings,
      categoryDefinitions,
      searchQuery,
      showCart,
      selectedProduct,
      detailQtyDraft,
      orderSuccess,
      categories,
      sidebarCategories,
      producerCards,
      cartApi.gustCatalogCartLines,
      cartApi.gustCartItems,
      cartApi.lines,
      cartApi.cartTotalQty,
      cartApi.cartLineCount,
      cartApi.estimatedTotal,
      cartApi.totalLeiLabel,
      cartApi.getProductImageUrlsForCart,
      openProductDetail,
      closeProductDetail,
      addFromDetail,
      addQuickToCart,
      adjustCartDelta,
      handleGustCheckoutSuccess,
      backToShopFromSuccess,
    ],
  )

  return <AssociationShopContext.Provider value={value}>{children}</AssociationShopContext.Provider>
}

export function AssociationShopProvider({
  products,
  publicSettings,
  categoryDefinitions,
  children,
}: {
  products: AssociationProduct[]
  publicSettings: AssociationPublicSettings
  categoryDefinitions: AssociationCategoryDefinition[]
  children: ReactNode
}) {
  return (
    <AssociationCartProvider>
      <AssociationShopProviderInner
        products={products}
        publicSettings={publicSettings}
        categoryDefinitions={categoryDefinitions}
      >
        {children}
      </AssociationShopProviderInner>
    </AssociationCartProvider>
  )
}
