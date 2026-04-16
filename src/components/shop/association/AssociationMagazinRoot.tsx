'use client'

import type { ReactNode } from 'react'

import { AssociationShopExperience } from '@/components/shop/association/AssociationShopExperience'
import { AssociationShopProvider } from '@/components/shop/association/association-shop-context'
import type { AssociationPublicSettings } from '@/lib/association/public-settings'
import type { AssociationCategoryDefinition } from '@/components/shop/association/tokens'
import type { AssociationProduct } from '@/lib/shop/load-association-catalog'

export function AssociationMagazinRoot({
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
    <AssociationShopProvider
      products={products}
      publicSettings={publicSettings}
      categoryDefinitions={categoryDefinitions}
    >
      <AssociationShopExperience>{children}</AssociationShopExperience>
    </AssociationShopProvider>
  )
}
