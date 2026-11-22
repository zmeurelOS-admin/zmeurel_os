import { describe, expect, it } from 'vitest'

import {
  construiesteRaport,
  htmlAfisA4,
  htmlRaportPdf,
  numarMgKg,
  soiuriRaport,
  textAtestat,
  textParceleRaport,
  textPrelevare,
  type IntrareRaport,
} from '@/lib/analize/raport'
import { laboratoareFolosite, optiuniEfective, type AnalizaRow } from '@/lib/analize/model'
import { ordoneazaAnalize, stareAnalizaParcela, textParceleAnaliza, ultimaCuRezultat } from '@/lib/analize/lista'
import { tratamenteInaintePrelevare } from '@/lib/analize/tratamente-inainte'

// Valori „interzise”: nu trebuie să apară niciodată în raport.
const NUMAR_ATESTAT = 'NR-ATESTAT-998877'
const POZA_ATESTAT = 'legal-docs/t1/poza-atestat.png'
const POZA_PV = 't1/pv-secret.jpg'
const NOTA = 'nota internă: inspector Ion Ionescu'
const BULETIN_PATH = 't1/buletin-secret.pdf'

function intrare(analiza: Partial<IntrareRaport['analiza']> = {}, extra: Partial<IntrareRaport> = {}): IntrareRaport {
  return {
    analiza: {
      status: 'conform',
      public_activ: true,
      public_optiuni: null,
      public_token: 'tok_1234567890abcdef',
      data_prelevare: '2026-07-03',
      pv_numar: '1180',
      prelevat_de: 'dsvsa',
      laborator: 'LSVSA Suceava',
      data_predare: '2026-07-03',
      buletin_numar: '4415',
      buletin_data: '2026-07-12',
      buletin_path: BULETIN_PATH,
      ce_s_a_analizat: 'Multireziduu pesticide (520 de substanțe)',
      rest_nedetectate: true,
      ...analiza,
    },
    ferma: { nume: 'Ferma Zmeurel', localitate: 'Văratec, SV' },
    atestat: { serie: 'SV', valabilPana: '2031-07-15' },
    telefon: '0740123456',
    optiuniFerma: null,
    parcele: [
      { nume: 'Maravilla 1', soi: 'Maravilla', cultura: 'Zmeură' },
      { nume: 'Maravilla 2', soi: 'Maravilla', cultura: 'Zmeură' },
    ],
    substante: [
      { substanta: 'Fludioxonil', valoare_mg_kg: 0.05, lmr_mg_kg: 5, ordine: 1 },
      { substanta: 'Ciprodinil', valoare_mg_kg: 0.08, lmr_mg_kg: 10, ordine: 0 },
    ],
    tratamente: [{ key: 'k', zi: '2026-06-24', nume: 'Switch 62.5 WG', parcelaIds: ['m1'], pauzaZile: 7, pauzaPanaLa: '2026-07-01', respectata: true }],
    url: 'https://app.zmeurel.ro/a/tok_1234567890abcdef',
    pozaBuletinUrl: 'https://semnat.example/buletin',
    ...extra,
  }
}

describe('raportul public: există doar pentru conform și link activ', () => {
  it('neconform → null (404)', () => {
    expect(construiesteRaport(intrare({ status: 'neconform' }))).toBeNull()
    expect(construiesteRaport(intrare({ status: 'neconform' }), { previzualizare: true })).toBeNull()
  })
  it('la laborator → null (404)', () => {
    expect(construiesteRaport(intrare({ status: 'la_laborator' }))).toBeNull()
  })
  it('linkul oprit → null public; în aplicație (previzualizare) se vede', () => {
    expect(construiesteRaport(intrare({ public_activ: false }))).toBeNull()
    expect(construiesteRaport(intrare({ public_activ: false }), { previzualizare: true })).not.toBeNull()
  })
})

describe('raportul public: câmpurile interzise nu apar niciodată', () => {
  it('numărul și poza atestatului, poza PV, nota, calea buletinului nu sunt în raport, PDF sau afiș', () => {
    const date = intrare(
      { pv_numar: '1180' },
      // Chiar dacă cineva le-ar strecura în intrare, constructorul nu le copiază.
      { atestat: { serie: 'SV', valabilPana: '2031-07-15', numar: NUMAR_ATESTAT, poza: POZA_ATESTAT } as unknown as IntrareRaport['atestat'] },
    )
    const analiza = date.analiza as unknown as Record<string, unknown>
    analiza.pv_poza_path = POZA_PV
    analiza.nota = NOTA
    const raport = construiesteRaport({ ...date, optiuniFerma: { poza_buletin: true } })
    expect(raport).not.toBeNull()
    const texte = [JSON.stringify(raport), htmlRaportPdf(raport!, '<svg></svg>'), htmlAfisA4(raport!, '<svg></svg>')]
    for (const text of texte) {
      expect(text).not.toContain(NUMAR_ATESTAT)
      expect(text).not.toContain(POZA_ATESTAT)
      expect(text).not.toContain(POZA_PV)
      expect(text).not.toContain('Ionescu')
      expect(text).not.toContain(BULETIN_PATH)
    }
  })

  it('poza buletinului doar cu opțiunea pornită (implicit oprită)', () => {
    expect(construiesteRaport(intrare())!.pozaBuletinUrl).toBeNull()
    expect(construiesteRaport(intrare({ public_optiuni: { poza_buletin: true } }))!.pozaBuletinUrl).toBe('https://semnat.example/buletin')
  })

  it('opțiunile opresc substanțele, tratamentele, numerele și telefonul', () => {
    const r = construiesteRaport(intrare({ public_optiuni: { substante: false, tratamente: false, numere: false, telefon: false } }))!
    expect(r.substante).toBeNull()
    expect(r.tratamente).toBeNull()
    expect(r.prelevare.pv).toBeNull()
    expect(r.buletin.numar).toBeNull()
    expect(r.telefon).toBeNull()
  })

  it('implicitele fermei, apoi suprascrierea pe analiză', () => {
    expect(optiuniEfective({ telefon: false }, null).telefon).toBe(false)
    expect(optiuniEfective({ telefon: false }, { telefon: true }).telefon).toBe(true)
    expect(optiuniEfective({ telefon: 'da' }, null).telefon).toBe(true)
  })
})

describe('conținutul raportului', () => {
  const r = construiesteRaport(intrare())!
  it('atestatul cu seria și valabilitatea, prelevarea, substanțele ordonate', () => {
    expect(textAtestat(r)).toBe('Atestat de producător seria SV · valabil până la 15.07.2031')
    expect(textPrelevare(r)).toBe('Prelevată 3 iulie 2026 (PV nr. 1180, DSVSA) · predată la LSVSA Suceava · buletin nr. 4415 din 12 iulie 2026')
    expect(r.substante?.map((s) => s.substanta)).toEqual(['Ciprodinil', 'Fludioxonil'])
    expect(r.restNedetectate).toBe(true)
    expect(r.soiuri).toEqual(['Zmeură Maravilla'])
    expect(textParceleRaport(r)).toBe('Zmeură Maravilla · parcelele Maravilla 1 și Maravilla 2')
    expect(r.tratamente?.[0]).toEqual({ zi: '2026-06-24', nume: 'Switch 62.5 WG', pauza: 'pauza de 7 zile respectată', respectata: true })
  })
  it('numele intern al fermei nu apare niciodată', () => {
    expect(construiesteRaport(intrare({}, { ferma: { nume: 'tenant_demo_4723a180', localitate: null } }))!.ferma.nume).toBe('Ferma demo')
    expect(construiesteRaport(intrare({}, { ferma: { nume: 'tenant_ab12cd34', localitate: null } }))!.ferma.nume).toBe('Ferma')
    expect(construiesteRaport(intrare({}, { ferma: { nume: null, localitate: null } }))!.ferma.nume).toBe('Ferma')
  })
  it('fără atestat (PFA): rândul lipsește', () => {
    expect(construiesteRaport(intrare({}, { atestat: null }))!.atestat).toBeNull()
  })
  it('textul din HTML e scăpat', () => {
    const rau = construiesteRaport(intrare({ ce_s_a_analizat: '<script>alert(1)</script>' }))!
    expect(htmlRaportPdf(rau, '')).not.toContain('<script>alert')
  })
  it('numerele în mg/kg, fără zerouri inutile', () => {
    expect(numarMgKg(0.08)).toBe('0,08')
    expect(numarMgKg(10)).toBe('10')
    expect(numarMgKg(null)).toBe('—')
  })
})

describe('soiurile din raport: fiecare o singură dată, cu virgulă', () => {
  // Demo-ul din producție: cultura și soiul au același text pe fiecare parcelă.
  const demo = [
    { nume: 'Delniwa Nord', soi: 'Zmeure Delniwa', cultura: 'Zmeure Delniwa' },
    { nume: 'Maravilla', soi: 'Zmeure Maravilla', cultura: 'Zmeure Maravilla' },
  ]
  it('cultura egală cu soiul nu se repetă', () => {
    expect(soiuriRaport(demo)).toEqual(['Zmeure Delniwa', 'Zmeure Maravilla'])
    const r = construiesteRaport(intrare({}, { parcele: demo }))!
    expect(textParceleRaport(r)).toBe('Zmeure Delniwa, Zmeure Maravilla · parcelele Delniwa Nord și Maravilla')
  })
  it('același soi pe mai multe parcele, majuscule și diacritice diferite: o dată', () => {
    expect(
      soiuriRaport([
        { soi: 'Maravilla', cultura: 'Zmeură' },
        { soi: 'maravilla', cultura: 'zmeura' },
        { soi: 'Zmeură Maravilla', cultura: 'Zmeură' },
      ]),
    ).toEqual(['Zmeură Maravilla'])
  })
  it('doar cultura sau doar soiul; nimic → doar parcelele', () => {
    expect(soiuriRaport([{ soi: null, cultura: 'Mure' }, { soi: 'Delniwa', cultura: null }])).toEqual(['Mure', 'Delniwa'])
    const r = construiesteRaport(intrare({}, { parcele: [{ nume: 'P1', soi: null, cultura: null }] }))!
    expect(textParceleRaport(r)).toBe('parcela P1')
  })
  it('PDF-ul și afișul au același rând, fără dublură', () => {
    const r = construiesteRaport(intrare({}, { parcele: demo }))!
    for (const html of [htmlRaportPdf(r, ''), htmlAfisA4(r, '')]) {
      expect(html).toContain('Zmeure Delniwa, Zmeure Maravilla · parcelele Delniwa Nord și Maravilla')
      expect(html.match(/Zmeure Delniwa/g)).toHaveLength(1)
    }
  })
})

describe('lista de analize', () => {
  const nume = new Map([
    ['m1', 'Maravilla 1'],
    ['m2', 'Maravilla 2'],
    ['d', 'DELNIWA'],
  ])
  it('titlul parcelelor', () => {
    expect(textParceleAnaliza(['m1', 'm2'], nume)).toBe('Maravilla 1 + 2')
    expect(textParceleAnaliza(['m1', 'd'], nume)).toBe('Maravilla 1 + DELNIWA')
  })

  const rand = (id: string, status: AnalizaRow['status'], data_prelevare: string, buletin_data: string | null, parcele: string[]): AnalizaRow => ({
    id,
    status,
    data_prelevare,
    buletin_data,
    parcele,
    created_at: '2026-07-01T00:00:00Z',
    updated_at: '2026-07-20T00:00:00Z',
    tenant_id: 't',
    client_sync_id: null,
    pv_numar: null,
    pv_poza_path: null,
    prelevat_de: null,
    laborator: null,
    data_predare: null,
    nota: null,
    buletin_numar: null,
    buletin_path: null,
    ce_s_a_analizat: null,
    rest_nedetectate: null,
    public_token: 'x'.repeat(12),
    public_activ: true,
    public_optiuni: null,
    substante: [],
  })
  const analize = [rand('a', 'conform', '2026-07-03', '2026-07-12', ['m1']), rand('b', 'la_laborator', '2026-07-18', null, ['m1']), rand('c', 'conform', '2025-07-14', '2025-07-25', ['d'])]

  it('cele la laborator sus', () => {
    expect(ordoneazaAnalize(analize).map((a) => a.id)).toEqual(['b', 'a', 'c'])
    expect(ultimaCuRezultat(analize)?.id).toBe('a')
  })
  it('rândul de pe fișa parcelei', () => {
    expect(stareAnalizaParcela(analize, 'm1', '2026')).toMatchObject({ tip: 'rezultat', status: 'conform' })
    expect(stareAnalizaParcela(analize, 'd', '2026')).toEqual({ tip: 'netrimisa' })
  })
  it('laboratoarele folosite, distincte', () => {
    expect(
      laboratoareFolosite([
        { laborator: 'LSVSA Suceava', data_prelevare: '2026-07-01' },
        { laborator: ' lsvsa  suceava ', data_prelevare: '2025-07-01' },
        { laborator: 'Lab Iași', data_prelevare: '2026-07-10' },
        { laborator: null, data_prelevare: '2026-07-11' },
      ]),
    ).toEqual(['Lab Iași', 'LSVSA Suceava'])
  })
})

describe('tratamentele din cele 30 de zile dinainte de prelevare', () => {
  it('doar parcelele analizei, doar fereastra, pauza respectată sau nu, grupate pe lot', () => {
    const produs = (nume: string, phi: number, tip: string) => [{ produs_nume_snapshot: nume, phi_zile_snapshot: phi, tip_snapshot: tip }]
    const t = tratamenteInaintePrelevare({
      dataPrelevare: '2026-07-18',
      parcelaIds: ['d', 'm1'],
      aplicari: [
        { id: '1', parcela_id: 'd', status: 'aplicata', data_aplicata: '2026-07-02T08:00:00Z', metoda_aplicare: 'foliar', lot_id: 'L', produse: produs('Switch 62.5 WG', 7, 'fungicid') },
        { id: '2', parcela_id: 'm1', status: 'aplicata', data_aplicata: '2026-07-02T08:00:00Z', metoda_aplicare: 'foliar', lot_id: 'L', produse: produs('Switch 62.5 WG', 7, 'fungicid') },
        { id: '3', parcela_id: 'd', status: 'aplicata', data_aplicata: '2026-07-10T08:00:00Z', metoda_aplicare: 'fertirigare', produse: [] },
        { id: '4', parcela_id: 'd', status: 'aplicata', data_aplicata: '2026-07-14T08:00:00Z', metoda_aplicare: 'foliar', produse: produs('Karate Zeon', 7, 'insecticid') },
        { id: '5', parcela_id: 'alta', status: 'aplicata', data_aplicata: '2026-07-10T08:00:00Z', metoda_aplicare: 'foliar', produse: [] },
        { id: '6', parcela_id: 'd', status: 'aplicata', data_aplicata: '2026-06-01T08:00:00Z', metoda_aplicare: 'foliar', produse: [] },
        { id: '7', parcela_id: 'd', status: 'planificata', data_aplicata: null, metoda_aplicare: 'foliar', produse: [] },
      ],
      activitati: [{ id: 'v', parcela_id: 'm1', data_aplicare: '2026-07-05', tip_activitate: 'Fungicide/Pesticide', produs_utilizat: 'Topas', timp_pauza_zile: 3 }],
    })
    expect(t.map((x) => [x.nume, x.zi, x.respectata, x.parcelaIds.length])).toEqual([
      ['Karate Zeon', '2026-07-14', false, 1],
      ['Fertirigare', '2026-07-10', true, 1],
      ['Topas', '2026-07-05', true, 1],
      ['Switch 62.5 WG', '2026-07-02', true, 2],
    ])
  })
})

describe('exportul „Analizele sezonului”', () => {
  it('doar perioada aleasă, cu rezultatul și substanțele', async () => {
    const { documentAnalize } = await import('@/lib/analize/export')
    const baza = {
      tenant_id: 't', client_sync_id: null, created_at: '2026-07-01T00:00:00Z', updated_at: '2026-07-20T00:00:00Z', pv_numar: '1180', pv_poza_path: null,
      prelevat_de: 'dsvsa' as const, laborator: 'LSVSA Suceava', data_predare: '2026-07-03', nota: 'secret', buletin_numar: '4415', buletin_path: null,
      ce_s_a_analizat: 'Multireziduu', rest_nedetectate: true, public_token: 'x'.repeat(12), public_activ: true, public_optiuni: null,
    }
    const doc = documentAnalize(
      [
        { ...baza, id: 'a', status: 'conform', data_prelevare: '2026-07-03', buletin_data: '2026-07-12', parcele: ['m1', 'm2'], substante: [{ substanta: 'Ciprodinil', valoare_mg_kg: 0.08, lmr_mg_kg: 10, ordine: 0 }] },
        { ...baza, id: 'b', status: 'la_laborator', data_prelevare: '2025-07-03', buletin_data: null, parcele: ['m1'], substante: [] },
      ],
      new Map([['m1', 'Maravilla 1'], ['m2', 'Maravilla 2']]),
      '2026-01-01',
      '2026-12-31',
    )
    expect(doc.tabele[0].randuri).toHaveLength(1)
    expect(doc.tabele[0].randuri[0]).toEqual(['03.07.2026', 'Maravilla 1, Maravilla 2', '1180', 'DSVSA', 'LSVSA Suceava', '03.07.2026', 'Conform', '4415', '12.07.2026', 'Multireziduu', 'Ciprodinil: 0,08 / 10', 'da'])
  })
})
