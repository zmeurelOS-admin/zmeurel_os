import { render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactElement } from 'react'
import { describe, expect, it, vi } from 'vitest'

import { MarkAplicataSheet } from '@/components/tratamente/MarkAplicataSheet'

vi.mock('@/hooks/useMediaQuery', () => ({
  useMediaQuery: () => false,
}))

function renderSheet(component: ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  })

  return render(
    <QueryClientProvider client={queryClient}>
      {component}
    </QueryClientProvider>
  )
}

describe('MarkAplicataSheet', () => {
  it('afișează doar stadiile valide pentru grupul biologic curent', async () => {
    renderSheet(
      <MarkAplicataSheet
        defaultCantitateMl={null}
        defaultOperator="ion"
        defaultStadiu="rasad"
        grupBiologic="solanacee"
        meteoSnapshot={null}
        onOpenChange={() => undefined}
        onSubmit={() => undefined}
        open
      />
    )

    expect(screen.getAllByRole('combobox')[0]).toHaveTextContent('Răsad')
    const nativeSelect = document.querySelector('select[aria-hidden="true"]') as HTMLSelectElement
    const optionValues = Array.from(nativeSelect.options).map((option) => option.value)

    expect(optionValues).toContain('transplant')
    expect(optionValues).toContain('legare_fruct')
    expect(optionValues).not.toContain('buton_roz')
  })

  it('afișează label contextual pentru post-recoltare la solanacee nedeterminat', async () => {
    renderSheet(
      <MarkAplicataSheet
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
        defaultCantitateMl={null}
        defaultOperator="ion"
        defaultStadiu="post_recoltare"
        grupBiologic="solanacee"
        meteoSnapshot={null}
        onOpenChange={() => undefined}
        onSubmit={() => undefined}
        open
      />
    )

    expect(screen.getAllByRole('combobox')[0]).toHaveTextContent('Producție în curs')
  })
})
