import { redirect } from 'next/navigation'

import { numePropus } from '@/lib/auth/cont-nou'
import { createClient } from '@/lib/supabase/server'
import { getTenantIdOrNull } from '@/lib/tenant/get-tenant'

import { FermaNouaClient } from './FermaNouaClient'

/**
 * După contul nou: o singură întrebare, numele fermei și localitatea (promptul 31). Fără „Ce cultivi?”: cultura
 * vine din prima parcelă. Demo-ul nu ajunge aici.
 */
export default async function FermaNouaPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  if (user.email?.toLowerCase().endsWith('@demo.zmeurel.local')) redirect('/dashboard')

  const tenantId = await getTenantIdOrNull(supabase)
  if (!tenantId) redirect('/start')

  const { data } = await supabase.from('tenants').select('nume_ferma, localitate, owner_user_id').eq('id', tenantId).maybeSingle()
  // Operatorii și cei fără fermă proprie nu au ce completa aici.
  if (!data || data.owner_user_id !== user.id) redirect('/dashboard')

  return <FermaNouaClient numeInitial={numePropus(data.nume_ferma)} localitateInitiala={data.localitate?.trim() ?? ''} tenantId={tenantId} />
}
