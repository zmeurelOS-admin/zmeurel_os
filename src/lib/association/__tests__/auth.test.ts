import { describe, expect, it, vi, beforeEach } from 'vitest'

import {
  canManageAssociationCatalog,
  getAssociationRole,
  isAssociationAdmin,
} from '@/lib/association/auth'

const mockMaybeSingle = vi.fn()
const mockFrom = vi.fn(() => ({
  select: () => ({
    eq: () => ({
      maybeSingle: mockMaybeSingle,
    }),
  }),
}))

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => ({
    from: mockFrom,
  })),
}))

describe('lib/association/auth', () => {
  const uid = '550e8400-e29b-41d4-a716-446655440099'

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('getAssociationRole returnează admin pentru membru valid', async () => {
    mockMaybeSingle.mockResolvedValue({ data: { role: 'admin' }, error: null })
    await expect(getAssociationRole(uid)).resolves.toBe('admin')
  })

  it('getAssociationRole returnează null fără membership / eroare', async () => {
    mockMaybeSingle.mockResolvedValue({ data: null, error: null })
    await expect(getAssociationRole(uid)).resolves.toBeNull()
    mockMaybeSingle.mockResolvedValue({ data: { role: null }, error: null })
    await expect(getAssociationRole(uid)).resolves.toBeNull()
    mockMaybeSingle.mockResolvedValue({ data: null, error: { message: 'x' } })
    await expect(getAssociationRole(uid)).resolves.toBeNull()
  })

  it('isAssociationAdmin reflectă rolul', async () => {
    mockMaybeSingle.mockResolvedValue({ data: { role: 'admin' }, error: null })
    await expect(isAssociationAdmin(uid)).resolves.toBe(true)
    mockMaybeSingle.mockResolvedValue({ data: { role: 'viewer' }, error: null })
    await expect(isAssociationAdmin(uid)).resolves.toBe(false)
  })

  it('canManageAssociationCatalog: true pentru admin și moderator, false pentru viewer', async () => {
    mockMaybeSingle.mockResolvedValue({ data: { role: 'admin' }, error: null })
    await expect(canManageAssociationCatalog(uid)).resolves.toBe(true)
    mockMaybeSingle.mockResolvedValue({ data: { role: 'moderator' }, error: null })
    await expect(canManageAssociationCatalog(uid)).resolves.toBe(true)
    mockMaybeSingle.mockResolvedValue({ data: { role: 'viewer' }, error: null })
    await expect(canManageAssociationCatalog(uid)).resolves.toBe(false)
    mockMaybeSingle.mockResolvedValue({ data: null, error: null })
    await expect(canManageAssociationCatalog(uid)).resolves.toBe(false)
  })
})
