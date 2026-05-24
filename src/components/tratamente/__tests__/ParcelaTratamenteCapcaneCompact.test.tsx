import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { ParcelaTratamenteCapcaneCompact } from '@/components/tratamente/ParcelaTratamenteCapcaneCompact'

describe('ParcelaTratamenteCapcaneCompact', () => {
  it('afișează empty state când nu există capcane și nu încarcă', () => {
    render(
      <ParcelaTratamenteCapcaneCompact
        capcane={[]}
        error={null}
        loading={false}
        onMountCapcana={vi.fn()}
        onRetry={vi.fn()}
        onVerifyCapcana={vi.fn()}
      />
    )

    expect(screen.getByText(/Nicio capcană montată/i)).toBeInTheDocument()
    expect(screen.queryByText(/Se încarcă capcanele/i)).not.toBeInTheDocument()
  })

  it('afișează eroare recuperabilă și reîncarcă la retry', async () => {
    const user = userEvent.setup()
    const onRetry = vi.fn()

    render(
      <ParcelaTratamenteCapcaneCompact
        capcane={[]}
        error="Nu am putut încărca capcanele."
        loading={false}
        onMountCapcana={vi.fn()}
        onRetry={onRetry}
        onVerifyCapcana={vi.fn()}
      />
    )

    await user.click(screen.getByRole('button', { name: /Reîncearcă/i }))
    expect(onRetry).toHaveBeenCalledTimes(1)
  })
})
