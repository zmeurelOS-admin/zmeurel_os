import { NextResponse } from 'next/server'

import { apiError } from '@/lib/api/route-security'
import { captureApiError } from '@/lib/monitoring/sentry'
import { createClient } from '@/lib/supabase/server'
import { getTenantIdByUserId } from '@/lib/tenant/get-tenant'
import { generateTratamentTemplateWorkbook } from '@/lib/tratamente/import/template-generator'

export const runtime = 'nodejs'

export async function GET() {
  let userId: string | null = null
  let tenantIdForSentry: string | null = null

  try {
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

    const workbookBuffer = await generateTratamentTemplateWorkbook()

    return new NextResponse(new Uint8Array(workbookBuffer), {
      status: 200,
      headers: {
        'Content-Type':
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition':
          'attachment; filename="zmeurel-template-plan-tratament-v3.xlsx"',
        'Cache-Control': 'no-store',
      },
    })
  } catch (error) {
    captureApiError(error, {
      route: '/api/tratamente/template-download',
      userId,
      tenantId: tenantIdForSentry,
      tags: { http_method: 'GET' },
    })
    return apiError(500, 'INTERNAL_ERROR', 'Nu am putut genera template-ul Excel.')
  }
}
