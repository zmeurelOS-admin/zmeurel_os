import { AssociationComenziClient } from '@/components/association/comenzi/AssociationComenziClient'
import { requireAssociationAccess } from '@/lib/association/auth'
import { getAssociationOrders, getAssociationProducts } from '@/lib/association/queries'

type PageProps = {
  searchParams: Promise<{ status?: string }>
}

export default async function AsociatieComenziPage({ searchParams }: PageProps) {
  const { role } = await requireAssociationAccess()
  const [orders, availableProducts] = await Promise.all([getAssociationOrders(), getAssociationProducts()])
  const canManage = role === 'admin' || role === 'moderator'
  const sp = await searchParams
  return (
    <AssociationComenziClient
      initialOrders={orders}
      availableProducts={availableProducts}
      canManage={canManage}
      initialStatusFilter={sp.status}
    />
  )
}
