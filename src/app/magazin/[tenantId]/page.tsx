import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

import { FarmShopClient } from '@/components/shop/FarmShopClient'
import { loadPublicShopCatalogCached } from '@/lib/shop/load-public-shop'

export const dynamic = 'force-dynamic'

type Props = { params: Promise<{ tenantId: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { tenantId } = await params
  const data = await loadPublicShopCatalogCached(tenantId)
  if (!data) {
    return { title: 'Magazin fermier' }
  }
  return {
    title: `${data.farmName} — Magazin fermier`,
    description: `Produse de la ${data.farmName}. Comandă direct de la fermă.`,
  }
}

export default async function MagazinTenantPage({ params }: Props) {
  const { tenantId } = await params
  const data = await loadPublicShopCatalogCached(tenantId)
  if (!data) notFound()
  return (
    <FarmShopClient tenantId={tenantId} farmName={data.farmName} products={data.products} />
  )
}
