import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { PasDetalii } from '@/components/tratamente/PasDetalii'
import type { ProdusCiorna } from '@/lib/tratamente/formular'

const produs: ProdusCiorna = {
  key: 'g',
  produsId: null,
  nume: 'Gunoi de grajd',
  substanta: null,
  tip: null,
  frac: null,
  phi: 0,
  nrMaxPeSezon: null,
  intervalMinZile: null,
  unitate: 'g',
  doza: 3,
  gPePlanta: null,
  rezervor: 'A',
  unitateSol: 't',
  modSol: 'ha',
}

function deschide(over: Partial<ProdusCiorna> = {}, onProdus = vi.fn()) {
  render(
    <PasDetalii
      ciorna={{ metoda: 'sol', parcelaIds: ['m1'], produse: [{ ...produs, ...over }], mod: 'hl', volumL: null }}
      parcele={[{ id: 'm1', nume_parcela: 'Maravilla 1', suprafata_m2: 2500, nr_plante: 1000 }]}
      volumL={null}
      volumPropus={null}
      onVolum={vi.fn()}
      onParcele={vi.fn()}
      onMod={vi.fn()}
      onProdus={onProdus}
      onScoate={vi.fn()}
      onAdauga={vi.fn()}
      avertismente={[]}
      lipsa={null}
    />,
  )
  return onProdus
}

describe('„La sol” (promptul 34, §8)', () => {
  it('arată conversia: la ha → total pe parcelă', () => {
    deschide()
    expect(screen.getByLabelText('Conversia pentru Gunoi de grajd').textContent).toBe('3 t/ha × 0,25 ha = 0,75 t')
  })

  it('pe parcele, în kg → doza la ha', () => {
    deschide({ doza: 750, unitateSol: 'kg', modSol: 'total' })
    expect(screen.getByLabelText('Conversia pentru Gunoi de grajd').textContent).toBe('750 kg pe 0,25 ha = 3.000 kg/ha')
  })

  it('schimbarea unității și a modului ajunge în ciornă', async () => {
    const user = userEvent.setup()
    const onProdus = deschide()
    await user.click(screen.getByRole('tab', { name: 'kg' }))
    expect(onProdus).toHaveBeenCalledWith('g', { unitateSol: 'kg', unitate: 'g' })
    await user.click(screen.getByRole('tab', { name: 'Pe parcele' }))
    expect(onProdus).toHaveBeenCalledWith('g', { modSol: 'total' })
  })
})
