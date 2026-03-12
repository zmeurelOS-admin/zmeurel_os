'use client'

import { getSupabase } from '@/lib/supabase/client'
import { getTenantIdOrNull } from '@/lib/tenant/get-tenant'

interface AlertContext {
  userId: string
  tenantId: string | null
}

let cachedContext: AlertContext | null = null
let contextPromise: Promise<AlertContext | null> | null = null

function isDuplicateKeyError(error: unknown): boolean {
  const code = (error as { code?: string } | null)?.code
  if (code === '23505') return true

  const message = String((error as { message?: string } | null)?.message ?? '').toLowerCase()
  return message.includes('duplicate key')
}

function isMissingConflictTargetError(error: unknown): boolean {
  const message = String((error as { message?: string } | null)?.message ?? '').toLowerCase()
  return message.includes('no unique or exclusion constraint matching the on conflict specification')
}

export async function getAlertContext(): Promise<AlertContext | null> {
  if (cachedContext) return cachedContext
  if (contextPromise) return contextPromise

  contextPromise = (async () => {
    try {
      const supabase = getSupabase()
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user?.id) return null

      const tenantId = await getTenantIdOrNull(supabase)

      cachedContext = { userId: user.id, tenantId }
      return cachedContext
    } catch {
      return null
    } finally {
      contextPromise = null
    }
  })()

  return contextPromise
}

export async function getTodayDismissals(tenantId: string): Promise<string[]> {
  const supabase = getSupabase()
  const context = await getAlertContext()
  const resolvedTenantId = context?.tenantId
  if (!context?.userId || !resolvedTenantId || tenantId !== resolvedTenantId) return []

  const { data: roToday, error: todayError } = await supabase.rpc('bucharest_today')
  if (todayError) throw todayError

  const { data, error } = await supabase
    .from('alert_dismissals')
    .select('alert_key')
    .eq('tenant_id', resolvedTenantId)
    .eq('user_id', context.userId)
    .eq('dismissed_on', roToday)

  if (error) throw error
  return (data ?? []).map((row: { alert_key: string }) => row.alert_key)
}

export async function dismissAlert(tenantId: string, alertKey: string): Promise<void> {
  const supabase = getSupabase()
  const context = await getAlertContext()
  const resolvedTenantId = context?.tenantId
  if (!context?.userId || !resolvedTenantId || tenantId !== resolvedTenantId) {
    throw new Error('User context invalid')
  }

  const payload = {
    tenant_id: resolvedTenantId,
    user_id: context.userId,
    alert_key: alertKey,
  }

  const { error } = await supabase.from('alert_dismissals').upsert(
    payload,
    {
      onConflict: 'tenant_id,user_id,alert_key,dismissed_on',
      ignoreDuplicates: true,
    }
  )

  if (!error) return
  if (isDuplicateKeyError(error)) return

  // Fallback for environments where the conflict target is missing in DB schema cache.
  if (isMissingConflictTargetError(error)) {
    const { error: insertError } = await supabase.from('alert_dismissals').insert(payload)
    if (!insertError || isDuplicateKeyError(insertError)) return
    throw insertError
  }

  throw error
}

export async function dismissAlertsBulk(tenantId: string, alertKeys: string[]): Promise<void> {
  if (alertKeys.length === 0) return

  const supabase = getSupabase()
  const context = await getAlertContext()
  const resolvedTenantId = context?.tenantId
  if (!context?.userId || !resolvedTenantId || tenantId !== resolvedTenantId) {
    throw new Error('User context invalid')
  }

  const rows = alertKeys.map((alertKey) => ({
    tenant_id: resolvedTenantId,
    user_id: context.userId,
    alert_key: alertKey,
  }))

  const { error } = await supabase.from('alert_dismissals').upsert(rows, {
    onConflict: 'tenant_id,user_id,alert_key,dismissed_on',
    ignoreDuplicates: true,
  })

  if (!error) return
  if (isDuplicateKeyError(error)) return

  if (isMissingConflictTargetError(error)) {
    for (const row of rows) {
      const { error: insertError } = await supabase.from('alert_dismissals').insert(row)
      if (!insertError || isDuplicateKeyError(insertError)) continue
      throw insertError
    }
    return
  }

  throw error
}
