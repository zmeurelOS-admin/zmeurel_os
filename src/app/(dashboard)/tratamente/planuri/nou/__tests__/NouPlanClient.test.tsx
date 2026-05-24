import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type * as React from 'react'

import { NouPlanClient } from '../NouPlanClient'
import type { TemplatePreview } from '@/app/(dashboard)/tratamente/planuri/templates/actions'

const { pushMock, refreshMock, creeazaPlanGolMock } = vi.hoisted(() => ({
  pushMock: vi.fn(),
  refreshMock: vi.fn(),
  creeazaPlanGolMock: vi.fn(),
}))

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: pushMock,
    refresh: refreshMock,
  }),
}))

vi.mock('@/app/(dashboard)/tratamente/planuri/actions', () => ({
  creeazaPlanGolAction: creeazaPlanGolMock,
}))

vi.mock('@/components/app/AppShell', () => ({
  AppShell: ({ children, header }: { children: React.ReactNode; header?: React.ReactNode }) => (
    <div>
      {header}
      {children}
    </div>
  ),
}))

vi.mock('@/components/app/PageHeader', () => ({
  PageHeader: ({ title, subtitle }: { title: string; subtitle?: string }) => (
    <header>
      <h1>{title}</h1>
      {subtitle ? <p>{subtitle}</p> : null}
    </header>
  ),
}))

vi.mock('@/lib/ui/toast', () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
  },
}))

const templates: TemplatePreview[] = [
  {
    id: '11111111-1111-4111-8111-111111111111',
    cod: 'zmeur_primocane',
    nume: 'Zmeur primocane',
    cultura_tip: 'zmeur',
    cohort: 'primocane',
    descriere: '20 intervenții standard',
    durata_sezon_estimata: 'martie - octombrie',
    nr_interventii: 20,
  },
  {
    id: '22222222-2222-4222-8222-222222222222',
    cod: 'zmeur_floricane',
    nume: 'Zmeur floricane',
    cultura_tip: 'zmeur',
    cohort: 'floricane',
    descriere: 'Calendar floricane',
    durata_sezon_estimata: 'februarie - noiembrie',
    nr_interventii: 22,
  },
]

describe('NouPlanClient', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    creeazaPlanGolMock.mockResolvedValue({ planId: 'plan-gol' })
  })

  it('renderizează cardurile template și Plan gol', () => {
    render(<NouPlanClient templates={templates} culturi={['zmeur']} />)

    expect(screen.getByRole('button', { name: /Zmeur primocane/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Zmeur floricane/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Plan gol/i })).toBeInTheDocument()
  })

  it('navighează la preview când alegi un template', async () => {
    const user = userEvent.setup()
    render(<NouPlanClient templates={templates} culturi={['zmeur']} />)

    await user.click(screen.getByRole('button', { name: /Zmeur primocane/i }))

    expect(pushMock).toHaveBeenCalledWith('/tratamente/planuri/nou/template/11111111-1111-4111-8111-111111111111')
  })

  it('creează plan gol și redirecționează la editor', async () => {
    const user = userEvent.setup()
    render(<NouPlanClient templates={templates} culturi={['zmeur']} />)

    await user.click(screen.getByRole('button', { name: /Plan gol/i }))
    await user.type(screen.getByLabelText('Nume plan'), 'Plan gol test')
    await user.click(screen.getByRole('button', { name: 'Creează plan' }))

    await waitFor(() => {
      expect(creeazaPlanGolMock).toHaveBeenCalledWith({
        nume: 'Plan gol test',
        culturaTip: 'zmeur',
      })
    })
    expect(pushMock).toHaveBeenCalledWith('/tratamente/planuri/plan-gol/editor')
  })
})
