import { getFarmProfileOrNull } from '@/lib/setari/farm-profile-server'
import { createClient } from '@/lib/supabase/server'

import { ContPageClient } from './ContPageClient'

async function getAccountPhone(): Promise<string | null> {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return null
    const { data } = await supabase.from('profiles').select('phone').eq('id', user.id).maybeSingle()
    return data?.phone?.trim() || null
  } catch {
    return null
  }
}

export default async function SettingsContPage() {
  const [farm, phone] = await Promise.all([getFarmProfileOrNull(), getAccountPhone()])
  return <ContPageClient tenantId={farm?.tenantId ?? null} accountPhone={phone} />
}
