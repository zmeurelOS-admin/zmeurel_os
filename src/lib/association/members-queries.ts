import { getSupabaseAdmin } from '@/lib/supabase/admin'
import type { AssociationRole } from '@/lib/association/auth'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyAdmin = any

export type AssociationMemberListItem = {
  id: string
  email: string
  role: AssociationRole
  createdAt: string
  invitedByUserId: string | null
  invitedByEmail: string | null
}

async function emailByUserId(admin: AnyAdmin, userId: string): Promise<string | null> {
  const { data, error } = await admin.auth.admin.getUserById(userId)
  if (error || !data.user?.email) return null
  return data.user.email
}

/**
 * Listă membri pentru pagina ERP asociație (server-only, service role pentru email-uri din Auth).
 */
export async function listAssociationMembersWithEmails(): Promise<AssociationMemberListItem[]> {
  const admin = getSupabaseAdmin() as AnyAdmin
  const { data: rows, error } = await admin
    .from('association_members')
    .select('id, user_id, role, created_at, invited_by')
    .order('created_at', { ascending: true })

  if (error || !rows?.length) {
    return []
  }

  const list = rows as {
    id: string
    user_id: string
    role: string
    created_at: string
    invited_by: string | null
  }[]

  const ids = new Set<string>()
  for (const r of list) {
    ids.add(r.user_id)
    if (r.invited_by) ids.add(r.invited_by)
  }

  const emailMap = new Map<string, string>()
  await Promise.all(
    [...ids].map(async (uid) => {
      const em = await emailByUserId(admin, uid)
      if (em) emailMap.set(uid, em)
    })
  )

  const roles = new Set(['admin', 'moderator', 'viewer'])
  return list.map((r) => {
    const role = roles.has(r.role) ? (r.role as AssociationRole) : 'viewer'
    return {
      id: r.id,
      email: emailMap.get(r.user_id) ?? r.user_id,
      role,
      createdAt: r.created_at,
      invitedByUserId: r.invited_by,
      invitedByEmail: r.invited_by ? emailMap.get(r.invited_by) ?? null : null,
    }
  })
}
