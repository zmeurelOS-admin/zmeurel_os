import { getFarmProfileOrNull } from '@/lib/setari/farm-profile-server'
import { createClient } from '@/lib/supabase/server'

import { FermaPageClient } from './FermaPageClient'

async function getSavedLocation(tenantId: string | null): Promise<{ lat: number; lng: number } | null> {
  if (!tenantId) return null
  try {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('tenant_settings')
      .select('latitudine_default, longitudine_default')
      .eq('tenant_id', tenantId)
      .maybeSingle()
    if (error || !data) return null
    const lat = data.latitudine_default
    const lng = data.longitudine_default
    return typeof lat === 'number' && typeof lng === 'number' ? { lat, lng } : null
  } catch {
    return null
  }
}

export default async function SettingsFermaPage() {
  const farm = await getFarmProfileOrNull()
  const location = await getSavedLocation(farm?.tenantId ?? null)
  return <FermaPageClient farm={farm} savedLocation={location} />
}
