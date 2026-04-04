import webpush from 'web-push'

import { getAssociationRoleForUserId } from '@/lib/association/resolve-association-role-server'
import { getSupabaseAdmin } from '@/lib/supabase/admin'
import { shouldSendWebPushForType } from '@/lib/notifications/config'
import { getNotificationHref } from '@/lib/notifications/navigation'

const VAPID_SUBJECT = 'mailto:popa.andrei.sv@gmail.com'

let vapidConfigured = false

function ensureVapidConfigured(): boolean {
  if (vapidConfigured) return true
  const pub = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
  const priv = process.env.VAPID_PRIVATE_KEY
  if (!pub?.trim() || !priv?.trim()) {
    return false
  }
  webpush.setVapidDetails(VAPID_SUBJECT, pub.trim(), priv.trim())
  vapidConfigured = true
  return true
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyAdmin = any

function buildPushPayload(input: {
  title: string
  body: string
  url: string
  notificationId: string
  tag: string
}): string {
  return JSON.stringify({
    title: input.title,
    body: input.body,
    url: input.url,
    notificationId: input.notificationId,
    tag: input.tag,
    actions: [],
  })
}

export async function sendPushToUser(
  userId: string,
  title: string,
  body: string,
  data?: { notificationId?: string; type?: string; urlPath?: string },
): Promise<void> {
  if (!ensureVapidConfigured()) return

  try {
    const admin = getSupabaseAdmin() as AnyAdmin
    const { data: subs, error } = await admin.from('push_subscriptions').select('*').eq('user_id', userId)

    if (error) {
      console.error('[push] list subscriptions', error)
      return
    }

    const rows = (subs ?? []) as Array<{
      id: string
      endpoint: string
      keys_p256dh: string
      keys_auth: string
    }>

    if (rows.length === 0) return

    const role = await getAssociationRoleForUserId(userId)
    const type = data?.type ?? 'system'
    const urlPath =
      data?.urlPath ??
      getNotificationHref({ type, data: null }, role)

    const payload = buildPushPayload({
      title,
      body: body.slice(0, 120),
      url: urlPath,
      notificationId: data?.notificationId ?? '',
      tag: data?.notificationId ?? `zmeurel-${type}`,
    })

    await Promise.all(
      rows.map(async (row) => {
        const subscription = {
          endpoint: row.endpoint,
          keys: {
            p256dh: row.keys_p256dh,
            auth: row.keys_auth,
          },
        }

        try {
          await webpush.sendNotification(subscription, payload, {
            TTL: 3600,
            urgency: 'high',
          })
        } catch (e: unknown) {
          const status = (e as { statusCode?: number })?.statusCode
          if (status === 410 || status === 404) {
            const { error: delErr } = await admin.from('push_subscriptions').delete().eq('id', row.id)
            if (delErr) console.error('[push] delete stale subscription', delErr)
          } else {
            console.warn('[push] send failed', status, e)
          }
        }
      }),
    )
  } catch (e) {
    console.warn('[push] sendPushToUser', e)
  }
}

export async function sendPushToAssociationAdmins(
  title: string,
  body: string,
  data?: { notificationId?: string; type?: string },
): Promise<void> {
  if (!ensureVapidConfigured()) return

  try {
    const admin = getSupabaseAdmin() as AnyAdmin
    const { data: members, error } = await admin
      .from('association_members')
      .select('user_id')
      .in('role', ['admin', 'moderator'])

    if (error) {
      console.error('[push] association admins', error)
      return
    }

    const rows = (members ?? []) as { user_id: string }[]
    const ids = [...new Set(rows.map((m) => m.user_id).filter((id): id is string => id.length > 0))]
    await Promise.all(ids.map((uid) => sendPushToUser(uid, title, body, data)))
  } catch (e) {
    console.warn('[push] sendPushToAssociationAdmins', e)
  }
}

/**
 * După crearea înregistrării `notifications` — best-effort, nu aruncă.
 */
export function fireWebPushForNotification(input: {
  userId: string
  notificationId: string | null
  type: string
  title: string
  body?: string | null
  /** URL path relativ (ex. `/comenzi`) — deja calculat la insert. */
  urlPath?: string
}): void {
  const { userId, notificationId, type, title, body, urlPath } = input
  if (!notificationId) return
  if (!shouldSendWebPushForType(type)) return

  void sendPushToUser(userId, title, body?.trim() || ' ', {
    notificationId,
    type,
    urlPath,
  })
}
