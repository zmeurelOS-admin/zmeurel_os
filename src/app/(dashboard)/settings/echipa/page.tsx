import { headers } from 'next/headers'
import { redirect } from 'next/navigation'

import { getFarmOwnerContext } from '@/lib/farm-members/owner-auth'

import { EchipaClient } from './EchipaClient'

export default async function EchipaPage() {
  const headerStore = await headers()
  const memberRole = headerStore.get('x-zmeurel-member-role')

  if (memberRole === 'operator') {
    redirect('/comenzi')
  }

  const owner = await getFarmOwnerContext()
  if (!owner) {
    redirect('/comenzi')
  }

  return <EchipaClient />
}
