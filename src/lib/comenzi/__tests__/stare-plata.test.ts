import { describe, expect, it, vi } from 'vitest'

import { completeazaStareaPlatii, type StarePlataRpcClient } from '@/lib/comenzi/stare-plata'

const PLATA = {
  status_plata: 'platit',
  data_incasare: '2026-11-20',
  cantitate_kg: 4,
  pret_lei_kg: 25,
  suma_incasata_partial_lei: null,
}

function client(raspuns: { data: unknown; error: { code?: string; message?: string } | null }) {
  const rpc = vi.fn(async () => raspuns)
  return { client: { rpc } as unknown as StarePlataRpcClient, rpc }
}

describe('completeazaStareaPlatii', () => {
  it('proprietarul (legătura plină): nicio cerere în plus', async () => {
    const { client: c, rpc } = client({ data: [], error: null })
    const rows = [{ id: 'c1', linked_vanzare_id: 'v1', vanzare: PLATA }, { id: 'c2', linked_vanzare_id: null, vanzare: null }]
    const result = await completeazaStareaPlatii(c, rows)
    expect(rpc).not.toHaveBeenCalled()
    expect(result).toBe(rows)
  })

  it('operatorul (legătura goală din RLS): cere doar comenzile cu vânzare legată și completează plata', async () => {
    const { client: c, rpc } = client({
      data: [{ comanda_id: 'c1', ...PLATA, cantitate_kg: '4', pret_lei_kg: '25' }],
      error: null,
    })
    const rows = [
      { id: 'c1', linked_vanzare_id: 'v1', vanzare: null },
      { id: 'c2', linked_vanzare_id: null, vanzare: null },
      { id: 'c3', linked_vanzare_id: 'v3', vanzare: null },
    ]
    const result = await completeazaStareaPlatii(c, rows)
    expect(rpc).toHaveBeenCalledWith('comenzi_stare_plata', { p_comanda_ids: ['c1', 'c3'] })
    expect(result[0].vanzare).toEqual(PLATA)
    expect(result[1].vanzare).toBeNull()
    // Fără drept pe Comenzi / Livrări funcția nu întoarce rândul: comanda rămâne fără plată.
    expect(result[2].vanzare).toBeNull()
  })

  it('fără migrare (PGRST202): comenzile rămân cum au venit, fără eroare', async () => {
    const { client: c } = client({ data: null, error: { code: 'PGRST202', message: 'Could not find the function' } })
    const rows = [{ id: 'c1', linked_vanzare_id: 'v1', vanzare: null }]
    await expect(completeazaStareaPlatii(c, rows)).resolves.toBe(rows)
  })

  it('cererea aruncă: comenzile rămân cum au venit', async () => {
    const rpc = vi.fn(async () => {
      throw new Error('fetch failed')
    })
    const rows = [{ id: 'c1', linked_vanzare_id: 'v1', vanzare: null }]
    await expect(completeazaStareaPlatii({ rpc } as unknown as StarePlataRpcClient, rows)).resolves.toBe(rows)
  })

  it('multe comenzi: loturi de cel mult 500', async () => {
    const { client: c, rpc } = client({ data: [], error: null })
    const rows = Array.from({ length: 1201 }, (_, i) => ({ id: `c${i}`, linked_vanzare_id: `v${i}`, vanzare: null }))
    await completeazaStareaPlatii(c, rows)
    expect(rpc).toHaveBeenCalledTimes(3)
  })
})
