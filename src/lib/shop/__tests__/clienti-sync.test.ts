import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  buildClientAddressFromShopOrder,
  upsertClientFromShopOrder,
} from '@/lib/shop/clienti-sync'

const {
  eqMock,
  getSupabaseAdminMock,
  maybeSingleMock,
  selectMock,
  updateEqMock,
  updateMock,
  upsertMock,
  upsertSelectMock,
} = vi.hoisted(() => ({
  eqMock: vi.fn(),
  getSupabaseAdminMock: vi.fn(),
  maybeSingleMock: vi.fn(),
  selectMock: vi.fn(),
  updateEqMock: vi.fn(),
  updateMock: vi.fn(),
  upsertMock: vi.fn(),
  upsertSelectMock: vi.fn(),
}))

vi.mock('@/lib/supabase/admin', () => ({
  getSupabaseAdmin: getSupabaseAdminMock,
}))

describe('upsertClientFromShopOrder', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    eqMock.mockImplementation((column: string) => {
      if (column === 'tenant_id') {
        return { eq: eqMock, maybeSingle: maybeSingleMock }
      }
      if (column === 'id') {
        return { eq: updateEqMock }
      }
      return { maybeSingle: maybeSingleMock }
    })

    selectMock.mockReturnValue({
      eq: eqMock,
    })

    updateEqMock.mockImplementation((column: string) => {
      if (column === 'id') {
        return { eq: updateEqMock }
      }
      return Promise.resolve({ error: null })
    })
    updateMock.mockReturnValue({
      eq: updateEqMock,
    })

    upsertSelectMock.mockResolvedValue({
      data: [{ id: 'client-1' }],
      error: null,
    })
    upsertMock.mockReturnValue({
      select: upsertSelectMock,
    })

    getSupabaseAdminMock.mockReturnValue({
      from: vi.fn().mockReturnValue({
        select: selectMock,
        update: updateMock,
        upsert: upsertMock,
      }),
    })
  })

  it('construiește adresa din adresă + oraș', () => {
    expect(
      buildClientAddressFromShopOrder({
        deliveryAddress: 'Str. Eminescu 19B',
        deliveryCity: 'Suceava',
      }),
    ).toBe('Str. Eminescu 19B, Suceava')
    expect(
      buildClientAddressFromShopOrder({
        deliveryAddress: '',
        deliveryCity: 'Suceava',
      }),
    ).toBe('Suceava')
  })

  it('inserează client nou cu telefon normalizat și data_origin=shop', async () => {
    await upsertClientFromShopOrder({
      tenantId: 'tenant-1',
      phone: '0722 123 456',
      name: 'Ion Popescu',
      deliveryAddress: 'Str. Eminescu 19B',
      deliveryCity: 'Suceava',
    })

    expect(upsertMock).toHaveBeenCalledWith(
      expect.objectContaining({
        tenant_id: 'tenant-1',
        id_client: expect.stringMatching(/^SHOP-/),
        nume_client: 'Ion Popescu',
        telefon: '+40722123456',
        adresa: 'Str. Eminescu 19B, Suceava',
        data_origin: 'shop',
      }),
      {
        onConflict: 'tenant_id,telefon',
        ignoreDuplicates: true,
      },
    )
    expect(selectMock).not.toHaveBeenCalled()
    expect(updateMock).not.toHaveBeenCalled()
  })

  it('actualizează doar adresa când clientul existent are nume real și adresă goală', async () => {
    upsertSelectMock.mockResolvedValue({
      data: [],
      error: null,
    })
    maybeSingleMock.mockResolvedValue({
      data: {
        id: 'client-2',
        nume_client: 'Ion Popescu',
        adresa: '   ',
      },
      error: null,
    })

    await upsertClientFromShopOrder({
      tenantId: 'tenant-1',
      phone: '40722123456',
      name: 'Alt nume',
      deliveryAddress: 'Str. Florilor 10',
      deliveryCity: 'Suceava',
    })

    expect(updateMock).toHaveBeenCalledWith({
      adresa: 'Str. Florilor 10, Suceava',
    })
  })

  it('actualizează numele placeholder și suprascrie adresa la override explicit', async () => {
    upsertSelectMock.mockResolvedValue({
      data: [],
      error: null,
    })
    maybeSingleMock.mockResolvedValue({
      data: {
        id: 'client-3',
        nume_client: 'Client 0722123456',
        adresa: 'Adresa veche',
      },
      error: null,
    })

    await upsertClientFromShopOrder({
      tenantId: 'tenant-1',
      phone: '0722123456',
      name: 'Maria Ionescu',
      deliveryAddress: 'Str. Nouă 5',
      deliveryCity: 'Fălticeni',
      explicitAddressOverride: true,
    })

    expect(updateMock).toHaveBeenCalledWith({
      nume_client: 'Maria Ionescu',
      adresa: 'Str. Nouă 5, Fălticeni',
    })
  })
})
