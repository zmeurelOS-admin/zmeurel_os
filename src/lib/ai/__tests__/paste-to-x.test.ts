import { describe, expect, it } from 'vitest'

import {
  buildPasteToXCommonSystemPrompt,
  buildPasteToXSystemPrompt,
  buildPasteToXUserMessage,
  PASTE_TO_X_MODEL,
  PASTE_TO_X_MODULES,
  PasteToXCheltuialaSchema,
  PasteToXRecoltareSchema,
} from '@/lib/ai/paste-to-x'

describe('paste-to-x prompt registry', () => {
  it('expune modelul și modulele așteptate', () => {
    expect(PASTE_TO_X_MODEL).toBe('claude-haiku-4-5-20251001')
    expect(Object.keys(PASTE_TO_X_MODULES)).toEqual([
      'comenzi',
      'cheltuieli',
      'investitii',
      'recoltari',
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

  it('compune promptul specific de cheltuieli și wrapperul user', () => {
    const prompt = buildPasteToXSystemPrompt('cheltuieli', {
      nowLocalDate: '2026-06-21',
      nowLocalDateTime: '2026-06-21 10:30:00',
    })
    const message = buildPasteToXUserMessage('200 lei motorină azi')

    expect(prompt).toContain('suma_lei')
    expect(message).toBe(
      'Mesaj brut pentru extragere:\n<mesaj>\n200 lei motorină azi\n</mesaj>',
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
})
