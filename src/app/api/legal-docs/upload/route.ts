import { NextResponse } from 'next/server'

import { apiError, validateSameOriginMutation } from '@/lib/api/route-security'
import { LEGAL_DOCS_BUCKET, sanitizeStorageFilename, toLegalDocStoragePath } from '@/lib/legal-docs/shared'
import { captureApiError } from '@/lib/monitoring/sentry'
import { createClient } from '@/lib/supabase/server'
import { getTenantIdByUserId } from '@/lib/tenant/get-tenant'

export const runtime = 'nodejs'

const MAX_FILE_SIZE = 5 * 1024 * 1024
const ALLOWED_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'application/pdf'])

export async function POST(request: Request) {
  let userId: string | null = null
  let tenantIdForSentry: string | null = null

  try {
    const invalidOriginResponse = validateSameOriginMutation(request)
    if (invalidOriginResponse) {
      return invalidOriginResponse
    }

    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user?.id) {
      return apiError(401, 'UNAUTHORIZED', 'Trebuie să fii autentificat.')
    }

    userId = user.id
    const tenantId = await getTenantIdByUserId(supabase, user.id)
    tenantIdForSentry = tenantId

    const formData = await request.formData()
    const fileValue = formData.get('file')

    if (!(fileValue instanceof File)) {
      return apiError(400, 'MISSING_FILE', 'Nu am primit niciun document.')
    }

    if (!ALLOWED_MIME_TYPES.has(fileValue.type)) {
      return apiError(400, 'INVALID_FILE_TYPE', 'Documentul trebuie să fie JPG, PNG, WEBP sau PDF.')
    }

    if (fileValue.size > MAX_FILE_SIZE) {
      return apiError(400, 'FILE_TOO_LARGE', 'Documentul depășește limita de 5 MB.')
    }

    const fileName = sanitizeStorageFilename(fileValue.name)
    const path = toLegalDocStoragePath(tenantId, fileName)
    const fileBuffer = Buffer.from(await fileValue.arrayBuffer())

    const { error: uploadError } = await supabase.storage.from(LEGAL_DOCS_BUCKET).upload(path, fileBuffer, {
      contentType: fileValue.type || 'application/octet-stream',
      upsert: true,
    })

    if (uploadError) {
      return apiError(400, 'UPLOAD_FAILED', 'Nu am putut urca documentul legal.')
    }

    const { data: signedData, error: signedError } = await supabase.storage
      .from(LEGAL_DOCS_BUCKET)
      .createSignedUrl(path, 60 * 60)

    return NextResponse.json({
      ok: true,
      data: {
        path,
        signedUrl: signedError ? null : signedData?.signedUrl ?? null,
        fileName,
      },
    })
  } catch (error) {
    captureApiError(error, {
      route: '/api/legal-docs/upload',
      userId,
      tenantId: tenantIdForSentry,
      tags: { http_method: 'POST' },
    })
    return apiError(500, 'INTERNAL_ERROR', 'Nu am putut urca documentul legal.')
  }
}
