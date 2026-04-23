import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { PlanDeleteDialog } from '@/components/tratamente/PlanDeleteDialog'

describe('PlanDeleteDialog', () => {
  it('cu countAplicari=0 butonul Șterge este activ', () => {
    render(
      <PlanDeleteDialog
        countAplicari={0}
        onConfirm={() => undefined}
        onOpenChange={() => undefined}
        open
        planName="Plan test"
      />
    )

    expect(screen.getByRole('button', { name: 'Șterge' })).toBeEnabled()
  })

  it('cu countAplicari=0 confirmarea apelează handlerul de ștergere', async () => {
    const user = userEvent.setup()
    const onConfirm = vi.fn()

    render(
      <PlanDeleteDialog
        countAplicari={0}
        onConfirm={onConfirm}
        onOpenChange={() => undefined}
        open
        planName="Plan test"
      />
    )

    await user.click(screen.getByRole('button', { name: 'Șterge' }))

    expect(onConfirm).toHaveBeenCalledTimes(1)
  })

  it('cu countAplicari>0 afișează mesaj explicativ și buton dezactivat', () => {
    render(
      <PlanDeleteDialog
        countAplicari={3}
        onConfirm={() => undefined}
        onOpenChange={() => undefined}
        open
        planName="Plan test"
      />
    )

    expect(screen.getByText(/acest plan are 3 aplicări asociate/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Șterge' })).toBeDisabled()
  })
})
