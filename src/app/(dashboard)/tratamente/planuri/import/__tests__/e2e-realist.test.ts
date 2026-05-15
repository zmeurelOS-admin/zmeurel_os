import { describe, expect, it } from 'vitest'
import * as XLSX from 'xlsx'

import type { ProdusFitosanitar } from '@/lib/supabase/queries/tratamente'
import { generateTratamentTemplateWorkbook } from '@/lib/tratamente/import/template-generator'
import { parseImportedPlansWorkbook } from '@/lib/tratamente/import/parse-workbook'

function makeProdus(
  id: string,
  numeComercial: string,
  substantaActiva: string,
  tip: ProdusFitosanitar['tip'],
  fracIrac: string | null,
  phiZile: number | null
): ProdusFitosanitar {
  return {
    id,
    tenant_id: null,
    nume_comercial: numeComercial,
    substanta_activa: substantaActiva,
    tip,
    frac_irac: fracIrac,
    doza_min_ml_per_hl: null,
    doza_max_ml_per_hl: null,
    doza_min_l_per_ha: null,
    doza_max_l_per_ha: null,
    phi_zile: phiZile,
    nr_max_aplicari_per_sezon: null,
    interval_min_aplicari_zile: null,
    omologat_culturi: ['zmeur', 'capsun'],
    activ: true,
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
    created_by: null,
  }
}

const produseMock: ProdusFitosanitar[] = [
  makeProdus('prod-01', 'Switch 62.5 WG', 'ciprodinil + fludioxonil', 'fungicid', 'FRAC 9 + 12', 3),
  makeProdus('prod-02', 'Signum', 'boscalid + piraclostrobin', 'fungicid', 'FRAC 7 + 11', 3),
  makeProdus('prod-03', 'Teldor 500 SC', 'fenhexamid', 'fungicid', 'FRAC 17', 1),
  makeProdus('prod-04', 'Mospilan 20 SG', 'acetamiprid', 'insecticid', 'IRAC 4A', 3),
]

async function bufferToArrayBuffer(buffer: Buffer): Promise<ArrayBuffer> {
  return new Blob([new Uint8Array(buffer)]).arrayBuffer()
}

describe('parseImportedPlansWorkbook e2e V3 realist', () => {
  it(
    'parsează template-ul oficial V3 cu produse inline',
    async () => {
      const templateBuffer = await generateTratamentTemplateWorkbook()
      const workbook = XLSX.read(templateBuffer, { type: 'buffer' })

      expect(workbook.SheetNames).toContain('Interventii')
      expect(workbook.SheetNames).toContain('Instructiuni')
      expect(workbook.SheetNames).not.toContain('Produse interventii')

      const sheet = workbook.Sheets.Interventii
      if (!sheet) {
        throw new Error('Foaia Interventii lipsește din template.')
      }

      XLSX.utils.sheet_add_aoa(
        sheet,
        [
          [
            'buton_verde',
            'protectie',
            'Protecție preventivă',
            'Switch 62.5 WG',
            '1 kg/ha',
            '',
            '',
            '',
            '',
            '',
            '',
            'o singura data',
            '',
            'ambele',
            'risc Botrytis',
            'primul tratament',
          ],
          [
            'inflorit',
            'protectie',
            'Protecție înflorit',
            'Signum',
            '1.5 kg/ha',
            'Produs foliar nou',
            '1.5g/pl/sapt',
            '',
            '',
            '',
            '',
            'saptamanal',
            '',
            'floricane',
            '',
            'linie cu produs nou',
          ],
        ],
        { origin: 'A3' }
      )

      const finalBuffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' })
      const parseResult = await parseImportedPlansWorkbook(
        await bufferToArrayBuffer(Buffer.from(finalBuffer)),
        produseMock
      )

      expect(parseResult.global_errors).toHaveLength(0)
      expect(parseResult.planuri).toHaveLength(1)

      const plan = parseResult.planuri[0]
      expect(plan?.foaie_nume).toBe('Interventii')
      expect(plan?.plan_metadata.nume_sugerat).toBe('Plan de tratamente')
      expect(plan?.plan_metadata.cultura_tip_detectat).toBe('zmeur')
      expect(plan?.linii).toHaveLength(2)
      expect(plan?.linii[0]?.produse).toHaveLength(1)
      expect(plan?.linii[0]?.cohort_trigger).toBeNull()
      expect(plan?.linii[1]?.cohort_trigger).toBe('floricane')
      expect(plan?.linii[1]?.regula_repetare).toBe('interval')
      expect(plan?.linii[1]?.interval_repetare_zile).toBe(7)
      expect(plan?.linii[1]?.produse).toHaveLength(2)
      expect(plan?.linii[0]?.produse[0]?.produs_match.tip).toBe('exact')
      expect(plan?.linii[1]?.produse[0]?.produs_match.tip).toBe('exact')
      expect(plan?.linii[1]?.produse[1]?.produs_match.tip).toBe('none')
      expect(plan?.linii[1]?.produse[1]?.salveaza_in_biblioteca).toBe(true)
      expect(plan?.linii[1]?.produse[1]?.observatii).toBe('1.5g/pl/sapt')
      expect(plan?.linii[1]?.produse[1]?.doza_ml_per_hl).toBeNull()
      expect(plan?.linii[1]?.produse[1]?.doza_l_per_ha).toBeNull()
    },
    30_000
  )
})
