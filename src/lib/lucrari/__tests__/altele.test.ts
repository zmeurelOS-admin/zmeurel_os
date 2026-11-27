import { describe, expect, it } from 'vitest'

import { alegeriRapideAltele } from '@/lib/lucrari/altele'
import { ceLipsesteLucrare, randuriLucrareDeSalvat } from '@/lib/lucrari/formular'
import { randuriLucrari } from '@/lib/lucrari/jurnal'
import { textAltele, tipLucrareDin, tipOriginalPentruAltele, titluDinTipActivitate, valoareTipActivitate } from '@/lib/lucrari/tipuri'
import { tipDinActivitateVeche } from '@/lib/tratamente/model'

describe('„Altele: <text>” (promptul 34, §7)', () => {
  it('prefixul se citește „Altele”, înaintea euristicilor (curățat, udat, tratament, legat în text)', () => {
    for (const text of ['Altele: Curățat șanțurile', 'Altele: Udat cu furtunul', 'Altele: tratament cu apă', 'Altele: Plasă de umbrire: demontat și legat', 'altele:  Tăiat iarba']) {
      expect(tipLucrareDin(text), text).toBe('altele')
    }
  })

  it('nu e tratament (Tratamente nu-l importă)', () => {
    expect(tipDinActivitateVeche('Altele: tratament cu apă')).toBeNull()
    expect(tipDinActivitateVeche('Altele: Stropire cu apă')).toBeNull()
  })

  it('textul de după prefix e titlul; „Altele” vechi rămâne „Altele”', () => {
    expect(textAltele('Altele: Plasă de umbrire: demontat și legat')).toBe('Plasă de umbrire: demontat și legat')
    expect(textAltele('Altele')).toBeNull()
    expect(textAltele('Altele:   ')).toBeNull()
    expect(textAltele('Recoltare')).toBeNull()
    expect(tipLucrareDin('Altele')).toBe('altele')
    expect(tipOriginalPentruAltele('Recoltare')).toBe('Recoltare')
    expect(tipOriginalPentruAltele('Altele: Plasă')).toBeNull()
    expect(titluDinTipActivitate('Altele: Plasă')).toBe('Plasă')
    expect(titluDinTipActivitate('Tăiere')).toBe('Tăiere')
  })

  it('valoarea scrisă: „Altele: <text>” doar la Altele cu text', () => {
    expect(valoareTipActivitate('altele', ' Plasă de umbrire ')).toBe('Altele: Plasă de umbrire')
    expect(valoareTipActivitate('altele', '')).toBe('Altele')
    expect(valoareTipActivitate('legat', 'ceva')).toBe('Legat')
    expect(valoareTipActivitate('altele', 'x'.repeat(100))).toBe(`Altele: ${'x'.repeat(80)}`)
  })

  it('formularul: la „Altele”, „Ce ai făcut?” e obligatoriu, iar rândul salvat are „Altele: …”', () => {
    const ciorna = { tip: 'altele' as const, ceAiFacut: '', parcelaIds: ['p1'], cine: '', nota: '' }
    expect(ceLipsesteLucrare(ciorna)).toBe('ceAiFacut')
    const chei = new Map([['p1', 'k1']])
    expect(randuriLucrareDeSalvat({ ciorna, cand: { tip: 'azi' }, chei, lotId: 'L', cuMigrare: false })).toEqual([])
    const plin = { ...ciorna, ceAiFacut: 'Plasă de umbrire: demontat și legat' }
    expect(ceLipsesteLucrare(plin)).toBeNull()
    const [rand] = randuriLucrareDeSalvat({ ciorna: plin, cand: { tip: 'azi' }, chei, lotId: 'L', cuMigrare: false })
    expect(rand.tip_activitate).toBe('Altele: Plasă de umbrire: demontat și legat')
  })

  it('jurnalul: titlul e textul; „Altele” vechi are textul vechi la „Notată ca”', () => {
    const rows = [
      { id: 'a', parcela_id: 'p1', data_aplicare: '2026-11-20T10:00:00Z', tip_activitate: 'Altele: Plasă de umbrire', operator: null, observatii: null, created_at: '2026-11-20T10:00:00Z' },
      { id: 'b', parcela_id: 'p1', data_aplicare: '2026-11-19T10:00:00Z', tip_activitate: 'Recoltare', operator: null, observatii: null, created_at: '2026-11-19T10:00:00Z' },
    ]
    const randuri = randuriLucrari(rows, '2026-11-27')
    const nou = randuri.find((r) => r.randuri[0].id === 'a')
    const vechi = randuri.find((r) => r.randuri[0].id === 'b')
    expect(nou).toMatchObject({ tip: 'altele', ceAiFacut: 'Plasă de umbrire', tipOriginal: null })
    expect(vechi).toMatchObject({ tip: 'altele', ceAiFacut: null, tipOriginal: 'Recoltare' })
  })
})

describe('alegerile rapide de la „Altele”', () => {
  const rand = (tip: string, zi: string, lot?: string) => ({ id: `${tip}-${zi}-${lot ?? ''}`, tip_activitate: tip, created_at: `${zi}T10:00:00Z`, lot_id: lot ?? null })

  it('top 5 după apariții (un lot pe mai multe parcele = o dată), apoi după cea mai nouă', () => {
    const rows = [
      rand('Altele: Plasă de umbrire', '2026-06-01', 'L1'),
      rand('Altele: Plasă de umbrire', '2026-06-01', 'L1'),
      rand('Altele: plasa de umbrire', '2026-07-01', 'L2'),
      rand('Altele: Montat picurători', '2026-05-01', 'L3'),
      rand('Altele: Montat picurători', '2026-05-02', 'L4'),
      rand('Altele: Montat picurători', '2026-05-03', 'L5'),
      rand('Altele: Văruit stâlpii', '2026-08-01', 'L6'),
      rand('Altele: Curățat șanț', '2026-04-01', 'L7'),
      rand('Altele: Reparat gard', '2026-03-01', 'L8'),
      rand('Altele: Mutat stupii', '2026-02-01', 'L9'),
      rand('Altele', '2026-09-01', 'L10'),
      rand('Recoltare', '2026-09-01', 'L11'),
      rand('Tăiere', '2026-09-01', 'L12'),
    ]
    expect(alegeriRapideAltele(rows)).toEqual(['Montat picurători', 'plasa de umbrire', 'Văruit stâlpii', 'Curățat șanț', 'Reparat gard'])
  })

  it('fără „Altele: …”, nicio alegere', () => {
    expect(alegeriRapideAltele([rand('Altele', '2026-01-01'), rand('Legat', '2026-01-02')])).toEqual([])
  })
})
