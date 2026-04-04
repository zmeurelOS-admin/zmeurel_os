import { AssociationOferteClient } from '@/components/association/oferte/AssociationOferteClient'
import { requireAssociationAccess } from '@/lib/association/auth'
import { listAssociationOffersForWorkspace } from '@/lib/association/queries'

export default async function AsociatieOfertePage() {
  await requireAssociationAccess()
  const initialOffers = await listAssociationOffersForWorkspace()
  return <AssociationOferteClient initialOffers={initialOffers} />
}
