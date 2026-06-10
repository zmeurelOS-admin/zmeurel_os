import { beforeEach, describe, expect, it, vi } from 'vitest'

import { PATCH } from '@/app/api/shop/b2c/orders/[id]/route'
import { createSameOriginRequest } from '@/test/helpers/api-origin-request'

const {
  getSupabaseAdminMock,
  getTenantIdByUserIdMock,
  getUserMock,
  rpcMock,
  updateEqMock,
  updateSelectMock,
} = vi.hoisted(() => ({
  getSupabaseAdminMock: vi.fn(),
  getTenantIdByUserIdMock: vi.fn(),
  getUserMock: vi.fn(),
  rpcMock: vi.fn(),
  updateEqMock: vi.fn(),
  updateSelectMock: vi.fn(),
}))

vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({
    auth: {
      getUser: getUserMock,
    },
    rpc: rpcMock,
  }),
}))

vi.mock('@/lib/supabase/admin', () => ({
  getSupabaseAdmin: getSupabaseAdminMock,
}))

vi.mock('@/lib/tenant/get-tenant', () => ({
  getTenantIdByUserId: getTenantIdByUserIdMock,
}))

const orderId = '00000000-0000-4000-8000-000000000101'
const tenantId = '00000000-0000-4000-8000-000000000301'

function deliverRequest() {
  return PATCH(
    createSameOriginRequest(`/api/shop/b2c/orders/${orderId}`, {
      method: 'PATCH',
      json: { status: 'livrata' },
    }),
    { params: Promise.resolve({ id: orderId }) },
  )
}

function patchRequest(body: { status?: string; notified_wa?: boolean }) {
  return PATCH(
    createSameOriginRequest(`/api/shop/b2c/orders/${orderId}`, {
      method: 'PATCH',
      json: body,
    }),
    { params: Promise.resolve({ id: orderId }) },
  )
}

describe('PATCH /api/shop/b2c/orders/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getUserMock.mockResolvedValue({
      data: { user: { id: '00000000-0000-4000-8000-000000000001' } },
    })
    rpcMock.mockResolvedValue({
      data: {
        already_delivered: false,
        shop_order_id: orderId,
        total_kg: 1,
        total_lei: 30,
      },
      error: null,
    })
    getTenantIdByUserIdMock.mockResolvedValue(tenantId)
    updateSelectMock.mockResolvedValue({
      data: [{ id: orderId }],
      error: null,
    })
    updateEqMock.mockImplementation(() => ({
      eq: updateEqMock,
      select: updateSelectMock,
    }))
    getSupabaseAdminMock.mockReturnValue({
      from: vi.fn().mockReturnValue({
        update: vi.fn().mockReturnValue({
          eq: updateEqMock,
        }),
      }),
    })
  })

  it('marchează livrarea prin bridge-ul ERP atomic cu plata achitată', async () => {
    const response = await deliverRequest()

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toMatchObject({
      success: true,
      delivery: {
        already_delivered: false,
        shop_order_id: orderId,
      },
    })
    expect(rpcMock).toHaveBeenCalledWith('deliver_shop_order_atomic', {
      p_shop_order_id: orderId,
      p_payment_status: 'platit',
    })
  })

  it('tratează retry-ul idempotent ca succes fără alt flux în endpoint', async () => {
    rpcMock.mockResolvedValue({
      data: {
        already_delivered: true,
        shop_order_id: orderId,
        comanda_id: '00000000-0000-4000-8000-000000000201',
      },
      error: null,
    })

    const response = await deliverRequest()

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toMatchObject({
      success: true,
      delivery: { already_delivered: true },
    })
    expect(rpcMock).toHaveBeenCalledTimes(1)
  })

  it('propagă eroarea exactă atunci când stocul este insuficient', async () => {
    rpcMock.mockResolvedValue({
      data: null,
      error: { message: 'Stoc insuficient pentru livrare.' },
    })

    const response = await deliverRequest()

    expect(response.status).toBe(409)
    await expect(response.json()).resolves.toEqual({
      success: false,
      error: 'Stoc insuficient pentru livrare.',
    })
  })

  it('propagă eroarea exactă atunci când lipsește greutatea produsului', async () => {
    rpcMock.mockResolvedValue({
      data: null,
      error: { message: 'Produsul Zmeură — Caserolă 500 g nu are greutate configurată.' },
    })

    const response = await deliverRequest()

    expect(response.status).toBe(409)
    await expect(response.json()).resolves.toEqual({
      success: false,
      error: 'Produsul Zmeură — Caserolă 500 g nu are greutate configurată.',
    })
  })

  it('filtrează update-ul generic după id și tenantul sesiunii', async () => {
    const response = await patchRequest({ status: 'confirmata' })

    expect(response.status).toBe(200)
    expect(getTenantIdByUserIdMock).toHaveBeenCalledWith(
      expect.any(Object),
      '00000000-0000-4000-8000-000000000001',
    )
    expect(updateEqMock).toHaveBeenNthCalledWith(1, 'id', orderId)
    expect(updateEqMock).toHaveBeenNthCalledWith(2, 'tenant_id', tenantId)
    expect(updateSelectMock).toHaveBeenCalledWith('id')
  })

  it('întoarce 404 când id-ul nu aparține tenantului autentificat', async () => {
    updateSelectMock.mockResolvedValue({
      data: [],
      error: null,
    })

    const response = await patchRequest({ notified_wa: true })

    expect(response.status).toBe(404)
    await expect(response.json()).resolves.toEqual({
      success: false,
      error: 'Comanda nu a fost găsită.',
    })
  })

  it('nu folosește clientul admin dacă tenantul sesiunii lipsește', async () => {
    getTenantIdByUserIdMock.mockRejectedValue(
      new Error('Tenant indisponibil pentru utilizatorul curent.'),
    )
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined)

    const response = await patchRequest({ status: 'anulata' })

    expect(response.status).toBe(403)
    expect(getSupabaseAdminMock).not.toHaveBeenCalled()
    errorSpy.mockRestore()
  })
})
