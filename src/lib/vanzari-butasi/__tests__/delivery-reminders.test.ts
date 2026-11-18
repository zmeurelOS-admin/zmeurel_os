import { describe, expect, it } from 'vitest'

import {
  addDaysYmd,
  buildDeliveryReminders,
  type ReminderOrderInput,
} from '@/lib/vanzari-butasi/delivery-reminders'

const TODAY = '2026-11-18'

function order(partial: Partial<ReminderOrderInput>): ReminderOrderInput {
  return {
    id: partial.id ?? 'o1',
    tenant_id: partial.tenant_id ?? 't1',
    client_id: partial.client_id ?? null,
    client_nume_manual: partial.client_nume_manual ?? null,
    data_comanda: partial.data_comanda ?? '2026-11-10',
    data_livrare_estimata: partial.data_livrare_estimata ?? null,
    status: partial.status ?? 'noua',
    total_lei: partial.total_lei ?? 900,
    avans_suma: partial.avans_suma ?? 0,
    items: partial.items ?? [{ soi: 'Delniwa', cantitate: 300 }],
  }
}

describe('addDaysYmd', () => {
  it('trece corect peste lună și an', () => {
    expect(addDaysYmd('2026-11-30', 1)).toBe('2026-12-01')
    expect(addDaysYmd('2026-12-31', 7)).toBe('2027-01-07')
    expect(addDaysYmd('2027-03-01', -14)).toBe('2027-02-15')
  })
})

describe('buildDeliveryReminders', () => {
  const names = new Map([['c1', 'Ilie Cati']])

  it('anunță cu o zi înainte comenzile active', () => {
    const result = buildDeliveryReminders(
      [order({ client_id: 'c1', data_livrare_estimata: '2026-11-19' })],
      names,
      TODAY,
    )
    expect(result).toHaveLength(1)
    expect(result[0].kind).toBe('maine')
    expect(result[0].title).toBe('Mâine livrezi butași')
    expect(result[0].body).toBe('Ilie Cati — Delniwa 300 buc · rest 900 lei.')
    expect(result[0].reminderKey).toBe('butasi:maine:2026-11-19')
  })

  it('nu anunță comenzile livrate sau anulate', () => {
    const result = buildDeliveryReminders(
      [
        order({ id: 'a', status: 'livrata', data_livrare_estimata: '2026-11-19' }),
        order({ id: 'b', status: 'anulata', data_livrare_estimata: '2026-11-19' }),
      ],
      names,
      TODAY,
    )
    expect(result).toHaveLength(0)
  })

  it('anunță cu o săptămână înainte doar comenzile cu termen îndepărtat', () => {
    const result = buildDeliveryReminders(
      [
        order({ id: 'departe', data_comanda: '2026-10-01', data_livrare_estimata: '2026-11-25' }),
        order({ id: 'aproape', data_comanda: '2026-11-17', data_livrare_estimata: '2026-11-25' }),
      ],
      names,
      TODAY,
    )
    expect(result).toHaveLength(1)
    expect(result[0].kind).toBe('saptamana')
    expect(result[0].orderIds).toEqual(['departe'])
    expect(result[0].title).toBe('Peste o săptămână livrezi butași')
  })

  it('grupează mai multe livrări din aceeași zi într-o singură notificare', () => {
    const result = buildDeliveryReminders(
      [
        order({ id: '1', client_nume_manual: 'Ana', data_livrare_estimata: '2026-11-19', avans_suma: 900 }),
        order({ id: '2', client_nume_manual: 'Bogdan', data_livrare_estimata: '2026-11-19' }),
        order({ id: '3', tenant_id: 't2', client_nume_manual: 'Alt fermier', data_livrare_estimata: '2026-11-19' }),
      ],
      names,
      TODAY,
    )
    const t1 = result.find((r) => r.tenantId === 't1')
    expect(result).toHaveLength(2)
    expect(t1?.title).toBe('Mâine ai 2 livrări de butași')
    expect(t1?.body).toContain('Ana — Delniwa 300 buc;')
    expect(t1?.body).toContain('Bogdan — Delniwa 300 buc · rest 900 lei')
  })
})
