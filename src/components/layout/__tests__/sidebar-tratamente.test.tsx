import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ImgHTMLAttributes } from 'react'
import { describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  pathname: '/dashboard',
}))

vi.mock('next/image', () => ({
  default: ({ alt, ...props }: Omit<ImgHTMLAttributes<HTMLImageElement>, 'src'> & { src: string; alt: string }) => (
    <img alt={alt} {...props} />
  ),
}))

vi.mock('next/navigation', () => ({
  usePathname: () => mocks.pathname,
  useSearchParams: () => new URLSearchParams(),
}))

vi.mock('@/components/app/DashboardAuthContext', () => ({
  useDashboardAuth: () => ({
    isSuperAdmin: false,
    associationRole: null,
  }),
}))

vi.mock('@/hooks/useDemoBannerVisible', () => ({
  useDemoBannerVisible: () => false,
}))

vi.mock('@/components/association/AssociationContextSwitcher', () => ({
  AssociationContextSwitcher: () => null,
}))

vi.mock('@/components/association/AssociationSidebar', () => ({
  AssociationSidebar: () => null,
}))

import { Sidebar } from '@/components/layout/Sidebar'

describe('Sidebar — Protecție & Nutriție', () => {
  it('afișează itemul Protecție & Nutriție cu ruta de landing a modulului', async () => {
    const user = userEvent.setup()
    mocks.pathname = '/dashboard'

    render(<Sidebar />)
    await user.click(screen.getByRole('button', { name: 'Fermă' }))

    const link = screen.getByRole('link', { name: 'Protecție & Nutriție' })
    await user.click(link)

    expect(link).toHaveAttribute('href', '/tratamente/conformitate')
  })

  it('marchează itemul ca activ pe orice rută /tratamente/*', () => {
    mocks.pathname = '/tratamente/planuri'

    render(<Sidebar />)

    expect(screen.getByRole('link', { name: 'Protecție & Nutriție' })).toHaveAttribute('aria-current', 'page')
  })

  it('păstrează navigarea corectă către landing-ul tratamentelor', () => {
    mocks.pathname = '/parcele'

    render(<Sidebar />)
    screen.getByRole('button', { name: 'Fermă' }).click()

    expect(screen.getByRole('link', { name: 'Protecție & Nutriție' })).toHaveAttribute('href', '/tratamente/conformitate')
  })
})
