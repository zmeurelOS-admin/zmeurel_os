import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'

import { buildWizardWarnings } from '@/components/tratamente/plan-wizard/helpers'
import { PlanWizardStepRevizuire } from '@/components/tratamente/plan-wizard/PlanWizardStepRevizuire'
import type {
  PlanWizardInfoData,
  PlanWizardLinieDraft,
  PlanWizardRevizuireData,
} from '@/components/tratamente/plan-wizard/types'
import type { PlanWizardParcelaOption, ProdusFitosanitar } from '@/lib/supabase/queries/tratamente'

const produse: ProdusFitosanitar[] = [
  {
    id: 'prod-frac-1',
    tenant_id: null,
    nume_comercial: 'Cupru Forte',
    substanta_activa: 'hidroxid de cupru',
    tip: 'fungicid',
    frac_irac: 'FRAC M01',
    doza_min_ml_per_hl: null,
    doza_max_ml_per_hl: null,
    doza_min_l_per_ha: 12.5,
    doza_max_l_per_ha: 12.5,
    phi_zile: 7,
    nr_max_aplicari_per_sezon: 3,
    interval_min_aplicari_zile: 10,
    omologat_culturi: ['zmeur'],
    activ: true,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    created_by: null,
  },
  {
    id: 'prod-frac-2',
    tenant_id: 'tenant-1',
    nume_comercial: 'Cupru Rapid',
    substanta_activa: 'hidroxid de cupru',
    tip: 'fungicid',
    frac_irac: 'FRAC M01',
    doza_min_ml_per_hl: null,
    doza_max_ml_per_hl: null,
    doza_min_l_per_ha: 1,
    doza_max_l_per_ha: 1,
    phi_zile: 5,
    nr_max_aplicari_per_sezon: 3,
    interval_min_aplicari_zile: 7,
    omologat_culturi: ['zmeur'],
    activ: true,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    created_by: 'user-1',
  },
]

const linii: PlanWizardLinieDraft[] = [
  {
    id: 'linie-1',
    ordine: 1,
    stadiu_trigger: 'buton_verde',
    produs_id: 'prod-frac-1',
    produs_nume_manual: '',
    dozaUnitate: 'l/ha',
    doza: 12.5,
    observatii: '',
  },
  {
    id: 'linie-2',
    ordine: 2,
    stadiu_trigger: 'inflorit',
    produs_id: 'prod-frac-2',
    produs_nume_manual: '',
    dozaUnitate: 'l/ha',
    doza: 1,
    observatii: '',
  },
]

const info: PlanWizardInfoData = {
  nume: 'Plan zmeur test',
  cultura_tip: 'zmeur',
  descriere: '',
}

const review: PlanWizardRevizuireData = {
  an: 2026,
  parcele_ids: [],
}

const parcele: PlanWizardParcelaOption[] = [
  {
    id: 'parcela-1',
    id_parcela: 'P-01',
    nume_parcela: 'Solariul 1',
    suprafata_m2: 3200,
    cultura_tip: 'zmeur',
    tip_fruct: 'zmeur',
    active_planuri: [{ plan_id: 'plan-vechi', plan_nume: 'Plan vechi', an: 2026 }],
  },
]

describe('PlanWizardStepRevizuire', () => {
  it('afișează warnings pentru conflict FRAC și cupru cumulat', () => {
    const warnings = buildWizardWarnings(linii, produse, 2026)

    render(
      <PlanWizardStepRevizuire
        info={info}
        linii={linii}
        parcele={parcele}
        produse={produse}
        value={review}
        warnings={warnings}
        onChange={() => undefined}
      />
    )

    expect(screen.getByText('Rotație FRAC repetată')).toBeInTheDocument()
    expect(screen.getByText('Limită anuală de cupru depășită')).toBeInTheDocument()
    expect(screen.getByText(/Plan existent activ pentru anul 2026/)).toBeInTheDocument()
  })
})
