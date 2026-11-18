import { NextResponse } from 'next/server'

import { captureApiError } from '@/lib/monitoring/report-error'
import { NOTIFICATION_TYPES } from '@/lib/notifications/create'
import { getNotificationHref } from '@/lib/notifications/navigation'
import { sendPushToUser } from '@/lib/notifications/send-push'
import { getSupabaseAdmin } from '@/lib/supabase/admin'
import {
  addDaysYmd,
  buildDeliveryReminders,
  todayInBucharest,
  type ReminderOrderInput,
} from '@/lib/vanzari-butasi/delivery-reminders'

export const runtime = 'nodejs'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyAdmin = any

function hasValidCronSecret(request: Request): boolean {
  const expected = process.env.CRON_SECRET
  if (!expected) return false

  const headerSecret = request.headers.get('x-cron-secret')
  const bearer = request.headers.get('authorization')
  const bearerSecret = bearer?.startsWith('Bearer ') ? bearer.slice(7) : null

  return headerSecret === expected || bearerSecret === expected
}

/**
 * Rulează zilnic (vercel.json). Trimite proprietarului fermei un memento pentru livrările
 * de material săditor de mâine și, pentru comenzile cu termen îndepărtat, cu o săptămână înainte.
 * Doar citește comenzile și inserează notificări — nu modifică nicio comandă.
 */
export async function GET(request: Request) {
  if (!hasValidCronSecret(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const admin = getSupabaseAdmin() as AnyAdmin
    const today = todayInBucharest()
    const targetDates = [addDaysYmd(today, 1), addDaysYmd(today, 7)]

    const { data: rows, error } = await admin
      .from('vanzari_butasi')
      .select(
        'id, tenant_id, client_id, client_nume_manual, data_comanda, data_livrare_estimata, status, total_lei, avans_suma, vanzari_butasi_items(soi, cantitate)',
      )
      .in('data_livrare_estimata', targetDates)
      .not('status', 'in', '(livrata,anulata)')

    if (error) throw error

    const orders: ReminderOrderInput[] = ((rows ?? []) as Array<
      Omit<ReminderOrderInput, 'items'> & { vanzari_butasi_items: Array<{ soi: string; cantitate: number }> | null }
    >).map(({ vanzari_butasi_items, ...rest }) => ({ ...rest, items: vanzari_butasi_items ?? [] }))

    if (orders.length === 0) {
      return NextResponse.json({ ok: true, today, reminders: 0 })
    }

    const clientIds = [...new Set(orders.map((o) => o.client_id).filter((id): id is string => Boolean(id)))]
    const clientNames = new Map<string, string>()
    if (clientIds.length) {
      const { data: clienti, error: clientiError } = await admin
        .from('clienti')
        .select('id, nume_client')
        .in('id', clientIds)
      if (clientiError) throw clientiError
      for (const c of (clienti ?? []) as Array<{ id: string; nume_client: string | null }>) {
        if (c.nume_client?.trim()) clientNames.set(c.id, c.nume_client.trim())
      }
    }

    const reminders = buildDeliveryReminders(orders, clientNames, today)

    const tenantIds = [...new Set(reminders.map((r) => r.tenantId))]
    const { data: tenants, error: tenantsError } = await admin
      .from('tenants')
      .select('id, owner_user_id')
      .in('id', tenantIds)
    if (tenantsError) throw tenantsError
    const ownerByTenant = new Map<string, string>()
    for (const t of (tenants ?? []) as Array<{ id: string; owner_user_id: string | null }>) {
      if (t.owner_user_id) ownerByTenant.set(t.id, t.owner_user_id)
    }

    const type = NOTIFICATION_TYPES.butasi_delivery_reminder
    const urlPath = getNotificationHref({ type, data: null }, null)
    let created = 0
    let skipped = 0
    let pushed = 0

    for (const reminder of reminders) {
      const userId = ownerByTenant.get(reminder.tenantId)
      if (!userId) {
        skipped += 1
        continue
      }

      // Fără dubluri dacă jobul rulează de două ori în aceeași zi.
      const { data: existing, error: existingError } = await admin
        .from('notifications')
        .select('id')
        .eq('user_id', userId)
        .eq('type', type)
        .eq('data->>reminder_key', reminder.reminderKey)
        .limit(1)
      if (existingError) throw existingError
      if ((existing ?? []).length > 0) {
        skipped += 1
        continue
      }

      const data = {
        reminder_key: reminder.reminderKey,
        kind: reminder.kind,
        delivery_date: reminder.deliveryDate,
        order_ids: reminder.orderIds,
        url: urlPath,
      }
      const { data: inserted, error: insertError } = await admin
        .from('notifications')
        .insert({
          user_id: userId,
          type,
          title: reminder.title,
          body: reminder.body,
          data,
          entity_type: 'vanzari_butasi',
          entity_id: reminder.orderIds.length === 1 ? reminder.orderIds[0] : null,
        })
        .select('id')
        .single()
      if (insertError) throw insertError
      created += 1

      // Așteptăm push-ul aici (în cron funcția se poate opri înainte ca un push „fire-and-forget” să plece).
      const push = await sendPushToUser(userId, reminder.title, reminder.body, {
        notificationId: (inserted as { id: string }).id,
        type,
        urlPath,
        notificationData: data,
      })
      pushed += push.sent
    }

    return NextResponse.json({ ok: true, today, reminders: reminders.length, created, skipped, pushed })
  } catch (error) {
    captureApiError(error, { route: '/api/cron/butasi-delivery-reminders' })
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to send delivery reminders' },
      { status: 500 },
    )
  }
}
