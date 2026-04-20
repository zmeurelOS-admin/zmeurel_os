import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  recordStadiu: vi.fn(),
  assignPlanToParcela: vi.fn(),
  genereazaAplicariPentruParcela: vi.fn(),
  revalidatePath: vi.fn(),
}))

vi.mock('@/lib/supabase/queries/tratamente', () => ({
  recordStadiu: (...args: unknown[]) => mocks.recordStadiu(...args),
  assignPlanToParcela: (...args: unknown[]) => mocks.assignPlanToParcela(...args),
  mapTratamenteError: (_error: unknown, fallback: string) => ({ message: fallback }),
}))

vi.mock('@/lib/tratamente/generator/generator', () => ({
  genereazaAplicariPentruParcela: (...args: unknown[]) => mocks.genereazaAplicariPentruParcela(...args),
}))

vi.mock('next/cache', () => ({
  revalidatePath: (...args: unknown[]) => mocks.revalidatePath(...args),
}))

import { assignPlanAction, generateAplicariAction, recordStadiuAction } from '@/app/(dashboard)/parcele/[id]/tratamente/actions'

describe('tratamente actions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('generateAplicariAction apelează generatorul și revalidatePath pe happy path', async () => {
    mocks.genereazaAplicariPentruParcela.mockResolvedValue({ createdCount: 2, skippedCount: 1 })

    const result = await generateAplicariAction('660e8400-e29b-41d4-a716-446655440001', 2026)

    expect(result).toEqual({ ok: true, createdCount: 2, skippedCount: 1 })
    expect(mocks.genereazaAplicariPentruParcela).toHaveBeenCalledWith({
      parcelaId: '660e8400-e29b-41d4-a716-446655440001',
      an: 2026,
      dryRun: false,
    })
    expect(mocks.revalidatePath).toHaveBeenCalledWith('/parcele/660e8400-e29b-41d4-a716-446655440001/tratamente')
  })

  it('generateAplicariAction întoarce eroare prietenoasă când generatorul aruncă', async () => {
    mocks.genereazaAplicariPentruParcela.mockRejectedValue(new Error('boom'))

    const result = await generateAplicariAction('660e8400-e29b-41d4-a716-446655440001', 2026)

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error).toContain('Nu am putut genera aplicările')
    }
  })

  it('assignPlanAction invocă query-ul și revalidatePath', async () => {
    mocks.assignPlanToParcela.mockResolvedValue({ id: 'pp1' })

    const formData = new FormData()
    formData.set('parcelaId', '660e8400-e29b-41d4-a716-446655440001')
    formData.set('planId', '770e8400-e29b-41d4-a716-446655440002')
    formData.set('an', '2026')

    const result = await assignPlanAction(formData)

    expect(result).toEqual({ ok: true })
    expect(mocks.assignPlanToParcela).toHaveBeenCalledWith(
      '660e8400-e29b-41d4-a716-446655440001',
      '770e8400-e29b-41d4-a716-446655440002',
      2026,
    )
    expect(mocks.revalidatePath).toHaveBeenCalledWith('/parcele/660e8400-e29b-41d4-a716-446655440001/tratamente')
  })

  it('recordStadiuAction invocă query-ul și revalidatePath', async () => {
    mocks.recordStadiu.mockResolvedValue({ id: 's1' })

    const formData = new FormData()
    formData.set('parcelaId', '660e8400-e29b-41d4-a716-446655440001')
    formData.set('an', '2026')
    formData.set('stadiu', 'buton_verde')
    formData.set('data_observata', '2026-04-12')
    formData.set('sursa', 'manual')
    formData.set('observatii', 'Manual')

    const result = await recordStadiuAction(formData)

    expect(result).toEqual({ ok: true })
    expect(mocks.recordStadiu).toHaveBeenCalledWith({
      parcela_id: '660e8400-e29b-41d4-a716-446655440001',
      an: 2026,
      stadiu: 'buton_verde',
      cohort: null,
      data_observata: '2026-04-12',
      sursa: 'manual',
      observatii: 'Manual',
    })
    expect(mocks.revalidatePath).toHaveBeenCalledWith('/parcele/660e8400-e29b-41d4-a716-446655440001/tratamente')
  })

  it('recordStadiuAction respinge parcela invalidă cu mesaj prietenos', async () => {
    const formData = new FormData()
    formData.set('parcelaId', 'invalid')
    formData.set('an', '2026')
    formData.set('stadiu', 'buton_verde')
    formData.set('data_observata', '2026-04-12')
    formData.set('sursa', 'manual')

    const result = await recordStadiuAction(formData)

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error).toContain('Parcela selectată nu este validă')
    }
    expect(mocks.recordStadiu).not.toHaveBeenCalled()
  })
})
