import { describe, expect, it, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

import { AssociationProducatoriClient } from '@/components/association/producatori/AssociationProducatoriClient'
import type { AssociationProducer } from '@/lib/association/queries'

vi.mock('@/components/app/PageHeader', () => ({
  PageHeader: () => null,
}))

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }),
}))

vi.mock('@/hooks/useMediaQuery', () => ({
  /** Desktop: nu e mobil → layout fără dubluri în DOM pentru același card. */
  useMediaQuery: (q: string) => (typeof q === 'string' ? !q.includes('max-width: 767px') : false),
}))

vi.mock('@/components/app/DashboardAuthContext', () => ({
  useDashboardAuth: () => ({
    userId: 'current-user-id',
    email: 'admin@test.com',
    isSuperAdmin: false,
    tenantId: null,
    associationShopApproved: false,
    associationRole: 'admin',
    farmName: null,
  }),
}))

const baseProducer = (over: Partial<AssociationProducer>): AssociationProducer => ({
  id: 't0000000-0000-4000-8000-000000000001',
  nume_ferma: 'Ferma Test',
  is_association_approved: true,
  descriere_publica: null,
  email_public: null,
  facebook: null,
  instagram: null,
  localitate: 'Suceava',
  logo_url: null,
  poze_ferma: [],
  program_piata: null,
  specialitate: null,
  website: null,
  whatsapp: null,
  activeProductCount: 3,
  listedProductCount: 1,
  ownerUserId: 'owner-1',
  ownerEmail: 'farmer@example.test',
  associationRole: 'moderator',
  associationMemberId: 'mem-1',
  ...over,
})

describe('AssociationProducatoriClient', () => {
  it('afișează fermieri aprobați (badge Aprobat)', () => {
    render(
      <AssociationProducatoriClient
        initialProducers={[baseProducer({})]}
        canManageProducts
        canManageAssociationRoles
      />,
    )
    expect(screen.getAllByText(/Aprobat/i).length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('Ferma Test').length).toBeGreaterThanOrEqual(1)
  })

  it('admin vede secțiunea de roluri (badge Moderator)', () => {
    render(
      <AssociationProducatoriClient
        initialProducers={[baseProducer({ associationRole: 'moderator' })]}
        canManageProducts
        canManageAssociationRoles
      />,
    )
    expect(screen.getAllByText('Moderator').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByRole('button', { name: /Schimbă/i }).length).toBeGreaterThanOrEqual(1)
  })

  it('moderator NU vede secțiunea de alocare rol (canManageAssociationRoles false)', () => {
    render(
      <AssociationProducatoriClient
        initialProducers={[baseProducer({ associationRole: null })]}
        canManageProducts
        canManageAssociationRoles={false}
      />,
    )
    expect(screen.queryByRole('button', { name: /Alocă rol/i })).not.toBeInTheDocument()
  })

  it('click Alocă rol deschide dialogul (admin)', async () => {
    render(
      <AssociationProducatoriClient
        initialProducers={[baseProducer({ associationRole: null })]}
        canManageProducts
        canManageAssociationRoles
      />,
    )
    fireEvent.click(screen.getAllByRole('button', { name: /Alocă rol/i })[0]!)
    expect(await screen.findByRole('dialog', { name: /Alocă rol workspace/i })).toBeInTheDocument()
  })
})
