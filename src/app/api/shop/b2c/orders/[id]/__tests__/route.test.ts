import { beforeEach, describe, expect, it, vi } from 'vitest'

import { PATCH } from '@/app/api/shop/b2c/orders/[id]/route'
import { createSameOriginRequest } from '@/test/helpers/api-origin-request'

const {
  getSupabaseAdminMock,
  getTenantIdByUserIdMock,
  getUserMock,
  rpcMock,
  selectEqMock,
  selectMaybeSingleMock,
  updateMock,
  updateEqMock,
  updateSelectMock,
} = vi.hoisted(() => ({
  getSupabaseAdminMock: vi.fn(),
  getTenantIdByUserIdMock: vi.fn(),
  getUserMock: vi.fn(),
  rpcMock: vi.fn(),
  selectEqMock: vi.fn(),
  selectMaybeSingleMock: vi.fn(),
  updateMock: vi.fn(),
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

function patchRequest(body: {
  status?: string
  notified_wa?: boolean
  delivery_date?: string | null
}) {
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
    selectMaybeSingleMock.mockResolvedValue({
      data: { delivery_date: null },
      error: null,
    })
    selectEqMock.mockImplementation(() => ({
      eq: selectEqMock,
      maybeSingle: selectMaybeSingleMock,
    }))
    updateEqMock.mockImplementation(() => ({
      eq: updateEqMock,
      select: updateSelectMock,
    }))
    updateMock.mockReturnValue({
      eq: updateEqMock,
    })
    getSupabaseAdminMock.mockReturnValue({
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: selectEqMock,
        }),
        update: updateMock,
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

  it('setează data de livrare București când comanda intră în livrare fără dată', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-06-10T12:00:00.000Z'))

    const response = await patchRequest({ status: 'in_livrare' })

    expect(response.status).toBe(200)
    expect(selectEqMock).toHaveBeenNthCalledWith(1, 'id', orderId)
    expect(selectEqMock).toHaveBeenNthCalledWith(2, 'tenant_id', tenantId)
    expect(updateMock).toHaveBeenCalledWith({
      status: 'in_livrare',
      delivery_date: '2026-06-10',
    })

    vi.useRealTimers()
  })

  it('păstrează data de livrare existentă când comanda intră în livrare', async () => {
    selectMaybeSingleMock.mockResolvedValue({
      data: { delivery_date: '2026-06-15' },
      error: null,
    })

    const response = await patchRequest({ status: 'in_livrare' })

    expect(response.status).toBe(200)
    expect(updateMock).toHaveBeenCalledWith({
      status: 'in_livrare',
      delivery_date: '2026-06-15',
    })
  })

  it('actualizează separat data programată fără a schimba statusul', async () => {
    const response = await patchRequest({ delivery_date: '2026-06-18' })

    expect(response.status).toBe(200)
    expect(updateMock).toHaveBeenCalledWith({
      delivery_date: '2026-06-18',
    })
    expect(rpcMock).not.toHaveBeenCalled()
    expect(selectMaybeSingleMock).not.toHaveBeenCalled()
  })

  it('șterge data programată cu null', async () => {
    const response = await patchRequest({ delivery_date: null })

    expect(response.status).toBe(200)
    expect(updateMock).toHaveBeenCalledWith({
      delivery_date: null,
    })
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
