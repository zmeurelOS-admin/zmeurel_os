import type { Metadata } from 'next'

import { AssociationLandingView } from '@/components/shop/association/AssociationLandingView'
import { loadAssociationSettingsCached } from '@/lib/association/public-settings'

const title = 'Gustă din Bucovina — Produse locale din Suceava'
const description =
  'Magazin online al Asociației Gustă din Bucovina — produse locale din Suceava. Platformă tehnică: Zmeurel OS.'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title,
  description,
  openGraph: {
    title,
    description,
    images: [{ url: '/images/gusta-logo.png', alt: 'Gustă din Bucovina' }],
  },
}

export default async function MagazinAsociatieLandingPage() {
  const settings = await loadAssociationSettingsCached()
  return <AssociationLandingView settings={settings} />
}
