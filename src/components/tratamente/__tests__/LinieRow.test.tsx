import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { LinieRow } from '@/components/tratamente/LinieRow'
import type { PlanTratamentLinieCuProdus } from '@/lib/supabase/queries/tratamente'

function makeLinie(overrides?: Partial<PlanTratamentLinieCuProdus>): PlanTratamentLinieCuProdus {
  const base: PlanTratamentLinieCuProdus = {
    id: 'linie-1',
    tenant_id: 'tenant-1',
    plan_id: 'plan-1',
    ordine: 1,
    stadiu_trigger: 'inflorit',
    cohort_trigger: null,
    produs_id: 'prod-1',
    produs_nume_manual: null,
    doza_ml_per_hl: 500,
    doza_l_per_ha: null,
    observatii: 'Observații de test pentru linie',
    sursa_linie: 'din_plan',
    motiv_adaugare: null,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    produs: {
      id: 'prod-1',
      tenant_id: 'tenant-1',
      nume_comercial: 'Switch',
      substanta_activa: 'Cyprodinil',
      tip: 'fungicid',
      frac_irac: '9+12',
      doza_min_ml_per_hl: null,
      doza_max_ml_per_hl: null,
      doza_min_l_per_ha: null,
      doza_max_l_per_ha: null,
      phi_zile: 7,
      nr_max_aplicari_per_sezon: null,
      interval_min_aplicari_zile: null,
      omologat_culturi: null,
      activ: true,
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-01T00:00:00Z',
      created_by: null,
    },
  }

  return {
    ...base,
    ...overrides,
    cohort_trigger: overrides?.cohort_trigger ?? base.cohort_trigger,
  }
}

describe('LinieRow', () => {
  it('afișează numele produsului standard și doza', () => {
    render(
      <LinieRow
        index={0}
        linie={makeLinie()}
        total={2}
        onDelete={() => undefined}
        onEdit={() => undefined}
        onMoveDown={() => undefined}
        onMoveUp={() => undefined}
      />
    )

    expect(screen.getByText('Switch')).toBeInTheDocument()
    expect(screen.getByText('500 ml/hl')).toBeInTheDocument()
  })

  it('afișează pill manual pentru produs_nume_manual', () => {
    render(
      <LinieRow
        index={0}
        linie={makeLinie({
          produs: null,
          produs_id: null,
          produs_nume_manual: 'Produs manual',
        })}
        total={2}
        onDelete={() => undefined}
        onEdit={() => undefined}
        onMoveDown={() => undefined}
        onMoveUp={() => undefined}
      />
    )

    expect(screen.getByText('Produs manual')).toBeInTheDocument()
    expect(screen.getByText('manual')).toBeInTheDocument()
  })

  it('dezactivează butonul up pe prima intervenție', () => {
    render(
      <LinieRow
        index={0}
        linie={makeLinie()}
        total={2}
        onDelete={() => undefined}
        onEdit={() => undefined}
        onMoveDown={() => undefined}
        onMoveUp={() => undefined}
      />
    )

    expect(screen.getByRole('button', { name: /mută sus intervenția 1/i })).toBeDisabled()
  })

  it('dezactivează butonul down pe ultima intervenție', () => {
    render(
      <LinieRow
        index={1}
        linie={makeLinie({ ordine: 2 })}
        total={2}
        onDelete={() => undefined}
        onEdit={() => undefined}
        onMoveDown={() => undefined}
        onMoveUp={() => undefined}
      />
    )

    expect(screen.getByRole('button', { name: /mută jos intervenția 2/i })).toBeDisabled()
  })

  it('meniul 3-dots emite callback pentru editează și șterge', async () => {
    const user = userEvent.setup()
    const onEdit = vi.fn()
    const onDelete = vi.fn()

    render(
      <LinieRow
        index={0}
        linie={makeLinie()}
        total={2}
        onDelete={onDelete}
        onEdit={onEdit}
        onMoveDown={() => undefined}
        onMoveUp={() => undefined}
      />
    )

    await user.click(screen.getByRole('button', { name: /acțiuni pentru intervenția 1/i }))
    await user.click(screen.getByRole('button', { name: /editează/i }))
    expect(onEdit).toHaveBeenCalledTimes(1)

    await user.click(screen.getByRole('button', { name: /acțiuni pentru intervenția 1/i }))
    await user.click(screen.getByRole('button', { name: /șterge/i }))
    expect(onDelete).toHaveBeenCalledTimes(1)
  })
})
