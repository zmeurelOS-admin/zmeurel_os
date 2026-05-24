import { describe, expect, it } from 'vitest'

import { formatActivityDaysShortBadge, getActivityDaysAgo } from '@/lib/activitati/timeline'

describe('getActivityDaysAgo', () => {
  it('calculează 1 zi pentru activitate de ieri văzută azi', () => {
    const today = new Date(2026, 4, 24)
    const days = getActivityDaysAgo({ data_aplicare: '2026-05-23' }, today)
    expect(days).toBe(1)
  })

  it('returnează 0 pentru activitate din ziua curentă', () => {
    const today = new Date(2026, 4, 24)
    expect(getActivityDaysAgo({ data_aplicare: '2026-05-24' }, today)).toBe(0)
  })
})

describe('formatActivityDaysShortBadge', () => {
  it('nu afișează 0z pentru 1 zi în urmă', () => {
    expect(formatActivityDaysShortBadge(1)).toBe('1z')
    expect(formatActivityDaysShortBadge(0)).toBe('azi')
  })
})
