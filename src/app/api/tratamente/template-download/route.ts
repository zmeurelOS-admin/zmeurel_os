import { NextResponse } from 'next/server'

import { apiError } from '@/lib/api/route-security'
import { captureApiError } from '@/lib/monitoring/sentry'
import { createClient } from '@/lib/supabase/server'
import type { ProdusFitosanitar } from '@/lib/supabase/queries/tratamente'
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

    const { data, error } = await supabase
      .from('produse_fitosanitare')
      .select(
        'id,tenant_id,nume_comercial,substanta_activa,tip,frac_irac,doza_min_ml_per_hl,doza_max_ml_per_hl,doza_min_l_per_ha,doza_max_l_per_ha,phi_zile,nr_max_aplicari_per_sezon,interval_min_aplicari_zile,omologat_culturi,activ,created_at,updated_at,created_by'
      )
      .is('tenant_id', null)
      .eq('activ', true)
      .order('nume_comercial', { ascending: true })

    if (error) {
      throw error
    }

    const workbookBuffer = await generateTratamentTemplateWorkbook(
      (data ?? []) as ProdusFitosanitar[]
    )

    return new NextResponse(new Uint8Array(workbookBuffer), {
      status: 200,
      headers: {
        'Content-Type':
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition':
          'attachment; filename="zmeurel-template-plan-tratament.xlsx"',
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
