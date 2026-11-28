import { describe, expect, it } from 'vitest'

import {
  adaugaZile,
  clientPeScurt,
  eligibilePentruLivrare,
  filtreazaComenzi,
  istoricComanda,
  livrariAzi,
  numarPeFiltre,
} from '@/lib/comenzi/tabel'
import type { Comanda } from '@/lib/supabase/queries/comenzi'

const AZI = '2026-11-28'

function comanda(id: string, extra: Partial<Comanda> = {}): Comanda {
  return {
    id,
    tenant_id: 't',
    client_id: null,
    client_nume_manual: id,
    telefon: null,
    locatie_livrare: null,
    data_comanda: '2026-11-20',
    data_livrare: AZI,
    cantitate_kg: 10,
    pret_per_kg: 30,
    total: 300,
    status: 'programata',
    observatii: null,
    linked_vanzare_id: null,
    parent_comanda_id: null,
    created_at: `2026-11-20T10:00:0${id.length}Z`,
    updated_at: '2026-11-20T10:00:00Z',
    data_origin: null,
    ...extra,
  } as Comanda
}

const COMENZI: Comanda[] = [
  comanda('azi'),
  comanda('restanta', { data_livrare: '2026-11-25' }),
  comanda('livrare', { status: 'in_livrare', ordine_livrare: 2 }),
  comanda('livrare2', { status: 'in_livrare', ordine_livrare: 1 }),
  comanda('maine', { data_livrare: '2026-11-29' }),
  comanda('joi', { data_livrare: '2026-12-03' }),
  comanda('departe', { data_livrare: '2026-12-20' }),
  comanda('faradata', { data_livrare: null }),
  comanda('livrata', {
    status: 'livrata',
    data_livrare: '2026-11-21',
    linked_vanzare: { id: 'v', status_plata: 'neplatit', cantitate_kg: 10, pret_lei_kg: 30, suma_incasata_partial_lei: null } as unknown as Comanda['linked_vanzare'],
  }),
  comanda('anulata', { status: 'anulata' }),
]

const ids = (lista: Comanda[]) => lista.map((item) => item.id)

describe('comenzile pe desktop (promptul 35, §5)', () => {
  it('filtrele', () => {
    expect(ids(filtreazaComenzi(COMENZI, 'azi', AZI)).sort()).toEqual(['azi', 'livrare', 'livrare2', 'restanta'])
    expect(ids(filtreazaComenzi(COMENZI, 'maine', AZI))).toEqual(['maine'])
    expect(ids(filtreazaComenzi(COMENZI, 'saptamana', AZI)).sort()).toEqual(['azi', 'joi', 'livrare', 'livrare2', 'maine', 'restanta'])
    expect(ids(filtreazaComenzi(COMENZI, 'de-pregatit', AZI)).sort()).toEqual(['azi', 'departe', 'faradata', 'joi', 'maine', 'restanta'])
    expect(ids(filtreazaComenzi(COMENZI, 'in-livrare', AZI)).sort()).toEqual(['livrare', 'livrare2'])
    expect(ids(filtreazaComenzi(COMENZI, 'neincasate', AZI))).toEqual(['livrata'])
    expect(filtreazaComenzi(COMENZI, 'toate', AZI)).toHaveLength(9)
  })

  it('„Toate”: deschisele întâi, livratele la sfârșit; anulatele lipsesc', () => {
    const toate = ids(filtreazaComenzi(COMENZI, 'toate', AZI))
    expect(toate.at(-1)).toBe('livrata')
    expect(toate).not.toContain('anulata')
  })

  it('numărul pe fiecare filtru', () => {
    expect(numarPeFiltre(COMENZI, AZI)).toEqual({ toate: 9, azi: 4, maine: 1, saptamana: 6, 'de-pregatit': 6, 'in-livrare': 2, neincasate: 1 })
  })

  it('în bloc „Pune în livrare”: doar de pe Azi, fără cele deja în livrare; livrata / anulata / alte zile nu intră', () => {
    expect(ids(eligibilePentruLivrare(COMENZI, AZI)).sort()).toEqual(['azi', 'restanta'])
  })

  it('livrările de azi în ordinea traseului', () => {
    expect(ids(livrariAzi(COMENZI))).toEqual(['livrare2', 'livrare'])
  })

  it('clientul pe scurt și istoricul', () => {
    const lista = [
      comanda('a', { client_id: 'c1', status: 'livrata', data_livrare: '2026-10-01', cantitate_kg: 5 }),
      comanda('b', { client_id: 'c1', cantitate_kg: 7 }),
      comanda('c', { client_id: 'c1', status: 'anulata' }),
      comanda('vechi', { client_id: 'c1', status: 'livrata', data_livrare: '2025-08-01', data_comanda: '2025-08-01' }),
    ]
    const scurt = clientPeScurt(lista, lista[1], AZI)
    expect(scurt?.comenziAn).toBe(2)
    expect(scurt?.kgAn).toBe(12)
    expect(scurt?.ultima?.id).toBe('a')
    expect(clientPeScurt(lista, { id: 'x', client_id: null }, AZI)).toBeNull()
    expect(istoricComanda(comanda('l', { status: 'livrata', data_livrare: '2026-11-22' }))).toEqual([
      { eticheta: 'Notată', ziua: '2026-11-20' },
      { eticheta: 'Livrată', ziua: '2026-11-22' },
    ])
    expect(adaugaZile('2026-12-30', 3)).toBe('2027-01-02')
  })
})
