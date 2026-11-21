/* @vitest-environment node */

import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ rpc: vi.fn() }))

vi.mock('@/lib/supabase/client', () => ({
  getSupabase: () => ({ rpc: mocks.rpc }),
}))

import { deliverAndCloneComanda } from '@/lib/supabase/queries/comenzi'

const ok = {
  data: {
    delivered_order: { id: 'c1', status: 'livrata', cantitate_kg: 5, pret_per_kg: 35 },
    vanzare: { id: 'v1' },
    new_order: { id: 'c2', status: 'programata', cantitate_kg: 5, pret_per_kg: 35 },
  },
  error: null,
}

describe('„Livrează și copiază” — plata', () => {
  beforeEach(() => {
    mocks.rpc.mockReset()
    mocks.rpc.mockResolvedValue(ok)
  })

  it('cu avans nu mai marchează vânzarea încasată', async () => {
    await deliverAndCloneComanda({
      comandaId: 'c1',
      newCantitateKg: 5,
      newDataLivrare: '2026-11-25',
      plata: { statusPlata: 'neplatit', sumaPrimitaLei: 100, plataId: 'p-1' },
    })
    expect(mocks.rpc).toHaveBeenCalledWith('livreaza_si_copiaza_comanda', {
      p_comanda_id: 'c1',
      p_new_cantitate_kg: 5,
      p_new_data_livrare: '2026-11-25',
      p_status_plata: 'neplatit',
      p_suma_primita_lei: 100,
      p_plata_id: 'p-1',
    })
  })

  it('neîncasat: neplatit, fără sumă', async () => {
    await deliverAndCloneComanda({
      comandaId: 'c1',
      newCantitateKg: 5,
      newDataLivrare: '2026-11-25',
      plata: { statusPlata: 'neplatit', sumaPrimitaLei: 0, plataId: 'p-2' },
    })
    expect(mocks.rpc.mock.calls[0][0]).toBe('livreaza_si_copiaza_comanda')
    expect(mocks.rpc.mock.calls[0][1]).toMatchObject({ p_status_plata: 'neplatit', p_suma_primita_lei: 0 })
  })

  it('încasat tot: drumul vechi, neschimbat', async () => {
    await deliverAndCloneComanda({
      comandaId: 'c1',
      newCantitateKg: 5,
      newDataLivrare: '2026-11-25',
      plata: { statusPlata: 'platit', sumaPrimitaLei: 175, plataId: 'p-3' },
    })
    expect(mocks.rpc).toHaveBeenCalledWith('deliver_and_clone_comanda', {
      p_comanda_id: 'c1',
      p_new_cantitate_kg: 5,
      p_new_data_livrare: '2026-11-25',
    })
  })

  it('fără funcția nouă în bază (migrare neaplicată): mesaj clar, nimic marcat încasat', async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: { code: 'PGRST202', message: 'Could not find the function' } })
    await expect(
      deliverAndCloneComanda({
        comandaId: 'c1',
        newCantitateKg: 5,
        newDataLivrare: '2026-11-25',
        plata: { statusPlata: 'neplatit', sumaPrimitaLei: 0, plataId: 'p-4' },
      }),
    ).rejects.toThrow(/actualizarea bazei de date/)
    expect(mocks.rpc).toHaveBeenCalledTimes(1)
  })
})
