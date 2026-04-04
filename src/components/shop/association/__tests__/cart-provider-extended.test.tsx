import { describe, expect, it, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

import {
  AssociationCartProvider,
  useCart,
} from '@/components/shop/association/AssociationCartProvider'
import { mockAssociationProduct } from '@/test/helpers/association-test-utils'

const STORAGE_KEY = 'zmeurel-association-cart-v1'

function CartProbe() {
  const { lines, addToCart, clearCart, estimatedTotal } = useCart()
  const pAssoc = mockAssociationProduct({
    id: 'ee000000-0000-4000-8000-000000000001',
    displayPrice: 12,
    pret_unitar: 20,
  })
  const pFarm = mockAssociationProduct({
    id: 'ee000000-0000-4000-8000-000000000002',
    displayPrice: 30,
    pret_unitar: 30,
  })
  return (
    <div>
      <div data-testid="est">{estimatedTotal}</div>
      <div data-testid="lines">{lines.length}</div>
      <button type="button" onClick={() => addToCart(pAssoc, 2)}>
        add-assoc
      </button>
      <button type="button" onClick={() => addToCart(pFarm, 1)}>
        add-farm
      </button>
      <button type="button" onClick={() => clearCart()}>
        clear
      </button>
    </div>
  )
}

describe('AssociationCartProvider — extended', () => {
  beforeEach(() => {
    sessionStorage.removeItem(STORAGE_KEY)
  })

  it('persistență sessionStorage: după add + rerender, datele rămân', () => {
    const { unmount } = render(
      <AssociationCartProvider>
        <CartProbe />
      </AssociationCartProvider>,
    )
    fireEvent.click(screen.getByText('add-assoc'))
    expect(screen.getByTestId('est')).toHaveTextContent('24')
    unmount()
    const raw = sessionStorage.getItem(STORAGE_KEY)
    expect(raw).toBeTruthy()
    render(
      <AssociationCartProvider>
        <CartProbe />
      </AssociationCartProvider>,
    )
    expect(screen.getByTestId('lines')).toHaveTextContent('1')
  })

  it('clearCart golește sessionStorage', () => {
    render(
      <AssociationCartProvider>
        <CartProbe />
      </AssociationCartProvider>,
    )
    fireEvent.click(screen.getByText('add-farm'))
    fireEvent.click(screen.getByText('clear'))
    expect(sessionStorage.getItem(STORAGE_KEY)).toBe('[]')
  })

  it('estimatedTotal folosește displayPrice (nu pret_unitar)', () => {
    render(
      <AssociationCartProvider>
        <CartProbe />
      </AssociationCartProvider>,
    )
    fireEvent.click(screen.getByText('add-assoc'))
    expect(screen.getByTestId('est')).toHaveTextContent('24')
  })
})
