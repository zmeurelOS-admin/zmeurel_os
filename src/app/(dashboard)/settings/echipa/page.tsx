import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { UsersRound } from 'lucide-react'

import { AppShell } from '@/components/app/AppShell'
import { PageHeader } from '@/components/app/PageHeader'
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

  return (
    <AppShell
      header={
        <PageHeader
          title="Echipa mea"
          subtitle="Operatori și livratori pentru ferma ta"
          rightSlot={<UsersRound className="h-5 w-5" />}
        />
      }
    >
      <EchipaClient />
    </AppShell>
  )
}
