import { describe, expect, it } from 'vitest'

import { buildDashboardRecommendations } from '@/lib/dashboard/recommendations'
import type { DashboardTreatmentSuggestion } from '@/lib/dashboard/treatment-suggestions'

const nextTreatmentSuggestion: DashboardTreatmentSuggestion = {
  parcelaId: 'parcela-1',
  parcelaLabel: 'Parcela Nord',
  aplicareId: 'ap-1',
  planLabel: 'Plan zmeur 2026',
  interventieLabel: 'Protecție înflorit',
  produsLabel: 'Switch 62.5 WG',
  status: 'today',
  recommendedDate: '2026-05-02',
  firstSafeWindowLabel: '11:00-12:00',
  reason: 'Aplicarea este planificată azi.',
  warnings: [],
}

describe('dashboard recommendations', () => {
  it('nu repetă următorul tratament în listă — acel semnal este doar în cardul dedicat V2', () => {
    const items = buildDashboardRecommendations({
      meteo: null,
      tasks: [],
      alerts: [],
      primaryContext: 'camp',
      parcelAttentionItems: [],
      plannedActivitiesCount: 0,
      criticalStockCount: 0,
      nextTreatmentSuggestion,
    })

    expect(items.some((item) => item.id === 'rec-next-treatment')).toBe(false)
  })

  it('nu dublează recomandările vechi de tratament când există sugestia nouă', () => {
    const items = buildDashboardRecommendations({
      meteo: null,
      tasks: [
        {
          id: 'tratament:parcela-1',
          icon: '🧪',
          text: 'Tratament necesar Parcela Nord',
          tag: 'URGENT',
          tone: 'urgent',
        },
      ],
      alerts: [
        {
          id: 'alert:tratamente-depasite',
          category: 'tratamente',
          severity: 'warning',
          message: 'Există tratamente depășite.',
        },
      ],
      primaryContext: 'camp',
      parcelAttentionItems: [
        {
          displayName: 'Parcela Nord',
          attentionFlags: ['treatment_overdue'],
        },
      ],
      plannedActivitiesCount: 0,
      criticalStockCount: 0,
      nextTreatmentSuggestion,
    })

    const ids = new Set(items.map((item) => item.id))
    expect(ids.has('rec-next-treatment')).toBe(false)
    expect(ids.has('rec-treatment-alerts')).toBe(false)
    expect(ids.has('rec-parcel-treatment')).toBe(false)
  })
})
