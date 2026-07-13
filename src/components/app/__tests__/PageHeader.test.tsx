import type { AnchorHTMLAttributes, ReactNode } from 'react'
import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { PageHeader } from '@/components/app/PageHeader'

const pathnameState = vi.hoisted(() => ({
  value: '/comenzi',
}))

vi.mock('next/link', () => ({
  default: ({
    children,
    href,
    ...props
  }: AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}))

vi.mock('next/navigation', () => ({
  usePathname: () => pathnameState.value,
}))

vi.mock('@/components/layout/CompactPageHeader', () => ({
  CompactPageHeader: ({
    title,
    subtitle,
    rightSlot,
  }: {
    title?: string
    subtitle?: string
    rightSlot?: ReactNode
  }) => (
    <header>
      {title ? <h1>{title}</h1> : null}
      {subtitle ? <p>{subtitle}</p> : null}
      <div>{rightSlot}</div>
    </header>
  ),
}))

vi.mock('@/components/notifications/NotificationBell', () => ({
  NotificationBell: () => <div data-testid="notification-bell" />,
}))

vi.mock('@/components/app/UserProfileMenu', () => ({
  UserProfileMenu: () => <div data-testid="user-profile-menu" />,
}))

vi.mock('@/contexts/AddActionContext', () => ({
  useAddAction: () => ({
    triggerAddAction: vi.fn(),
    currentLabel: 'Adaugă',
    hasAction: true,
  }),
}))

describe('PageHeader quick nav', () => {
  beforeEach(() => {
    pathnameState.value = '/comenzi'
  })

  it('afișează cele patru linkuri rapide', () => {
    render(<PageHeader title="Comenzi" subtitle="Test" />)

    expect(screen.getByRole('link', { name: 'Comenzi' })).toHaveAttribute('href', '/comenzi')
    expect(screen.getByRole('link', { name: 'Livrări' })).toHaveAttribute('href', '/livrari')
    expect(screen.getByRole('link', { name: 'Recoltări' })).toHaveAttribute('href', '/recoltari')
    expect(screen.getByRole('link', { name: 'Clienți' })).toHaveAttribute('href', '/clienti')
  })

  it('marchează activă ruta curentă și sub-rutele ei', () => {
    pathnameState.value = '/comenzi/campanie'

    render(<PageHeader title="Comenzi" subtitle="Test" />)

    expect(screen.getByRole('link', { name: 'Comenzi' })).toHaveAttribute('aria-current', 'page')
    expect(screen.getByRole('link', { name: 'Livrări' })).not.toHaveAttribute('aria-current')
  })

  it('nu marchează fals Clienți pe /clienti-magazin', () => {
    pathnameState.value = '/clienti-magazin'

    render(<PageHeader title="Clienți magazin" subtitle="Test" />)

    expect(screen.getByRole('link', { name: 'Clienți' })).not.toHaveAttribute('aria-current')
  })
})
