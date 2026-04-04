import { NextResponse } from 'next/server'
import { z } from 'zod'

import { apiError, validateSameOriginMutation } from '@/lib/api/route-security'
import { getAssociationRole } from '@/lib/association/auth'
import { captureApiError } from '@/lib/monitoring/sentry'
import { createClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'

const BUCKET = 'producer-photos'
const MAX_FILE_SIZE = 5 * 1024 * 1024
const allowedMimeTypes = new Set(['image/jpeg', 'image/png', 'image/webp'])

const deleteBodySchema = z.object({
  tenantId: z.string().uuid(),
  photoUrl: z.string().url(),
})

function sanitizeFilename(name: string): string {
  const cleaned = name
    .normalize('NFKD')
    .replace(/[^\w.\-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase()

  return cleaned || 'foto'
}

function extensionFromContentType(contentType: string): string {
  if (contentType === 'image/png') return 'png'
  if (contentType === 'image/webp') return 'webp'
  return 'jpg'
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
      error: apiError(403, 'FORBIDDEN', 'Doar administratorii și moderatorii pot gestiona pozele fermelor.'),
    }
  }

  return { supabase, user, error: null }
}

async function loadApprovedTenant(supabase: Awaited<ReturnType<typeof createClient>>, tenantId: string) {
  const { data: tenant, error } = await supabase
    .from('tenants')
    .select('id, is_association_approved, poze_ferma')
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

async function maybeResizeImage(buffer: Buffer): Promise<Buffer> {
  try {
    const sharpModule = await import('sharp')
    return await sharpModule.default(buffer).rotate().resize({ width: 1200, withoutEnlargement: true }).jpeg({
      quality: 84,
      mozjpeg: true,
    }).toBuffer()
  } catch {
    return buffer
  }
}

function extractBucketPath(photoUrl: string): string | null {
  try {
    const url = new URL(photoUrl)
    const marker = `/storage/v1/object/public/${BUCKET}/`
    const idx = url.pathname.indexOf(marker)
    if (idx === -1) return null
    return decodeURIComponent(url.pathname.slice(idx + marker.length))
  } catch {
    return null
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
    const currentPhotos = Array.isArray(tenantResult.tenant?.poze_ferma) ? tenantResult.tenant.poze_ferma : []
    if (currentPhotos.length >= 3) {
      return apiError(400, 'PHOTO_LIMIT', 'Poți păstra cel mult 3 poze pentru fiecare producător.')
    }

    const formData = await request.formData()
    const fileValue = formData.get('file')
    if (!(fileValue instanceof File)) {
      return apiError(400, 'MISSING_FILE', 'Nu am primit nicio imagine.')
    }

    if (!allowedMimeTypes.has(fileValue.type)) {
      return apiError(400, 'INVALID_FILE_TYPE', 'Imaginea trebuie să fie JPG, PNG sau WEBP.')
    }

    if (fileValue.size > MAX_FILE_SIZE) {
      return apiError(400, 'FILE_TOO_LARGE', 'Imaginea depășește limita de 5 MB.')
    }

    const sourceBuffer = Buffer.from(await fileValue.arrayBuffer())
    const uploadBuffer = await maybeResizeImage(sourceBuffer)
    const fileName = sanitizeFilename(fileValue.name)
    const timestamp = Date.now()
    const path = `producers/${tenantId}/${timestamp}-${fileName.replace(/\.[^.]+$/, '')}.jpg`

    const { error: uploadErr } = await supabase.storage.from(BUCKET).upload(path, uploadBuffer, {
      contentType: 'image/jpeg',
      upsert: false,
    })

    if (uploadErr) {
      return apiError(400, 'UPLOAD_FAILED', 'Nu am putut urca imaginea.')
    }

    const { data } = supabase.storage.from(BUCKET).getPublicUrl(path)
    return NextResponse.json({
      ok: true,
      data: {
        url: data.publicUrl,
        extension: extensionFromContentType(fileValue.type),
      },
    })
  } catch (error) {
    captureApiError(error, {
      route: '/api/association/producer-photos',
      userId,
      tenantId: tenantIdForSentry,
      tags: { http_method: 'POST' },
    })
    return apiError(500, 'INTERNAL_ERROR', 'Eroare la upload.')
  }
}

export async function DELETE(request: Request) {
  let userId: string | null = null
  let tenantIdForSentry: string | null = null

  try {
    const invalidOrigin = validateSameOriginMutation(request)
    if (invalidOrigin) return invalidOrigin

    const auth = await requireAssociationModerator()
    if (auth.error) return auth.error
    const { supabase, user } = auth
    userId = user.id

    const json = await request.json()
    const parsed = deleteBodySchema.safeParse(json)
    if (!parsed.success) {
      return apiError(400, 'INVALID_BODY', 'Date invalide.')
    }

    const { tenantId, photoUrl } = parsed.data
    tenantIdForSentry = tenantId

    const tenantResult = await loadApprovedTenant(supabase, tenantId)
    if (tenantResult.error) return tenantResult.error

    const storagePath = extractBucketPath(photoUrl)
    if (!storagePath) {
      return apiError(400, 'INVALID_URL', 'URL-ul pozei nu aparține bucket-ului configurat.')
    }

    const { error: removeErr } = await supabase.storage.from(BUCKET).remove([storagePath])
    if (removeErr) {
      return apiError(400, 'DELETE_FAILED', 'Nu am putut șterge poza din Storage.')
    }

    const currentPhotos = Array.isArray(tenantResult.tenant?.poze_ferma) ? tenantResult.tenant.poze_ferma : []
    const nextPhotos = currentPhotos.filter((item) => item !== photoUrl)

    const { error: tenantUpdateErr } = await supabase
      .from('tenants')
      .update({
        poze_ferma: nextPhotos,
        updated_at: new Date().toISOString(),
      })
      .eq('id', tenantId)

    if (tenantUpdateErr) {
      return apiError(400, 'PROFILE_UPDATE_FAILED', 'Poza a fost ștearsă, dar profilul nu a putut fi actualizat.')
    }

    return NextResponse.json({
      ok: true,
      data: {
        success: true,
        pozeFerma: nextPhotos,
      },
    })
  } catch (error) {
    captureApiError(error, {
      route: '/api/association/producer-photos',
      userId,
      tenantId: tenantIdForSentry,
      tags: { http_method: 'DELETE' },
    })
    return apiError(500, 'INTERNAL_ERROR', 'Eroare la ștergere.')
  }
}
