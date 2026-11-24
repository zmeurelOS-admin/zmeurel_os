import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

const push = vi.fn()
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }))

import { NeincasatePeste30Acasa } from '@/components/acasa/NeincasatePeste30Acasa'
import type { ComandaPentruNeincasate } from '@/lib/notifications/zilnice/neincasate-30'

const comanda = (id: string, data: string): ComandaPentruNeincasate => ({
  id,
  tenant_id: 't1',
  status: 'livrata',
  total: 150,
  data_livrare: data,
  linked_vanzare: { data, status_plata: 'neplatit', data_incasare: null, cantitate_kg: 5, pret_lei_kg: 30, suma_incasata_partial_lei: null },
})

describe('NeincasatePeste30Acasa (promptul 33)', () => {
  const comenzi = [comanda('a', '2026-10-01'), comanda('b', '2026-10-20'), comanda('c', '2026-11-20')]

  it('proprietarul vede rândul și ajunge la lista filtrată', async () => {
    render(<NeincasatePeste30Acasa comenzi={comenzi} azi="2026-11-24" proprietar />)
    const rand = screen.getByRole('button', { name: '2 comenzi neîncasate de peste 30 de zile · total 300 lei' })
    await userEvent.click(rand)
    expect(push).toHaveBeenCalledWith('/comenzi?filter=neincasat30')
  })

  it('operatorul nu vede nimic; nici fără comenzi vechi neîncasate', () => {
    const { container: operator } = render(<NeincasatePeste30Acasa comenzi={comenzi} azi="2026-11-24" proprietar={false} />)
    expect(operator.textContent).toBe('')
    const { container: nimic } = render(<NeincasatePeste30Acasa comenzi={[comanda('c', '2026-11-20')]} azi="2026-11-24" proprietar />)
    expect(nimic.textContent).toBe('')
  })
})
