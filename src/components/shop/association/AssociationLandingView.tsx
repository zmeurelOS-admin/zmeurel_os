'use client'

import AssociationLandingPage from '@/components/shop/association/landing/AssociationLandingPage'
import { useAssociationShop } from '@/components/shop/association/association-shop-context'
import type { AssociationPublicSettings } from '@/lib/association/public-settings'

export function AssociationLandingView({ settings }: { settings: AssociationPublicSettings }) {
  const ctx = useAssociationShop()
  return (
    <AssociationLandingPage
      products={ctx.products}
      categoryDefinitions={ctx.categoryDefinitions}
      producerCards={ctx.producerCards}
      settings={settings}
      formatPrice={ctx.formatPrice}
      onOpenProduct={ctx.openProductDetail}
      onAddQuick={ctx.addQuickToCart}
    />
  )
}
