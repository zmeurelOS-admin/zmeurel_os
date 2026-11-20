import { describe, expect, it, vi } from 'vitest'

import { SAVE_ERROR_MESSAGE, writeTenantSettings, type SettingsWriteTable } from '@/lib/farm-settings'

type SelectResult = Awaited<ReturnType<ReturnType<SettingsWriteTable['upsert']>['select']>>

function fakeTable(result: SelectResult | (() => never)) {
  const upsert = vi.fn(() => ({
    select: vi.fn(async () => (typeof result === 'function' ? result() : result)),
  }))
  return { table: { upsert } as unknown as SettingsWriteTable, upsert }
}

describe('writeTenantSettings', () => {
  it('trimite tenant_id și valorile, cu upsert pe tenant_id', async () => {
    const { table, upsert } = fakeTable({ data: [{ tenant_id: 't1' }], error: null })
    await writeTenantSettings(table, 't1', { pret_standard_perioada: 'varf' })
    expect(upsert).toHaveBeenCalledWith(
      { tenant_id: 't1', pret_standard_perioada: 'varf' },
      { onConflict: 'tenant_id' },
    )
  })

  it('refuzul RLS dă mesajul clar, nu eroarea bazei de date', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const { table } = fakeTable({
      data: null,
      error: { code: '42501', message: 'new row violates row-level security policy for table "tenant_settings"' },
    })
    await expect(writeTenantSettings(table, 't1', { latitudine_default: 47.2 })).rejects.toThrow(SAVE_ERROR_MESSAGE)
  })

  it('o scriere care nu întoarce niciun rând nu trece drept salvare', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const { table } = fakeTable({ data: [], error: null })
    await expect(writeTenantSettings(table, 't1', { acasa_perioada_mod: 'sezon' })).rejects.toThrow(
      SAVE_ERROR_MESSAGE,
    )
  })

  it('o eroare de rețea dă același mesaj', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const { table } = fakeTable(() => {
      throw new TypeError('Failed to fetch')
    })
    await expect(writeTenantSettings(table, 't1', { extrasezon_inceput_la: '2026-11-20' })).rejects.toThrow(
      SAVE_ERROR_MESSAGE,
    )
  })
})
