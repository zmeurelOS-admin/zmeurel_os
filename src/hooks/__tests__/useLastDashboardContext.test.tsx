import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render } from '@testing-library/react'

import { DashboardAuthProvider } from '@/components/app/DashboardAuthContext'
import { useLastDashboardContext } from '@/hooks/useLastDashboardContext'

const replace = vi.fn()
const pathnameRef = { current: '/dashboard' }

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace }),
  usePathname: () => pathnameRef.current,
}))

function Harness() {
  useLastDashboardContext()
  return null
}

const authValue = {
  userId: 'u',
  email: 'e@test.com',
  isSuperAdmin: false,
  tenantId: null,
  associationShopApproved: false,
  associationRole: 'admin' as const,
  farmName: null,
}

describe('useLastDashboardContext', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
    pathnameRef.current = '/dashboard'
  })

  it('redirect /dashboard → /asociatie când lastContext=association și există rol', () => {
    localStorage.setItem('zmeurel_last_context', 'association')
    pathnameRef.current = '/dashboard'
    render(
      <DashboardAuthProvider value={authValue}>
        <Harness />
      </DashboardAuthProvider>,
    )
    expect(replace).toHaveBeenCalledWith('/asociatie')
  })

  it('nu redirect pe /dashboard când lastContext=farm', () => {
    localStorage.setItem('zmeurel_last_context', 'farm')
    pathnameRef.current = '/dashboard'
    render(
      <DashboardAuthProvider value={authValue}>
        <Harness />
      </DashboardAuthProvider>,
    )
    expect(replace).not.toHaveBeenCalled()
  })

  it('nu redirect pe /produse chiar cu lastContext association', () => {
    localStorage.setItem('zmeurel_last_context', 'association')
    pathnameRef.current = '/produse'
    render(
      <DashboardAuthProvider value={authValue}>
        <Harness />
      </DashboardAuthProvider>,
    )
    expect(replace).not.toHaveBeenCalled()
  })

  it('salvează association în localStorage pentru /asociatie', () => {
    pathnameRef.current = '/asociatie/dashboard'
    render(
      <DashboardAuthProvider value={authValue}>
        <Harness />
      </DashboardAuthProvider>,
    )
    expect(localStorage.getItem('zmeurel_last_context')).toBe('association')
  })

  it('salvează farm pentru rute non-asociație', () => {
    pathnameRef.current = '/parcele'
    render(
      <DashboardAuthProvider value={authValue}>
        <Harness />
      </DashboardAuthProvider>,
    )
    expect(localStorage.getItem('zmeurel_last_context')).toBe('farm')
  })
})
