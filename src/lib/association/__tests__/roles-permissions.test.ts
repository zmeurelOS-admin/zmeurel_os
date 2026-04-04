import { describe, expect, it, vi, beforeEach } from 'vitest'

import {
  canManageAssociationCatalog,
  getAssociationRole,
  requireAssociationAccess,
} from '@/lib/association/auth'

const mockMaybeSingle = vi.fn()
const mockGetUser = vi.fn()

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => ({
    auth: {
      getUser: () => mockGetUser(),
    },
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: mockMaybeSingle,
        }),
      }),
    }),
  })),
}))

const redirectMock = vi.fn()
vi.mock('next/navigation', () => ({
  redirect: (url: string) => {
    redirectMock(url)
    throw new Error('NEXT_REDIRECT')
  },
}))

describe('roles-permissions / getAssociationRole', () => {
  const uid = '550e8400-e29b-41d4-a716-446655440100'

  beforeEach(() => {
    vi.clearAllMocks()
    redirectMock.mockClear()
  })

  it("returnează 'admin' pentru admin", async () => {
    mockMaybeSingle.mockResolvedValue({ data: { role: 'admin' }, error: null })
    await expect(getAssociationRole(uid)).resolves.toBe('admin')
  })

  it("returnează 'moderator' pentru moderator", async () => {
    mockMaybeSingle.mockResolvedValue({ data: { role: 'moderator' }, error: null })
    await expect(getAssociationRole(uid)).resolves.toBe('moderator')
  })

  it("returnează 'viewer' pentru viewer", async () => {
    mockMaybeSingle.mockResolvedValue({ data: { role: 'viewer' }, error: null })
    await expect(getAssociationRole(uid)).resolves.toBe('viewer')
  })

  it('returnează null pentru non-membru', async () => {
    mockMaybeSingle.mockResolvedValue({ data: null, error: null })
    await expect(getAssociationRole(uid)).resolves.toBeNull()
  })

  it('returnează null dacă rolul din DB nu e în setul permis', async () => {
    mockMaybeSingle.mockResolvedValue({ data: { role: 'superuser' }, error: null })
    await expect(getAssociationRole(uid)).resolves.toBeNull()
  })
})

describe('roles-permissions / canManageAssociationCatalog', () => {
  const uid = '550e8400-e29b-41d4-a716-446655440101'

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('true pentru admin', async () => {
    mockMaybeSingle.mockResolvedValue({ data: { role: 'admin' }, error: null })
    await expect(canManageAssociationCatalog(uid)).resolves.toBe(true)
  })

  it('true pentru moderator', async () => {
    mockMaybeSingle.mockResolvedValue({ data: { role: 'moderator' }, error: null })
    await expect(canManageAssociationCatalog(uid)).resolves.toBe(true)
  })

  it('false pentru viewer', async () => {
    mockMaybeSingle.mockResolvedValue({ data: { role: 'viewer' }, error: null })
    await expect(canManageAssociationCatalog(uid)).resolves.toBe(false)
  })

  it('false pentru null (fără membru)', async () => {
    mockMaybeSingle.mockResolvedValue({ data: null, error: null })
    await expect(canManageAssociationCatalog(uid)).resolves.toBe(false)
  })
})

describe('roles-permissions / requireAssociationAccess', () => {
  const uid = '550e8400-e29b-41d4-a716-446655440102'

  beforeEach(() => {
    vi.clearAllMocks()
    redirectMock.mockClear()
    mockGetUser.mockResolvedValue({ data: { user: { id: uid, email: 'a@test.com' } }, error: null })
  })

  it('nu aruncă pentru membru valid (admin implicit)', async () => {
    mockMaybeSingle.mockResolvedValue({ data: { role: 'admin' }, error: null })
    await expect(requireAssociationAccess()).resolves.toEqual({
      userId: uid,
      email: 'a@test.com',
      role: 'admin',
    })
    expect(redirectMock).not.toHaveBeenCalled()
  })

  it('redirect pentru non-membru', async () => {
    mockMaybeSingle.mockResolvedValue({ data: null, error: null })
    await expect(requireAssociationAccess()).rejects.toThrow('NEXT_REDIRECT')
    expect(redirectMock).toHaveBeenCalledWith('/dashboard')
  })

  it('redirect când lipsește user', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null })
    await expect(requireAssociationAccess()).rejects.toThrow('NEXT_REDIRECT')
    expect(redirectMock).toHaveBeenCalledWith('/dashboard')
  })

  it("minRole='admin': acceptă admin", async () => {
    mockMaybeSingle.mockResolvedValue({ data: { role: 'admin' }, error: null })
    await expect(requireAssociationAccess('admin')).resolves.toMatchObject({ role: 'admin' })
  })

  it("minRole='admin': respinge moderator", async () => {
    mockMaybeSingle.mockResolvedValue({ data: { role: 'moderator' }, error: null })
    await expect(requireAssociationAccess('admin')).rejects.toThrow('NEXT_REDIRECT')
    expect(redirectMock).toHaveBeenCalledWith('/dashboard')
  })

  it("minRole='admin': respinge viewer", async () => {
    mockMaybeSingle.mockResolvedValue({ data: { role: 'viewer' }, error: null })
    await expect(requireAssociationAccess('admin')).rejects.toThrow('NEXT_REDIRECT')
  })

  it("minRole='moderator': acceptă admin", async () => {
    mockMaybeSingle.mockResolvedValue({ data: { role: 'admin' }, error: null })
    await expect(requireAssociationAccess('moderator')).resolves.toMatchObject({ role: 'admin' })
  })

  it("minRole='moderator': acceptă moderator", async () => {
    mockMaybeSingle.mockResolvedValue({ data: { role: 'moderator' }, error: null })
    await expect(requireAssociationAccess('moderator')).resolves.toMatchObject({ role: 'moderator' })
  })

  it("minRole='moderator': respinge viewer", async () => {
    mockMaybeSingle.mockResolvedValue({ data: { role: 'viewer' }, error: null })
    await expect(requireAssociationAccess('moderator')).rejects.toThrow('NEXT_REDIRECT')
  })
})
