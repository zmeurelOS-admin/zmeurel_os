import {
  buildCompactConversationMemory,
  resolveConversationMemorySnippet,
} from './contract-helpers'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database, Tables } from '@/types/supabase'

export { buildCompactConversationMemory, resolveConversationMemorySnippet } from './contract-helpers'

type ConversationMemorySupabaseClient = SupabaseClient<Database>
type AiConversationMemoryRow = Pick<Tables<'ai_conversations'>, 'mesaj_user' | 'raspuns_ai' | 'pathname' | 'created_at'>

export function shouldUseConversationMemory(message: string): boolean {
  return /(^\s*și\b|^\s*si\b|mai devreme|mai sus|cum ziceam|cum spuneam|anterior|continuă|continua|din nou|acela|aceea|asta|mai sus|mai devreme)/i.test(message)
}

export async function loadRecentConversationMemory(params: {
  supabase: ConversationMemorySupabaseClient
  userId: string
  tenantId: string | null
  pathname: string
}): Promise<string> {
  const { supabase, userId, tenantId, pathname } = params
  const baseQuery = () =>
    supabase.from('ai_conversations').select('mesaj_user, raspuns_ai, pathname, created_at')

  try {
    const scoped = tenantId
      ? baseQuery().eq('tenant_id', tenantId).eq('user_id', userId).eq('pathname', pathname)
      : baseQuery().eq('user_id', userId).eq('pathname', pathname)

    const { data: byPage } = await scoped.order('created_at', { ascending: false }).limit(3)
    const pageRows: AiConversationMemoryRow[] = Array.isArray(byPage) ? byPage : []

    if (pageRows.length > 0) {
      return buildCompactConversationMemory(pageRows, 'path')
    }

    const fallback = tenantId
      ? baseQuery().eq('tenant_id', tenantId).eq('user_id', userId)
      : baseQuery().eq('user_id', userId)
    const { data: recentRows } = await fallback.order('created_at', { ascending: false }).limit(3)
    const rows: AiConversationMemoryRow[] = Array.isArray(recentRows) ? recentRows : []

    return resolveConversationMemorySnippet(pageRows, rows)
  } catch {
    // Backward compatible when ai_conversations is missing in partially migrated environments.
    return ''
  }
}
