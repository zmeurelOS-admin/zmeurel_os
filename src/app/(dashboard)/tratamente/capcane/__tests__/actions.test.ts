import { beforeEach, describe, expect, it, vi } from 'vitest'

const listCapcaneActiveMock = vi.fn()

vi.mock('@/lib/supabase/queries/tratamente', () => ({
  listCapcaneActive: (...args: unknown[]) => listCapcaneActiveMock(...args),
  mapTratamenteError: (_error: unknown, fallback: string) => ({ message: fallback }),
}))

import { listCapcaneActiveAction } from '@/app/(dashboard)/tratamente/capcane/actions'

describe('listCapcaneActiveAction', () => {
  beforeEach(() => {
    listCapcaneActiveMock.mockReset()
  })

  it('întoarce listă goală când nu există capcane montate', async () => {
    listCapcaneActiveMock.mockResolvedValue([])

    const result = await listCapcaneActiveAction({
      parcelaId: '00000000-0000-4000-8000-000000000101',
    })

    expect(result).toEqual({ ok: true, data: [] })
    expect(listCapcaneActiveMock).toHaveBeenCalledWith('00000000-0000-4000-8000-000000000101')
  })

  it('întoarce eroare structurată când query-ul eșuează', async () => {
    listCapcaneActiveMock.mockRejectedValue(new Error('db down'))

    const result = await listCapcaneActiveAction({
      parcelaId: '00000000-0000-4000-8000-000000000101',
    })

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error).toContain('Nu am putut încărca capcanele active')
    }
  })
})
