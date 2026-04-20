import { describe, expect, it } from 'vitest'
import * as XLSX from 'xlsx'

import type { ProdusFitosanitar } from '@/lib/supabase/queries/tratamente'
import { parseImportedPlansWorkbook } from '@/lib/tratamente/import/parse-workbook'
import {
  IMPORT_XLSX_MIME_TYPES,
  MAX_IMPORT_XLSX_BYTES,
  validateImportFileMeta,
} from '@/lib/tratamente/import/validate-upload'

type WorkbookSheet = {
  name: string
  cultura?: string
  descriere?: string
  rows?: Array<[number | string, string, string, number | string, number | string, string]>
}

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
  makeProdus('prod-teldor', 'Teldor 500 SC', 'fenhexamid'),
]

function bufferToArrayBuffer(buffer: Buffer): ArrayBuffer {
  return buffer.buffer.slice(
    buffer.byteOffset,
    buffer.byteOffset + buffer.byteLength
  ) as ArrayBuffer
}

function buildTestWorkbook(sheets: WorkbookSheet[]): Buffer {
  const workbook = XLSX.utils.book_new()

  sheets.forEach((sheet) => {
    const data = [
      ['Cultură', sheet.cultura ?? ''],
      ['Descriere', sheet.descriere ?? ''],
      [],
      ['Ordine', 'Stadiu', 'Produs', 'Doză ml/hl', 'Doză l/ha', 'Observații'],
      ...(sheet.rows ?? []),
    ]

    const worksheet = XLSX.utils.aoa_to_sheet(data)
    XLSX.utils.book_append_sheet(workbook, worksheet, sheet.name)
  })

  const arrayBuffer = XLSX.write(workbook, {
    type: 'array',
    bookType: 'xlsx',
  }) as ArrayBuffer

  return Buffer.from(arrayBuffer)
}

describe('parseImportedPlansWorkbook', () => {
  it('parsează un fișier valid cu o singură foaie și 4 linii', async () => {
    const buffer = buildTestWorkbook([
      {
        name: 'Zmeur 2026',
        cultura: 'Zmeur',
        descriere: 'Plan complet',
        rows: [
          [1, 'Umflare muguri', 'Kumulus S', 500, '', 'Prevenție făinare'],
          [2, 'Prefloral', 'Mospilan 20 SG', 20, '', 'Afide'],
          [3, 'Cădere petale', 'Signum', 50, '', 'Botrytis'],
          [4, 'Pârguire', 'Kocide 2000', '', 3, 'PHI 3 zile'],
        ],
      },
    ])

    const result = await parseImportedPlansWorkbook(
      bufferToArrayBuffer(buffer),
      TEST_PRODUSE
    )

    expect(result.global_errors).toHaveLength(0)
    expect(result.planuri).toHaveLength(1)
    expect(result.planuri[0]?.linii).toHaveLength(4)
    expect(result.planuri[0]?.errors).toHaveLength(0)
  })

  it('detectează două foi valide ca două planuri', async () => {
    const buffer = buildTestWorkbook([
      {
        name: 'Zmeur 2026',
        cultura: 'Zmeur',
        rows: [[1, 'Umflare muguri', 'Kumulus S', 500, '', '']],
      },
      {
        name: 'Căpșun 2026',
        cultura: 'Căpșun',
        rows: [[1, 'Prefloral', 'Signum', 50, '', '']],
      },
    ])

    const result = await parseImportedPlansWorkbook(
      bufferToArrayBuffer(buffer),
      TEST_PRODUSE
    )

    expect(result.planuri).toHaveLength(2)
  })

  it('ignoră foile rezervate', async () => {
    const buffer = buildTestWorkbook([
      { name: 'Instructions' },
      { name: 'Stadii valide' },
      { name: 'Culturi acceptate' },
      { name: 'Produse standard' },
      { name: 'Exemplu zmeur' },
    ])

    const result = await parseImportedPlansWorkbook(
      bufferToArrayBuffer(buffer),
      TEST_PRODUSE
    )

    expect(result.planuri).toHaveLength(0)
    expect(result.global_errors[0]).toContain('nicio foaie')
  })

  it('marchează stadiul invalid ca eroare de linie', async () => {
    const buffer = buildTestWorkbook([
      {
        name: 'Plan invalid',
        cultura: 'Zmeur',
        rows: [[1, 'Inflorire eronat', 'Kumulus S', 500, '', '']],
      },
    ])

    const result = await parseImportedPlansWorkbook(
      bufferToArrayBuffer(buffer),
      TEST_PRODUSE
    )

    expect(result.planuri[0]?.linii[0]?.errors).toContain(
      'Stadiul nu este valid. Folosește una dintre valorile din template.'
    )
  })

  it('mapează stadiul scris fără diacritice', async () => {
    const buffer = buildTestWorkbook([
      {
        name: 'Plan fara diacritice',
        cultura: 'Zmeur',
        rows: [[1, 'Inflorire', 'Kumulus S', 500, '', '']],
      },
    ])

    const result = await parseImportedPlansWorkbook(
      bufferToArrayBuffer(buffer),
      TEST_PRODUSE
    )

    expect(result.planuri[0]?.linii[0]?.stadiu_trigger).toBe('inflorit')
  })

  it('mapează stadiul scris cu diacritice', async () => {
    const buffer = buildTestWorkbook([
      {
        name: 'Plan cu diacritice',
        cultura: 'Zmeur',
        rows: [[1, 'Înflorire', 'Kumulus S', 500, '', '']],
      },
    ])

    const result = await parseImportedPlansWorkbook(
      bufferToArrayBuffer(buffer),
      TEST_PRODUSE
    )

    expect(result.planuri[0]?.linii[0]?.stadiu_trigger).toBe('inflorit')
  })

  it('acceptă direct codul canonic în fișierul nou', async () => {
    const buffer = buildTestWorkbook([
      {
        name: 'Plan canonic',
        cultura: 'Zmeur',
        rows: [[1, 'scuturare_petale', 'Signum', 50, '', '']],
      },
    ])

    const result = await parseImportedPlansWorkbook(
      bufferToArrayBuffer(buffer),
      TEST_PRODUSE
    )

    expect(result.planuri[0]?.linii[0]?.stadiu_trigger).toBe('scuturare_petale')
  })

  it('acceptă aliasurile legacy și le normalizează la codul canonic', async () => {
    const buffer = buildTestWorkbook([
      {
        name: 'Plan legacy',
        cultura: 'Zmeur',
        rows: [[1, 'Prefloral', 'Signum', 50, '', '']],
      },
    ])

    const result = await parseImportedPlansWorkbook(
      bufferToArrayBuffer(buffer),
      TEST_PRODUSE
    )

    expect(result.planuri[0]?.linii[0]?.stadiu_trigger).toBe('buton_roz')
  })

  it('acceptă stadiile noi pentru culturi compatibile, inclusiv roșii cu răsad', async () => {
    const buffer = buildTestWorkbook([
      {
        name: 'Rosii solar',
        cultura: 'Rosii',
        rows: [[1, 'Răsad', 'Signum', 50, '', '']],
      },
    ])

    const result = await parseImportedPlansWorkbook(
      bufferToArrayBuffer(buffer),
      TEST_PRODUSE
    )

    expect(result.planuri[0]?.plan_metadata.cultura_tip_detectat).toBe('rosie')
    expect(result.planuri[0]?.linii[0]?.stadiu_trigger).toBe('rasad')
    expect(result.planuri[0]?.linii[0]?.warnings).not.toContain(
      'Stadiul nu este tipic pentru cultura detectată în această foaie. Verifică profilul biologic înainte de import.'
    )
  })

  it('avertizează, dar nu blochează, când stadiul nu este tipic pentru cultura detectată', async () => {
    const buffer = buildTestWorkbook([
      {
        name: 'Zmeur cu rasad',
        cultura: 'Zmeura',
        rows: [[1, 'rasad', 'Signum', 50, '', '']],
      },
    ])

    const result = await parseImportedPlansWorkbook(
      bufferToArrayBuffer(buffer),
      TEST_PRODUSE
    )

    expect(result.planuri[0]?.linii[0]?.errors).toHaveLength(0)
    expect(result.planuri[0]?.linii[0]?.stadiu_trigger).toBe('rasad')
    expect(result.planuri[0]?.linii[0]?.warnings).toContain(
      'Stadiul nu este tipic pentru cultura detectată în această foaie. Verifică profilul biologic înainte de import.'
    )
  })

  it('semnalează eroare când ambele doze sunt completate', async () => {
    const buffer = buildTestWorkbook([
      {
        name: 'Doze duble',
        cultura: 'Zmeur',
        rows: [[1, 'Prefloral', 'Signum', 50, 1, '']],
      },
    ])

    const result = await parseImportedPlansWorkbook(
      bufferToArrayBuffer(buffer),
      TEST_PRODUSE
    )

    expect(result.planuri[0]?.linii[0]?.errors).toContain(
      'Completează exact una dintre doze: ml/hl sau l/ha.'
    )
  })

  it('semnalează eroare când ambele doze lipsesc', async () => {
    const buffer = buildTestWorkbook([
      {
        name: 'Fara doze',
        cultura: 'Zmeur',
        rows: [[1, 'Prefloral', 'Signum', '', '', '']],
      },
    ])

    const result = await parseImportedPlansWorkbook(
      bufferToArrayBuffer(buffer),
      TEST_PRODUSE
    )

    expect(result.planuri[0]?.linii[0]?.errors).toContain(
      'Completează exact una dintre doze: ml/hl sau l/ha.'
    )
  })

  it('semnalează doza negativă ca eroare', async () => {
    const buffer = buildTestWorkbook([
      {
        name: 'Doza negativa',
        cultura: 'Zmeur',
        rows: [[1, 'Prefloral', 'Signum', -10, '', '']],
      },
    ])

    const result = await parseImportedPlansWorkbook(
      bufferToArrayBuffer(buffer),
      TEST_PRODUSE
    )

    expect(result.planuri[0]?.linii[0]?.errors).toContain(
      'Doza nu poate fi negativă.'
    )
  })

  it('semnalează produsul gol ca eroare', async () => {
    const buffer = buildTestWorkbook([
      {
        name: 'Produs lipsa',
        cultura: 'Zmeur',
        rows: [[1, 'Prefloral', '', 50, '', '']],
      },
    ])

    const result = await parseImportedPlansWorkbook(
      bufferToArrayBuffer(buffer),
      TEST_PRODUSE
    )

    expect(result.planuri[0]?.linii[0]?.errors).toContain(
      'Produsul este obligatoriu.'
    )
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

  it('lasă cultura null când B1 nu este valid', async () => {
    const buffer = buildTestWorkbook([
      {
        name: 'Cultura invalida',
        cultura: 'Rubarba',
        rows: [[1, 'Prefloral', 'Signum', 50, '', '']],
      },
    ])

    const result = await parseImportedPlansWorkbook(
      bufferToArrayBuffer(buffer),
      TEST_PRODUSE
    )

    expect(result.planuri[0]?.plan_metadata.cultura_tip_detectat).toBeNull()
  })

  it('lasă cultura null când B1 este gol', async () => {
    const buffer = buildTestWorkbook([
      {
        name: 'Cultura goala',
        rows: [[1, 'Prefloral', 'Signum', 50, '', '']],
      },
    ])

    const result = await parseImportedPlansWorkbook(
      bufferToArrayBuffer(buffer),
      TEST_PRODUSE
    )

    expect(result.planuri[0]?.plan_metadata.cultura_tip_detectat).toBeNull()
  })

  it('parsează corect o doză numerică brută din celulă', async () => {
    const buffer = buildTestWorkbook([
      {
        name: 'Doza numar brut',
        cultura: 'Zmeur',
        rows: [[1, 'Prefloral', 'Signum', 1500, '', '']],
      },
    ])

    const result = await parseImportedPlansWorkbook(
      bufferToArrayBuffer(buffer),
      TEST_PRODUSE
    )

    expect(result.planuri[0]?.linii[0]?.doza_ml_per_hl).toBe(1500)
  })

  it('marchează textul de tip 1.500 ca doză invalidă', async () => {
    const buffer = buildTestWorkbook([
      {
        name: 'Doza text ambigua',
        cultura: 'Zmeur',
        rows: [[1, 'Prefloral', 'Signum', '1.500', '', '']],
      },
    ])

    const result = await parseImportedPlansWorkbook(
      bufferToArrayBuffer(buffer),
      TEST_PRODUSE
    )

    expect(result.planuri[0]?.linii[0]?.errors).toContain(
      'Doza trebuie să fie un număr valid. Valorile text de tip „1.500” nu sunt acceptate.'
    )
  })
})
