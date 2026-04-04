import { redirect } from 'next/navigation'

import { createClient } from '@/lib/supabase/server'

export type AssociationRole = 'admin' | 'moderator' | 'viewer'

const ROLES = new Set<string>(['admin', 'moderator', 'viewer'])

function normalizeRole(role: string | null | undefined): AssociationRole | null {
  if (!role || !ROLES.has(role)) return null
  return role as AssociationRole
}

export async function getAssociationRole(userId: string): Promise<AssociationRole | null> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('association_members')
    .select('role')
    .eq('user_id', userId)
    .maybeSingle()

  if (error || !data?.role) {
    return null
  }

  return normalizeRole(data.role)
}

export async function isAssociationMember(userId: string): Promise<boolean> {
  const role = await getAssociationRole(userId)
  return role !== null
}

export async function isAssociationAdmin(userId: string): Promise<boolean> {
  const role = await getAssociationRole(userId)
  return role === 'admin'
}

export async function canManageAssociationCatalog(userId: string): Promise<boolean> {
  const role = await getAssociationRole(userId)
  return role === 'admin' || role === 'moderator'
}

export type AssociationAccessContext = {
  userId: string
  email: string | undefined
  role: AssociationRole
}

/** Pentru server components / route handlers: cere sesiune + membru asociație; opțional rol minim. */
export async function requireAssociationAccess(
  minRole?: 'admin' | 'moderator'
): Promise<AssociationAccessContext> {
  const supabase = await createClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user?.id) {
    redirect('/dashboard')
  }

  const role = await getAssociationRole(user.id)
  if (!role) {
    redirect('/dashboard')
  }

  if (minRole === 'admin' && role !== 'admin') {
    redirect('/dashboard')
  }

  if (minRole === 'moderator' && role !== 'admin' && role !== 'moderator') {
    redirect('/dashboard')
  }

  return {
    userId: user.id,
    email: user.email,
    role,
  }
}
