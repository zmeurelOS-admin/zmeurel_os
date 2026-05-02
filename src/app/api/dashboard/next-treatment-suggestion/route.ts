import { NextResponse } from 'next/server'

import { apiError } from '@/lib/api/route-security'
import {
  buildDashboardTreatmentSuggestions,
  collectWeatherEligibleParcelaIds,
  type DashboardTreatmentSuggestionsPayload,
} from '@/lib/dashboard/treatment-suggestions'
import { sanitizeForLog, toSafeErrorContext } from '@/lib/logging/redaction'
import { isParcelaDashboardRelevant } from '@/lib/parcele/dashboard-relevance'
import { formatUnitateDisplayName } from '@/lib/parcele/unitate'
import { createClient } from '@/lib/supabase/server'
import {
  listAplicariCrossParcelPentruInterval,
  listInterventiiRelevanteHub,
} from '@/lib/supabase/queries/tratamente'
import { getMeteoZi } from '@/lib/tratamente/meteo'
import { getTenantId } from '@/lib/tenant/get-tenant'
import type { Tables } from '@/types/supabase'

type DashboardParcelaRow = Pick<
  Tables<'parcele'>,
  | 'id'
  | 'nume_parcela'
  | 'tip_unitate'
  | 'rol'
  | 'apare_in_dashboard'
  | 'contribuie_la_productie'
  | 'status_operational'
>

function getTodayInBucharest(now: Date): string {
  return now.toLocaleDateString('en-CA', { timeZone: 'Europe/Bucharest' })
}

function addUtcDays(date: Date, days: number): Date {
  const next = new Date(date)
  next.setUTCDate(next.getUTCDate() + days)
  return next
}

async function getDashboardParceleRows() {
  const supabase = await createClient()
  const tenantId = await getTenantId(supabase)

  const { data, error } = await supabase
    .from('parcele')
    .select('id,nume_parcela,tip_unitate,rol,apare_in_dashboard,contribuie_la_productie,status_operational')
    .eq('tenant_id', tenantId)

  if (error) throw error
  return (data ?? []) as DashboardParcelaRow[]
}

export async function GET() {
  try {
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user?.id) {
      return NextResponse.json({ error: 'Autentificare necesară' }, { status: 401 })
    }

    const now = new Date()
    const today = getTodayInBucharest(now)
    const intervalStart = addUtcDays(new Date(`${today}T12:00:00.000Z`), -120)
    const intervalEnd = addUtcDays(new Date(`${today}T12:00:00.000Z`), 7)
    const year = Number(today.slice(0, 4))

    const parcele = await getDashboardParceleRows()
    const relevante = parcele.filter((parcela) => isParcelaDashboardRelevant(parcela))
    if (relevante.length === 0) {
      return NextResponse.json<DashboardTreatmentSuggestionsPayload>({
        primary: null,
        secondary: null,
      })
    }

    const parcelaIdSet = new Set(relevante.map((parcela) => parcela.id))
    const parcelaLabels = new Map(
      relevante.map((parcela) => [
        parcela.id,
        formatUnitateDisplayName(parcela.nume_parcela, parcela.tip_unitate),
      ]),
    )

    const [aplicariRaw, interventiiRaw] = await Promise.all([
      listAplicariCrossParcelPentruInterval({
        dataStart: intervalStart,
        dataEnd: intervalEnd,
      }),
      listInterventiiRelevanteHub(year),
    ])

    const aplicari = aplicariRaw.filter((aplicare) => parcelaIdSet.has(aplicare.parcela_id))
    const interventiiRelevante = interventiiRaw.filter((interventie) => parcelaIdSet.has(interventie.parcela_id))

    const weatherEligibleParcelaIds = collectWeatherEligibleParcelaIds({
      now,
      parcelaLabels,
      aplicari,
      interventiiRelevante,
    })

    const meteoEntries = await Promise.all(
      weatherEligibleParcelaIds.map(async (parcelaId) => [parcelaId, await getMeteoZi(parcelaId)] as const),
    )

    const payload = buildDashboardTreatmentSuggestions({
      now,
      parcelaLabels,
      aplicari,
      interventiiRelevante,
      meteoByParcelaId: new Map(meteoEntries),
    })

    return NextResponse.json<DashboardTreatmentSuggestionsPayload>(payload)
  } catch (error) {
    console.error(
      '[dashboard/next-treatment-suggestion] failed',
      sanitizeForLog({ error: toSafeErrorContext(error) }),
    )
    return apiError(500, 'DASHBOARD_TREATMENT_SUGGESTION_FAILED', 'Nu am putut încărca sugestiile de tratament.')
  }
}
