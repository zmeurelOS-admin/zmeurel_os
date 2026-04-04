import { describe, expect, it, vi, beforeEach } from 'vitest'

import {
  createNotification,
  createNotificationsForAssociationAdmins,
  createNotificationForTenantOwner,
  NOTIFICATION_TYPES,
} from '@/lib/notifications/create'

const getAssociationRoleForUserId = vi.fn()
vi.mock('@/lib/association/resolve-association-role-server', () => ({
  getAssociationRoleForUserId: (uid: string) => getAssociationRoleForUserId(uid),
}))

const navMocks = vi.hoisted(() => ({
  getNotificationHref: vi.fn((_notification: unknown, _associationRole: unknown) => '/test-url'),
}))
vi.mock('@/lib/notifications/navigation', () => ({
  getNotificationHref: navMocks.getNotificationHref,
}))

const fireWebPushForNotification = vi.fn()
vi.mock('@/lib/notifications/send-push', () => ({
  fireWebPushForNotification: (payload: unknown) => fireWebPushForNotification(payload),
}))

const mocks = vi.hoisted(() => ({
  insertPayloads: [] as Record<string, unknown>[],
  lastAssociationQuery: null as { roles: string[] } | null,
  admin: null as ReturnType<typeof buildAdmin> | null,
}))

function buildAdmin() {
  return {
    from: (table: string) => {
      if (table === 'notifications') {
        return {
          insert: (payload: Record<string, unknown>) => {
            mocks.insertPayloads.push(payload)
            return {
              select: () => ({
                single: async () => ({
                  data: { id: 'notif-uuid-1' },
                  error: null,
                }),
              }),
            }
          },
        }
      }
      if (table === 'association_members') {
        return {
          select: () => ({
            in: (_col: string, vals: string[]) => {
              mocks.lastAssociationQuery = { roles: vals }
              return Promise.resolve({
                data: [{ user_id: 'u-admin' }, { user_id: 'u-mod' }],
                error: null,
              })
            },
          }),
        }
      }
      if (table === 'tenants') {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({
                data: { owner_user_id: 'owner-uid-1' },
                error: null,
              }),
            }),
          }),
        }
      }
      throw new Error(`unexpected table ${table}`)
    },
  }
}

vi.mock('@/lib/supabase/admin', () => ({
  getSupabaseAdmin: () => {
    mocks.admin = buildAdmin()
    return mocks.admin
  },
}))

describe('createNotification', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.insertPayloads = []
    getAssociationRoleForUserId.mockResolvedValue(null)
  })

  it('inserează în notifications cu câmpuri + returnează id', async () => {
    const id = await createNotification(
      'user-1',
      NOTIFICATION_TYPES.system,
      'Titlu',
      'Corp',
      { foo: 'bar' },
      'association_member',
      'ent-1',
    )
    expect(id).toBe('notif-uuid-1')
    expect(mocks.insertPayloads[0]).toMatchObject({
      user_id: 'user-1',
      type: NOTIFICATION_TYPES.system,
      title: 'Titlu',
      body: 'Corp',
      entity_type: 'association_member',
      entity_id: 'ent-1',
    })
    expect(fireWebPushForNotification).toHaveBeenCalled()
  })
})

describe('createNotificationsForAssociationAdmins', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.insertPayloads = []
    getAssociationRoleForUserId.mockResolvedValue(null)
  })

  it('interoghează admin+moderator și inserează per membru', async () => {
    await createNotificationsForAssociationAdmins(
      NOTIFICATION_TYPES.order_new,
      'Comandă',
      'Detalii',
      {},
      'order',
      'oid',
    )
    expect(mocks.lastAssociationQuery?.roles).toEqual(['admin', 'moderator'])
    expect(mocks.insertPayloads.length).toBeGreaterThanOrEqual(1)
  })
})

describe('createNotificationForTenantOwner', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.insertPayloads = []
    getAssociationRoleForUserId.mockResolvedValue(null)
  })

  it('citește owner_user_id și notifică owner', async () => {
    const id = await createNotificationForTenantOwner(
      'tenant-x',
      NOTIFICATION_TYPES.product_listed,
      'Produs',
      'Listat',
      {},
      'product',
      'pid',
    )
    expect(id).toBe('notif-uuid-1')
    expect(mocks.insertPayloads[0]?.user_id).toBe('owner-uid-1')
  })
})

