import { describe, expect, it } from 'vitest'
import * as XLSX from 'xlsx'

import type { ProdusFitosanitar } from '@/lib/supabase/queries/tratamente'
import { parseImportedPlansWorkbook } from '@/lib/tratamente/import/parse-workbook'
import {
  IMPORT_XLSX_MIME_TYPES,
  MAX_IMPORT_XLSX_BYTES,
  validateImportFileMeta,
} from '@/lib/tratamente/import/validate-upload'

function makeProdus(
  id: string,
  numeComercial: string,
  substantaActiva: string
): ProdusFitosanitar {
  return {
    id,
    tenant_id: null,
    nume_comercial: numeComercial,
    substanta_activa: substantaActiva,
    tip: 'fungicid',
    frac_irac: null,
    doza_min_ml_per_hl: null,
    doza_max_ml_per_hl: null,
    doza_min_l_per_ha: null,
    doza_max_l_per_ha: null,
    phi_zile: 3,
    nr_max_aplicari_per_sezon: null,
    interval_min_aplicari_zile: null,
    omologat_culturi: ['zmeur'],
    activ: true,
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
    created_by: null,
  }
}

const TEST_PRODUSE: ProdusFitosanitar[] = [
  makeProdus('prod-kumulus', 'Kumulus S', 'sulf'),
  makeProdus('prod-mospilan', 'Mospilan 20 SG', 'acetamiprid'),
  makeProdus('prod-signum', 'Signum', 'boscalid + piraclostrobin'),
  makeProdus('prod-kocide', 'Kocide 2000', 'hidroxid de cupru'),
]

function bufferToArrayBuffer(buffer: Buffer): ArrayBuffer {
  return buffer.buffer.slice(
    buffer.byteOffset,
    buffer.byteOffset + buffer.byteLength
  ) as ArrayBuffer
}

function buildV3Workbook(rows: unknown[][]): Buffer {
  const workbook = XLSX.utils.book_new()
  const data = [
    ['Template import plan tratament V3'],
    [
      'Fenofază',
      'Tip intervenție',
      'Titlu intervenție',
      'Produs 1',
      'Doză produs 1',
      'Produs 2',
      'Doză produs 2',
      'Produs 3',
      'Doză produs 3',
      'Produs 4',
      'Doză produs 4',
      'Repetare',
      'Interval zile',
      'Cohortă zmeur',
      'Prag decizional',
      'Observații',
    ],
    ...rows,
  ]

  XLSX.utils.book_append_sheet(
    workbook,
    XLSX.utils.aoa_to_sheet(data),
    'Interventii'
  )
  XLSX.utils.book_append_sheet(
    workbook,
    XLSX.utils.aoa_to_sheet([['Instrucțiuni']]),
    'Instructiuni'
  )

  const arrayBuffer = XLSX.write(workbook, {
    type: 'array',
    bookType: 'xlsx',
  }) as ArrayBuffer

  return Buffer.from(arrayBuffer)
}

describe('parseImportedPlansWorkbook V3', () => {
  it('parsează un rând complet cu toate coloanele V3', async () => {
    const buffer = buildV3Workbook([
      [
        'Buton verde',
        'Protectie',
        'Protecție preventivă',
        'Kumulus S',
        '500 g/ha',
        'Mospilan 20 SG',
        '20 g/hl',
        'Produs nou',
        '1.5g/pl/sapt',
        'Signum',
        '0.8 kg/ha',
        'interval',
        10,
        'floricane',
        'risc făinare',
        'aplicare dimineața',
      ],
    ])

    const result = await parseImportedPlansWorkbook(
      bufferToArrayBuffer(buffer),
      TEST_PRODUSE
    )

    expect(result.global_errors).toHaveLength(0)
    expect(result.planuri).toHaveLength(1)
    expect(result.planuri[0]?.foaie_nume).toBe('Interventii')
    expect(result.planuri[0]?.plan_metadata.nume_sugerat).toBe('Plan de tratamente')
    expect(result.planuri[0]?.plan_metadata.cultura_tip_detectat).toBe('zmeur')

    const line = result.planuri[0]?.linii[0]
    expect(line?.interventie_key).toBe('v3-row-3')
    expect(line?.ordine).toBe(1)
    expect(line?.stadiu_trigger).toBe('buton_verde')
    expect(line?.tip_interventie).toBe('protectie')
    expect(line?.scop).toBe('Protecție preventivă')
    expect(line?.regula_repetare).toBe('interval')
    expect(line?.interval_repetare_zile).toBe(10)
    expect(line?.cohort_trigger).toBe('floricane')
    expect(line?.observatii).toBe('risc făinare | aplicare dimineața')
    expect(line?.produse).toHaveLength(4)
    expect(line?.produse[2]?.produs_input).toBe('Produs nou')
    expect(line?.produse[2]?.observatii).toBe('1.5g/pl/sapt')
    expect(line?.produse[2]?.doza_ml_per_hl).toBeNull()
    expect(line?.produse[2]?.doza_l_per_ha).toBeNull()
    expect(line?.produse[2]?.salveaza_in_biblioteca).toBe(true)
  })

  it('parsează un rând minim cu fenofază, tip, titlu și produs 1', async () => {
    const buffer = buildV3Workbook([
      ['Inflorit', 'protectie', 'Botrytis', 'Signum'],
    ])

    const result = await parseImportedPlansWorkbook(
      bufferToArrayBuffer(buffer),
      TEST_PRODUSE
    )

    const line = result.planuri[0]?.linii[0]
    expect(line?.stadiu_trigger).toBe('inflorit')
    expect(line?.tip_interventie).toBe('protectie')
    expect(line?.scop).toBe('Botrytis')
    expect(line?.regula_repetare).toBe('fara_repetare')
    expect(line?.interval_repetare_zile).toBeNull()
    expect(line?.produse).toHaveLength(1)
    expect(line?.produse[0]?.produs_match.tip).toBe('exact')
  })

  it('păstrează rândul de monitorizare fără produs real', async () => {
    const buffer = buildV3Workbook([
      ['Legare fruct', 'monitorizare', 'Verificare dăunători', '— fara produs'],
    ])

    const result = await parseImportedPlansWorkbook(
      bufferToArrayBuffer(buffer),
      TEST_PRODUSE
    )

    const line = result.planuri[0]?.linii[0]
    expect(line?.stadiu_trigger).toBe('legare_fruct')
    expect(line?.produse).toHaveLength(0)
    expect(line?.errors).toHaveLength(0)
    expect(line?.warnings).toContain('Rândul 3: niciun produs pe această intervenție.')
  })

  it('mapează saptamanal la interval de 7 zile', async () => {
    const buffer = buildV3Workbook([
      ['Pârga', 'nutritie', 'Nutriție fruct', 'Kumulus S', '2 kg/ha', '', '', '', '', '', '', 'saptamanal'],
    ])

    const result = await parseImportedPlansWorkbook(
      bufferToArrayBuffer(buffer),
      TEST_PRODUSE
    )

    const line = result.planuri[0]?.linii[0]
    expect(line?.regula_repetare).toBe('interval')
    expect(line?.interval_repetare_zile).toBe(7)
  })

  it('mapează la 14 zile la interval de 14 zile', async () => {
    const buffer = buildV3Workbook([
      ['Post recoltare', 'igiena', 'Curățare', 'Kocide 2000', '2 kg/ha', '', '', '', '', '', '', 'la 14 zile'],
    ])

    const result = await parseImportedPlansWorkbook(
      bufferToArrayBuffer(buffer),
      TEST_PRODUSE
    )

    const line = result.planuri[0]?.linii[0]
    expect(line?.stadiu_trigger).toBe('post_recoltare')
    expect(line?.regula_repetare).toBe('interval')
    expect(line?.interval_repetare_zile).toBe(14)
  })

  it('mapează cohorta ambele la null', async () => {
    const buffer = buildV3Workbook([
      ['Maturitate', 'protectie', 'Protecție finală', 'Signum', '', '', '', '', '', '', '', '', '', 'ambele'],
    ])

    const result = await parseImportedPlansWorkbook(
      bufferToArrayBuffer(buffer),
      TEST_PRODUSE
    )

    expect(result.planuri[0]?.linii[0]?.cohort_trigger).toBeNull()
  })

  it('ignoră rândurile fără fenofază și raportează warning global', async () => {
    const buffer = buildV3Workbook([
      ['', 'protectie', 'Intervenție fără fenofază', 'Signum'],
      ['Buton verde', 'protectie', 'Intervenție validă', 'Signum'],
    ])

    const result = await parseImportedPlansWorkbook(
      bufferToArrayBuffer(buffer),
      TEST_PRODUSE
    )

    expect(result.planuri[0]?.linii).toHaveLength(1)
    expect(result.global_errors).toContain('Rândul 3: fenofaza lipsă, ignorat.')
  })

  it('refuză fișierul mai mare de 2 MB la validarea de upload', () => {
    const validation = validateImportFileMeta({
      fileName: 'plan.xlsx',
      mimeType: Array.from(IMPORT_XLSX_MIME_TYPES)[0],
      size: MAX_IMPORT_XLSX_BYTES + 1,
    })

    expect(validation).toContain('2 MB')
  })

  it('refuză extensia non-xlsx', () => {
    const validation = validateImportFileMeta({
      fileName: 'plan.pdf',
      mimeType: 'application/pdf',
      size: 1024,
    })

    expect(validation).toContain('.xlsx')
  })
})
