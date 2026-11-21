import Image from 'next/image'

import { kitText } from '@/components/kit'
import { cn } from '@/lib/utils'

import { validateFarmInviteToken } from '@/lib/farm-members/invite-accept'
import { getSupabaseAdmin } from '@/lib/supabase/admin'

import { InviteSignupClient } from './InviteSignupClient'

type PageProps = {
  params: Promise<{ token: string }>
}

async function loadFarmName(tenantId: string): Promise<string> {
  const admin = getSupabaseAdmin()
  const { data } = await admin
    .from('tenants')
    .select('nume_ferma')
    .eq('id', tenantId)
    .maybeSingle()

  return data?.nume_ferma?.trim() || 'ferma invitată'
}

export default async function InvitePage({ params }: PageProps) {
  const { token } = await params
  const validation = await validateFarmInviteToken(token)

  if (!validation.valid) {
    return (
      <main className="min-h-screen bg-page px-4 py-8">
        <div className="mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-md items-center">
          <section className="w-full rounded-card border border-border bg-surface p-6 text-center shadow-1">
            <Image src="/icons/icon.svg" alt="Zmeurel OS" width={48} height={48} className="mx-auto" />
            <h1 className={cn('mt-4 font-extrabold text-fg', kitText.section)}>Linkul nu mai merge</h1>
            <p className={cn('mt-2 text-fg-muted', kitText.base)}>Poate a expirat sau a fost folosit. Cere proprietarului fermei o invitație nouă.</p>
          </section>
        </div>
      </main>
    )
  }

  const farmName = await loadFarmName(validation.invite.tenant_id)

  return (
    <main className="min-h-screen bg-page px-4 py-8">
      <div className="mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-md items-center">
        <section className="w-full rounded-card border border-border bg-surface p-5 shadow-1 sm:p-6">
          <div className="mb-5 text-center">
            <Image src="/icons/icon.svg" alt="Zmeurel OS" width={48} height={48} className="mx-auto" />
            <h1 className={cn('mt-4 font-extrabold text-fg', kitText.screen)}>Ai fost invitat în ferma {farmName}</h1>
            <p className={cn('mt-2 text-fg-muted', kitText.base)}>Creează-ți contul de operator ca să lucrezi direct în această fermă.</p>
          </div>
          <InviteSignupClient token={token} />
        </section>
      </div>
    </main>
  )
}
