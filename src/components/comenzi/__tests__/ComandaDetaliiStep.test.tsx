import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { ComandaDetaliiStep } from '@/components/comenzi/ComandaDetaliiStep'

function renderStep(pretSeIncarca: boolean) {
  return render(
    <ComandaDetaliiStep
      clientName="Ana"
      todayIso="2026-11-21"
      cantitateKg={2}
      onCantitate={vi.fn()}
      date="2026-11-22"
      onDate={vi.fn()}
      adresa=""
      pretLeiKg={35}
      pretSeIncarca={pretSeIncarca}
      pretSursa="standard"
      orderKind="manual"
      nota=""
      prioritara={null}
      onPrioritara={vi.fn()}
      onOpenChoice={vi.fn()}
      saveError={null}
    />,
  )
}

describe('ComandaDetaliiStep — prețul standard încă neîncărcat', () => {
  it('arată un schelet, nu prețul de rezervă și nici totalul', () => {
    renderStep(true)
    expect(screen.queryByText(/35/)).toBeNull()
    expect(screen.queryByText(/70/)).toBeNull()
    expect(screen.getByText('…')).toBeTruthy()
  })

  it('arată prețul și totalul după încărcare', () => {
    renderStep(false)
    expect(screen.getByText(/35.*standard/)).toBeTruthy()
    expect(screen.getByText(/70/)).toBeTruthy()
  })
})
