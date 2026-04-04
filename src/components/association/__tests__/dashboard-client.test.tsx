import { describe, expect, it, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

import { AssociationDashboardClient } from '@/components/association/dashboard/AssociationDashboardClient'
import type { AssociationDashboardPageStats } from '@/lib/association/queries'

vi.mock('@/components/app/PageHeader', () => ({
  PageHeader: () => null,
}))

vi.mock('next/link', () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}))

const push = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push, replace: vi.fn(), refresh: vi.fn() }),
}))

function baseStats(over?: Partial<AssociationDashboardPageStats>): AssociationDashboardPageStats {
  return {
    ordersToday: { count: 3, total: 150 },
    ordersWeek: { count: 10, total: 500, trendPercent: 5 },
    ordersMonth: { count: 40, total: 2000 },
    productsListed: 12,
    productsTotal: 20,
    producersActive: 4,
    recentOrders: [],
    pendingProducts: 0,
    newOrdersCount: 2,
    pendingOffersCount: 0,
    ...over,
  }
}

describe('AssociationDashboardClient', () => {
  it('afișează KPI-uri: comenzi azi, săptămânal, produse, producători', () => {
    render(<AssociationDashboardClient stats={baseStats()} />)
    expect(screen.getByText('Comenzi azi')).toBeInTheDocument()
    expect(screen.getByText('Săptămânal')).toBeInTheDocument()
    expect(screen.getByText('Produse listate')).toBeInTheDocument()
    expect(screen.getByText('Producători activi')).toBeInTheDocument()
    expect(screen.getByText('3')).toBeInTheDocument()
    expect(screen.getByText('12')).toBeInTheDocument()
  })

  it('badge pe Comenzi noi când newOrdersCount > 0', () => {
    render(<AssociationDashboardClient stats={baseStats({ newOrdersCount: 5 })} />)
    const link = screen.getByRole('link', { name: /Comenzi noi/i })
    expect(link.textContent).toMatch(/5/)
  })

  it('fără badge numeric când newOrdersCount = 0', () => {
    render(<AssociationDashboardClient stats={baseStats({ newOrdersCount: 0 })} />)
    expect(screen.queryByText(/^5$/)).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Comenzi noi/i })).toBeInTheDocument()
  })

  it('link rapid Produse → /asociatie/produse', () => {
    render(<AssociationDashboardClient stats={baseStats()} />)
    expect(screen.getByRole('link', { name: /Produse/i })).toHaveAttribute('href', '/asociatie/produse')
  })

  it('click pe comandă recentă (desktop) navighează spre comenzi', () => {
    render(
      <AssociationDashboardClient
        stats={baseStats({
          recentOrders: [
            {
              id: 'o1',
              client_name: 'Ion',
              product_name: 'Zmeură',
              amount: 50,
              status: 'noua',
              date: '2026-04-01',
            },
          ],
        })}
      />,
    )
    const row = screen.getByLabelText(/Comandă Ion, 50 RON/i)
    fireEvent.click(row)
    expect(push).toHaveBeenCalledWith('/asociatie/comenzi')
  })
})
