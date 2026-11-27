import type { AnchorHTMLAttributes } from 'react'
import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const state = vi.hoisted(() => ({ auth: {} as Record<string, unknown> }))

vi.mock('next/link', () => ({
  default: ({ children, href, ...props }: AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}))
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn(), push: vi.fn(), back: vi.fn() }) }))
vi.mock('@/components/app/DashboardAuthContext', () => ({
  useDashboardAuth: () => ({ tenantId: 't-1', associationShopApproved: false, memberRole: null, ...state.auth }),
}))

import { FermaPageClient } from '@/app/(dashboard)/settings/ferma/FermaPageClient'

const farm = { tenantId: 't-1', numeFerma: 'Ferma Ion', localitate: 'Suceava', contactPhone: null, plan: null }

beforeEach(() => {
  state.auth = {}
})

describe('Setări › Ferma — „Magazinul tău online” (promptul 34, §10)', () => {
  it('proprietarul vede linkul spre magazinul public al fermei', () => {
    render(<FermaPageClient farm={farm} savedLocation={null} />)
    expect(screen.getByRole('link', { name: /Magazinul tău online/ }).getAttribute('href')).toBe('/magazin/t-1')
  })

  it('ferma din asociație: vitrina asociației', () => {
    state.auth = { associationShopApproved: true }
    render(<FermaPageClient farm={farm} savedLocation={null} />)
    expect(screen.getByRole('link', { name: /Magazinul tău online/ }).getAttribute('href')).toBe('/magazin/asociatie')
  })

  it('operatorul nu îl vede', () => {
    state.auth = { memberRole: 'operator' }
    render(<FermaPageClient farm={farm} savedLocation={null} />)
    expect(screen.queryByRole('link', { name: /Magazinul tău online/ })).toBeNull()
  })
})
