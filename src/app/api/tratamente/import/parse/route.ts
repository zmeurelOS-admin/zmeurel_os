import { NextResponse } from 'next/server'

import { apiError, validateSameOriginMutation } from '@/lib/api/route-security'
import { captureApiError } from '@/lib/monitoring/sentry'
import { createClient } from '@/lib/supabase/server'
import { listProduseFitosanitare } from '@/lib/supabase/queries/tratamente'
import { getTenantIdByUserId } from '@/lib/tenant/get-tenant'
import { parseImportedPlansWorkbook } from '@/lib/tratamente/import/parse-workbook'
import { validateImportFileMeta } from '@/lib/tratamente/import/validate-upload'

export const runtime = 'nodejs'

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
    tenantIdForSentry = await getTenantIdByUserId(supabase, user.id)

    const formData = await request.formData()
    const fileValue = formData.get('file')

    if (!(fileValue instanceof File)) {
      return apiError(400, 'MISSING_FILE', 'Nu am primit niciun fișier Excel.')
    }

    const validationError = validateImportFileMeta({
      fileName: fileValue.name,
      mimeType: fileValue.type,
      size: fileValue.size,
    })

    if (validationError) {
      return apiError(400, 'INVALID_FILE', validationError)
    }

    const produse = await listProduseFitosanitare()
    const result = await parseImportedPlansWorkbook(
      await fileValue.arrayBuffer(),
      produse
    )

    return NextResponse.json(result)
  } catch (error) {
    captureApiError(error, {
      route: '/api/tratamente/import/parse',
      userId,
      tenantId: tenantIdForSentry,
      tags: { http_method: 'POST' },
    })
    return apiError(500, 'INTERNAL_ERROR', 'Nu am putut interpreta fișierul Excel.')
  }
}
