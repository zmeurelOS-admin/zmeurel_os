import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { getCurrentSezon } from '@/lib/utils/sezon'

describe('getCurrentSezon', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('returnează anul curent din Date', () => {
    vi.setSystemTime(new Date('2032-04-20T12:00:00Z'))

    expect(getCurrentSezon()).toBe(2032)
  })
})
