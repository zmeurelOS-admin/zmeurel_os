import { describe, expect, it } from 'vitest'

import {
  planOrderClientPersistence,
  resolveExistingClientByPhone,
  type ClientMatchSummary,
} from '@/lib/comenzi/ai-order-client'

const clientiFixture: ClientMatchSummary[] = [
  {
    id: 'client-1',
    nume_client: 'Maria Popescu',
    telefon: '0740123456',
    adresa: 'Burdujeni',
    tip: 'standard',
    pret_negociat_lei_kg: null,
  },
  {
    id: 'client-2',
    nume_client: 'Alex Magazin',
    telefon: '0740555666',
    adresa: 'Ipotești',
    tip: 'magazin',
    pret_negociat_lei_kg: null,
  },
]

describe('resolveExistingClientByPhone', () => {
  it('atașează clientul existent când telefonul există exact o dată', () => {
    const result = resolveExistingClientByPhone(clientiFixture, '0740 123 456')

    expect(result).toEqual({
      status: 'existing',
      normalizedPhone: '0740123456',
      client: clientiFixture[0],
    })
  })

  it('nu atașează client automat după nume dacă telefonul lipsește', () => {
    const result = resolveExistingClientByPhone(clientiFixture, null)

    expect(result).toEqual({
      status: 'new',
      normalizedPhone: null,
    })
  })

  it('nu atașează client automat când telefonul este necunoscut', () => {
    const result = resolveExistingClientByPhone(clientiFixture, '0740999888')

    expect(result).toEqual({
      status: 'new',
      normalizedPhone: '0740999888',
    })
  })

  it('nu alege automat primul client când telefonul există la mai mulți clienți', () => {
    const result = resolveExistingClientByPhone(
      [
        ...clientiFixture,
        {
          id: 'client-3',
          nume_client: 'Maria Duplicat',
          telefon: '0740123456',
          adresa: 'Burdujeni 2',
          tip: 'standard',
          pret_negociat_lei_kg: null,
        },
      ],
      '0740123456',
    )

    expect(result.status).toBe('ambiguous')
    if (result.status !== 'ambiguous') {
      throw new Error('Expected ambiguous result')
    }
    expect(result.clients).toHaveLength(2)
  })
})

describe('planOrderClientPersistence', () => {
  it('salvare comandă fără bifă salvează client => nu creează client nou', () => {
    const plan = planOrderClientPersistence({
      clienti: clientiFixture,
      clientId: null,
      clientName: 'Client Nou',
      rawPhone: '0740111222',
      address: 'Suceava',
      saveClientRequested: false,
    })

    expect(plan).toEqual({
      action: 'none',
      reason: 'not-requested',
    })
  })

  it('salvare comandă cu bifă explicită => creează client nou după validare', () => {
    const plan = planOrderClientPersistence({
      clienti: clientiFixture,
      clientId: null,
      clientName: 'Client Nou',
      rawPhone: '0740111222',
      address: 'Suceava',
      saveClientRequested: true,
    })

    expect(plan).toEqual({
      action: 'create-new',
      input: {
        nume_client: 'Client Nou',
        telefon: '0740111222',
        adresa: 'Suceava',
        tip: 'standard',
      },
    })
  })

  it('client existent atașat => nu creează duplicat', () => {
    const plan = planOrderClientPersistence({
      clienti: clientiFixture,
      clientId: 'client-1',
      clientName: 'Maria Popescu',
      rawPhone: '0740123456',
      address: 'Burdujeni',
      saveClientRequested: true,
    })

    expect(plan).toEqual({
      action: 'none',
      reason: 'existing-client-attached',
    })
  })

  it('nu permite creare client nou când telefonul există la mai mulți clienți', () => {
    const plan = planOrderClientPersistence({
      clienti: [
        ...clientiFixture,
        {
          id: 'client-3',
          nume_client: 'Maria Duplicat',
          telefon: '0740123456',
          adresa: 'Burdujeni 2',
          tip: 'standard',
          pret_negociat_lei_kg: null,
        },
      ],
      clientId: null,
      clientName: 'Client Ambiguu',
      rawPhone: '0740123456',
      address: 'Burdujeni',
      saveClientRequested: true,
    })

    expect(plan).toEqual({
      action: 'invalid',
      reason: 'ambiguous-phone-match',
      message: 'Telefonul apare la mai mulți clienți. Verifică manual înainte de salvare.',
    })
  })
})
