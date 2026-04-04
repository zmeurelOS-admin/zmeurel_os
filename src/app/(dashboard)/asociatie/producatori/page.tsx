import { AssociationProducatoriClient } from '@/components/association/producatori/AssociationProducatoriClient'
import { requireAssociationAccess } from '@/lib/association/auth'
import { getAssociationProducers } from '@/lib/association/queries'

export default async function AsociatieProducatoriPage() {
  const { role } = await requireAssociationAccess()
  const producers = await getAssociationProducers()
  const canManageProducts = role === 'admin' || role === 'moderator'
  const canManageAssociationRoles = role === 'admin'
  return (
    <AssociationProducatoriClient
      initialProducers={producers}
      canManageProducts={canManageProducts}
      canManageAssociationRoles={canManageAssociationRoles}
    />
  )
}
