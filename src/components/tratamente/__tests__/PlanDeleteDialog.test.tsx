import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

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
