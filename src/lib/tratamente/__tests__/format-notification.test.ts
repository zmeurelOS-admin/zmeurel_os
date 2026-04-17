import { formatNotificationPayload } from '@/lib/tratamente/scheduler'
import type { AplicarePlanificataNotif } from '@/lib/tratamente/scheduler'

const makeAplicare = (
  overrides: Partial<AplicarePlanificataNotif> = {}
): AplicarePlanificataNotif => ({
  aplicareId: overrides.aplicareId ?? 'a1',
  parcelaId: overrides.parcelaId ?? 'p1',
  parcelaNume: overrides.parcelaNume ?? 'Parcela Sud',
  produsNume: overrides.produsNume ?? 'Signum',
  dataPlanificata: overrides.dataPlanificata ?? '2026-04-16',
  zileRamase: overrides.zileRamase ?? 0,
  doza: overrides.doza ?? '500 ml/hl',
})

describe('format-notification', () => {
  it('formatează corect o notificare pentru azi cu o singură aplicare', () => {
    const payload = formatNotificationPayload([makeAplicare()], [])

    expect(payload).toEqual({
      title: 'Aplicare programată azi',
      body: 'Signum pe Parcela Sud. 500 ml/hl',
    })
  })

  it('formatează corect o notificare pentru azi cu trei aplicări', () => {
    const payload = formatNotificationPayload(
      [
        makeAplicare({ aplicareId: 'a1', parcelaNume: 'Parcela Sud' }),
        makeAplicare({ aplicareId: 'a2', parcelaNume: 'Parcela Nord' }),
        makeAplicare({ aplicareId: 'a3', parcelaNume: 'Parcela Vest' }),
      ],
      []
    )

    expect(payload?.title).toBe('3 aplicări programate azi')
    expect(payload?.body).toContain('Parcela Sud, Parcela Nord, Parcela Vest')
  })

  it('formatează corect o notificare pentru mâine cu o singură aplicare', () => {
    const payload = formatNotificationPayload([], [makeAplicare({ zileRamase: 1 })])

    expect(payload).toEqual({
      title: 'Aplicare programată mâine',
      body: 'Signum pe Parcela Sud. 500 ml/hl',
    })
  })

  it('combină corect aplicările de azi și mâine', () => {
    const payload = formatNotificationPayload(
      [makeAplicare({ aplicareId: 'a1' }), makeAplicare({ aplicareId: 'a2', parcelaNume: 'Parcela Nord' })],
      [makeAplicare({ aplicareId: 'a3', zileRamase: 1 })]
    )

    expect(payload?.title).toBe('Aplicări programate: 2 azi, 1 mâine')
    expect(payload?.body).toContain('Azi:')
    expect(payload?.body).toContain('Mâine:')
  })

  it('returnează null când nu există aplicări nici azi, nici mâine', () => {
    expect(formatNotificationPayload([], [])).toBeNull()
  })

  it('listează maximum 3 parcele în body', () => {
    const payload = formatNotificationPayload(
      [
        makeAplicare({ aplicareId: 'a1', parcelaNume: 'P1' }),
        makeAplicare({ aplicareId: 'a2', parcelaNume: 'P2' }),
        makeAplicare({ aplicareId: 'a3', parcelaNume: 'P3' }),
        makeAplicare({ aplicareId: 'a4', parcelaNume: 'P4' }),
      ],
      []
    )

    expect(payload?.body).toContain('P1, P2, P3')
    expect(payload?.body).not.toContain('P4')
  })
})

