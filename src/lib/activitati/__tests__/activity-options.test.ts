import { describe, expect, it } from 'vitest'

import {
  ALL_ACTIVITY_TYPE_LABELS,
  formatActivityTypeLabel,
  getActivityDisplayLabel,
  getActivityEmoji,
} from '@/lib/activitati/activity-options'

const EXPECTED_EMOJI_BY_LABEL: Record<string, string> = {
  'Tăiere lăstari': '🌿',
  Palisare: '🪢',
  Irigație: '💧',
  Prășit: '⛏️',
  Mulcire: '🍂',
  Recoltare: '🧺',
  Altele: '🔧',
  Semănat: '🏡',
  'Răsădit': '🏡',
  Aerisire: '🏡',
  'Ciupire/Cârnire': '✂️',
  'Tăiere de formare': '🌳',
  'Tăiere de fructificare': '🌳',
  Cosire: '✂️',
  Arat: '🚜',
  Discuit: '🚜',
  Transport: '🚜',
}

describe('activity-options display mapping', () => {
  it('covers every canonical activity type with label and emoji', () => {
    for (const label of ALL_ACTIVITY_TYPE_LABELS) {
      const expectedEmoji = EXPECTED_EMOJI_BY_LABEL[label]
      expect(expectedEmoji, `missing emoji expectation for "${label}"`).toBeDefined()
      expect(getActivityDisplayLabel(label)).toBe(label)
      expect(getActivityEmoji(label)).toBe(expectedEmoji)
      expect(formatActivityTypeLabel(label)).toBe(`${expectedEmoji} ${label}`)
    }
  })

  it('shows Prășit with hoe emoji, not generic Altele fallback', () => {
    expect(getActivityDisplayLabel('Prășit')).toBe('Prășit')
    expect(getActivityEmoji('Prășit')).toBe('⛏️')
  })

  it('uses Altele label and wrench emoji only for Altele or missing tip', () => {
    expect(getActivityDisplayLabel('Altele')).toBe('Altele')
    expect(getActivityEmoji('Altele')).toBe('🔧')
    expect(getActivityDisplayLabel(null)).toBe('Activitate')
    expect(getActivityEmoji(null)).toBe('🔧')
    expect(getActivityDisplayLabel('')).toBe('Activitate')
  })
})
