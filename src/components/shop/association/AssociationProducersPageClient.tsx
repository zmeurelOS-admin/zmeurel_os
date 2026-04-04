'use client'

import { GustProducersPage } from '@/components/shop/association/producers/GustProducersPage'
import { useAssociationShop } from '@/components/shop/association/association-shop-context'

export function AssociationProducersPageClient() {
  const { producerCards } = useAssociationShop()
  return <GustProducersPage producers={producerCards} />
}
