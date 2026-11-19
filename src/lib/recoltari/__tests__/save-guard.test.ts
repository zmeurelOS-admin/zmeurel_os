import { describe, expect, it, vi } from 'vitest'

import type { RecoltareAttempt } from '@/lib/recoltari/day-view'
import {
  UNVERIFIED_SAVE_MESSAGE,
  createRecoltareSaveGuard,
  saveRecoltareGuarded,
} from '@/lib/recoltari/save-guard'
import type { CreateRecoltareInput, Recoltare, RecoltareMutationResult } from '@/lib/supabase/queries/recoltari'

const attempt: RecoltareAttempt = {
  culegator_id: 'worker-1',
  parcela_id: 'parcela-1',
  data: '2026-11-19',
  kg_cal1: 27.35,
  kg_cal2: 0,
}

function rowFrom(input: RecoltareAttempt, id: string): Recoltare {
  return {
    id,
    id_recoltare: `REC-${id}`,
    data: input.data,
    parcela_id: input.parcela_id,
    culegator_id: input.culegator_id,
    kg_cal1: input.kg_cal1,
    kg_cal2: input.kg_cal2,
    pret_lei_pe_kg_snapshot: 2.5,
    valoare_munca_lei: 68.38,
    observatii: null,
    created_at: '2026-11-19T16:00:00.000Z',
    updated_at: '2026-11-19T16:00:00.000Z',
    tenant_id: 'tenant-1',
  }
}

const ok = (input: CreateRecoltareInput, id = 'nou'): RecoltareMutationResult => ({
  success: true,
  data: rowFrom(input, id),
})

describe('salvarea recoltării fără dubluri', () => {
  it('prima trimitere reușită nu recitește nimic', async () => {
    const guard = createRecoltareSaveGuard('cheie-1', [])
    const refetch = vi.fn()
    const create = vi.fn(async (input: CreateRecoltareInput) => ok(input))

    const outcome = await saveRecoltareGuarded({ guard, attempt, observatii: 'notă', refetch, create })

    expect(outcome).toMatchObject({ status: 'saved', recovered: false, differs: false })
    expect(create).toHaveBeenCalledTimes(1)
    expect(create).toHaveBeenCalledWith({ ...attempt, observatii: 'notă' })
    expect(refetch).not.toHaveBeenCalled()
  })

  it('dublu-tap: a doua apăsare, cât prima e în curs, nu trimite nimic', async () => {
    const guard = createRecoltareSaveGuard('cheie-1', [])
    let release: (value: RecoltareMutationResult) => void = () => {}
    const create = vi.fn(
      () =>
        new Promise<RecoltareMutationResult>((resolve) => {
          release = resolve
        }),
    )
    const refetch = vi.fn()

    const first = saveRecoltareGuarded({ guard, attempt, refetch, create })
    const second = await saveRecoltareGuarded({ guard, attempt, refetch, create })

    expect(second).toEqual({ status: 'busy' })
    release(ok(attempt))
    await expect(first).resolves.toMatchObject({ status: 'saved' })
    expect(create).toHaveBeenCalledTimes(1)
  })

  it('după o salvare reușită, aceeași cheie nu mai trimite', async () => {
    const guard = createRecoltareSaveGuard('cheie-1', [])
    const create = vi.fn(async (input: CreateRecoltareInput) => ok(input))
    const refetch = vi.fn()

    const first = await saveRecoltareGuarded({ guard, attempt, refetch, create })
    const again = await saveRecoltareGuarded({ guard, attempt, refetch, create })

    expect(again).toBe(first)
    expect(create).toHaveBeenCalledTimes(1)
  })

  it('reîncercare după o trimitere fără răspuns care ajunsese la server: nu retrimite', async () => {
    const guard = createRecoltareSaveGuard('cheie-1', [{ id: 'vechi' }])
    const create = vi.fn(async (): Promise<RecoltareMutationResult> => ({ success: false, error: 'Failed to fetch' }))
    const refetch = vi.fn(async () => [rowFrom(attempt, 'vechi'), rowFrom(attempt, 'ajuns')])

    const first = await saveRecoltareGuarded({ guard, attempt, refetch, create })
    expect(first).toEqual({ status: 'failed', error: 'Failed to fetch', unverified: false })

    const second = await saveRecoltareGuarded({ guard, attempt, refetch, create })

    expect(second).toMatchObject({ status: 'saved', recovered: true, differs: false })
    if (second.status === 'saved') expect(second.recoltare.id).toBe('ajuns')
    expect(create).toHaveBeenCalledTimes(1)
    expect(refetch).toHaveBeenCalledTimes(1)
  })

  it('reîncercare după o eroare reală: nimic nou pe server, deci retrimite', async () => {
    const guard = createRecoltareSaveGuard('cheie-1', [{ id: 'vechi' }])
    const create = vi
      .fn<(input: CreateRecoltareInput) => Promise<RecoltareMutationResult>>()
      .mockResolvedValueOnce({ success: false, error: 'Parcela invalida pentru tenantul curent.' })
      .mockImplementationOnce(async (input) => ok(input))
    // O cântărire identică, dar salvată înainte de prima trimitere, nu e dublură.
    const refetch = vi.fn(async () => [rowFrom(attempt, 'vechi')])

    await saveRecoltareGuarded({ guard, attempt, refetch, create })
    const second = await saveRecoltareGuarded({ guard, attempt, refetch, create })

    expect(second).toMatchObject({ status: 'saved', recovered: false })
    expect(create).toHaveBeenCalledTimes(2)
  })

  it('dacă nu se poate verifica (fără internet), nu retrimite', async () => {
    const guard = createRecoltareSaveGuard('cheie-1', [])
    const create = vi.fn(async (): Promise<RecoltareMutationResult> => ({ success: false, error: 'Failed to fetch' }))
    const refetch = vi.fn(async (): Promise<Recoltare[]> => {
      throw new Error('offline')
    })

    await saveRecoltareGuarded({ guard, attempt, refetch, create })
    const second = await saveRecoltareGuarded({ guard, attempt, refetch, create })

    expect(second).toEqual({ status: 'failed', error: UNVERIFIED_SAVE_MESSAGE, unverified: true })
    expect(create).toHaveBeenCalledTimes(1)

    // După ce revine internetul, verificarea trece și trimiterea se reia.
    refetch.mockImplementationOnce(async () => [])
    create.mockImplementationOnce(async () => ok(attempt))
    const third = await saveRecoltareGuarded({ guard, attempt, refetch, create })
    expect(third).toMatchObject({ status: 'saved', recovered: false })
    expect(create).toHaveBeenCalledTimes(2)
  })

  it('kilograme schimbate între încercări, prima ajunsă la server: nu creează a doua și spune că diferă', async () => {
    const guard = createRecoltareSaveGuard('cheie-1', [])
    const create = vi.fn(async (): Promise<RecoltareMutationResult> => ({ success: false, error: 'Failed to fetch' }))
    const refetch = vi.fn(async () => [rowFrom(attempt, 'ajuns')])

    await saveRecoltareGuarded({ guard, attempt, refetch, create })
    const corrected = { ...attempt, kg_cal1: 27.5 }
    const second = await saveRecoltareGuarded({ guard, attempt: corrected, refetch, create })

    expect(second).toMatchObject({ status: 'saved', recovered: true, differs: true })
    if (second.status === 'saved') expect(second.recoltare.kg_cal1).toBe(27.35)
    expect(create).toHaveBeenCalledTimes(1)
  })

  it('o excepție la trimitere e eșec, iar garda rămâne folosibilă', async () => {
    const guard = createRecoltareSaveGuard('cheie-1', [])
    const create = vi
      .fn<(input: CreateRecoltareInput) => Promise<RecoltareMutationResult>>()
      .mockRejectedValueOnce(new Error('boom'))
      .mockImplementationOnce(async (input) => ok(input))
    const refetch = vi.fn(async () => [])

    const first = await saveRecoltareGuarded({ guard, attempt, refetch, create })
    expect(first).toEqual({ status: 'failed', error: 'boom', unverified: false })
    expect(guard.inFlight).toBe(false)

    const second = await saveRecoltareGuarded({ guard, attempt, refetch, create })
    expect(second).toMatchObject({ status: 'saved' })
  })

  it('păstrează avertismentul de la sincronizarea manoperei', async () => {
    const guard = createRecoltareSaveGuard('cheie-1', [])
    const create = vi.fn(
      async (input: CreateRecoltareInput): Promise<RecoltareMutationResult> => ({
        success: true,
        data: rowFrom(input, 'nou'),
        warning: 'Manopera nu s-a sincronizat.',
      }),
    )

    const outcome = await saveRecoltareGuarded({ guard, attempt, refetch: vi.fn(), create })
    expect(outcome).toMatchObject({ status: 'saved', warning: 'Manopera nu s-a sincronizat.' })
  })
})
