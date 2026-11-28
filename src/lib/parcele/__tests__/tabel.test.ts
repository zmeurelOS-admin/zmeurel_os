import { describe, expect, it } from 'vitest'

import type { LucrareRow } from '@/lib/lucrari/jurnal'
import { ordoneazaParcele, ultimaLucrarePeParcela } from '@/lib/parcele/tabel'

const lucrare = (id: string, parcela: string, data: string, tip = 'tăiere', status: string | null = 'facuta', lot: string | null = null): LucrareRow => ({
  id,
  parcela_id: parcela,
  data_aplicare: `${data}T08:00:00Z`,
  tip_activitate: tip,
  operator: null,
  observatii: null,
  created_at: `${data}T09:00:00Z`,
  status,
  lot_id: lot,
})

describe('tabelul parcelelor (promptul 35, §6)', () => {
  it('ultima lucrare făcută pe fiecare parcelă; cele planificate nu contează', () => {
    const ultima = ultimaLucrarePeParcela(
      [
        lucrare('1', 'p1', '2026-11-10'),
        lucrare('2', 'p1', '2026-11-20'),
        lucrare('3', 'p2', '2026-11-05'),
        lucrare('4', 'p2', '2026-12-20', 'tăiere', 'planificata'),
      ],
      '2026-11-28',
    )
    expect(ultima.get('p1')?.zi).toBe('2026-11-20')
    expect(ultima.get('p2')?.zi).toBe('2026-11-05')
    expect(ultima.has('p3')).toBe(false)
  })

  it('comercialele întâi, apoi după nume, cu numerele în ordine firească', () => {
    const parcele = [
      { nume_parcela: 'Maravilla 10', rol: 'comercial' },
      { nume_parcela: 'Grădina', rol: 'personal' },
      { nume_parcela: 'Maravilla 2', rol: 'comercial' },
    ]
    expect(ordoneazaParcele(parcele, (p) => p.rol === 'personal').map((p) => p.nume_parcela)).toEqual(['Maravilla 2', 'Maravilla 10', 'Grădina'])
  })
})
