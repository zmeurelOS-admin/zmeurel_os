import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'

import { EmptyStateTratamente } from '@/components/tratamente/EmptyStateTratamente'

describe('EmptyStateTratamente', () => {
  it('afișează pașii ghidați și CTA-urile spre creare/import', () => {
    render(
      <EmptyStateTratamente
        createPlanHref="/tratamente/planuri/nou?parcela_id=123"
        importPlanHref="/tratamente/planuri/import"
      />
    )

    expect(screen.getByText('Creează primul plan')).toBeInTheDocument()
    expect(screen.getByText('Asociază planul la parcela curentă')).toBeInTheDocument()
    expect(screen.getByText('Înregistrează prima fenofază')).toBeInTheDocument()

    const createLink = screen.getByRole('link', { name: 'Creează plan' })
    const importLink = screen.getByRole('link', { name: /Importă din Excel/i })

    expect(createLink).toHaveAttribute('href', '/tratamente/planuri/nou?parcela_id=123')
    expect(importLink).toHaveAttribute('href', '/tratamente/planuri/import')
  })
})
