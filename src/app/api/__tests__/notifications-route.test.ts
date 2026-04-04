import { describe, expect, it, vi, beforeEach } from 'vitest'

import { DELETE, GET, PATCH } from '@/app/api/notifications/route'
import { createSameOriginRequest } from '@/test/helpers/api-origin-request'

vi.mock('@/lib/monitoring/sentry', () => ({ captureApiError: vi.fn() }))

const getNotifications = vi.fn()
const getUnreadCount = vi.fn()
const markAsRead = vi.fn()
const markAllAsRead = vi.fn()
const deleteNotification = vi.fn()

vi.mock('@/lib/notifications/queries', () => ({
  getNotifications: (...a: unknown[]) => getNotifications(...a),
  getUnreadCount: (...a: unknown[]) => getUnreadCount(...a),
  markAsRead: (...a: unknown[]) => markAsRead(...a),
  markAllAsRead: (...a: unknown[]) => markAllAsRead(...a),
  deleteNotification: (...a: unknown[]) => deleteNotification(...a),
}))

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
}))

vi.mock('@/lib/supabase/server', () => ({
  createClient: () => mocks.createClient(),
}))

const UID = 'aa000000-0000-4000-8000-000000000099'

function authedClient() {
  return {
    auth: {
      getUser: async () => ({ data: { user: { id: UID } }, error: null }),
    },
  }
}

describe('GET /api/notifications', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.createClient.mockResolvedValue(authedClient())
    getNotifications.mockResolvedValue([{ id: 'n1', read: false }])
    getUnreadCount.mockResolvedValue(3)
  })

  it('200: returnează notificări + unreadCount', async () => {
    const req = new Request('http://localhost:3000/api/notifications')
    const res = await GET(req)
    expect(res.status).toBe(200)
    const j = (await res.json()) as { ok: boolean; notifications: unknown[]; unreadCount: number }
    expect(j.ok).toBe(true)
    expect(j.notifications).toHaveLength(1)
    expect(j.unreadCount).toBe(3)
  })

  it('respectă limit/offset', async () => {
    const req = new Request('http://localhost:3000/api/notifications?limit=5&offset=10')
    await GET(req)
    expect(getNotifications).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ limit: 5, offset: 10, unreadOnly: false }),
    )
  })

  it('unread_only=true filtrează', async () => {
    const req = new Request('http://localhost:3000/api/notifications?unread_only=true')
    await GET(req)
    expect(getNotifications).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ unreadOnly: true }),
    )
  })

  it('401 fără user', async () => {
    mocks.createClient.mockResolvedValue({
      auth: { getUser: async () => ({ data: { user: null }, error: null }) },
    })
    const res = await GET(new Request('http://localhost:3000/api/notifications'))
    expect(res.status).toBe(401)
  })
})

describe('PATCH /api/notifications', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.createClient.mockResolvedValue(authedClient())
    getUnreadCount.mockResolvedValue(0)
  })

  it('200: mark one read', async () => {
    const nid = 'bb000000-0000-4000-8000-000000000001'
    const req = createSameOriginRequest('/api/notifications', {
      method: 'PATCH',
      json: { notificationId: nid },
    })
    const res = await PATCH(req)
    expect(res.status).toBe(200)
    expect(markAsRead).toHaveBeenCalledWith(expect.anything(), nid)
  })

  it('200: markAll', async () => {
    const req = createSameOriginRequest('/api/notifications', {
      method: 'PATCH',
      json: { markAll: true as const },
    })
    const res = await PATCH(req)
    expect(res.status).toBe(200)
    expect(markAllAsRead).toHaveBeenCalled()
  })
})

describe('DELETE /api/notifications', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.createClient.mockResolvedValue(authedClient())
    getUnreadCount.mockResolvedValue(1)
  })

  it('200: șterge notificare (apel către layer queries)', async () => {
    const nid = 'cc000000-0000-4000-8000-000000000002'
    const req = createSameOriginRequest('/api/notifications', {
      method: 'DELETE',
      json: { notificationId: nid },
    })
    const res = await DELETE(req)
    expect(res.status).toBe(200)
    expect(deleteNotification).toHaveBeenCalledWith(expect.anything(), nid)
  })
})
