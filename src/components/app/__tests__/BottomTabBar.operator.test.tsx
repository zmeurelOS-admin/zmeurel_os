import type { AnchorHTMLAttributes } from 'react'
import { render, screen, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { BottomTabBar } from '@/components/app/BottomTabBar'
import type { DashboardAuthValue } from '@/components/app/DashboardAuthContext'
import UnifiedMobileFab from '@/components/ui/UnifiedMobileFab'
import { operatorSeesHref, operatorTabs, poateAdaugaPeRuta } from '@/lib/farm-members/nav'

const state = vi.hoisted(() => ({
  pathname: '/recoltari',
  auth: {} as Partial<DashboardAuthValue>,
  hasAction: true,
}))

vi.mock('next/link', () => ({
  default: ({ children, href, ...props }: AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}))

vi.mock('next/navigation', () => ({
  usePathname: () => state.pathname,
  useRouter: () => ({ prefetch: vi.fn(), push: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}))

vi.mock('@/components/app/DashboardAuthContext', () => ({
  useDashboardAuth: () => ({ associationRole: null, memberRole: null, memberAccess: [], ...state.auth }),
}))

vi.mock('@/contexts/AddActionContext', () => ({
  useAddAction: () => ({ triggerAddAction: vi.fn(), hasAction: state.hasAction, currentLabel: 'Adaugă' }),
}))

function etichete(): string[] {
  const nav = screen.getByRole('navigation', { name: 'Navigare principală' })
  return within(nav)
    .getAllByRole('link')
    .map((link) => link.textContent?.replace(/\s+/g, ' ').trim() ?? '')
}

describe('bara de jos', () => {
  beforeEach(() => {
    state.pathname = '/recoltari'
    state.auth = {}
    state.hasAction = true
  })

  it('proprietarul vede bara de azi', () => {
    render(<BottomTabBar />)
    expect(etichete()).toEqual(['🏡Acasă', '🚚Livrări', '🧺Recoltări', '📦Comenzi', '•••Mai mult'])
  })

  it('operatorul din link doar cu Recoltări: Recoltări + Mai mult', () => {
    state.auth = { memberRole: 'operator', memberAccess: [{ module: 'recoltari', level: 'write' }] }
    render(<BottomTabBar />)
    expect(etichete()).toEqual(['🧺Recoltări', '•••Mai mult'])
    const nav = screen.getByRole('navigation', { name: 'Navigare principală' })
    expect(within(nav).getByRole('link', { name: /Recoltări/ })).toHaveAttribute('href', '/recoltari')
  })

  it('operatorul cu multe module: cel mult 4, întâi Livrări / Recoltări / Comenzi', () => {
    state.auth = {
      memberRole: 'operator',
      memberAccess: [
        { module: 'parcele', level: 'read' },
        { module: 'comenzi', level: 'read' },
        { module: 'clienti', level: 'write' },
        { module: 'tratamente', level: 'read' },
        { module: 'livrari', level: 'write' },
      ],
    }
    render(<BottomTabBar />)
    expect(etichete()).toEqual(['🚚Livrări', '📦Comenzi', '🌿Parcele', '🧪Tratamente', '•••Mai mult'])
  })
})

describe('butonul „+”', () => {
  beforeEach(() => {
    state.pathname = '/recoltari'
    state.auth = {}
    state.hasAction = true
  })

  it('proprietarul îl vede', () => {
    render(<UnifiedMobileFab />)
    expect(screen.getByRole('button', { name: 'Adaugă' })).toBeInTheDocument()
  })

  it('operatorul cu „Scrie” pe modul îl vede', () => {
    state.auth = { memberRole: 'operator', accessLevel: 'write' }
    render(<UnifiedMobileFab />)
    expect(screen.getByRole('button', { name: 'Adaugă' })).toBeInTheDocument()
  })

  it('operatorul doar cu „Citește” pe modul nu-l vede, chiar dacă pagina a înregistrat acțiunea', () => {
    state.auth = { memberRole: 'operator', accessLevel: 'read' }
    render(<UnifiedMobileFab />)
    expect(screen.queryByRole('button', { name: 'Adaugă' })).not.toBeInTheDocument()
  })
})

describe('regulile de navigare ale operatorului', () => {
  it('operatorTabs ignoră modulele fără drept și păstrează ordinea fixă', () => {
    expect(operatorTabs([{ module: 'recoltari', level: 'read' }]).map((tab) => tab.href)).toEqual(['/recoltari'])
    expect(operatorTabs([]).length).toBe(0)
    expect(operatorTabs(undefined).length).toBe(0)
    expect(
      operatorTabs([
        { module: 'activitati', level: 'write' },
        { module: 'recoltari', level: 'read' },
      ]).map((tab) => tab.label),
    ).toEqual(['Recoltări', 'Lucrări'])
  })

  it('operatorSeesHref: doar rutele modulelor lui (plus Mai mult și Notificări)', () => {
    const access = [{ module: 'recoltari' as const, level: 'write' as const }]
    expect(operatorSeesHref('/recoltari', access)).toBe(true)
    expect(operatorSeesHref('/vanzari', access)).toBe(false)
    expect(operatorSeesHref('/dashboard', access)).toBe(false)
    expect(operatorSeesHref('/mai-mult', access)).toBe(true)
    expect(operatorSeesHref('/clienti?x=1', [{ module: 'clienti', level: 'read' }])).toBe(true)
  })

  it('poateAdaugaPeRuta', () => {
    expect(poateAdaugaPeRuta(null, null)).toBe(true)
    expect(poateAdaugaPeRuta('operator', 'write')).toBe(true)
    expect(poateAdaugaPeRuta('operator', 'read')).toBe(false)
    expect(poateAdaugaPeRuta('operator', null)).toBe(false)
  })
})
