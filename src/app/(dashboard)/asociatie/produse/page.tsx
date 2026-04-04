import { AssociationProduseClient } from '@/components/association/produse/AssociationProduseClient'
import { canManageAssociationCatalog, requireAssociationAccess } from '@/lib/association/auth'
import { getAssociationProducts } from '@/lib/association/queries'

export default async function AsociatieProdusePage() {
  const { userId } = await requireAssociationAccess()
  const [products, canManage] = await Promise.all([
    getAssociationProducts(),
    canManageAssociationCatalog(userId),
  ])
  return <AssociationProduseClient initialProducts={products} canManage={canManage} />
}
