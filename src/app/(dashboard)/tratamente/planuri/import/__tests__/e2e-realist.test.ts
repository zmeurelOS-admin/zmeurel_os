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
  phiZile: number | null,
  dozaMinMl: number | null,
  dozaMaxMl: number | null,
  dozaMinL: number | null,
  dozaMaxL: number | null
): ProdusFitosanitar {
  return {
    id,
    tenant_id: null,
    nume_comercial: numeComercial,
    substanta_activa: substantaActiva,
    tip,
    frac_irac: fracIrac,
    doza_min_ml_per_hl: dozaMinMl,
    doza_max_ml_per_hl: dozaMaxMl,
    doza_min_l_per_ha: dozaMinL,
    doza_max_l_per_ha: dozaMaxL,
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
  makeProdus('prod-01', 'Switch 62.5 WG', 'ciprodinil 375 g/kg + fludioxonil 250 g/kg', 'fungicid', 'FRAC 9 + 12', 3, null, null, 1, 1),
  makeProdus('prod-02', 'Signum', 'boscalid 267 g/kg + piraclostrobin 67 g/kg', 'fungicid', 'FRAC 7 + 11', 3, null, null, 1.5, 1.5),
  makeProdus('prod-03', 'Luna Sensation', 'fluopyram 250 g/l + trifloxistrobin 250 g/l', 'fungicid', 'FRAC 7 + 11', 3, null, null, 0.8, 0.8),
  makeProdus('prod-04', 'Teldor 500 SC', 'fenhexamid 500 g/l', 'fungicid', 'FRAC 17', 1, null, null, 1.5, 1.5),
  makeProdus('prod-05', 'Topas 100 EC', 'penconazol 100 g/l', 'fungicid', 'FRAC 3', 14, null, null, 0.5, 0.5),
  makeProdus('prod-06', 'Thiovit Jet', 'sulf 800 g/kg', 'fungicid', 'FRAC M02', 3, null, null, 4, 4),
  makeProdus('prod-07', 'Kocide 2000', 'hidroxid de cupru', 'fungicid', 'FRAC M01', 3, null, null, 2.5, 2.5),
  makeProdus('prod-08', 'Karate Zeon', 'lambda-cihalotrin 50 g/l', 'insecticid', 'IRAC 3A', 7, 15, 20, 0.15, 0.2),
  makeProdus('prod-09', 'Mospilan 20 SG', 'acetamiprid 200 g/kg', 'insecticid', 'IRAC 4A', 3, null, null, 0.2, 0.25),
  makeProdus('prod-10', 'Movento 100 SC', 'spirotetramat 100 g/l', 'insecticid', 'IRAC 23', 7, null, null, 1.5, 1.875),
  makeProdus('prod-11', 'Vertimec 018 EC', 'abamectin 18 g/l', 'insecticid', 'IRAC 6', 3, 75, 100, 0.75, 1),
  makeProdus('prod-12', 'Nissorun 10 WP', 'hexythiazox 100 g/kg', 'acaricid', 'IRAC 10A', 28, null, null, 0.4, 0.5),
  makeProdus('prod-13', 'Milbeknock EC', 'milbemectin 10 g/l', 'acaricid', 'IRAC 6', 3, 50, 75, 0.5, 0.75),
  makeProdus('prod-14', 'Cropmax', 'extract vegetal + macro si microelemente', 'foliar', null, 0, 300, 500, 2, 3),
  makeProdus('prod-15', 'Razormin', 'aminoacizi + macro si microelemente', 'bioregulator', null, 0, 250, 300, 2, 3),
  makeProdus('prod-16', 'Kelpak', 'extract de alge Ecklonia maxima', 'bioregulator', null, 0, 250, 300, 2, 3),
]

async function bufferToArrayBuffer(buffer: Buffer): Promise<ArrayBuffer> {
  return new Blob([new Uint8Array(buffer)]).arrayBuffer()
}

describe('parseImportedPlansWorkbook e2e realist', () => {
  it(
    'parsează o copie realistă a foii Exemplu zmeur și ignoră foaia Plan goală',
    async () => {
      const templateBuffer = await generateTratamentTemplateWorkbook(produseMock)
      const workbook = XLSX.read(templateBuffer, { type: 'buffer' })

      const exampleSheet = workbook.Sheets['Exemplu zmeur']
      if (!exampleSheet) {
        throw new Error('Foaia „Exemplu zmeur” lipsește din template.')
      }

      const clonedSheet = JSON.parse(JSON.stringify(exampleSheet)) as XLSX.WorkSheet
      clonedSheet.B1 = { t: 's', v: 'Zmeur' }
      clonedSheet.B2 = { t: 's', v: 'Test e2e' }
      clonedSheet.D6 = { t: 's', v: 'Mospilan typo' }
      clonedSheet.C7 = { t: 's', v: 'floricane' }
      clonedSheet.D7 = { t: 's', v: 'Signum' }

      workbook.SheetNames.push('Zmeur 2026')
      workbook.Sheets['Zmeur 2026'] = clonedSheet

      const finalBuffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' })
      const finalArrayBuffer = await bufferToArrayBuffer(Buffer.from(finalBuffer))
      const sheetJsWorkbook = XLSX.read(finalBuffer, { type: 'buffer' })
      const sheetJsWorkbookFromArray = XLSX.read(finalArrayBuffer, { type: 'array' })
      const parseResult = await parseImportedPlansWorkbook(
        finalArrayBuffer,
        produseMock
      )

      expect(sheetJsWorkbook.SheetNames).toContain('Zmeur 2026')
      expect(sheetJsWorkbookFromArray.SheetNames).toContain('Zmeur 2026')
      expect(parseResult.planuri.length).toBe(1)
      const plan = parseResult.planuri[0]
      expect(plan?.foaie_nume).toBe('Zmeur 2026')
      expect(plan?.plan_metadata.cultura_tip_detectat).toBe('zmeur')
      expect(plan?.plan_metadata.descriere).toBe('Test e2e')
      expect(plan?.linii.length).toBe(4)
      expect(plan?.linii[0]?.produs_match.tip).toBe('exact')
      expect(['fuzzy', 'none']).toContain(plan?.linii[1]?.produs_match.tip)
      expect(plan?.linii[2]?.cohort_trigger).toBe('floricane')
      expect(plan?.linii[2]?.produs_match.tip).toBe('exact')
      expect(plan?.linii[3]?.produs_match.tip).toBe('exact')
      expect(parseResult.global_errors).toContain(
        'Foaia «Plan» a fost lăsată goală și a fost ignorată.'
      )
    },
    30_000
  )
})
