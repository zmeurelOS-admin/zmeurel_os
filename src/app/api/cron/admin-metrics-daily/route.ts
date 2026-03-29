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
    const supabase = getSupabaseAdmin()
    const today = new Date().toISOString().slice(0, 10)
    const { data, error } = await supabase.rpc('refresh_tenant_metrics_daily', { p_date: today })

    if (error) {
      throw error
    }

    const aiConversationRetentionCutoff = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString()
    const { error: cleanupError } = await supabase
      .from('ai_conversations')
      .delete()
      .lt('created_at', aiConversationRetentionCutoff)

    if (cleanupError) {
      throw cleanupError
    }

    return NextResponse.json({ ok: true, metrics: data })
  } catch (error) {
    captureApiError(error, { route: '/api/cron/admin-metrics-daily' })
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to refresh metrics' },
      { status: 500 }
    )
  }
}
