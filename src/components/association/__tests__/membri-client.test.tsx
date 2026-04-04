import type { ReactNode } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

import { AssociationMembriClient } from '@/components/association/membri/AssociationMembriClient'
import type { AssociationMemberListItem } from '@/lib/association/members-queries'

vi.mock('@/components/app/PageHeader', () => ({
  PageHeader: ({ rightSlot }: { rightSlot?: ReactNode }) => <div data-testid="ph-right">{rightSlot}</div>,
}))

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }),
}))

vi.mock('@/components/app/DashboardAuthContext', () => ({
  useDashboardAuth: () => ({
    userId: 'u1',
    email: 'me@test.com',
    isSuperAdmin: false,
    tenantId: null,
    associationShopApproved: false,
    associationRole: 'admin',
    farmName: null,
  }),
}))

const members: AssociationMemberListItem[] = [
  {
    id: 'm1',
    email: 'admin@test.com',
    role: 'admin',
    createdAt: '2026-01-01T10:00:00.000Z',
    invitedByUserId: null,
    invitedByEmail: null,
  },
  {
    id: 'm2',
    email: 'mod@test.com',
    role: 'moderator',
    createdAt: '2026-01-02T10:00:00.000Z',
    invitedByUserId: 'u0',
    invitedByEmail: 'admin@test.com',
  },
  {
    id: 'm3',
    email: 'view@test.com',
    role: 'viewer',
    createdAt: '2026-01-03T10:00:00.000Z',
    invitedByUserId: 'u0',
    invitedByEmail: 'admin@test.com',
  },
]

describe('AssociationMembriClient', () => {
  it('tabel/carduri afișează email și roluri', () => {
    render(<AssociationMembriClient initialMembers={members} />)
    expect(screen.getAllByText('admin@test.com').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('mod@test.com').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('view@test.com').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('Admin').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('Moderator').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('Viewer').length).toBeGreaterThanOrEqual(1)
  })

  it('buton Invită membru prezent', () => {
    render(<AssociationMembriClient initialMembers={members} />)
    const inviteButtons = screen.getAllByRole('button', { name: /Invită membru/i })
    expect(inviteButtons.length).toBeGreaterThanOrEqual(1)
  })
})
