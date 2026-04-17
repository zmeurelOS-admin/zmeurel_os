import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { PlanWizardStepInfo } from '@/components/tratamente/plan-wizard/PlanWizardStepInfo'
import { planInfoSchema, type PlanWizardInfoData } from '@/components/tratamente/plan-wizard/types'

function getErrors(value: PlanWizardInfoData) {
  const parsed = planInfoSchema.safeParse(value)
  if (parsed.success) return {}

  return parsed.error.issues.reduce<Record<string, string>>((accumulator, issue) => {
    const key = String(issue.path[0] ?? '')
    accumulator[key] = issue.message
    return accumulator
  }, {})
}

describe('PlanWizardStepInfo', () => {
  it('afișează erorile de validare și propagă schimbările de câmpuri', async () => {
    const user = userEvent.setup()
    const value: PlanWizardInfoData = {
      nume: '',
      cultura_tip: '',
      descriere: 'x'.repeat(501),
    }

    const onChange = vi.fn()

    render(
      <PlanWizardStepInfo
        culturi={['zmeur', 'căpșun']}
        errors={getErrors(value)}
        value={value}
        onChange={onChange}
      />
    )

    expect(screen.getByText('Denumirea planului este obligatorie.')).toBeInTheDocument()
    expect(screen.getByText('Alege cultura țintă.')).toBeInTheDocument()
    expect(screen.getByText('Descrierea poate avea cel mult 500 de caractere.')).toBeInTheDocument()

    await user.type(screen.getByLabelText('Denumire plan *'), 'Plan zmeur 2026')

    expect(onChange).toHaveBeenCalled()
    expect(screen.getByRole('option', { name: 'zmeur' })).toBeInTheDocument()
  })
})
