import { render, screen } from '@testing-library/react'
import type { ReactNode } from 'react'
import { describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  countStadiiPentruParcelele: vi.fn(),
  getAplicariAnualToateParcelele: vi.fn(),
  getTratamenteGlobalStats: vi.fn(),
  listParceleCuPlanActiv: vi.fn(),
  listPlanuriTratament: vi.fn(),
  listProduseFitosanitare: vi.fn(),
}))

vi.mock('@/lib/supabase/queries/tratamente', () => ({
  countStadiiPentruParcelele: (...args: unknown[]) => mocks.countStadiiPentruParcelele(...args),
  getAplicariAnualToateParcelele: (...args: unknown[]) => mocks.getAplicariAnualToateParcelele(...args),
  getTratamenteGlobalStats: (...args: unknown[]) => mocks.getTratamenteGlobalStats(...args),
  listParceleCuPlanActiv: (...args: unknown[]) => mocks.listParceleCuPlanActiv(...args),
  listPlanuriTratament: (...args: unknown[]) => mocks.listPlanuriTratament(...args),
  listProduseFitosanitare: (...args: unknown[]) => mocks.listProduseFitosanitare(...args),
}))

vi.mock('@/components/app/AppShell', () => ({
  AppShell: ({ header, children }: { header: ReactNode; children: ReactNode }) => (
    <div>
      {header}
      {children}
    </div>
  ),
}))

vi.mock('@/components/layout/CompactPageHeader', () => ({
  CompactPageHeader: ({
    title,
    subtitle,
    summary,
  }: {
    title: string
    subtitle?: string
    summary?: ReactNode
  }) => (
    <header>
      <h1>{title}</h1>
      {subtitle ? <p>{subtitle}</p> : null}
      {summary}
    </header>
  ),
}))

import Page from '@/app/(dashboard)/tratamente/conformitate/page'

describe('landing tratamente — stats și quick links', () => {
  it('afișează stats-urile principale și linkurile rapide', async () => {
    mocks.getAplicariAnualToateParcelele.mockResolvedValue([])
    mocks.listProduseFitosanitare.mockResolvedValue([])
    mocks.listPlanuriTratament.mockResolvedValue([{ id: 'plan-1' }])
    mocks.listParceleCuPlanActiv.mockResolvedValue([{ parcela_id: 'parcela-1' }])
    mocks.countStadiiPentruParcelele.mockResolvedValue(1)
    mocks.getTratamenteGlobalStats.mockResolvedValue({
      aplicariAzi: 2,
      aplicariMaine: 5,
      aplicariAplicateSezon: 12,
      parceleCuPlan: 4,
      alerteFracTotal: 1,
      alerteCupruTotal: 2,
    })

    const element = await Page({ searchParams: Promise.resolve({ an: '2026' }) })
    render(element)

    expect(screen.getByText('Protecție & Nutriție')).toBeInTheDocument()
    expect(screen.getByText('7')).toBeInTheDocument()
    expect(screen.getByText('Azi: 2 · Mâine: 5')).toBeInTheDocument()
    expect(screen.getByText('Planuri').closest('a')).toHaveAttribute('href', '/tratamente/planuri')
    expect(screen.getByText('Bibliotecă produse').closest('a')).toHaveAttribute('href', '/tratamente/produse-fitosanitare')
    expect(screen.getByText('Exportă fișe ANSVSA')).toBeInTheDocument()
  })

  it('afișează mesaj neutru când toate stats-urile sunt zero', async () => {
    mocks.getAplicariAnualToateParcelele.mockResolvedValue([])
    mocks.listProduseFitosanitare.mockResolvedValue([])
    mocks.listPlanuriTratament.mockResolvedValue([])
    mocks.listParceleCuPlanActiv.mockResolvedValue([])
    mocks.countStadiiPentruParcelele.mockResolvedValue(0)
    mocks.getTratamenteGlobalStats.mockResolvedValue({
      aplicariAzi: 0,
      aplicariMaine: 0,
      aplicariAplicateSezon: 0,
      parceleCuPlan: 0,
      alerteFracTotal: 0,
      alerteCupruTotal: 0,
    })

    const element = await Page({ searchParams: Promise.resolve({ an: '2026' }) })
    render(element)

    expect(screen.getByText('Nicio aplicare programată și nicio alertă activă în datele curente.')).toBeInTheDocument()
    expect(screen.getByText('Planuri')).toBeInTheDocument()
    expect(screen.getByText('Bibliotecă produse')).toBeInTheDocument()
  })
})
