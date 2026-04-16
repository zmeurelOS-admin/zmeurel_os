import { getAssociationRoleForUserId } from '@/lib/association/resolve-association-role-server'
import { getNotificationHref } from '@/lib/notifications/navigation'
import { fireWebPushForNotification } from '@/lib/notifications/send-push'
import { getSupabaseAdmin } from '@/lib/supabase/admin'
import type { Database, Json } from '@/types/supabase'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyAdmin = any

export const NOTIFICATION_TYPES = {
  order_new: 'order_new',
  order_status_changed: 'order_status_changed',
  product_listed: 'product_listed',
  product_unlisted: 'product_unlisted',
  producer_approved: 'producer_approved',
  producer_suspended: 'producer_suspended',
  offer_new: 'offer_new',
  offer_approved: 'offer_approved',
  offer_rejected: 'offer_rejected',
  legal_docs_expiring: 'legal_docs_expiring',
  legal_docs_expired: 'legal_docs_expired',
  weekly_sales_summary: 'weekly_sales_summary',
  system: 'system',
} as const

export type NotificationTypeKey = keyof typeof NOTIFICATION_TYPES
export type NotificationTypeValue = (typeof NOTIFICATION_TYPES)[NotificationTypeKey]

async function mergeDataWithNavigationUrl(
  userId: string,
  type: string,
  data: Record<string, unknown> | null | undefined,
  entityType: string | null,
  entityId: string | null,
): Promise<{ data: Json; url: string }> {
  const role = await getAssociationRoleForUserId(userId)
  const base = { ...(data ?? {}) }
  const url = getNotificationHref(
    { type, data: base as Json, entity_type: entityType, entity_id: entityId },
    role,
  )
  return { data: { ...base, url } as Json, url }
}

export async function createNotification(
  userId: string,
  type: string,
  title: string,
  body?: string | null,
  data?: Record<string, unknown> | null,
  entityType?: string | null,
  entityId?: string | null,
): Promise<string | null> {
  try {
    const admin = getSupabaseAdmin() as AnyAdmin
    const { data: dataJson, url } = await mergeDataWithNavigationUrl(userId, type, data, entityType ?? null, entityId ?? null)
    const payload: Database['public']['Tables']['notifications']['Insert'] = {
      user_id: userId,
      type,
      title,
      body: body ?? null,
      data: dataJson,
      entity_type: entityType ?? null,
      entity_id: entityId ?? null,
    }
    const { data: row, error } = await admin.from('notifications').insert(payload).select('id').single()
    if (error) throw error
    const id = (row as { id: string } | null)?.id ?? null
    if (id) {
      fireWebPushForNotification({
        userId,
        notificationId: id,
        type,
        title,
        body,
        urlPath: url,
      })
    }
    return id
  } catch (e) {
    console.error('[notifications] createNotification', e)
    return null
  }
}

export async function createNotificationsForAssociationAdmins(
  type: string,
  title: string,
  body?: string | null,
  data?: Record<string, unknown> | null,
  entityType?: string | null,
  entityId?: string | null,
): Promise<void> {
  try {
    const admin = getSupabaseAdmin() as AnyAdmin
    const { data: members, error } = await admin
      .from('association_members')
      .select('user_id')
      .in('role', ['admin', 'moderator'])

    if (error) throw error
    const rows = (members ?? []) as { user_id: string }[]
    const ids = [...new Set(rows.map((m) => m.user_id).filter((id) => id.length > 0))]
    await Promise.all(
      ids.map((uid: string) => createNotification(uid, type, title, body, data, entityType, entityId)),
    )
  } catch (e) {
    console.error('[notifications] createNotificationsForAssociationAdmins', e)
  }
}

export async function createNotificationForTenantOwner(
  tenantId: string,
  type: string,
  title: string,
  body?: string | null,
  data?: Record<string, unknown> | null,
  entityType?: string | null,
  entityId?: string | null,
): Promise<string | null> {
  try {
    const admin = getSupabaseAdmin() as AnyAdmin
    const { data: tenant, error } = await admin
      .from('tenants')
      .select('owner_user_id')
      .eq('id', tenantId)
      .maybeSingle()

    if (error) throw error
    const ownerId = (tenant as { owner_user_id: string | null } | null)?.owner_user_id
    if (!ownerId) return null
    return createNotification(ownerId, type, title, body, data, entityType, entityId)
  } catch (e) {
    console.error('[notifications] createNotificationForTenantOwner', e)
    return null
  }
}
