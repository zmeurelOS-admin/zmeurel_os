import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  sendNotification: vi.fn<(...args: unknown[]) => Promise<unknown>>(async () => ({})),
  setVapidDetails: vi.fn<(...args: unknown[]) => void>(() => undefined),
  getAssociationRoleForUserId: vi.fn<(uid: string) => Promise<string | null>>(async () => null),
  getNotificationHref: vi.fn<(notification: unknown, role: unknown) => string>(() => '/'),
  adminFrom: vi.fn<(table: string) => unknown>(() => ({})),
}))

vi.mock('web-push', () => ({
  default: {
    setVapidDetails: (subject: string, pub: string, priv: string) =>
      mocks.setVapidDetails(subject, pub, priv),
    sendNotification: (subscription: unknown, payload: string, options?: unknown) =>
      mocks.sendNotification(subscription, payload, options),
  },
}))

vi.mock('@/lib/supabase/admin', () => ({
  getSupabaseAdmin: () => ({ from: (table: string) => mocks.adminFrom(table) }),
}))

vi.mock('@/lib/association/resolve-association-role-server', () => ({
  getAssociationRoleForUserId: (uid: string) => mocks.getAssociationRoleForUserId(uid),
}))

vi.mock('@/lib/notifications/navigation', () => ({
  getNotificationHref: (notification: unknown, role: unknown) =>
    mocks.getNotificationHref(notification, role),
}))

const USER_ID = '11111111-1111-1111-1111-111111111111'

interface SubRow {
  id: string
  endpoint: string
  keys_p256dh: string
  keys_auth: string
}

function makeAdminFrom(rows: SubRow[], deletedIds: string[]) {
  return (table: string) => {
    if (table !== 'push_subscriptions') {
      throw new Error(`unexpected table ${table}`)
    }
    return {
      select: () => ({
        eq: async () => ({ data: rows, error: null }),
      }),
      delete: () => ({
        eq: async (_col: string, val: string) => {
          deletedIds.push(val)
          return { error: null }
        },
      }),
    }
  }
}

async function loadSendPush() {
  vi.resetModules()
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY = 'BPublicKey'
  process.env.VAPID_PRIVATE_KEY = 'BPrivateKey'
  process.env.VAPID_SUBJECT = 'mailto:test@zmeurel.local'
  return import('@/lib/notifications/send-push')
}

describe('sendPushToUser — politică unificată', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.sendNotification.mockReset()
    mocks.adminFrom.mockReset()
  })

  it('blochează apelul către web-push când shouldSendWebPushForType întoarce false', async () => {
    const { sendPushToUser } = await loadSendPush()
    // 'system' are pushEnabled: false în config
    const result = await sendPushToUser(USER_ID, 'Titlu', 'Corp', { type: 'system' })
    expect(result.skippedReason).toBe('disabled_by_policy')
    expect(mocks.sendNotification).not.toHaveBeenCalled()
    expect(mocks.adminFrom).not.toHaveBeenCalled()
  })

  it('bypassPolicy: true permite apelul chiar dacă type are pushEnabled: false', async () => {
    const { sendPushToUser } = await loadSendPush()
    const rows: SubRow[] = [
      { id: 'sub-1', endpoint: 'https://example/ep', keys_p256dh: 'p', keys_auth: 'a' },
    ]
    const deleted: string[] = []
    mocks.adminFrom.mockImplementation(makeAdminFrom(rows, deleted))
    mocks.sendNotification.mockResolvedValue({})
    const result = await sendPushToUser(USER_ID, 'Test', 'Corp', { type: 'system', bypassPolicy: true })
    expect(result.skippedReason).toBeNull()
    expect(result.sent).toBe(1)
    expect(mocks.sendNotification).toHaveBeenCalledTimes(1)
  })

  it('happy path pentru type cu pushEnabled: true (order_new)', async () => {
    const { sendPushToUser } = await loadSendPush()
    const rows: SubRow[] = [
      { id: 'sub-1', endpoint: 'https://example/ep', keys_p256dh: 'p', keys_auth: 'a' },
    ]
    const deleted: string[] = []
    mocks.adminFrom.mockImplementation(makeAdminFrom(rows, deleted))
    mocks.sendNotification.mockResolvedValue({})
    const result = await sendPushToUser(USER_ID, 'Comandă', 'Detalii', { type: 'order_new' })
    expect(result.attempted).toBe(1)
    expect(result.sent).toBe(1)
    expect(result.deleted).toBe(0)
    expect(result.failed).toBe(0)
  })

  it('410 → subscripția invalidă este ștearsă', async () => {
    const { sendPushToUser } = await loadSendPush()
    const rows: SubRow[] = [
      { id: 'sub-stale', endpoint: 'https://example/ep', keys_p256dh: 'p', keys_auth: 'a' },
    ]
    const deleted: string[] = []
    mocks.adminFrom.mockImplementation(makeAdminFrom(rows, deleted))
    mocks.sendNotification.mockRejectedValue(Object.assign(new Error('Gone'), { statusCode: 410 }))
    const result = await sendPushToUser(USER_ID, 'T', 'B', { type: 'order_new' })
    expect(result.deleted).toBe(1)
    expect(result.failed).toBe(1)
    expect(deleted).toEqual(['sub-stale'])
  })

  it('404 → subscripția invalidă este ștearsă', async () => {
    const { sendPushToUser } = await loadSendPush()
    const rows: SubRow[] = [
      { id: 'sub-404', endpoint: 'https://example/ep', keys_p256dh: 'p', keys_auth: 'a' },
    ]
    const deleted: string[] = []
    mocks.adminFrom.mockImplementation(makeAdminFrom(rows, deleted))
    mocks.sendNotification.mockRejectedValue(Object.assign(new Error('Not Found'), { statusCode: 404 }))
    const result = await sendPushToUser(USER_ID, 'T', 'B', { type: 'order_new' })
    expect(result.deleted).toBe(1)
    expect(deleted).toEqual(['sub-404'])
  })

  it('5xx → NU se șterge subscripția (eroare temporară a serverului push)', async () => {
    const { sendPushToUser } = await loadSendPush()
    const rows: SubRow[] = [
      { id: 'sub-keep', endpoint: 'https://example/ep', keys_p256dh: 'p', keys_auth: 'a' },
    ]
    const deleted: string[] = []
    mocks.adminFrom.mockImplementation(makeAdminFrom(rows, deleted))
    mocks.sendNotification.mockRejectedValue(Object.assign(new Error('Bad Gateway'), { statusCode: 502 }))
    const result = await sendPushToUser(USER_ID, 'T', 'B', { type: 'order_new' })
    expect(result.failed).toBe(1)
    expect(result.deleted).toBe(0)
    expect(deleted).toEqual([])
  })

  it('returnează skippedReason="not_configured" când VAPID lipsește', async () => {
    vi.resetModules()
    delete process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
    delete process.env.VAPID_PRIVATE_KEY
    const { sendPushToUser } = await import('@/lib/notifications/send-push')
    const result = await sendPushToUser(USER_ID, 'T', 'B', { type: 'order_new' })
    expect(result.skippedReason).toBe('not_configured')
    expect(mocks.sendNotification).not.toHaveBeenCalled()
  })

  it('returnează skippedReason="no_subscriptions" când nu există rânduri', async () => {
    const { sendPushToUser } = await loadSendPush()
    mocks.adminFrom.mockImplementation(makeAdminFrom([], []))
    const result = await sendPushToUser(USER_ID, 'T', 'B', { type: 'order_new' })
    expect(result.skippedReason).toBe('no_subscriptions')
  })
})
