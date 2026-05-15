import { beforeEach, describe, expect, it, vi } from 'vitest'

import { lineToPayload, type PlanWizardLinieDraft } from '@/components/tratamente/plan-wizard/types'
import type { PlanSaveInput } from '@/lib/tratamente/import/types'

const mocks = vi.hoisted(() => ({
  revalidatePath: vi.fn(),
  getTenantIdByUserId: vi.fn(),
}))

function createSupabaseMock(capturedRpcCalls: Array<{ name: string; args: unknown }>) {
  function makeResponse(table: string) {
    if (table === 'planuri_tratament') {
      return {
        data: {
          id: 'plan-compat-1',
          tenant_id: 'tenant-1',
          nume: 'Plan compat wizard',
          cultura_tip: 'zmeur',
          descriere: 'Descriere compat',
          activ: true,
          arhivat: false,
          created_at: '2026-01-01T00:00:00.000Z',
          updated_at: '2026-01-01T00:00:00.000Z',
          created_by: 'user-1',
          updated_by: 'user-1',
        },
        error: null,
      }
    }

    return { data: [], error: null }
  }

  function createQueryBuilder(table: string) {
    const builder = {
      select: vi.fn(() => builder),
      eq: vi.fn(() => builder),
      order: vi.fn(() => builder),
      in: vi.fn(() => builder),
      limit: vi.fn(() => builder),
      maybeSingle: vi.fn(async () => makeResponse(table)),
      single: vi.fn(async () => makeResponse(table)),
      then: (onFulfilled: (value: unknown) => unknown, onRejected?: (reason: unknown) => unknown) =>
        Promise.resolve(makeResponse(table)).then(onFulfilled, onRejected),
    }
    return builder
  }

  return {
    auth: {
      getUser: vi.fn(async () => ({
        data: { user: { id: 'user-1' } },
        error: null,
      })),
    },
    rpc: vi.fn(async (name: string, args: unknown) => {
      capturedRpcCalls.push({ name, args })
      return {
        data: {
          plan: { id: 'plan-compat-1' },
          linii: [],
          parcele_asociate: [],
        },
        error: null,
      }
    }),
    from: vi.fn((table: string) => createQueryBuilder(table)),
  }
}

describe('save import wizard compatibility', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    mocks.getTenantIdByUserId.mockResolvedValue('tenant-1')
  })

  it(
    'trimite la RPC același shape pentru p_plan_data și p_linii ca PlanWizard',
    async () => {
      const capturedRpcCalls: Array<{ name: string; args: unknown }> = []
      const supabase = createSupabaseMock(capturedRpcCalls)

      vi.doMock('next/cache', () => ({
        revalidatePath: (...args: unknown[]) => mocks.revalidatePath(...args),
      }))
      vi.doMock('@/lib/supabase/server', () => ({
        createClient: async () => supabase,
      }))
      vi.doMock('@/lib/tenant/get-tenant', () => ({
        getTenantIdByUserId: (...args: unknown[]) => mocks.getTenantIdByUserId(...args),
      }))

      const { saveImportedPlansAction } = await import(
        '@/app/(dashboard)/tratamente/planuri/import/actions'
      )

      const savePayload: PlanSaveInput[] = [
        {
          plan_metadata: {
            nume: 'Plan compat wizard',
            cultura_tip: 'zmeur',
            descriere: 'Descriere compat',
          },
          linii: [
            {
              ordine: 1,
              stadiu_trigger: 'umflare_muguri',
              cohort_trigger: null,
              tip_interventie: null,
              scop: null,
              regula_repetare: 'fara_repetare',
              interval_repetare_zile: null,
              numar_repetari_max: null,
              observatii: 'Observație exactă',
              produse: [
                {
                  ordine: 1,
                  produs_id: 'prod-exact',
                  produs_nume_manual: null,
                  produs_nume_snapshot: null,
                  substanta_activa_snapshot: null,
                  tip_snapshot: null,
                  frac_irac_snapshot: null,
                  phi_zile_snapshot: null,
                  doza_ml_per_hl: 500,
                  doza_l_per_ha: null,
                  observatii: 'Observație exactă',
                },
              ],
            },
            {
              ordine: 2,
              stadiu_trigger: 'prefloral',
              cohort_trigger: null,
              tip_interventie: null,
              scop: null,
              regula_repetare: 'fara_repetare',
              interval_repetare_zile: null,
              numar_repetari_max: null,
              observatii: null,
              produse: [
                {
                  ordine: 1,
                  produs_id: null,
                  produs_nume_manual: 'Produs liber',
                  produs_nume_snapshot: 'Produs liber',
                  substanta_activa_snapshot: null,
                  tip_snapshot: null,
                  frac_irac_snapshot: null,
                  phi_zile_snapshot: null,
                  doza_ml_per_hl: null,
                  doza_l_per_ha: 3,
                  observatii: null,
                },
              ],
            },
            {
              ordine: 3,
              stadiu_trigger: 'cadere_petale',
              cohort_trigger: null,
              tip_interventie: null,
              scop: null,
              regula_repetare: 'fara_repetare',
              interval_repetare_zile: null,
              numar_repetari_max: null,
              observatii: 'Din bibliotecă',
              produse: [
                {
                  ordine: 1,
                  produs_id: 'prod-library',
                  produs_nume_manual: null,
                  produs_nume_snapshot: null,
                  substanta_activa_snapshot: null,
                  tip_snapshot: null,
                  frac_irac_snapshot: null,
                  phi_zile_snapshot: null,
                  doza_ml_per_hl: 50,
                  doza_l_per_ha: null,
                  observatii: 'Din bibliotecă',
                },
              ],
            },
          ],
        },
      ]

      const wizardLines: PlanWizardLinieDraft[] = [
        {
          id: 'linie-1',
          ordine: 1,
          stadiu_trigger: 'umflare_muguri',
          produs_id: 'prod-exact',
          produs_nume_manual: '',
          dozaUnitate: 'ml/hl',
          doza: 500,
          observatii: 'Observație exactă',
          tip_interventie: null,
          scop: '',
          regula_repetare: 'fara_repetare',
          interval_repetare_zile: null,
          numar_repetari_max: null,
          produse: [
            {
              id: 'linie-1-produs-1',
              ordine: 1,
              produs_id: 'prod-exact',
              produs_nume_manual: '',
              produs_nume_snapshot: null,
              substanta_activa_snapshot: '',
              tip_snapshot: '',
              frac_irac_snapshot: '',
              phi_zile_snapshot: null,
              doza_ml_per_hl: 500,
              doza_l_per_ha: null,
              observatii: 'Observație exactă',
            },
          ],
        },
        {
          id: 'linie-2',
          ordine: 2,
          stadiu_trigger: 'prefloral',
          produs_id: null,
          produs_nume_manual: 'Produs liber',
          dozaUnitate: 'l/ha',
          doza: 3,
          observatii: '',
          tip_interventie: null,
          scop: '',
          regula_repetare: 'fara_repetare',
          interval_repetare_zile: null,
          numar_repetari_max: null,
          produse: [
            {
              id: 'linie-2-produs-1',
              ordine: 1,
              produs_id: null,
              produs_nume_manual: 'Produs liber',
              produs_nume_snapshot: null,
              substanta_activa_snapshot: '',
              tip_snapshot: '',
              frac_irac_snapshot: '',
              phi_zile_snapshot: null,
              doza_ml_per_hl: null,
              doza_l_per_ha: 3,
              observatii: '',
            },
          ],
        },
        {
          id: 'linie-3',
          ordine: 3,
          stadiu_trigger: 'cadere_petale',
          produs_id: 'prod-library',
          produs_nume_manual: '',
          dozaUnitate: 'ml/hl',
          doza: 50,
          observatii: 'Din bibliotecă',
          tip_interventie: null,
          scop: '',
          regula_repetare: 'fara_repetare',
          interval_repetare_zile: null,
          numar_repetari_max: null,
          produse: [
            {
              id: 'linie-3-produs-1',
              ordine: 1,
              produs_id: 'prod-library',
              produs_nume_manual: '',
              produs_nume_snapshot: null,
              substanta_activa_snapshot: '',
              tip_snapshot: '',
              frac_irac_snapshot: '',
              phi_zile_snapshot: null,
              doza_ml_per_hl: 50,
              doza_l_per_ha: null,
              observatii: 'Din bibliotecă',
            },
          ],
        },
      ]

      const wizardRpcPlanData = {
        nume: 'Plan compat wizard',
        cultura_tip: 'zmeur',
        descriere: 'Descriere compat',
        activ: true,
        arhivat: false,
      }
      const wizardRpcLinii = wizardLines.map(lineToPayload)

      const result = await saveImportedPlansAction(savePayload, 2026)

      expect(result).toEqual({ success: 1, failed: [] })
      expect(capturedRpcCalls).toHaveLength(1)

      const rpcArgs = capturedRpcCalls[0]?.args as {
        p_plan_data: Record<string, unknown>
        p_linii: Array<Record<string, unknown>>
      }

      expect(Object.keys(rpcArgs.p_plan_data).sort()).toEqual(
        Object.keys(wizardRpcPlanData).sort()
      )
      expect(rpcArgs.p_plan_data).toEqual(wizardRpcPlanData)

      expect(rpcArgs.p_linii).toHaveLength(wizardRpcLinii.length)
      wizardRpcLinii.forEach((line, index) => {
        expect(rpcArgs.p_linii[index]).toMatchObject({
          ...line,
          regula_repetare: 'fara_repetare',
          produse: [
            expect.objectContaining({
              ordine: 1,
              produs_id: line.produs_id,
              produs_nume_manual: line.produs_nume_manual,
              doza_ml_per_hl: line.doza_ml_per_hl,
              doza_l_per_ha: line.doza_l_per_ha,
              observatii: line.observatii,
            }),
          ],
        })
      })
    },
    15_000
  )
})
