/* @vitest-environment node */

import { beforeEach, describe, expect, it, vi } from 'vitest'

import { createSameOriginRequest } from '@/test/helpers/api-origin-request'

const REQUEST_ID = '00000000-0000-4000-8000-000000000777'

const mocks = vi.hoisted(() => ({
  user: { id: 'user-1' } as { id: string } | null,
  isSuperAdmin: vi.fn<(...args: unknown[]) => Promise<boolean>>(async () => false),
  update: vi.fn(),
}))

vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({ auth: { getUser: async () => ({ data: { user: mocks.user } }) } }),
}))
vi.mock('@/lib/auth/isSuperAdmin', () => ({
  isSuperAdmin: (...args: unknown[]) => mocks.isSuperAdmin(...args),
}))
vi.mock('@/lib/supabase/admin', () => ({
  getSupabaseAdmin: () => ({
    from: () => ({
      update: (values: unknown) => {
        mocks.update(values)
        return { eq: async () => ({ error: null }) }
      },
    }),
  }),
}))

async function patch() {
  const { PATCH } = await import('@/app/api/shop/b2c/notify/[id]/route')
  return PATCH(
    createSameOriginRequest(`/api/shop/b2c/notify/${REQUEST_ID}`, {
      method: 'PATCH',
      json: { notified_at: '2026-11-22T08:00:00.000Z' },
    }),
    { params: Promise.resolve({ id: REQUEST_ID }) },
  )
}

describe('PATCH /api/shop/b2c/notify/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.user = { id: 'user-1' }
    mocks.isSuperAdmin.mockResolvedValue(false)
  })

  it('un cont logat oarecare (alt fermier, demo, operator) nu poate marca cererea', async () => {
    const response = await patch()
    expect(response.status).toBe(403)
    expect(mocks.update).not.toHaveBeenCalled()
  })

  it('fără sesiune: 401', async () => {
    mocks.user = null
    const response = await patch()
    expect(response.status).toBe(401)
    expect(mocks.update).not.toHaveBeenCalled()
  })

  it('superadminul (cel care vede lista, ca în RLS) o marchează', async () => {
    mocks.isSuperAdmin.mockResolvedValue(true)
    const response = await patch()
    expect(response.status).toBe(200)
    expect(mocks.update).toHaveBeenCalledWith({ notified_at: '2026-11-22T08:00:00.000Z' })
  })
})
