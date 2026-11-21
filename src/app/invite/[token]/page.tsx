import Image from 'next/image'

import { Button, kitText } from '@/components/kit'
import { cereLinkNou, isHiddenOperatorEmail, ownerDisplayName, type OperatorLinkProblem } from '@/lib/farm-members/operator-link'
import { loadFarmName, loadOperatorLink, loadOwnerName } from '@/lib/farm-members/operator-link-server'
import { createClient } from '@/lib/supabase/server'
import { cn } from '@/lib/utils'

import { InviteSignupClient } from './InviteSignupClient'

export const dynamic = 'force-dynamic'

type PageProps = {
  params: Promise<{ token: string }>
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const TITLU_PROBLEMA: Record<OperatorLinkProblem, string> = {
  not_found: 'Linkul nu mai merge',
  expired: 'Linkul a expirat',
  used: 'Linkul a fost deja folosit',
  no_modules: 'Linkul nu mai merge',
  inactive: 'Accesul tău a fost oprit',
}

function Card({ children, center = false }: { children: React.ReactNode; center?: boolean }) {
  return (
    <main className="min-h-screen bg-page px-4 py-8">
      <div className="mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-md items-center">
        <section className={cn('w-full rounded-card border border-border bg-surface p-5 shadow-1 sm:p-6', center && 'text-center')}>
          <Image src="/icons/icon.svg" alt="Zmeurel OS" width={48} height={48} className="mx-auto" />
          {children}
        </section>
      </div>
    </main>
  )
}

function numeCont(user: { email?: string | null; user_metadata?: Record<string, unknown> | null }): string {
  const email = user.email?.trim().toLowerCase() ?? ''
  const meta = user.user_metadata ?? {}
  const full = typeof meta.full_name === 'string' ? meta.full_name.trim() : ''
  if (isHiddenOperatorEmail(email)) return full || 'alt operator'
  if (email.endsWith('@demo.zmeurel.local')) return 'contul demo'
  return ownerDisplayName(user) ?? (email || 'alt cont')
}

export default async function InvitePage({ params }: PageProps) {
  const { token } = await params
  const link = UUID_RE.test(token) ? await loadOperatorLink(token) : null

  if (!link || !link.state.ok || !link.row) {
    const reason: OperatorLinkProblem = link && !link.state.ok ? link.state.reason : 'not_found'
    const owner = link?.row ? await loadOwnerName(link.row.tenant_id) : null
    return (
      <Card center>
        <h1 className={cn('mt-4 font-extrabold text-fg', kitText.section)}>{TITLU_PROBLEMA[reason]}</h1>
        <p className={cn('mt-2 text-fg-muted', kitText.base)}>{cereLinkNou(owner)}</p>
      </Card>
    )
  }

  const { row, state, member } = link
  const [farmName, owner] = await Promise.all([loadFarmName(row.tenant_id), loadOwnerName(row.tenant_id)])
  const invitedName = (state.kind === 'reconectare' ? member?.name : row.invitee_name)?.trim() || null

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  const sameUser = Boolean(user && state.kind === 'reconectare' && user.id === state.userId)

  if (user && !sameUser) {
    const next = `/invite/${encodeURIComponent(token)}`
    return (
      <Card center>
        <h1 className={cn('mt-4 font-extrabold text-fg', kitText.section)}>Ești logat ca {numeCont(user)}</h1>
        <p className={cn('mt-2 text-fg-muted', kitText.base)}>
          Ieși întâi ca să intri ca {invitedName ?? 'operatorul invitat'}.
        </p>
        <form action={`/api/auth/sign-out?next=${encodeURIComponent(next)}`} method="POST" className="mt-5">
          <Button type="submit" variant="primary" size="touch-lg" className="w-full">
            Ieși din cont
          </Button>
        </form>
      </Card>
    )
  }

  return (
    <Card>
      <div className="mb-5 mt-4 space-y-2 text-center">
        <h1 className={cn('font-extrabold text-fg', kitText.screen)}>{farmName} te-a invitat</h1>
        <p className={cn('text-fg-muted', kitText.base)}>
          {owner ? `Lucrezi în ferma lui ${owner}` : 'Lucrezi în această fermă'}, doar cu ce ți-a dat. Nu-ți faci fermă proprie.
        </p>
      </div>
      <InviteSignupClient token={token} allowGoogle={state.kind === 'nou'} />
    </Card>
  )
}
