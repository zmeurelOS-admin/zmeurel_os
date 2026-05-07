import { beforeEach, describe, expect, it, vi } from 'vitest'

import { autoSaveProdusInBiblioteca } from '@/lib/tratamente/auto-save-produs-biblioteca'

const {
  listProduseFitosanitareActionMock,
  saveProdusFitosanitarInLibraryActionMock,
  toastSuccessMock,
  toastMessageMock,
} = vi.hoisted(() => ({
  listProduseFitosanitareActionMock: vi.fn(),
  saveProdusFitosanitarInLibraryActionMock: vi.fn(),
  toastSuccessMock: vi.fn(),
  toastMessageMock: vi.fn(),
}))

vi.mock('@/app/(dashboard)/tratamente/produse-fitosanitare/actions', () => ({
  listProduseFitosanitareAction: listProduseFitosanitareActionMock,
  saveProdusFitosanitarInLibraryAction: saveProdusFitosanitarInLibraryActionMock,
}))

vi.mock('@/lib/ui/toast', () => ({
  toast: {
    success: toastSuccessMock,
    message: toastMessageMock,
  },
}))

describe('autoSaveProdusInBiblioteca', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('salvează produsul manual fără match în bibliotecă', async () => {
    listProduseFitosanitareActionMock.mockResolvedValue([])
    saveProdusFitosanitarInLibraryActionMock.mockResolvedValue({
      id: 'produs-nou',
      tenant_id: 'tenant-1',
      nume_comercial: 'Kelpak',
      substanta_activa: '',
      tip: 'bioregulator',
      frac_irac: null,
      doza_min_ml_per_hl: null,
      doza_max_ml_per_hl: null,
      doza_min_l_per_ha: null,
      doza_max_l_per_ha: null,
      phi_zile: null,
      nr_max_aplicari_per_sezon: null,
      interval_min_aplicari_zile: null,
      omologat_culturi: null,
      activ: true,
      created_at: '2026-01-01T00:00:00.000Z',
      updated_at: '2026-01-01T00:00:00.000Z',
      created_by: null,
    })

    await autoSaveProdusInBiblioteca(
      [
        {
          produs_id: null,
          produs_nume_manual: 'Kelpak',
          tip_snapshot: 'biostimulator',
          substanta_activa_snapshot: null,
        },
      ],
      'tenant-1'
    )

    expect(saveProdusFitosanitarInLibraryActionMock).toHaveBeenCalledTimes(1)
    expect(saveProdusFitosanitarInLibraryActionMock).toHaveBeenCalledWith(
      expect.objectContaining({
        nume_comercial: 'Kelpak',
        tip: 'bioregulator',
        substanta_activa: '',
      })
    )
    expect(toastSuccessMock).toHaveBeenCalledWith('Kelpak adăugat în biblioteca ta de produse.')
  })

  it('ignoră conflictul UNIQUE fără să arunce eroare', async () => {
    listProduseFitosanitareActionMock.mockResolvedValue([])
    saveProdusFitosanitarInLibraryActionMock.mockRejectedValue(
      new Error('duplicate key value violates unique constraint (23505)')
    )

    await expect(
      autoSaveProdusInBiblioteca(
        [
          {
            produs_id: null,
            produs_nume_manual: 'Mospilan',
            tip_snapshot: 'fungicid',
            substanta_activa_snapshot: 'acetamiprid',
          },
        ],
        'tenant-1'
      )
    ).resolves.toBeUndefined()

    expect(saveProdusFitosanitarInLibraryActionMock).toHaveBeenCalledTimes(1)
    expect(toastSuccessMock).not.toHaveBeenCalled()
  })
})
