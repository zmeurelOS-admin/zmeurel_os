import { describe, expect, it, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import {
  AssociationCartProvider,
  useCart,
} from '@/components/shop/association/AssociationCartProvider'
import { mockAssociationProduct } from '@/test/helpers/association-test-utils'

const STORAGE_KEY = 'zmeurel-association-cart-v1'

function CartProbe() {
  const {
    lines,
    addToCart,
    removeFromCart,
    updateQty,
    clearCart,
    cartTotalQty,
    estimatedTotal,
    cartLineCount,
  } = useCart()

  const p1 = mockAssociationProduct({
    id: 'aa000000-0000-4000-8000-000000000001',
    displayPrice: 10,
    nume: 'P1',
  })
  const p2 = mockAssociationProduct({
    id: 'aa000000-0000-4000-8000-000000000002',
    tenantId: 'bb000000-0000-4000-8000-000000000099',
    displayPrice: 5,
    nume: 'P2',
  })

  return (
    <div>
      <div data-testid="line-count">{cartLineCount}</div>
      <div data-testid="total-qty">{cartTotalQty}</div>
      <div data-testid="estimated-total">{estimatedTotal}</div>
      <div data-testid="lines-json">{JSON.stringify(lines.map((l) => ({ id: l.product.id, qty: l.qty })))}</div>
      <button type="button" onClick={() => addToCart(p1)}>
        add-p1
      </button>
      <button type="button" onClick={() => addToCart(p1, 2)}>
        add-p1-x2
      </button>
      <button type="button" onClick={() => addToCart(p2)}>
        add-p2
      </button>
      <button type="button" onClick={() => updateQty(p1.id, 3)}>
        set-p1-3
      </button>
      <button type="button" onClick={() => removeFromCart(p1.id)}>
        rm-p1
      </button>
      <button type="button" onClick={() => clearCart()}>
        clear
      </button>
    </div>
  )
}

describe('AssociationCartProvider / useCart', () => {
  beforeEach(() => {
    sessionStorage.removeItem(STORAGE_KEY)
  })

  it('addToCart adaugă produs nou', async () => {
    const user = userEvent.setup()
    render(
      <AssociationCartProvider>
        <CartProbe />
      </AssociationCartProvider>,
    )
    await user.click(screen.getByText('add-p1'))
    expect(screen.getByTestId('line-count')).toHaveTextContent('1')
    expect(screen.getByTestId('total-qty')).toHaveTextContent('1')
    expect(screen.getByTestId('estimated-total')).toHaveTextContent('10')
  })

  it('addToCart incrementează cantitatea dacă produsul există deja', async () => {
    const user = userEvent.setup()
    render(
      <AssociationCartProvider>
        <CartProbe />
      </AssociationCartProvider>,
    )
    await user.click(screen.getByText('add-p1'))
    await user.click(screen.getByText('add-p1-x2'))
    expect(screen.getByTestId('line-count')).toHaveTextContent('1')
    expect(screen.getByTestId('total-qty')).toHaveTextContent('3')
    expect(screen.getByTestId('estimated-total')).toHaveTextContent('30')
  })

  it('updateQty modifică cantitatea', async () => {
    const user = userEvent.setup()
    render(
      <AssociationCartProvider>
        <CartProbe />
      </AssociationCartProvider>,
    )
    await user.click(screen.getByText('add-p1'))
    await user.click(screen.getByText('set-p1-3'))
    expect(screen.getByTestId('total-qty')).toHaveTextContent('3')
    expect(screen.getByTestId('estimated-total')).toHaveTextContent('30')
  })

  it('removeFromCart elimină produsul', async () => {
    const user = userEvent.setup()
    render(
      <AssociationCartProvider>
        <CartProbe />
      </AssociationCartProvider>,
    )
    await user.click(screen.getByText('add-p1'))
    await user.click(screen.getByText('add-p2'))
    expect(screen.getByTestId('line-count')).toHaveTextContent('2')
    await user.click(screen.getByText('rm-p1'))
    expect(screen.getByTestId('line-count')).toHaveTextContent('1')
    expect(screen.getByTestId('estimated-total')).toHaveTextContent('5')
  })

  it('clearCart golește coșul', async () => {
    const user = userEvent.setup()
    render(
      <AssociationCartProvider>
        <CartProbe />
      </AssociationCartProvider>,
    )
    await user.click(screen.getByText('add-p1'))
    await user.click(screen.getByText('clear'))
    expect(screen.getByTestId('line-count')).toHaveTextContent('0')
    expect(screen.getByTestId('total-qty')).toHaveTextContent('0')
    expect(screen.getByTestId('estimated-total')).toHaveTextContent('0')
  })

  it('estimatedTotal și cartTotalQty (cantitate totală) sunt corecte pentru mai multe linii', async () => {
    const user = userEvent.setup()
    render(
      <AssociationCartProvider>
        <CartProbe />
      </AssociationCartProvider>,
    )
    await user.click(screen.getByText('add-p1'))
    await user.click(screen.getByText('add-p2'))
    expect(screen.getByTestId('total-qty')).toHaveTextContent('2')
    expect(screen.getByTestId('estimated-total')).toHaveTextContent('15')
  })
})
