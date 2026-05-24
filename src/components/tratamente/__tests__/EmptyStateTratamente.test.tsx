import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'

import { EmptyStateTratamente } from '@/components/tratamente/EmptyStateTratamente'

describe('EmptyStateTratamente', () => {
  it('afișează pașii ghidați și CTA-ul spre creare', () => {
    render(<EmptyStateTratamente createPlanHref="/tratamente/planuri/nou?parcela_id=123" />)

    expect(screen.getByText('Creează primul plan')).toBeInTheDocument()
    expect(screen.getByText('Asociază planul la parcela curentă')).toBeInTheDocument()
    expect(screen.getByText('Înregistrează prima fenofază')).toBeInTheDocument()

    const createLink = screen.getByRole('link', { name: 'Creează plan' })
    expect(createLink).toHaveAttribute('href', '/tratamente/planuri/nou?parcela_id=123')
    expect(screen.queryByRole('link', { name: /Importă din Excel/i })).not.toBeInTheDocument()
  })
})
