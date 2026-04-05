import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import {
  GustProducersPage,
  buildGustProducerCardsFromProducts,
} from '@/components/shop/association/producers/GustProducersPage'
import { mockAssociationProduct } from '@/test/helpers/association-test-utils'

describe('buildGustProducerCardsFromProducts', () => {
  it('agregă logo, descriere, social și produsele concrete per producător', () => {
    const cards = buildGustProducerCardsFromProducts([
      mockAssociationProduct({
        tenantId: '550e8400-e29b-41d4-a716-446655440011',
        farmName: 'Ferma Zmeurel',
        nume: 'Zmeură proaspătă',
        producerLogoUrl: 'https://cdn.test/logo.jpg',
        producerDescription:
          'La Zmeurel cultivăm cu grijă și respect pentru gustul adevărat, direct din Bucovina.',
        producerLocation: 'Suceava',
        producerFacebook: 'ferma.zmeurel',
        producerInstagram: 'ferma.zmeurel',
      }),
      mockAssociationProduct({
        tenantId: '550e8400-e29b-41d4-a716-446655440011',
        farmName: 'Ferma Zmeurel',
        nume: 'Mere',
        producerLogoUrl: 'https://cdn.test/logo.jpg',
        producerLocation: 'Suceava',
        producerFacebook: 'ferma.zmeurel',
        producerInstagram: 'ferma.zmeurel',
      }),
      mockAssociationProduct({
        tenantId: '550e8400-e29b-41d4-a716-446655440011',
        farmName: 'Ferma Zmeurel',
        nume: 'Mure',
      }),
    ])

    expect(cards).toHaveLength(1)
    expect(cards[0]).toMatchObject({
      farmName: 'Ferma Zmeurel',
      logoUrl: 'https://cdn.test/logo.jpg',
      location: 'Suceava',
      productCount: 3,
      facebook: 'ferma.zmeurel',
      instagram: 'ferma.zmeurel',
    })
    expect(cards[0]?.description).toContain('La Zmeurel cultivăm cu grijă')
    expect(cards[0]?.listedProducts).toEqual(['Mere', 'Mure', 'Zmeură proaspătă'])
  })
})

describe('GustProducersPage', () => {
  it('afișează descrierea și lista concretă de produse pe card', () => {
    render(
      <GustProducersPage
        producers={[
          {
            tenantId: '550e8400-e29b-41d4-a716-446655440021',
            farmName: 'Ferma Zmeurel',
            logoUrl: 'https://cdn.test/logo.jpg',
            description: 'Descriere scurtă despre fermă.',
            location: 'Suceava',
            listedProducts: ['Zmeură', 'Mere', 'Mure'],
            productCount: 3,
            website: 'fermazmeurel.ro',
            facebook: 'ferma.zmeurel',
            instagram: 'ferma.zmeurel',
            whatsapp: '+40700000000',
          },
        ]}
      />,
    )

    expect(screen.getByRole('link', { name: /ferma zmeurel/i })).toBeInTheDocument()
    expect(screen.getByText('Descriere scurtă despre fermă.')).toBeInTheDocument()
    expect(screen.getByText('Zmeură · Mere · Mure')).toBeInTheDocument()
    expect(screen.getByText('3 produse')).toBeInTheDocument()
  })
})
