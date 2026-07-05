import { NextResponse } from 'next/server'

import {
  GOOGLE_CONTACTS_TENANT_ID,
  syncGoogleContacts,
} from '@/lib/integrations/google-contacts-sync'
import { captureApiError } from '@/lib/monitoring/report-error'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function hasValidCronSecret(request: Request): boolean {
  const expected = process.env.CRON_SECRET
  if (!expected) return false

  return request.headers.get('authorization') === `Bearer ${expected}`
}

export async function GET(request: Request) {
  if (!hasValidCronSecret(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const result = await syncGoogleContacts()
    return NextResponse.json(result)
  } catch (error) {
    captureApiError(error, {
      route: '/api/cron/sync-google-contacts',
      tenantId: GOOGLE_CONTACTS_TENANT_ID,
    })
    return NextResponse.json(
      { error: 'Google Contacts sync failed' },
      { status: 500 },
    )
  }
}
