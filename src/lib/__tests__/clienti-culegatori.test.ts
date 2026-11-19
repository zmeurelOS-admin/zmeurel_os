import { describe, expect, it } from 'vitest'

import { parseClientCsv } from '@/lib/clienti/import'
import {
  buildClientMetrics,
  clientFilterCounts,
  clientOrders,
  clientPretLabel,
  filterClients,
  metricsOf,
} from '@/lib/clienti/view'
import {
  buildCulegatorStats,
  culegatoriByStatus,
  culegatoriSummary,
  normalizeTipAngajare,
  statsOf,
} from '@/lib/culegatori/view'
import type { Client } from '@/lib/supabase/queries/clienti'
import type { Comanda } from '@/lib/supabase/queries/comenzi'
import type { Recoltare } from '@/lib/supabase/queries/recoltari'
import type { Vanzare } from '@/lib/supabase/queries/vanzari'

const client = (overrides: Partial<Client>): Client =>
  ({ id: 'c1', nume_client: 'Ion Popescu', telefon: '0745123456', tip: 'standard', pret_negociat_lei_kg: null, ...overrides }) as Client

const vanzare = (overrides: Partial<Vanzare>): Vanzare =>
  ({ id: 'v', client_id: 'c1', data: '2026-07-10', data_incasare: null, cantitate_kg: 4, pret_lei_kg: 30, status_plata: 'neplatit', ...overrides }) as unknown as Vanzare

const comanda = (overrides: Partial<Comanda>): Comanda =>
  ({ id: 'o', client_id: 'c1', status: 'livrata', data_livrare: '2026-07-10', data_comanda: '2026-07-09', cantitate_kg: 4, created_at: '2026-07-09T10:00:00Z', ...overrides }) as unknown as Comanda

describe('clienți — cifrele unui client', () => {
  const clienti = [client({}), client({ id: 'c2', nume_client: 'Patiseria Ana', tip: 'patiserie', pret_negociat_lei_kg: 25, telefon: '+40722000111' })]

  it('adună neîncasatul, cifrele anului și ultima comandă', () => {
    const metrics = buildClientMetrics(
      clienti,
      [comanda({}), comanda({ id: 'o2', data_livrare: '2026-08-01', status: 'confirmata', cantitate_kg: 6 }), comanda({ id: 'o3', status: 'anulata', data_livrare: '2026-08-05' }), comanda({ id: 'o4', data_livrare: '2025-08-05' })],
      [
        vanzare({}),
        vanzare({ id: 'v2', status_plata: 'platit', data_incasare: '2026-07-12', cantitate_kg: 10 }),
        vanzare({ id: 'v3', status_plata: 'platit', data: '2025-07-10', data_incasare: '2025-07-12' }),
        vanzare({ id: 'v4', suma_incasata_partial_lei: 50, cantitate_kg: 5 }),
      ],
      2026,
    )
    const own = metricsOf(metrics, 'c1')
    // 120 neîncasat + (150 − 50 dat) rest.
    expect(own.neincasatLei).toBe(220)
    // Comenzile din 2026, fără cea anulată.
    expect(own.comenziAn).toBe(2)
    expect(own.kgAn).toBe(19)
    expect(own.incasatAn).toBe(300)
    expect(own.ultimaComanda).toMatchObject({ data: '2026-08-05', status: 'anulata' })
    expect(metricsOf(metrics, 'c2').neincasatLei).toBe(0)
    expect(metricsOf(metrics, 'lipsa').comenziAn).toBe(0)
  })

  it('filtrează după tip, neîncasat, nume fără diacritice și telefon', () => {
    const metrics = buildClientMetrics(clienti, [], [vanzare({})], 2026)
    expect(clientFilterCounts(clienti, metrics)).toEqual({ toti: 2, persoane: 1, patiserii: 1, magazine: 0, neincasat: 1 })
    expect(filterClients(clienti, metrics, 'patiserii', '').map((item) => item.id)).toEqual(['c2'])
    expect(filterClients(clienti, metrics, 'neincasat', '').map((item) => item.id)).toEqual(['c1'])
    expect(filterClients(clienti, metrics, 'toti', 'patiseria').map((item) => item.id)).toEqual(['c2'])
    // „0722…” găsește „+40722…”.
    expect(filterClients(clienti, metrics, 'toti', '0722 000').map((item) => item.id)).toEqual(['c2'])
    expect(filterClients(clienti, metrics, 'toti', 'nimeni')).toEqual([])
  })

  it('scrie eticheta de preț', () => {
    expect(clientPretLabel(client({ tip: 'patiserie', pret_negociat_lei_kg: 25 }))).toBe('Patiserie · 25 lei/kg')
    expect(clientPretLabel(client({ tip: 'magazin', pret_negociat_lei_kg: null }))).toBe('Magazin')
    expect(clientPretLabel(client({}))).toBeNull()
    expect(clientPretLabel(client({ pret_negociat_lei_kg: 28 }))).toBe('Preț negociat · 28 lei/kg')
  })

  it('dă ultimele comenzi, cele mai noi întâi', () => {
    const orders = clientOrders(
      [comanda({ id: 'a', data_livrare: '2026-07-01' }), comanda({ id: 'b', data_livrare: '2026-08-01' }), comanda({ id: 'c', client_id: 'alt' })],
      'c1',
    )
    expect(orders.map((order) => order.id)).toEqual(['b', 'a'])
  })
})

describe('clienți — importul din fișier', () => {
  it('recunoaște coloanele după antet, în română sau engleză', () => {
    const preview = parseClientCsv('Nume client;Telefon;Adresa\nIon Popescu;0745123456;Suceava\n;0700000000;Fără nume\n')
    expect(preview.hasNameColumn).toBe(true)
    expect(preview.rows).toEqual([{ nume_client: 'Ion Popescu', telefon: '0745123456', email: null, adresa: 'Suceava', observatii: null }])
    expect(preview.skippedNoName).toBe(1)

    const google = parseClientCsv('First Name,Last Name,Phone 1 - Value\nMaria,Ionescu,+40 722 334 455\n')
    expect(google.rows[0]).toMatchObject({ nume_client: 'Maria Ionescu', telefon: '+40 722 334 455' })
  })

  it('fără antet ia coloanele în ordinea nume, telefon, email, adresă, observații', () => {
    const preview = parseClientCsv('Ion Popescu,0745123456,,Suceava,client vechi\n')
    expect(preview.rows[0]).toEqual({
      nume_client: 'Ion Popescu',
      telefon: '0745123456',
      email: null,
      adresa: 'Suceava',
      observatii: 'client vechi',
    })
  })

  it('un fișier gol nu dă niciun rând', () => {
    expect(parseClientCsv('').rows).toEqual([])
  })
})

describe('culegători', () => {
  const recoltare = (overrides: Partial<Recoltare>): Recoltare =>
    ({ id: 'r', culegator_id: 'w1', parcela_id: 'p1', data: '2026-07-15', kg_cal1: 10, kg_cal2: 0, valoare_munca_lei: 25, ...overrides }) as unknown as Recoltare

  it('adună kilogramele de azi, din sezon și plata din recoltări', () => {
    const stats = buildCulegatorStats(
      [
        recoltare({}),
        recoltare({ id: 'r2', kg_cal1: 5, kg_cal2: 2, valoare_munca_lei: 17.5 }),
        recoltare({ id: 'r3', data: '2026-07-14', parcela_id: 'p2', kg_cal1: 20, valoare_munca_lei: 50 }),
        recoltare({ id: 'r4', data: '2025-07-14', kg_cal1: 999, valoare_munca_lei: 999 }),
        recoltare({ id: 'r5', culegator_id: 'w2', data: '2026-07-10', kg_cal1: 8, valoare_munca_lei: 20 }),
      ],
      '2026-07-15',
    )
    expect(statsOf(stats, 'w1')).toMatchObject({ kgAzi: 17, kgSezon: 37, platitSezon: 92.5 })
    // O intrare pe zi și parcelă, cele mai noi întâi.
    expect(statsOf(stats, 'w1').zile).toEqual([
      { data: '2026-07-15', parcelaId: 'p1', kg: 17 },
      { data: '2026-07-14', parcelaId: 'p2', kg: 20 },
    ])
    expect(statsOf(stats, 'lipsa')).toMatchObject({ kgAzi: 0, kgSezon: 0, platitSezon: 0 })
    expect(culegatoriSummary(stats)).toEqual({ kgAzi: 17, culesAziCount: 1, kgSezon: 45, platitSezon: 112.5 })
  })

  it('desparte activii de inactivi, alfabetic', () => {
    const list = [
      { nume_prenume: 'Zoe', status_activ: true },
      { nume_prenume: 'Ana', status_activ: true },
      { nume_prenume: 'Ion', status_activ: false },
    ]
    expect(culegatoriByStatus(list, true).map((item) => item.nume_prenume)).toEqual(['Ana', 'Zoe'])
    expect(culegatoriByStatus(list, false).map((item) => item.nume_prenume)).toEqual(['Ion'])
  })

  it('aduce tipul salvat la una dintre cele patru variante', () => {
    expect(normalizeTipAngajare('zilier')).toBe('Zilier')
    expect(normalizeTipAngajare('Altceva')).toBe('Sezonier')
    expect(normalizeTipAngajare(null)).toBe('Sezonier')
  })
})
