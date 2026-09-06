import { describe, expect, it } from 'vitest'

import { buildDashboardRecommendations } from '@/lib/dashboard/recommendations'

describe('dashboard recommendations', () => {
  it('recomandă parcela cu tratament depășit când există un semnal de atenție', () => {
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
    })

    const ids = new Set(items.map((item) => item.id))
    expect(ids.has('rec-parcel-treatment')).toBe(true)
  })

  it('nu recomandă nimic legat de tratamente când nu există semnale', () => {
    const items = buildDashboardRecommendations({
      meteo: null,
      tasks: [],
      alerts: [],
      primaryContext: 'camp',
      parcelAttentionItems: [],
      plannedActivitiesCount: 0,
      criticalStockCount: 0,
    })

    const ids = new Set(items.map((item) => item.id))
    expect(ids.has('rec-treatment-alerts')).toBe(false)
    expect(ids.has('rec-parcel-treatment')).toBe(false)
  })
})
