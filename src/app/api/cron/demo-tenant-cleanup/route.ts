import { NextResponse } from 'next/server'

import { captureApiError } from '@/lib/monitoring/sentry'
import { isProtectedDemoCleanupOwnerUserId } from '@/lib/auth/protected-account'
import { createServiceRoleClient } from '@/lib/supabase/admin'
import {
  deleteTenantScopedData,
  TENANT_DESTRUCTIVE_CLEANUP_SCOPES,
  type TenantCleanupError,
} from '@/lib/tenant/destructive-cleanup'

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

  const admin = createServiceRoleClient()
  let deletedTenants = 0
  let deletedUsers = 0
  const errors: string[] = []

  try {
    const { data: superadminProfiles, error: superadminFetchError } = await admin
      .from('profiles')
      .select('id')
      .eq('is_superadmin', true)

    if (superadminFetchError) {
      throw new Error(`Fetch superadmins: ${superadminFetchError.message}`)
    }

    const protectedOwnerIds = new Set(
      ((superadminProfiles ?? []) as Array<{ id: string | null }>)
        .map((row) => row.id)
        .filter((id): id is string => typeof id === 'string' && id.length > 0),
    )

    // Find expired demo tenants directly — no N+1 needed
    type TenantRow = { id: string; owner_user_id: string | null }
    const { data: expiredRaw, error: fetchError } = await admin
      .from('tenants')
      .select('id, owner_user_id' as 'id')
      .eq('is_demo' as 'id', true as unknown as string)
      .lt('expires_at' as 'id', new Date().toISOString())

    if (fetchError) throw new Error(`Fetch demo tenants: ${fetchError.message}`)

    const expired = (expiredRaw ?? []) as unknown as TenantRow[]

    // Guard: never touch protected owners (superadmins + explicit env allowlist)
    const safe = expired.filter((tenant) => {
      if (!tenant.owner_user_id) return true
      if (protectedOwnerIds.has(tenant.owner_user_id)) return false
      if (isProtectedDemoCleanupOwnerUserId(tenant.owner_user_id)) return false
      return true
    })

    if (safe.length === 0) {
      return NextResponse.json({ ok: true, deletedTenants: 0, deletedUsers: 0, message: 'Nothing to clean up.' })
    }

    const cleanedTenantIds: string[] = []
    const ownerIdByTenantId = new Map(
      safe
        .map((tenant) => [tenant.id, tenant.owner_user_id] as const)
        .filter(([, ownerUserId]) => Boolean(ownerUserId))
    )

    for (const tenant of safe) {
      try {
        const cleanupResult = await deleteTenantScopedData(admin, tenant.id, {
          scope: TENANT_DESTRUCTIVE_CLEANUP_SCOPES.demoTenantCleanup,
          verifyCriticalTables: true,
        })
        const nonCriticalFailures = cleanupResult.steps.filter(
          (step) => step.status === 'failed' && !step.critical
        )
        if (nonCriticalFailures.length > 0) {
          errors.push(
            `tenant ${tenant.id} non-critical cleanup warnings: ${nonCriticalFailures
              .map((step) => step.target)
              .join(', ')}`
          )
        }
        cleanedTenantIds.push(tenant.id)
      } catch (err) {
        const cleanupError = err as TenantCleanupError | Error
        const message = cleanupError instanceof Error ? cleanupError.message : 'unknown'
        errors.push(`tenant ${tenant.id} cleanup failed: ${message}`)
      }
    }

    // Delete tenants
    let tenantIdsWithDeletedTenantRow: string[] = []
    if (cleanedTenantIds.length > 0) {
      const { error: tenantErr } = await admin.from('tenants').delete().in('id', cleanedTenantIds)
      if (tenantErr) {
        errors.push(`tenants: ${tenantErr.message}`)
      } else {
        deletedTenants = cleanedTenantIds.length
        tenantIdsWithDeletedTenantRow = cleanedTenantIds
      }
    }

    // Delete auth users
    const ownerIds = tenantIdsWithDeletedTenantRow
      .map((tenantId) => ownerIdByTenantId.get(tenantId))
      .filter(Boolean) as string[]

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
