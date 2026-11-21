import { NextResponse } from 'next/server'

import { apiError, validateSameOriginMutation } from '@/lib/api/route-security'
import { destructiveActionScopes } from '@/lib/auth/destructive-action-step-up-contract'
import { isProtectedAccountDeletionUser } from '@/lib/auth/protected-account'
import { requireDestructiveActionStepUp } from '@/lib/auth/destructive-action-step-up'
import { isSuperAdmin } from '@/lib/auth/isSuperAdmin'
import { captureApiError } from '@/lib/monitoring/report-error'
import { getSupabaseAdmin } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { deleteFarmMemberships, ownedTenantIdForDeletion } from '@/lib/tenant/account-deletion'
import {
  deleteTenantScopedData,
  TENANT_DESTRUCTIVE_CLEANUP_SCOPES,
} from '@/lib/tenant/destructive-cleanup'

export const runtime = 'nodejs'

type Admin = ReturnType<typeof getSupabaseAdmin>

async function getAccountContext() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user?.id) {
    throw new Error('UNAUTHORIZED')
  }

  return { supabase, user }
}

async function deleteAiConversations(admin: Admin, userId: string) {
  const { error } = await admin
    .from('ai_conversations' as unknown as 'alert_dismissals')
    .delete()
    .eq('user_id', userId)

  if (error) throw error
}

/** Ferma proprie: datele, evenimentele, conversațiile AI, apoi rândul din `tenants`. Orice eroare critică oprește tot. */
async function deleteOwnedTenant(admin: Admin, tenantId: string, userId: string) {
  // Întâi datele fermei, în ordinea cheilor: tratamentele și capcanele au chei `ON DELETE RESTRICT` spre
  // `parcele` și `produse_fitosanitare`, deci ștergerea directă a rândului din `tenants` poate eșua.
  // Orice eroare critică oprește aici, înainte să atingem contul (`TenantCleanupError`).
  await deleteTenantScopedData(admin, tenantId, {
    scope: TENANT_DESTRUCTIVE_CLEANUP_SCOPES.gdprFarmDelete,
    verifyCriticalTables: true,
  })

  const { error: analyticsDeleteError } = await admin
    .from('analytics_events' as unknown as 'alert_dismissals')
    .delete()
    .eq('tenant_id', tenantId)

  if (analyticsDeleteError) throw analyticsDeleteError

  await deleteAiConversations(admin, userId)

  const { error: deleteTenantError } = await admin
    .from('tenants')
    .delete()
    .eq('id', tenantId)

  if (deleteTenantError) throw deleteTenantError
}

export async function DELETE(request: Request) {
  let userId: string | null = null
  let tenantIdForSentry: string | null = null

  try {
    const invalidOriginResponse = validateSameOriginMutation(request)
    if (invalidOriginResponse) {
      return invalidOriginResponse
    }

    const { supabase, user } = await getAccountContext()
    userId = user.id

    const userIsSuperadmin = await isSuperAdmin(supabase, user.id)
    if (
      isProtectedAccountDeletionUser({
        userId: user.id,
        isSuperadmin: userIsSuperadmin,
      })
    ) {
      return apiError(403, 'ACCOUNT_PROTECTED', 'Cont protejat. Acest cont nu poate fi sters.')
    }

    const stepUpError = requireDestructiveActionStepUp(request, {
      userId: user.id,
      scope: destructiveActionScopes.gdprAccountDelete,
    })
    if (stepUpError) {
      return stepUpError
    }

    const admin = getSupabaseAdmin()
    // DOAR ferma al cărei proprietar e utilizatorul. Un operator (din link, cu Google sau cu parolă) nu șterge
    // niciodată ferma în care lucrează: pleacă legătura lui din `farm_members`, profilul și utilizatorul.
    const tenantId = await ownedTenantIdForDeletion(admin, user.id)
    tenantIdForSentry = tenantId

    if (tenantId) {
      await deleteOwnedTenant(admin, tenantId, user.id)
    } else {
      await deleteAiConversations(admin, user.id)
    }

    await deleteFarmMemberships(admin, user.id)

    const { error: deleteProfileError } = await admin
      .from('profiles')
      .delete()
      .eq('id', user.id)

    if (deleteProfileError) throw deleteProfileError

    const { error: deleteUserError } = await admin.auth.admin.deleteUser(user.id)
    if (deleteUserError) {
      if (tenantId) throw deleteUserError
      // Operatorul a scris în ferma altcuiva (`created_by` → `auth.users`, fără cascadă): istoricul fermei rămâne,
      // iar contul se șterge „soft” (Supabase îl anonimizează și păstrează rândul pentru chei).
      const { error: softDeleteError } = await admin.auth.admin.deleteUser(user.id, true)
      if (softDeleteError) throw softDeleteError
    }

    return NextResponse.json({ ok: true })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unexpected error'
    const status = message === 'UNAUTHORIZED' ? 401 : 500

    if (status >= 500) {
      captureApiError(error, {
        route: '/api/gdpr/account',
        userId,
        tenantId: tenantIdForSentry,
      })
    }

    if (status === 401) {
      return apiError(401, 'UNAUTHORIZED', 'Trebuie sa fii autentificat.')
    }

    return apiError(500, 'INTERNAL_ERROR', 'Nu am putut sterge contul.')
  }
}
