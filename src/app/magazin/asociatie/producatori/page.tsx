import type { Metadata } from 'next'

import { AssociationProducersPageClient } from '@/components/shop/association/AssociationProducersPageClient'

const title = 'Producători — Gustă din Bucovina'
const description =
  'Producători din rețeaua Asociației Gustă din Bucovina — prezentare publică în magazinul asociației.'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title,
  description,
  openGraph: {
    title,
    description,
    images: [{ url: '/icons/icon.svg', alt: 'Gustă din Bucovina' }],
  },
}

export default function MagazinAsociatieProducatoriPage() {
  return <AssociationProducersPageClient />
}
