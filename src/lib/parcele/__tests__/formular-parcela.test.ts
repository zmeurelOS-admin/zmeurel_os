import { describe, expect, it } from 'vitest'

import { culturaSoi, liniaParcelei } from '@/lib/parcele/card'
import { draftDinParcela, draftParcelaNoua, eroriParcela, implicitePentruScop, numarRo, payloadParcela } from '@/lib/parcele/formular-parcela'
import type { Parcela } from '@/lib/supabase/queries/parcele'

const BLOC = '[zmeurel:parcel-crops][{"id":"a","culture":"Zmeură","variety":"Maravilla","plantCount":500}][/zmeurel:parcel-crops]'

const parcela = {
  id: 'p1',
  nume_parcela: 'Maravilla 1',
  tip_unitate: 'camp',
  cultura: 'Zmeură',
  soi: 'Maravilla',
  soi_plantat: 'Zmeură - Maravilla',
  tip_fruct: 'Zmeură',
  nr_plante: 500,
  suprafata_m2: 700,
  an_plantare: 2024,
  rol: 'personal',
  status: 'Activ',
  status_operational: 'activ',
  apare_in_dashboard: false,
  contribuie_la_productie: false,
  observatii: `Lângă drum\n\n${BLOC}`,
  volum_solutie_l: 60,
} as unknown as Parcela & { volum_solutie_l: number }

describe('formularul de parcelă', () => {
  it('numerele scrise în română', () => {
    expect(numarRo('1.200,5')).toBe(1200.5)
    expect(numarRo('700')).toBe(700)
    expect(numarRo('60,5')).toBe(60.5)
    expect(numarRo('')).toBeNull()
    expect(Number.isNaN(numarRo('abc'))).toBe(true)
  })

  it('ciorna din parcelă: notele fără blocurile ascunse, volumul, „Personal”', () => {
    const draft = draftDinParcela(parcela, 2026)
    expect(draft.observatii).toBe('Lângă drum')
    expect(draft.volum).toBe('60')
    expect(draft.rol).toBe('personal')
    expect(draft.cultura).toBe('Zmeură')
    expect(draft.soi).toBe('Maravilla')
  })

  it('validarea', () => {
    expect(eroriParcela(draftParcelaNoua(2026))).toEqual({ nume: 'Scrie numele parcelei.', suprafata: 'Scrie suprafața în m².' })
    const bun = { ...draftParcelaNoua(2026), nume: 'Nouă', suprafata: '560', plante: '400', volum: '50' }
    expect(eroriParcela(bun)).toEqual({})
    expect(eroriParcela({ ...bun, plante: '4,5' }).plante).toBeTruthy()
    expect(eroriParcela({ ...bun, volum: '0' }).volum).toBeTruthy()
  })

  it('la salvare: blocurile ascunse rămân, volumul doar cu migrarea', () => {
    const draft = { ...draftDinParcela(parcela, 2026), observatii: 'Lângă drum, la vale' }
    const cu = payloadParcela(draft, { cuVolum: true, observatiiVechi: parcela.observatii })
    expect(cu.observatii).toContain('Lângă drum, la vale')
    expect(cu.observatii).toContain('[zmeurel:parcel-crops]')
    expect(cu.volum_solutie_l).toBe(60)
    expect(cu.soi_plantat).toBe('Zmeură - Maravilla')
    expect(payloadParcela(draft, { cuVolum: false })).not.toHaveProperty('volum_solutie_l')
  })

  it('solarul nu ține cultura și plantele pe parcelă', () => {
    const payload = payloadParcela({ ...draftParcelaNoua(2026), nume: 'Solar', tip: 'solar', cultura: 'Roșii', plante: '40', suprafata: '84' }, { cuVolum: false })
    expect(payload.cultura).toBeNull()
    expect(payload.nr_plante).toBeNull()
    expect(payload.suprafata_m2).toBe(84)
  })

  it('scopul schimbă implicitele de dashboard', () => {
    expect(implicitePentruScop('comercial')).toEqual({ apareInDashboard: true, contribuieLaProductie: true })
    expect(implicitePentruScop('personal')).toEqual({ apareInDashboard: false, contribuieLaProductie: false })
  })
})


describe('cardul parcelei', () => {
  it('cultura + soiul, fără repetiție; plante și suprafață', () => {
    expect(liniaParcelei({ cultura: 'Zmeură', soi: 'Maravilla', nr_plante: 500, suprafata_m2: 700 })).toBe('Zmeură Maravilla · 500 plante · 700 m²')
    expect(culturaSoi({ cultura: 'Mur', soi: 'Mure' })).toBe('Mur')
    expect(liniaParcelei({ tip_unitate: 'solar', suprafata_m2: 84 })).toBe('84 m²')
    expect(liniaParcelei({ tip_unitate: 'solar' })).toBe('Solar')
  })
})
