import { sanitizeForLog, toSafeErrorContext } from '@/lib/logging/redaction'
import { sendPushToUser } from '@/lib/notifications/send-push'
import { getSupabaseAdmin } from '@/lib/supabase/admin'

import { formatNotificationPayload } from './format-notification'
import type { SchedulerResult } from './types'

export interface NotifierInput {
  results: SchedulerResult[]
}

export interface NotifierOutput {
  tenantsNotified: number
  notificationsSent: number
  notificationsFailed: number
  errors: Array<{ tenantId: string; error: string }>
}

type TenantUserRow = {
  id: string
}

type PushSubscriptionRow = {
  user_id: string
}

type NotificationInsertRow = {
  id: string
  user_id: string
}

async function listTenantUserIdsWithPushSubscriptions(tenantId: string): Promise<string[]> {
  const admin = getSupabaseAdmin()
  const { data: subs, error: subsError } = await admin
    .from('push_subscriptions')
    .select('user_id')

  if (subsError) {
    throw new Error(`Failed to load push subscriptions for tenant ${tenantId}: ${subsError.message}`)
  }

  const distinctUserIds = [...new Set(((subs ?? []) as PushSubscriptionRow[]).map((row) => row.user_id))]
  if (distinctUserIds.length === 0) {
    return []
  }

  const { data: profiles, error: profilesError } = await admin
    .from('profiles')
    .select('id')
    .eq('tenant_id', tenantId)
    .in('id', distinctUserIds)

  if (profilesError) {
    throw new Error(`Failed to load tenant profiles for tenant ${tenantId}: ${profilesError.message}`)
  }

  return ((profiles ?? []) as TenantUserRow[]).map((row) => row.id)
}

async function createNotificationLogs(
  tenantId: string,
  userIds: string[],
  title: string,
  body: string,
  data: Record<string, unknown>
): Promise<Map<string, string>> {
  const admin = getSupabaseAdmin()
  const payload = userIds.map((userId) => ({
    user_id: userId,
    type: 'tratament_reminder',
    title,
    body,
    data: {
      ...data,
      url: '/tratamente',
    },
    entity_type: 'aplicari_tratament',
    entity_id: tenantId,
  }))

  const { data: inserted, error } = await admin
    .from('notifications')
    .insert(payload)
    .select('id,user_id')

  if (error) {
    throw new Error(`Failed to create treatment notification log for tenant ${tenantId}: ${error.message}`)
  }

  return new Map(((inserted ?? []) as NotificationInsertRow[]).map((row) => [row.user_id, row.id]))
}

/**
 * Trimite notificările push pentru aplicările programate azi/mâine și scrie loguri în `notifications`.
 * Exemplu: `sendScheduledNotifications({ results })`
 */
export async function sendScheduledNotifications(input: NotifierInput): Promise<NotifierOutput> {
  const summary: NotifierOutput = {
    tenantsNotified: 0,
    notificationsSent: 0,
    notificationsFailed: 0,
    errors: [],
  }

  for (const result of input.results) {
    const payload = formatNotificationPayload(result.azi, result.maine)
    if (!payload) {
      continue
    }

    try {
      const userIds = await listTenantUserIdsWithPushSubscriptions(result.tenantId)
      if (userIds.length === 0) {
        continue
      }

      const notificationIds = await createNotificationLogs(result.tenantId, userIds, payload.title, payload.body, {
        source: 'tratamente_scheduler',
        azi: result.azi.length,
        maine: result.maine.length,
      })

      let tenantSent = 0
      let tenantFailed = 0

      for (const userId of userIds) {
        const pushResult = await sendPushToUser(userId, payload.title, payload.body, {
          notificationId: notificationIds.get(userId),
          type: 'tratament_reminder',
          urlPath: '/tratamente',
        })

        tenantSent += pushResult.sent
        tenantFailed += pushResult.failed
      }

      summary.tenantsNotified += 1
      summary.notificationsSent += tenantSent
      summary.notificationsFailed += tenantFailed
    } catch (error) {
      console.error(
        '[tratamente/notifier] failed to send scheduled notifications',
        sanitizeForLog({
          tenantId: result.tenantId,
          error: toSafeErrorContext(error),
        })
      )
      summary.errors.push({
        tenantId: result.tenantId,
        error: error instanceof Error ? error.message : 'Unknown notifier error',
      })
    }
  }

  return summary
}

