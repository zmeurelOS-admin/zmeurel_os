import { getFarmProfileOrNull } from '@/lib/setari/farm-profile-server'
import { createClient } from '@/lib/supabase/server'

import { CePrimestiPageClient } from './CePrimestiPageClient'

/** Alertele meteo pleacă doar pentru fermele cu locul salvat (Setări › Ferma). */
async function areLocSalvat(tenantId: string | null): Promise<boolean> {
  if (!tenantId) return false
  try {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('tenant_settings')
      .select('latitudine_default, longitudine_default')
      .eq('tenant_id', tenantId)
      .maybeSingle()
    if (error || !data) return false
    return typeof data.latitudine_default === 'number' && typeof data.longitudine_default === 'number'
  } catch {
    return false
  }
}

export default async function NotificariSetariPage() {
  const farm = await getFarmProfileOrNull()
  const locSalvat = await areLocSalvat(farm?.tenantId ?? null)
  return <CePrimestiPageClient localitate={farm?.localitate ?? null} locSalvat={locSalvat} />
}
