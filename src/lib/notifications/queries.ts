import type { SupabaseClient } from '@supabase/supabase-js'

import type { Database } from '@/types/supabase'

type NotificationRow = Database['public']['Tables']['notifications']['Row']

export async function getUnreadCount(supabase: SupabaseClient<Database>): Promise<number> {
  const { count, error } = await supabase
    .from('notifications')
    .select('*', { count: 'exact', head: true })
    .eq('read', false)

  if (error) {
    console.error('[notifications] getUnreadCount', error)
    return 0
  }
  return count ?? 0
}

export async function getNotifications(
  supabase: SupabaseClient<Database>,
  opts: { limit?: number; offset?: number; unreadOnly?: boolean },
): Promise<NotificationRow[]> {
  const limit = Math.min(Math.max(opts.limit ?? 30, 1), 100)
  const offset = Math.max(opts.offset ?? 0, 0)

  let q = supabase.from('notifications').select('*').order('created_at', { ascending: false })

  if (opts.unreadOnly) {
    q = q.eq('read', false)
  }

  const { data, error } = await q.range(offset, offset + limit - 1)
  if (error) {
    console.error('[notifications] getNotifications', error)
    return []
  }
  return (data ?? []) as NotificationRow[]
}

export async function markAsRead(
  supabase: SupabaseClient<Database>,
  notificationId: string,
): Promise<void> {
  const { error } = await supabase.from('notifications').update({ read: true }).eq('id', notificationId)
  if (error) console.error('[notifications] markAsRead', error)
}

export async function markAllAsRead(supabase: SupabaseClient<Database>): Promise<void> {
  const { error } = await supabase.from('notifications').update({ read: true }).eq('read', false)
  if (error) console.error('[notifications] markAllAsRead', error)
}

export async function deleteNotification(
  supabase: SupabaseClient<Database>,
  notificationId: string,
): Promise<void> {
  const { error } = await supabase.from('notifications').delete().eq('id', notificationId)
  if (error) console.error('[notifications] deleteNotification', error)
}
