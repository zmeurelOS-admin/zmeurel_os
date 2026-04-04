import { NextResponse } from 'next/server'
import { z } from 'zod'

import { apiError, validateSameOriginMutation } from '@/lib/api/route-security'
import { getAssociationRole } from '@/lib/association/auth'
import {
  ASSOCIATION_DAY_IDS,
  loadAssociationSettings,
  saveAssociationSettings,
} from '@/lib/association/public-settings'
import { captureApiError } from '@/lib/monitoring/sentry'
import { createClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'

const settingsSchema = z.object({
  description: z.string().max(1200),
  facebookUrl: z.union([z.literal(''), z.string().url()]),
  marketSchedule: z.string().max(160),
  marketLocation: z.string().max(160),
  activeDays: z.array(z.enum(ASSOCIATION_DAY_IDS)).max(7),
  marketStartTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  marketEndTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  marketNote: z.string().max(500),
  merchantLegalName: z.string().max(200),
  merchantLegalForm: z.string().max(120),
  merchantCui: z.string().max(32),
  merchantHeadquarters: z.string().max(500),
  merchantRegistryNumber: z.string().max(80),
  merchantContactPerson: z.string().max(120),
  merchantDeliveryPolicy: z.string().max(2000),
  merchantComplaintsPolicy: z.string().max(2000),
  merchantEmail: z.union([z.literal(''), z.string().email()]),
  merchantPhone: z.string().max(40),
})

async function requireAssociationModerator() {
  const supabase = await createClient()
  const {
    data: { user },
    error: authErr,
  } = await supabase.auth.getUser()

  if (authErr || !user?.id) {
    return { userId: null, error: apiError(401, 'UNAUTHORIZED', 'Trebuie să fii autentificat.') }
  }

  const role = await getAssociationRole(user.id)
  if (role !== 'admin' && role !== 'moderator') {
    return {
      userId: user.id,
      error: apiError(403, 'FORBIDDEN', 'Doar administratorii și moderatorii pot modifica setările asociației.'),
    }
  }

  return { userId: user.id, error: null }
}

export async function GET() {
  let userId: string | null = null
  try {
    const access = await requireAssociationModerator()
    if (access.error) return access.error
    userId = access.userId

    const settings = await loadAssociationSettings()
    return NextResponse.json({
      ok: true,
      data: { settings },
    })
  } catch (error) {
    captureApiError(error, {
      route: '/api/association/settings',
      userId,
      tags: { http_method: 'GET' },
    })
    return apiError(500, 'INTERNAL_ERROR', 'Nu am putut încărca setările asociației.')
  }
}

export async function PATCH(request: Request) {
  let userId: string | null = null
  try {
    const invalidOrigin = validateSameOriginMutation(request)
    if (invalidOrigin) return invalidOrigin

    const access = await requireAssociationModerator()
    if (access.error) return access.error
    userId = access.userId

    const json = await request.json()
    const parsed = settingsSchema.safeParse(json)
    if (!parsed.success) {
      return apiError(400, 'INVALID_BODY', 'Date invalide.')
    }

    const settings = await saveAssociationSettings(parsed.data)
    return NextResponse.json({
      ok: true,
      data: { settings },
    })
  } catch (error) {
    captureApiError(error, {
      route: '/api/association/settings',
      userId,
      tags: { http_method: 'PATCH' },
    })
    return apiError(500, 'INTERNAL_ERROR', 'Nu am putut salva setările asociației.')
  }
}
