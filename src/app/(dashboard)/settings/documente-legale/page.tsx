import { redirect } from 'next/navigation'

import { LegalDocumentsPageClient } from '@/components/settings/LegalDocumentsPageClient'
import { createLegalDocSignedUrl, getTenantLegalDocs } from '@/lib/legal-docs/server'
import { createClient } from '@/lib/supabase/server'
import { getTenantByIdOrNull, getTenantIdOrNull } from '@/lib/tenant/get-tenant'
import { farmDisplayName } from '@/lib/tenant/farm-display-name'

export default async function LegalDocumentsPage() {
  const supabase = await createClient()
  const tenantId = await getTenantIdOrNull(supabase)

  if (!tenantId) {
    redirect('/dashboard')
  }

  const [tenant, legalDocs] = await Promise.all([
    getTenantByIdOrNull(supabase, tenantId),
    getTenantLegalDocs(supabase, tenantId),
  ])

  const signedPhotoUrl = await createLegalDocSignedUrl(supabase, legalDocs.doc?.certificate_photo_url)

  return (
    <LegalDocumentsPageClient
      farmName={farmDisplayName(tenant?.nume_ferma)}
      initialDocument={legalDocs.doc}
      initialSignedPhotoUrl={signedPhotoUrl}
      initialStatus={legalDocs.status}
    />
  )
}
