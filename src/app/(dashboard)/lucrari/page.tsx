import { Suspense } from 'react'

import { LucrariPageClient } from './LucrariPageClient'

export default function LucrariPage() {
  return (
    <Suspense fallback={null}>
      <LucrariPageClient />
    </Suspense>
  )
}
