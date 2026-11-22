import { beforeEach, describe, expect, it, vi } from 'vitest'

const sonner = vi.hoisted(() => ({ success: vi.fn() }))

vi.mock('sonner', () => ({
  toast: Object.assign(vi.fn(), { success: sonner.success, error: vi.fn(), info: vi.fn(), warning: vi.fn() }),
}))

import { toast } from '@/lib/ui/toast'

describe('toast.success: mesajele cu numele unui membru nu se rescriu', () => {
  beforeEach(() => sonner.success.mockClear())

  it('„Test Recoltari a fost dezactivat.” rămâne așa (nu „Recoltare salvată”)', () => {
    toast.success('Test Recoltari a fost dezactivat.')
    expect(sonner.success).toHaveBeenCalledWith('Test Recoltari a fost dezactivat.', expect.anything())
  })

  it('mesajele obișnuite ale modulelor se normalizează ca înainte', () => {
    toast.success('Recoltarea a fost salvată')
    expect(sonner.success).toHaveBeenCalledWith('Recoltare salvată', expect.anything())
  })
})
