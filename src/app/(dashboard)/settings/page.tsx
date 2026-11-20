import { getTenantLegalDocs } from '@/lib/legal-docs/server'
import { getFarmProfileOrNull } from '@/lib/setari/farm-profile-server'
import { createClient } from '@/lib/supabase/server'

import { SetariPageClient, type LegalDocsSummary } from './SetariPageClient'

async function getLegalDocsSummary(tenantId: string | null): Promise<LegalDocsSummary | null> {
  if (!tenantId) return null
  try {
    const supabase = await createClient()
    const { status } = await getTenantLegalDocs(supabase, tenantId)
    return status
  } catch (error) {
    console.error('[settings] starea documentelor legale nu s-a putut citi', error)
    return null
  }
}

export default async function SettingsPage() {
  const farm = await getFarmProfileOrNull()
  const legal = await getLegalDocsSummary(farm?.tenantId ?? null)
  return <SetariPageClient farm={farm} legal={legal} />
}
