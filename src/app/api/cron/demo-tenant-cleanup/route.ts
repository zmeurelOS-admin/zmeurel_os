import { NextResponse } from 'next/server'

import { captureApiError } from '@/lib/monitoring/sentry'
import { createServiceRoleClient } from '@/lib/supabase/admin'

export const runtime = 'nodejs'

const PROTECTED_EMAIL = 'popa.andrei.sv@gmail.com'

function hasValidCronSecret(request: Request): boolean {
  const expected = process.env.CRON_SECRET
  if (!expected) return false
  const headerSecret = request.headers.get('x-cron-secret')
  const bearer = request.headers.get('authorization')
  const bearerSecret = bearer?.startsWith('Bearer ') ? bearer.slice(7) : null
  return headerSecret === expected || bearerSecret === expected
}

const TENANT_TABLES = [
  'vanzari_butasi_items',
  'miscari_stoc',
  'alert_dismissals',
  'integrations_google_contacts',
  'comenzi',
  'vanzari_butasi',
  'vanzari',
  'recoltari',
  'cheltuieli_diverse',
  'activitati_agricole',
  'investitii',
  'clienti',
  'culegatori',
  'parcele',
] as const

export async function GET(request: Request) {
  if (!hasValidCronSecret(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const admin = createServiceRoleClient()
  let deletedTenants = 0
  let deletedUsers = 0
  const errors: string[] = []

  try {
    // Resolve protected owner ID to guarantee we never touch it
    const { data: protectedUser } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 })
    const protectedId = protectedUser?.users?.find(
      (u) => u.email?.toLowerCase() === PROTECTED_EMAIL.toLowerCase()
    )?.id ?? null

    // Find expired demo tenants directly — no N+1 needed
    type TenantRow = { id: string; owner_user_id: string | null }
    const { data: expiredRaw, error: fetchError } = await admin
      .from('tenants')
      .select('id, owner_user_id' as 'id')
      .eq('is_demo' as 'id', true as unknown as string)
      .lt('expires_at' as 'id', new Date().toISOString())

    if (fetchError) throw new Error(`Fetch demo tenants: ${fetchError.message}`)

    const expired = (expiredRaw ?? []) as unknown as TenantRow[]

    // Guard: never touch the protected owner
    const safe = expired.filter((t) => !protectedId || t.owner_user_id !== protectedId)

    if (safe.length === 0) {
      return NextResponse.json({ ok: true, deletedTenants: 0, deletedUsers: 0, message: 'Nothing to clean up.' })
    }

    const tenantIds = safe.map((t) => t.id)
    const ownerIds = safe.map((t) => t.owner_user_id).filter(Boolean) as string[]

    // Delete all child table rows
    for (const table of TENANT_TABLES) {
      try {
        await admin.from(table).delete().in('tenant_id', tenantIds)
      } catch (err) {
        errors.push(`${table}: ${err instanceof Error ? err.message : 'unknown'}`)
      }
    }

    // analytics_events — cast to bypass narrow type
    try {
      await admin
        .from('analytics_events' as unknown as 'alert_dismissals')
        .delete()
        .in('tenant_id', tenantIds)
    } catch { /* non-critical */ }

    // Delete tenants
    const { error: tenantErr } = await admin.from('tenants').delete().in('id', tenantIds)
    if (tenantErr) {
      errors.push(`tenants: ${tenantErr.message}`)
    } else {
      deletedTenants = tenantIds.length
    }

    // Delete auth users
    for (const userId of ownerIds) {
      try {
        const { error: authErr } = await admin.auth.admin.deleteUser(userId)
        if (!authErr) {
          deletedUsers += 1
        } else {
          errors.push(`auth user ${userId}: ${authErr.message}`)
        }
      } catch (err) {
        errors.push(`auth user ${userId}: ${err instanceof Error ? err.message : 'unknown'}`)
      }
    }

    console.info('[demo-tenant-cleanup] done', { deletedTenants, deletedUsers, errors: errors.length })

    return NextResponse.json({
      ok: true,
      deletedTenants,
      deletedUsers,
      ...(errors.length > 0 ? { errors } : {}),
    })
  } catch (error) {
    captureApiError(error, { route: '/api/cron/demo-tenant-cleanup' })
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Cleanup failed' },
      { status: 500 }
    )
  }
}
