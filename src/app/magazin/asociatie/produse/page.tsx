import type { Metadata } from 'next'

import { AssociationCatalogPageClient } from '@/components/shop/association/AssociationCatalogPageClient'
import { APP_NAME } from '@/lib/brand'

const title = 'Magazin — Gustă din Bucovina'
const description =
  `Produse locale oferite de Asociația Gustă din Bucovina — catalog cu filtre și coș. Operator tehnic: ${APP_NAME}.`

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title,
  description,
  openGraph: {
    title,
    description,
    images: [{ url: '/images/asociatie/logo_hero_pe_verde.png', alt: 'Gustă din Bucovina' }],
  },
}

export default function MagazinAsociatieProdusePage() {
  return <AssociationCatalogPageClient />
}
