import { redirect } from 'next/navigation'

import { LegalDocumentsPageClient } from '@/components/settings/LegalDocumentsPageClient'
import { createLegalDocSignedUrl, getTenantLegalDocs } from '@/lib/legal-docs/server'
import { createClient } from '@/lib/supabase/server'
import { getTenantByIdOrNull, getTenantIdOrNull } from '@/lib/tenant/get-tenant'

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
      farmName={tenant?.nume_ferma ?? null}
      initialDocument={legalDocs.doc}
      initialSignedPhotoUrl={signedPhotoUrl}
      initialStatus={legalDocs.status}
    />
  )
}
