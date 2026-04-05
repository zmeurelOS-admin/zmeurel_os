import { NextResponse } from 'next/server'

import { apiError, validateSameOriginMutation } from '@/lib/api/route-security'
import { getAssociationRole } from '@/lib/association/auth'
import { captureApiError } from '@/lib/monitoring/sentry'
import { createClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'

const BUCKET = 'producer-logos'
const MAX_FILE_SIZE = 2 * 1024 * 1024
const allowedMimeTypes = new Set(['image/jpeg', 'image/png', 'image/webp'])

function sanitizeFilename(name: string): string {
  const cleaned = name
    .normalize('NFKD')
    .replace(/[^\w.\-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase()

  return cleaned || 'logo'
}

async function requireAssociationModerator() {
  const supabase = await createClient()
  const {
    data: { user },
    error: authErr,
  } = await supabase.auth.getUser()

  if (authErr || !user?.id) {
    return { supabase, user: null, error: apiError(401, 'UNAUTHORIZED', 'Trebuie să fii autentificat.') }
  }

  const role = await getAssociationRole(user.id)
  if (role !== 'admin' && role !== 'moderator') {
    return {
      supabase,
      user: null,
      error: apiError(403, 'FORBIDDEN', 'Doar administratorii și moderatorii pot gestiona logo-ul fermelor.'),
    }
  }

  return { supabase, user, error: null }
}

async function loadApprovedTenant(supabase: Awaited<ReturnType<typeof createClient>>, tenantId: string) {
  const { data: tenant, error } = await supabase
    .from('tenants')
    .select('id, is_association_approved, logo_url')
    .eq('id', tenantId)
    .maybeSingle()

  if (error || !tenant) {
    return { tenant: null, error: apiError(404, 'NOT_FOUND', 'Ferma nu a fost găsită.') }
  }

  if (!tenant.is_association_approved) {
    return { tenant: null, error: apiError(403, 'NOT_APPROVED', 'Ferma nu este aprobată pentru magazinul asociației.') }
  }

  return { tenant, error: null }
}

async function normalizeLogo(buffer: Buffer): Promise<Buffer> {
  try {
    const sharpModule = await import('sharp')
    return await sharpModule.default(buffer)
      .rotate()
      .resize({ width: 512, height: 512, fit: 'cover', position: 'center' })
      .jpeg({
        quality: 86,
        mozjpeg: true,
      })
      .toBuffer()
  } catch {
    return buffer
  }
}

export async function POST(request: Request) {
  let userId: string | null = null
  let tenantIdForSentry: string | null = null

  try {
    const invalidOrigin = validateSameOriginMutation(request)
    if (invalidOrigin) return invalidOrigin

    const auth = await requireAssociationModerator()
    if (auth.error) return auth.error
    const { supabase, user } = auth
    userId = user.id

    const url = new URL(request.url)
    const tenantId = url.searchParams.get('tenantId')?.trim()
    if (!tenantId) {
      return apiError(400, 'MISSING_TENANT', 'Lipsește tenantId.')
    }
    tenantIdForSentry = tenantId

    const tenantResult = await loadApprovedTenant(supabase, tenantId)
    if (tenantResult.error) return tenantResult.error

    const formData = await request.formData()
    const fileValue = formData.get('file')
    if (!(fileValue instanceof File)) {
      return apiError(400, 'MISSING_FILE', 'Nu am primit nicio imagine.')
    }

    if (!allowedMimeTypes.has(fileValue.type)) {
      return apiError(400, 'INVALID_FILE_TYPE', 'Logo-ul trebuie să fie JPG, PNG sau WEBP.')
    }

    if (fileValue.size > MAX_FILE_SIZE) {
      return apiError(400, 'FILE_TOO_LARGE', 'Logo-ul depășește limita de 2 MB.')
    }

    const sourceBuffer = Buffer.from(await fileValue.arrayBuffer())
    const uploadBuffer = await normalizeLogo(sourceBuffer)
    const fileName = sanitizeFilename(fileValue.name)
    const path = `producers/${tenantId}/logo-${fileName.replace(/\.[^.]+$/, '')}.jpg`

    const { error: uploadErr } = await supabase.storage.from(BUCKET).upload(path, uploadBuffer, {
      contentType: 'image/jpeg',
      upsert: true,
    })

    if (uploadErr) {
      return apiError(400, 'UPLOAD_FAILED', 'Nu am putut urca logo-ul.')
    }

    const {
      data: { publicUrl },
    } = supabase.storage.from(BUCKET).getPublicUrl(path)

    const { error: updateErr } = await supabase
      .from('tenants')
      .update({
        logo_url: publicUrl,
        updated_at: new Date().toISOString(),
      })
      .eq('id', tenantId)

    if (updateErr) {
      return apiError(400, 'PROFILE_UPDATE_FAILED', 'Logo-ul a fost urcat, dar profilul nu a putut fi actualizat.')
    }

    return NextResponse.json({
      ok: true,
      data: {
        url: publicUrl,
      },
    })
  } catch (error) {
    captureApiError(error, {
      route: '/api/association/producer-logo',
      userId,
      tenantId: tenantIdForSentry,
      tags: { http_method: 'POST' },
    })
    return apiError(500, 'INTERNAL_ERROR', 'Eroare la upload-ul logo-ului.')
  }
}
