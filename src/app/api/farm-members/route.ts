import { NextResponse } from 'next/server'

import { getFarmOwnerContext } from '@/lib/farm-members/owner-auth'
import { getSupabaseAdmin } from '@/lib/supabase/admin'

export type FarmMemberApiRow = {
  id: string
  created_at: string
  tenant_id: string
  user_id: string | null
  role: 'operator' | 'livrator'
  name: string
  phone: string | null
  invite_token: string | null
  invite_used_at: string | null
  is_active: boolean
  created_by: string | null
}

function errorResponse(error: string, status = 400) {
  return NextResponse.json({ success: false, error }, { status })
}

export async function GET() {
  const owner = await getFarmOwnerContext()
  if (!owner) {
    return errorResponse('forbidden', 403)
  }

  const admin = getSupabaseAdmin()
  const { data, error } = await admin
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .from('farm_members' as any)
    .select('id, created_at, tenant_id, user_id, role, name, phone, invite_token, invite_used_at, is_active, created_by')
    .eq('tenant_id', owner.tenantId)
    .eq('is_active', true)
    .order('created_at', { ascending: false })

  if (error) {
    return errorResponse('load_failed', 500)
  }

  return NextResponse.json({ success: true, members: (data ?? []) as unknown as FarmMemberApiRow[] })
}
