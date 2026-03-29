import { buildFormUrl } from '@/components/ai/AiBottomSheet'
import { hasAiOpenForm, parseAiRecoltarePrefill } from '@/app/(dashboard)/recoltari/RecoltariPageClient'
import { hasAiComandaOpenForm, parseAiComandaPrefill } from '@/app/(dashboard)/comenzi/ComenziPageClient'
import { hasAiClientOpenForm, parseAiClientPrefill } from '@/app/(dashboard)/clienti/ClientPageClient'

declare const describe: (name: string, fn: () => void) => void
declare const it: (name: string, fn: () => void) => void
declare const expect: (value: unknown) => {
  toBe: (expected: unknown) => void
  toContain: (expected: unknown) => void
  toEqual: (expected: unknown) => void
}

describe('AI handoff UI contract - form URL builder', () => {
  it('genereaza URL complet pentru recoltare', () => {
    const url = buildFormUrl('recoltare', {
      parcela_id: 'parcela-delniwa',
      parcela_label: 'Delniwa',
      cantitate_kg: 20,
      data: '2026-03-26',
      calitate: 'Cal I',
    })

    expect(url).toBe('/recoltari?openForm=1&cantitate_kg=20&parcela_id=parcela-delniwa&parcela_label=Delniwa&data=2026-03-26&calitate=Cal+I')
  })

  it('genereaza URL pentru recoltare cu observatii canonice', () => {
    const url = buildFormUrl('recoltare', {
      parcela_id: 'parcela-maravilla',
      parcela_label: 'MARAVILLA (Camp)',
      cantitate_kg: 45,
      data: '2026-03-26',
      observatii: 'fructul a fost mai moale',
    })
    expect(url).toContain('parcela_label=MARAVILLA+%28Camp%29')
    expect(url).toContain('observatii=fructul+a+fost+mai+moale')
  })

  it('genereaza URL complet pentru activitate', () => {
    const url = buildFormUrl('activitate', {
      tip: 'tratament',
      parcela_id: 'parcela-delniwa',
      parcela_label: 'Delniwa',
      produs: 'Switch',
      doza: '0.5L',
      data: '2026-03-26',
    })

    expect(url).toBe('/activitati-agricole?openForm=1&tip=tratament&parcela_id=parcela-delniwa&parcela_label=Delniwa&produs=Switch&doza=0.5L&data=2026-03-26')
  })

  it('genereaza URL complet pentru comanda', () => {
    const url = buildFormUrl('comanda', {
      client_id: 'client-1',
      client_label: 'Ion Popescu',
      telefon: '0712345678',
      cantitate_kg: 25,
      pret_per_kg: 22,
      data_livrare: '2026-03-26',
      produs: 'zmeura',
      observatii: 'Sursa: Delniwa',
    })

    expect(url).toContain('/comenzi?openForm=1')
    expect(url).toContain('client_id=client-1')
    expect(url).toContain('client_label=Ion+Popescu')
    expect(url).toContain('cantitate_kg=25')
  })

  it('genereaza URL complet pentru client', () => {
    const url = buildFormUrl('client', {
      nume_client: 'Maria Ionescu',
      telefon: '0722334455',
      email: 'maria@example.com',
    })

    expect(url).toContain('/clienti?openForm=1')
    expect(url).toContain('nume_client=Maria+Ionescu')
    expect(url).toContain('email=maria%40example.com')
  })
})

describe('AI handoff UI contract - openForm consumption', () => {
  it('detecteaza openForm pentru recoltari/activitati/comenzi/clienti', () => {
    const params = new URLSearchParams('openForm=1')
    expect(hasAiOpenForm(params)).toBe(true)
    expect(hasAiComandaOpenForm(params)).toBe(true)
    expect(hasAiClientOpenForm(params)).toBe(true)
  })

  it('parseaza prefill pentru recoltare', () => {
    const params = new URLSearchParams('openForm=1&parcela_id=parcela-maravilla&parcela_label=MARAVILLA+%28Camp%29&cantitate_kg=45&data=2026-03-26')
    const parsed = parseAiRecoltarePrefill(params)
    expect(parsed).toEqual({
      parcela_id: 'parcela-maravilla',
      parcela_label: 'MARAVILLA (Camp)',
      cantitate_kg: '45',
      data: '2026-03-26',
      observatii: '',
    })
  })

  it('parseaza prefill pentru comanda', () => {
    const params = new URLSearchParams(
      'openForm=1&client_id=client-1&client_label=Ion+Popescu&telefon=0712345678&cantitate_kg=18&pret_per_kg=24&data_livrare=2026-03-26&produs=zmeura&observatii=Sursa%3A+Delniwa'
    )

    const parsed = parseAiComandaPrefill(params)
    expect(parsed).toEqual({
      client_id: 'client-1',
      client_nume_manual: 'Ion Popescu',
      telefon: '0712345678',
      locatie_livrare: '',
      data_livrare: '2026-03-26',
      cantitate_kg: '18',
      pret_per_kg: '24',
      observatii: 'Sursa: Delniwa',
      status: 'confirmata',
    })
  })


  it('parseaza prefill pentru client', () => {
    const params = new URLSearchParams(
      'openForm=1&nume_client=Maria+Ionescu&telefon=0722334455&email=maria%40example.com&adresa=Suceava&observatii=Client+nou'
    )

    const parsed = parseAiClientPrefill(params)
    expect(parsed).toEqual({
      nume_client: 'Maria Ionescu',
      telefon: '0722334455',
      email: 'maria@example.com',
      adresa: 'Suceava',
      observatii: 'Client nou',
    })
  })
})
