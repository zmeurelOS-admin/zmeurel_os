import { describe, expect, it, vi } from 'vitest'

import type { RecoltareAttempt } from '@/lib/recoltari/day-view'
import { createRecoltareSaveGuard, saveRecoltareGuarded } from '@/lib/recoltari/save-guard'
import type { CreateRecoltareInput, Recoltare, RecoltareMutationResult } from '@/lib/supabase/queries/recoltari'

const KEY = '0b9c1d2e-3f40-4a5b-8c6d-7e8f90a1b2c3'

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

describe('salvarea recoltării, o singură dată per cheie', () => {
  it('trimite cheia formularului ca client_sync_id', async () => {
    const guard = createRecoltareSaveGuard(KEY)
    const create = vi.fn(async (input: CreateRecoltareInput) => ok(input))

    const outcome = await saveRecoltareGuarded({ guard, attempt, observatii: 'notă', create })

    expect(outcome).toMatchObject({ status: 'saved', differs: false })
    expect(create).toHaveBeenCalledTimes(1)
    expect(create).toHaveBeenCalledWith({ ...attempt, observatii: 'notă', client_sync_id: KEY })
  })

  it('dublu-tap: a doua apăsare, cât prima e în curs, nu trimite nimic', async () => {
    const guard = createRecoltareSaveGuard(KEY)
    let release: (value: RecoltareMutationResult) => void = () => {}
    const create = vi.fn(
      () =>
        new Promise<RecoltareMutationResult>((resolve) => {
          release = resolve
        }),
    )

    const first = saveRecoltareGuarded({ guard, attempt, create })
    const second = await saveRecoltareGuarded({ guard, attempt, create })

    expect(second).toEqual({ status: 'busy' })
    release(ok(attempt))
    await expect(first).resolves.toMatchObject({ status: 'saved' })
    expect(create).toHaveBeenCalledTimes(1)
  })

  it('după o salvare reușită, aceeași cheie nu mai trimite', async () => {
    const guard = createRecoltareSaveGuard(KEY)
    const create = vi.fn(async (input: CreateRecoltareInput) => ok(input))

    const first = await saveRecoltareGuarded({ guard, attempt, create })
    const again = await saveRecoltareGuarded({ guard, attempt, create })

    expect(again).toBe(first)
    expect(create).toHaveBeenCalledTimes(1)
  })

  it('reîncercarea după un eșec retrimite cu ACEEAȘI cheie (serverul hotărăște dacă există deja)', async () => {
    const guard = createRecoltareSaveGuard(KEY)
    const create = vi
      .fn<(input: CreateRecoltareInput) => Promise<RecoltareMutationResult>>()
      .mockResolvedValueOnce({ success: false, error: 'Failed to fetch' })
      .mockImplementationOnce(async (input) => ok(input, 'creat-la-prima-incercare'))

    const first = await saveRecoltareGuarded({ guard, attempt, create })
    expect(first).toEqual({ status: 'failed', error: 'Failed to fetch' })

    const second = await saveRecoltareGuarded({ guard, attempt, create })

    expect(second).toMatchObject({ status: 'saved', differs: false })
    expect(create).toHaveBeenCalledTimes(2)
    expect(create.mock.calls[0][0].client_sync_id).toBe(KEY)
    expect(create.mock.calls[1][0].client_sync_id).toBe(KEY)
  })

  it('kilograme schimbate între încercări: serverul întoarce prima recoltare, iar garda spune că diferă', async () => {
    const guard = createRecoltareSaveGuard(KEY)
    const create = vi
      .fn<(input: CreateRecoltareInput) => Promise<RecoltareMutationResult>>()
      .mockResolvedValueOnce({ success: false, error: 'Failed to fetch' })
      // A doua cerere, cu aceeași cheie: serverul întoarce rândul creat de prima (27,35), nu 27,5.
      .mockResolvedValueOnce({ success: true, data: rowFrom(attempt, 'creat-la-prima-incercare') })

    await saveRecoltareGuarded({ guard, attempt, create })
    const second = await saveRecoltareGuarded({ guard, attempt: { ...attempt, kg_cal1: 27.5 }, create })

    expect(second).toMatchObject({ status: 'saved', differs: true })
    if (second.status === 'saved') expect(second.recoltare.kg_cal1).toBe(27.35)
  })

  it('o gardă nouă (alt formular) are altă cheie', async () => {
    const create = vi.fn(async (input: CreateRecoltareInput) => ok(input))

    await saveRecoltareGuarded({ guard: createRecoltareSaveGuard(KEY), attempt, create })
    await saveRecoltareGuarded({ guard: createRecoltareSaveGuard('alta-cheie'), attempt, create })

    expect(create.mock.calls.map(([input]) => input.client_sync_id)).toEqual([KEY, 'alta-cheie'])
  })

  it('o excepție la trimitere e eșec, iar garda rămâne folosibilă', async () => {
    const guard = createRecoltareSaveGuard(KEY)
    const create = vi
      .fn<(input: CreateRecoltareInput) => Promise<RecoltareMutationResult>>()
      .mockRejectedValueOnce(new Error('boom'))
      .mockImplementationOnce(async (input) => ok(input))

    const first = await saveRecoltareGuarded({ guard, attempt, create })
    expect(first).toEqual({ status: 'failed', error: 'boom' })
    expect(guard.inFlight).toBe(false)

    const second = await saveRecoltareGuarded({ guard, attempt, create })
    expect(second).toMatchObject({ status: 'saved' })
  })

  it('păstrează avertismentul de la sincronizarea manoperei', async () => {
    const guard = createRecoltareSaveGuard(KEY)
    const create = vi.fn(
      async (input: CreateRecoltareInput): Promise<RecoltareMutationResult> => ({
        success: true,
        data: rowFrom(input, 'nou'),
        warning: 'Manopera nu s-a sincronizat.',
      }),
    )

    const outcome = await saveRecoltareGuarded({ guard, attempt, create })
    expect(outcome).toMatchObject({ status: 'saved', warning: 'Manopera nu s-a sincronizat.' })
  })
})
