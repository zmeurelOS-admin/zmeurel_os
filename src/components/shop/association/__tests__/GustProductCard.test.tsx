import { describe, expect, it, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { GustProductCard } from '@/components/shop/association/catalog/GustProductCard'
import type { GustCatalogProduct } from '@/components/shop/association/catalog/gustProductTypes'

vi.mock('next/image', () => ({
  default: function MockImage(props: { alt: string; src: string }) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img alt={props.alt} src={props.src} />
  },
}))

function baseProduct(overrides: Partial<GustCatalogProduct> = {}): GustCatalogProduct {
  return {
    id: 'a0000000-0000-4000-8000-000000000001',
    nume: 'Produs test',
    descriere: null,
    categorie: 'fruct',
    unitate_vanzare: 'buc',
    gramaj_per_unitate: 500,
    pret_unitar: 99,
    moneda: 'RON',
    poza_1_url: null,
    poza_2_url: null,
    ...overrides,
  }
}

describe('GustProductCard', () => {
  it('afișează numele fermei și prețul', () => {
    const onOpen = vi.fn()
    const onAdd = vi.fn()
    const p = baseProduct({ nume: 'Zmeură premium', pret_unitar: 12.5 })
    render(<GustProductCard product={p} farmName="Ferma X" onOpenDetail={onOpen} onAddToCart={onAdd} />)
    expect(screen.getByText('Zmeură premium')).toBeInTheDocument()
    expect(screen.getByText('Ferma X')).toBeInTheDocument()
    expect(screen.getByText(/12,5/)).toBeInTheDocument()
  })

  it('afișează badge-ul când e setat', () => {
    const onOpen = vi.fn()
    const onAdd = vi.fn()
    const p = baseProduct()
    render(
      <GustProductCard
        product={p}
        farmName="F"
        badge="NOUTATE"
        onOpenDetail={onOpen}
        onAddToCart={onAdd}
      />,
    )
    expect(screen.getByText('NOUTATE')).toBeInTheDocument()
  })

  it('folosește displayPrice (override asociație) în loc de pret_unitar când există', () => {
    const onOpen = vi.fn()
    const onAdd = vi.fn()
    const p = baseProduct({ pret_unitar: 100, displayPrice: 42 })
    render(<GustProductCard product={p} farmName="Ferma" onOpenDetail={onOpen} onAddToCart={onAdd} />)
    const article = screen.getByRole('button', { name: /Deschide detalii/ })
    expect(within(article).getByText(/42/)).toBeInTheDocument()
    expect(within(article).queryByText(/^100/)).not.toBeInTheDocument()
  })

  it('click pe + apelează onAddToCart cu id produs', async () => {
    const user = userEvent.setup()
    const onOpen = vi.fn()
    const onAdd = vi.fn()
    const p = baseProduct({ id: 'b0000000-0000-4000-8000-000000000002', nume: 'Item' })
    render(<GustProductCard product={p} farmName="F" onOpenDetail={onOpen} onAddToCart={onAdd} />)
    await user.click(screen.getByRole('button', { name: /Adaugă Item în coș/ }))
    expect(onAdd).toHaveBeenCalledTimes(1)
    expect(onAdd).toHaveBeenCalledWith('b0000000-0000-4000-8000-000000000002')
    expect(onOpen).not.toHaveBeenCalled()
  })

  it('click pe card apelează onOpenDetail', async () => {
    const user = userEvent.setup()
    const onOpen = vi.fn()
    const onAdd = vi.fn()
    const p = baseProduct({ id: 'c0000000-0000-4000-8000-000000000003' })
    render(<GustProductCard product={p} farmName="F" onOpenDetail={onOpen} onAddToCart={onAdd} />)
    await user.click(screen.getByRole('button', { name: /Deschide detalii/ }))
    expect(onOpen).toHaveBeenCalledWith('c0000000-0000-4000-8000-000000000003')
  })
})
