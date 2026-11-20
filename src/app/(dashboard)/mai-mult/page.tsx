import { getFarmProfileOrNull } from '@/lib/setari/farm-profile-server'

import { MaiMultPageClient } from './MaiMultPageClient'

export default async function MaiMultPage() {
  const farm = await getFarmProfileOrNull()
  return <MaiMultPageClient farmName={farm?.numeFerma ?? null} localitate={farm?.localitate ?? null} />
}
