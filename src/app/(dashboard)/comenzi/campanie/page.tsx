import { cookies } from 'next/headers'
import { notFound, redirect } from 'next/navigation'

import { CampaniePageClient } from './CampaniePageClient'
import type { CampaignAdminPayload } from '@/lib/shop/campaign-admin-queries'

export const dynamic = 'force-dynamic'

async function loadCampaign(): Promise<CampaignAdminPayload> {
  const cookieStore = await cookies()
  const configuredOrigin =
    process.env.SITE_URL ??
    process.env.NEXT_PUBLIC_SITE_URL ??
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null)
  const origin = configuredOrigin?.replace(/\/+$/, '') ?? 'http://localhost:3000'

  const response = await fetch(
    `${origin}/api/shop/campaign/zmeura-2026/admin`,
    {
      cache: 'no-store',
      headers: {
        cookie: cookieStore.toString(),
      },
    },
  )

  if (response.status === 401) redirect('/login')
  if (response.status === 404) notFound()
  if (!response.ok) {
    throw new Error('Nu am putut încărca clasamentul campaniei.')
  }

  return response.json() as Promise<CampaignAdminPayload>
}

export default async function CampaniePage() {
  return <CampaniePageClient initialData={await loadCampaign()} />
}
