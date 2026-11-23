import { describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/supabase/client', () => ({ getSupabase: () => ({}) }))

import { alegeProdusCultura, culturaDinText } from '@/lib/supabase/queries/produse-cultura'

describe('produsul culturii', () => {
  const zmeura = culturaDinText('Zmeure Delniwa')!
  const afine = culturaDinText('Afine')!

  it('cultura din textul parcelei', () => {
    expect(zmeura).toMatchObject({ cheie: 'zmeur', nume: 'Zmeură' })
    expect(culturaDinText('  ')).toBeNull()
  })

  it('ferma lui Andrei: „Zmeură proaspătă” existentă rămâne cea folosită', () => {
    const produse = [
      { id: 'gem', nume: 'Gem de zmeură', status: 'activ', created_at: '2026-01-01' },
      { id: 'veche', nume: 'Zmeură cal. 2', status: 'activ', created_at: '2025-01-01' },
      { id: 'zp', nume: 'Zmeură proaspătă', status: 'activ', created_at: '2026-02-01' },
    ]
    expect(alegeProdusCultura(produse, zmeura)?.id).toBe('zp')
  })

  it('fără potrivire: niciun produs (se creează „Afine proaspete”)', () => {
    const produse = [{ id: 'zp', nume: 'Zmeură proaspătă', status: 'activ', created_at: null }]
    expect(alegeProdusCultura(produse, afine)).toBeNull()
  })

  it('între mai multe potriviri: activul, apoi cel mai vechi', () => {
    const produse = [
      { id: 'b', nume: 'Afine Bluecrop', status: 'inactiv', created_at: '2025-01-01' },
      { id: 'a', nume: 'Afine la caserolă', status: 'activ', created_at: '2026-01-01' },
    ]
    expect(alegeProdusCultura(produse, afine)?.id).toBe('a')
  })
})
