import { describe, expect, it } from 'vitest'

import { calculateViewportDropdownLayout } from '@/lib/ui/viewport-dropdown'

describe('calculateViewportDropdownLayout', () => {
  it('opens below and uses the real available height when there is enough room', () => {
    expect(
      calculateViewportDropdownLayout(
        { top: 100, bottom: 140, left: 16, width: 358 },
        { top: 0, left: 0, height: 844, width: 390, layoutHeight: 844 },
      ),
    ).toEqual({ left: 16, width: 358, maxHeight: 688, top: 144 })
  })

  it('flips above and anchors its bottom to the input when less than 250px remain below', () => {
    expect(
      calculateViewportDropdownLayout(
        { top: 700, bottom: 740, left: 16, width: 358 },
        { top: 0, left: 0, height: 844, width: 390, layoutHeight: 844 },
      ),
    ).toEqual({ left: 16, width: 358, maxHeight: 684, bottom: 148 })
  })

  it('uses the visual viewport reduced by a virtual keyboard', () => {
    expect(
      calculateViewportDropdownLayout(
        { top: 330, bottom: 370, left: 18, width: 378 },
        { top: 0, left: 0, height: 420, width: 414, layoutHeight: 844 },
      ),
    ).toEqual({ left: 18, width: 378, maxHeight: 314, bottom: 518 })
  })

  it('accounts for an offset visual viewport and keeps the dropdown inside its horizontal edges', () => {
    expect(
      calculateViewportDropdownLayout(
        { top: 260, bottom: 300, left: 4, width: 390 },
        { top: 120, left: 8, height: 500, width: 390, layoutHeight: 844 },
      ),
    ).toEqual({ left: 24, width: 358, maxHeight: 304, top: 304 })
  })
})
