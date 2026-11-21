import { describe, expect, it } from 'vitest'

import { ACASA_EXTRASEZON_TOATE, mapFarmSettings } from '@/lib/farm-settings'
import {
  capitalizeRo,
  daysBetween,
  formatKg,
  formatLei,
  formatLeiKg,
  initialsOf,
  relativeDayRo,
  searchKey,
  shiftIso,
} from '@/lib/format-ro'
import { PRET_STANDARD_REZERVA, pretPentruClient, resolvePretStandard } from '@/lib/pret-standard'
import { isMissingColumnError, NO_SCHEMA_FEATURES, probeSchemaFeatures } from '@/lib/schema-features'

function fakeClient(missing: ReadonlySet<string>, failing: ReadonlySet<string> = new Set()) {
  const calls: string[] = []
  return {
    calls,
    client: {
      from: (table: string) => ({
        select: (column: string) => ({
          limit: async () => {
            calls.push(`${table}.${column}`)
            if (failing.has(table)) return { error: { code: 'PGRST301', message: 'JWT expired' } }
            if (missing.has(`${table}.${column}`)) {
              return { error: { code: '42703', message: `column ${table}.${column} does not exist` } }
            }
            return { error: null }
          },
        }),
      }),
    },
  }
}

describe('schema-features', () => {
  it('recunoaște o coloană lipsă după codul erorii', () => {
    expect(isMissingColumnError({ code: '42703' })).toBe(true)
    expect(isMissingColumnError({ code: 'PGRST204' })).toBe(true)
    expect(isMissingColumnError({ message: 'column comenzi.prioritara does not exist' })).toBe(true)
    expect(isMissingColumnError({ code: 'PGRST301', message: 'JWT expired' })).toBe(false)
    expect(isMissingColumnError(null)).toBe(false)
  })

  it('înainte de migrare: nimic nu există', async () => {
    const { client } = fakeClient(
      new Set([
        'comenzi.prioritara',
        'clienti.locatie_salvata_la',
        'vanzari.suma_incasata_partial_lei',
        'tenant_settings.pret_standard_perioada',
        'tenant_settings.acasa_perioada_mod',
        'comenzi.client_sync_id',
        'aplicari_tratament.lot_id',
        'activitati_agricole.status',
      ]),
    )
    await expect(probeSchemaFeatures(client)).resolves.toEqual(NO_SCHEMA_FEATURES)
  })

  it('după migrare: totul există, cu câte o singură citire pe grup', async () => {
    const { client, calls } = fakeClient(new Set())
    await expect(probeSchemaFeatures(client)).resolves.toEqual({
      comenziPrioritara: true,
      clientiLocatie: true,
      vanzariPlataPartiala: true,
      pretStandard: true,
      acasaPerioada: true,
      cheiIdempotenta: true,
      tratamenteLot: true,
      lucrariPlanificate: true,
    })
    expect(calls).toHaveLength(8)
  })

  it('o altă eroare nu e luată drept „lipsește”: verificarea se reia', async () => {
    const { client } = fakeClient(new Set(), new Set(['comenzi']))
    await expect(probeSchemaFeatures(client)).rejects.toThrow('JWT expired')
  })
})

describe('farm-settings', () => {
  const has = { pretStandard: true, acasaPerioada: true }

  it('fără rând în tenant_settings pune rezervele', () => {
    const settings = mapFarmSettings(null, has)
    expect(settings.pretPerioada).toBeNull()
    expect(settings.acasaPerioadaMod).toBe('auto')
    expect(settings.extrasezonIntrebareDin).toBe('10-25')
    expect(settings.acasaExtrasezonAfiseaza).toEqual(ACASA_EXTRASEZON_TOATE)
  })

  it('ignoră valorile nevalide din bază', () => {
    const settings = mapFarmSettings(
      {
        pret_standard_inceput_lei_kg: '0',
        pret_standard_varf_lei_kg: 'abc',
        pret_standard_perioada: 'altceva',
        acasa_perioada_mod: 'iarna',
        extrasezon_intrebare_din: '25 octombrie',
        extrasezon_inceput_la: '2026-13-99x',
      },
      has,
    )
    expect(settings.pretInceput).toBeNull()
    expect(settings.pretVarf).toBeNull()
    expect(settings.pretPerioada).toBeNull()
    expect(settings.acasaPerioadaMod).toBe('auto')
    expect(settings.extrasezonIntrebareDin).toBe('10-25')
  })

  it('citește valorile bune', () => {
    const settings = mapFarmSettings(
      {
        pret_standard_inceput_lei_kg: 36,
        pret_standard_varf_lei_kg: '24.50',
        pret_standard_perioada: 'varf',
        acasa_perioada_mod: 'extrasezon',
        extrasezon_inceput_la: '2026-11-02',
        extrasezon_amanat_pana: '2026-11-09T00:00:00Z',
        extrasezon_intrebare_din: '11-01',
        acasa_extrasezon_afiseaza: { inghet: false },
      },
      has,
    )
    expect(settings).toMatchObject({
      pretInceput: 36,
      pretVarf: 24.5,
      pretPerioada: 'varf',
      acasaPerioadaMod: 'extrasezon',
      extrasezonInceputLa: '2026-11-02',
      extrasezonAmanatPana: '2026-11-09',
      extrasezonIntrebareDin: '11-01',
    })
    // O cheie lipsă înseamnă „arată”.
    expect(settings.acasaExtrasezonAfiseaza).toEqual({ ...ACASA_EXTRASEZON_TOATE, inghet: false })
  })

  it('cât coloanele lipsesc, nu ia nimic din rând', () => {
    const settings = mapFarmSettings(
      { pret_standard_perioada: 'varf', acasa_perioada_mod: 'sezon' },
      { pretStandard: false, acasaPerioada: false },
    )
    expect(settings.pretStandardConfigurabil).toBe(false)
    expect(settings.pretPerioada).toBeNull()
    expect(settings.acasaPerioadaMod).toBe('auto')
  })
})

describe('pret-standard', () => {
  it('fără setare în bază rămâne prețul de până acum', () => {
    const standard = resolvePretStandard(mapFarmSettings(null, { pretStandard: false, acasaPerioada: false }))
    expect(standard.activ).toBe(PRET_STANDARD_REZERVA)
    expect(standard.configurabil).toBe(false)
  })

  it('cu setare: prețul perioadei active, cu valorile implicite unde lipsesc', () => {
    const settings = mapFarmSettings(
      { pret_standard_varf_lei_kg: 26, pret_standard_perioada: 'varf' },
      { pretStandard: true, acasaPerioada: false },
    )
    expect(resolvePretStandard(settings)).toMatchObject({ inceput: 35, varf: 26, mediu: 30, perioada: 'varf', activ: 26 })
  })

  it('fără perioadă aleasă e „început de sezon”', () => {
    const settings = mapFarmSettings(null, { pretStandard: true, acasaPerioada: false })
    expect(resolvePretStandard(settings)).toMatchObject({ perioada: 'inceput', activ: 35, configurabil: true })
  })

  it('clientul cu preț negociat îl primește pe al lui', () => {
    const standard = resolvePretStandard(null)
    expect(pretPentruClient({ pret_negociat_lei_kg: 25 }, standard)).toEqual({ pret: 25, sursa: 'negociat' })
    expect(pretPentruClient({ pret_negociat_lei_kg: null }, standard)).toEqual({ pret: 35, sursa: 'standard' })
    expect(pretPentruClient({ pret_negociat_lei_kg: 0 }, standard)).toEqual({ pret: 35, sursa: 'standard' })
    expect(pretPentruClient(null, standard)).toEqual({ pret: 35, sursa: 'standard' })
  })
})

describe('format-ro', () => {
  it('scrie kilogramele și leii fără zecimale inutile', () => {
    expect(formatKg(12)).toBe('12 kg')
    expect(formatKg(27.35)).toBe('27,35 kg')
    expect(formatLei(105)).toBe('105 lei')
    expect(formatLei(87.5)).toBe('87,50 lei')
    expect(formatLeiKg(35)).toBe('35 lei/kg')
  })

  it('numără zilele peste lună și peste an', () => {
    expect(shiftIso('2026-11-30', 1)).toBe('2026-12-01')
    expect(shiftIso('2026-12-31', 1)).toBe('2027-01-01')
    expect(daysBetween('2026-11-19', '2026-11-26')).toBe(7)
    expect(daysBetween('2026-11-19', 'nu-e-zi')).toBeNull()
  })

  it('numește ziua față de azi', () => {
    expect(relativeDayRo('2026-11-19', '2026-11-19')).toBe('Azi')
    expect(relativeDayRo('2026-11-20', '2026-11-19')).toBe('Mâine')
    expect(relativeDayRo('2026-11-21', '2026-11-19')).toBe('Poimâine')
    expect(relativeDayRo('2026-11-18', '2026-11-19')).toBe('Ieri')
    expect(relativeDayRo(null, '2026-11-19')).toBe('Fără dată')
  })

  it('pregătește textul pentru căutare și inițialele', () => {
    expect(searchKey('  Ștefan Țăranu ')).toBe('stefan taranu')
    expect(initialsOf('Ion Popescu')).toBe('IP')
    expect(initialsOf('Patiseria')).toBe('P')
    expect(initialsOf('')).toBe('?')
    expect(capitalizeRo('joi')).toBe('Joi')
  })
})
