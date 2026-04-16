import { AssociationLivrariClient } from '@/components/association/livrari/AssociationLivrariClient'
import { requireAssociationAccess } from '@/lib/association/auth'
import { getAssociationOrders } from '@/lib/association/queries'
import { loadAssociationSettings } from '@/lib/association/public-settings'

export default async function AsociatieLivrariPage() {
  await requireAssociationAccess()

  const [orders, settings] = await Promise.all([getAssociationOrders(), loadAssociationSettings()])
  const activeOrders = orders.filter((order) => order.status === 'confirmata' || order.status === 'in_livrare')

  return <AssociationLivrariClient initialOrders={activeOrders} settings={settings} />
}
