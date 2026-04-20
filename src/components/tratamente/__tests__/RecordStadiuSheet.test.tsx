import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { RecordStadiuSheet } from '@/components/tratamente/RecordStadiuSheet'

vi.mock('@/hooks/useMediaQuery', () => ({
  useMediaQuery: () => false,
}))

describe('RecordStadiuSheet', () => {
  it('filtrează stadiile după grupul biologic și folosește fallback Rubus doar când lipsește grupul', async () => {
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

    expect(screen.getByRole('combobox')).toHaveTextContent('Răsad')
    const nativeSelect = document.querySelector('select[aria-hidden="true"]') as HTMLSelectElement
    const optionValues = Array.from(nativeSelect.options).map((option) => option.value)

    expect(optionValues).toContain('transplant')
    expect(optionValues).toContain('etaj_floral')
    expect(optionValues).not.toContain('buton_roz')
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

    expect(screen.getByRole('combobox')).toHaveTextContent('Producție în curs')
  })
})
