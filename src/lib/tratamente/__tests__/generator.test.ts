import { detectDuplicates } from '@/lib/tratamente/generator/deduplication'
import { matchLiniiCuStadii } from '@/lib/tratamente/generator/stadiu-matcher'
import type {
  AplicareExistenta,
  LinieCuData,
  PlanLinie,
  StadiuInregistrat,
} from '@/lib/tratamente/generator/types'

const linii: PlanLinie[] = [
  {
    id: 'l1',
    planId: 'plan-1',
    ordine: 1,
    stadiuTrigger: 'buton_verde',
    cohortTrigger: null,
    produsId: 'p1',
    produsNumeManual: null,
    dozaMlPerHl: 150,
    dozaLPerHa: null,
    observatii: 'Cupru la pornire',
  },
  {
    id: 'l2',
    planId: 'plan-1',
    ordine: 2,
    stadiuTrigger: 'inflorit',
    cohortTrigger: null,
    produsId: 'p2',
    produsNumeManual: null,
    dozaMlPerHl: null,
    dozaLPerHa: 1,
    observatii: null,
  },
  {
    id: 'l3',
    planId: 'plan-1',
    ordine: 3,
    stadiuTrigger: 'parga',
    cohortTrigger: null,
    produsId: null,
    produsNumeManual: 'Fertilizant foliar',
    dozaMlPerHl: 250,
    dozaLPerHa: null,
    observatii: 'Doar înainte de colorare',
  },
]

const stadii: StadiuInregistrat[] = [
  {
    id: 's1',
    parcelaId: 'parcela-1',
    an: 2026,
    stadiu: 'buton_verde',
    cohort: null,
    dataObservata: '2026-04-10',
    sursa: 'manual',
  },
  {
    id: 's2',
    parcelaId: 'parcela-1',
    an: 2026,
    stadiu: 'inflorit',
    cohort: null,
    dataObservata: '2026-05-01',
    sursa: 'manual',
  },
]

// TODO: integration test cu mock Supabase pentru genereazaAplicariPentruParcela.

describe('generator helpers', () => {
  describe('matchLiniiCuStadii', () => {
    it('potrivește doar liniile pentru stadiile deja atinse', () => {
      const rezultate = matchLiniiCuStadii(linii, stadii, {
        isRubusMixt: false,
        stadiuFloricane: null,
        stadiuPrimocane: null,
        stadiu: 'inflorit',
      })

      expect(rezultate).toHaveLength(1)
      expect(rezultate.map((item) => item.id)).toEqual(['l2'])
    })

    it('filtrează doar stadiul cerut când stadiuFiltru este setat', () => {
      const rezultate = matchLiniiCuStadii(linii, stadii, {
        isRubusMixt: false,
        stadiuFloricane: null,
        stadiuPrimocane: null,
        stadiu: 'inflorit',
      })

      expect(rezultate).toHaveLength(1)
      expect(rezultate[0]?.id).toBe('l2')
      expect(rezultate[0]?.stadiuTrigger).toBe('inflorit')
    })

    it('aplică offset-ul în zile peste data stadiului', () => {
      const rezultate = matchLiniiCuStadii([linii[0]!], [stadii[0]!], {
        isRubusMixt: false,
        stadiuFloricane: null,
        stadiuPrimocane: null,
        stadiu: 'buton_verde',
      }, 3)

      expect(rezultate[0]?.dataPlanificata).toBe('2026-04-13')
    })

    it('normalizează aliasurile legacy înainte de comparație', () => {
      const rezultate = matchLiniiCuStadii(
        [{ ...linii[1]!, stadiuTrigger: 'prefloral' }],
        [{ ...stadii[1]!, stadiu: 'Înflorit' }],
        {
          isRubusMixt: false,
          stadiuFloricane: null,
          stadiuPrimocane: null,
          stadiu: 'inflorit',
        }
      )

      expect(rezultate).toHaveLength(0)

      const potrivireLegacy = matchLiniiCuStadii(
        [{ ...linii[0]!, stadiuTrigger: 'prefloral' }],
        [{ ...stadii[0]!, stadiu: 'Buton roz', dataObservata: '2026-04-10' }],
        {
          isRubusMixt: false,
          stadiuFloricane: null,
          stadiuPrimocane: null,
          stadiu: 'buton_roz',
        }
      )

      expect(potrivireLegacy).toHaveLength(1)
      expect(potrivireLegacy[0]?.stadiuTrigger).toBe('buton_roz')
    })

    it('alege cea mai veche înregistrare când același stadiu apare de mai multe ori', () => {
      const rezultate = matchLiniiCuStadii(
        [linii[0]!],
        [
          { ...stadii[0]!, id: 's-nou', dataObservata: '2026-04-12', sursa: 'manual' },
          { ...stadii[0]!, id: 's-vechi', dataObservata: '2026-04-08', sursa: 'gdd' },
        ],
        {
          isRubusMixt: false,
          stadiuFloricane: null,
          stadiuPrimocane: null,
          stadiu: 'buton_verde',
        }
      )

      expect(rezultate[0]?.dataPlanificata).toBe('2026-04-08')
    })

    it('exclude liniile pentru stadii care nu au fost încă atinse', () => {
      const rezultate = matchLiniiCuStadii([linii[2]!], stadii, {
        isRubusMixt: false,
        stadiuFloricane: null,
        stadiuPrimocane: null,
        stadiu: 'inflorit',
      })

      expect(rezultate).toEqual([])
    })
  })

  describe('detectDuplicates', () => {
    const liniiCuData: LinieCuData[] = [
      { ...linii[0]!, dataPlanificata: '2026-04-10', cohortLaAplicare: null },
      { ...linii[1]!, dataPlanificata: '2026-05-01', cohortLaAplicare: null },
    ]

    it('marchează duplicatele când există aplicări planificate sau aplicate pe aceeași linie', () => {
      const aplicari: AplicareExistenta[] = [
        { id: 'a1', planLinieId: 'l1', status: 'planificata' },
        { id: 'a2', planLinieId: 'l2', status: 'aplicata' },
      ]

      const rezultat = detectDuplicates(liniiCuData, aplicari)

      expect(rezultat.noi).toEqual([])
      expect(rezultat.duplicate.map((linie) => linie.id)).toEqual(['l1', 'l2'])
    })

    it('tratează aplicările reprogramate ca duplicate active', () => {
      const aplicari: AplicareExistenta[] = [
        { id: 'a-reprogramata', planLinieId: 'l1', status: 'reprogramata' },
      ]

      const rezultat = detectDuplicates(liniiCuData, aplicari)

      expect(rezultat.noi.map((linie) => linie.id)).toEqual(['l2'])
      expect(rezultat.duplicate.map((linie) => linie.id)).toEqual(['l1'])
    })

    it('nu tratează aplicările anulate ca duplicate', () => {
      const aplicari: AplicareExistenta[] = [
        { id: 'a-anulata', planLinieId: 'l1', status: 'anulata' },
      ]

      const rezultat = detectDuplicates(liniiCuData, aplicari)

      expect(rezultat.noi.map((linie) => linie.id)).toEqual(['l1', 'l2'])
      expect(rezultat.duplicate).toEqual([])
    })

    it('tratează toate liniile ca noi când nu există aplicări anterioare', () => {
      const rezultat = detectDuplicates(liniiCuData, [])

      expect(rezultat.noi.map((linie) => linie.id)).toEqual(['l1', 'l2'])
      expect(rezultat.duplicate).toEqual([])
    })
  })
})
