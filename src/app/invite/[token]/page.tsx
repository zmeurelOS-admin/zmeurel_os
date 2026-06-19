import Image from 'next/image'

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
      <main className="min-h-screen bg-[var(--agri-bg)] px-4 py-8">
        <div className="mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-md items-center">
          <section className="w-full rounded-3xl border border-[var(--agri-border)] bg-[var(--surface-card)] p-6 text-center shadow-[var(--shadow-soft)]">
            <Image src="/icons/icon.svg" alt="Zmeurel OS" width={48} height={48} className="mx-auto" />
            <h1 className="mt-4 text-xl font-bold text-[var(--agri-text)]">Link invalid sau expirat.</h1>
            <p className="mt-2 text-sm text-[var(--agri-text-muted)]">
              Cere proprietarului fermei să genereze o invitație nouă.
            </p>
          </section>
        </div>
      </main>
    )
  }

  const farmName = await loadFarmName(validation.invite.tenant_id)

  return (
    <main className="min-h-screen bg-[var(--agri-bg)] px-4 py-8">
      <div className="mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-md items-center">
        <section className="w-full rounded-3xl border border-[var(--agri-border)] bg-[var(--surface-card)] p-5 shadow-[var(--shadow-soft)] sm:p-6">
          <div className="mb-5 text-center">
            <Image src="/icons/icon.svg" alt="Zmeurel OS" width={48} height={48} className="mx-auto" />
            <h1 className="mt-4 text-2xl font-bold tracking-[-0.02em] text-[var(--agri-text)]">
              Ai fost invitat în ferma {farmName}
            </h1>
            <p className="mt-2 text-sm text-[var(--agri-text-muted)]">
              Creează contul de operator pentru a lucra direct în această fermă.
            </p>
          </div>
          <InviteSignupClient token={token} />
        </section>
      </div>
    </main>
  )
}
