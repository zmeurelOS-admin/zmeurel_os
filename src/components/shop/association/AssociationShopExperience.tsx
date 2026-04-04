'use client'

import { Suspense, type ReactNode } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'

import {
  useAssociationShop,
} from '@/components/shop/association/association-shop-context'
import type { GustCatalogProduct } from '@/components/shop/association/catalog/gustProductTypes'
import { GustCartSheet } from '@/components/shop/association/cart/GustCartSheet'
import { GustProductDetail } from '@/components/shop/association/catalog/GustProductDetail'
import { MarketSuccessOverlay } from '@/components/shop/association/marketplace/MarketSuccessOverlay'
import { AssociationShopShell } from '@/components/shop/association/AssociationShopShell'
import { useBodyScrollLock } from '@/hooks/useBodyScrollLock'
import { associationShopProdusePath } from '@/lib/shop/association-routes'
function AssociationShopExperienceInner({ children }: { children: ReactNode }) {
  const ctx = useAssociationShop()
  const router = useRouter()
  const pathname = usePathname()
  const sp = useSearchParams()

  const overlayOpen = Boolean(ctx.showCart || ctx.selectedProduct)
  useBodyScrollLock(overlayOpen)

  const detailCartQty = ctx.selectedProduct
    ? (ctx.cart.find((l) => l.product.id === ctx.selectedProduct!.id)?.qty ?? 0)
    : 0

  const closeDetailAndUrl = () => {
    ctx.closeProductDetail()
    if (sp.get('produs')) {
      const p = new URLSearchParams(sp.toString())
      p.delete('produs')
      const qs = p.toString()
      router.replace(qs ? `${pathname}?${qs}` : pathname)
    }
  }

  if (ctx.orderSuccess) {
    return (
      <MarketSuccessOverlay
        success={ctx.orderSuccess}
        publicSettings={ctx.publicSettings}
        onBackToShop={() => {
          ctx.backToShopFromSuccess()
          router.push(associationShopProdusePath())
        }}
      />
    )
  }

  const p = ctx.selectedProduct as GustCatalogProduct | null

  return (
    <>
      <AssociationShopShell>{children}</AssociationShopShell>
      <GustProductDetail
        product={p}
        isOpen={ctx.selectedProduct != null}
        onClose={closeDetailAndUrl}
        onAddToCart={ctx.addFromDetail}
        cartQuantity={detailCartQty}
        farmName={ctx.selectedProduct?.farmName?.trim() || 'Fermă locală'}
      />
      <GustCartSheet
        open={ctx.showCart}
        onClose={() => ctx.setShowCart(false)}
        items={ctx.gustCartItems}
        onAdjustQty={ctx.adjustCartDelta}
        onCheckoutSuccess={ctx.handleGustCheckoutSuccess}
        getProductImageUrls={ctx.getProductImageUrlsForCart}
      />
    </>
  )
}

export function AssociationShopExperience({ children }: { children: ReactNode }) {
  return (
    <Suspense fallback={null}>
      <AssociationShopExperienceInner>{children}</AssociationShopExperienceInner>
    </Suspense>
  )
}
