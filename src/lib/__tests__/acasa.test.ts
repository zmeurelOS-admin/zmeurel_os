import { describe, expect, it } from 'vitest'

import {
  amanaIntrebarea,
  buildAcasaExtrasezon,
  buildAcasaSezon,
  endOfWeekIso,
  lucrariPlanificate,
  meteoScurt,
  resolvePerioada,
  sezonPeScurt,
} from '@/lib/dashboard/acasa'
import { FARM_SETTINGS_REZERVA, type FarmSettings } from '@/lib/farm-settings'
import type { ActivitateAgricola } from '@/lib/supabase/queries/activitati-agricole'
import type { Comanda } from '@/lib/supabase/queries/comenzi'
import type { Recoltare } from '@/lib/supabase/queries/recoltari'
import type { Vanzare } from '@/lib/supabase/queries/vanzari'
import type { VanzareButasi } from '@/lib/supabase/queries/vanzari-butasi'
import { isVanzareIncasata, restDeIncasat, vanzarePrimit, vanzareRest, venitIncasat } from '@/lib/vanzari/incasari'

const recoltare = (data: string, kg = 10): Recoltare =>
  ({ id: `r-${data}`, data, kg_cal1: kg, kg_cal2: 0, culegator_id: 'w', parcela_id: 'p' }) as unknown as Recoltare

const vanzare = (overrides: Partial<Vanzare>): Vanzare =>
  ({
    id: 'v',
    data: '2026-07-10',
    data_incasare: null,
    cantitate_kg: 4,
    pret_lei_kg: 30,
    status_plata: 'neplatit',
    ...overrides,
  }) as unknown as Vanzare

const cuSetari = (overrides: Partial<FarmSettings> = {}): FarmSettings => ({
  ...FARM_SETTINGS_REZERVA,
  acasaConfigurabil: true,
  ...overrides,
})

describe('Acasă — perioada, fără setări în bază (migrarea nerulată)', () => {
  it('sezon dacă s-a recoltat anul acesta și e înainte de 1 noiembrie', () => {
    expect(resolvePerioada(FARM_SETTINGS_REZERVA, '2026-07-15', [recoltare('2026-06-20')])).toMatchObject({
      perioada: 'sezon',
      intreaba: false,
    })
  })

  it('extrasezon de la 1 noiembrie sau fără nicio recoltare în an', () => {
    expect(resolvePerioada(FARM_SETTINGS_REZERVA, '2026-11-19', [recoltare('2026-10-20')]).perioada).toBe('extrasezon')
    expect(resolvePerioada(FARM_SETTINGS_REZERVA, '2026-04-10', [recoltare('2025-09-20')]).perioada).toBe('extrasezon')
  })
})

describe('Acasă — perioada, cu setări', () => {
  it('sezonul începe singur la prima recoltare din an', () => {
    const settings = cuSetari({ extrasezonInceputLa: '2025-11-02' })
    expect(resolvePerioada(settings, '2026-05-30', []).perioada).toBe('extrasezon')
    expect(resolvePerioada(settings, '2026-06-01', [recoltare('2026-06-01')]).perioada).toBe('sezon')
  })

  it('extrasezonul NU pornește singur: din 25 octombrie doar întreabă', () => {
    const settings = cuSetari()
    const recoltari = [recoltare('2026-10-21')]
    expect(resolvePerioada(settings, '2026-10-24', recoltari)).toMatchObject({ perioada: 'sezon', intreaba: false })
    expect(resolvePerioada(settings, '2026-10-25', recoltari)).toMatchObject({
      perioada: 'sezon',
      intreaba: true,
      ultimaRecoltare: '2026-10-21',
    })
    // Fără răspuns, rămâne sezon și în decembrie.
    expect(resolvePerioada(settings, '2026-12-10', recoltari).perioada).toBe('sezon')
  })

  it('„Mai am de cules” amână întrebarea 7 zile', () => {
    expect(amanaIntrebarea('2026-10-25')).toBe('2026-11-01')
    const settings = cuSetari({ extrasezonAmanatPana: '2026-11-01' })
    const recoltari = [recoltare('2026-10-21')]
    expect(resolvePerioada(settings, '2026-10-28', recoltari).intreaba).toBe(false)
    expect(resolvePerioada(settings, '2026-11-01', recoltari).intreaba).toBe(false)
    expect(resolvePerioada(settings, '2026-11-02', recoltari).intreaba).toBe(true)
  })

  it('„Da, începem” trece pe extrasezon până la prima recoltare de după', () => {
    const settings = cuSetari({ extrasezonInceputLa: '2026-10-26' })
    expect(resolvePerioada(settings, '2026-10-27', [recoltare('2026-10-21')])).toMatchObject({
      perioada: 'extrasezon',
      intreaba: false,
    })
    // O recoltare notată după confirmare readuce sezonul.
    expect(resolvePerioada(settings, '2026-10-28', [recoltare('2026-10-21'), recoltare('2026-10-28')]).perioada).toBe('sezon')
  })

  it('perioada forțată din Setări nu întreabă nimic', () => {
    const recoltari = [recoltare('2026-10-21')]
    expect(resolvePerioada(cuSetari({ acasaPerioadaMod: 'extrasezon' }), '2026-07-01', recoltari)).toMatchObject({
      perioada: 'extrasezon',
      intreaba: false,
    })
    expect(resolvePerioada(cuSetari({ acasaPerioadaMod: 'sezon' }), '2026-12-01', recoltari)).toMatchObject({
      perioada: 'sezon',
      intreaba: false,
    })
  })

  it('data întrebării se poate schimba', () => {
    const settings = cuSetari({ extrasezonIntrebareDin: '11-10' })
    expect(resolvePerioada(settings, '2026-11-05', [recoltare('2026-10-21')]).intreaba).toBe(false)
    expect(resolvePerioada(settings, '2026-11-10', [recoltare('2026-10-21')]).intreaba).toBe(true)
  })
})

describe('Acasă — cardurile', () => {
  const comanda = (overrides: Partial<Comanda>): Comanda =>
    ({
      id: 'c',
      status: 'confirmata',
      data_livrare: '2026-07-15',
      cantitate_kg: 5,
      total: 175,
      created_at: '2026-07-14T10:00:00Z',
      prioritara: false,
      ...overrides,
    }) as unknown as Comanda

  it('sezon: de livrat azi, prioritare și cât lipsește din stoc', () => {
    const sezon = buildAcasaSezon({
      todayIso: '2026-07-15',
      comenzi: [
        comanda({ id: 'a', cantitate_kg: 10 }),
        comanda({ id: 'b', cantitate_kg: 6, prioritara: true }),
        comanda({ id: 'c', cantitate_kg: 4, status: 'in_livrare' }),
        comanda({ id: 'd', data_livrare: '2026-07-16' }),
      ],
      recoltari: [recoltare('2026-07-15', 12.5), recoltare('2026-07-14', 30)],
      stocDisponibilKg: 9,
      parcelStates: [],
    })
    expect(sezon).toMatchObject({
      deLivratKg: 20,
      deLivratCount: 3,
      prioritareCount: 1,
      stocKg: 9,
      // 16 kg nepuse încă în livrare, 9 în stoc.
      lipsaKg: 7,
      inLivrareCount: 1,
      dePusInLivrareCount: 2,
      recoltatAziKg: 12.5,
    })
  })

  it('sezon: fără stoc încărcat nu inventează o lipsă', () => {
    const sezon = buildAcasaSezon({
      todayIso: '2026-07-15',
      comenzi: [comanda({})],
      recoltari: [],
      stocDisponibilKg: null,
      parcelStates: [],
    })
    expect(sezon.stocKg).toBeNull()
    expect(sezon.lipsaKg).toBe(0)
  })

  it('extrasezon: butașii săptămânii, pe soiuri, și restul de încasat', () => {
    const butasi = (overrides: Partial<VanzareButasi>): VanzareButasi =>
      ({ id: 'b', status: 'confirmata', data_livrare_estimata: '2026-11-20', items: [], cantitate_butasi: 0, ...overrides }) as unknown as VanzareButasi

    const extrasezon = buildAcasaExtrasezon({
      todayIso: '2026-11-19', // joi; săptămâna se termină duminică, 22
      vanzariButasi: [
        butasi({ id: '1', data_livrare_estimata: '2026-11-21', items: [{ soi: 'Delniwa', cantitate: 300 }, { soi: 'Maravilla', cantitate: 50 }] as never }),
        butasi({ id: '2', data_livrare_estimata: '2026-11-20', cantitate_butasi: 100, soi_butasi: 'Maravilla' }),
        butasi({ id: '3', data_livrare_estimata: '2026-11-30', cantitate_butasi: 40, soi_butasi: 'Delniwa' }),
        butasi({ id: '4', status: 'livrata', cantitate_butasi: 999 }),
      ],
      vanzari: [vanzare({ id: 'x' }), vanzare({ id: 'y', status_plata: 'platit' })],
      activitati: [],
    })
    expect(extrasezon).toMatchObject({
      butasiSaptamanaBuc: 450,
      butasiSaptamanaCount: 2,
      butasiPrimaData: '2026-11-20',
      butasiDeschiseCount: 3,
      restLei: 120,
      restCount: 1,
    })
    expect(extrasezon.butasiPeSoiuri).toEqual([
      { soi: 'Delniwa', buc: 340 },
      { soi: 'Maravilla', buc: 150 },
    ])
    expect(endOfWeekIso('2026-11-22')).toBe('2026-11-22')
    expect(endOfWeekIso('2026-11-23')).toBe('2026-11-29')
  })

  it('lucrările planificate sunt activitățile cu dată în viitor, cele mai apropiate întâi', () => {
    const activitate = (id: string, data: string, tip: string | null = 'Tăieri'): ActivitateAgricola =>
      ({ id, data_aplicare: data, tip_activitate: tip, produs_utilizat: null }) as unknown as ActivitateAgricola
    expect(
      lucrariPlanificate([activitate('a', '2026-12-05'), activitate('b', '2026-11-19'), activitate('c', '2026-11-25', null)], '2026-11-19'),
    ).toEqual([
      { id: 'c', data: '2026-11-25', titlu: 'Lucrare planificată' },
      { id: 'a', data: '2026-12-05', titlu: 'Tăieri' },
    ])
  })

  it('sezonul pe scurt: recoltat și încasat de la 1 ianuarie', () => {
    expect(
      sezonPeScurt(
        '2026-11-19',
        [recoltare('2026-07-01', 100), recoltare('2025-07-01', 500)],
        [
          vanzare({ status_plata: 'platit', data_incasare: '2026-07-12' }),
          vanzare({ status_plata: 'platit', data_incasare: '2025-07-12' }),
          vanzare({ status_plata: 'neplatit' }),
        ],
      ),
    ).toEqual({ an: 2026, recoltatKg: 100, incasatLei: 120 })
  })

  it('vremea, pe scurt, după perioadă', () => {
    const meteo = { current: { temp: 12.4, windSpeed: 2 }, forecastTomorrow: { tempMin: -2, pop: 0.7 } }
    expect(meteoScurt(meteo, 'sezon')).toMatchObject({ temp: 12.4, nota: 'ploaie mâine (70%)', tone: 'warning' })
    expect(meteoScurt(meteo, 'extrasezon')).toMatchObject({ nota: 'îngheț mâine (-2°)', tone: 'warning' })
    expect(meteoScurt({ current: { temp: 20, windSpeed: 8 }, forecastTomorrow: { tempMin: 10, pop: 0.1 } }, 'sezon').nota).toBe('vânt 29 km/h')
    expect(meteoScurt(null, 'sezon')).toEqual({ temp: null, nota: null, tone: 'neutral' })
  })
})

describe('încasări', () => {
  it('„neplatit” și „neincasat” nu sunt luate drept încasate', () => {
    expect(isVanzareIncasata('platit')).toBe(true)
    expect(isVanzareIncasata('Platit')).toBe(true)
    expect(isVanzareIncasata('Încasat')).toBe(true)
    expect(isVanzareIncasata('neplatit')).toBe(false)
    expect(isVanzareIncasata('Neîncasat')).toBe(false)
    expect(isVanzareIncasata('restanta')).toBe(false)
    expect(isVanzareIncasata(null)).toBe(false)
  })

  it('plata parțială se vede la rest, dar nu e venit până la încasarea restului', () => {
    const partial = vanzare({ suma_incasata_partial_lei: 50 })
    expect(vanzarePrimit(partial)).toBe(50)
    expect(vanzareRest(partial)).toBe(70)
    expect(restDeIncasat([partial, vanzare({ status_plata: 'platit' })])).toEqual({ lei: 70, count: 1 })
    expect(venitIncasat([partial], '2026-01-01', '2026-12-31')).toBe(0)

    // La încasarea restului, toată suma intră la data încasării.
    const paid = vanzare({ suma_incasata_partial_lei: 50, status_plata: 'platit', data_incasare: '2026-08-03' })
    expect(vanzareRest(paid)).toBe(0)
    expect(venitIncasat([paid], '2026-08-01', '2026-08-31')).toBe(120)
    expect(venitIncasat([paid], '2026-07-01', '2026-07-31')).toBe(0)
  })

  it('o sumă parțială mai mare decât totalul nu dă rest negativ', () => {
    expect(vanzareRest(vanzare({ suma_incasata_partial_lei: 500 }))).toBe(0)
  })
})
