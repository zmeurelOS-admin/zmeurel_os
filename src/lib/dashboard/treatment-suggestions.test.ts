import { describe, expect, it } from 'vitest'

import {
  buildDashboardTreatmentSuggestions,
  type DashboardTreatmentSuggestionsPayload,
} from '@/lib/dashboard/treatment-suggestions'
import type {
  AplicareCrossParcelItem,
  InterventieProdusV2,
  InterventieRelevantaV2,
} from '@/lib/supabase/queries/tratamente'
import type { MeteoZi } from '@/lib/tratamente/meteo'

const NOW = new Date('2026-05-02T09:00:00.000Z')

function makePlanProduct(
  overrides: Omit<Partial<InterventieProdusV2>, 'produs'> & {
    produs?: { id?: string; nume_comercial?: string; interval_min_aplicari_zile?: number | null } | null
  } = {},
): InterventieProdusV2 {
  const produsId = overrides.produs_id ?? overrides.produs?.id ?? 'prod-1'
  const productName = overrides.produs?.nume_comercial ?? 'Switch 62.5 WG'

  return {
    id: overrides.id ?? `plan-prod-${produsId}`,
    tenant_id: 'tenant-1',
    plan_linie_id: 'linie-1',
    ordine: overrides.ordine ?? 1,
    produs_id: produsId,
    produs_nume_manual: null,
    produs_nume_snapshot: productName,
    substanta_activa_snapshot: null,
    tip_snapshot: 'fungicid',
    frac_irac_snapshot: null,
    phi_zile_snapshot: null,
    doza_ml_per_hl: 80,
    doza_l_per_ha: null,
    observatii: null,
    created_at: '2026-05-01T00:00:00.000Z',
    updated_at: '2026-05-01T00:00:00.000Z',
    produs: overrides.produs
      ? ({
          id: produsId,
          tenant_id: 'tenant-1',
          nume_comercial: productName,
          substanta_activa: 'substanta',
          tip: 'fungicid',
          frac_irac: null,
          doza_min_ml_per_hl: null,
          doza_max_ml_per_hl: null,
          doza_min_l_per_ha: null,
          doza_max_l_per_ha: null,
          phi_zile: 7,
          nr_max_aplicari_per_sezon: null,
          interval_min_aplicari_zile: overrides.produs.interval_min_aplicari_zile ?? null,
          omologat_culturi: null,
          activ: true,
          created_at: '2026-05-01T00:00:00.000Z',
          updated_at: '2026-05-01T00:00:00.000Z',
          created_by: null,
        } as InterventieProdusV2['produs'])
      : null,
    ...overrides,
  } as InterventieProdusV2
}

function makeAplicare(
  overrides: Partial<AplicareCrossParcelItem> = {},
): AplicareCrossParcelItem {
  const produs = overrides.produse_planificate?.[0] ?? makePlanProduct()

  return {
    id: overrides.id ?? 'ap-1',
    tenant_id: 'tenant-1',
    parcela_id: overrides.parcela_id ?? 'parcela-1',
    cultura_id: null,
    plan_linie_id: 'linie-1',
    sursa: 'din_plan',
    produs_id: overrides.produs_id ?? produs.produs_id ?? 'prod-1',
    produs_nume_manual: null,
    data_programata: overrides.data_programata ?? overrides.data_planificata ?? '2026-05-02',
    data_planificata: overrides.data_planificata ?? overrides.data_programata ?? '2026-05-02',
    data_aplicata: overrides.data_aplicata ?? null,
    status: overrides.status ?? 'planificata',
    tip_interventie: 'protectie',
    scop: overrides.scop ?? 'Protecție înflorit',
    parcela_nume: overrides.parcela_nume ?? 'Parcela Nord',
    parcela_cod: 'P-1',
    parcela_suprafata_m2: 1500,
    parcela_lat: null,
    parcela_lng: null,
    plan_id: 'plan-1',
    plan_nume: 'Plan zmeur 2026',
    plan_arhivat: false,
    linie_id: 'linie-1',
    stadiu_trigger: 'inflorit',
    cohort_trigger: null,
    cohort_la_aplicare: null,
    produs_nume: overrides.produs_nume ?? 'Switch 62.5 WG',
    produs_tip: 'fungicid',
    produs_frac: null,
    produs_phi_zile: 7,
    doza_ml_per_hl: 80,
    doza_l_per_ha: null,
    observatii: null,
    operator: null,
    meteo_snapshot: null,
    produse_aplicare: overrides.produse_aplicare ?? [],
    produse_planificate: overrides.produse_planificate ?? [produs],
    phi_warning: overrides.phi_warning ?? false,
    urmatoarea_recoltare: null,
  } as AplicareCrossParcelItem
}

function makeInterventie(
  overrides: Partial<InterventieRelevantaV2> = {},
): InterventieRelevantaV2 {
  const produse = overrides.produse_planificate ?? [makePlanProduct()]

  return {
    parcela_id: overrides.parcela_id ?? 'parcela-1',
    parcela_nume: overrides.parcela_nume ?? 'Parcela Nord',
    parcela_cod: 'P-1',
    plan: {
      id: 'plan-1',
      nume: 'Plan zmeur 2026',
      cultura_tip: 'zmeur',
      activ: true,
      arhivat: false,
    },
    interventie: {
      id: 'linie-1',
      tenant_id: 'tenant-1',
      plan_id: 'plan-1',
      ordine: 1,
      stadiu_trigger: 'inflorit',
      cohort_trigger: null,
      tip_interventie: 'protectie',
      scop: 'Protecție înflorit',
      regula_repetare: 'interval',
      interval_repetare_zile: 7,
      numar_repetari_max: null,
      fereastra_start_offset_zile: null,
      fereastra_end_offset_zile: null,
      produs_id: produse[0]?.produs_id ?? 'prod-1',
      produs_nume_manual: null,
      doza_ml_per_hl: 80,
      doza_l_per_ha: null,
      observatii: null,
      created_at: '2026-05-01T00:00:00.000Z',
      updated_at: '2026-05-01T00:00:00.000Z',
      produs: null,
      produse,
    } as InterventieRelevantaV2['interventie'],
    produse_planificate: produse,
    fenofaza_curenta: overrides.fenofaza_curenta ?? {
      parcela_id: overrides.parcela_id ?? 'parcela-1',
      an: 2026,
      cohort: null,
      stadiu_id: 'stadiu-1',
      stadiu: 'inflorit',
      data_observata: '2026-05-01',
      sursa: 'manual',
      observatii: null,
    },
    ultima_aplicare: null,
    aplicare_planificata: overrides.aplicare_planificata ?? null,
    aplicari_efectuate_count: 0,
    regula_repetare: 'interval',
    interval_repetare_zile: 7,
    numar_repetari_max: null,
    urmatoarea_data_estimata: overrides.urmatoarea_data_estimata ?? '2026-05-02',
    zile_ramase: overrides.zile_ramase ?? 0,
    status_operational: overrides.status_operational ?? 'de_facut_azi',
    motiv: overrides.motiv ?? 'Fenofaza curentă se potrivește cu intervenția din plan.',
  } as InterventieRelevantaV2
}

function makeMeteoZi(safe: boolean): MeteoZi {
  return {
    parcelaId: 'parcela-1',
    snapshot_curent: {
      timestamp: '2026-05-02T08:00:00.000Z',
      temperatura_c: 18,
      umiditate_pct: 70,
      vant_kmh: 6,
      precipitatii_mm_24h: 0,
      descriere: 'Senin',
    },
    ferestre_24h: [
      {
        ora_start: '2026-05-02T08:00:00.000Z',
        ora_end: '2026-05-02T09:00:00.000Z',
        safe,
        motiv_blocaj: safe ? null : 'Vânt peste 15 km/h',
        temperatura_c: 18,
        vant_kmh: safe ? 6 : 18,
        precipitatii_mm: 0,
      },
    ],
  }
}

function buildPayload(params: {
  aplicari?: AplicareCrossParcelItem[]
  interventiiRelevante?: InterventieRelevantaV2[]
  meteoByParcelaId?: Record<string, MeteoZi | null>
}): DashboardTreatmentSuggestionsPayload {
  return buildDashboardTreatmentSuggestions({
    now: NOW,
    parcelaLabels: new Map([
      ['parcela-1', 'Parcela Nord'],
      ['parcela-2', 'Parcela Sud'],
    ]),
    aplicari: params.aplicari ?? [],
    interventiiRelevante: params.interventiiRelevante ?? [],
    meteoByParcelaId: params.meteoByParcelaId,
  })
}

describe('treatment-suggestions', () => {
  it('prioritizează o aplicare întârziată peste orice alt candidat', () => {
    const payload = buildPayload({
      aplicari: [makeAplicare({ id: 'late', data_planificata: '2026-05-01' })],
      interventiiRelevante: [makeInterventie({ urmatoarea_data_estimata: '2026-05-02' })],
    })

    expect(payload.primary?.aplicareId).toBe('late')
    expect(payload.primary?.status).toBe('overdue')
  })

  it('prioritizează o aplicare de azi peste una upcoming', () => {
    const payload = buildPayload({
      aplicari: [
        makeAplicare({ id: 'soon', data_planificata: '2026-05-05' }),
        makeAplicare({ id: 'today', data_planificata: '2026-05-02' }),
      ],
    })

    expect(payload.primary?.aplicareId).toBe('today')
    expect(payload.primary?.status).toBe('today')
  })

  it('prioritizează o aplicare existing soon peste o intervenție relevantă neplanificată', () => {
    const payload = buildPayload({
      aplicari: [makeAplicare({ id: 'planned', data_planificata: '2026-05-06' })],
      interventiiRelevante: [makeInterventie({ urmatoarea_data_estimata: '2026-05-03', status_operational: 'urmeaza' })],
    })

    expect(payload.primary?.aplicareId).toBe('planned')
  })

  it('expune intervenția relevantă când nu există aplicări mai prioritare', () => {
    const payload = buildPayload({
      interventiiRelevante: [makeInterventie({ urmatoarea_data_estimata: '2026-05-02' })],
    })

    expect(payload.primary?.aplicareId).toBeNull()
    expect(payload.primary?.interventieLabel).toContain('Protecție')
    expect(payload.primary?.status).toBe('today')
  })

  it('mută sugestia în blocked când aplicarea are PHI warning', () => {
    const payload = buildPayload({
      aplicari: [makeAplicare({ id: 'phi', data_planificata: '2026-05-02', phi_warning: true })],
    })

    expect(payload.primary?.status).toBe('blocked')
    expect(payload.primary?.warnings).toContain('phi')
  })

  it('mută sugestia în blocked când pauza minimă dintre aplicări este activă', () => {
    const product = makePlanProduct({
      produs: {
        id: 'prod-pause',
        nume_comercial: 'Produs cu pauză',
        interval_min_aplicari_zile: 7,
      },
      produs_id: 'prod-pause',
    })

    const payload = buildPayload({
      aplicari: [
        makeAplicare({
          id: 'applied',
          status: 'aplicata',
          data_aplicata: '2026-05-01T06:00:00.000Z',
          data_planificata: '2026-05-01',
          produse_planificate: [product],
          produse_aplicare: [
            {
              id: 'ap-prod',
              tenant_id: 'tenant-1',
              aplicare_id: 'applied',
              plan_linie_produs_id: null,
              ordine: 1,
              produs_id: 'prod-pause',
              produs_nume_manual: null,
              produs_nume_snapshot: 'Produs cu pauză',
              substanta_activa_snapshot: null,
              tip_snapshot: 'fungicid',
              frac_irac_snapshot: null,
              phi_zile_snapshot: null,
              doza_ml_per_hl: 80,
              doza_l_per_ha: null,
              cantitate_totala: null,
              unitate_cantitate: null,
              stoc_mutatie_id: null,
              observatii: null,
              created_at: '2026-05-01T00:00:00.000Z',
              updated_at: '2026-05-01T00:00:00.000Z',
              produs: null,
              plan_linie_produs: null,
            },
          ],
        }),
        makeAplicare({
          id: 'planned',
          data_planificata: '2026-05-05',
          produse_planificate: [product],
        }),
      ],
    })

    expect(payload.primary?.aplicareId).toBe('planned')
    expect(payload.primary?.status).toBe('blocked')
    expect(payload.primary?.warnings).toContain('pauza')
  })

  it('setează prima fereastră sigură când există meteo favorabilă', () => {
    const payload = buildPayload({
      aplicari: [makeAplicare({ data_planificata: '2026-05-02' })],
      meteoByParcelaId: {
        'parcela-1': makeMeteoZi(true),
      },
    })

    expect(payload.primary?.status).toBe('today')
    expect(payload.primary?.firstSafeWindowLabel).toBeTruthy()
    expect(payload.primary?.reason).toContain('Prima fereastră meteo sigură')
  })

  it('setează weather_wait când nu există fereastră sigură', () => {
    const payload = buildPayload({
      aplicari: [makeAplicare({ data_planificata: '2026-05-02' })],
      meteoByParcelaId: {
        'parcela-1': makeMeteoZi(false),
      },
    })

    expect(payload.primary?.status).toBe('weather_wait')
    expect(payload.primary?.warnings).toContain('meteo')
  })

  it('spune onest când lipsesc datele meteo', () => {
    const payload = buildPayload({
      aplicari: [makeAplicare({ data_planificata: '2026-05-02' })],
    })

    expect(payload.primary?.status).toBe('today')
    expect(payload.primary?.warnings).toContain('meteo')
    expect(payload.primary?.reason).toContain('nu poate fi confirmată')
  })

  it('nu sugerează intervenții fără fenofază curentă', () => {
    const payload = buildPayload({
      interventiiRelevante: [
        makeInterventie({
          fenofaza_curenta: {
            parcela_id: 'parcela-1',
            an: 2026,
            cohort: null,
            stadiu_id: null,
            stadiu: null,
            data_observata: null,
            sursa: null,
            observatii: null,
          },
        }),
      ],
    })

    expect(payload.primary).toBeNull()
  })

  it('returnează maximum o recomandare principală și una secundară', () => {
    const payload = buildPayload({
      aplicari: [
        makeAplicare({ id: 'one', data_planificata: '2026-05-01' }),
        makeAplicare({ id: 'two', data_planificata: '2026-05-02', parcela_id: 'parcela-2', parcela_nume: 'Parcela Sud' }),
        makeAplicare({ id: 'three', data_planificata: '2026-05-03' }),
      ],
    })

    expect(payload.primary?.aplicareId).toBe('one')
    expect(payload.secondary?.aplicareId).toBe('two')
  })
})
