import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

import { EmptyStateTratamente } from '@/components/tratamente/EmptyStateTratamente'

describe('EmptyStateTratamente', () => {
  it('afișează exact două CTA și le leagă de callback-uri', async () => {
    const onAssignPlan = vi.fn()
    const onRecordStadiu = vi.fn()

    render(<EmptyStateTratamente onAssignPlan={onAssignPlan} onRecordStadiu={onRecordStadiu} />)

    const assignButton = screen.getByRole('button', { name: 'Atribuie un plan' })
    const recordButton = screen.getByRole('button', { name: 'Înregistrează primul stadiu' })

    expect(assignButton).toBeInTheDocument()
    expect(recordButton).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: /Atribuie un plan|Înregistrează primul stadiu/ })).toHaveLength(2)

    await assignButton.click()
    await recordButton.click()

    expect(onAssignPlan).toHaveBeenCalledTimes(1)
    expect(onRecordStadiu).toHaveBeenCalledTimes(1)
  })
})
