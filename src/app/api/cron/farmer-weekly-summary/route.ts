import { NextResponse } from 'next/server'

import { captureApiError } from '@/lib/monitoring/sentry'
import { getSupabaseAdmin } from '@/lib/supabase/admin'

export const runtime = 'nodejs'

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
    const admin = getSupabaseAdmin()
    const rpcAdmin = admin as unknown as {
      rpc: (
        fn: 'generate_farmer_weekly_summary'
      ) => Promise<{ data: unknown; error: { message?: string } | null }>
    }
    const { data, error } = await rpcAdmin.rpc('generate_farmer_weekly_summary')

    if (error) {
      throw error
    }

    const rows = (data ?? []) as unknown as Array<{
      tenant_id: string
      week_start: string
      week_end: string
      notification_id: string | null
      item_count: number
    }>

    return NextResponse.json({
      ok: true,
      generated: rows.length,
      summaries: rows,
    })
  } catch (error) {
    captureApiError(error, { route: '/api/cron/farmer-weekly-summary' })
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to generate weekly summary' },
      { status: 500 },
    )
  }
}
