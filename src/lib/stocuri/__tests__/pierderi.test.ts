import { describe, expect, it } from 'vitest'

import {
  detaliuPierdere,
  estePierdere,
  etichetaRandPierdere,
  motivRand,
  problemaPierdere,
  sumarPierderiSezon,
  tipPentruMotiv,
  trecePesteStoc,
} from '@/lib/stocuri/pierderi'
import { TIPURI_AJUSTARE_FARA_PIERDERI } from '@/lib/stocuri/stoc'

const AZI = '2026-07-20'

describe('pierderile din stoc (promptul 33)', () => {
  it('motivul e obligatoriu; „Altul” cere textul; ziua nu poate fi în viitor', () => {
    expect(problemaPierdere({ motiv: null, kg: 5, textAltul: '', zi: AZI, azi: AZI })).toBe('Alege motivul.')
    expect(problemaPierdere({ motiv: 'altul', kg: 5, textAltul: '  ', zi: AZI, azi: AZI })).toBe('Scrie ce s-a întâmplat.')
    expect(problemaPierdere({ motiv: 'altul', kg: 5, textAltul: 'grindină', zi: AZI, azi: AZI })).toBeNull()
    expect(problemaPierdere({ motiv: 'stricat', kg: null, textAltul: '', zi: AZI, azi: AZI })).toBe('Scrie câte kilograme.')
    expect(problemaPierdere({ motiv: 'stricat', kg: 0, textAltul: '', zi: AZI, azi: AZI })).toBe('Scrie câte kilograme.')
    expect(problemaPierdere({ motiv: 'stricat', kg: 3, textAltul: '', zi: '2026-07-21', azi: AZI })).toBe('Ziua nu poate fi în viitor.')
    expect(problemaPierdere({ motiv: 'donat', kg: 3, textAltul: '', zi: '2026-07-01', azi: AZI })).toBeNull()
  })

  it('sub zero: cere confirmare, nu blochează', () => {
    expect(trecePesteStoc(10, 12)).toBe(false)
    expect(trecePesteStoc(12, 12)).toBe(false)
    expect(trecePesteStoc(12.01, 12)).toBe(true)
    expect(trecePesteStoc(5, -2)).toBe(true)
    expect(trecePesteStoc(null, 0)).toBe(false)
    // Trecerea sub zero nu e o problemă de validare: se poate salva după confirmare.
    expect(problemaPierdere({ motiv: 'stricat', kg: 50, textAltul: '', zi: AZI, azi: AZI })).toBeNull()
  })

  it('consumul propriu își păstrează tipul; restul sunt pierderi', () => {
    expect(tipPentruMotiv('consum_propriu')).toBe('consum_propriu')
    for (const motiv of ['stricat', 'donat', 'altul'] as const) expect(tipPentruMotiv(motiv)).toBe('pierdere')
  })

  it('detaliul: textul de la „Altul” și nota', () => {
    expect(detaliuPierdere('altul', ' grindină ', ' rândul 3 ')).toBe('grindină · rândul 3')
    expect(detaliuPierdere('stricat', 'ignorat', '')).toBeNull()
    expect(detaliuPierdere('donat', '', 'la biserică')).toBe('la biserică')
  })

  it('sumarul pe sezon: total și „din care stricat”; rândurile vechi intră doar în total', () => {
    const randuri = [
      { data: '2026-07-01', delta_kg: -10, tip: 'pierdere', categorie_pierdere: 'stricat' },
      { data: '2026-07-05', delta_kg: '-4.5', tip: 'pierdere', categorie_pierdere: 'stricat' },
      { data: '2026-07-06', delta_kg: -3, tip: 'consum_propriu', categorie_pierdere: 'nespecificat' }, // vechi
      { data: '2026-07-07', delta_kg: -2, tip: 'pierdere', categorie_pierdere: 'nespecificat' }, // vechi, fără motiv
      { data: '2026-07-08', delta_kg: -1, tip: 'pierdere', categorie_pierdere: 'donat' },
      { data: '2026-07-09', delta_kg: -20, tip: 'congelat', categorie_pierdere: 'nespecificat' }, // nu e pierdere
      { data: '2026-07-09', delta_kg: 5, tip: 'corectie_plus', categorie_pierdere: 'nespecificat' },
      { data: '2026-05-01', delta_kg: -8, tip: 'pierdere', categorie_pierdere: 'stricat' }, // înainte de sezon
    ]
    const sumar = sumarPierderiSezon(randuri, '2026-06-15')
    expect(sumar.totalKg).toBe(20.5)
    expect(sumar.peMotiv).toEqual({ stricat: 14.5, consum_propriu: 3, donat: 1, altul: 0 })
  })

  it('eticheta din istoric', () => {
    expect(etichetaRandPierdere({ tip: 'pierdere', categorie_pierdere: 'stricat' })).toBe('Pierdere · stricat')
    expect(etichetaRandPierdere({ tip: 'pierdere', categorie_pierdere: 'altul' })).toBe('Pierdere · altul')
    expect(etichetaRandPierdere({ tip: 'consum_propriu', categorie_pierdere: 'consum_propriu' })).toBe('Consum propriu')
    expect(etichetaRandPierdere({ tip: 'pierdere', categorie_pierdere: 'nespecificat' })).toBe('Pierdere')
    expect(etichetaRandPierdere({ tip: 'pierdere' })).toBe('Pierdere')
    expect(etichetaRandPierdere({ tip: 'congelat', categorie_pierdere: 'nespecificat' })).toBeNull()
    expect(motivRand({ tip: 'consum_propriu', categorie_pierdere: null })).toBe('consum_propriu')
    expect(estePierdere({ tip: 'pierdere', delta_kg: 3 })).toBe(false)
  })

  it('„Ajustează stocul” fără Pierdere și Consum propriu, după migrare', () => {
    expect(TIPURI_AJUSTARE_FARA_PIERDERI).toEqual(['congelat', 'procesat', 'corectie_plus', 'corectie_minus', 'altul'])
  })
})
