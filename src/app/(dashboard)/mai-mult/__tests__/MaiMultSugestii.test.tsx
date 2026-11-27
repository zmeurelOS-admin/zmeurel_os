import type { AnchorHTMLAttributes } from 'react'
import { render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { DashboardAuthValue } from '@/components/app/DashboardAuthContext'

const state = vi.hoisted(() => ({ auth: {} as Partial<DashboardAuthValue> }))

vi.mock('next/link', () => ({
  default: ({ children, href, ...props }: AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}))
vi.mock('next/navigation', () => ({
  usePathname: () => '/mai-mult',
  useRouter: () => ({ prefetch: vi.fn(), push: vi.fn(), back: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}))
vi.mock('@/components/app/DashboardAuthContext', () => ({
  useDashboardAuth: () => ({
    email: 'ion@example.com',
    isSuperAdmin: false,
    associationRole: null,
    memberRole: null,
    memberAccess: [],
    farmName: 'Ferma Ion',
    linkOnly: false,
    ownerName: null,
    ...state.auth,
  }),
}))
vi.mock('@/lib/analytics/useTrackModuleView', () => ({ useTrackModuleView: vi.fn() }))
vi.mock('@/components/notifications/usePushSubscription', () => ({ usePushSubscription: () => ({ unsubscribe: vi.fn() }) }))
vi.mock('@/lib/notifications/useUnreadCount', () => ({ useUnreadNotificationsCount: () => ({ data: 0 }) }))
vi.mock('@/lib/shop/useShopOrdersInLivrareCount', () => ({ useShopOrdersInLivrareCount: () => ({ data: 0 }) }))
vi.mock('@/lib/tratamente/hooks', () => ({ usePauzeActive: () => ({ pauze: [] }) }))
vi.mock('@/lib/supabase/queries/parcele', () => ({ getParcele: vi.fn(async () => []) }))
vi.mock('@/lib/supabase/queries/magazie', () => ({ getMagazieStocSauNimic: vi.fn(async () => []) }))

import { MaiMultPageClient } from '@/app/(dashboard)/mai-mult/MaiMultPageClient'

function deschide() {
  return render(
    <QueryClientProvider client={new QueryClient()}>
      <MaiMultPageClient farmName="Ferma Ion" localitate={null} />
    </QueryClientProvider>,
  )
}

const randSugestii = () => screen.queryByRole('link', { name: /Scrie-mi o problemă sau o sugestie/ })

beforeEach(() => {
  state.auth = {}
})

describe('Mai mult — „Scrie-mi o problemă sau o sugestie” (promptul 34, §3)', () => {
  it('proprietarul îl vede, cu linkul de WhatsApp', () => {
    deschide()
    expect(randSugestii()?.getAttribute('href')).toMatch(/^https:\/\/wa\.me\//)
  })

  it('operatorul îl vede', () => {
    state.auth = { memberRole: 'operator', memberAccess: [{ module: 'recoltari', level: 'write' }] }
    deschide()
    expect(randSugestii()).not.toBeNull()
  })

  it('superadminul nu', () => {
    state.auth = { isSuperAdmin: true }
    deschide()
    expect(randSugestii()).toBeNull()
  })
})
