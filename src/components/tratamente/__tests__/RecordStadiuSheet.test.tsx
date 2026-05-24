import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { RecordStadiuSheet } from '@/components/tratamente/RecordStadiuSheet'

vi.mock('@/hooks/useMediaQuery', () => ({
  useMediaQuery: () => false,
}))

describe('RecordStadiuSheet', () => {
  it('filtrează stadiile după grupul biologic și folosește fallback Rubus doar când lipsește grupul', async () => {
    const user = userEvent.setup()

    render(
      <RecordStadiuSheet
        an={2026}
        grupBiologic="solanacee"
        onOpenChange={() => undefined}
        onSubmit={() => undefined}
        open
        suggestedStadiu="buton_roz"
      />
    )

    const fenofazaTrigger = screen.getByRole('combobox', { name: 'Fenofază' })
    expect(fenofazaTrigger).toHaveTextContent('Răsad')

    await user.click(fenofazaTrigger)
    expect(screen.getByRole('option', { name: /Răsad/i })).toBeInTheDocument()
    expect(screen.getByRole('option', { name: /Transplant/i })).toBeInTheDocument()
    expect(screen.queryByRole('option', { name: /Boboci roz/i })).not.toBeInTheDocument()
  })

  it('afișează label contextual pentru post-recoltare la solanacee nedeterminat', async () => {
    render(
      <RecordStadiuSheet
        an={2026}
        configurareSezon={{
          id: 'cfg-1',
          tenant_id: 't1',
          parcela_id: 'p1',
          an: 2026,
          sistem_conducere: null,
          tip_ciclu_soi: 'nedeterminat',
          created_at: '2026-01-01T00:00:00Z',
          updated_at: '2026-01-01T00:00:00Z',
        }}
        grupBiologic="solanacee"
        onOpenChange={() => undefined}
        onSubmit={() => undefined}
        open
        suggestedStadiu="post_recoltare"
      />
    )

    expect(screen.getByRole('combobox', { name: 'Fenofază' })).toHaveTextContent('Producție în curs')
  })
})
