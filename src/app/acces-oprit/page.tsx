import Image from 'next/image'
import { redirect } from 'next/navigation'

import { Button, kitText } from '@/components/kit'
import { cereLinkNou, isHiddenOperatorEmail } from '@/lib/farm-members/operator-link'
import { loadOwnerName } from '@/lib/farm-members/operator-link-server'
import { getSupabaseAdmin } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { cn } from '@/lib/utils'

export const dynamic = 'force-dynamic'

/**
 * Operatorul din link al cărui acces a fost oprit („Dezactivează”): n-are fermă proprie și nici parolă,
 * deci singura cale înapoi e un link nou de la proprietar. Proxy-ul îl trimite aici în loc de /start.
 */
export default async function AccesOpritPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')
  if (!isHiddenOperatorEmail(user.email)) redirect('/dashboard')

  // Ferma din care a fost scos (ultima legătură), ca să știe pe cine să roage.
  const { data: member } = await getSupabaseAdmin()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .from('farm_members' as any)
    .select('tenant_id')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  const tenantId = (member as { tenant_id?: string } | null)?.tenant_id
  const owner = tenantId ? await loadOwnerName(tenantId) : null

  return (
    <main className="min-h-screen bg-page px-4 py-8">
      <div className="mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-md items-center">
        <section className="w-full rounded-card border border-border bg-surface p-6 text-center shadow-1">
          <Image src="/icons/icon.svg" alt="Zmeurel OS" width={48} height={48} className="mx-auto" />
          <h1 className={cn('mt-4 font-extrabold text-fg', kitText.section)}>Accesul tău a fost oprit</h1>
          <p className={cn('mt-2 text-fg-muted', kitText.base)}>{cereLinkNou(owner)}</p>
          <form action="/api/auth/sign-out?next=/" method="POST" className="mt-5">
            <Button type="submit" variant="neutral" size="touch-lg" className="w-full">
              Ieși din cont
            </Button>
          </form>
        </section>
      </div>
    </main>
  )
}
