import { useState } from 'react'

import { describe, expect, it, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { GustCatalogPage } from '@/components/shop/association/catalog/GustCatalogPage'
import type { AssociationProduct } from '@/lib/shop/load-association-catalog'

vi.mock('framer-motion', () => ({
  motion: {
    li: ({ children }: { children?: React.ReactNode }) => <li>{children}</li>,
  },
}))

const TID = 'f0000000-0000-4000-8000-000000000001'

function prod(
  id: string,
  nume: string,
  categorie: string,
  farm: string,
  price: number,
): AssociationProduct {
  return {
    id,
    nume,
    descriere: null,
    categorie,
    unitate_vanzare: 'kg',
    gramaj_per_unitate: null,
    pret_unitar: price,
    moneda: 'RON',
    poza_1_url: null,
    poza_2_url: null,
    tenantId: TID,
    farmName: farm,
    farmRegion: null,
    displayPrice: price,
  }
}

/** 5 produse în 3 categorii: fruct×2, leguma×2, procesat×1 */
const CATALOG: AssociationProduct[] = [
  prod('10000000-0000-4000-8000-000000000001', 'Mure sălbatice', 'fruct', 'Ferma A', 20),
  prod('10000000-0000-4000-8000-000000000002', 'Zmeură', 'fruct', 'Ferma A', 22),
  prod('10000000-0000-4000-8000-000000000003', 'Roșii', 'leguma', 'Ferma B', 8),
  prod('10000000-0000-4000-8000-000000000004', 'Castraveți', 'leguma', 'Ferma B', 7),
  prod('10000000-0000-4000-8000-000000000005', 'Gem', 'procesat', 'Ferma C', 15),
]

function CatalogHarness() {
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const onAdd = vi.fn()
  const onOpen = vi.fn()
  return (
    <div>
      <label>
        Căutare
        <input
          data-testid="search-input"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </label>
      <GustCatalogPage
        products={CATALOG}
        selectedCategory={selectedCategory}
        onCategoryChange={setSelectedCategory}
        searchQuery={searchQuery}
        onAddToCart={onAdd}
        onOpenDetail={onOpen}
        cart={[]}
      />
    </div>
  )
}

describe('GustCatalogPage', () => {
  it('afișează toate produsele și chip-urile de categorii derivate din date', () => {
    render(<CatalogHarness />)
    for (const p of CATALOG) {
      expect(screen.getAllByText(p.nume).length).toBeGreaterThanOrEqual(1)
    }
    expect(screen.getByRole('button', { name: /Toate \(5\)/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Fructe \(2\)/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Legume \(2\)/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Procesate \(1\)/ })).toBeInTheDocument()
  })

  it('filtrează după categorie la click pe chip', async () => {
    const user = userEvent.setup()
    render(<CatalogHarness />)
    await user.click(screen.getByRole('button', { name: /Legume \(2\)/ }))
    expect(screen.getByText('2 produse')).toBeInTheDocument()
    expect(screen.getByText('Roșii')).toBeInTheDocument()
    expect(screen.getByText('Castraveți')).toBeInTheDocument()
    expect(screen.queryByText('Zmeură')).not.toBeInTheDocument()
  })

  it('filtrează după nume (căutare)', async () => {
    const user = userEvent.setup()
    render(<CatalogHarness />)
    const input = screen.getByTestId('search-input')
    await user.clear(input)
    await user.type(input, 'Gem')
    expect(screen.getByText('Gem')).toBeInTheDocument()
    expect(screen.queryByText('Zmeură')).not.toBeInTheDocument()
  })

  it('arată empty state când nu există rezultate', async () => {
    const user = userEvent.setup()
    render(<CatalogHarness />)
    const input = screen.getByTestId('search-input')
    await user.clear(input)
    await user.type(input, 'xyznonexistent999')
    expect(screen.getByText('Niciun produs găsit')).toBeInTheDocument()
  })
})
