import { getFarmProfileOrNull } from '@/lib/setari/farm-profile-server'

import { CePrimestiPageClient } from './CePrimestiPageClient'

export default async function NotificariSetariPage() {
  const farm = await getFarmProfileOrNull()
  return <CePrimestiPageClient localitate={farm?.localitate ?? null} />
}
