import type { TablesInsert } from '@/types/supabase'

type DemoInsert<TableName extends keyof import('@/types/supabase').Database['public']['Tables']> =
  TablesInsert<TableName> & Record<string, unknown>

type TratamenteDemoColumnSupport = {
  aplicari_tratament?: boolean
  configurari_parcela_sezon?: boolean
  parcele_planuri?: boolean
  planuri_tratament?: boolean
  planuri_tratament_linii?: boolean
  stadii_fenologice_parcela?: boolean
}

type ProductName =
  | 'Kocide 2000'
  | 'Topas 100 EC'
  | 'Switch 62.5 WG'
  | 'Karate Zeon'
  | 'Thiovit Jet'
  | 'Luna Sensation'
  | 'Movento 100 SC'
  | 'Teldor 500 SC'

export const DEMO_TRATAMENTE_PRODUCT_NAMES: ProductName[] = [
  'Kocide 2000',
  'Topas 100 EC',
  'Switch 62.5 WG',
  'Karate Zeon',
  'Thiovit Jet',
  'Luna Sensation',
  'Movento 100 SC',
  'Teldor 500 SC',
]

export const DEMO_TRATAMENTE_FIXED_IDS = {
  planuri: {
    zmeur: '6d01d8fd-4af7-4d88-a2aa-3e8b5d9fa101',
    capsun: '6d01d8fd-4af7-4d88-a2aa-3e8b5d9fa102',
  },
  configurari: {
    mixt: '6d01d8fd-4af7-4d88-a2aa-3e8b5d9fa701',
    primocane: '6d01d8fd-4af7-4d88-a2aa-3e8b5d9fa702',
    neutru: '6d01d8fd-4af7-4d88-a2aa-3e8b5d9fa703',
  },
  linii: {
    zmeur: [
      '6d01d8fd-4af7-4d88-a2aa-3e8b5d9fa201',
      '6d01d8fd-4af7-4d88-a2aa-3e8b5d9fa202',
      '6d01d8fd-4af7-4d88-a2aa-3e8b5d9fa203',
      '6d01d8fd-4af7-4d88-a2aa-3e8b5d9fa204',
      '6d01d8fd-4af7-4d88-a2aa-3e8b5d9fa205',
      '6d01d8fd-4af7-4d88-a2aa-3e8b5d9fa206',
      '6d01d8fd-4af7-4d88-a2aa-3e8b5d9fa207',
      '6d01d8fd-4af7-4d88-a2aa-3e8b5d9fa208',
    ],
    capsun: [
      '6d01d8fd-4af7-4d88-a2aa-3e8b5d9fa301',
      '6d01d8fd-4af7-4d88-a2aa-3e8b5d9fa302',
      '6d01d8fd-4af7-4d88-a2aa-3e8b5d9fa303',
      '6d01d8fd-4af7-4d88-a2aa-3e8b5d9fa304',
      '6d01d8fd-4af7-4d88-a2aa-3e8b5d9fa305',
    ],
  },
  asignari: {
    zmeur: '6d01d8fd-4af7-4d88-a2aa-3e8b5d9fa401',
  },
  stadii: [
    '6d01d8fd-4af7-4d88-a2aa-3e8b5d9fa501',
    '6d01d8fd-4af7-4d88-a2aa-3e8b5d9fa502',
    '6d01d8fd-4af7-4d88-a2aa-3e8b5d9fa503',
  ],
  aplicari: [
    '6d01d8fd-4af7-4d88-a2aa-3e8b5d9fa601',
    '6d01d8fd-4af7-4d88-a2aa-3e8b5d9fa602',
    '6d01d8fd-4af7-4d88-a2aa-3e8b5d9fa603',
    '6d01d8fd-4af7-4d88-a2aa-3e8b5d9fa604',
    '6d01d8fd-4af7-4d88-a2aa-3e8b5d9fa605',
  ],
} as const

type DemoTreatmentTable =
  | 'aplicari_tratament'
  | 'configurari_parcela_sezon'
  | 'parcele_planuri'
  | 'planuri_tratament'
  | 'planuri_tratament_linii'
  | 'stadii_fenologice_parcela'

export function isDemoTratamenteFallbackRow(
  table: DemoTreatmentTable,
  row: Record<string, unknown>
): boolean {
  const id = String(row.id ?? '')
  const demoLineIds = [
    ...DEMO_TRATAMENTE_FIXED_IDS.linii.zmeur,
    ...DEMO_TRATAMENTE_FIXED_IDS.linii.capsun,
  ] as readonly string[]
  const demoStadiiIds = [...DEMO_TRATAMENTE_FIXED_IDS.stadii] as readonly string[]
  const demoAplicariIds = [...DEMO_TRATAMENTE_FIXED_IDS.aplicari] as readonly string[]

  switch (table) {
    case 'planuri_tratament':
      return (
        id === DEMO_TRATAMENTE_FIXED_IDS.planuri.zmeur ||
        id === DEMO_TRATAMENTE_FIXED_IDS.planuri.capsun ||
        String(row.nume ?? '').includes('— Demo')
      )
    case 'planuri_tratament_linii':
      return demoLineIds.includes(id)
    case 'parcele_planuri':
      return id === DEMO_TRATAMENTE_FIXED_IDS.asignari.zmeur
    case 'configurari_parcela_sezon':
      return (
        id === DEMO_TRATAMENTE_FIXED_IDS.configurari.mixt ||
        id === DEMO_TRATAMENTE_FIXED_IDS.configurari.primocane ||
        id === DEMO_TRATAMENTE_FIXED_IDS.configurari.neutru
      )
    case 'stadii_fenologice_parcela':
      return demoStadiiIds.includes(id)
    case 'aplicari_tratament':
      return demoAplicariIds.includes(id)
    default:
      return false
  }
}

function withOptionalDemoSeedId<Row extends Record<string, unknown> & { demo_seed_id?: string | null }>(
  row: Row,
  includeDemoSeedId: boolean,
  seedId: string | null | undefined
): Row {
  if (includeDemoSeedId && seedId) {
    row.demo_seed_id = seedId
  }

  return row
}

function meteoSnapshot(timestamp: string) {
  return {
    timestamp,
    temperatura_c: 15,
    umiditate_pct: 65,
    vant_kmh: 8,
    precipitatii_mm_24h: 0,
    descriere: 'Cer variabil',
  }
}

function normalizeSearchText(value: string | null | undefined): string {
  return (value ?? '').trim().toLowerCase()
}

function buildConfigurariSezonDemoRows(params: {
  tenantId: string
  parcelaId: string
  parcelaMeta?: {
    cultura?: string | null
    soi?: string | null
    soi_plantat?: string | null
    tip_fruct?: string | null
  } | null
}): Array<DemoInsert<'configurari_parcela_sezon'>> {
  const meta = params.parcelaMeta ?? {}
  const soiValues = [meta.soi_plantat, meta.soi]
    .map((value) => normalizeSearchText(value))
    .filter(Boolean)

  const sistemConducere = soiValues.some((value) => value.includes('maravilla'))
    ? 'mixt_floricane_primocane'
    : soiValues.some((value) => value.includes('delniwa'))
      ? 'primocane_only'
      : null

  return [
    {
      id: sistemConducere === 'mixt_floricane_primocane'
        ? DEMO_TRATAMENTE_FIXED_IDS.configurari.mixt
        : sistemConducere === 'primocane_only'
          ? DEMO_TRATAMENTE_FIXED_IDS.configurari.primocane
          : DEMO_TRATAMENTE_FIXED_IDS.configurari.neutru,
      tenant_id: params.tenantId,
      parcela_id: params.parcelaId,
      an: 2026,
      sistem_conducere: sistemConducere,
      tip_ciclu_soi: null,
    },
  ]
}

export function buildDemoTratamenteFixture(params: {
  tenantId: string
  parcelaId: string
  produseByName: Record<ProductName, string>
  seedId?: string | null
  parcelaMeta?: {
    cultura?: string | null
    soi?: string | null
    soi_plantat?: string | null
    tip_fruct?: string | null
  } | null
  supportDemoColumns?: TratamenteDemoColumnSupport
}): {
  planuri: Array<DemoInsert<'planuri_tratament'>>
  linii: Array<DemoInsert<'planuri_tratament_linii'>>
  asignari: Array<DemoInsert<'parcele_planuri'>>
  configurariSezon: Array<DemoInsert<'configurari_parcela_sezon'>>
  stadii: Array<DemoInsert<'stadii_fenologice_parcela'>>
  aplicari: Array<DemoInsert<'aplicari_tratament'>>
  summary: {
    configurariSezon: number
    aplicari: number
    asignari: number
    linii: number
    planuri: number
    stadii: number
  }
} {
  const support = params.supportDemoColumns ?? {}
  const commonPlanFields = {
    tenant_id: params.tenantId,
    activ: true,
    arhivat: false,
    created_by: null,
    updated_by: null,
  } as const
  const soiValues = [params.parcelaMeta?.soi_plantat, params.parcelaMeta?.soi]
    .map((value) => normalizeSearchText(value))
    .filter(Boolean)
  const isRubusMixtDemo = soiValues.some((value) => value.includes('maravilla'))

  const planuri: Array<DemoInsert<'planuri_tratament'>> = [
    withOptionalDemoSeedId(
      {
        id: DEMO_TRATAMENTE_FIXED_IDS.planuri.zmeur,
        ...commonPlanFields,
        nume: 'Plan Maravilla 2026 — Demo',
        cultura_tip: 'zmeur',
        descriere: 'Seed demo tratamente pentru zmeur.',
      },
      support.planuri_tratament === true,
      params.seedId
    ),
    withOptionalDemoSeedId(
      {
        id: DEMO_TRATAMENTE_FIXED_IDS.planuri.capsun,
        ...commonPlanFields,
        nume: 'Plan Căpșun Primăvară — Demo',
        cultura_tip: 'capsun',
        descriere: 'Seed demo tratamente pentru căpșun.',
      },
      support.planuri_tratament === true,
      params.seedId
    ),
  ]

  const linii: Array<DemoInsert<'planuri_tratament_linii'>> = [
    {
      id: DEMO_TRATAMENTE_FIXED_IDS.linii.zmeur[0],
      tenant_id: params.tenantId,
      plan_id: DEMO_TRATAMENTE_FIXED_IDS.planuri.zmeur,
      ordine: 1,
      stadiu_trigger: 'repaus_vegetativ',
      cohort_trigger: null,
      produs_id: params.produseByName['Kocide 2000'],
      produs_nume_manual: null,
      doza_ml_per_hl: null,
      doza_l_per_ha: 3,
      observatii: 'PHI 7 zile',
    },
    {
      id: DEMO_TRATAMENTE_FIXED_IDS.linii.zmeur[1],
      tenant_id: params.tenantId,
      plan_id: DEMO_TRATAMENTE_FIXED_IDS.planuri.zmeur,
      ordine: 2,
      stadiu_trigger: 'umflare_muguri',
      cohort_trigger: null,
      produs_id: params.produseByName['Topas 100 EC'],
      produs_nume_manual: null,
      doza_ml_per_hl: 500,
      doza_l_per_ha: null,
      observatii: null,
    },
    {
      id: DEMO_TRATAMENTE_FIXED_IDS.linii.zmeur[2],
      tenant_id: params.tenantId,
      plan_id: DEMO_TRATAMENTE_FIXED_IDS.planuri.zmeur,
      ordine: 3,
      stadiu_trigger: 'buton_verde',
      cohort_trigger: null,
      produs_id: params.produseByName['Switch 62.5 WG'],
      produs_nume_manual: null,
      doza_ml_per_hl: 80,
      doza_l_per_ha: null,
      observatii: 'Doză demo pentru 100 L',
    },
    {
      id: DEMO_TRATAMENTE_FIXED_IDS.linii.zmeur[3],
      tenant_id: params.tenantId,
      plan_id: DEMO_TRATAMENTE_FIXED_IDS.planuri.zmeur,
      ordine: 4,
      stadiu_trigger: 'buton_verde',
      cohort_trigger: null,
      produs_id: params.produseByName['Karate Zeon'],
      produs_nume_manual: null,
      doza_ml_per_hl: 150,
      doza_l_per_ha: null,
      observatii: null,
    },
    {
      id: DEMO_TRATAMENTE_FIXED_IDS.linii.zmeur[4],
      tenant_id: params.tenantId,
      plan_id: DEMO_TRATAMENTE_FIXED_IDS.planuri.zmeur,
      ordine: 5,
      stadiu_trigger: 'inflorit',
      cohort_trigger: isRubusMixtDemo ? 'floricane' : null,
      produs_id: params.produseByName['Thiovit Jet'],
      produs_nume_manual: null,
      doza_ml_per_hl: null,
      doza_l_per_ha: 3,
      observatii: 'Doză demo 3 kg/ha',
    },
    {
      id: DEMO_TRATAMENTE_FIXED_IDS.linii.zmeur[5],
      tenant_id: params.tenantId,
      plan_id: DEMO_TRATAMENTE_FIXED_IDS.planuri.zmeur,
      ordine: 6,
      stadiu_trigger: isRubusMixtDemo ? 'crestere_vegetativa' : 'scuturare_petale',
      cohort_trigger: isRubusMixtDemo ? 'primocane' : null,
      produs_id: params.produseByName['Luna Sensation'],
      produs_nume_manual: null,
      doza_ml_per_hl: 750,
      doza_l_per_ha: null,
      observatii: null,
    },
    {
      id: DEMO_TRATAMENTE_FIXED_IDS.linii.zmeur[6],
      tenant_id: params.tenantId,
      plan_id: DEMO_TRATAMENTE_FIXED_IDS.planuri.zmeur,
      ordine: 7,
      stadiu_trigger: 'fruct_verde',
      cohort_trigger: null,
      produs_id: params.produseByName['Movento 100 SC'],
      produs_nume_manual: null,
      doza_ml_per_hl: 500,
      doza_l_per_ha: null,
      observatii: null,
    },
    {
      id: DEMO_TRATAMENTE_FIXED_IDS.linii.zmeur[7],
      tenant_id: params.tenantId,
      plan_id: DEMO_TRATAMENTE_FIXED_IDS.planuri.zmeur,
      ordine: 8,
      stadiu_trigger: 'parga',
      cohort_trigger: null,
      produs_id: params.produseByName['Teldor 500 SC'],
      produs_nume_manual: null,
      doza_ml_per_hl: 1000,
      doza_l_per_ha: null,
      observatii: 'Doză demo 1 L/hl',
    },
    {
      id: DEMO_TRATAMENTE_FIXED_IDS.linii.capsun[0],
      tenant_id: params.tenantId,
      plan_id: DEMO_TRATAMENTE_FIXED_IDS.planuri.capsun,
      ordine: 1,
      stadiu_trigger: 'repaus_vegetativ',
      cohort_trigger: null,
      produs_id: params.produseByName['Kocide 2000'],
      produs_nume_manual: null,
      doza_ml_per_hl: null,
      doza_l_per_ha: 3,
      observatii: null,
    },
    {
      id: DEMO_TRATAMENTE_FIXED_IDS.linii.capsun[1],
      tenant_id: params.tenantId,
      plan_id: DEMO_TRATAMENTE_FIXED_IDS.planuri.capsun,
      ordine: 2,
      stadiu_trigger: 'buton_verde',
      cohort_trigger: null,
      produs_id: params.produseByName['Switch 62.5 WG'],
      produs_nume_manual: null,
      doza_ml_per_hl: 80,
      doza_l_per_ha: null,
      observatii: null,
    },
    {
      id: DEMO_TRATAMENTE_FIXED_IDS.linii.capsun[2],
      tenant_id: params.tenantId,
      plan_id: DEMO_TRATAMENTE_FIXED_IDS.planuri.capsun,
      ordine: 3,
      stadiu_trigger: 'inflorit',
      cohort_trigger: null,
      produs_id: params.produseByName['Thiovit Jet'],
      produs_nume_manual: null,
      doza_ml_per_hl: null,
      doza_l_per_ha: 3,
      observatii: null,
    },
    {
      id: DEMO_TRATAMENTE_FIXED_IDS.linii.capsun[3],
      tenant_id: params.tenantId,
      plan_id: DEMO_TRATAMENTE_FIXED_IDS.planuri.capsun,
      ordine: 4,
      stadiu_trigger: 'fruct_verde',
      cohort_trigger: null,
      produs_id: params.produseByName['Luna Sensation'],
      produs_nume_manual: null,
      doza_ml_per_hl: 750,
      doza_l_per_ha: null,
      observatii: null,
    },
    {
      id: DEMO_TRATAMENTE_FIXED_IDS.linii.capsun[4],
      tenant_id: params.tenantId,
      plan_id: DEMO_TRATAMENTE_FIXED_IDS.planuri.capsun,
      ordine: 5,
      stadiu_trigger: 'parga',
      cohort_trigger: null,
      produs_id: params.produseByName['Teldor 500 SC'],
      produs_nume_manual: null,
      doza_ml_per_hl: 1000,
      doza_l_per_ha: null,
      observatii: null,
    },
  ].map((row) =>
    withOptionalDemoSeedId(row, support.planuri_tratament_linii === true, params.seedId)
  )

  const asignari: Array<DemoInsert<'parcele_planuri'>> = [
    withOptionalDemoSeedId(
      {
        id: DEMO_TRATAMENTE_FIXED_IDS.asignari.zmeur,
        tenant_id: params.tenantId,
        parcela_id: params.parcelaId,
        plan_id: DEMO_TRATAMENTE_FIXED_IDS.planuri.zmeur,
        an: 2026,
        activ: true,
      },
      support.parcele_planuri === true,
      params.seedId
    ),
  ]

  const configurariSezon = buildConfigurariSezonDemoRows({
    tenantId: params.tenantId,
    parcelaId: params.parcelaId,
    parcelaMeta: params.parcelaMeta,
  })

  const stadii: Array<DemoInsert<'stadii_fenologice_parcela'>> = [
    ...(isRubusMixtDemo
      ? [
          {
            id: DEMO_TRATAMENTE_FIXED_IDS.stadii[0],
            tenant_id: params.tenantId,
            parcela_id: params.parcelaId,
            an: 2026,
            stadiu: 'inflorit',
            cohort: 'floricane',
            data_observata: '2026-05-18',
            sursa: 'manual',
            observatii: null,
            created_by: null,
          },
          {
            id: DEMO_TRATAMENTE_FIXED_IDS.stadii[1],
            tenant_id: params.tenantId,
            parcela_id: params.parcelaId,
            an: 2026,
            stadiu: 'crestere_vegetativa',
            cohort: 'primocane',
            data_observata: '2026-05-18',
            sursa: 'manual',
            observatii: null,
            created_by: null,
          },
        ]
      : [
          {
            id: DEMO_TRATAMENTE_FIXED_IDS.stadii[0],
            tenant_id: params.tenantId,
            parcela_id: params.parcelaId,
            an: 2026,
            stadiu: 'repaus_vegetativ',
            cohort: null,
            data_observata: '2026-02-15',
            sursa: 'manual',
            observatii: null,
            created_by: null,
          },
          {
            id: DEMO_TRATAMENTE_FIXED_IDS.stadii[1],
            tenant_id: params.tenantId,
            parcela_id: params.parcelaId,
            an: 2026,
            stadiu: 'umflare_muguri',
            cohort: null,
            data_observata: '2026-03-20',
            sursa: 'manual',
            observatii: null,
            created_by: null,
          },
          {
            id: DEMO_TRATAMENTE_FIXED_IDS.stadii[2],
            tenant_id: params.tenantId,
            parcela_id: params.parcelaId,
            an: 2026,
            stadiu: 'buton_verde',
            cohort: null,
            data_observata: '2026-04-10',
            sursa: 'manual',
            observatii: null,
            created_by: null,
          },
        ]),
  ].map((row) =>
    withOptionalDemoSeedId(row, support.stadii_fenologice_parcela === true, params.seedId)
  )

  const aplicari: Array<DemoInsert<'aplicari_tratament'>> = [
    {
      id: DEMO_TRATAMENTE_FIXED_IDS.aplicari[0],
      tenant_id: params.tenantId,
      parcela_id: params.parcelaId,
      cultura_id: null,
      plan_linie_id: DEMO_TRATAMENTE_FIXED_IDS.linii.zmeur[0],
      produs_id: params.produseByName['Kocide 2000'],
      produs_nume_manual: null,
      data_planificata: '2026-02-15',
      data_aplicata: '2026-02-15T08:00:00.000Z',
      doza_ml_per_hl: null,
      doza_l_per_ha: 3,
      cantitate_totala_ml: 1500,
      stoc_mutatie_id: null,
      status: 'aplicata',
      meteo_snapshot: meteoSnapshot('2026-02-15T08:00:00.000Z'),
      stadiu_la_aplicare: 'repaus_vegetativ',
      cohort_la_aplicare: null,
      observatii: 'Aplicare demo efectuată.',
      operator: 'Operator demo',
      created_by: null,
      updated_by: null,
    },
    {
      id: DEMO_TRATAMENTE_FIXED_IDS.aplicari[1],
      tenant_id: params.tenantId,
      parcela_id: params.parcelaId,
      cultura_id: null,
      plan_linie_id: DEMO_TRATAMENTE_FIXED_IDS.linii.zmeur[1],
      produs_id: params.produseByName['Topas 100 EC'],
      produs_nume_manual: null,
      data_planificata: '2026-03-20',
      data_aplicata: '2026-03-20T09:00:00.000Z',
      doza_ml_per_hl: 500,
      doza_l_per_ha: null,
      cantitate_totala_ml: 2500,
      stoc_mutatie_id: null,
      status: 'aplicata',
      meteo_snapshot: meteoSnapshot('2026-03-20T09:00:00.000Z'),
      stadiu_la_aplicare: 'umflare_muguri',
      cohort_la_aplicare: null,
      observatii: 'Aplicare demo efectuată.',
      operator: 'Operator demo',
      created_by: null,
      updated_by: null,
    },
    {
      id: DEMO_TRATAMENTE_FIXED_IDS.aplicari[2],
      tenant_id: params.tenantId,
      parcela_id: params.parcelaId,
      cultura_id: null,
      plan_linie_id: DEMO_TRATAMENTE_FIXED_IDS.linii.zmeur[2],
      produs_id: params.produseByName['Switch 62.5 WG'],
      produs_nume_manual: null,
      data_planificata: '2026-04-10',
      data_aplicata: '2026-04-10T07:30:00.000Z',
      doza_ml_per_hl: 80,
      doza_l_per_ha: null,
      cantitate_totala_ml: 400,
      stoc_mutatie_id: null,
      status: 'aplicata',
      meteo_snapshot: meteoSnapshot('2026-04-10T07:30:00.000Z'),
      stadiu_la_aplicare: 'buton_verde',
      cohort_la_aplicare: null,
      observatii: 'Aplicare demo efectuată.',
      operator: 'Operator demo',
      created_by: null,
      updated_by: null,
    },
    {
      id: DEMO_TRATAMENTE_FIXED_IDS.aplicari[3],
      tenant_id: params.tenantId,
      parcela_id: params.parcelaId,
      cultura_id: null,
      plan_linie_id: isRubusMixtDemo ? DEMO_TRATAMENTE_FIXED_IDS.linii.zmeur[5] : DEMO_TRATAMENTE_FIXED_IDS.linii.zmeur[3],
      produs_id: isRubusMixtDemo ? params.produseByName['Luna Sensation'] : params.produseByName['Karate Zeon'],
      produs_nume_manual: null,
      data_planificata: '2026-04-18',
      data_aplicata: null,
      doza_ml_per_hl: isRubusMixtDemo ? 750 : 150,
      doza_l_per_ha: null,
      cantitate_totala_ml: null,
      stoc_mutatie_id: null,
      status: 'planificata',
      meteo_snapshot: null,
      stadiu_la_aplicare: isRubusMixtDemo ? 'crestere_vegetativa' : null,
      cohort_la_aplicare: isRubusMixtDemo ? 'primocane' : null,
      observatii: isRubusMixtDemo ? 'Aplicare demo planificată pentru primocane.' : 'Aplicare demo planificată.',
      operator: null,
      created_by: null,
      updated_by: null,
    },
    {
      id: DEMO_TRATAMENTE_FIXED_IDS.aplicari[4],
      tenant_id: params.tenantId,
      parcela_id: params.parcelaId,
      cultura_id: null,
      plan_linie_id: DEMO_TRATAMENTE_FIXED_IDS.linii.zmeur[4],
      produs_id: params.produseByName['Thiovit Jet'],
      produs_nume_manual: null,
      data_planificata: '2026-04-24',
      data_aplicata: null,
      doza_ml_per_hl: null,
      doza_l_per_ha: 3,
      cantitate_totala_ml: null,
      stoc_mutatie_id: null,
      status: 'planificata',
      meteo_snapshot: null,
      stadiu_la_aplicare: isRubusMixtDemo ? 'inflorit' : null,
      cohort_la_aplicare: isRubusMixtDemo ? 'floricane' : null,
      observatii: isRubusMixtDemo ? 'Aplicare demo planificată pentru floricane.' : 'Aplicare demo planificată.',
      operator: null,
      created_by: null,
      updated_by: null,
    },
  ].map((row) =>
    withOptionalDemoSeedId(row, support.aplicari_tratament === true, params.seedId)
  )

  return {
    planuri,
    linii,
    asignari,
    configurariSezon,
    stadii,
    aplicari,
    summary: {
      configurariSezon: configurariSezon.length,
      planuri: planuri.length,
      linii: linii.length,
      asignari: asignari.length,
      stadii: stadii.length,
      aplicari: aplicari.length,
    },
  }
}
