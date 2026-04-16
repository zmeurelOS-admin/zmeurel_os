import { AssociationProduseClient } from '@/components/association/produse/AssociationProduseClient'
import { canManageAssociationCatalog, requireAssociationAccess } from '@/lib/association/auth'
import { getAssociationProducts, getAssociationProducers } from '@/lib/association/queries'

export default async function AsociatieProdusePage() {
  const { userId } = await requireAssociationAccess()
  const [products, producers, canManage] = await Promise.all([
    getAssociationProducts(),
    getAssociationProducers(),
    canManageAssociationCatalog(userId),
  ])
  return (
    <AssociationProduseClient
      initialProducts={products}
      initialProducers={producers}
      canManage={canManage}
    />
  )
}
