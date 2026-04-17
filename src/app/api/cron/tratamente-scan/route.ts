import { NextResponse } from 'next/server'

import { captureApiError } from '@/lib/monitoring/sentry'
import { scanAllTenants, sendScheduledNotifications } from '@/lib/tratamente/scheduler'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function hasValidCronSecret(request: Request): boolean {
  const expected = process.env.CRON_SECRET
  if (!expected) return false

  const headerSecret = request.headers.get('x-cron-secret')
  const bearer = request.headers.get('authorization')
  const bearerSecret = bearer?.startsWith('Bearer ') ? bearer.slice(7) : null

  return headerSecret === expected || bearerSecret === expected
}

export async function GET(request: Request) {
  if (!hasValidCronSecret(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const results = await scanAllTenants()
    const notifResult = await sendScheduledNotifications({ results })
    const summary = {
      tenantsScanned: results.length,
      totalAzi: results.reduce((sum, result) => sum + result.azi.length, 0),
      totalMaine: results.reduce((sum, result) => sum + result.maine.length, 0),
      notificationsSent: notifResult.notificationsSent,
      notificationsFailed: notifResult.notificationsFailed,
      errors: notifResult.errors,
      results,
    }

    return NextResponse.json(summary)
  } catch (error) {
    captureApiError(error, { route: '/api/cron/tratamente-scan' })
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to scan scheduled treatments' },
      { status: 500 }
    )
  }
}
