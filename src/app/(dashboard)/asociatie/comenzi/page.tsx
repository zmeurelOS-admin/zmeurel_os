import { AssociationComenziClient } from '@/components/association/comenzi/AssociationComenziClient'
import { requireAssociationAccess } from '@/lib/association/auth'
import { getAssociationOrders } from '@/lib/association/queries'

type PageProps = {
  searchParams: Promise<{ status?: string }>
}

export default async function AsociatieComenziPage({ searchParams }: PageProps) {
  const { role } = await requireAssociationAccess()
  const orders = await getAssociationOrders()
  const canManage = role === 'admin' || role === 'moderator'
  const sp = await searchParams
  return (
    <AssociationComenziClient
      initialOrders={orders}
      canManage={canManage}
      initialStatusFilter={sp.status}
    />
  )
}
