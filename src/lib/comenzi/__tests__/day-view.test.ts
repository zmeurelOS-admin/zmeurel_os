import { describe, expect, it } from 'vitest'

import {
  bucketOfComanda,
  compareComenziForDay,
  defaultDeliverySelection,
  deliveryCandidates,
  groupComenziByDay,
  isComandaRestanta,
  localitateScurta,
  parseStocInsuficient,
  planDelivery,
  splitComenziByBucket,
  summarizeComenzi,
} from '@/lib/comenzi/day-view'
import { comandaClientName, comandaNota, comandaPlata, comandaStatus, phoneForLinks } from '@/lib/comenzi/display'
import type { Comanda } from '@/lib/supabase/queries/comenzi'

const TODAY = '2026-11-19'

function makeComanda(overrides: Partial<Comanda>): Comanda {
  return {
    id: overrides.id ?? 'c-1',
    tenant_id: 'tenant-1',
    client_id: overrides.client_id ?? null,
    client_nume_manual: overrides.client_nume_manual ?? null,
    telefon: overrides.telefon ?? null,
    locatie_livrare: overrides.locatie_livrare ?? null,
    data_comanda: overrides.data_comanda ?? TODAY,
    data_livrare: overrides.data_livrare === undefined ? TODAY : overrides.data_livrare,
    cantitate_kg: overrides.cantitate_kg ?? 5,
    pret_per_kg: overrides.pret_per_kg ?? 35,
    total: overrides.total ?? (overrides.cantitate_kg ?? 5) * (overrides.pret_per_kg ?? 35),
    order_kind: overrides.order_kind ?? 'manual',
    status: overrides.status ?? 'confirmata',
    observatii: overrides.observatii ?? null,
    linked_vanzare_id: overrides.linked_vanzare_id ?? null,
    linked_vanzare: overrides.linked_vanzare ?? null,
    parent_comanda_id: null,
    created_at: overrides.created_at ?? '2026-11-18T10:00:00.000Z',
    updated_at: '2026-11-18T10:00:00.000Z',
    data_origin: overrides.data_origin ?? null,
    client_nume: overrides.client_nume ?? null,
    prioritara: overrides.prioritara ?? false,
  }
}

describe('comenzi — pe zile', () => {
  it('pune comanda în segmentul zilei ei', () => {
    expect(bucketOfComanda(makeComanda({ data_livrare: TODAY }), TODAY)).toBe('azi')
    expect(bucketOfComanda(makeComanda({ data_livrare: '2026-11-20' }), TODAY)).toBe('maine')
    expect(bucketOfComanda(makeComanda({ data_livrare: '2026-11-21' }), TODAY)).toBe('tarziu')
    expect(bucketOfComanda(makeComanda({ data_livrare: null }), TODAY)).toBe('fara-data')
  })

  it('ține pe „Azi” restanțele și comenzile deja în livrare', () => {
    expect(bucketOfComanda(makeComanda({ data_livrare: '2026-11-17' }), TODAY)).toBe('azi')
    expect(bucketOfComanda(makeComanda({ status: 'in_livrare', data_livrare: '2026-11-25' }), TODAY)).toBe('azi')
    expect(isComandaRestanta(makeComanda({ data_livrare: '2026-11-17' }), TODAY)).toBe(true)
    expect(isComandaRestanta(makeComanda({ data_livrare: '2026-11-17', status: 'in_livrare' }), TODAY)).toBe(false)
    expect(isComandaRestanta(makeComanda({ data_livrare: TODAY }), TODAY)).toBe(false)
  })

  it('nu arată pe zile comenzile livrate sau anulate', () => {
    expect(bucketOfComanda(makeComanda({ status: 'livrata' }), TODAY)).toBeNull()
    expect(bucketOfComanda(makeComanda({ status: 'anulata' }), TODAY)).toBeNull()
  })

  it('trece luna fără să greșească ziua de mâine', () => {
    expect(bucketOfComanda(makeComanda({ data_livrare: '2026-12-01' }), '2026-11-30')).toBe('maine')
    expect(bucketOfComanda(makeComanda({ data_livrare: '2027-01-01' }), '2026-12-31')).toBe('maine')
  })

  it('pune prioritarele primele, apoi în ordinea notării', () => {
    const a = makeComanda({ id: 'a', created_at: '2026-11-18T08:00:00.000Z' })
    const b = makeComanda({ id: 'b', created_at: '2026-11-18T09:00:00.000Z', prioritara: true })
    const c = makeComanda({ id: 'c', created_at: '2026-11-18T07:00:00.000Z' })
    expect([a, b, c].sort(compareComenziForDay).map((item) => item.id)).toEqual(['b', 'c', 'a'])
  })

  it('împarte lista pe segmente și adună totalurile', () => {
    const comenzi = [
      makeComanda({ id: 'a', cantitate_kg: 5, total: 175 }),
      makeComanda({ id: 'b', cantitate_kg: 2.5, total: 87.5, prioritara: true }),
      makeComanda({ id: 'c', data_livrare: '2026-11-20', cantitate_kg: 10, total: 250 }),
      makeComanda({ id: 'd', status: 'livrata' }),
    ]
    const buckets = splitComenziByBucket(comenzi, TODAY)
    expect(buckets.azi.map((item) => item.id)).toEqual(['b', 'a'])
    expect(buckets.maine.map((item) => item.id)).toEqual(['c'])
    expect(summarizeComenzi(buckets.azi)).toEqual({
      count: 2,
      kg: 7.5,
      lei: 262.5,
      prioritareCount: 1,
      prioritareKg: 2.5,
    })
  })

  it('grupează „Mai târziu” pe zile, crescător', () => {
    const groups = groupComenziByDay([
      makeComanda({ id: 'a', data_livrare: '2026-11-25' }),
      makeComanda({ id: 'b', data_livrare: '2026-11-22' }),
      makeComanda({ id: 'c', data_livrare: '2026-11-25' }),
    ])
    expect(groups.map((group) => [group.day, group.comenzi.length])).toEqual([
      ['2026-11-22', 1],
      ['2026-11-25', 2],
    ])
  })
})

describe('comenzi — „Pune în livrare azi”', () => {
  const candidates = deliveryCandidates([
    makeComanda({ id: 'n1', cantitate_kg: 6, created_at: '2026-11-18T08:00:00.000Z' }),
    makeComanda({ id: 'p1', cantitate_kg: 4, prioritara: true }),
    makeComanda({ id: 'n2', cantitate_kg: 10, created_at: '2026-11-18T09:00:00.000Z' }),
    makeComanda({ id: 'deja', status: 'in_livrare', cantitate_kg: 3 }),
  ])

  it('lasă deoparte comenzile deja în livrare și pune prioritarele sus', () => {
    expect(candidates.map((item) => item.id)).toEqual(['p1', 'n1', 'n2'])
  })

  it('bifează implicit doar prioritarele', () => {
    expect(defaultDeliverySelection(candidates)).toEqual(['p1'])
  })

  it('scade stocul la fiecare bifă și blochează ce nu mai încape', () => {
    const plan = planDelivery(candidates, ['p1'], 12)
    expect(plan.selectedKg).toBe(4)
    expect(plan.remainingKg).toBe(8)
    // 6 kg încap în 8; 10 kg nu: lipsesc 2.
    expect(plan.locked).toEqual({ n2: 2 })
    expect(plan.canSubmit).toBe(true)

    const next = planDelivery(candidates, ['p1', 'n1'], 12)
    expect(next.remainingKg).toBe(2)
    expect(next.locked).toEqual({ n2: 8 })
  })

  it('nu blochează o comandă care încape exact', () => {
    const plan = planDelivery(candidates, ['p1'], 10)
    expect(plan.remainingKg).toBe(6)
    expect(plan.locked.n1).toBeUndefined()
  })

  it('avertizează când prioritarele singure depășesc stocul și nu lasă trimiterea', () => {
    const plan = planDelivery(candidates, ['p1'], 3)
    expect(plan.prioritareExceedStock).toBe(true)
    expect(plan.remainingKg).toBe(-1)
    expect(plan.canSubmit).toBe(false)
  })

  it('nu trimite nimic fără bife', () => {
    expect(planDelivery(candidates, [], 100).canSubmit).toBe(false)
  })

  it('nu se încurcă în erorile de reprezentare ale zecimalelor', () => {
    const tiny = deliveryCandidates([makeComanda({ id: 'x', cantitate_kg: 0.3 })])
    expect(planDelivery(tiny, [], 0.1 + 0.2).locked).toEqual({})
  })

  it('citește eroarea de stoc a serverului', () => {
    expect(
      parseStocInsuficient({ message: 'STOC_INSUFICIENT', details: 'necesar=10.00 disponibil=7.50', code: 'P0001' }),
    ).toEqual({ necesarKg: 10, disponibilKg: 7.5 })
    expect(parseStocInsuficient(new Error('altceva'))).toBeNull()
    // Un P0001 fără „STOC_INSUFICIENT” e altă eroare a bazei de date.
    expect(parseStocInsuficient({ message: 'Comanda nu există', code: 'P0001' })).toBeNull()
  })
})

describe('comenzi — afișare', () => {
  it('ia numele din fișa clientului, apoi cel scris de mână', () => {
    const clients = new Map([['cl-1', { nume_client: 'Maria Popescu' }]])
    expect(comandaClientName(makeComanda({ client_id: 'cl-1', client_nume_manual: 'Mărioara' }), clients)).toBe('Maria Popescu')
    expect(comandaClientName(makeComanda({ client_nume_manual: 'Ion din deal' }))).toBe('Ion din deal')
    expect(comandaClientName(makeComanda({}))).toBe('Client fără nume')
  })

  it('arată statusul după zi, nu după câmpul din bază', () => {
    expect(comandaStatus(makeComanda({ status: 'confirmata', data_livrare: '2026-11-20' }), TODAY).label).toBe('Programată')
    expect(comandaStatus(makeComanda({ status: 'noua', data_livrare: null }), TODAY).label).toBe('Nouă · fără dată')
    expect(comandaStatus(makeComanda({ status: 'in_livrare' }), TODAY).label).toBe('În livrare')
    expect(comandaStatus(makeComanda({ data_livrare: '2026-11-17' }), TODAY).label).toContain('Restantă')
  })

  it('arată plata doar la comenzile livrate', () => {
    expect(comandaPlata(makeComanda({ status: 'confirmata' }))).toBeNull()
    expect(
      comandaPlata(makeComanda({ status: 'livrata', linked_vanzare: { status_plata: 'neplatit', data_incasare: null } })),
    ).toMatchObject({ label: 'Neîncasat', incasata: false })
    expect(
      comandaPlata(makeComanda({ status: 'livrata', linked_vanzare: { status_plata: 'platit', data_incasare: TODAY } })),
    ).toMatchObject({ label: 'Încasat', incasata: true })
  })

  it('scoate metadatele magazinului din notă', () => {
    const nota = 'Comandă shop 21d158e1-dfa3-4db3-894b-d64ecad29b45 | Sună înainte'
    expect(comandaNota(makeComanda({ observatii: nota, data_origin: 'shop_order_bridge' }))).toBe('Sună înainte')
    expect(comandaNota(makeComanda({ observatii: 'Lasă la poartă' }))).toBe('Lasă la poartă')
  })

  it('pregătește numărul pentru apel și WhatsApp', () => {
    expect(phoneForLinks('0745 123 456')).toEqual({ tel: '+40745123456', wa: '40745123456' })
    expect(phoneForLinks('+40745123456')).toEqual({ tel: '+40745123456', wa: '40745123456' })
    expect(phoneForLinks('0040745123456')).toEqual({ tel: '+40745123456', wa: '40745123456' })
    expect(phoneForLinks('+44 20 7946 0958')).toEqual({ tel: '+442079460958', wa: '442079460958' })
    expect(phoneForLinks('123')).toBeNull()
    expect(phoneForLinks(null)).toBeNull()
  })

  it('scoate localitatea din adresă', () => {
    expect(localitateScurta('Str. Vișinilor 10, Burdujeni')).toBe('Burdujeni')
    expect(localitateScurta('Văratec')).toBe('Văratec')
    expect(localitateScurta('  ')).toBeNull()
  })
})
