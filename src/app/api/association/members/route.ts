import { NextResponse } from 'next/server'
import { z } from 'zod'

import { apiError, validateSameOriginMutation } from '@/lib/api/route-security'
import { getAssociationRole } from '@/lib/association/auth'
import { resolveAuthUserIdByEmail } from '@/lib/association/resolve-auth-user-by-email'
import { listAssociationMembersWithEmails } from '@/lib/association/members-queries'
import { captureApiError } from '@/lib/monitoring/sentry'
import { createNotification, NOTIFICATION_TYPES } from '@/lib/notifications/create'
import { createClient } from '@/lib/supabase/server'
import { getSupabaseAdmin } from '@/lib/supabase/admin'

export const runtime = 'nodejs'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyAdmin = any

const roleSchema = z.enum(['admin', 'moderator', 'viewer'])

const postSchema = z.object({
  email: z.string().email(),
  role: roleSchema,
})

const patchSchema = z.object({
  memberId: z.string().uuid(),
  role: roleSchema,
})

const deleteSchema = z.object({
  memberId: z.string().uuid(),
})

function roleLabelRo(role: z.infer<typeof roleSchema>): string {
  switch (role) {
    case 'admin':
      return 'Administrator'
    case 'moderator':
      return 'Moderator'
    case 'viewer':
      return 'Vizualizator'
    default:
      return role
  }
}

async function requireAssociationAdminApi(): Promise<{ userId: string } | NextResponse> {
  const supabase = await createClient()
  const {
    data: { user },
    error: authErr,
  } = await supabase.auth.getUser()
  if (authErr || !user?.id) {
    return apiError(401, 'UNAUTHORIZED', 'Trebuie să fii autentificat.')
  }
  const role = await getAssociationRole(user.id)
  if (role !== 'admin') {
    return apiError(403, 'FORBIDDEN', 'Doar administratorii asociației pot gestiona membrii.')
  }
  return { userId: user.id }
}

async function countAdmins(admin: AnyAdmin): Promise<number> {
  const { data, error } = await admin.from('association_members').select('id').eq('role', 'admin')
  if (error) return 0
  return (data ?? []).length
}

export async function GET() {
  let userId: string | null = null
  try {
    const gate = await requireAssociationAdminApi()
    if (gate instanceof NextResponse) return gate
    userId = gate.userId

    const members = await listAssociationMembersWithEmails()
    return NextResponse.json({ ok: true, data: { members } })
  } catch (error) {
    captureApiError(error, { route: '/api/association/members', userId })
    return apiError(500, 'INTERNAL_ERROR', 'Nu am putut încărca membrii.')
  }
}

export async function POST(request: Request) {
  let userId: string | null = null
  try {
    const invalidOrigin = validateSameOriginMutation(request)
    if (invalidOrigin) return invalidOrigin

    const gate = await requireAssociationAdminApi()
    if (gate instanceof NextResponse) return gate
    userId = gate.userId

    const json = await request.json()
    const parsed = postSchema.safeParse(json)
    if (!parsed.success) {
      return apiError(400, 'INVALID_BODY', 'Date invalide.')
    }

    const { email, role } = parsed.data
    const admin = getSupabaseAdmin() as AnyAdmin

    const resolved = await resolveAuthUserIdByEmail(admin, email)
    if (!resolved) {
      return apiError(
        404,
        'USER_NOT_FOUND',
        'Acest email nu are cont în Zmeurel OS. Fermierul trebuie să se înregistreze mai întâi.'
      )
    }

    const { data: existing } = await admin
      .from('association_members')
      .select('id')
      .eq('user_id', resolved.id)
      .maybeSingle()

    if (existing) {
      return apiError(409, 'ALREADY_MEMBER', 'Acest utilizator este deja membru al asociației.')
    }

    const { data: inserted, error: insErr } = await admin
      .from('association_members')
      .insert({
        user_id: resolved.id,
        role,
        invited_by: userId,
      })
      .select('id, user_id, role, created_at, invited_by')
      .single()

    if (insErr || !inserted) {
      return apiError(400, 'INSERT_FAILED', 'Nu am putut adăuga membrul.')
    }

    const label = roleLabelRo(role)
    void createNotification(
      resolved.id,
      NOTIFICATION_TYPES.system,
      'Ai fost adăugat în echipa Gustă din Bucovina',
      `Ai fost adăugat ca ${label}.`,
      { associationRole: role },
      'association_member',
      inserted.id as string
    )

    return NextResponse.json({
      ok: true,
      data: {
        member: {
          id: inserted.id,
          email: resolved.email,
          role: inserted.role,
          createdAt: inserted.created_at,
          invitedByUserId: inserted.invited_by,
        },
      },
    })
  } catch (error) {
    captureApiError(error, { route: '/api/association/members', userId, tags: { http_method: 'POST' } })
    return apiError(500, 'INTERNAL_ERROR', 'Eroare la invitare.')
  }
}

export async function PATCH(request: Request) {
  let userId: string | null = null
  try {
    const invalidOrigin = validateSameOriginMutation(request)
    if (invalidOrigin) return invalidOrigin

    const gate = await requireAssociationAdminApi()
    if (gate instanceof NextResponse) return gate
    userId = gate.userId

    const json = await request.json()
    const parsed = patchSchema.safeParse(json)
    if (!parsed.success) {
      return apiError(400, 'INVALID_BODY', 'Date invalide.')
    }

    const { memberId, role: newRole } = parsed.data
    const admin = getSupabaseAdmin() as AnyAdmin

    const { data: row, error: fetchErr } = await admin
      .from('association_members')
      .select('id, user_id, role')
      .eq('id', memberId)
      .maybeSingle()

    if (fetchErr || !row) {
      return apiError(404, 'NOT_FOUND', 'Membrul nu a fost găsit.')
    }

    const member = row as { id: string; user_id: string; role: string }

    if (member.user_id === userId) {
      return apiError(403, 'SELF_ROLE', 'Nu îți poți schimba propriul rol din acest ecran.')
    }

    const wasAdmin = member.role === 'admin'
    const becomesNonAdmin = newRole !== 'admin'

    if (wasAdmin && becomesNonAdmin) {
      const admins = await countAdmins(admin)
      if (admins <= 1) {
        return apiError(
          403,
          'LAST_ADMIN',
          'Trebuie să existe cel puțin un administrator. Adaugă alt admin înainte de a schimba acest rol.'
        )
      }
    }

    const { data: updated, error: upErr } = await admin
      .from('association_members')
      .update({ role: newRole })
      .eq('id', memberId)
      .select('id, user_id, role, created_at, invited_by')
      .single()

    if (upErr || !updated) {
      return apiError(400, 'UPDATE_FAILED', 'Nu am putut actualiza rolul.')
    }

    const label = roleLabelRo(newRole)
    void createNotification(
      member.user_id,
      NOTIFICATION_TYPES.system,
      'Rol actualizat în Gustă din Bucovina',
      `Rolul tău în echipa asociației a fost schimbat la: ${label}.`,
      { associationRole: newRole },
      'association_member',
      member.id
    )

    return NextResponse.json({ ok: true, data: { member: updated } })
  } catch (error) {
    captureApiError(error, { route: '/api/association/members', userId, tags: { http_method: 'PATCH' } })
    return apiError(500, 'INTERNAL_ERROR', 'Eroare la actualizare.')
  }
}

export async function DELETE(request: Request) {
  let userId: string | null = null
  try {
    const invalidOrigin = validateSameOriginMutation(request)
    if (invalidOrigin) return invalidOrigin

    const gate = await requireAssociationAdminApi()
    if (gate instanceof NextResponse) return gate
    userId = gate.userId

    const json = await request.json()
    const parsed = deleteSchema.safeParse(json)
    if (!parsed.success) {
      return apiError(400, 'INVALID_BODY', 'Date invalide.')
    }

    const { memberId } = parsed.data
    const admin = getSupabaseAdmin() as AnyAdmin

    const { data: row, error: fetchErr } = await admin
      .from('association_members')
      .select('id, user_id, role')
      .eq('id', memberId)
      .maybeSingle()

    if (fetchErr || !row) {
      return apiError(404, 'NOT_FOUND', 'Membrul nu a fost găsit.')
    }

    const member = row as { id: string; user_id: string; role: string }

    if (member.user_id === userId) {
      return apiError(403, 'SELF_REVOKE', 'Nu îți poți revoca singur accesul.')
    }

    if (member.role === 'admin') {
      const admins = await countAdmins(admin)
      if (admins <= 1) {
        return apiError(
          403,
          'LAST_ADMIN',
          'Nu poți elimina ultimul administrator al asociației.'
        )
      }
    }

    const { error: delErr } = await admin.from('association_members').delete().eq('id', memberId)

    if (delErr) {
      return apiError(400, 'DELETE_FAILED', 'Nu am putut revoca accesul.')
    }

    void createNotification(
      member.user_id,
      NOTIFICATION_TYPES.system,
      'Acces revocat',
      'Accesul tău la workspace-ul asociației Gustă din Bucovina a fost revocat.',
      {},
      'association_member',
      null
    )

    return NextResponse.json({ ok: true, data: { success: true } })
  } catch (error) {
    captureApiError(error, { route: '/api/association/members', userId, tags: { http_method: 'DELETE' } })
    return apiError(500, 'INTERNAL_ERROR', 'Eroare la revocare.')
  }
}
