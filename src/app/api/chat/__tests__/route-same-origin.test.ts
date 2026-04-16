import { beforeEach, describe, expect, it, vi } from 'vitest'

import { createSameOriginRequest } from '@/test/helpers/api-origin-request'

const mocks = vi.hoisted(() => ({
  createChatPostHandler: vi.fn(),
  chatPostHandler: vi.fn(),
}))

vi.mock('@/app/api/chat/chat-post-handler', () => ({
  createChatPostHandler: mocks.createChatPostHandler,
}))

async function loadRouteModule() {
  vi.resetModules()
  mocks.chatPostHandler.mockReset()
  mocks.chatPostHandler.mockResolvedValue(Response.json({ ok: true }))
  mocks.createChatPostHandler.mockReset()
  mocks.createChatPostHandler.mockReturnValue(mocks.chatPostHandler)
  return import('@/app/api/chat/route')
}

describe('POST /api/chat same-origin guard', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('acceptă request legitim same-origin', async () => {
    const { POST } = await loadRouteModule()
    const req = createSameOriginRequest('/api/chat', {
      method: 'POST',
      json: {
        message: 'Salut',
        pathname: '/dashboard',
      },
    })

    const res = await POST(req)

    expect(res.status).toBe(200)
    expect(mocks.chatPostHandler).toHaveBeenCalledTimes(1)
  })

  it('respinge request fără Origin/Referer când lipsesc condițiile fallback', async () => {
    const { POST } = await loadRouteModule()
    const req = new Request('http://localhost:3000/api/chat', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        message: 'Salut',
        pathname: '/dashboard',
      }),
    })

    const res = await POST(req)
    const payload = (await res.json()) as {
      ok: boolean
      error?: {
        code?: string
      }
    }

    expect(res.status).toBe(403)
    expect(payload.ok).toBe(false)
    expect(payload.error?.code).toBe('MISSING_ORIGIN')
    expect(mocks.chatPostHandler).not.toHaveBeenCalled()
  })

  it('acceptă fallback legitim cu sec-fetch-site=same-origin', async () => {
    const { POST } = await loadRouteModule()
    const req = new Request('http://localhost:3000/api/chat', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'sec-fetch-site': 'same-origin',
      },
      body: JSON.stringify({
        message: 'Salut',
        pathname: '/dashboard',
      }),
    })

    const res = await POST(req)

    expect(res.status).toBe(200)
    expect(mocks.chatPostHandler).toHaveBeenCalledTimes(1)
  })

  it('respinge request cross-origin', async () => {
    const { POST } = await loadRouteModule()
    const req = new Request('http://localhost:3000/api/chat', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        origin: 'https://evil.example',
      },
      body: JSON.stringify({
        message: 'Salut',
        pathname: '/dashboard',
      }),
    })

    const res = await POST(req)
    const payload = (await res.json()) as {
      ok: boolean
      error?: {
        code?: string
      }
    }

    expect(res.status).toBe(403)
    expect(payload.ok).toBe(false)
    expect(payload.error?.code).toBe('INVALID_ORIGIN')
    expect(mocks.chatPostHandler).not.toHaveBeenCalled()
  })
})
