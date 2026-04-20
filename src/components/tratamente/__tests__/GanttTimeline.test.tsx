import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { GanttTimeline } from '@/components/tratamente/GanttTimeline'

const rows = Array.from({ length: 12 }, (_, index) => ({
  luna: index + 1,
  aplicari: index === 3
    ? [
        { aplicareId: 'fungicid-1', ziua: 20, tipCuloare: 'blue', status: 'aplicata' },
        { aplicareId: 'anulata-1', ziua: 21, tipCuloare: 'gray', status: 'anulata' },
      ]
    : [],
}))

describe('GanttTimeline', () => {
  it('afișează 12 luni', () => {
    render(
      <GanttTimeline
        rows={rows}
        labelsById={{
          'fungicid-1': { produs: 'Switch', data: '20 apr 2026' },
          'anulata-1': { produs: 'Produs anulat', data: '21 apr 2026' },
        }}
      />
    )

    expect(screen.getByText('Ian')).toBeInTheDocument()
    expect(screen.getByText('Dec')).toBeInTheDocument()
  })

  it('aplicarea fungicid are clasa albastră', () => {
    render(
      <GanttTimeline
        rows={rows}
        labelsById={{
          'fungicid-1': { produs: 'Switch', data: '20 apr 2026' },
          'anulata-1': { produs: 'Produs anulat', data: '21 apr 2026' },
        }}
      />
    )

    const pills = screen.getAllByTestId('gantt-pill')
    expect(pills[0]).toHaveClass('bg-sky-500')
  })

  it('aplicarea anulată are stil distinct', () => {
    render(
      <GanttTimeline
        rows={rows}
        labelsById={{
          'fungicid-1': { produs: 'Switch', data: '20 apr 2026' },
          'anulata-1': { produs: 'Produs anulat', data: '21 apr 2026' },
        }}
      />
    )

    expect(screen.getByTestId('gantt-pill-cancelled-line')).toBeInTheDocument()
  })

  it('tap pe pastilă emite callback cu aplicareId', async () => {
    const user = userEvent.setup()
    const onSelect = vi.fn()

    render(
      <GanttTimeline
        rows={rows}
        labelsById={{
          'fungicid-1': { produs: 'Switch', data: '20 apr 2026' },
          'anulata-1': { produs: 'Produs anulat', data: '21 apr 2026' },
        }}
        onSelect={onSelect}
      />
    )

    await user.click(screen.getAllByTestId('gantt-pill')[0]!)
    expect(onSelect).toHaveBeenCalledWith('fungicid-1')
  })
})

