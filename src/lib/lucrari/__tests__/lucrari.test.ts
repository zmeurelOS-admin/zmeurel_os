import { describe, expect, it } from 'vitest'

import { construiesteJurnalLucrari, grupeazaLucrari, lucrariPlanificateInZi, type LucrareRow } from '@/lib/lucrari/jurnal'
import { CINE_PROPRIETAR, ceLipsesteLucrare, dataAplicare, randuriLucrareDeSalvat, textCine } from '@/lib/lucrari/formular'
import { tipLucrareDin, tipOriginalPentruAltele } from '@/lib/lucrari/tipuri'

describe('tipLucrareDin — tipurile vechi pe cele 8 noi (doar la afișare)', () => {
  it.each([
    ['Tăiere', 'taiere'],
    ['taieri', 'taiere'],
    ['Tăiere de formare', 'taiere'],
    ['Tăiere lăstari', 'taiere'],
    ['Tundere/Curatare', 'taiere'],
    ['palisat', 'palisare'],
    ['Palisare', 'palisare'],
    ['Prășit', 'prasit'],
    ['Cosire', 'prasit'],
    ['Prășit / cosit', 'prasit'],
    ['irigatie', 'irigatie'],
    ['Irigație', 'irigatie'],
    ['Mulcire', 'mulcire'],
    ['copilit', 'copilit'],
    ['Ciupire/Cârnire', 'copilit'],
    ['legat', 'legat'],
    ['Legat', 'legat'],
    ['Altele', 'altele'],
    ['altele', 'altele'],
    ['Recoltare', 'altele'],
    ['Semănat', 'altele'],
    ['', 'altele'],
  ])('%s → %s', (vechi, nou) => {
    expect(tipLucrareDin(vechi)).toBe(nou)
  })

  it.each(['Fungicide/Pesticide', 'Fertirigare', 'Fertilizare foliară', 'tratament', 'fertigare', 'Stropire', 'Fertilizare de bază', 'Fertilizare'])(
    'tratamentul vechi „%s” nu e lucrare',
    (tip) => {
      expect(tipLucrareDin(tip)).toBeNull()
    },
  )

  it('„Altele” păstrează textul vechi când spune mai mult', () => {
    expect(tipOriginalPentruAltele('Recoltare')).toBe('Recoltare')
    expect(tipOriginalPentruAltele('altele')).toBeNull()
    expect(tipOriginalPentruAltele('Tăiere')).toBeNull()
  })
})

const row = (overrides: Partial<LucrareRow> & Pick<LucrareRow, 'id'>): LucrareRow => ({
  parcela_id: 'p1',
  data_aplicare: '2026-07-14T09:00:00Z',
  tip_activitate: 'Palisare',
  operator: null,
  observatii: null,
  created_at: '2026-07-14T09:00:00Z',
  ...overrides,
})

describe('gruparea jurnalului de lucrări', () => {
  it('pe lot: aceeași lucrare pe două parcele = un rând', () => {
    const jurnal = construiesteJurnalLucrari([
      row({ id: 'a', parcela_id: 'p1', lot_id: 'L1', operator: 'Ana Pavel' }),
      row({ id: 'b', parcela_id: 'p2', lot_id: 'L1', operator: 'Ana Pavel', created_at: '2026-07-14T09:05:00Z' }),
    ])
    expect(jurnal.facute).toHaveLength(1)
    expect(jurnal.facute[0].parcelaIds).toEqual(['p1', 'p2'])
    expect(jurnal.facute[0].cine).toBe('Ana Pavel')
    expect(jurnal.facute[0].key).toBe('lot:L1:facuta')
  })

  it('fără lot: salvate în același minut, aceleași date = un rând; altfel separate', () => {
    const grupuri = grupeazaLucrari([
      row({ id: 'a', parcela_id: 'p1', created_at: '2026-07-14T09:00:00Z' }),
      row({ id: 'b', parcela_id: 'p2', created_at: '2026-07-14T09:00:20Z' }),
      // peste un minut: altă salvare
      row({ id: 'c', parcela_id: 'p3', created_at: '2026-07-14T09:03:00Z' }),
      // alt „cine”: altă lucrare
      row({ id: 'd', parcela_id: 'p4', operator: 'Ion', created_at: '2026-07-14T09:00:10Z' }),
      // aceeași parcelă de două ori nu se unește
      row({ id: 'e', parcela_id: 'p1', created_at: '2026-07-14T09:00:30Z' }),
    ])
    const ids = grupuri.map((grup) => grup.map((item) => item.id).sort().join(','))
    expect(ids).toContain('a,b')
    expect(ids).toContain('c')
    expect(ids).toContain('d')
    expect(ids).toContain('e')
  })

  it('tratamentele vechi nu apar în Lucrări', () => {
    const jurnal = construiesteJurnalLucrari([row({ id: 'a', tip_activitate: 'Fungicide/Pesticide' }), row({ id: 'b', tip_activitate: 'copilit' })])
    expect(jurnal.facute.map((rand) => rand.tip)).toEqual(['copilit'])
  })

  it('planificatele: separate, de la cea mai apropiată; „De făcut azi” ia doar ziua', () => {
    const jurnal = construiesteJurnalLucrari([
      row({ id: 'a', status: 'planificata', data_aplicare: '2026-07-20T12:00:00Z', lot_id: 'L1' }),
      row({ id: 'b', status: 'planificata', data_aplicare: '2026-07-16T12:00:00Z', lot_id: 'L2' }),
      row({ id: 'c', status: 'facuta', data_aplicare: '2026-07-10T12:00:00Z' }),
      row({ id: 'd', status: null, data_aplicare: '2026-07-11T12:00:00Z' }),
    ])
    expect(jurnal.planificate.map((rand) => rand.zi)).toEqual(['2026-07-16', '2026-07-20'])
    expect(jurnal.facute.map((rand) => rand.zi)).toEqual(['2026-07-11', '2026-07-10'])
    expect(lucrariPlanificateInZi(jurnal.planificate, '2026-07-16')).toHaveLength(1)
  })

  it('ziua e în ora României (22:30 UTC = ziua următoare)', () => {
    const jurnal = construiesteJurnalLucrari([row({ id: 'a', data_aplicare: '2026-07-14T22:30:00Z' })])
    expect(jurnal.facute[0].zi).toBe('2026-07-15')
  })
})

describe('formularul de lucrare', () => {
  const chei = new Map([
    ['p1', 'k1'],
    ['p2', 'k2'],
  ])

  it('un rând pe parcelă, fiecare cu cheia lui, același lot', () => {
    const rows = randuriLucrareDeSalvat({
      ciorna: { tip: 'palisare', parcelaIds: ['p1', 'p2'], cine: ' Ana Pavel ', nota: '' },
      cand: { tip: 'azi' },
      chei,
      lotId: 'L1',
      cuMigrare: true,
      now: new Date('2026-07-14T09:00:00Z'),
    })
    expect(rows).toEqual([
      expect.objectContaining({ client_sync_id: 'k1', parcela_id: 'p1', tip_activitate: 'Palisare', operator: 'Ana Pavel', observatii: null, status: null, lot_id: 'L1', data_aplicare: '2026-07-14T09:00:00.000Z' }),
      expect.objectContaining({ client_sync_id: 'k2', parcela_id: 'p2', lot_id: 'L1' }),
    ])
  })

  it('fără migrare: nu trimite status / lot și nu planifică', () => {
    const [rand] = randuriLucrareDeSalvat({ ciorna: { tip: 'copilit', parcelaIds: ['p1'], cine: '', nota: 'rândul 3' }, cand: { tip: 'alta_zi', zi: '2026-07-10' }, chei, lotId: 'L1', cuMigrare: false })
    expect(rand).not.toHaveProperty('status')
    expect(rand).not.toHaveProperty('lot_id')
    expect(rand.data_aplicare).toBe('2026-07-10T12:00:00.000Z')
    expect(rand.observatii).toBe('rândul 3')
    expect(randuriLucrareDeSalvat({ ciorna: { tip: 'copilit', parcelaIds: ['p1'], cine: '', nota: '' }, cand: { tip: 'planifica', zi: '2026-07-20' }, chei, lotId: 'L1', cuMigrare: false })).toEqual([])
  })

  it('planificată: status și ziua', () => {
    const [rand] = randuriLucrareDeSalvat({ ciorna: { tip: 'irigatie', parcelaIds: ['p1'], cine: '', nota: '' }, cand: { tip: 'planifica', zi: '2026-07-20' }, chei, lotId: 'L1', cuMigrare: true })
    expect(rand.status).toBe('planificata')
    expect(rand.data_aplicare).toBe('2026-07-20T12:00:00.000Z')
  })

  it('ce lipsește, ziua salvată, „Tu”', () => {
    expect(ceLipsesteLucrare({ tip: null, parcelaIds: [], cine: '', nota: '' })).toBe('tip')
    expect(ceLipsesteLucrare({ tip: 'legat', parcelaIds: [], cine: '', nota: '' })).toBe('parcele')
    expect(ceLipsesteLucrare({ tip: 'legat', parcelaIds: ['p1'], cine: '', nota: '' })).toBeNull()
    expect(dataAplicare({ tip: 'alta_zi', zi: '2026-01-05' })).toBe('2026-01-05T12:00:00.000Z')
    expect(textCine(CINE_PROPRIETAR, true)).toBe('Tu')
    expect(textCine(CINE_PROPRIETAR, false)).toBe('Proprietarul')
    expect(textCine('  ', true)).toBeNull()
  })
})
