import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

import { GustProducerProfilePage } from '@/components/shop/association/producers/GustProducerProfilePage'
import { buildAssociationMarketLine, loadAssociationSettingsCached } from '@/lib/association/public-settings'
import { loadProducerProfileCached } from '@/lib/shop/load-producer-profile'

export const dynamic = 'force-dynamic'

type Props = { params: Promise<{ tenantId: string }> }

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://zmeurel.app'

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { tenantId } = await params
  const profile = await loadProducerProfileCached(tenantId)
  if (!profile) {
    return {
      title: 'Producător — Gustă din Bucovina',
    }
  }
  const { farm } = profile
  const title = `${farm.numeFerma} — Gustă din Bucovina`
  const description =
    farm.descrierePublica?.trim() || `Produse locale de la ${farm.numeFerma}`
  const ogImage = farm.pozeFerma[0] || `${siteUrl.replace(/\/$/, '')}/icons/icon.svg`
  const imageAbsolute =
    ogImage.startsWith('http://') || ogImage.startsWith('https://') ? ogImage : `${siteUrl.replace(/\/$/, '')}${ogImage.startsWith('/') ? '' : '/'}${ogImage}`

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: 'website',
      locale: 'ro_RO',
      images: [{ url: imageAbsolute, alt: farm.numeFerma }],
    },
  }
}

export default async function MagazinAsociatieProducerProfilePage({ params }: Props) {
  const { tenantId } = await params
  const [profile, settings] = await Promise.all([
    loadProducerProfileCached(tenantId),
    loadAssociationSettingsCached(),
  ])
  if (!profile) notFound()

  return (
    <GustProducerProfilePage
      tenantId={tenantId}
      farm={profile.farm}
      products={profile.products}
      associationMarketLine={buildAssociationMarketLine(settings)}
    />
  )
}
