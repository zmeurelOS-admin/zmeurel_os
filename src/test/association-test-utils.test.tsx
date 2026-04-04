import { describe, expect, it } from 'vitest'

import {
  ASSOCIATION_TEST_IDS,
  mockAssociationMember,
  mockAssociationOrder,
  mockAssociationProduct,
  mockCartItem,
  mockProducer,
  renderWithAssociationProviders,
} from '@/test/helpers/association-test-utils'

describe('association-test-utils', () => {
  it('mockAssociationProduct are câmpuri complete', () => {
    const p = mockAssociationProduct()
    expect(p.id).toBe(ASSOCIATION_TEST_IDS.productId)
    expect(p.displayPrice).toBeGreaterThan(0)
    expect(p.tenantId).toBe(ASSOCIATION_TEST_IDS.tenantId)
  })

  it('mockCartItem leagă produs de cantitate', () => {
    const p = mockAssociationProduct({ nume: 'Test' })
    const line = mockCartItem(p, 2)
    expect(line.qty).toBe(2)
    expect(line.product.nume).toBe('Test')
  })

  it('mockAssociationOrder și mockProducer sunt populare', () => {
    const o = mockAssociationOrder({ status: 'in_lucru' })
    expect(o.status).toBe('in_lucru')
    expect(mockProducer().farmName).toMatch(/test/i)
  })

  it('mockAssociationMember are rol', () => {
    expect(mockAssociationMember().role).toBe('admin')
  })

  it('renderWithAssociationProviders montează fără eroare', () => {
    const { getByText } = renderWithAssociationProviders(<span>Coș test</span>)
    expect(getByText('Coș test')).toBeInTheDocument()
  })
})
