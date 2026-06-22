import { describe, expect, it } from 'vitest'

import {
  buildPasteToXCommonSystemPrompt,
  buildPasteToXSystemPrompt,
  buildPasteToXUserMessage,
  PASTE_TO_X_MODEL,
  PASTE_TO_X_MODULES,
  PasteToXCheltuialaSchema,
  PasteToXRecoltareSchema,
  PasteToXTratamentSchema,
} from '@/lib/ai/paste-to-x'

describe('paste-to-x prompt registry', () => {
  it('expune modelul și modulele așteptate', () => {
    expect(PASTE_TO_X_MODEL).toBe('claude-haiku-4-5-20251001')
    expect(Object.keys(PASTE_TO_X_MODULES)).toEqual([
      'comenzi',
      'cheltuieli',
      'investitii',
      'recoltari',
      'tratamente',
    ])
  })

  it('generează promptul comun cu reguli stricte și context temporal', () => {
    const prompt = buildPasteToXCommonSystemPrompt({
      nowLocalDate: '2026-06-21',
      nowLocalDateTime: '2026-06-21 10:30:00',
      timezone: 'Europe/Bucharest',
    })

    expect(prompt).toContain('DATA_CURENTA: 2026-06-21')
    expect(prompt).toContain('Răspunzi DOAR cu JSON valid')
    expect(prompt).toContain('"confidence": "high" | "medium" | "low"')
  })

  it('compune promptul specific de tratamente și wrapperul user', () => {
    const prompt = buildPasteToXSystemPrompt('tratamente', {
      nowLocalDate: '2026-06-21',
      nowLocalDateTime: '2026-06-21 10:30:00',
    })
    const message = buildPasteToXUserMessage('Am dat Mavrik 2 capace la 16 litri pe P003')

    expect(prompt).toContain('doza_text_brut')
    expect(prompt).toContain('nu calcula PHI')
    expect(message).toBe(
      'Mesaj brut pentru extragere:\n<mesaj>\nAm dat Mavrik 2 capace la 16 litri pe P003\n</mesaj>',
    )
  })
})

describe('paste-to-x schemas', () => {
  it('acceptă o cheltuială ambiguă cu sumă null și incertitudini', () => {
    const parsed = PasteToXCheltuialaSchema.parse({
      data: '2026-06-21',
      categorie: 'transport',
      descriere: 'dus marfă',
      suma_lei: null,
      furnizor: null,
      metoda_plata: 'cash',
      incertitudini: ['Suma nu este clar exprimată în lei.'],
      confidence: 'medium',
    })

    expect(parsed.suma_lei).toBeNull()
    expect(parsed.metoda_plata).toBe('cash')
  })

  it('păstrează totalul de recoltare fără separare cal1/cal2', () => {
    const parsed = PasteToXRecoltareSchema.parse({
      data: '2026-06-21',
      culegator_nume: 'Nicu',
      parcela_referita: 'P003',
      cantitate_kg: 48,
      cantitate_kg_separata: {
        cal1: null,
        cal2: null,
      },
      observatii: null,
      incertitudini: [],
      confidence: 'high',
    })

    expect(parsed.cantitate_kg).toBe(48)
    expect(parsed.cantitate_kg_separata.cal1).toBeNull()
  })

  it('acceptă draftul brut pentru tratamente fără matching de produs', () => {
    const parsed = PasteToXTratamentSchema.parse({
      data_aplicata: '2026-06-21',
      parcela_referita: 'parcela de lângă drum',
      produs_nume_manual: 'Mavrik',
      doza_text_brut: '2 capace la 16 litri',
      metoda_aplicare_detectata: 'foliar',
      tip_interventie_detectat: 'protectie',
      observatii: null,
      incertitudini: ['Produsul trebuie confirmat din nomenclator.'],
      confidence: 'medium',
    })

    expect(parsed.doza_text_brut).toBe('2 capace la 16 litri')
    expect(parsed.tip_interventie_detectat).toBe('protectie')
  })
})
