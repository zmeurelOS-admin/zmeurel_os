import { createElement, type ReactElement } from 'react'

import { render, type RenderOptions } from '@testing-library/react'

import { AssociationCartProvider } from '@/components/shop/association/AssociationCartProvider'
import type { AssociationCartLine } from '@/components/shop/association/AssociationCartProvider'
import type { GustProducerCard } from '@/components/shop/association/producers/GustProducersPage'
import type { AssociationProduct } from '@/lib/shop/load-association-catalog'
import type { Database } from '@/types/supabase'

type ComandaRow = Database['public']['Tables']['comenzi']['Row']
type AssociationMemberRow = Database['public']['Tables']['association_members']['Row']

/** UUID-uri deterministe pentru teste (v4). */
export const ASSOCIATION_TEST_IDS = {
  tenantId: '550e8400-e29b-41d4-a716-446655440001',
  productId: '550e8400-e29b-41d4-a716-446655440002',
  userId: '550e8400-e29b-41d4-a716-446655440003',
  orderId: '550e8400-e29b-41d4-a716-446655440004',
  memberId: '550e8400-e29b-41d4-a716-446655440005',
  clientId: '550e8400-e29b-41d4-a716-446655440006',
} as const

const ISO = '2026-04-04T12:00:00.000Z'

/**
 * Produs de catalog asociație — aliniat la `AssociationProduct` / `load-association-catalog`.
 */
export function mockAssociationProduct(overrides?: Partial<AssociationProduct>): AssociationProduct {
  return {
    id: ASSOCIATION_TEST_IDS.productId,
    nume: 'Zmeură congelată 1kg',
    descriere: 'Produs de test',
    categorie: 'Fructe',
    unitate_vanzare: 'buc',
    gramaj_per_unitate: 1000,
    pret_unitar: 28,
    moneda: 'RON',
    poza_1_url: null,
    poza_2_url: null,
    tenantId: ASSOCIATION_TEST_IDS.tenantId,
    farmName: 'Ferma de test',
    farmRegion: 'Suceava',
    producerLogoUrl: null,
    producerDescription: 'Descriere de test',
    producerLocation: 'Suceava',
    producerWebsite: null,
    producerFacebook: null,
    producerInstagram: null,
    producerWhatsapp: null,
    producerEmailPublic: null,
    producerProgramPiata: null,
    displayPrice: 25,
    ...overrides,
  }
}

/**
 * Rând `comenzi` — util pentru workspace admin / fluxuri magazin.
 */
export function mockAssociationOrder(overrides?: Partial<ComandaRow>): ComandaRow {
  return {
    id: ASSOCIATION_TEST_IDS.orderId,
    tenant_id: ASSOCIATION_TEST_IDS.tenantId,
    cantitate_kg: 5,
    pret_per_kg: 25,
    total: 125,
    status: 'noua',
    data_comanda: ISO.split('T')[0]!,
    data_livrare: '2026-04-05',
    created_at: ISO,
    updated_at: ISO,
    client_id: null,
    client_nume_manual: 'Client test',
    cost_livrare: 0,
    data_origin: 'magazin_public',
    demo_seed_id: null,
    linked_vanzare_id: null,
    locatie_livrare: null,
    observatii: null,
    parent_comanda_id: null,
    produs_id: ASSOCIATION_TEST_IDS.productId,
    telefon: '+40700000000',
    whatsapp_consent: true,
    ...overrides,
  }
}

/**
 * Linie coș (`AssociationCartLine`) — același shape ca în `AssociationCartProvider`.
 */
export function mockCartItem(product: AssociationProduct, qty: number): AssociationCartLine {
  return { product, qty }
}

/**
 * Card producător — aliniat la `GustProducerCard`.
 */
export function mockProducer(overrides?: Partial<GustProducerCard>): GustProducerCard {
  return {
    tenantId: ASSOCIATION_TEST_IDS.tenantId,
    farmName: 'Ferma de test',
    logoUrl: null,
    description: 'Descriere de test',
    location: 'Suceava',
    listedProducts: ['Zmeură'],
    productCount: 1,
    website: null,
    facebook: null,
    instagram: null,
    whatsapp: null,
    ...overrides,
  }
}

/**
 * Membru workspace asociație — aliniat la `association_members` Row.
 */
export function mockAssociationMember(overrides?: Partial<AssociationMemberRow>): AssociationMemberRow {
  return {
    id: ASSOCIATION_TEST_IDS.memberId,
    user_id: ASSOCIATION_TEST_IDS.userId,
    role: 'admin',
    created_at: ISO,
    invited_by: null,
    ...overrides,
  }
}

function AssociationProvidersWrapper({ children }: { children: React.ReactNode }) {
  return createElement(AssociationCartProvider, null, children)
}

/**
 * Render cu `AssociationCartProvider` (coș magazin asociație).
 * Extinde cu alți provideri (ex. QueryClient) în testele care îi cer.
 */
export function renderWithAssociationProviders(
  ui: ReactElement,
  options?: Omit<RenderOptions, 'wrapper'>,
) {
  return render(ui, {
    ...options,
    wrapper: AssociationProvidersWrapper,
  })
}
