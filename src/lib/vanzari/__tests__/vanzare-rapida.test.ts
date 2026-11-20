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
    mocks.createComanda.mockResolvedValue({ id: 'c1' })
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

  it('la eșecul livrării șterge comanda abia creată', async () => {
    mocks.deliverComanda.mockRejectedValue(new Error('STOC_INSUFICIENT'))
    await expect(saveVanzareRapida(input())).rejects.toThrow('STOC_INSUFICIENT')
    expect(mocks.deleteComanda).toHaveBeenCalledWith('c1')
  })
})
