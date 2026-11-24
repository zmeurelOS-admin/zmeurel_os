import { describe, expect, it } from 'vitest'

import { deliveryAnnouncementMessage, numeFermaPentruMesaj, orderConfirmationMessage, whatsappMessageUrl } from '@/lib/comenzi/whatsapp-messages'
import {
  applyOptimizedOrder,
  canSaveLocation,
  clientLocation,
  compareRouteOrder,
  deliveredToday,
  distanceMeters,
  leiDeIncasat,
  mapsBatches,
  mapsRouteUrl,
  mapsSearchUrl,
  moveStop,
  moveStopToEnd,
  navigateUrl,
  routeProgress,
  routeStops,
  shouldAskLocationUpdate,
} from '@/lib/livrari/route'
import type { Comanda } from '@/lib/supabase/queries/comenzi'

function makeComanda(overrides: Partial<Comanda>): Comanda {
  return {
    id: overrides.id ?? 'c-1',
    tenant_id: 'tenant-1',
    client_id: overrides.client_id ?? null,
    client_nume_manual: null,
    telefon: overrides.telefon ?? null,
    locatie_livrare: overrides.locatie_livrare ?? null,
    data_comanda: '2026-11-18',
    data_livrare: overrides.data_livrare === undefined ? '2026-11-19' : overrides.data_livrare,
    cantitate_kg: overrides.cantitate_kg ?? 5,
    pret_per_kg: overrides.pret_per_kg ?? 35,
    total: overrides.total ?? 175,
    order_kind: overrides.order_kind ?? 'manual',
    status: overrides.status ?? 'in_livrare',
    observatii: null,
    linked_vanzare_id: null,
    parent_comanda_id: null,
    created_at: overrides.created_at ?? '2026-11-18T10:00:00.000Z',
    updated_at: overrides.updated_at ?? '2026-11-19T10:00:00.000Z',
    data_origin: null,
    ordine_livrare: overrides.ordine_livrare ?? null,
  }
}

const SUCEAVA = { lat: 47.6514, lng: 26.2556 }

describe('livrări — ordinea pe drum', () => {
  it('ordinea aranjată de fermier are întâietate; restul vin după, în ordinea notării', () => {
    const stops = routeStops([
      makeComanda({ id: 'fara-1', created_at: '2026-11-18T09:00:00.000Z' }),
      makeComanda({ id: 'a-doua', ordine_livrare: 1 }),
      makeComanda({ id: 'prima', ordine_livrare: 0 }),
      makeComanda({ id: 'fara-0', created_at: '2026-11-18T08:00:00.000Z' }),
      makeComanda({ id: 'programata', status: 'programata' }),
    ])
    expect(stops.map((stop) => stop.id)).toEqual(['prima', 'a-doua', 'fara-0', 'fara-1'])
  })

  it('e stabilă când totul e egal', () => {
    const a = makeComanda({ id: 'a' })
    const b = makeComanda({ id: 'b' })
    expect(compareRouteOrder(a, b)).toBeLessThan(0)
    expect(compareRouteOrder(b, a)).toBeGreaterThan(0)
  })

  it('mută o oprire sus, jos și la final', () => {
    expect(moveStop(['a', 'b', 'c'], 'b', -1)).toEqual(['b', 'a', 'c'])
    expect(moveStop(['a', 'b', 'c'], 'b', 1)).toEqual(['a', 'c', 'b'])
    // La capete nu se întâmplă nimic.
    expect(moveStop(['a', 'b', 'c'], 'a', -1)).toEqual(['a', 'b', 'c'])
    expect(moveStop(['a', 'b', 'c'], 'c', 1)).toEqual(['a', 'b', 'c'])
    expect(moveStop(['a', 'b'], 'lipsa', 1)).toEqual(['a', 'b'])
    expect(moveStopToEnd(['a', 'b', 'c'], 'a')).toEqual(['b', 'c', 'a'])
    expect(moveStopToEnd(['a', 'b'], 'lipsa')).toEqual(['a', 'b'])
  })

  it('după optimizare, opririle fără locație rămân la final, în ordinea lor', () => {
    expect(applyOptimizedOrder(['a', 'fara-1', 'b', 'c', 'fara-2'], ['c', 'a', 'b'])).toEqual([
      'c',
      'a',
      'b',
      'fara-1',
      'fara-2',
    ])
    // Id-uri necunoscute sau repetate din răspuns sunt ignorate.
    expect(applyOptimizedOrder(['a', 'b'], ['b', 'x', 'b'])).toEqual(['b', 'a'])
  })
})

describe('livrări — progres', () => {
  it('numără ce e livrat azi după ziua ultimei modificări', () => {
    const today = '2026-11-19'
    const comenzi = [
      makeComanda({ id: 'azi', status: 'livrata', updated_at: '2026-11-19T12:00:00' }),
      makeComanda({ id: 'ieri', status: 'livrata', updated_at: '2026-11-18T12:00:00' }),
      makeComanda({ id: 'in-drum', status: 'in_livrare', updated_at: '2026-11-19T12:00:00' }),
    ]
    expect(deliveredToday(comenzi, today).map((comanda) => comanda.id)).toEqual(['azi'])
  })

  it('adună kilogramele rămase și banii de încasat, fără cadouri', () => {
    const progress = routeProgress(
      [
        makeComanda({ cantitate_kg: 5, total: 175 }),
        makeComanda({ cantitate_kg: 2.5, total: 87.5 }),
        makeComanda({ cantitate_kg: 3, total: 0, order_kind: 'cadou' }),
      ],
      4,
    )
    expect(progress).toEqual({ deliveredCount: 4, totalCount: 7, kgRamase: 10.5, leiDeIncasat: 262.5 })
    expect(leiDeIncasat(makeComanda({ total: 90, order_kind: 'consum_propriu' }))).toBe(0)
  })
})

describe('livrări — locații', () => {
  it('ia locația clientului doar dacă e completă și validă', () => {
    expect(clientLocation({ latitudine: 47.65, longitudine: 26.25 })).toEqual({ lat: 47.65, lng: 26.25 })
    expect(clientLocation({ latitudine: null, longitudine: 26.25 })).toBeNull()
    expect(clientLocation({ latitudine: 0, longitudine: 0 })).toBeNull()
    expect(clientLocation({ latitudine: 123, longitudine: 26.25 })).toBeNull()
    expect(clientLocation({})).toBeNull()
    expect(clientLocation(null)).toBeNull()
  })

  it('măsoară distanța în metri', () => {
    expect(distanceMeters(SUCEAVA, SUCEAVA)).toBe(0)
    // 0,001° latitudine ≈ 111 m.
    expect(distanceMeters(SUCEAVA, { lat: SUCEAVA.lat + 0.001, lng: SUCEAVA.lng })).toBeGreaterThan(105)
    expect(distanceMeters(SUCEAVA, { lat: SUCEAVA.lat + 0.001, lng: SUCEAVA.lng })).toBeLessThan(117)
  })

  it('salvează locația doar la precizie sub 50 m', () => {
    expect(canSaveLocation(12)).toBe(true)
    expect(canSaveLocation(49.9)).toBe(true)
    expect(canSaveLocation(50)).toBe(false)
    expect(canSaveLocation(null)).toBe(false)
    expect(canSaveLocation(0)).toBe(false)
  })

  it('întreabă „Livrezi aici și de acum?” doar peste 150 m, cu GPS precis și locație deja salvată', () => {
    const near = { lat: SUCEAVA.lat + 0.001, lng: SUCEAVA.lng } // ~111 m
    const far = { lat: SUCEAVA.lat + 0.002, lng: SUCEAVA.lng } // ~222 m
    expect(shouldAskLocationUpdate(SUCEAVA, far, 10)).toBe(true)
    expect(shouldAskLocationUpdate(SUCEAVA, near, 10)).toBe(false)
    expect(shouldAskLocationUpdate(SUCEAVA, far, 80)).toBe(false)
    expect(shouldAskLocationUpdate(null, far, 10)).toBe(false)
    expect(shouldAskLocationUpdate(SUCEAVA, null, 10)).toBe(false)
  })
})

describe('livrări — navigare', () => {
  it('face legătura pentru o oprire, în Google Maps sau Waze', () => {
    expect(navigateUrl(SUCEAVA, 'google')).toBe(
      'https://www.google.com/maps/dir/?api=1&destination=47.651400%2C26.255600&travelmode=driving',
    )
    expect(navigateUrl(SUCEAVA, 'waze')).toBe('https://waze.com/ul?ll=47.651400%2C26.255600&navigate=yes')
    expect(mapsSearchUrl(' Str. Vișinilor 10, Burdujeni ')).toContain('query=Str.%20Vi%C8%99inilor%2010%2C%20Burdujeni')
  })

  it('trimite câte 9 opriri, sărind peste cele fără locație', () => {
    const stops = Array.from({ length: 21 }, (_, index) => ({
      id: index,
      location: index === 4 ? null : { lat: 47 + index / 100, lng: 26 },
    }))
    const batches = mapsBatches(stops)
    expect(batches.map((batch) => batch.length)).toEqual([9, 9, 2])
    expect(batches[0].map((stop) => stop.id)).toEqual([0, 1, 2, 3, 5, 6, 7, 8, 9])
  })

  it('pune ultima oprire ca destinație și restul ca opriri pe drum', () => {
    const url = mapsRouteUrl([
      { lat: 47.1, lng: 26.1 },
      { lat: 47.2, lng: 26.2 },
      { lat: 47.3, lng: 26.3 },
    ])
    expect(url).toContain('destination=47.300000%2C26.300000')
    expect(url).toContain('waypoints=47.100000%2C26.100000%7C47.200000%2C26.200000')
    expect(mapsRouteUrl([{ lat: 47.1, lng: 26.1 }])).not.toContain('waypoints')
    expect(mapsRouteUrl([])).toBeNull()
  })
})

describe('mesajele WhatsApp', () => {
  it('anunțul de livrare păstrează textul de dinainte și intră într-o legătură wa.me', () => {
    const comanda = makeComanda({ cantitate_kg: 4, total: 140, locatie_livrare: 'Burdujeni', created_at: '2026-06-19T09:00:00.000Z' })
    const message = deliveryAnnouncementMessage(comanda, 'Maria Popescu')
    expect(message).toContain('Bună ziua, Maria!')
    expect(message).toContain('4 kg (140 lei)')
    expect(message).toContain('va fi livrată la adresa: Burdujeni.')
    expect(whatsappMessageUrl('0745 123 456', message)).toMatch(/^https:\/\/wa\.me\/40745123456\?text=Bun%C4%83%20ziua/)
    expect(whatsappMessageUrl(null, message)).toBeNull()
  })

  // Promptul 33: semnătura e numele fermei care trimite, nu „Ferma Zmeurel” scris fix.
  it('semnează cu numele fermei; fără nume (sau cu cel pus automat), mesajul e neutru', () => {
    const comanda = makeComanda({ cantitate_kg: 2, total: 60, created_at: '2026-06-19T09:00:00.000Z' })
    expect(deliveryAnnouncementMessage(comanda, 'Ion', 'Ferma Popescu')).toContain('Mulțumim! — Ferma Popescu 🌿')
    expect(orderConfirmationMessage(comanda, 'Ion', 'Livada Verde')).toContain('Mulțumim că ați ales Livada Verde! 🌿')
    for (const nume of [null, undefined, '', '  ', 'Ferma mea', "Ion's Farm", 'tenant_demo_ab12', 'tenant_ab12']) {
      const anunt = deliveryAnnouncementMessage(comanda, 'Ion', nume)
      const confirmare = orderConfirmationMessage(comanda, 'Ion', nume)
      expect(anunt).toContain('Mulțumim! 🌿')
      expect(confirmare).toContain('Mulțumim! 🌿')
      expect(`${anunt}${confirmare}`).not.toMatch(/zmeurel/i)
    }
    expect(numeFermaPentruMesaj('  Ferma Zmeurel ')).toBe('Ferma Zmeurel')
  })
})
