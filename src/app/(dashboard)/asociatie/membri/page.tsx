import { AssociationMembriClient } from '@/components/association/membri/AssociationMembriClient'
import { requireAssociationAccess } from '@/lib/association/auth'
import { listAssociationMembersWithEmails } from '@/lib/association/members-queries'

export default async function AsociatieMembriPage() {
  await requireAssociationAccess('admin')
  const members = await listAssociationMembersWithEmails()
  return <AssociationMembriClient initialMembers={members} />
}
