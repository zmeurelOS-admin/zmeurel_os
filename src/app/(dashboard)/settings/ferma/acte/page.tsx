import { redirect } from 'next/navigation'

import { ActeFermeiClient } from '@/components/acte/ActeFermeiClient'
import { createLegalDocSignedUrl, getTenantLegalDocs } from '@/lib/legal-docs/server'
import { createClient } from '@/lib/supabase/server'
import { getTenantIdOrNull } from '@/lib/tenant/get-tenant'

/** Actele fermei (fostele Documente legale), sub Setări → Ferma. */
export default async function ActeFermeiPage() {
  const supabase = await createClient()
  const tenantId = await getTenantIdOrNull(supabase)

  if (!tenantId) {
    redirect('/dashboard')
  }

  const legalDocs = await getTenantLegalDocs(supabase, tenantId)
  const signedPhotoUrl = await createLegalDocSignedUrl(supabase, legalDocs.doc?.certificate_photo_url)

  return <ActeFermeiClient initialDocument={legalDocs.doc} initialSignedPhotoUrl={signedPhotoUrl} />
}
