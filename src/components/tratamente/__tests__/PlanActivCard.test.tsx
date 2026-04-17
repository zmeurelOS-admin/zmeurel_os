import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

import { PlanActivCard } from '@/components/tratamente/PlanActivCard'
import type { PlanActivParcela } from '@/lib/supabase/queries/tratamente'

describe('PlanActivCard', () => {
  it('afișează empty state și CTA când planul lipsește', () => {
    const onAssign = vi.fn()

    render(<PlanActivCard detailsHref={null} onAssign={onAssign} planActiv={null} />)

    expect(screen.getByText('Nicio parcelă asignată pentru 2026')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Atribuie plan' })).toBeInTheDocument()
  })

  it('afișează numele planului, cultura_tip și link-ul corect', () => {
    const planActiv: PlanActivParcela = {
      id: 'pp1',
      tenant_id: 't1',
      parcela_id: 'p1',
      plan_id: 'plan-123',
      an: 2026,
      activ: true,
      created_at: '2026-04-12T08:00:00Z',
      updated_at: '2026-04-12T08:00:00Z',
      plan: {
        id: 'plan-123',
        tenant_id: 't1',
        nume: 'Plan zmeur primăvară 2026',
        cultura_tip: 'zmeur',
        descriere: null,
        activ: true,
        arhivat: false,
        created_at: '2026-01-01T00:00:00Z',
        updated_at: '2026-01-01T00:00:00Z',
        created_by: null,
        updated_by: null,
      },
    }

    render(<PlanActivCard detailsHref="/tratamente/planuri/plan-123" onAssign={vi.fn()} planActiv={planActiv} />)

    expect(screen.getByText('Plan zmeur primăvară 2026')).toBeInTheDocument()
    expect(screen.getByText('zmeur')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Hub tratamente' })).toHaveAttribute('href', '/tratamente')
    expect(screen.getByRole('link', { name: 'Vezi detalii' })).toHaveAttribute(
      'href',
      '/tratamente/planuri/plan-123',
    )
  })
})
