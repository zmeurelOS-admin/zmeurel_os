import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  createComanda: vi.fn(),
  deleteComanda: vi.fn(),
  deliverComanda: vi.fn(),
  getComandaStatus: vi.fn(),
  updateComanda: vi.fn(),
}))

vi.mock('@/lib/supabase/queries/comenzi', () => mocks)

import { saveVanzareRapida } from '@/lib/vanzari/vanzare-rapida'

const vanzare = { id: 'v1', cantitate_kg: 2 }

function input(over: Partial<Parameters<typeof saveVanzareRapida>[0]> = {}) {
  return {
    clientId: null,
    kg: 3,
    pretLeiKg: 30,
    todayIso: '2026-11-21',
    pendingComandaId: null,
    onPendingChange: vi.fn(),
    ...over,
  }
}

describe('saveVanzareRapida', () => {
  beforeEach(() => {
    for (const fn of Object.values(mocks)) fn.mockReset()
    // Ca serverul: comanda întoarsă are câmpurile trimise.
    mocks.createComanda.mockImplementation(async (payload: Record<string, unknown>) => ({ id: 'c1', ...payload }))
    mocks.deliverComanda.mockResolvedValue({ vanzare, deductedStockKg: 3 })
  })

  it('prima încercare: creează comanda și o livrează încasată', async () => {
    const result = await saveVanzareRapida(input())
    expect(mocks.getComandaStatus).not.toHaveBeenCalled()
    expect(mocks.createComanda).toHaveBeenCalledWith(expect.objectContaining({ status: 'confirmata', cantitate_kg: 3 }))
    expect(mocks.deliverComanda).toHaveBeenCalledWith({ comandaId: 'c1', cantitateLivrataKg: 3, statusPlata: 'platit' })
    expect(result.comandaId).toBe('c1')
  })

  it('reîncercare după o livrare făcută pe server: nu rescrie comanda livrată', async () => {
    mocks.getComandaStatus.mockResolvedValue('livrata')
    const onPendingChange = vi.fn()
    const result = await saveVanzareRapida(input({ pendingComandaId: 'c1', kg: 5, onPendingChange }))
    expect(mocks.updateComanda).not.toHaveBeenCalled()
    expect(mocks.createComanda).not.toHaveBeenCalled()
    expect(result.vanzare).toBe(vanzare)
    expect(onPendingChange).toHaveBeenCalledWith(null)
  })

  it('reîncercare cu comanda încă nelivrată: o aduce la zi și o livrează', async () => {
    mocks.getComandaStatus.mockResolvedValue('confirmata')
    await saveVanzareRapida(input({ pendingComandaId: 'c1', kg: 5 }))
    expect(mocks.updateComanda).toHaveBeenCalledWith('c1', expect.objectContaining({ cantitate_kg: 5 }))
    expect(mocks.createComanda).not.toHaveBeenCalled()
  })

  it('reîncercare cu comanda dispărută: face una nouă', async () => {
    mocks.getComandaStatus.mockResolvedValue(null)
    await saveVanzareRapida(input({ pendingComandaId: 'c-veche' }))
    expect(mocks.updateComanda).not.toHaveBeenCalled()
    expect(mocks.createComanda).toHaveBeenCalledTimes(1)
  })

  it('trimite cheia formularului pe comandă', async () => {
    await saveVanzareRapida(input({ clientSyncId: 'cheie-1' }))
    expect(mocks.createComanda).toHaveBeenCalledWith(expect.objectContaining({ client_sync_id: 'cheie-1' }))
  })

  it('aceeași cheie de două ori (răspunsul primei cereri s-a pierdut): o singură comandă, o singură vânzare', async () => {
    // Serverul, pe scurt: o comandă pe cheie; o comandă livrată întoarce vânzarea ei.
    const comenzi = new Map<string, { id: string; status: string; client_id: null; client_nume_manual: string; cantitate_kg: number; pret_per_kg: number }>()
    const vanzari: string[] = []
    let pierdeRaspunsul = true
    mocks.createComanda.mockImplementation(async (payload: { client_sync_id: string; client_nume_manual: string; cantitate_kg: number; pret_per_kg: number }) => {
      let comanda = comenzi.get(payload.client_sync_id)
      if (!comanda) {
        comanda = {
          id: `c${comenzi.size + 1}`,
          status: 'confirmata',
          client_id: null,
          client_nume_manual: payload.client_nume_manual,
          cantitate_kg: payload.cantitate_kg,
          pret_per_kg: payload.pret_per_kg,
        }
        comenzi.set(payload.client_sync_id, comanda)
      }
      if (pierdeRaspunsul) {
        pierdeRaspunsul = false
        throw new Error('Failed to fetch')
      }
      return comanda
    })
    mocks.deliverComanda.mockImplementation(async ({ comandaId }: { comandaId: string }) => {
      const comanda = [...comenzi.values()].find((row) => row.id === comandaId)!
      if (comanda.status !== 'livrata') {
        comanda.status = 'livrata'
        vanzari.push(`v-${comandaId}`)
      }
      return { vanzare: { id: `v-${comandaId}`, cantitate_kg: comanda.cantitate_kg }, deductedStockKg: 0 }
    })

    await expect(saveVanzareRapida(input({ clientSyncId: 'cheie-1' }))).rejects.toThrow('Failed to fetch')
    const result = await saveVanzareRapida(input({ clientSyncId: 'cheie-1' }))

    expect(comenzi.size).toBe(1)
    expect(vanzari).toEqual(['v-c1'])
    expect(result.comandaId).toBe('c1')
    expect(mocks.updateComanda).not.toHaveBeenCalled()
  })

  it('cheia găsește comanda veche cu altă cantitate: o aduce la zi înainte de livrare', async () => {
    mocks.createComanda.mockResolvedValue({
      id: 'c1',
      status: 'confirmata',
      client_id: null,
      client_nume_manual: 'La poartă',
      cantitate_kg: 3,
      pret_per_kg: 30,
    })
    await saveVanzareRapida(input({ clientSyncId: 'cheie-1', kg: 5 }))
    expect(mocks.updateComanda).toHaveBeenCalledWith('c1', expect.objectContaining({ cantitate_kg: 5 }))
    expect(mocks.deliverComanda).toHaveBeenCalledWith({ comandaId: 'c1', cantitateLivrataKg: 5, statusPlata: 'platit' })
  })

  it('cheia găsește comanda deja livrată: nu o rescrie, întoarce vânzarea ei', async () => {
    mocks.createComanda.mockResolvedValue({
      id: 'c1',
      status: 'livrata',
      client_id: null,
      client_nume_manual: 'La poartă',
      cantitate_kg: 3,
      pret_per_kg: 30,
    })
    const result = await saveVanzareRapida(input({ clientSyncId: 'cheie-1', kg: 5 }))
    expect(mocks.updateComanda).not.toHaveBeenCalled()
    expect(result.vanzare).toBe(vanzare)
  })

  it('la eșecul livrării șterge comanda abia creată', async () => {
    mocks.deliverComanda.mockRejectedValue(new Error('STOC_INSUFICIENT'))
    await expect(saveVanzareRapida(input())).rejects.toThrow('STOC_INSUFICIENT')
    expect(mocks.deleteComanda).toHaveBeenCalledWith('c1')
  })
})
